package com.expensemanager.dto.sms;

import com.expensemanager.entity.SmsTransactionStatus;
import com.expensemanager.entity.SmsTransactionType;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;

public record SmsTransactionResponse(
        Long id,
        String bankName,
        String accountIdentifier,
        BigDecimal amount,
        SmsTransactionType transactionType,
        LocalDate transactionDate,
        LocalTime transactionTime,
        String merchant,
        String smsReference,
        Long categoryId,
        String categoryName,
        String categoryColor,
        String categoryIcon,
        SmsTransactionStatus status,
        Long linkedExpenseId,
        /** True once the user has picked a category, which is what unlocks Add to expense. */
        boolean readyForExpense,
        Instant createdAt,
        Instant processedAt
) {}
