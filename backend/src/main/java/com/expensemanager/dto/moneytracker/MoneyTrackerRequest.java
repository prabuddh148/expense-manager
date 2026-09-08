package com.expensemanager.dto.moneytracker;

import com.expensemanager.entity.MoneyTrackerType;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;

public record MoneyTrackerRequest(
        @NotBlank @Size(max = 80) String title,
        @Size(max = 255) String description,
        @NotNull @DecimalMin(value = "0.01", message = "Amount must be greater than zero")
        BigDecimal amount,
        @NotNull MoneyTrackerType type,
        LocalDate date,
        LocalDate dueDate,
        @Size(max = 500) String notes
) {}
