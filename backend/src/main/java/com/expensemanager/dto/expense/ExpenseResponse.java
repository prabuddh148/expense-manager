package com.expensemanager.dto.expense;

import com.expensemanager.entity.RecordSource;

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
        /** Where the row came from: MANUAL, MONEY_TRACKER or SMS. */
        RecordSource source,
        /** Origin detail, e.g. the Money Tracker transaction or bank reference behind it. */
        String sourceReference,
        /** Short badge the list shows for non-manual rows, e.g. "Deducted" or "SMS". */
        String sourceLabel,
        Instant createdAt
) {}
