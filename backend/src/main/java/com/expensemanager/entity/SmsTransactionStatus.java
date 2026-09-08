package com.expensemanager.entity;

/**
 * A detected transaction starts UNCATEGORIZED and only ever moves forward when the user
 * acts: picking a category, then pushing it into the expense list. Nothing here is
 * automatic - the app never guesses a category or files an expense on its own.
 */
public enum SmsTransactionStatus {
    UNCATEGORIZED,
    CATEGORIZED,
    ADDED_TO_EXPENSE,
    /** Dismissed by the user: kept for dedup so it is never re-detected. */
    IGNORED
}
