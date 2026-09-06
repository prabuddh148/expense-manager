package com.expensemanager.dto.loan;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

public record EmiPaymentResponse(
        Long id,
        Long loanId,
        String loanName,
        BigDecimal amount,
        LocalDate paymentDate,
        String description,
        Instant createdAt
) {}
