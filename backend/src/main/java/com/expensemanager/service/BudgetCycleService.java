package com.expensemanager.service;

import com.expensemanager.dto.cycle.CycleResetRequest;
import com.expensemanager.dto.cycle.CycleResponse;
import com.expensemanager.dto.cycle.CycleTargetRequest;
import com.expensemanager.entity.BudgetCycle;
import com.expensemanager.entity.BudgetCycleCategory;
import com.expensemanager.entity.Category;
import com.expensemanager.entity.User;
import com.expensemanager.exception.BadRequestException;
import com.expensemanager.exception.ResourceNotFoundException;
import com.expensemanager.repository.BudgetCycleCategoryRepository;
import com.expensemanager.repository.BudgetCycleRepository;
import com.expensemanager.repository.CategoryRepository;
import com.expensemanager.repository.SalaryRepository;
import com.expensemanager.security.CurrentUser;
import com.expensemanager.util.DateRanges;
import com.expensemanager.util.Money;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

/**
 * The budgeting cycle runs from the day the salary arrived until the user presses reset.
 *
 * The target is fixed for the cycle: spending never moves it. It is set to the sum of the
 * category budgets on reset and whenever a category budget changes, and the user can still
 * overwrite it by hand. What is left is worked out from the categories instead - their
 * budgets plus anything credited on top, less everything spent since the cycle started.
 *
 * A user who has never reset has no row yet. They get a cycle starting on the first of
 * the current month, so the app behaves as it did before until the first reset.
 */
@Service
public class BudgetCycleService {

    private static final DateTimeFormatter LABEL = DateTimeFormatter.ofPattern("d MMM yyyy", Locale.ENGLISH);

    private final BudgetCycleRepository cycleRepository;
    private final BudgetCycleCategoryRepository snapshotRepository;
    private final CategoryRepository categoryRepository;
    private final SalaryRepository salaryRepository;
    private final SalaryService salaryService;
    private final CurrentUser currentUser;

    public BudgetCycleService(BudgetCycleRepository cycleRepository,
                              BudgetCycleCategoryRepository snapshotRepository,
                              CategoryRepository categoryRepository,
                              SalaryRepository salaryRepository,
                              SalaryService salaryService,
                              CurrentUser currentUser) {
        this.cycleRepository = cycleRepository;
        this.snapshotRepository = snapshotRepository;
        this.categoryRepository = categoryRepository;
        this.salaryRepository = salaryRepository;
        this.salaryService = salaryService;
        this.currentUser = currentUser;
    }

    @Transactional(readOnly = true)
    public CycleResponse current() {
        return summary(currentUser.id());
    }

    /** A figure typed by hand. It holds until the next reset or category change. */
    @Transactional
    public CycleResponse setTarget(CycleTargetRequest request) {
        User user = currentUser.entity();
        BudgetCycle cycle = persistedCycle(user);
        cycle.setTargetAmount(Money.scale(request.amount()));
        cycleRepository.save(cycle);
        return summary(user.getId());
    }

    /**
     * Salary day: closes the running cycle and opens a new one on the chosen date with fresh
     * budgets. The old budgets are copied aside first so the history survives, and the new
     * target is the sum of the new budgets.
     */
    @Transactional
    public CycleResponse reset(CycleResetRequest request) {
        User user = currentUser.entity();
        Long userId = user.getId();
        LocalDate start = request.startDate();
        if (start.isAfter(LocalDate.now())) {
            throw new BadRequestException("The salary date cannot be in the future");
        }

        Optional<BudgetCycle> existing = cycleRepository.findFirstByUserIdOrderByStartDateDesc(userId);
        if (existing.isPresent() && start.isBefore(existing.get().getStartDate())) {
            throw new BadRequestException("The salary date cannot be before the current cycle, which started on "
                    + LABEL.format(existing.get().getStartDate()));
        }

        List<Category> categories = categoryRepository.findByUserIdOrderByNameAsc(userId);
        Map<Long, BigDecimal> fresh = new HashMap<>();
        for (CycleResetRequest.Budget budget : request.budgets()) {
            boolean owned = categories.stream().anyMatch(c -> c.getId().equals(budget.categoryId()));
            if (!owned) {
                throw new ResourceNotFoundException("Category " + budget.categoryId() + " not found");
            }
            fresh.put(budget.categoryId(), Money.scale(budget.amount()));
        }

        BudgetCycle cycle;
        if (existing.isPresent() && start.equals(existing.get().getStartDate())) {
            // Same salary day again: redo this cycle's budgets rather than open another.
            cycle = existing.get();
        } else {
            LocalDate implicitStart = implicitStart();
            // Keep what the ending cycle was budgeted at. With no saved cycle there is only
            // something to keep if the implicit one actually ran before the new start.
            if (existing.isPresent() || start.isAfter(implicitStart)) {
                BudgetCycle ending = existing.orElseGet(() -> cycleRepository.save(
                        new BudgetCycle(user, implicitStart, implicitTarget(userId, categories))));
                snapshotRepository.saveAll(categories.stream()
                        .map(category -> new BudgetCycleCategory(ending, category))
                        .toList());
            }
            cycle = new BudgetCycle(user, start, Money.ZERO);
        }

        BigDecimal total = Money.ZERO;
        for (Category category : categories) {
            BigDecimal amount = fresh.getOrDefault(category.getId(), Money.ZERO);
            category.setAllocatedAmount(amount);
            total = Money.add(total, amount);
        }
        categoryRepository.saveAll(categories);

        cycle.setTargetAmount(total);
        cycleRepository.save(cycle);
        return summary(userId);
    }

