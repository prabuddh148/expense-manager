package com.expensemanager.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

/**
 * One budgeting period, from the day the salary came in until the user presses reset again.
 * The latest row is the current cycle; every expense dated on or after its start counts
 * against the category budgets.
 */
@Entity
@Table(name = "budget_cycles", uniqueConstraints = @UniqueConstraint(
        name = "uk_budget_cycle_user_start", columnNames = {"user_id", "start_date"}))
public class BudgetCycle {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    /** Sum of the category budgets unless the user typed a different figure. */
    @Column(name = "target_amount", nullable = false, precision = 15, scale = 2)
    private BigDecimal targetAmount = BigDecimal.ZERO;

    /**
     * When the reset was pressed. Anything recorded before it stays out of this cycle, even
     * when it is dated on or after the salary day, so a reset always starts spent at zero.
     * Null for cycles saved before resets kept the moment, and for implicit ones.
     */
    @Column(name = "counted_from")
    private Instant countedFrom;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected BudgetCycle() {
        // for JPA
    }

    public BudgetCycle(User user, LocalDate startDate, BigDecimal targetAmount) {
        this.user = user;
        this.startDate = startDate;
        this.targetAmount = targetAmount;
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

    public Long getId() {
        return id;
    }

    public User getUser() {
        return user;
    }

    public LocalDate getStartDate() {
        return startDate;
    }

    public BigDecimal getTargetAmount() {
        return targetAmount;
    }

    public void setTargetAmount(BigDecimal targetAmount) {
        this.targetAmount = targetAmount;
    }

    public Instant getCountedFrom() {
        return countedFrom;
    }

    public void setCountedFrom(Instant countedFrom) {
        this.countedFrom = countedFrom;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
