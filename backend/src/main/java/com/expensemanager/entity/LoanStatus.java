package com.expensemanager.entity;

/** Where a loan stands. CLOSED is set automatically once the remaining balance hits zero. */
public enum LoanStatus {
    ACTIVE,
    CLOSED
}
