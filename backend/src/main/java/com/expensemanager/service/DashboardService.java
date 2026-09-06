package com.expensemanager.service;

import com.expensemanager.dto.analytics.AnalyticsResponse;
import com.expensemanager.dto.dashboard.DashboardResponse;
import com.expensemanager.entity.Category;
import com.expensemanager.entity.LoanStatus;
import com.expensemanager.entity.Salary;
import com.expensemanager.repository.CategoryRepository;
import com.expensemanager.repository.EmiPaymentRepository;
import com.expensemanager.repository.LoanRepository;
import com.expensemanager.repository.SalaryRepository;
import com.expensemanager.security.CurrentUser;
import com.expensemanager.util.DateRanges;
import com.expensemanager.util.Money;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.YearMonth;
import java.util.List;
import java.util.Optional;

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
    private final CurrentUser currentUser;

    public DashboardService(SalaryRepository salaryRepository,
                            CategoryRepository categoryRepository,
                            LoanRepository loanRepository,
                            EmiPaymentRepository paymentRepository,
                            ExpenseService expenseService,
                            AnalyticsService analyticsService,
                            CurrentUser currentUser) {
        this.salaryRepository = salaryRepository;
        this.categoryRepository = categoryRepository;
        this.loanRepository = loanRepository;
        this.paymentRepository = paymentRepository;
        this.expenseService = expenseService;
        this.analyticsService = analyticsService;
        this.currentUser = currentUser;
    }

    @Transactional(readOnly = true)
    public DashboardResponse get(Integer year, Integer month) {
        Long userId = currentUser.id();
        YearMonth period = (year == null || month == null) ? YearMonth.now() : YearMonth.of(year, month);
        DateRanges.Range range = DateRanges.ofMonth(period.getYear(), period.getMonthValue());

        AnalyticsResponse analytics = analyticsService.build(userId, range);

        Optional<Salary> salary = salaryRepository.findByUserIdAndPeriodYearAndPeriodMonth(
                userId, period.getYear(), period.getMonthValue());
        BigDecimal salaryAmount = salary.map(s -> Money.scale(s.getAmount())).orElse(Money.ZERO);
        BigDecimal target = salary.map(Salary::getTargetAmount).map(Money::scale).orElse(null);

        var salarySummary = new DashboardResponse.SalarySummary(
                salaryAmount,
                target,
                target == null ? null : Money.subtract(target, salaryAmount),
                target == null ? Money.ZERO : Money.cappedPercentage(salaryAmount, target),
                salary.map(Salary::getTargetDate).orElse(null),
                analytics.totalDeductions(),
                Money.subtract(salaryAmount, analytics.totalDeductions()));

        BigDecimal budgeted = categoryRepository.findByUserIdOrderByNameAsc(userId).stream()
                .map(Category::getAllocatedAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

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
