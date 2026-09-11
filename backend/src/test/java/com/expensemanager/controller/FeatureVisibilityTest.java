package com.expensemanager.controller;

import com.expensemanager.dto.category.CategoryRequest;
import com.expensemanager.dto.expense.ExpenseRequest;
import com.expensemanager.dto.loan.EmiPaymentRequest;
import com.expensemanager.dto.loan.LoanRequest;
import com.expensemanager.dto.moneytracker.MoneyTrackerRequest;
import com.expensemanager.dto.salary.SalaryRequest;
import com.expensemanager.dto.sms.SmsCategoryRequest;
import com.expensemanager.dto.sms.SmsTransactionRequest;
import com.expensemanager.entity.MoneyTrackerType;
import com.expensemanager.entity.SmsTransactionType;
import com.expensemanager.security.FeatureVisibility;
import com.expensemanager.support.ApiTestBase;
import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Switching a section off in the app must take its figures out of everything else too,
 * and switching it back must bring them back - nothing is deleted.
 *
 * One month is set up with money arriving from every place that can move the balance:
 * a manual expense, an expense added from SMS, one deducted from the Money Tracker, a
 * Money Tracker add-on to the salary, and an EMI instalment.
 */
class FeatureVisibilityTest extends ApiTestBase {

    private static final LocalDate TODAY = LocalDate.now();

    private long categoryId;

    @BeforeEach
    void seedOneOfEverything() throws Exception {
        mockMvc.perform(authed(post("/api/salary"),
                        new SalaryRequest(new BigDecimal("50000"), null, null,
                                TODAY.getYear(), TODAY.getMonthValue())))
                .andExpect(status().isOk());

        categoryId = idOf(mockMvc.perform(authed(post("/api/categories"),
                        new CategoryRequest("Groceries Test", new BigDecimal("10000"), "#F2704A", null)))
                .andExpect(status().isCreated()));

        // Manual: 1,000.
        mockMvc.perform(authed(post("/api/expenses"),
                        new ExpenseRequest(new BigDecimal("1000"), categoryId, null, null, TODAY, null)))
                .andExpect(status().isCreated());

        // From SMS: 500.
        String imported = mockMvc.perform(authed(post("/api/sms-transactions/import"), List.of(
                        new SmsTransactionRequest("ICICI", "XX1234", new BigDecimal("500"),
                                SmsTransactionType.DEBIT, TODAY, LocalTime.of(10, 0), "Store", "R1", null))))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        long smsId = objectMapper.readTree(imported).get("transactions").get(0).get("id").asLong();
        mockMvc.perform(authed(put("/api/sms-transactions/" + smsId + "/category"),
                        new SmsCategoryRequest(categoryId)))
                .andExpect(status().isOk());
        mockMvc.perform(authed(post("/api/sms-transactions/" + smsId + "/add-to-expense")))
                .andExpect(status().isOk());

        // From the Money Tracker: a 100 expense and a 200 salary addition.
        long pay = idOf(mockMvc.perform(authed(post("/api/money-tracker"),
                        new MoneyTrackerRequest("Laundry", null, new BigDecimal("100"),
                                MoneyTrackerType.PAY, TODAY, null, null)))
                .andExpect(status().isCreated()));
        mockMvc.perform(authed(post("/api/money-tracker/" + pay + "/deduct"))).andExpect(status().isOk());
        long receive = idOf(mockMvc.perform(authed(post("/api/money-tracker"),
                        new MoneyTrackerRequest("Parking", null, new BigDecimal("200"),
                                MoneyTrackerType.RECEIVE, TODAY, null, null)))
                .andExpect(status().isCreated()));
        mockMvc.perform(authed(post("/api/money-tracker/" + receive + "/add-on"))).andExpect(status().isOk());

        // EMI: 15,000.
        long loan = idOf(mockMvc.perform(authed(post("/api/loans"), new LoanRequest(
                        "Bike Loan", new BigDecimal("60000"), new BigDecimal("15000"),
                        new BigDecimal("9.50"), TODAY.minusMonths(2), TODAY.plusMonths(2))))
                .andExpect(status().isCreated()));
        mockMvc.perform(authed(post("/api/loans/" + loan + "/payments"),
                        new EmiPaymentRequest(new BigDecimal("15000"), TODAY, "EMI")))
                .andExpect(status().isCreated());
    }

