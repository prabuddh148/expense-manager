package com.expensemanager.service;

import com.expensemanager.dto.category.CategoryRequest;
import com.expensemanager.dto.category.CategoryResponse;
import com.expensemanager.entity.Category;
import com.expensemanager.entity.User;
import com.expensemanager.exception.BadRequestException;
import com.expensemanager.exception.ConflictException;
import com.expensemanager.exception.ResourceNotFoundException;
import com.expensemanager.mapper.CategoryMapper;
import com.expensemanager.repository.CategoryRepository;
import com.expensemanager.repository.ExpenseRepository;
import com.expensemanager.security.CurrentUser;
import com.expensemanager.security.FeatureVisibility;
import com.expensemanager.util.DateRanges;
import com.expensemanager.util.Money;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.YearMonth;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class CategoryService {

    private final CategoryRepository categoryRepository;
    private final ExpenseRepository expenseRepository;
    private final CategoryMapper categoryMapper;
    private final CurrentUser currentUser;
    private final FeatureVisibility visibility;

    public CategoryService(CategoryRepository categoryRepository,
                           ExpenseRepository expenseRepository,
                           CategoryMapper categoryMapper,
                           CurrentUser currentUser,
                           FeatureVisibility visibility) {
        this.categoryRepository = categoryRepository;
        this.expenseRepository = expenseRepository;
        this.categoryMapper = categoryMapper;
        this.currentUser = currentUser;
        this.visibility = visibility;
    }

    /** Budgets reset every month, so spend is reported for the requested month only. */
    @Transactional(readOnly = true)
    public List<CategoryResponse> list(Integer year, Integer month) {
        Long userId = currentUser.id();
        DateRanges.Range range = monthRange(year, month);

        Map<Long, ExpenseRepository.CategoryTotal> totals = new HashMap<>();
        for (ExpenseRepository.CategoryTotal total : expenseRepository.sumByCategoryBetween(
                userId, range.from(), range.to(), visibility.expenseSources())) {
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
                id, range.from(), range.to(), visibility.expenseSources());
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

        Category category = new Category(
                user, name, Money.scale(request.allocatedAmount()), request.color(), request.icon());
        return categoryMapper.toResponse(categoryRepository.save(category), BigDecimal.ZERO, 0L);
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

        DateRanges.Range range = monthRange(null, null);
        return categoryMapper.toResponse(
                category,
                expenseRepository.sumForCategoryBetween(
                        id, range.from(), range.to(), visibility.expenseSources()),
                expenseRepository.countByCategoryId(id));
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

    private DateRanges.Range monthRange(Integer year, Integer month) {
        YearMonth period = (year == null || month == null) ? YearMonth.now() : YearMonth.of(year, month);
        return DateRanges.ofMonth(period.getYear(), period.getMonthValue());
    }
}
