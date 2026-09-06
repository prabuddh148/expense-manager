package com.expensemanager.dto.loan;

import java.math.BigDecimal;
import java.time.LocalDate;

public record LoanResponse(
        Long id,
        String name,
        BigDecimal originalAmount,
        BigDecimal remainingAmount,
        BigDecimal paidAmount,
        BigDecimal monthlyEmi,
        BigDecimal interestRate,
        LocalDate startDate,
        LocalDate endDate,
        String status,
        /** Share of the original amount already repaid, 0-100. */
        BigDecimal progressPercentage,
        long paymentCount,
        /** Whole instalments still to go at the current EMI, rounded up. */
        Integer estimatedInstalmentsLeft
) {}
