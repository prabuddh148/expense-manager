package com.expensemanager.dto.analytics;

import java.math.BigDecimal;

public record CategorySpendResponse(
        Long categoryId,
        String name,
        String color,
        BigDecimal amount,
        /** Share of the total spend in the window, 0-100. */
        BigDecimal percentage,
        long transactions
) {}
