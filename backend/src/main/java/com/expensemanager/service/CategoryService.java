package com.expensemanager.service;

import com.expensemanager.dto.category.CategoryMergeRequest;
import com.expensemanager.dto.category.CategoryRequest;
import com.expensemanager.dto.category.CategoryResponse;
import com.expensemanager.dto.category.CategoryTopUpRequest;
import com.expensemanager.entity.Category;
import com.expensemanager.entity.User;
import com.expensemanager.exception.BadRequestException;
import com.expensemanager.exception.ConflictException;
import com.expensemanager.exception.ResourceNotFoundException;
import com.expensemanager.mapper.CategoryMapper;
import com.expensemanager.repository.CategoryRepository;
import com.expensemanager.repository.ExpenseRepository;
import com.expensemanager.repository.SmsTransactionRepository;
import com.expensemanager.security.CurrentUser;
import com.expensemanager.security.FeatureVisibility;
import com.expensemanager.util.DateRanges;
import com.expensemanager.util.Money;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
public class CategoryService {

    private final CategoryRepository categoryRepository;
    private final ExpenseRepository expenseRepository;
    private final SmsTransactionRepository smsTransactionRepository;
    private final CategoryMapper categoryMapper;
    private final CurrentUser currentUser;
    private final FeatureVisibility visibility;
    private final BudgetCycleService cycleService;

    public CategoryService(CategoryRepository categoryRepository,
                           ExpenseRepository expenseRepository,
                           SmsTransactionRepository smsTransactionRepository,
                           CategoryMapper categoryMapper,
                           CurrentUser currentUser,
                           FeatureVisibility visibility,
                           BudgetCycleService cycleService) {
        this.categoryRepository = categoryRepository;
        this.expenseRepository = expenseRepository;
        this.smsTransactionRepository = smsTransactionRepository;
        this.categoryMapper = categoryMapper;
        this.currentUser = currentUser;
        this.visibility = visibility;
        this.cycleService = cycleService;
    }

    /**
     * Budgets reset on salary day, so spend is reported for the running cycle, or for a
     * calendar month when one is asked for.
     */
    @Transactional(readOnly = true)
    public List<CategoryResponse> list(Integer year, Integer month) {
        Long userId = currentUser.id();
        DateRanges.Range range = monthRange(year, month);

        Map<Long, ExpenseRepository.CategoryTotal> totals = new HashMap<>();
        for (ExpenseRepository.CategoryTotal total : expenseRepository.sumByCategoryBetween(
                userId, range.from(), range.to(), range.since(), visibility.expenseSources())) {
            if (total.getCategoryId() != null) {
                totals.merge(total.getCategoryId(), total, (a, b) -> a);
            }
        }

        return categoryRepository.findByUserIdOrderByNameAsc(userId).stream()
                .map(category -> {
                    ExpenseRepository.CategoryTotal total = totals.get(category.getId());
                    return categoryMapper.toResponse(
                            category,
                            total == null ? BigDecimal.ZERO : total.getTotal(),
                            total == null ? 0L : total.getTransactions());
                })
                .toList();
    }

    @Transactional(readOnly = true)
    public CategoryResponse get(Long id, Integer year, Integer month) {
        Long userId = currentUser.id();
        Category category = requireOwned(id, userId);
        DateRanges.Range range = monthRange(year, month);
        BigDecimal spent = expenseRepository.sumForCategoryBetween(
                id, range.from(), range.to(), range.since(), visibility.expenseSources());
        return categoryMapper.toResponse(category, spent, expenseRepository.countByCategoryId(id));
    }

    @Transactional
    public CategoryResponse create(CategoryRequest request) {
        User user = currentUser.entity();
        String name = request.name().trim();
        if (categoryRepository.existsByUserIdAndNameIgnoreCase(user.getId(), name)) {
            throw new ConflictException("You already have a category called " + name);
        }
        rejectReservedName(name);

        Category category = categoryRepository.save(new Category(
                user, name, Money.scale(request.allocatedAmount()), request.color(), request.icon()));
        cycleService.syncTargetToCategories(user);
        return categoryMapper.toResponse(category, BigDecimal.ZERO, 0L);
    }

