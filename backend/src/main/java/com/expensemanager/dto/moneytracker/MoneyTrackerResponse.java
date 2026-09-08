package com.expensemanager.dto.moneytracker;

import com.expensemanager.entity.MoneyTrackerAction;
import com.expensemanager.entity.MoneyTrackerStatus;
import com.expensemanager.entity.MoneyTrackerType;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

public record MoneyTrackerResponse(
        Long id,
        String title,
        String description,
        BigDecimal amount,
        MoneyTrackerType type,
        MoneyTrackerStatus status,
        /** NONE until the user pushes this into the salary figures. */
        MoneyTrackerAction action,
        LocalDate date,
        LocalDate dueDate,
        Instant completedAt,
        String notes,
        /** The expense created by a deduction, if any. */
        Long linkedExpenseId,
        /** The salary adjustment created by an add-on, if any. */
        Long linkedAdjustmentId,
        /** True while the transaction is reflected in the salary and can be undone. */
        boolean undoable,
        /** Past its due date and still unsettled, so the client can flag it. */
        boolean overdue,
        Instant createdAt,
        Instant updatedAt
) {}
