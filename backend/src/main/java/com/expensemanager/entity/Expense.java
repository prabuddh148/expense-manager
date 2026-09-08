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
import java.time.LocalTime;

/**
 * A single deduction from the salary. When the user picks Other instead of one of their own
 * categories the category link is null and expenseName carries the one-off label.
 */
@Entity
@Table(name = "expenses", indexes = {
        @Index(name = "idx_expense_user_date", columnList = "user_id, expense_date"),
        @Index(name = "idx_expense_category", columnList = "category_id")
})
public class Expense {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    /** Null means the expense was filed under Other. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id")
    private Category category;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal amount;

    /** Mandatory for Other expenses, optional otherwise. */
    @Column(name = "expense_name", length = 80)
    private String expenseName;

    @Column(length = 255)
    private String description;

    @Column(name = "expense_date", nullable = false)
    private LocalDate date;

    @Column(name = "expense_time")
    private LocalTime time;

    /**
     * Where the expense came from. Nullable in the database so the rows that existed
     * before this column did keep working; {@link #getSource()} reads those as MANUAL.
     */
    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private RecordSource source;

    /** Free-form origin detail, e.g. the bank and reference of the SMS behind it. */
    @Column(name = "source_reference", length = 190)
    private String sourceReference;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected Expense() {
        // for JPA
    }

    public Expense(User user, Category category, BigDecimal amount, String expenseName,
                   String description, LocalDate date, LocalTime time) {
        this.user = user;
        this.category = category;
        this.amount = amount;
        this.expenseName = expenseName;
        this.description = description;
        this.date = date;
        this.time = time;
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

    public Category getCategory() {
        return category;
    }

    public void setCategory(Category category) {
        this.category = category;
    }

    public BigDecimal getAmount() {
        return amount;
    }

    public void setAmount(BigDecimal amount) {
        this.amount = amount;
    }

    public String getExpenseName() {
        return expenseName;
    }

    public void setExpenseName(String expenseName) {
        this.expenseName = expenseName;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public LocalDate getDate() {
        return date;
    }

    public void setDate(LocalDate date) {
        this.date = date;
    }

    public LocalTime getTime() {
        return time;
    }

    public void setTime(LocalTime time) {
        this.time = time;
    }

    /** Rows written before the column existed have no value; they were all manual. */
    public RecordSource getSource() {
        return source == null ? RecordSource.MANUAL : source;
    }

    public void setSource(RecordSource source) {
        this.source = source;
    }

    public String getSourceReference() {
        return sourceReference;
    }

    public void setSourceReference(String sourceReference) {
        this.sourceReference = sourceReference;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
