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
import jakarta.persistence.UniqueConstraint;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;

/**
 * A bank transaction recognised in an SMS on the device.
 *
 * The message itself never leaves the phone - parsing happens there and only these
 * structured fields are sent, so the server never holds anyone's inbox. Like the Money
 * Tracker, a row here is inert: it counts for nothing until the user picks a category
 * and asks for it to become an expense.
 *
 * {@code dedupeHash} is what stops the same message being imported twice, and it is
 * enforced by a unique constraint rather than a check-then-insert, so two imports
 * racing each other still cannot both win.
 */
@Entity
@Table(name = "sms_transactions",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_sms_user_hash", columnNames = {"user_id", "dedupe_hash"}),
        indexes = {
                @Index(name = "idx_sms_user_status", columnList = "user_id, status"),
                @Index(name = "idx_sms_user_bank", columnList = "user_id, bank_name")
        })
public class SmsTransaction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    /** Whatever the sender resolved to, e.g. ICICI. Never hard-coded; it comes from the SMS. */
    @Column(name = "bank_name", nullable = false, length = 60)
    private String bankName;

    /** Masked account or card tail as printed in the message, e.g. XX1234. */
    @Column(name = "account_identifier", length = 40)
    private String accountIdentifier;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal amount;

    @Enumerated(EnumType.STRING)
    @Column(name = "transaction_type", nullable = false, length = 10)
    private SmsTransactionType transactionType;

    @Column(name = "transaction_date", nullable = false)
    private LocalDate transactionDate;

    @Column(name = "transaction_time")
    private LocalTime transactionTime;

    @Column(length = 120)
    private String merchant;

    /** The bank's own reference from the message, when it prints one. */
    @Column(name = "sms_reference", length = 120)
    private String smsReference;

    /** Stable fingerprint of the message, unique per user. See the class comment. */
    @Column(name = "dedupe_hash", nullable = false, length = 64)
    private String dedupeHash;

    /** Chosen by the user, never inferred. Null while UNCATEGORIZED. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id")
    private Category category;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private SmsTransactionStatus status = SmsTransactionStatus.UNCATEGORIZED;

    /** The expense this became, once the user asked for it. */
    @Column(name = "linked_expense_id")
    private Long linkedExpenseId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "processed_at")
    private Instant processedAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected SmsTransaction() {
        // for JPA
    }

    public SmsTransaction(User user, String bankName, String accountIdentifier, BigDecimal amount,
                          SmsTransactionType transactionType, LocalDate transactionDate,
                          LocalTime transactionTime, String merchant, String smsReference,
                          String dedupeHash) {
        this.user = user;
        this.bankName = bankName;
        this.accountIdentifier = accountIdentifier;
        this.amount = amount;
        this.transactionType = transactionType;
        this.transactionDate = transactionDate;
        this.transactionTime = transactionTime;
        this.merchant = merchant;
        this.smsReference = smsReference;
        this.dedupeHash = dedupeHash;
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

    public String getBankName() {
        return bankName;
    }

    public String getAccountIdentifier() {
        return accountIdentifier;
    }

    public BigDecimal getAmount() {
        return amount;
    }

    public SmsTransactionType getTransactionType() {
        return transactionType;
    }

    public LocalDate getTransactionDate() {
        return transactionDate;
    }

    public LocalTime getTransactionTime() {
        return transactionTime;
    }

    public String getMerchant() {
        return merchant;
    }

    public String getSmsReference() {
        return smsReference;
    }

    public String getDedupeHash() {
        return dedupeHash;
    }

    public Category getCategory() {
        return category;
    }

    public void setCategory(Category category) {
        this.category = category;
    }

    public SmsTransactionStatus getStatus() {
        return status;
    }

    public void setStatus(SmsTransactionStatus status) {
        this.status = status;
    }

    public Long getLinkedExpenseId() {
        return linkedExpenseId;
    }

    public void setLinkedExpenseId(Long linkedExpenseId) {
        this.linkedExpenseId = linkedExpenseId;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getProcessedAt() {
        return processedAt;
    }

    public void setProcessedAt(Instant processedAt) {
        this.processedAt = processedAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
