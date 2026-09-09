package com.expensemanager.service;

import com.expensemanager.dto.savings.SavingsRequest;
import com.expensemanager.dto.savings.SavingsResponse;
import com.expensemanager.dto.savings.SavingsSummary;
import com.expensemanager.entity.SavingsEntry;
import com.expensemanager.entity.SavingsMethod;
import com.expensemanager.entity.User;
import com.expensemanager.exception.ResourceNotFoundException;
import com.expensemanager.repository.SavingsRepository;
import com.expensemanager.security.CurrentUser;
import com.expensemanager.util.DateRanges;
import com.expensemanager.util.Money;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;

/**
 * A log of money set aside, deliberately kept out of the salary arithmetic.
 *
 * Saving is not a deduction: the money usually left the account as an expense already,
 * and subtracting it again here would count it twice. So nothing in this service
 * touches the monthly balance - it only answers what was saved, when, and by what means.
 */
@Service
public class SavingsService {

    private final SavingsRepository savingsRepository;
    private final CurrentUser currentUser;

    public SavingsService(SavingsRepository savingsRepository, CurrentUser currentUser) {
        this.savingsRepository = savingsRepository;
        this.currentUser = currentUser;
    }

    @Transactional(readOnly = true)
    public List<SavingsResponse> list() {
        return savingsRepository.findByUserIdOrderByDateDescIdDesc(currentUser.id())
                .stream()
                .map(SavingsService::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public SavingsSummary summary() {
        Long userId = currentUser.id();
        YearMonth now = YearMonth.now();
        DateRanges.Range month = DateRanges.ofMonth(now.getYear(), now.getMonthValue());

        BigDecimal total = Money.scale(savingsRepository.sumForUser(userId));
        BigDecimal thisMonth = Money.scale(
                savingsRepository.sumForUserBetween(userId, month.from(), month.to()));

        List<SavingsSummary.MethodTotal> byMethod = savingsRepository.totalsByMethod(userId)
                .stream()
                .map(row -> {
                    SavingsMethod method = (SavingsMethod) row[0];
                    BigDecimal amount = Money.scale((BigDecimal) row[1]);
                    long count = (Long) row[2];
                    return new SavingsSummary.MethodTotal(
                            method,
                            label(method),
                            amount,
                            count,
                            Money.cappedPercentage(amount, total));
                })
                .toList();

        return new SavingsSummary(
                total,
                thisMonth,
                savingsRepository.findByUserIdOrderByDateDescIdDesc(userId).size(),
                byMethod);
    }

    @Transactional
    public SavingsResponse create(SavingsRequest request) {
        User user = currentUser.entity();
        SavingsEntry entry = new SavingsEntry(
                user,
                request.title().trim(),
                Money.scale(request.amount()),
                request.method(),
                trimToNull(request.note()),
                request.date() == null ? LocalDate.now() : request.date());
        return toResponse(savingsRepository.save(entry));
    }

    @Transactional
    public SavingsResponse update(Long id, SavingsRequest request) {
        SavingsEntry entry = require(id);
        entry.setTitle(request.title().trim());
        entry.setAmount(Money.scale(request.amount()));
        entry.setMethod(request.method());
        entry.setNote(trimToNull(request.note()));
        if (request.date() != null) {
            entry.setDate(request.date());
        }
        return toResponse(savingsRepository.save(entry));
    }

    @Transactional
    public void delete(Long id) {
        savingsRepository.delete(require(id));
    }

    private SavingsEntry require(Long id) {
        return savingsRepository.findByIdAndUserId(id, currentUser.id())
                .orElseThrow(() -> new ResourceNotFoundException("Savings entry " + id + " not found"));
    }

    private static SavingsResponse toResponse(SavingsEntry entry) {
        return new SavingsResponse(
                entry.getId(),
                entry.getTitle(),
                Money.scale(entry.getAmount()),
                entry.getMethod(),
                label(entry.getMethod()),
                entry.getNote(),
                entry.getDate(),
                entry.getCreatedAt());
    }

    /** Kept server-side so every client shows the same wording. */
    private static String label(SavingsMethod method) {
        return switch (method) {
            case CASH -> "Cash";
            case BANK_ACCOUNT -> "Bank account";
            case FIXED_DEPOSIT -> "Fixed deposit";
            case RECURRING_DEPOSIT -> "Recurring deposit";
            case MUTUAL_FUND -> "Mutual fund";
            case SIP -> "SIP";
            case STOCKS -> "Stocks";
            case GOLD -> "Gold";
            case PPF -> "PPF";
            case OTHER -> "Other";
        };
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
