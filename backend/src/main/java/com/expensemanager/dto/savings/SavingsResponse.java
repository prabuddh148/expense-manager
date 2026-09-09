package com.expensemanager.dto.savings;

import com.expensemanager.entity.SavingsMethod;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

public record SavingsResponse(
        Long id,
        String title,
        BigDecimal amount,
        SavingsMethod method,
        /** Readable form of the method, so the client does not map enums itself. */
        String methodLabel,
        String note,
        LocalDate date,
        Instant createdAt
) {}
