package com.expensemanager.mapper;

import com.expensemanager.dto.planner.SalaryPlannerItemResponse;
import com.expensemanager.dto.planner.SalaryPlannerResponse;
import com.expensemanager.entity.SalaryPlanner;
import com.expensemanager.entity.SalaryPlannerItem;
import com.expensemanager.util.Money;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.List;

@Component
public class SalaryPlannerMapper {

    public SalaryPlannerResponse toResponse(SalaryPlanner planner) {
        BigDecimal total = Money.scale(planner.getTotalSalary());
        BigDecimal allocated = planner.getItems().stream()
                .map(SalaryPlannerItem::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        allocated = Money.scale(allocated);
        BigDecimal remaining = Money.subtract(total, allocated);

        List<SalaryPlannerItemResponse> items = planner.getItems().stream()
                .map(item -> new SalaryPlannerItemResponse(
                        item.getId(),
                        item.getName(),
                        Money.scale(item.getAmount()),
                        item.getPercentage(),
                        item.getColor(),
                        item.getPosition()))
                .toList();

        return new SalaryPlannerResponse(
                planner.getId(),
                planner.getName(),
                total,
                allocated,
                remaining,
                Money.percentage(allocated, total),
                Money.isNegative(remaining),
                items,
                planner.getCreatedAt(),
                planner.getUpdatedAt());
    }
}
