package com.expensemanager.service;

import com.expensemanager.dto.sms.SmsBankSummary;
import com.expensemanager.dto.sms.SmsImportResult;
import com.expensemanager.dto.sms.SmsTransactionRequest;
import com.expensemanager.dto.sms.SmsTransactionResponse;
import com.expensemanager.entity.Category;
import com.expensemanager.entity.Expense;
import com.expensemanager.entity.RecordSource;
import com.expensemanager.entity.SmsTransaction;
import com.expensemanager.entity.SmsTransactionStatus;
import com.expensemanager.entity.SmsTransactionType;
import com.expensemanager.entity.User;
import com.expensemanager.exception.BadRequestException;
import com.expensemanager.exception.ResourceNotFoundException;
import com.expensemanager.mapper.SmsTransactionMapper;
import com.expensemanager.repository.CategoryRepository;
import com.expensemanager.repository.ExpenseRepository;
import com.expensemanager.repository.SmsTransactionRepository;
import com.expensemanager.security.CurrentUser;
import com.expensemanager.util.Money;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * Transactions the device recognised in bank messages.
 *
 * Two rules shape everything here. Nothing is ever categorised automatically - a row
 * arrives UNCATEGORIZED and only the user moves it on. And the same message must never
 * become two transactions, which is enforced by a unique hash in the database rather
 * than a check in code, so a rescan racing a live message still cannot duplicate a row.
 */
@Service
public class SmsTransactionService {

    private final SmsTransactionRepository smsTransactionRepository;
    private final CategoryRepository categoryRepository;
    private final ExpenseRepository expenseRepository;
    private final SmsImportWriter importWriter;
    private final SmsTransactionMapper mapper;
    private final CurrentUser currentUser;

    public SmsTransactionService(SmsTransactionRepository smsTransactionRepository,
                                 CategoryRepository categoryRepository,
                                 ExpenseRepository expenseRepository,
                                 SmsImportWriter importWriter,
                                 SmsTransactionMapper mapper,
                                 CurrentUser currentUser) {
        this.smsTransactionRepository = smsTransactionRepository;
        this.categoryRepository = categoryRepository;
        this.expenseRepository = expenseRepository;
        this.importWriter = importWriter;
        this.mapper = mapper;
        this.currentUser = currentUser;
    }

    @Transactional(readOnly = true)
    public List<SmsTransactionResponse> list(String bank, SmsTransactionStatus status,
                                             SmsTransactionType type) {
        return smsTransactionRepository
                .findByUserIdOrderByTransactionDateDescIdDesc(currentUser.id())
                .stream()
                .filter(row -> bank == null || bank.equalsIgnoreCase(row.getBankName()))
                .filter(row -> status == null || row.getStatus() == status)
                .filter(row -> type == null || row.getTransactionType() == type)
                .map(mapper::toResponse)
                .toList();
    }

    /** The bank filter row, built from what has actually been detected. */
    @Transactional(readOnly = true)
    public List<SmsBankSummary> banks() {
        Long userId = currentUser.id();
        List<SmsTransaction> rows = smsTransactionRepository
                .findByUserIdOrderByTransactionDateDescIdDesc(userId);

        return rows.stream()
                .map(SmsTransaction::getBankName)
                .distinct()
                .sorted()
                .map(bank -> {
                    List<SmsTransaction> forBank = rows.stream()
                            .filter(row -> row.getBankName().equals(bank))
                            .toList();
                    return new SmsBankSummary(
                            bank,
                            forBank.size(),
                            count(forBank, SmsTransactionStatus.UNCATEGORIZED),
                            count(forBank, SmsTransactionStatus.CATEGORIZED),
                            count(forBank, SmsTransactionStatus.ADDED_TO_EXPENSE),
                            sum(forBank, SmsTransactionType.DEBIT),
                            sum(forBank, SmsTransactionType.CREDIT));
                })
                .toList();
    }

    @Transactional(readOnly = true)
    public long pendingCount() {
        return smsTransactionRepository.countByUserIdAndStatus(
                currentUser.id(), SmsTransactionStatus.UNCATEGORIZED);
    }

    /**
     * Takes everything the device found and keeps whatever is new. Duplicates are
     * counted, not rejected: a rescan legitimately offers messages already imported, and
     * failing the whole batch over them would lose the genuinely new ones alongside.
     */
    @Transactional
    public SmsImportResult importAll(List<SmsTransactionRequest> requests) {
        User user = currentUser.entity();
        List<SmsTransactionResponse> created = new ArrayList<>();
        int skipped = 0;

        for (SmsTransactionRequest request : requests) {
            SmsTransaction saved = importWriter.saveIfNew(user, request);
            if (saved == null) {
                skipped++;
            } else {
                created.add(mapper.toResponse(saved));
            }
        }
        return new SmsImportResult(created.size(), skipped, created);
    }

