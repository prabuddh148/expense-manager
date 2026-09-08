package com.expensemanager.entity;

/** What the user chose to do with the transaction, and what an undo would reverse. */
public enum MoneyTrackerAction {
    NONE,
    DEDUCTED,
    ADD_ON
}
