package com.expensemanager.activity.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * One entry in a user's activity feed. Lives in this service's own database - the expense
 * API's tables are never read from here.
 */
@Entity
@Table(name = "activity_events",
        indexes = @Index(name = "idx_activity_user_time", columnList = "user_id, occurred_at"),
        uniqueConstraints = @UniqueConstraint(name = "uk_activity_event_id", columnNames = "event_id"))
public class ActivityEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** The producer's id for the change. Unique, which is what makes consuming idempotent. */
    @Column(name = "event_id", nullable = false)
    private UUID eventId;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "entity_type", nullable = false, length = 60)
    private String entityType;

    @Column(name = "entity_id")
    private Long entityId;

    @Column(nullable = false, length = 20)
    private String action;

    @Column(precision = 15, scale = 2)
    private BigDecimal amount;

    @Column(name = "occurred_at", nullable = false)
    private Instant occurredAt;

    @Column(name = "received_at", nullable = false)
    private Instant receivedAt;

    protected ActivityEvent() {
    }

    public ActivityEvent(UUID eventId, Long userId, String entityType, Long entityId,
                         String action, BigDecimal amount, Instant occurredAt) {
        this.eventId = eventId;
        this.userId = userId;
        this.entityType = entityType;
        this.entityId = entityId;
        this.action = action;
        this.amount = amount;
        this.occurredAt = occurredAt;
        this.receivedAt = Instant.now();
    }

    public Long getId() {
        return id;
    }

    public UUID getEventId() {
        return eventId;
    }

    public Long getUserId() {
        return userId;
    }

    public String getEntityType() {
        return entityType;
    }

    public Long getEntityId() {
        return entityId;
    }

    public String getAction() {
        return action;
    }

    public BigDecimal getAmount() {
        return amount;
    }

    public Instant getOccurredAt() {
        return occurredAt;
    }

    public Instant getReceivedAt() {
        return receivedAt;
    }
}
