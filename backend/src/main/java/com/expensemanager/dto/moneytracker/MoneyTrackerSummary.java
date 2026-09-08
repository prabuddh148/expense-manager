package com.expensemanager.dto.moneytracker;

import java.math.BigDecimal;

/** Totals for the Money Tracker summary cards. Pending only - settled money is history. */
public record MoneyTrackerSummary(
        BigDecimal toPay,
        BigDecimal toReceive,
        long pendingCount
) {}
