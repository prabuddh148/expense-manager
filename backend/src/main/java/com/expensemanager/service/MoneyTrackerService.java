package com.expensemanager.service;

import com.expensemanager.dto.moneytracker.MoneyTrackerLinkRequest;
import com.expensemanager.dto.moneytracker.MoneyTrackerRequest;
import com.expensemanager.dto.moneytracker.MoneyTrackerResponse;
import com.expensemanager.dto.moneytracker.MoneyTrackerSummary;
import com.expensemanager.entity.Category;
import com.expensemanager.entity.Expense;
import com.expensemanager.entity.MoneyTrackerAction;
import com.expensemanager.entity.MoneyTrackerStatus;
import com.expensemanager.entity.MoneyTrackerTransaction;
import com.expensemanager.entity.MoneyTrackerType;
import com.expensemanager.entity.RecordSource;
import com.expensemanager.entity.SalaryAdjustment;
import com.expensemanager.entity.User;
import com.expensemanager.exception.BadRequestException;
import com.expensemanager.exception.ResourceNotFoundException;
import com.expensemanager.mapper.MoneyTrackerMapper;
import com.expensemanager.repository.CategoryRepository;
import com.expensemanager.repository.ExpenseRepository;
import com.expensemanager.repository.MoneyTrackerRepository;
import com.expensemanager.repository.SalaryAdjustmentRepository;
import com.expensemanager.security.CurrentUser;
import com.expensemanager.util.Money;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/**
 * Money owed in either direction, tracked apart from the salary figures.
 *
 * The separation is the point: nothing here touches an expense or the monthly balance
 * until the user asks for it by calling deduct or addOn. Those two are the only places
 * that write into the expense/salary side, each records what it created, and undo
 * reverses exactly that - so a transaction can cross the boundary and come back without
 * leaving a trace behind or being counted twice.
 */
@Service
public class MoneyTrackerService {

    private final MoneyTrackerRepository moneyTrackerRepository;
    private final ExpenseRepository expenseRepository;
    private final SalaryAdjustmentRepository salaryAdjustmentRepository;
    private final CategoryRepository categoryRepository;
    private final MoneyTrackerMapper mapper;
    private final CurrentUser currentUser;

    public MoneyTrackerService(MoneyTrackerRepository moneyTrackerRepository,
                               ExpenseRepository expenseRepository,
                               SalaryAdjustmentRepository salaryAdjustmentRepository,
                               CategoryRepository categoryRepository,
                               MoneyTrackerMapper mapper,
                               CurrentUser currentUser) {
        this.moneyTrackerRepository = moneyTrackerRepository;
        this.expenseRepository = expenseRepository;
        this.salaryAdjustmentRepository = salaryAdjustmentRepository;
        this.categoryRepository = categoryRepository;
        this.mapper = mapper;
        this.currentUser = currentUser;
    }

