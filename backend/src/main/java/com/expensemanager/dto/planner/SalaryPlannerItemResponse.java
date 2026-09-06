package com.expensemanager.dto.planner;

import java.math.BigDecimal;

public record SalaryPlannerItemResponse(
        Long id,
        String name,
        BigDecimal amount,
        BigDecimal percentage,
        String color,
        int position
) {}
