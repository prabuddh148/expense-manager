package com.expensemanager.controller;

import com.expensemanager.dto.loan.EmiPaymentRequest;
import com.expensemanager.dto.loan.LoanRequest;
import com.expensemanager.support.ApiTestBase;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** The bike-loan worked example from the brief: 60,000 borrowed, paid off in 15,000 instalments. */
class LoanFlowTest extends ApiTestBase {

    private static final LocalDate TODAY = LocalDate.now();

    private long createBikeLoan() throws Exception {
        String body = mockMvc.perform(authed(post("/api/loans"), new LoanRequest(
                        "Bike Loan",
                        new BigDecimal("60000"),
                        new BigDecimal("15000"),
                        new BigDecimal("9.50"),
                        TODAY.minusMonths(2),
                        TODAY.plusMonths(2))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.remainingAmount").value(60000.00))
                .andExpect(jsonPath("$.status").value("ACTIVE"))
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(body).get("id").asLong();
    }

    private void pay(long loanId, String amount, LocalDate date) throws Exception {
        mockMvc.perform(authed(post("/api/loans/" + loanId + "/payments"),
                        new EmiPaymentRequest(new BigDecimal(amount), date, "EMI")))
                .andExpect(status().isCreated());
    }

    @Test
    @DisplayName("each payment reduces the remaining balance and adds to the history")
    void paymentsReduceBalance() throws Exception {
        long loan = createBikeLoan();

        pay(loan, "15000", TODAY.minusMonths(2));
        mockMvc.perform(authed(get("/api/loans/" + loan)))
                .andExpect(jsonPath("$.remainingAmount").value(45000.00))
                .andExpect(jsonPath("$.paidAmount").value(15000.00))
                .andExpect(jsonPath("$.progressPercentage").value(25.00))
                .andExpect(jsonPath("$.estimatedInstalmentsLeft").value(3));

        pay(loan, "15000", TODAY.minusMonths(1));
        pay(loan, "15000", TODAY);

        mockMvc.perform(authed(get("/api/loans/" + loan)))
                .andExpect(jsonPath("$.remainingAmount").value(15000.00))
                .andExpect(jsonPath("$.paidAmount").value(45000.00))
                .andExpect(jsonPath("$.paymentCount").value(3))
                .andExpect(jsonPath("$.status").value("ACTIVE"));

        // Every instalment is kept as its own row, newest first.
        mockMvc.perform(authed(get("/api/loans/" + loan + "/payments")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(3))
                .andExpect(jsonPath("$[0].amount").value(15000.00));
    }

    @Test
    @DisplayName("the final payment closes the loan")
    void finalPaymentClosesLoan() throws Exception {
        long loan = createBikeLoan();
        pay(loan, "45000", TODAY.minusMonths(1));
        pay(loan, "15000", TODAY);

        mockMvc.perform(authed(get("/api/loans/" + loan)))
                .andExpect(jsonPath("$.remainingAmount").value(0.00))
                .andExpect(jsonPath("$.status").value("CLOSED"))
                .andExpect(jsonPath("$.progressPercentage").value(100.00))
                .andExpect(jsonPath("$.estimatedInstalmentsLeft").value(0));
    }

    @Test
    @DisplayName("a payment larger than the outstanding balance is rejected")
    void overpaymentRejected() throws Exception {
        long loan = createBikeLoan();
        pay(loan, "50000", TODAY);

        mockMvc.perform(authed(post("/api/loans/" + loan + "/payments"),
                        new EmiPaymentRequest(new BigDecimal("15000"), TODAY, null)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("editing one payment re-derives the balance without touching the others")
    void editingPaymentKeepsHistory() throws Exception {
        long loan = createBikeLoan();
        pay(loan, "15000", TODAY.minusMonths(2));

        String created = mockMvc.perform(authed(post("/api/loans/" + loan + "/payments"),
                        new EmiPaymentRequest(new BigDecimal("15000"), TODAY.minusMonths(1), null)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        long paymentId = objectMapper.readTree(created).get("id").asLong();

        mockMvc.perform(authed(put("/api/loans/" + loan + "/payments/" + paymentId),
                        new EmiPaymentRequest(new BigDecimal("5000"), TODAY.minusMonths(1), "Part payment")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.amount").value(5000.00));

        mockMvc.perform(authed(get("/api/loans/" + loan)))
                .andExpect(jsonPath("$.paidAmount").value(20000.00))
                .andExpect(jsonPath("$.remainingAmount").value(40000.00))
                .andExpect(jsonPath("$.paymentCount").value(2));
    }

    @Test
    @DisplayName("deleting a payment gives the balance back and reopens a closed loan")
    void deletingPaymentReopensLoan() throws Exception {
        long loan = createBikeLoan();
        String created = mockMvc.perform(authed(post("/api/loans/" + loan + "/payments"),
                        new EmiPaymentRequest(new BigDecimal("60000"), TODAY, null)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        long paymentId = objectMapper.readTree(created).get("id").asLong();

        mockMvc.perform(authed(get("/api/loans/" + loan)))
                .andExpect(jsonPath("$.status").value("CLOSED"));

        mockMvc.perform(authed(delete("/api/loans/" + loan + "/payments/" + paymentId)))
                .andExpect(status().isNoContent());

        mockMvc.perform(authed(get("/api/loans/" + loan)))
                .andExpect(jsonPath("$.remainingAmount").value(60000.00))
                .andExpect(jsonPath("$.status").value("ACTIVE"))
                .andExpect(jsonPath("$.paymentCount").value(0));
    }

    @Test
    @DisplayName("a loan cannot be reduced below what has already been paid")
    void cannotShrinkLoanBelowPaid() throws Exception {
        long loan = createBikeLoan();
        pay(loan, "30000", TODAY);

        mockMvc.perform(authed(put("/api/loans/" + loan), new LoanRequest(
                        "Bike Loan", new BigDecimal("20000"), new BigDecimal("15000"),
                        null, TODAY.minusMonths(2), null)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("EMI payments show on the dashboard as deductions from the salary month")
    void paymentsFeedTheDashboard() throws Exception {
        long loan = createBikeLoan();
        pay(loan, "15000", TODAY);

        mockMvc.perform(authed(get("/api/dashboard")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.loans.totalOutstanding").value(45000.00))
                .andExpect(jsonPath("$.loans.totalPaid").value(15000.00))
                .andExpect(jsonPath("$.loans.monthlyEmi").value(15000.00))
                .andExpect(jsonPath("$.loans.activeLoans").value(1))
                .andExpect(jsonPath("$.loans.paidThisMonth").value(15000.00))
                .andExpect(jsonPath("$.salary.totalDeductions").value(15000.00));
    }

    @Test
    @DisplayName("another user cannot see or pay this loan")
    void loansAreScopedPerUser() throws Exception {
        long loan = createBikeLoan();
        signUpFreshUser();

        mockMvc.perform(authed(get("/api/loans/" + loan)))
                .andExpect(status().isNotFound());
        mockMvc.perform(authed(post("/api/loans/" + loan + "/payments"),
                        new EmiPaymentRequest(new BigDecimal("100"), TODAY, null)))
                .andExpect(status().isNotFound());
    }
}
