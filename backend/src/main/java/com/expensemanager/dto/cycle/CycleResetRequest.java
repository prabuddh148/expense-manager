package com.expensemanager.dto.cycle;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * Starts a new cycle on the day the salary arrived, with fresh budgets. A category left out
 * of the list starts the cycle at zero. New categories, e.g. buckets imported from a salary
 * plan that have no category yet, are created with their budget as part of the reset.
 */
public record CycleResetRequest(
        @NotNull LocalDate startDate,
        @NotNull List<@Valid Budget> budgets,
        List<@Valid NewCategory> newCategories
) {
    public CycleResetRequest(LocalDate startDate, List<Budget> budgets) {
        this(startDate, budgets, null);
    }

    public record Budget(
            @NotNull Long categoryId,
            @NotNull @DecimalMin(value = "0.00") @Digits(integer = 13, fraction = 2) BigDecimal amount
    ) {}

    public record NewCategory(
            @NotBlank @Size(max = 60) String name,
            @NotNull @DecimalMin(value = "0.00") @Digits(integer = 13, fraction = 2) BigDecimal amount,
            @Pattern(regexp = "^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$", message = "must be a hex colour like #4F8DFD")
            String color
    ) {}
}