    @Transactional
    public CategoryResponse update(Long id, CategoryRequest request) {
        Long userId = currentUser.id();
        Category category = requireOwned(id, userId);
        String name = request.name().trim();
        if (categoryRepository.existsByUserIdAndNameIgnoreCaseAndIdNot(userId, name, id)) {
            throw new ConflictException("You already have a category called " + name);
        }
        rejectReservedName(name);

        category.setName(name);
        category.setAllocatedAmount(Money.scale(request.allocatedAmount()));
        category.setColor(request.color());
        category.setIcon(request.icon());
        categoryRepository.save(category);
        cycleService.syncTargetToCategories(currentUser.entity());
        return currentMonthResponse(category);
    }

    /** Money that arrived from elsewhere for this bucket raises its budget by that much. */
    @Transactional
    public CategoryResponse addFunds(Long id, CategoryTopUpRequest request) {
        Category category = requireOwned(id, currentUser.id());
        category.setAllocatedAmount(Money.add(category.getAllocatedAmount(), request.amount()));
        categoryRepository.save(category);
        cycleService.syncTargetToCategories(currentUser.entity());
        return currentMonthResponse(category);
    }

    /**
     * Folds the chosen categories into the one the user keeps: its budget becomes the sum of
     * all of them, and every expense or SMS filed under the others moves across, so no spend
     * is lost or double counted. The other categories are then removed.
     */
    @Transactional
    public CategoryResponse merge(CategoryMergeRequest request) {
        Long userId = currentUser.id();
        Set<Long> ids = new LinkedHashSet<>(request.categoryIds());
        if (ids.size() < 2) {
            throw new BadRequestException("Pick at least two different categories to merge");
        }
        if (!ids.contains(request.keepId())) {
            throw new BadRequestException("The category to keep must be one of those being merged");
        }

        Category keep = requireOwned(request.keepId(), userId);
        BigDecimal total = Money.scale(keep.getAllocatedAmount());
        for (Long id : ids) {
            if (id.equals(keep.getId())) {
                continue;
            }
            Category merged = requireOwned(id, userId);
            total = Money.add(total, merged.getAllocatedAmount());

            expenseRepository.findAll((root, query, builder) -> builder.and(
                            builder.equal(root.get("user").get("id"), userId),
                            builder.equal(root.get("category").get("id"), id)))
                    .forEach(expense -> {
                        expense.setCategory(keep);
                        expenseRepository.save(expense);
                    });
            smsTransactionRepository.findByUserIdAndCategoryId(userId, id)
                    .forEach(sms -> {
                        sms.setCategory(keep);
                        smsTransactionRepository.save(sms);
                    });
            categoryRepository.delete(merged);
        }

        keep.setAllocatedAmount(total);
        categoryRepository.save(keep);
        cycleService.syncTargetToCategories(currentUser.entity());
        return currentMonthResponse(keep);
    }

    /**
     * Deleting a category keeps its expenses: they fall back to Other with the category name
     * preserved as the one-off label, so history and totals never silently change.
     */
    @Transactional
    public void delete(Long id) {
        Long userId = currentUser.id();
        Category category = requireOwned(id, userId);
        expenseRepository.findAll((root, query, builder) -> builder.and(
                        builder.equal(root.get("user").get("id"), userId),
                        builder.equal(root.get("category").get("id"), id)))
                .forEach(expense -> {
                    if (expense.getExpenseName() == null || expense.getExpenseName().isBlank()) {
                        expense.setExpenseName(category.getName());
                    }
                    expense.setCategory(null);
                    expenseRepository.save(expense);
                });
        categoryRepository.delete(category);
        cycleService.syncTargetToCategories(currentUser.entity());
    }

    Category requireOwned(Long id, Long userId) {
        return categoryRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Category " + id + " not found"));
    }

    private void rejectReservedName(String name) {
        if ("other".equalsIgnoreCase(name)) {
            throw new BadRequestException(
                    "Other is reserved for one-off expenses and cannot be used as a category name");
        }
    }

    private CategoryResponse currentMonthResponse(Category category) {
        DateRanges.Range range = monthRange(null, null);
        return categoryMapper.toResponse(
                category,
                expenseRepository.sumForCategoryBetween(
                        category.getId(), range.from(), range.to(), range.since(), visibility.expenseSources()),
                expenseRepository.countByCategoryId(category.getId()));
    }

    private DateRanges.Range monthRange(Integer year, Integer month) {
        if (year == null || month == null) {
            return cycleService.currentRange(currentUser.id());
        }
        return DateRanges.ofMonth(year, month);
    }
}
