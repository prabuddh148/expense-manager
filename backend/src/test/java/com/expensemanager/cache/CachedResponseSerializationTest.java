package com.expensemanager.cache;

import com.expensemanager.dto.analytics.AnalyticsResponse;
import com.expensemanager.dto.category.CategoryRequest;
import com.expensemanager.dto.dashboard.DashboardResponse;
import com.expensemanager.dto.expense.ExpenseRequest;
import com.expensemanager.dto.salary.SalaryRequest;
import com.expensemanager.support.ApiTestBase;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.serializer.RedisSerializer;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.YearMonth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** A response served from Redis must look exactly like one computed fresh. */
class CachedResponseSerializationTest extends ApiTestBase {

    @BeforeEach
    void seedData() throws Exception {
        YearMonth now = YearMonth.now();
        mockMvc.perform(authed(post("/api/salary"), new SalaryRequest(
                        new BigDecimal("50000"),
                        now.getYear(), now.getMonthValue())))
                .andExpect(status().isOk());
        String category = mockMvc.perform(authed(post("/api/categories"),
                        new CategoryRequest("Office Lunch",new BigDecimal("6000"), "#4F8DFD", "food")))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        long categoryId = objectMapper.readTree(category).get("id").asLong();
        mockMvc.perform(authed(post("/api/expenses"), new ExpenseRequest(
                        new BigDecimal("123.40"), categoryId, null, "Lunch", LocalDate.now(), LocalTime.of(13, 5))))
                .andExpect(status().isCreated());
    }

    private <T> void assertRoundTrip(String path, Class<T> type) throws Exception {
        String fresh = mockMvc.perform(authed(get(path)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        RedisSerializer<T> serializer = RedisCacheConfig.valueSerializer(objectMapper, type);
        T restored = serializer.deserialize(serializer.serialize(objectMapper.readValue(fresh, type)));

        assertThat(objectMapper.writeValueAsString(restored)).isEqualTo(fresh);
    }

    @Test
    @DisplayName("dashboard survives the Redis round trip unchanged")
    void dashboard() throws Exception {
        assertRoundTrip("/api/dashboard", DashboardResponse.class);
    }

    @Test
    @DisplayName("analytics survives the Redis round trip unchanged")
    void analytics() throws Exception {
        assertRoundTrip("/api/analytics?period=this_month", AnalyticsResponse.class);
    }
}
