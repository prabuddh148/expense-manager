package com.expensemanager.service;

import com.expensemanager.dto.analytics.AnalyticsResponse;
import com.expensemanager.dto.dashboard.DashboardResponse;
import com.expensemanager.entity.LoanStatus;
import com.expensemanager.repository.CategoryRepository;
import com.expensemanager.repository.EmiPaymentRepository;
import com.expensemanager.repository.LoanRepository;
import com.expensemanager.repository.SalaryRepository;
import com.expensemanager.security.CurrentUser;
import com.expensemanager.util.DateRanges;
import com.expensemanager.cache.CacheNames;
import com.expensemanager.util.Money;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.YearMonth;
import java.util.List;

/** Assembles the whole dashboard in one query pass so the mobile app makes a single call. */
@Service
public class DashboardService {

    private static final int RECENT_EXPENSE_COUNT = 5;

    private final SalaryRepository salaryRepository;
    private final CategoryRepository categoryRepository;
    private final LoanRepository loanRepository;
    private final EmiPaymentRepository paymentRepository;
    private final ExpenseService expenseService;
    private final AnalyticsService analyticsService;
    private final SalaryService salaryService;
    private final BudgetCycleService cycleService;
    private final CurrentUser currentUser;

    public DashboardService(SalaryRepository salaryRepository,
                            CategoryRepository categoryRepository,
                            LoanRepository loanRepository,
                            EmiPaymentRepository paymentRepository,
                            ExpenseService expenseService,
                            AnalyticsService analyticsService,
                            SalaryService salaryService,
                            BudgetCycleService cycleService,
                            CurrentUser currentUser) {
        this.salaryRepository = salaryRepository;
        this.categoryRepository = categoryRepository;
        this.loanRepository = loanRepository;
        this.paymentRepository = paymentRepository;
        this.expenseService = expenseService;
        this.analyticsService = analyticsService;
        this.salaryService = salaryService;
        this.cycleService = cycleService;
        this.currentUser = currentUser;
    }

    /** Cached in Redis when it is enabled; see {@link com.expensemanager.cache.UserScopedKeyGenerator}. */
    @Cacheable(cacheNames = CacheNames.DASHBOARD, keyGenerator = CacheNames.KEY_GENERATOR)
    @Transactional(readOnly = true)
    public DashboardResponse get(Integer year, Integer month) {
        Long userId = currentUser.id();
        // No month asked for means the running cycle, which starts on salary day.
        boolean cycle = year == null || month == null;
        DateRanges.Range range = cycle
                ? cycleService.currentRange(userId)
                : DateRanges.ofMonth(year, month);
        YearMonth period = YearMonth.from(range.from());

        AnalyticsResponse analytics = analyticsService.build(userId, range);

        BigDecimal salaryAmount = cycle
                ? cycleService.currentTarget(userId)
                : salaryRepository.findByUserIdAndPeriodYearAndPeriodMonth(userId, year, month)
                        .map(s -> Money.scale(s.getAmount()))
                        .orElse(Money.ZERO);

        // Money credited on top of the salary this month, e.g. a Money Tracker receivable
        // the user chose to add on. Kept out of the salary figure itself so the stated
        // salary stays meaningful.
        BigDecimal additions = salaryService.additionsFor(userId, range.from(), range.to());

        BigDecimal budgeted = BudgetCycleService.allocatedTotal(categoryRepository.findByUserIdOrderByNameAsc(userId));

        // In a cycle the target stays put and what is left comes from the categories; a past
        // calendar month keeps the old salary-minus-spend figure.
        var salarySummary = new DashboardResponse.SalarySummary(
                salaryAmount,
                analytics.totalDeductions(),
                additions,
                cycle
                        ? BudgetCycleService.remaining(budgeted, additions, analytics.totalDeductions())
                        : Money.subtract(Money.add(salaryAmount, additions), analytics.totalDeductions()),
                range.from(),
                budgeted);

        var expenseSummary = new DashboardResponse.ExpenseSummary(
                analytics.totalExpenses(),
                Money.scale(budgeted),
                Money.subtract(budgeted, analytics.totalExpenses()),
                analytics.transactionCount(),
                analytics.averagePerDay());

        BigDecimal outstanding = Money.scale(loanRepository.sumOutstanding(userId));
        BigDecimal original = Money.scale(loanRepository.sumOriginal(userId));
        BigDecimal totalPaid = Money.scale(paymentRepository.sumPaidForUser(userId));
        long activeLoans = loanRepository.findByUserIdOrderByStatusAscNameAsc(userId).stream()
                .filter(loan -> loan.getStatus() == LoanStatus.ACTIVE)
                .count();

        var loanSummary = new DashboardResponse.LoanSummary(
                outstanding,
                original,
                totalPaid,
                Money.scale(loanRepository.sumMonthlyEmi(userId)),
                analytics.totalEmiPaid(),
                activeLoans,
                Money.cappedPercentage(totalPaid, original));

        return new DashboardResponse(
                period.getYear(),
                period.getMonthValue(),
                range.label(),
                salarySummary,
                expenseSummary,
                loanSummary,
                analytics.categories(),
                analytics.daily(),
                List.copyOf(expenseService.recent(userId, RECENT_EXPENSE_COUNT)));
    }
}
