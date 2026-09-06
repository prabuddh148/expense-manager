package com.expensemanager.mapper;

import com.expensemanager.dto.category.CategoryResponse;
import com.expensemanager.entity.Category;
import com.expensemanager.util.Money;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;

@Component
public class CategoryMapper {

    /** Spend is always computed for a window, so the caller passes it in. */
    public CategoryResponse toResponse(Category category, BigDecimal spent, long transactionCount) {
        BigDecimal allocated = Money.scale(category.getAllocatedAmount());
        BigDecimal spentAmount = Money.scale(spent);
        BigDecimal remaining = Money.subtract(allocated, spentAmount);

        return new CategoryResponse(
                category.getId(),
                category.getName(),
                allocated,
                spentAmount,
                remaining,
                Money.cappedPercentage(spentAmount, allocated),
                Money.isNegative(remaining),
                transactionCount,
                category.getColor(),
                category.getIcon(),
                category.getUpdatedAt());
    }
}
