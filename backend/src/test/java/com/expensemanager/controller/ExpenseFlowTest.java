package com.expensemanager.controller;

import com.expensemanager.dto.category.CategoryRequest;
import com.expensemanager.dto.expense.ExpenseRequest;
import com.expensemanager.dto.salary.SalaryRequest;
import com.expensemanager.support.ApiTestBase;
import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.YearMonth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Walks the salary to category to expense chain described in the product brief. */
class ExpenseFlowTest extends ApiTestBase {

    private static final LocalDate TODAY = LocalDate.now();

    private long createCategory(String name, String budget) throws Exception {
        String body = mockMvc.perform(authed(post("/api/categories"),
                        new CategoryRequest(name, new BigDecimal(budget), "#4F8DFD", "wallet-outline")))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(body).get("id").asLong();
    }

    private void setSalary(String amount, String target) throws Exception {
        YearMonth now = YearMonth.from(TODAY);
        mockMvc.perform(authed(post("/api/salary"), new SalaryRequest(
                        new BigDecimal(amount),
                        target == null ? null : new BigDecimal(target),
                        null, now.getYear(), now.getMonthValue())))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("a new account is seeded with starter categories")
    void seededCategories() throws Exception {
        mockMvc.perform(authed(get("/api/categories")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(6));
    }

    @Test
    @DisplayName("an expense reduces both the salary balance and its category balance")
    void expenseAffectsSalaryAndCategory() throws Exception {
        setSalary("45000", "100000");
        long petrol = createCategory("Bike Fuel", "3500");

        mockMvc.perform(authed(post("/api/expenses"), new ExpenseRequest(
                        new BigDecimal("500"), petrol, null, "Fuel top up", TODAY, LocalTime.of(16, 30))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.displayName").value("Bike Fuel"));

        mockMvc.perform(authed(get("/api/salary")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalDeductions").value(500.00))
                .andExpect(jsonPath("$.remainingAmount").value(44500.00))
                .andExpect(jsonPath("$.difference").value(55000.00))
                .andExpect(jsonPath("$.progressPercentage").value(45.00));

        mockMvc.perform(authed(get("/api/categories/" + petrol)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.spentAmount").value(500.00))
                .andExpect(jsonPath("$.remainingAmount").value(3000.00))
                .andExpect(jsonPath("$.overspent").value(false));
    }

    @Test
    @DisplayName("an Other expense needs a name and is grouped under that name")
    void otherExpenseRequiresName() throws Exception {
        mockMvc.perform(authed(post("/api/expenses"), new ExpenseRequest(
                        new BigDecimal("1500"), null, null, null, TODAY, null)))
                .andExpect(status().isBadRequest());

        mockMvc.perform(authed(post("/api/expenses"), new ExpenseRequest(
                        new BigDecimal("1500"), null, "Shopping", null, TODAY, LocalTime.of(16, 30))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.categoryId").doesNotExist())
                .andExpect(jsonPath("$.displayName").value("Shopping"));
    }

    @Test
    @DisplayName("editing and deleting an expense corrects the running totals")
    void editAndDeleteAdjustTotals() throws Exception {
        setSalary("45000", null);
        long food = createCategory("Food dining", "5000");

        String created = mockMvc.perform(authed(post("/api/expenses"), new ExpenseRequest(
                        new BigDecimal("1000"), food, null, null, TODAY, null)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        long expenseId = objectMapper.readTree(created).get("id").asLong();

        mockMvc.perform(authed(put("/api/expenses/" + expenseId), new ExpenseRequest(
                        new BigDecimal("250.50"), food, null, "Corrected", TODAY, null)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.amount").value(250.50));

        mockMvc.perform(authed(get("/api/salary")))
                .andExpect(jsonPath("$.remainingAmount").value(44749.50));

        mockMvc.perform(authed(delete("/api/expenses/" + expenseId)))
                .andExpect(status().isNoContent());

        mockMvc.perform(authed(get("/api/salary")))
                .andExpect(jsonPath("$.totalDeductions").value(0.00))
                .andExpect(jsonPath("$.remainingAmount").value(45000.00));
    }

    @Test
    @DisplayName("history filters by search text and category, and pages")
    void historyFilters() throws Exception {
        long food = createCategory("Food dining", "5000");
        long commute = createCategory("Daily commute", "2000");

        mockMvc.perform(authed(post("/api/expenses"), new ExpenseRequest(
                new BigDecimal("120"), food, null, "Team lunch", TODAY, null)));
        mockMvc.perform(authed(post("/api/expenses"), new ExpenseRequest(
                new BigDecimal("60"), commute, null, "Metro card", TODAY.minusDays(3), null)));
        mockMvc.perform(authed(post("/api/expenses"), new ExpenseRequest(
                new BigDecimal("900"), null, "Shopping", null, TODAY, null)));

        mockMvc.perform(authed(get("/api/expenses")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(3));

        mockMvc.perform(authed(get("/api/expenses?categoryId=" + food)))
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].displayName").value("Food dining"));

        mockMvc.perform(authed(get("/api/expenses?categoryId=0")))
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].displayName").value("Shopping"));

        mockMvc.perform(authed(get("/api/expenses?search=metro")))
                .andExpect(jsonPath("$.totalElements").value(1));

        mockMvc.perform(authed(get("/api/expenses?from=" + TODAY + "&to=" + TODAY)))
                .andExpect(jsonPath("$.totalElements").value(2));

        mockMvc.perform(authed(get("/api/expenses?size=2&page=0")))
                .andExpect(jsonPath("$.content.length()").value(2))
                .andExpect(jsonPath("$.totalPages").value(2))
                .andExpect(jsonPath("$.last").value(false));
    }

    @Test
    @DisplayName("deleting a category keeps its expenses, moving them to Other")
    void deletingCategoryKeepsExpenses() throws Exception {
        long petrol = createCategory("Bike Fuel", "3500");
        mockMvc.perform(authed(post("/api/expenses"), new ExpenseRequest(
                new BigDecimal("500"), petrol, null, null, TODAY, null)));

        mockMvc.perform(authed(delete("/api/categories/" + petrol)))
                .andExpect(status().isNoContent());

        String body = mockMvc.perform(authed(get("/api/expenses")))
                .andExpect(jsonPath("$.totalElements").value(1))
                .andReturn().getResponse().getContentAsString();

        JsonNode expense = objectMapper.readTree(body).get("content").get(0);
        assertThat(expense.get("displayName").asText()).isEqualTo("Bike Fuel");
        assertThat(expense.get("categoryId").isNull()).isTrue();
    }

    @Test
    @DisplayName("a category name cannot be duplicated or called Other")
    void categoryNameRules() throws Exception {
        createCategory("Bike Fuel", "3500");

        mockMvc.perform(authed(post("/api/categories"),
                        new CategoryRequest("bike fuel", new BigDecimal("100"), null, null)))
                .andExpect(status().isConflict());

        mockMvc.perform(authed(post("/api/categories"),
                        new CategoryRequest("Other", new BigDecimal("100"), null, null)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("one user cannot read another user's data")
    void dataIsScopedPerUser() throws Exception {
        long food = createCategory("Food dining", "5000");
        mockMvc.perform(authed(post("/api/expenses"), new ExpenseRequest(
                new BigDecimal("120"), food, null, null, TODAY, null)));

        // Signing a second user in swaps the session that authed() uses.
        signUpFreshUser();

        mockMvc.perform(authed(get("/api/expenses")))
                .andExpect(jsonPath("$.totalElements").value(0));
        mockMvc.perform(authed(get("/api/categories/" + food)))
                .andExpect(status().isNotFound());
    }
}
