package com.expensemanager.dto.expense;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;

/**
 * A null categoryId means the user picked Other, in which case expenseName is required.
 * The service enforces that pairing.
 */
public record ExpenseRequest(
        @NotNull @DecimalMin(value = "0.01", message = "must be greater than zero")
        @Digits(integer = 13, fraction = 2) BigDecimal amount,
        Long categoryId,
        @Size(max = 80) String expenseName,
        @Size(max = 255) String description,
        LocalDate date,
        LocalTime time
) {}
