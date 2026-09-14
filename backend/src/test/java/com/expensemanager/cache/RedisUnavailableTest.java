package com.expensemanager.cache;

import com.expensemanager.dto.expense.ExpenseRequest;
import com.expensemanager.support.ApiTestBase;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.CacheManager;
import org.springframework.data.redis.cache.RedisCacheManager;
import org.springframework.test.context.TestPropertySource;

import java.math.BigDecimal;
import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Caching switched on, but nothing listening on the Redis port: the API must behave as normal. */
@TestPropertySource(properties = {
        "app.redis.enabled=true",
        "spring.data.redis.port=1",
        "spring.data.redis.timeout=500ms",
        "spring.data.redis.connect-timeout=500ms"
})
class RedisUnavailableTest extends ApiTestBase {

    @Autowired
    private CacheManager cacheManager;

    @Test
    @DisplayName("with Redis down the dashboard still answers, and reflects every write")
    void fallsBackToDatabase() throws Exception {
        assertThat(cacheManager).isInstanceOf(RedisCacheManager.class);

        addExpense("100");
        mockMvc.perform(authed(get("/api/dashboard")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.expenses.totalSpent").value(100.00));

        addExpense("50");
        mockMvc.perform(authed(get("/api/dashboard")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.expenses.totalSpent").value(150.00));
    }

    private void addExpense(String amount) throws Exception {
        mockMvc.perform(authed(post("/api/expenses"), new ExpenseRequest(
                        new BigDecimal(amount), null, "Snacks", null, LocalDate.now(), null)))
                .andExpect(status().isCreated());
    }
}
