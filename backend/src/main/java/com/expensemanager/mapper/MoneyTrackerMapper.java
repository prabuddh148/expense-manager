package com.expensemanager.mapper;

import com.expensemanager.dto.moneytracker.MoneyTrackerResponse;
import com.expensemanager.entity.MoneyTrackerStatus;
import com.expensemanager.entity.MoneyTrackerTransaction;
import com.expensemanager.util.Money;
import org.springframework.stereotype.Component;

import java.time.LocalDate;

/** Keeps the entity out of the controllers, as with every other resource here. */
@Component
public class MoneyTrackerMapper {

    public MoneyTrackerResponse toResponse(MoneyTrackerTransaction transaction) {
        return new MoneyTrackerResponse(
                transaction.getId(),
                transaction.getTitle(),
                transaction.getDescription(),
                Money.scale(transaction.getAmount()),
                transaction.getType(),
                transaction.getStatus(),
                transaction.getAction(),
                transaction.getDate(),
                transaction.getDueDate(),
                transaction.getCompletedAt(),
                transaction.getNotes(),
                transaction.getLinkedExpenseId(),
                transaction.getLinkedAdjustmentId(),
                transaction.isLinked(),
                isOverdue(transaction),
                transaction.getCreatedAt(),
                transaction.getUpdatedAt());
    }

    /** Only money that has not moved yet can be late. */
    private boolean isOverdue(MoneyTrackerTransaction transaction) {
        return transaction.getDueDate() != null
                && transaction.getStatus() == MoneyTrackerStatus.PENDING
                && transaction.getDueDate().isBefore(LocalDate.now());
    }
}
