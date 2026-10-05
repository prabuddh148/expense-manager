package com.expensemanager.controller;

import com.expensemanager.dto.category.CategoryRequest;
import com.expensemanager.dto.category.CategoryTopUpRequest;
import com.expensemanager.dto.cycle.CycleResetRequest;
import com.expensemanager.dto.cycle.CycleTargetRequest;
import com.expensemanager.dto.expense.ExpenseRequest;
import com.expensemanager.support.ApiTestBase;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The target is fixed for the cycle and follows the category budgets; what is left follows
 * the spending. Reset opens a new cycle on salary day with fresh budgets.
 */
class CycleFlowTest extends ApiTestBase {

    private static final LocalDate TODAY = LocalDate.now();

    private long createCategory(String name, String budget) throws Exception {
        String body = mockMvc.perform(authed(post("/api/categories"),
                        new CategoryRequest(name, new BigDecimal(budget), "#4F8DFD", "wallet-outline")))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(body).get("id").asLong();
    }

    private void spend(long categoryId, String amount, LocalDate date) throws Exception {
        mockMvc.perform(authed(post("/api/expenses"), new ExpenseRequest(
                        new BigDecimal(amount), categoryId, null, "spend", date, LocalTime.NOON)))
                .andExpect(status().isCreated());
    }

    private void reset(LocalDate start, List<CycleResetRequest.Budget> budgets, int expectedStatus)
            throws Exception {
        mockMvc.perform(authed(post("/api/cycle/reset"), new CycleResetRequest(start, budgets)))
                .andExpect(status().is(expectedStatus));
    }

    private static CycleResetRequest.Budget budget(long categoryId, String amount) {
        return new CycleResetRequest.Budget(categoryId, new BigDecimal(amount));
    }

