package com.expensemanager.dto.category;

import java.math.BigDecimal;
import java.time.Instant;

public record CategoryResponse(
        Long id,
        String name,
        BigDecimal allocatedAmount,
        BigDecimal spentAmount,
        BigDecimal remainingAmount,
        /** Share of the budget used, 0-100. Capped at 100 for progress bars. */
        BigDecimal usedPercentage,
        boolean overspent,
        long transactionCount,
        String color,
        String icon,
        Instant updatedAt
) {}
