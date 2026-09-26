package com.expensemanager.dto.cycle;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

/** The current budgeting cycle, from the last salary day onwards. */
public record CycleResponse(
        /** Null until the user resets or edits for the first time. */
        Long id,
        LocalDate startDate,
        /** Fixed during the cycle: moves only on reset, a category change or a manual edit. */
        BigDecimal targetAmount,
        /** Sum of every category budget right now. */
        BigDecimal allocatedTotal,
        /** Expenses plus EMI payments since the start date. */
        BigDecimal totalDeductions,
        /** Money credited on top, e.g. a Money Tracker receivable. */
        BigDecimal totalAdditions,
        /** What is left across the categories: allocated + additions - deductions. */
        BigDecimal remainingAmount,
        Instant updatedAt
) {}
