package com.expensemanager.dto.savings;

import com.expensemanager.entity.SavingsMethod;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;

public record SavingsRequest(
        @NotBlank @Size(max = 80) String title,
        @NotNull @DecimalMin(value = "0.01", message = "Amount must be greater than zero")
        BigDecimal amount,
        @NotNull SavingsMethod method,
        @Size(max = 255) String note,
        LocalDate date
) {}
