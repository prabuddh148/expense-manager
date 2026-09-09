package com.expensemanager.entity;

/**
 * How the money was put aside. Kept as an enum so totals can be grouped by method,
 * with OTHER as the escape hatch rather than a free-text field nobody can aggregate.
 */
public enum SavingsMethod {
    CASH,
    BANK_ACCOUNT,
    FIXED_DEPOSIT,
    RECURRING_DEPOSIT,
    MUTUAL_FUND,
    SIP,
    STOCKS,
    GOLD,
    PPF,
    OTHER
}
