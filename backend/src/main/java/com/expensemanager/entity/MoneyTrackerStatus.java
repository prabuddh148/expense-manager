package com.expensemanager.entity;

/**
 * PENDING and COMPLETED are about the real world - whether the money actually moved.
 * ARCHIVED means it has been pushed into the salary figures and left the active list.
 */
public enum MoneyTrackerStatus {
    PENDING,
    COMPLETED,
    ARCHIVED
}
