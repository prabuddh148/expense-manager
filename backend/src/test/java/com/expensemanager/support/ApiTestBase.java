package com.expensemanager.support;

import com.expensemanager.dto.auth.AuthResponse;
import com.expensemanager.dto.auth.SignupRequest;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.util.concurrent.atomic.AtomicInteger;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Boots the whole application against H2 and signs a fresh user in for each test, so every
 * test exercises the real security filter chain rather than a mocked principal.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
public abstract class ApiTestBase {

    private static final AtomicInteger COUNTER = new AtomicInteger();

    @Autowired
    protected MockMvc mockMvc;

    @Autowired
    protected ObjectMapper objectMapper;

    protected AuthResponse session;

    @BeforeEach
    protected void signUpFreshUser() throws Exception {
        String email = "user" + COUNTER.incrementAndGet() + "@example.com";
        String body = objectMapper.writeValueAsString(
                new SignupRequest("Test User", email, "correct-horse-battery"));

        String response = mockMvc.perform(post("/api/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();

        session = objectMapper.readValue(response, AuthResponse.class);
    }

    /** Attaches the signed-in user's bearer token and a JSON body. */
    protected MockHttpServletRequestBuilder authed(MockHttpServletRequestBuilder builder, Object body) {
        try {
            return builder
                    .header("Authorization", "Bearer " + session.accessToken())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(body));
        } catch (Exception ex) {
            throw new IllegalStateException(ex);
        }
    }

    protected MockHttpServletRequestBuilder authed(MockHttpServletRequestBuilder builder) {
        return builder.header("Authorization", "Bearer " + session.accessToken());
    }

    protected <T> T read(String json, Class<T> type) throws Exception {
        return objectMapper.readValue(json, type);
    }
}
