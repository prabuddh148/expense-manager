package com.expensemanager.activity.kafka;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * The JSON the expense API publishes (its DataChange record). Kept as a separate copy on
 * purpose: services share a message contract, not a code module, so each can deploy alone.
 * Unknown fields are ignored, so the producer can add fields without breaking this consumer.
 */
public record ActivityEventMessage(
        UUID eventId,
        Long userId,
        String entityType,
        Long entityId,
        String action,
        BigDecimal amount,
        Instant occurredAt
) {}
