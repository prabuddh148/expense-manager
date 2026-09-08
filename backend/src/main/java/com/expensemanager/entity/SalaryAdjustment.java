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
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

/**
 * Money that arrived on top of the salary, e.g. someone repaying what they owed.
 *
 * Kept separate from {@link Salary} on purpose: the salary a user typed in is a fact
 * about their job and should not drift every time a friend pays them back. The monthly
 * balance becomes salary + adjustments - deductions, so the stated salary stays intact
 * and every addition remains individually visible and reversible.
 */
@Entity
@Table(name = "salary_adjustments", indexes = {
        @Index(name = "idx_adjustment_user_date", columnList = "user_id, entry_date")
})
public class SalaryAdjustment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    /** Always positive; the sign lives in the semantics of the adjustment, not the value. */
    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal amount;

    @Column(nullable = false, length = 80)
    private String label;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private RecordSource source = RecordSource.MANUAL;

    @Column(name = "entry_date", nullable = false)
    private LocalDate date;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected SalaryAdjustment() {
        // for JPA
    }

    public SalaryAdjustment(User user, BigDecimal amount, String label, RecordSource source,
                            LocalDate date) {
        this.user = user;
        this.amount = amount;
        this.label = label;
        this.source = source;
        this.date = date;
    }

    @PrePersist
    void onCreate() {
        this.createdAt = Instant.now();
    }

    public Long getId() {
        return id;
    }

    public User getUser() {
        return user;
    }

    public BigDecimal getAmount() {
        return amount;
    }

    public String getLabel() {
        return label;
    }

    public RecordSource getSource() {
        return source;
    }

    public LocalDate getDate() {
        return date;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