    @Test
    @DisplayName("the target follows the category budgets and spending only moves what is left")
    void targetFollowsCategories() throws Exception {
        long food = createCategory("Groceries", "5000");
        long travel = createCategory("Travel", "3000");

        mockMvc.perform(authed(get("/api/cycle")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.targetAmount").value(8000.00))
                .andExpect(jsonPath("$.remainingAmount").value(8000.00));

        spend(food, "1200", TODAY);

        mockMvc.perform(authed(get("/api/cycle")))
                .andExpect(jsonPath("$.targetAmount").value(8000.00))
                .andExpect(jsonPath("$.totalDeductions").value(1200.00))
                .andExpect(jsonPath("$.remainingAmount").value(6800.00));

        // Adding money to a category raises the target by the same amount.
        mockMvc.perform(authed(post("/api/categories/" + travel + "/add-funds"),
                        new CategoryTopUpRequest(new BigDecimal("500"))))
                .andExpect(status().isOk());

        mockMvc.perform(authed(get("/api/cycle")))
                .andExpect(jsonPath("$.targetAmount").value(8500.00))
                .andExpect(jsonPath("$.remainingAmount").value(7300.00));
    }

    @Test
    @DisplayName("a target typed by hand holds until a category budget changes")
    void manualTarget() throws Exception {
        long food = createCategory("Groceries", "5000");

        mockMvc.perform(authed(put("/api/cycle/target"), new CycleTargetRequest(new BigDecimal("40000"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.targetAmount").value(40000.00))
                // What is left still comes from the categories.
                .andExpect(jsonPath("$.remainingAmount").value(5000.00));

        mockMvc.perform(authed(put("/api/categories/" + food),
                        new CategoryRequest("Groceries", new BigDecimal("6000"), "#4F8DFD", "wallet-outline")))
                .andExpect(status().isOk());

        mockMvc.perform(authed(get("/api/cycle")))
                .andExpect(jsonPath("$.targetAmount").value(6000.00));
    }

    @Test
    @DisplayName("reset starts on salary day with fresh budgets and ignores earlier spending")
    void resetStartsFresh() throws Exception {
        long food = createCategory("Groceries", "5000");
        long travel = createCategory("Travel", "3000");
        spend(food, "900", TODAY.minusDays(1));

        reset(TODAY, List.of(budget(food, "7000")), 200);

        mockMvc.perform(authed(get("/api/cycle")))
                .andExpect(jsonPath("$.startDate").value(TODAY.toString()))
                .andExpect(jsonPath("$.targetAmount").value(7000.00))
                .andExpect(jsonPath("$.totalDeductions").value(0.00))
                .andExpect(jsonPath("$.remainingAmount").value(7000.00));

        // A category left out of the reset starts at zero.
        mockMvc.perform(authed(get("/api/categories/" + travel)))
                .andExpect(jsonPath("$.allocatedAmount").value(0.00));
        mockMvc.perform(authed(get("/api/categories/" + food)))
                .andExpect(jsonPath("$.allocatedAmount").value(7000.00))
                .andExpect(jsonPath("$.spentAmount").value(0.00));

        spend(food, "400", TODAY);

        mockMvc.perform(authed(get("/api/dashboard")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.salary.amount").value(7000.00))
                .andExpect(jsonPath("$.salary.remainingAmount").value(6600.00))
                .andExpect(jsonPath("$.salary.periodStart").value(TODAY.toString()));
    }

    @Test
    @DisplayName("reset clears what was already spent in the cycle, even earlier the same day")
    void resetClearsSpentSoFar() throws Exception {
        long food = createCategory("Groceries", "5000");
        spend(food, "900", TODAY);

        reset(TODAY, List.of(budget(food, "7000")), 200);

        mockMvc.perform(authed(get("/api/cycle")))
                .andExpect(jsonPath("$.totalDeductions").value(0.00))
                .andExpect(jsonPath("$.remainingAmount").value(7000.00));
        mockMvc.perform(authed(get("/api/categories/" + food)))
                .andExpect(jsonPath("$.spentAmount").value(0.00));

        spend(food, "400", TODAY);

        mockMvc.perform(authed(get("/api/cycle")))
                .andExpect(jsonPath("$.totalDeductions").value(400.00))
                .andExpect(jsonPath("$.remainingAmount").value(6600.00));

        // Resetting again the same day clears it once more.
        reset(TODAY, List.of(budget(food, "7000")), 200);
        mockMvc.perform(authed(get("/api/cycle")))
                .andExpect(jsonPath("$.totalDeductions").value(0.00));
    }

    @Test
    @DisplayName("reset can create new categories, e.g. imported from a plan")
    void resetCreatesCategories() throws Exception {
        long food = createCategory("Groceries", "5000");

        mockMvc.perform(authed(post("/api/cycle/reset"), new CycleResetRequest(TODAY,
                        List.of(budget(food, "6000")),
                        List.of(new CycleResetRequest.NewCategory("Rent", new BigDecimal("15000"), "#22AA66")))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.targetAmount").value(21000.00));

        mockMvc.perform(authed(get("/api/categories")))
                .andExpect(jsonPath("$[?(@.name == 'Rent')].allocatedAmount").value(15000.00));

        // A name that already exists is refused, so nothing is duplicated.
        mockMvc.perform(authed(post("/api/cycle/reset"), new CycleResetRequest(TODAY,
                        List.of(),
                        List.of(new CycleResetRequest.NewCategory("groceries", BigDecimal.TEN, null)))))
                .andExpect(status().isConflict());
    }

    @Test
    @DisplayName("reset refuses a future date or one before the running cycle")
    void resetDateRules() throws Exception {
        long food = createCategory("Groceries", "5000");

        reset(TODAY.plusDays(1), List.of(budget(food, "100")), 400);

        reset(TODAY, List.of(budget(food, "100")), 200);
        reset(TODAY.minusDays(1), List.of(budget(food, "100")), 400);

        // Same day again just redoes the budgets.
        reset(TODAY, List.of(budget(food, "250")), 200);
        mockMvc.perform(authed(get("/api/cycle")))
                .andExpect(jsonPath("$.targetAmount").value(250.00));
    }

    @Test
    @DisplayName("reset cannot touch another user's category")
    void resetIsScoped() throws Exception {
        long food = createCategory("Groceries", "5000");
        signUpFreshUser();

        reset(TODAY, List.of(budget(food, "100")), 404);
    }
}
