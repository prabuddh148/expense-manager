package com.expensemanager.activity;

import com.expensemanager.activity.kafka.ActivityEventConsumer;
import com.expensemanager.activity.kafka.ActivityEventMessage;
import com.expensemanager.activity.repository.ActivityEventRepository;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ActivityServiceTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ActivityEventConsumer consumer;

    @Autowired
    private ActivityEventRepository repository;

    @Value("${app.jwt.secret}")
    private String secret;

    @BeforeEach
    void clean() {
        repository.deleteAll();
    }

    private ActivityEventMessage expenseCreated(long userId) {
        return new ActivityEventMessage(UUID.randomUUID(), userId, "Expense", 10L, "CREATED",
                new BigDecimal("499.00"), Instant.now());
    }

    private String tokenFor(long userId) {
        return Jwts.builder()
                .subject(String.valueOf(userId))
                .expiration(Date.from(Instant.now().plusSeconds(600)))
                .signWith(Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8)))
                .compact();
    }

    @Test
    @DisplayName("a redelivered event is stored only once")
    void idempotentConsumer() {
        ActivityEventMessage message = expenseCreated(7L);

        assertThat(consumer.store(message)).isTrue();
        assertThat(consumer.store(message)).isFalse();
        assertThat(repository.count()).isEqualTo(1);
    }

    @Test
    @DisplayName("an incomplete event is rejected so it goes to the dead-letter topic")
    void incompleteEventRejected() {
        ActivityEventMessage broken = new ActivityEventMessage(null, 7L, "Expense", 1L, "CREATED", null, null);

        assertThatThrownBy(() -> consumer.store(broken)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("each user sees only their own activity, and only with a valid token")
    void feedIsPerUser() throws Exception {
        consumer.store(expenseCreated(7L));
        consumer.store(expenseCreated(7L));
        consumer.store(expenseCreated(8L));

        mockMvc.perform(get("/api/activity").header("Authorization", "Bearer " + tokenFor(7L)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.content[0].entityType").value("Expense"));

        mockMvc.perform(get("/api/activity/summary").header("Authorization", "Bearer " + tokenFor(8L)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].count").value(1));

        mockMvc.perform(get("/api/activity")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/activity").header("Authorization", "Bearer not-a-token"))
                .andExpect(status().isUnauthorized());
    }
}
