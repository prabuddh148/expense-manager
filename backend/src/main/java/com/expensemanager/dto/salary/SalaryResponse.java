package com.expensemanager.dto.salary;

import java.math.BigDecimal;
import java.time.Instant;

public record SalaryResponse(
        Long id,
        /** The target salary for the month. */
        BigDecimal amount,
        int year,
        int month,
        /** Expenses plus EMI payments recorded in this month. */
        BigDecimal totalDeductions,
        /** Money added on top of the salary this month, e.g. a repayment received. */
        BigDecimal totalAdditions,
        BigDecimal remainingAmount,
        Instant updatedAt
) {}
