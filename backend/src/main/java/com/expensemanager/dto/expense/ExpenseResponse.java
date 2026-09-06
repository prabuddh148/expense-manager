package com.expensemanager.dto.expense;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;

public record ExpenseResponse(
        Long id,
        BigDecimal amount,
        Long categoryId,
        String categoryName,
        String categoryColor,
        String categoryIcon,
        String expenseName,
        /** What the list rows show: the category name, or the one-off name for Other. */
        String displayName,
        String description,
        LocalDate date,
        LocalTime time,
        Instant createdAt
) {}
