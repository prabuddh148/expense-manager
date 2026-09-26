package com.expensemanager.dto.cycle;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * Starts a new cycle on the day the salary arrived, with fresh budgets. A category left out
 * of the list starts the cycle at zero.
 */
public record CycleResetRequest(
        @NotNull LocalDate startDate,
        @NotNull List<@Valid Budget> budgets
) {
    public record Budget(
            @NotNull Long categoryId,
            @NotNull @DecimalMin(value = "0.00") @Digits(integer = 13, fraction = 2) BigDecimal amount
    ) {}
}
