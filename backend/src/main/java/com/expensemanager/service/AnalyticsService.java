package com.expensemanager.service;

import com.expensemanager.dto.analytics.AnalyticsResponse;
import com.expensemanager.dto.analytics.CategorySpendResponse;
import com.expensemanager.dto.analytics.DailySpendResponse;
import com.expensemanager.repository.EmiPaymentRepository;
import com.expensemanager.repository.ExpenseRepository;
import com.expensemanager.repository.SalaryRepository;
import com.expensemanager.security.CurrentUser;
import com.expensemanager.util.DateRanges;
import com.expensemanager.util.Money;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.List;

/**
 * Reporting over an arbitrary window. Salary is prorated across the months the window touches
 * so that a week-long range is compared against a week of salary, not a whole month.
 */
@Service
public class AnalyticsService {

    private final ExpenseRepository expenseRepository;
    private final EmiPaymentRepository paymentRepository;
    private final SalaryRepository salaryRepository;
    private final CurrentUser currentUser;

    public AnalyticsService(ExpenseRepository expenseRepository,
                            EmiPaymentRepository paymentRepository,
                            SalaryRepository salaryRepository,
                            CurrentUser currentUser) {
        this.expenseRepository = expenseRepository;
        this.paymentRepository = paymentRepository;
        this.salaryRepository = salaryRepository;
        this.currentUser = currentUser;
    }

    @Transactional(readOnly = true)
    public AnalyticsResponse forPeriod(String period, LocalDate from, LocalDate to) {
        DateRanges.Range range = DateRanges.resolve(period, from, to, LocalDate.now());
        return build(currentUser.id(), range);
    }

    @Transactional(readOnly = true)
    public List<CategorySpendResponse> categoryBreakdown(String period, LocalDate from, LocalDate to) {
        DateRanges.Range range = DateRanges.resolve(period, from, to, LocalDate.now());
        return categories(currentUser.id(), range);
    }

    AnalyticsResponse build(Long userId, DateRanges.Range range) {
        BigDecimal expenses = Money.scale(
                expenseRepository.sumForUserBetween(userId, range.from(), range.to()));
        BigDecimal emiPaid = Money.scale(
                paymentRepository.sumPaidForUserBetween(userId, range.from(), range.to()));
        BigDecimal deductions = Money.add(expenses, emiPaid);
        BigDecimal salary = salaryForRange(userId, range);
        long transactions = expenseRepository.countForUserBetween(userId, range.from(), range.to());

        List<DailySpendResponse> daily = dailySeries(userId, range);
        DailySpendResponse highest = daily.stream()
                .max((a, b) -> a.amount().compareTo(b.amount()))
                .orElse(null);

        return new AnalyticsResponse(
                range.label(),
                range.from(),
                range.to(),
                expenses,
                emiPaid,
                deductions,
                salary,
                Money.subtract(salary, deductions),
                transactions,
                Money.divide(expenses, range.days()),
                highest == null ? Money.ZERO : highest.amount(),
                highest == null ? null : highest.date(),
                categories(userId, range),
                daily);
    }

    List<CategorySpendResponse> categories(Long userId, DateRanges.Range range) {
        List<ExpenseRepository.CategoryTotal> totals =
                expenseRepository.sumByCategoryBetween(userId, range.from(), range.to());
        BigDecimal grandTotal = totals.stream()
                .map(ExpenseRepository.CategoryTotal::getTotal)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        return totals.stream()
                .map(total -> new CategorySpendResponse(
                        total.getCategoryId(),
                        total.getCategoryName(),
                        total.getColor(),
                        Money.scale(total.getTotal()),
                        Money.percentage(total.getTotal(), grandTotal),
                        total.getTransactions()))
                .toList();
    }

    /** Zero-fills days with no spend so the line chart has no gaps. */
    private List<DailySpendResponse> dailySeries(Long userId, DateRanges.Range range) {
        List<ExpenseRepository.DailyTotal> rows =
                expenseRepository.sumByDayBetween(userId, range.from(), range.to());
        List<DailySpendResponse> series = new ArrayList<>();

        int index = 0;
        for (LocalDate day = range.from(); !day.isAfter(range.to()); day = day.plusDays(1)) {
            if (index < rows.size() && rows.get(index).getDay().isEqual(day)) {
                series.add(new DailySpendResponse(day, Money.scale(rows.get(index).getTotal())));
                index++;
            } else {
                series.add(new DailySpendResponse(day, Money.ZERO));
            }
        }
        return series;
    }

    /**
     * Salary is stored per month. For a window that covers part of a month we take that
     * month's salary times the fraction of the month the window covers, then sum.
     */
    private BigDecimal salaryForRange(Long userId, DateRanges.Range range) {
        BigDecimal total = BigDecimal.ZERO;
        YearMonth month = YearMonth.from(range.from());
        YearMonth last = YearMonth.from(range.to());

        while (!month.isAfter(last)) {
            BigDecimal monthly = salaryRepository
                    .findByUserIdAndPeriodYearAndPeriodMonth(userId, month.getYear(), month.getMonthValue())
                    .map(salary -> Money.scale(salary.getAmount()))
                    .orElse(BigDecimal.ZERO);

            if (monthly.signum() != 0) {
                LocalDate overlapStart = max(range.from(), month.atDay(1));
                LocalDate overlapEnd = min(range.to(), month.atEndOfMonth());
                long coveredDays = java.time.temporal.ChronoUnit.DAYS.between(overlapStart, overlapEnd) + 1;

                total = coveredDays >= month.lengthOfMonth()
                        ? total.add(monthly)
                        : total.add(monthly.multiply(BigDecimal.valueOf(coveredDays))
                                .divide(BigDecimal.valueOf(month.lengthOfMonth()), 2, java.math.RoundingMode.HALF_UP));
            }
            month = month.plusMonths(1);
        }
        return Money.scale(total);
    }

    private LocalDate max(LocalDate a, LocalDate b) {
        return a.isAfter(b) ? a : b;
    }

    private LocalDate min(LocalDate a, LocalDate b) {
        return a.isBefore(b) ? a : b;
    }
}
