package com.expensemanager.controller;

import com.expensemanager.dto.category.CategoryRequest;
import com.expensemanager.dto.expense.ExpenseRequest;
import com.expensemanager.dto.salary.SalaryRequest;
import com.expensemanager.support.ApiTestBase;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class AnalyticsTest extends ApiTestBase {

    // Anchored mid-month so this_month always contains the fixtures, whatever day it runs.
    private static final LocalDate ANCHOR = YearMonth.now().atDay(15);

    private long category(String name, String budget) throws Exception {
        String body = mockMvc.perform(authed(post("/api/categories"),
                        new CategoryRequest(name, new BigDecimal(budget), "#4F8DFD", null)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(body).get("id").asLong();
    }

    private void expense(String amount, Long categoryId, String otherName, LocalDate date) throws Exception {
        mockMvc.perform(authed(post("/api/expenses"),
                        new ExpenseRequest(new BigDecimal(amount), categoryId, otherName, null, date, null)))
                .andExpect(status().isCreated());
    }

    @Test
    @DisplayName("monthly analytics totals expenses, counts transactions and splits by category")
    void monthlyTotals() throws Exception {
        YearMonth month = YearMonth.now();
        mockMvc.perform(authed(post("/api/salary"), new SalaryRequest(
                        new BigDecimal("45000"), new BigDecimal("100000"), null,
                        month.getYear(), month.getMonthValue())))
                .andExpect(status().isOk());

        long food = category("Food dining", "5000");
        expense("3000", food, null, ANCHOR);
        expense("1000", food, null, ANCHOR.plusDays(1));
        expense("1000", null, "Shopping", ANCHOR);

        mockMvc.perform(authed(get("/api/analytics/monthly?period=this_month")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rangeLabel").value("This Month"))
                .andExpect(jsonPath("$.totalExpenses").value(5000.00))
                .andExpect(jsonPath("$.transactionCount").value(3))
                .andExpect(jsonPath("$.salary").value(45000.00))
                .andExpect(jsonPath("$.remainingAmount").value(40000.00))
                .andExpect(jsonPath("$.categories[0].name").value("Food dining"))
                .andExpect(jsonPath("$.categories[0].amount").value(4000.00))
                .andExpect(jsonPath("$.categories[0].percentage").value(80.00))
                .andExpect(jsonPath("$.categories[1].name").value("Shopping"))
                .andExpect(jsonPath("$.daily.length()").value(month.lengthOfMonth()));
    }

    @Test
    @DisplayName("a custom range needs both dates and only counts what falls inside it")
    void customRange() throws Exception {
        long food = category("Food dining", "5000");
        expense("500", food, null, ANCHOR);
        expense("700", food, null, ANCHOR.plusDays(5));

        mockMvc.perform(authed(get("/api/analytics?period=custom&from=" + ANCHOR + "&to=" + ANCHOR.plusDays(2))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rangeLabel").value("Custom Range"))
                .andExpect(jsonPath("$.totalExpenses").value(500.00))
                .andExpect(jsonPath("$.daily.length()").value(3));

        mockMvc.perform(authed(get("/api/analytics?period=custom&from=" + ANCHOR)))
                .andExpect(status().isBadRequest());

        mockMvc.perform(authed(get("/api/analytics?period=nonsense")))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("an empty account still returns a well formed dashboard")
    void emptyDashboard() throws Exception {
        mockMvc.perform(authed(get("/api/dashboard")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.salary.amount").value(0.00))
                .andExpect(jsonPath("$.salary.remainingAmount").value(0.00))
                .andExpect(jsonPath("$.expenses.totalSpent").value(0.00))
                .andExpect(jsonPath("$.loans.totalOutstanding").value(0.00))
                .andExpect(jsonPath("$.categoryBreakdown.length()").value(0))
                .andExpect(jsonPath("$.recentExpenses.length()").value(0))
                .andExpect(jsonPath("$.monthLabel").isNotEmpty());
    }

    @Test
    @DisplayName("the dashboard reports budget totals and the five most recent expenses")
    void dashboardSummaries() throws Exception {
        long food = category("Food dining", "5000");
        for (int day = 1; day <= 6; day++) {
            expense("100", food, null, ANCHOR.withDayOfMonth(day));
        }

        mockMvc.perform(authed(get("/api/dashboard")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.expenses.totalSpent").value(600.00))
                .andExpect(jsonPath("$.expenses.totalBudgeted").value(5000.00))
                .andExpect(jsonPath("$.expenses.remainingBudget").value(4400.00))
                .andExpect(jsonPath("$.expenses.transactionCount").value(6))
                .andExpect(jsonPath("$.recentExpenses.length()").value(5));
    }
}
