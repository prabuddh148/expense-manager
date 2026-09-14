package com.expensemanager.events;

import com.expensemanager.dto.expense.ExpenseRequest;
import com.expensemanager.support.ApiTestBase;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.TestPropertySource;

import java.math.BigDecimal;
import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Publishing switched on, but no broker: writes must still succeed, and without waiting on Kafka. */
@TestPropertySource(properties = {
        "app.kafka.enabled=true",
        "spring.kafka.bootstrap-servers=localhost:1",
        "spring.kafka.admin.auto-create=false",
        "spring.kafka.producer.properties.max.block.ms=1000"
})
class KafkaUnavailableTest extends ApiTestBase {

    @Autowired
    private ActivityEventPublisher publisher;

    @Test
    @DisplayName("with Kafka down an expense is still saved and returned")
    void writeSucceedsWithoutBroker() throws Exception {
        assertThat(publisher).isNotNull();

        long started = System.nanoTime();
        mockMvc.perform(authed(post("/api/expenses"), new ExpenseRequest(
                        new BigDecimal("75"), null, "Auto fare", null, LocalDate.now(), null)))
                .andExpect(status().isCreated());
        long elapsedMs = (System.nanoTime() - started) / 1_000_000;

        // The send runs on another thread; the request must not sit out max.block.ms.
        assertThat(elapsedMs).isLessThan(1000);

        mockMvc.perform(authed(get("/api/expenses")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].expenseName").value("Auto fare"));
    }
}
