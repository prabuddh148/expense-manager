package com.expensemanager.dto.savings;

import com.expensemanager.entity.SavingsMethod;

import java.math.BigDecimal;
import java.util.List;

/** Totals for the profile card: everything saved, this month, and how it was split. */
public record SavingsSummary(
        BigDecimal total,
        BigDecimal thisMonth,
        long entryCount,
        List<MethodTotal> byMethod
) {
    public record MethodTotal(
            SavingsMethod method,
            String label,
            BigDecimal amount,
            long count,
            BigDecimal percentage
    ) {}
}
