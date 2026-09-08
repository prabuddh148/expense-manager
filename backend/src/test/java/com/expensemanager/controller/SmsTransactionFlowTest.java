package com.expensemanager.controller;

import com.expensemanager.dto.category.CategoryRequest;
import com.expensemanager.dto.sms.SmsCategoryRequest;
import com.expensemanager.dto.sms.SmsTransactionRequest;
import com.expensemanager.entity.SmsTransactionType;
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
 * The device does the parsing, so these start from already-structured transactions and
 * concentrate on what the server owes: never duplicating a message, never categorising
 * one by itself, and never letting a transaction become an expense by accident.
 */
class SmsTransactionFlowTest extends ApiTestBase {

    private static final LocalDate DATE = LocalDate.of(2026, 9, 8);

    private SmsTransactionRequest icici(String amount, String reference) {
        return new SmsTransactionRequest("ICICI", "XX1234", new BigDecimal(amount),
                SmsTransactionType.DEBIT, DATE, LocalTime.of(21, 30), "XYZ Store", reference, null);
    }

    private long importOne(SmsTransactionRequest request) throws Exception {
        String body = mockMvc.perform(authed(post("/api/sms-transactions/import"), List.of(request)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(body).get("transactions").get(0).get("id").asLong();
    }

    /** Signup seeds a default set, so tests use a name that is not among them. */
    private long createCategory(String name) throws Exception {
        String body = mockMvc.perform(authed(post("/api/categories"),
                        new CategoryRequest(name, new BigDecimal("5000"), "#F2704A", "fast-food-outline")))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(body).get("id").asLong();
    }

    @Test
    @DisplayName("a detected transaction lands uncategorised and out of the expenses")
    void arrivesUncategorised() throws Exception {
        mockMvc.perform(authed(post("/api/sms-transactions/import"), List.of(icici("500", "REF1"))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.imported").value(1))
                .andExpect(jsonPath("$.skipped").value(0))
                .andExpect(jsonPath("$.transactions[0].status").value("UNCATEGORIZED"))
                .andExpect(jsonPath("$.transactions[0].categoryId").doesNotExist())
                .andExpect(jsonPath("$.transactions[0].readyForExpense").value(false));

        // Nothing reached the expense list on its own.
        mockMvc.perform(authed(get("/api/expenses")))
                .andExpect(jsonPath("$.totalElements").value(0));
    }

    @Test
    @DisplayName("importing the same message twice creates one transaction")
    void deduplicatesIdenticalMessages() throws Exception {
        mockMvc.perform(authed(post("/api/sms-transactions/import"), List.of(icici("500", "REF1"))))
                .andExpect(jsonPath("$.imported").value(1));

        mockMvc.perform(authed(post("/api/sms-transactions/import"), List.of(icici("500", "REF1"))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.imported").value(0))
                .andExpect(jsonPath("$.skipped").value(1));

        mockMvc.perform(authed(get("/api/sms-transactions")))
                .andExpect(jsonPath("$.length()").value(1));
    }

    @Test
    @DisplayName("a duplicate inside one batch does not stop the new messages landing")
    void duplicateWithinBatchDoesNotPoisonTheRest() throws Exception {
        mockMvc.perform(authed(post("/api/sms-transactions/import"),
                        List.of(icici("500", "REF1"), icici("500", "REF1"), icici("700", "REF2"))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.imported").value(2))
                .andExpect(jsonPath("$.skipped").value(1));

        mockMvc.perform(authed(get("/api/sms-transactions")))
                .andExpect(jsonPath("$.length()").value(2));
    }

    @Test
    @DisplayName("same amount and day on different accounts are two transactions")
    void differentAccountsAreDistinct() throws Exception {
        SmsTransactionRequest card = new SmsTransactionRequest("ICICI", "XX9999",
                new BigDecimal("500"), SmsTransactionType.DEBIT, DATE, LocalTime.of(21, 30),
                "XYZ Store", null, null);

        mockMvc.perform(authed(post("/api/sms-transactions/import"),
                        List.of(icici("500", null), card)))
                .andExpect(jsonPath("$.imported").value(2));
    }

    @Test
    @DisplayName("adding to expenses is refused until the user picks a category")
    void refusesUntilCategorised() throws Exception {
        long id = importOne(icici("500", "REF1"));

        mockMvc.perform(authed(post("/api/sms-transactions/" + id + "/add-to-expense")))
                .andExpect(status().isBadRequest());

        mockMvc.perform(authed(get("/api/expenses")))
                .andExpect(jsonPath("$.totalElements").value(0));
    }

    @Test
    @DisplayName("categorise then add creates an expense labelled SMS")
    void addsToExpensesOnceCategorised() throws Exception {
        long id = importOne(icici("500", "REF1"));
        long categoryId = createCategory("Shopping");

        mockMvc.perform(authed(put("/api/sms-transactions/" + id + "/category"),
                        new SmsCategoryRequest(categoryId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CATEGORIZED"))
                .andExpect(jsonPath("$.readyForExpense").value(true));

        mockMvc.perform(authed(post("/api/sms-transactions/" + id + "/add-to-expense")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ADDED_TO_EXPENSE"))
                .andExpect(jsonPath("$.linkedExpenseId").isNotEmpty());

        mockMvc.perform(authed(get("/api/expenses")))
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].source").value("SMS"))
                .andExpect(jsonPath("$.content[0].sourceLabel").value("SMS"))
                .andExpect(jsonPath("$.content[0].categoryName").value("Shopping"))
                .andExpect(jsonPath("$.content[0].amount").value(500.00));
    }

    @Test
    @DisplayName("the same transaction cannot be added to expenses twice")
    void cannotAddTwice() throws Exception {
        long id = importOne(icici("500", "REF1"));
        long categoryId = createCategory("Shopping");
        mockMvc.perform(authed(put("/api/sms-transactions/" + id + "/category"),
                new SmsCategoryRequest(categoryId)));
        mockMvc.perform(authed(post("/api/sms-transactions/" + id + "/add-to-expense")))
                .andExpect(status().isOk());

        mockMvc.perform(authed(post("/api/sms-transactions/" + id + "/add-to-expense")))
                .andExpect(status().isBadRequest());

        mockMvc.perform(authed(get("/api/expenses")))
                .andExpect(jsonPath("$.totalElements").value(1));
    }

    @Test
    @DisplayName("a credit cannot be filed as an expense")
    void creditsCannotBecomeExpenses() throws Exception {
        SmsTransactionRequest credit = new SmsTransactionRequest("HDFC", "XX4321",
                new BigDecimal("2000"), SmsTransactionType.CREDIT, DATE, null, "Salary", null, null);
        long id = importOne(credit);
        long categoryId = createCategory("Shopping");

        mockMvc.perform(authed(put("/api/sms-transactions/" + id + "/category"),
                        new SmsCategoryRequest(categoryId)))
                .andExpect(jsonPath("$.readyForExpense").value(false));

        mockMvc.perform(authed(post("/api/sms-transactions/" + id + "/add-to-expense")))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("the bank list is built from what was detected, not a fixed list")
    void bankListIsDynamic() throws Exception {
        SmsTransactionRequest central = new SmsTransactionRequest("Central Bank", "XX7777",
                new BigDecimal("250"), SmsTransactionType.DEBIT, DATE, null, "Shop", "C1", null);

        mockMvc.perform(authed(post("/api/sms-transactions/import"),
                List.of(icici("500", "REF1"), central)));

        mockMvc.perform(authed(get("/api/sms-transactions/banks")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].bank").value("Central Bank"))
                .andExpect(jsonPath("$[0].uncategorized").value(1))
                .andExpect(jsonPath("$[1].bank").value("ICICI"));
    }

    @Test
    @DisplayName("filtering by bank and status narrows the list")
    void filtersApply() throws Exception {
        SmsTransactionRequest hdfc = new SmsTransactionRequest("HDFC", "XX4321",
                new BigDecimal("250"), SmsTransactionType.DEBIT, DATE, null, "Shop", "H1", null);
        mockMvc.perform(authed(post("/api/sms-transactions/import"),
                List.of(icici("500", "REF1"), hdfc)));

        mockMvc.perform(authed(get("/api/sms-transactions?bank=HDFC")))
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].bankName").value("HDFC"));

        mockMvc.perform(authed(get("/api/sms-transactions?status=UNCATEGORIZED")))
                .andExpect(jsonPath("$.length()").value(2));
    }

    @Test
    @DisplayName("pending count drives the reminder and only counts uncategorised")
    void pendingCountTracksUncategorised() throws Exception {
        long id = importOne(icici("500", "REF1"));
        long categoryId = createCategory("Shopping");

        mockMvc.perform(authed(get("/api/sms-transactions/pending-count")))
                .andExpect(jsonPath("$.pending").value(1));

        mockMvc.perform(authed(put("/api/sms-transactions/" + id + "/category"),
                new SmsCategoryRequest(categoryId)));

        mockMvc.perform(authed(get("/api/sms-transactions/pending-count")))
                .andExpect(jsonPath("$.pending").value(0));
    }

    @Test
    @DisplayName("one user cannot see or touch another user's detections")
    void scopedToOwner() throws Exception {
        long id = importOne(icici("500", "REF1"));

        signUpFreshUser();

        mockMvc.perform(authed(get("/api/sms-transactions")))
                .andExpect(jsonPath("$.length()").value(0));
        mockMvc.perform(authed(post("/api/sms-transactions/" + id + "/add-to-expense")))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("the same message for two different users is not a duplicate")
    void dedupIsPerUser() throws Exception {
        mockMvc.perform(authed(post("/api/sms-transactions/import"), List.of(icici("500", "REF1"))))
                .andExpect(jsonPath("$.imported").value(1));

        signUpFreshUser();

        mockMvc.perform(authed(post("/api/sms-transactions/import"), List.of(icici("500", "REF1"))))
                .andExpect(jsonPath("$.imported").value(1));
    }
}
