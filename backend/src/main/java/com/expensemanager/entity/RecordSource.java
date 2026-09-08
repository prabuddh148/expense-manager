package com.expensemanager.entity;

/** Where a record came from, so its origin survives in the expense list. */
public enum RecordSource {
    MANUAL,
    MONEY_TRACKER,
    SMS
}