    @Transactional(readOnly = true)
    public List<MoneyTrackerResponse> list(MoneyTrackerStatus status) {
        Long userId = currentUser.id();
        List<MoneyTrackerTransaction> rows = status == null
                ? moneyTrackerRepository.findByUserIdOrderByDateDescIdDesc(userId)
                : moneyTrackerRepository.findByUserIdAndStatusOrderByDateDescIdDesc(userId, status);
        return rows.stream().map(mapper::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public MoneyTrackerResponse get(Long id) {
        return mapper.toResponse(require(id));
    }

    /** Outstanding totals for the summary cards - only what is still pending counts. */
    @Transactional(readOnly = true)
    public MoneyTrackerSummary summary() {
        Long userId = currentUser.id();
        var pending = MoneyTrackerStatus.PENDING;
        return new MoneyTrackerSummary(
                Money.scale(moneyTrackerRepository.sumByTypeAndStatus(userId, MoneyTrackerType.PAY, pending)),
                Money.scale(moneyTrackerRepository.sumByTypeAndStatus(userId, MoneyTrackerType.RECEIVE, pending)),
                moneyTrackerRepository.findByUserIdAndStatusOrderByDateDescIdDesc(userId, pending).size());
    }

    @Transactional
    public MoneyTrackerResponse create(MoneyTrackerRequest request) {
        User user = currentUser.entity();
        MoneyTrackerTransaction transaction = new MoneyTrackerTransaction(
                user,
                request.title().trim(),
                trimToNull(request.description()),
                Money.scale(request.amount()),
                request.type(),
                request.date() == null ? LocalDate.now() : request.date(),
                request.dueDate(),
                trimToNull(request.notes()));
        return mapper.toResponse(moneyTrackerRepository.save(transaction));
    }

    @Transactional
    public MoneyTrackerResponse update(Long id, MoneyTrackerRequest request) {
        MoneyTrackerTransaction transaction = require(id);
        // Editing after the amount has moved into the salary figures would leave the
        // linked expense or adjustment disagreeing with this row.
        if (transaction.isLinked()) {
            throw new BadRequestException(
                    "Undo this transaction before editing it - it is currently linked to your "
                            + (transaction.getAction() == MoneyTrackerAction.DEDUCTED
                            ? "expenses" : "salary"));
        }

        transaction.setTitle(request.title().trim());
        transaction.setDescription(trimToNull(request.description()));
        transaction.setAmount(Money.scale(request.amount()));
        transaction.setType(request.type());
        transaction.setDate(request.date() == null ? transaction.getDate() : request.date());
        transaction.setDueDate(request.dueDate());
        transaction.setNotes(trimToNull(request.notes()));

        return mapper.toResponse(moneyTrackerRepository.save(transaction));
    }

    @Transactional
    public void delete(Long id) {
        MoneyTrackerTransaction transaction = require(id);
        if (transaction.isLinked()) {
            throw new BadRequestException(
                    "Undo this transaction before deleting it, otherwise the linked record "
                            + "would be left behind");
        }
        moneyTrackerRepository.delete(transaction);
    }

    /** Marks that the money actually moved. Independent of the salary figures. */
    @Transactional
    public MoneyTrackerResponse complete(Long id, boolean completed) {
        MoneyTrackerTransaction transaction = require(id);
        if (transaction.getStatus() == MoneyTrackerStatus.ARCHIVED) {
            throw new BadRequestException("This transaction has already been moved to your salary");
        }
        transaction.setStatus(completed ? MoneyTrackerStatus.COMPLETED : MoneyTrackerStatus.PENDING);
        transaction.setCompletedAt(completed ? Instant.now() : null);
        return mapper.toResponse(moneyTrackerRepository.save(transaction));
    }

    /**
     * Turns a payable into a real expense, which is what pulls it out of the salary.
     * The expense carries its origin so the two can always be told apart later.
     */
    @Transactional
    public MoneyTrackerResponse deduct(Long id, MoneyTrackerLinkRequest request) {
        MoneyTrackerTransaction transaction = require(id);
        requireUnlinked(transaction);
        if (transaction.getType() != MoneyTrackerType.PAY) {
            throw new BadRequestException("Only a Pay transaction can be deducted from your salary");
        }

        Category category = null;
        if (request != null && request.categoryId() != null) {
            category = categoryRepository.findByIdAndUserId(request.categoryId(), currentUser.id())
                    .orElseThrow(() -> new ResourceNotFoundException(
                            "Category " + request.categoryId() + " not found"));
        }

        Expense expense = new Expense(
                transaction.getUser(),
                category,
                transaction.getAmount(),
                transaction.getTitle(),
                transaction.getDescription(),
                transaction.getDate(),
                null);
        expense.setSource(RecordSource.MONEY_TRACKER);
        expense.setSourceReference("money-tracker:" + transaction.getId());
        expense = expenseRepository.save(expense);

        transaction.setAction(MoneyTrackerAction.DEDUCTED);
        transaction.setLinkedExpenseId(expense.getId());
        transaction.setStatus(MoneyTrackerStatus.ARCHIVED);
        if (transaction.getCompletedAt() == null) {
            transaction.setCompletedAt(Instant.now());
        }

        return mapper.toResponse(moneyTrackerRepository.save(transaction));
    }

    /**
     * Credits a receivable on top of the month's salary. Recorded as its own adjustment
     * rather than editing the salary, so the figure the user typed in stays untouched.
     */
    @Transactional
    public MoneyTrackerResponse addOn(Long id) {
        MoneyTrackerTransaction transaction = require(id);
        requireUnlinked(transaction);
        if (transaction.getType() != MoneyTrackerType.RECEIVE) {
            throw new BadRequestException("Only a Receive transaction can be added to your salary");
        }

        SalaryAdjustment adjustment = salaryAdjustmentRepository.save(new SalaryAdjustment(
                transaction.getUser(),
                transaction.getAmount(),
                transaction.getTitle(),
                RecordSource.MONEY_TRACKER,
                transaction.getDate()));

        transaction.setAction(MoneyTrackerAction.ADD_ON);
        transaction.setLinkedAdjustmentId(adjustment.getId());
        transaction.setStatus(MoneyTrackerStatus.ARCHIVED);
        if (transaction.getCompletedAt() == null) {
            transaction.setCompletedAt(Instant.now());
        }

        return mapper.toResponse(moneyTrackerRepository.save(transaction));
    }

    /**
     * Reverses whichever of the two happened and puts the transaction back in the list.
     *
     * Idempotent by construction: an unlinked transaction has nothing to reverse and is
     * rejected, and the row is cleared in the same transaction as the delete, so a
     * second call finds nothing to undo rather than deleting something else.
     */
    @Transactional
    public MoneyTrackerResponse undo(Long id) {
        MoneyTrackerTransaction transaction = require(id);
        if (!transaction.isLinked()) {
            throw new BadRequestException("This transaction has not been added to your salary");
        }

        if (transaction.getAction() == MoneyTrackerAction.DEDUCTED) {
            Long expenseId = transaction.getLinkedExpenseId();
            if (expenseId != null) {
                // Scoped by user: an id on the row is still not authority to delete.
                expenseRepository.findByIdAndUserId(expenseId, currentUser.id())
                        .ifPresent(expenseRepository::delete);
            }
        } else {
            Long adjustmentId = transaction.getLinkedAdjustmentId();
            if (adjustmentId != null) {
                salaryAdjustmentRepository.findById(adjustmentId)
                        .filter(adjustment -> adjustment.getUser().getId().equals(currentUser.id()))
                        .ifPresent(salaryAdjustmentRepository::delete);
            }
        }

        transaction.setAction(MoneyTrackerAction.NONE);
        transaction.setLinkedExpenseId(null);
        transaction.setLinkedAdjustmentId(null);
        // Back to where it was before the action: completed, since the money did move.
        transaction.setStatus(transaction.getCompletedAt() == null
                ? MoneyTrackerStatus.PENDING
                : MoneyTrackerStatus.COMPLETED);

        return mapper.toResponse(moneyTrackerRepository.save(transaction));
    }

    private void requireUnlinked(MoneyTrackerTransaction transaction) {
        if (transaction.isLinked()) {
            throw new BadRequestException(
                    "This transaction has already been added to your salary. Undo it first.");
        }
    }

    private MoneyTrackerTransaction require(Long id) {
        return moneyTrackerRepository.findByIdAndUserId(id, currentUser.id())
                .orElseThrow(() -> new ResourceNotFoundException("Transaction " + id + " not found"));
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