    /**
     * Called after any category budget changes, so the target follows the categories. Runs
     * inside the caller's transaction.
     */
    public void syncTargetToCategories(User user) {
        BudgetCycle cycle = persistedCycle(user);
        cycle.setTargetAmount(allocatedTotal(categoryRepository.findByUserIdOrderByNameAsc(user.getId())));
        cycleRepository.save(cycle);
    }

    /** The window expenses are counted in: the cycle start until today, or a month on at least. */
    public DateRanges.Range currentRange(Long userId) {
        LocalDate start = cycleRepository.findFirstByUserIdOrderByStartDateDesc(userId)
                .map(BudgetCycle::getStartDate)
                .orElseGet(BudgetCycleService::implicitStart);
        LocalDate monthOn = start.plusMonths(1).minusDays(1);
        LocalDate today = LocalDate.now();
        return new DateRanges.Range(start, today.isAfter(monthOn) ? today : monthOn,
                "Since " + LABEL.format(start));
    }

    /** The target for the running cycle, whether or not it has been saved yet. */
    public BigDecimal currentTarget(Long userId) {
        return cycleRepository.findFirstByUserIdOrderByStartDateDesc(userId)
                .map(cycle -> Money.scale(cycle.getTargetAmount()))
                .orElseGet(() -> implicitTarget(userId, categoryRepository.findByUserIdOrderByNameAsc(userId)));
    }

    /** What is left across the categories. Shared with the dashboard so the two agree. */
    public static BigDecimal remaining(BigDecimal allocated, BigDecimal additions, BigDecimal deductions) {
        return Money.subtract(Money.add(allocated, additions), deductions);
    }

    public static BigDecimal allocatedTotal(List<Category> categories) {
        return Money.scale(categories.stream()
                .map(Category::getAllocatedAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add));
    }

    private CycleResponse summary(Long userId) {
        Optional<BudgetCycle> cycle = cycleRepository.findFirstByUserIdOrderByStartDateDesc(userId);
        DateRanges.Range range = currentRange(userId);
        BigDecimal allocated = allocatedTotal(categoryRepository.findByUserIdOrderByNameAsc(userId));
        BigDecimal deductions = Money.scale(salaryService.deductionsFor(userId, range.from(), range.to()));
        BigDecimal additions = Money.scale(salaryService.additionsFor(userId, range.from(), range.to()));

        return new CycleResponse(
                cycle.map(BudgetCycle::getId).orElse(null),
                range.from(),
                currentTarget(userId),
                allocated,
                deductions,
                additions,
                remaining(allocated, additions, deductions),
                cycle.map(BudgetCycle::getUpdatedAt).orElse(null));
    }

    private BudgetCycle persistedCycle(User user) {
        return cycleRepository.findFirstByUserIdOrderByStartDateDesc(user.getId())
                .orElseGet(() -> cycleRepository.save(new BudgetCycle(user, implicitStart(),
                        implicitTarget(user.getId(), categoryRepository.findByUserIdOrderByNameAsc(user.getId())))));
    }

    /** Before the first reset: the salary typed for this month, else the category budgets. */
    private BigDecimal implicitTarget(Long userId, List<Category> categories) {
        LocalDate start = implicitStart();
        return salaryRepository.findByUserIdAndPeriodYearAndPeriodMonth(
                        userId, start.getYear(), start.getMonthValue())
                .map(salary -> Money.scale(salary.getAmount()))
                .filter(Money::isPositive)
                .orElseGet(() -> allocatedTotal(categories));
    }

    private static LocalDate implicitStart() {
        return LocalDate.now().withDayOfMonth(1);
    }
}
