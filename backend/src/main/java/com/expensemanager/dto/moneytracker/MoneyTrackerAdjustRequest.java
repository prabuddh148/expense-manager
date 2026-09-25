package com.expensemanager.dto.moneytracker;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

/** Raises or lowers what is owed, e.g. more was lent or part of it came back. */
public record MoneyTrackerAdjustRequest(
        @NotNull @DecimalMin(value = "0.01", message = "Amount must be greater than zero")
        @Digits(integer = 13, fraction = 2) BigDecimal amount,
        @NotNull Direction direction
) {
    public enum Direction { ADD, SUBTRACT }
}
