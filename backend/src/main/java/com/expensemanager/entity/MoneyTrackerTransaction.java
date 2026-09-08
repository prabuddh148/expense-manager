package com.expensemanager.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

/**
 * Money owed in either direction, tracked on its own and deliberately invisible to the
 * salary and expense figures. It only ever reaches those through an explicit action by
 * the user, at which point {@code action} records what happened and the linked ids let
 * that action be undone exactly once.
 */
@Entity
@Table(name = "money_tracker_transactions", indexes = {
        @Index(name = "idx_money_tracker_user", columnList = "user_id"),
        @Index(name = "idx_money_tracker_status", columnList = "user_id, status")
})
public class MoneyTrackerTransaction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, length = 80)
    private String title;

    @Column(length = 255)
    private String description;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal amount;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private MoneyTrackerType type;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 12)
    private MoneyTrackerStatus status = MoneyTrackerStatus.PENDING;

    /** Whether this has been pushed into the salary figures, and in which direction. */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private MoneyTrackerAction action = MoneyTrackerAction.NONE;

    @Column(name = "entry_date", nullable = false)
    private LocalDate date;

    @Column(name = "due_date")
    private LocalDate dueDate;

    @Column(name = "completed_at")
    private Instant completedAt;

    @Column(length = 500)
    private String notes;

    /** Set when the action was DEDUCTED - the expense row this created. */
    @Column(name = "linked_expense_id")
    private Long linkedExpenseId;

    /** Set when the action was ADD_ON - the salary adjustment this created. */
    @Column(name = "linked_adjustment_id")
    private Long linkedAdjustmentId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected MoneyTrackerTransaction() {
        // for JPA
    }

    public MoneyTrackerTransaction(User user, String title, String description, BigDecimal amount,
                                   MoneyTrackerType type, LocalDate date, LocalDate dueDate,
                                   String notes) {
        this.user = user;
        this.title = title;
        this.description = description;
        this.amount = amount;
        this.type = type;
        this.date = date;
        this.dueDate = dueDate;
        this.notes = notes;
    }

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        this.createdAt = now;
        this.updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        this.updatedAt = Instant.now();
    }

    /** True once the transaction has been pushed into the salary figures. */
    public boolean isLinked() {
        return action != MoneyTrackerAction.NONE;
    }

    public Long getId() {
        return id;
    }

    public User getUser() {
        return user;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public BigDecimal getAmount() {
        return amount;
    }

    public void setAmount(BigDecimal amount) {
        this.amount = amount;
    }

    public MoneyTrackerType getType() {
        return type;
    }

    public void setType(MoneyTrackerType type) {
        this.type = type;
    }

    public MoneyTrackerStatus getStatus() {
        return status;
    }

    public void setStatus(MoneyTrackerStatus status) {
        this.status = status;
    }

    public MoneyTrackerAction getAction() {
        return action;
    }

    public void setAction(MoneyTrackerAction action) {
        this.action = action;
    }

    public LocalDate getDate() {
        return date;
    }

    public void setDate(LocalDate date) {
        this.date = date;
    }

    public LocalDate getDueDate() {
        return dueDate;
    }

    public void setDueDate(LocalDate dueDate) {
        this.dueDate = dueDate;
    }

    public Instant getCompletedAt() {
        return completedAt;
    }

    public void setCompletedAt(Instant completedAt) {
        this.completedAt = completedAt;
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
    }

    public Long getLinkedExpenseId() {
        return linkedExpenseId;
    }

    public void setLinkedExpenseId(Long linkedExpenseId) {
        this.linkedExpenseId = linkedExpenseId;
    }

    public Long getLinkedAdjustmentId() {
        return linkedAdjustmentId;
    }

    public void setLinkedAdjustmentId(Long linkedAdjustmentId) {
        this.linkedAdjustmentId = linkedAdjustmentId;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
