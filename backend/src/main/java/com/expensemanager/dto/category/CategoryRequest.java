package com.expensemanager.dto.category;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record CategoryRequest(
        @NotBlank @Size(max = 60) String name,
        @NotNull @DecimalMin(value = "0.00") @Digits(integer = 13, fraction = 2) BigDecimal allocatedAmount,
        @Pattern(regexp = "^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$", message = "must be a hex colour like #4F8DFD")
        String color,
        @Size(max = 40) String icon
) {}
