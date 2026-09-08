package com.expensemanager.controller;

import com.expensemanager.dto.moneytracker.MoneyTrackerRequest;
import com.expensemanager.dto.salary.SalaryRequest;
import com.expensemanager.entity.MoneyTrackerType;
import com.expensemanager.support.ApiTestBase;
import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The whole point of this module is that it stays out of the salary figures until asked,
 * so most of these assert what did *not* change as much as what did.
 */
class MoneyTrackerFlowTest extends ApiTestBase {

    private static final LocalDate TODAY = LocalDate.now();

    private long createTransaction(String title, String amount, MoneyTrackerType type) throws Exception {
        String body = mockMvc.perform(authed(post("/api/money-tracker"),
                        new MoneyTrackerRequest(title, "note", new BigDecimal(amount), type,
                                TODAY, null, null)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(body).get("id").asLong();
    }

    private void setSalary(String amount) throws Exception {
        mockMvc.perform(authed(post("/api/salary"),
                        new SalaryRequest(new BigDecimal(amount), null, null,
                                TODAY.getYear(), TODAY.getMonthValue())))
                .andExpect(status().isOk());
    }

    private JsonNode salary() throws Exception {
        String body = mockMvc.perform(authed(get("/api/salary")))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(body);
    }

    @Test
    @DisplayName("a new transaction leaves the salary untouched")
    void doesNotAffectSalaryUntilLinked() throws Exception {
        setSalary("45000");
        createTransaction("Laundry", "100", MoneyTrackerType.PAY);
        createTransaction("Parking", "100", MoneyTrackerType.RECEIVE);

        JsonNode salary = salary();
        assertThat(salary.get("remainingAmount").decimalValue()).isEqualByComparingTo("45000.00");
        assertThat(salary.get("totalDeductions").decimalValue()).isEqualByComparingTo("0.00");
        assertThat(salary.get("totalAdditions").decimalValue()).isEqualByComparingTo("0.00");

        // And nothing leaked into the expense list either.
        mockMvc.perform(authed(get("/api/expenses")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(0));
    }

    @Test
    @DisplayName("marking complete records the time but still does not touch the salary")
    void completeIsIndependentOfSalary() throws Exception {
        setSalary("45000");
        long id = createTransaction("Laundry", "100", MoneyTrackerType.PAY);

        mockMvc.perform(authed(post("/api/money-tracker/" + id + "/complete")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("COMPLETED"))
                .andExpect(jsonPath("$.completedAt").isNotEmpty())
                .andExpect(jsonPath("$.action").value("NONE"));

        assertThat(salary().get("remainingAmount").decimalValue()).isEqualByComparingTo("45000.00");
    }

    @Test
    @DisplayName("deducting a payable creates a labelled expense and reduces the salary")
    void deductCreatesExpense() throws Exception {
        setSalary("45000");
        long id = createTransaction("Laundry", "100", MoneyTrackerType.PAY);

        mockMvc.perform(authed(post("/api/money-tracker/" + id + "/deduct")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.action").value("DEDUCTED"))
                .andExpect(jsonPath("$.status").value("ARCHIVED"))
                .andExpect(jsonPath("$.linkedExpenseId").isNotEmpty())
                .andExpect(jsonPath("$.undoable").value(true));

        assertThat(salary().get("remainingAmount").decimalValue()).isEqualByComparingTo("44900.00");

        mockMvc.perform(authed(get("/api/expenses")))
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].source").value("MONEY_TRACKER"))
                .andExpect(jsonPath("$.content[0].amount").value(100.00));
    }

    @Test
    @DisplayName("adding a receivable credits the month without changing the stated salary")
    void addOnCreditsSalary() throws Exception {
        setSalary("45000");
        long id = createTransaction("Parking", "100", MoneyTrackerType.RECEIVE);

        mockMvc.perform(authed(post("/api/money-tracker/" + id + "/add-on")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.action").value("ADD_ON"))
                .andExpect(jsonPath("$.linkedAdjustmentId").isNotEmpty());

        JsonNode salary = salary();
        // The salary itself is untouched - only the available balance moved.
        assertThat(salary.get("amount").decimalValue()).isEqualByComparingTo("45000.00");
        assertThat(salary.get("totalAdditions").decimalValue()).isEqualByComparingTo("100.00");
        assertThat(salary.get("remainingAmount").decimalValue()).isEqualByComparingTo("45100.00");
    }

    @Test
    @DisplayName("undo removes the generated expense and restores the transaction")
    void undoReversesDeduction() throws Exception {
        setSalary("45000");
        long id = createTransaction("Laundry", "100", MoneyTrackerType.PAY);
        mockMvc.perform(authed(post("/api/money-tracker/" + id + "/deduct")))
                .andExpect(status().isOk());

        mockMvc.perform(authed(post("/api/money-tracker/" + id + "/undo")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.action").value("NONE"))
                .andExpect(jsonPath("$.linkedExpenseId").doesNotExist())
                .andExpect(jsonPath("$.undoable").value(false));

        assertThat(salary().get("remainingAmount").decimalValue()).isEqualByComparingTo("45000.00");
        mockMvc.perform(authed(get("/api/expenses")))
                .andExpect(jsonPath("$.totalElements").value(0));
    }

    @Test
    @DisplayName("undo reverses an add-on and the credit disappears")
    void undoReversesAddOn() throws Exception {
        setSalary("45000");
        long id = createTransaction("Parking", "100", MoneyTrackerType.RECEIVE);
        mockMvc.perform(authed(post("/api/money-tracker/" + id + "/add-on")))
                .andExpect(status().isOk());

        mockMvc.perform(authed(post("/api/money-tracker/" + id + "/undo")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.action").value("NONE"));

        assertThat(salary().get("remainingAmount").decimalValue()).isEqualByComparingTo("45000.00");
    }

    @Test
    @DisplayName("undoing twice is refused, so a reversal cannot be applied repeatedly")
    void undoIsIdempotent() throws Exception {
        setSalary("45000");
        long id = createTransaction("Laundry", "100", MoneyTrackerType.PAY);
        mockMvc.perform(authed(post("/api/money-tracker/" + id + "/deduct")))
                .andExpect(status().isOk());
        mockMvc.perform(authed(post("/api/money-tracker/" + id + "/undo")))
                .andExpect(status().isOk());

        mockMvc.perform(authed(post("/api/money-tracker/" + id + "/undo")))
                .andExpect(status().isBadRequest());

        // The salary is where it started, not credited twice by the second attempt.
        assertThat(salary().get("remainingAmount").decimalValue()).isEqualByComparingTo("45000.00");
    }

    @Test
    @DisplayName("the same transaction cannot be deducted twice")
    void cannotDeductTwice() throws Exception {
        setSalary("45000");
        long id = createTransaction("Laundry", "100", MoneyTrackerType.PAY);
        mockMvc.perform(authed(post("/api/money-tracker/" + id + "/deduct")))
                .andExpect(status().isOk());

        mockMvc.perform(authed(post("/api/money-tracker/" + id + "/deduct")))
                .andExpect(status().isBadRequest());

        assertThat(salary().get("remainingAmount").decimalValue()).isEqualByComparingTo("44900.00");
    }

    @Test
    @DisplayName("a receivable cannot be deducted, nor a payable added on")
    void directionIsEnforced() throws Exception {
        long receive = createTransaction("Parking", "100", MoneyTrackerType.RECEIVE);
        long pay = createTransaction("Laundry", "100", MoneyTrackerType.PAY);

        mockMvc.perform(authed(post("/api/money-tracker/" + receive + "/deduct")))
                .andExpect(status().isBadRequest());
        mockMvc.perform(authed(post("/api/money-tracker/" + pay + "/add-on")))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("summary counts only what is still pending")
    void summaryCountsPendingOnly() throws Exception {
        createTransaction("Laundry", "100", MoneyTrackerType.PAY);
        createTransaction("Rent", "2350", MoneyTrackerType.PAY);
        createTransaction("Parking", "3200", MoneyTrackerType.RECEIVE);

        mockMvc.perform(authed(get("/api/money-tracker/summary")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.toPay").value(2450.00))
                .andExpect(jsonPath("$.toReceive").value(3200.00))
                .andExpect(jsonPath("$.pendingCount").value(3));
    }

    @Test
    @DisplayName("one user cannot reach another user's transactions")
    void transactionsAreScopedToTheOwner() throws Exception {
        long id = createTransaction("Laundry", "100", MoneyTrackerType.PAY);

        // A second signup replaces the session with a different user.
        signUpFreshUser();

        mockMvc.perform(authed(get("/api/money-tracker/" + id)))
                .andExpect(status().isNotFound());
        mockMvc.perform(authed(post("/api/money-tracker/" + id + "/deduct")))
                .andExpect(status().isNotFound());
    }
}
