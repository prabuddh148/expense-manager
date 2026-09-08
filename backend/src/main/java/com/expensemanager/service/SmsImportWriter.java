package com.expensemanager.service;

import com.expensemanager.dto.sms.SmsTransactionRequest;
import com.expensemanager.entity.SmsTransaction;
import com.expensemanager.entity.User;
import com.expensemanager.repository.SmsTransactionRepository;
import com.expensemanager.util.Money;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Objects;

/**
 * Writes one detected transaction, in a transaction of its own.
 *
 * This lives in its own bean rather than as a method on the import service for a
 * mundane but decisive reason: Spring applies @Transactional through a proxy, and a
 * call from one method of a class to another bypasses it. Written there, REQUIRES_NEW
 * would silently do nothing, and a single duplicate hitting the unique constraint would
 * mark the whole batch rollback-only - losing every genuinely new message alongside it.
 */
@Component
public class SmsImportWriter {

    private final SmsTransactionRepository smsTransactionRepository;

    public SmsImportWriter(SmsTransactionRepository smsTransactionRepository) {
        this.smsTransactionRepository = smsTransactionRepository;
    }

    /** Returns the saved row, or null when this message has been seen before. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public SmsTransaction saveIfNew(User user, SmsTransactionRequest request) {
        String hash = request.dedupeHash() == null || request.dedupeHash().isBlank()
                ? fingerprint(request)
                : request.dedupeHash();

        if (smsTransactionRepository.existsByUserIdAndDedupeHash(user.getId(), hash)) {
            return null;
        }

        SmsTransaction transaction = new SmsTransaction(
                user,
                request.bankName().trim(),
                trimToNull(request.accountIdentifier()),
                Money.scale(request.amount()),
                request.transactionType(),
                request.transactionDate(),
                request.transactionTime(),
                trimToNull(request.merchant()),
                trimToNull(request.smsReference()),
                hash);

        try {
            return smsTransactionRepository.saveAndFlush(transaction);
        } catch (DataIntegrityViolationException ex) {
            // Another import inserted the same message between the check and the write.
            // The constraint is the real guarantee; this check is only an optimisation.
            return null;
        }
    }

    /**
     * Fallback fingerprint for a message the device did not hash: bank, account, amount,
     * type, date, time and reference together. The same message always produces the same
     * hash, while two identical amounts on the same day from different cards stay
     * distinct because the account and reference are part of it.
     */
    static String fingerprint(SmsTransactionRequest request) {
        String seed = String.join("|",
                request.bankName().trim().toLowerCase(),
                Objects.toString(request.accountIdentifier(), ""),
                Money.scale(request.amount()).toPlainString(),
                request.transactionType().name(),
                request.transactionDate().toString(),
                Objects.toString(request.transactionTime(), ""),
                Objects.toString(request.smsReference(), ""));
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(seed.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 is required but unavailable", ex);
        }
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