    @Test
    @DisplayName("with nothing hidden, every section counts")
    void everythingCountsByDefault() throws Exception {
        JsonNode dashboard = json(get("/api/dashboard"), null);
        assertMoney(dashboard.at("/expenses/totalSpent"), "1600.00");
        assertMoney(dashboard.at("/salary/totalDeductions"), "16600.00");
        assertMoney(dashboard.at("/salary/totalAdditions"), "200.00");
        assertMoney(dashboard.at("/salary/remainingAmount"), "33600.00");
        assertThat(json(get("/api/expenses"), null).get("totalElements").asInt()).isEqualTo(3);
    }

    @Test
    @DisplayName("hiding EMI takes instalments out of the deductions and analytics")
    void hidingEmi() throws Exception {
        JsonNode dashboard = json(get("/api/dashboard"), "emi");
        assertMoney(dashboard.at("/salary/totalDeductions"), "1600.00");
        assertMoney(dashboard.at("/salary/remainingAmount"), "48600.00");

        JsonNode analytics = json(get("/api/analytics").param("period", "this_month"), "emi");
        assertMoney(analytics.get("totalEmiPaid"), "0.00");
        assertMoney(analytics.get("totalDeductions"), "1600.00");

        assertMoney(json(get("/api/salary"), "emi").get("totalDeductions"), "1600.00");
    }

    @Test
    @DisplayName("hiding SMS drops the expenses that came from SMS, everywhere")
    void hidingSms() throws Exception {
        JsonNode dashboard = json(get("/api/dashboard"), "SMS");
        assertMoney(dashboard.at("/expenses/totalSpent"), "1100.00");
        assertThat(dashboard.at("/expenses/transactionCount").asInt()).isEqualTo(2);

        JsonNode expenses = json(get("/api/expenses"), "sms");
        assertThat(expenses.get("totalElements").asInt()).isEqualTo(2);
        expenses.get("content").forEach(row -> assertThat(row.get("source").asText()).isNotEqualTo("SMS"));

        JsonNode category = json(get("/api/categories/" + categoryId), "sms");
        assertMoney(category.get("spentAmount"), "1000.00");
    }

    @Test
    @DisplayName("hiding the Money Tracker drops its expenses and its salary additions")
    void hidingMoneyTracker() throws Exception {
        JsonNode dashboard = json(get("/api/dashboard"), "money-tracker");
        assertMoney(dashboard.at("/expenses/totalSpent"), "1500.00");
        assertMoney(dashboard.at("/salary/totalAdditions"), "0.00");
        assertMoney(dashboard.at("/salary/remainingAmount"), "33500.00");
    }

    @Test
    @DisplayName("hiding expenses leaves only what is not an expense")
    void hidingExpenses() throws Exception {
        JsonNode dashboard = json(get("/api/dashboard"), "expenses");
        assertMoney(dashboard.at("/expenses/totalSpent"), "0.00");
        assertMoney(dashboard.at("/salary/totalDeductions"), "15000.00");
        assertThat(dashboard.get("recentExpenses").size()).isZero();
        assertThat(dashboard.get("categoryBreakdown").size()).isZero();
        assertThat(json(get("/api/expenses"), "expenses").get("totalElements").asInt()).isZero();
    }

    @Test
    @DisplayName("several hidden at once, and sections that only hide a tab are ignored")
    void combinationsAndUnknownTokens() throws Exception {
        JsonNode dashboard = json(get("/api/dashboard"), "analytics, emi ,sms,savings,nonsense");
        assertMoney(dashboard.at("/expenses/totalSpent"), "1100.00");
        assertMoney(dashboard.at("/salary/totalDeductions"), "1100.00");
        assertMoney(dashboard.at("/salary/totalAdditions"), "200.00");
    }

    private JsonNode json(MockHttpServletRequestBuilder request, String hidden) throws Exception {
        MockHttpServletRequestBuilder builder = authed(request);
        if (hidden != null) {
            builder.header(FeatureVisibility.HEADER, hidden);
        }
        String body = mockMvc.perform(builder)
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(body);
    }

    private long idOf(org.springframework.test.web.servlet.ResultActions result) throws Exception {
        return objectMapper.readTree(result.andReturn().getResponse().getContentAsString())
                .get("id").asLong();
    }

    private static void assertMoney(JsonNode node, String expected) {
        assertThat(node.decimalValue()).isEqualByComparingTo(expected);
    }
}
