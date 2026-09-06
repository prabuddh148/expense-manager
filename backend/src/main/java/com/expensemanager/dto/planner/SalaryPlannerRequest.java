package com.expensemanager.dto.planner;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.List;

/** Items are optional on create; when present they replace the whole list on update. */
public record SalaryPlannerRequest(
        @Size(max = 80) String name,
        @NotNull @DecimalMin(value = "0.01") @Digits(integer = 13, fraction = 2) BigDecimal totalSalary,
        @Valid List<SalaryPlannerItemRequest> items
) {}
