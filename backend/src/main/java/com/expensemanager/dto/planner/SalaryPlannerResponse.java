package com.expensemanager.dto.planner;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public record SalaryPlannerResponse(
        Long id,
        String name,
        BigDecimal totalSalary,
        BigDecimal totalAllocated,
        /** totalSalary - totalAllocated. Negative when the user over-allocates. */
        BigDecimal remainingAmount,
        BigDecimal allocatedPercentage,
        boolean overAllocated,
        List<SalaryPlannerItemResponse> items,
        Instant createdAt,
        Instant updatedAt
) {}
