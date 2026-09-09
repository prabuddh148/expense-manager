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
 * A record of money set aside: what was saved, how much, and by what means.
 *
 * A log rather than a balance. It does not touch the salary figures - money moved into
 * savings has usually already left the account through an expense, and counting it
 * again would deduct it twice. This exists so the user can see what they put away and
 * where it went, which the expense list on its own does not tell them.
 */
@Entity
@Table(name = "savings_entries", indexes = {
        @Index(name = "idx_savings_user_date", columnList = "user_id, entry_date")
})
public class SavingsEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    /** What it was for, e.g. "Emergency fund" or "Bike down payment". */
    @Column(nullable = false, length = 80)
    private String title;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal amount;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private SavingsMethod method;

    /** Free text for the detail the method cannot carry, e.g. which bank or fund. */
    @Column(length = 255)
    private String note;

    @Column(name = "entry_date", nullable = false)
    private LocalDate date;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected SavingsEntry() {
        // for JPA
    }

    public SavingsEntry(User user, String title, BigDecimal amount, SavingsMethod method,
                        String note, LocalDate date) {
        this.user = user;
        this.title = title;
        this.amount = amount;
        this.method = method;
        this.note = note;
        this.date = date;
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

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public BigDecimal getAmount() {
        return amount;
    }

    public void setAmount(BigDecimal amount) {
        this.amount = amount;
    }

    public SavingsMethod getMethod() {
        return method;
    }

    public void setMethod(SavingsMethod method) {
        this.method = method;
    }

    public String getNote() {
        return note;
    }

    public void setNote(String note) {
        this.note = note;
    }

    public LocalDate getDate() {
        return date;
    }

    public void setDate(LocalDate date) {
        this.date = date;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
