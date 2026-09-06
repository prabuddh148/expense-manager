package com.expensemanager.dto.loan;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;

public record LoanRequest(
        @NotBlank @Size(max = 80) String name,
        @NotNull @DecimalMin(value = "0.01") @Digits(integer = 13, fraction = 2) BigDecimal originalAmount,
        @NotNull @DecimalMin(value = "0.01") @Digits(integer = 13, fraction = 2) BigDecimal monthlyEmi,
        @DecimalMin(value = "0.00") @Digits(integer = 4, fraction = 2) BigDecimal interestRate,
        LocalDate startDate,
        LocalDate endDate
) {}