    /** The user picking a category is the only thing that sets one. */
    @Transactional
    public SmsTransactionResponse categorise(Long id, Long categoryId) {
        SmsTransaction transaction = require(id);
        if (transaction.getStatus() == SmsTransactionStatus.ADDED_TO_EXPENSE) {
            throw new BadRequestException("This transaction is already in your expenses");
        }

        Category category = categoryRepository.findByIdAndUserId(categoryId, currentUser.id())
                .orElseThrow(() -> new ResourceNotFoundException("Category " + categoryId + " not found"));

        transaction.setCategory(category);
        transaction.setStatus(SmsTransactionStatus.CATEGORIZED);
        return mapper.toResponse(smsTransactionRepository.save(transaction));
    }

    /**
     * Creates the expense, carrying the bank details along so the row can always be
     * traced back. The SMS transaction is marked processed rather than deleted, which is
     * also what keeps its hash around to block a re-import.
     */
    @Transactional
    public SmsTransactionResponse addToExpense(Long id) {
        SmsTransaction transaction = require(id);

        if (transaction.getStatus() == SmsTransactionStatus.ADDED_TO_EXPENSE) {
            throw new BadRequestException("This transaction is already in your expenses");
        }
        if (transaction.getCategory() == null) {
            throw new BadRequestException("Choose a category before adding this to your expenses");
        }
        if (transaction.getTransactionType() != SmsTransactionType.DEBIT) {
            throw new BadRequestException("Only a debit can be added as an expense");
        }

        Expense expense = new Expense(
                transaction.getUser(),
                transaction.getCategory(),
                transaction.getAmount(),
                transaction.getMerchant(),
                describe(transaction),
                transaction.getTransactionDate(),
                transaction.getTransactionTime());
        expense.setSource(RecordSource.SMS);
        expense.setSourceReference(reference(transaction));
        expense = expenseRepository.save(expense);

        transaction.setLinkedExpenseId(expense.getId());
        transaction.setStatus(SmsTransactionStatus.ADDED_TO_EXPENSE);
        transaction.setProcessedAt(Instant.now());

        return mapper.toResponse(smsTransactionRepository.save(transaction));
    }

    /** Dismisses a detection. The row stays so the message is never detected again. */
    @Transactional
    public SmsTransactionResponse ignore(Long id) {
        SmsTransaction transaction = require(id);
        if (transaction.getStatus() == SmsTransactionStatus.ADDED_TO_EXPENSE) {
            throw new BadRequestException("This transaction is already in your expenses");
        }
        transaction.setStatus(SmsTransactionStatus.IGNORED);
        transaction.setProcessedAt(Instant.now());
        return mapper.toResponse(smsTransactionRepository.save(transaction));
    }

    /**
     * Removes the record entirely, hash and all.
     *
     * Distinct from ignore(): that keeps the row so the message is never detected again,
     * while this genuinely forgets it - so a later rescan will find the message afresh.
     * That is the behaviour someone deleting a log expects, and it is also the only way
     * back if they dismissed something by mistake.
     *
     * A transaction already turned into an expense is kept, because deleting it would
     * strip the expense of the record explaining where it came from.
     */
    @Transactional
    public void delete(Long id) {
        SmsTransaction transaction = require(id);
        if (transaction.getStatus() == SmsTransactionStatus.ADDED_TO_EXPENSE) {
            throw new BadRequestException(
                    "This is linked to an expense. Delete the expense itself if you no longer want it.");
        }
        smsTransactionRepository.delete(transaction);
    }

    /** Clears every detection that has not become an expense. */
    @Transactional
    public int deleteAllPending() {
        List<SmsTransaction> removable = smsTransactionRepository
                .findByUserIdOrderByTransactionDateDescIdDesc(currentUser.id())
                .stream()
                .filter(row -> row.getStatus() != SmsTransactionStatus.ADDED_TO_EXPENSE)
                .toList();
        smsTransactionRepository.deleteAll(removable);
        return removable.size();
    }

    private SmsTransaction require(Long id) {
        return smsTransactionRepository.findByIdAndUserId(id, currentUser.id())
                .orElseThrow(() -> new ResourceNotFoundException("Transaction " + id + " not found"));
    }

    private static String describe(SmsTransaction transaction) {
        StringBuilder text = new StringBuilder(transaction.getBankName());
        if (transaction.getAccountIdentifier() != null) {
            text.append(' ').append(transaction.getAccountIdentifier());
        }
        if (transaction.getSmsReference() != null) {
            text.append(" ref ").append(transaction.getSmsReference());
        }
        return text.toString();
    }

    private static String reference(SmsTransaction transaction) {
        return "sms:" + transaction.getId() + ":" + transaction.getBankName();
    }

    private static long count(List<SmsTransaction> rows, SmsTransactionStatus status) {
        return rows.stream().filter(row -> row.getStatus() == status).count();
    }

    private static BigDecimal sum(List<SmsTransaction> rows, SmsTransactionType type) {
        return Money.scale(rows.stream()
                .filter(row -> row.getTransactionType() == type)
                .map(SmsTransaction::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add));
    }

}
