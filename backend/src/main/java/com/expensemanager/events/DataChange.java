package com.expensemanager.events;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * One row a user created, changed or removed. This is also the JSON message sent to Kafka,
 * so field names are part of the contract with the activity-service.
 *
 * @param eventId    unique per change; consumers use it to ignore redelivered messages
 * @param entityType simple entity class name, e.g. Expense, EmiPayment
 * @param amount     the row's amount for money rows, otherwise null
 */
public record DataChange(
        UUID eventId,
        Long userId,
        String entityType,
        Long entityId,
        ChangeAction action,
        BigDecimal amount,
        Instant occurredAt
) {}
