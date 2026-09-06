package com.expensemanager.dto.salary;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.LocalDate;

public record SalaryRequest(
        @NotNull @DecimalMin(value = "0.00") @Digits(integer = 13, fraction = 2) BigDecimal amount,
        @DecimalMin(value = "0.00") @Digits(integer = 13, fraction = 2) BigDecimal targetAmount,
        LocalDate targetDate,
        @Min(2000) @Max(2100) Integer year,
        @Min(1) @Max(12) Integer month
) {}
