package com.expensemanager.dto.salary;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

public record SalaryResponse(
        Long id,
        BigDecimal amount,
        BigDecimal targetAmount,
        LocalDate targetDate,
        int year,
        int month,
        /** targetAmount - amount, or null when no target is set. */
        BigDecimal difference,
        /** How far the current salary is towards the target, 0-100. */
        BigDecimal progressPercentage,
        /** Expenses plus EMI payments recorded in this month. */
        BigDecimal totalDeductions,
        /** Money added on top of the salary this month, e.g. a repayment received. */
        BigDecimal totalAdditions,
        BigDecimal remainingAmount,
        Instant updatedAt
) {}
