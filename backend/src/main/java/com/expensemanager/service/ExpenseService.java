package com.expensemanager.service;

import com.expensemanager.dto.common.PageResponse;
import com.expensemanager.dto.expense.ExpenseRequest;
import com.expensemanager.dto.expense.ExpenseResponse;
import com.expensemanager.entity.Category;
import com.expensemanager.entity.Expense;
import com.expensemanager.entity.User;
import com.expensemanager.exception.BadRequestException;
import com.expensemanager.exception.ResourceNotFoundException;
import com.expensemanager.mapper.ExpenseMapper;
import com.expensemanager.repository.CategoryRepository;
import com.expensemanager.repository.ExpenseRepository;
import com.expensemanager.security.CurrentUser;
import com.expensemanager.util.Money;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Set;

@Service
public class ExpenseService {

    private static final int MAX_PAGE_SIZE = 100;
    private static final Set<String> SORTABLE = Set.of("date", "amount", "createdAt");

    private final ExpenseRepository expenseRepository;
    private final CategoryRepository categoryRepository;
    private final ExpenseMapper expenseMapper;
    private final CurrentUser currentUser;

    public ExpenseService(ExpenseRepository expenseRepository,
                          CategoryRepository categoryRepository,
                          ExpenseMapper expenseMapper,
                          CurrentUser currentUser) {
        this.expenseRepository = expenseRepository;
        this.categoryRepository = categoryRepository;
        this.expenseMapper = expenseMapper;
        this.currentUser = currentUser;
    }

    @Transactional(readOnly = true)
    public PageResponse<ExpenseResponse> list(String search,
                                              Long categoryId,
                                              boolean otherOnly,
                                              LocalDate from,
                                              LocalDate to,
                                              BigDecimal minAmount,
                                              BigDecimal maxAmount,
                                              int page,
                                              int size,
                                              String sortBy,
                                              String direction) {
        Specification<Expense> spec = ExpenseSpecifications.forUser(
                currentUser.id(), search, categoryId, otherOnly, from, to, minAmount, maxAmount);
        Page<Expense> result = expenseRepository.findAll(spec, pageable(page, size, sortBy, direction));
        return PageResponse.of(result, expenseMapper::toResponse);
    }

    @Transactional(readOnly = true)
    public ExpenseResponse get(Long id) {
        return expenseMapper.toResponse(requireOwned(id));
    }

    @Transactional(readOnly = true)
    public List<ExpenseResponse> recent(Long userId, int limit) {
        Specification<Expense> spec = ExpenseSpecifications.forUser(
                userId, null, null, false, null, null, null, null);
        return expenseRepository
                .findAll(spec, PageRequest.of(0, limit, Sort.by(Sort.Direction.DESC, "date", "id")))
                .map(expenseMapper::toResponse)
                .getContent();
    }

    @Transactional
    public ExpenseResponse create(ExpenseRequest request) {
        User user = currentUser.entity();
        Category category = resolveCategory(request, user.getId());

        Expense expense = new Expense(
                user,
                category,
                Money.scale(request.amount()),
                trimToNull(request.expenseName()),
                trimToNull(request.description()),
                request.date() == null ? LocalDate.now() : request.date(),
                request.time() == null ? LocalTime.now().withSecond(0).withNano(0) : request.time());

        return expenseMapper.toResponse(expenseRepository.save(expense));
    }

    @Transactional
    public ExpenseResponse update(Long id, ExpenseRequest request) {
        Expense expense = requireOwned(id);
        Category category = resolveCategory(request, expense.getUser().getId());

        expense.setAmount(Money.scale(request.amount()));
        expense.setCategory(category);
        expense.setExpenseName(trimToNull(request.expenseName()));
        expense.setDescription(trimToNull(request.description()));
        if (request.date() != null) {
            expense.setDate(request.date());
        }
        if (request.time() != null) {
            expense.setTime(request.time());
        }
        return expenseMapper.toResponse(expenseRepository.save(expense));
    }

    @Transactional
    public void delete(Long id) {
        expenseRepository.delete(requireOwned(id));
    }

    private Expense requireOwned(Long id) {
        return expenseRepository.findByIdAndUserId(id, currentUser.id())
                .orElseThrow(() -> new ResourceNotFoundException("Expense " + id + " not found"));
    }

    /**
     * No category means the user chose Other, which makes the free-text name mandatory -
     * otherwise the expense would show up in history with nothing to identify it.
     */
    private Category resolveCategory(ExpenseRequest request, Long userId) {
        if (request.categoryId() == null) {
            if (trimToNull(request.expenseName()) == null) {
                throw new BadRequestException("Other expenses need an expense name");
            }
            return null;
        }
        return categoryRepository.findByIdAndUserId(request.categoryId(), userId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Category " + request.categoryId() + " not found"));
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private Pageable pageable(int page, int size, String sortBy, String direction) {
        int safeSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        String property = SORTABLE.contains(sortBy) ? sortBy : "date";
        Sort.Direction sortDirection = "asc".equalsIgnoreCase(direction)
                ? Sort.Direction.ASC : Sort.Direction.DESC;
        // Secondary sort on id keeps pages stable when several rows share a date.
        return PageRequest.of(Math.max(page, 0), safeSize,
                Sort.by(sortDirection, property).and(Sort.by(Sort.Direction.DESC, "id")));
    }
}
