package com.expensemanager.mapper;

import com.expensemanager.dto.expense.ExpenseResponse;
import com.expensemanager.entity.Category;
import com.expensemanager.entity.Expense;
import com.expensemanager.util.Money;
import org.springframework.stereotype.Component;

@Component
public class ExpenseMapper {

    public static final String OTHER_LABEL = "Other";

    public ExpenseResponse toResponse(Expense expense) {
        Category category = expense.getCategory();
        String displayName = category != null
                ? category.getName()
                : (expense.getExpenseName() == null || expense.getExpenseName().isBlank()
                        ? OTHER_LABEL : expense.getExpenseName());

        return new ExpenseResponse(
                expense.getId(),
                Money.scale(expense.getAmount()),
                category != null ? category.getId() : null,
                category != null ? category.getName() : null,
                category != null ? category.getColor() : null,
                category != null ? category.getIcon() : null,
                expense.getExpenseName(),
                displayName,
                expense.getDescription(),
                expense.getDate(),
                expense.getTime(),
                expense.getCreatedAt());
    }
}
