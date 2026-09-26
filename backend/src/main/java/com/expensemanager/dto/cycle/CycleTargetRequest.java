package com.expensemanager.dto.cycle;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public record CycleTargetRequest(
        @NotNull @DecimalMin(value = "0.00") @Digits(integer = 13, fraction = 2) BigDecimal amount
) {}
