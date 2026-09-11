package com.expensemanager.service;

import com.expensemanager.dto.salary.SalaryRequest;
import com.expensemanager.dto.salary.SalaryResponse;
import com.expensemanager.entity.Salary;
import com.expensemanager.entity.User;
import com.expensemanager.exception.ResourceNotFoundException;
import com.expensemanager.repository.EmiPaymentRepository;
import com.expensemanager.repository.ExpenseRepository;
import com.expensemanager.repository.SalaryAdjustmentRepository;
import com.expensemanager.repository.SalaryRepository;
import com.expensemanager.security.CurrentUser;
import com.expensemanager.security.FeatureVisibility;
import com.expensemanager.util.DateRanges;
import com.expensemanager.util.Money;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;

/**
 * The salary is the parent balance for a month: expenses and EMI payments recorded inside the
 * month are subtracted from it to give the remaining amount the dashboard shows.
 */
@Service
public class SalaryService {

    private final SalaryRepository salaryRepository;
    private final ExpenseRepository expenseRepository;
    private final EmiPaymentRepository emiPaymentRepository;
    private final SalaryAdjustmentRepository salaryAdjustmentRepository;
    private final CurrentUser currentUser;
    private final FeatureVisibility visibility;

    public SalaryService(SalaryRepository salaryRepository,
                         ExpenseRepository expenseRepository,
                         EmiPaymentRepository emiPaymentRepository,
                         SalaryAdjustmentRepository salaryAdjustmentRepository,
                         CurrentUser currentUser,
                         FeatureVisibility visibility) {
        this.salaryRepository = salaryRepository;
        this.expenseRepository = expenseRepository;
        this.emiPaymentRepository = emiPaymentRepository;
        this.salaryAdjustmentRepository = salaryAdjustmentRepository;
        this.currentUser = currentUser;
        this.visibility = visibility;
    }

    /** Returns the salary for a month, or a zeroed placeholder when the user has not set one. */
    @Transactional(readOnly = true)
    public SalaryResponse get(Integer year, Integer month) {
        YearMonth period = periodOrCurrent(year, month);
        Long userId = currentUser.id();
        return salaryRepository
                .findByUserIdAndPeriodYearAndPeriodMonth(userId, period.getYear(), period.getMonthValue())
                .map(this::toResponse)
                .orElseGet(() -> emptyResponse(period));
    }

    @Transactional(readOnly = true)
    public List<SalaryResponse> history() {
        return salaryRepository.findByUserIdOrderByPeriodYearDescPeriodMonthDesc(currentUser.id())
                .stream()
                .map(this::toResponse)
                .toList();
    }

    /** Upsert: one salary row per user per month, so posting twice updates rather than duplicates. */
    @Transactional
    public SalaryResponse save(SalaryRequest request) {
        User user = currentUser.entity();
        YearMonth period = periodOrCurrent(request.year(), request.month());

        Salary salary = salaryRepository
                .findByUserIdAndPeriodYearAndPeriodMonth(user.getId(), period.getYear(), period.getMonthValue())
                .orElseGet(() -> new Salary(user, BigDecimal.ZERO, period.getYear(), period.getMonthValue()));

        salary.setAmount(Money.scale(request.amount()));
        salary.setTargetAmount(request.targetAmount() == null ? null : Money.scale(request.targetAmount()));
        salary.setTargetDate(request.targetDate());

        return toResponse(salaryRepository.save(salary));
    }

    @Transactional
    public SalaryResponse update(Long id, SalaryRequest request) {
        Salary salary = salaryRepository.findByIdAndUserId(id, currentUser.id())
                .orElseThrow(() -> new ResourceNotFoundException("Salary " + id + " not found"));

        salary.setAmount(Money.scale(request.amount()));
        salary.setTargetAmount(request.targetAmount() == null ? null : Money.scale(request.targetAmount()));
        salary.setTargetDate(request.targetDate());

        return toResponse(salaryRepository.save(salary));
    }

    /** Amount for a month, or zero. Used by the dashboard and analytics services. */
    @Transactional(readOnly = true)
    public BigDecimal amountFor(Long userId, int year, int month) {
        return salaryRepository.findByUserIdAndPeriodYearAndPeriodMonth(userId, year, month)
                .map(salary -> Money.scale(salary.getAmount()))
                .orElse(Money.ZERO);
    }

    private YearMonth periodOrCurrent(Integer year, Integer month) {
        if (year == null || month == null) {
            return YearMonth.now();
        }
        return YearMonth.of(year, month);
    }

    private SalaryResponse emptyResponse(YearMonth period) {
        return new SalaryResponse(null, Money.ZERO, null, null,
                period.getYear(), period.getMonthValue(),
                null, Money.ZERO, Money.ZERO, Money.ZERO, Money.ZERO, null);
    }

    private SalaryResponse toResponse(Salary salary) {
        DateRanges.Range range = DateRanges.ofMonth(salary.getPeriodYear(), salary.getPeriodMonth());
        Long userId = salary.getUser().getId();
        BigDecimal deductions = deductionsFor(userId, range.from(), range.to());
        BigDecimal additions = additionsFor(userId, range.from(), range.to());
        BigDecimal amount = Money.scale(salary.getAmount());
        BigDecimal target = salary.getTargetAmount() == null ? null : Money.scale(salary.getTargetAmount());

        return new SalaryResponse(
                salary.getId(),
                amount,
                target,
                salary.getTargetDate(),
                salary.getPeriodYear(),
                salary.getPeriodMonth(),
                // The target is about the salary itself, so one-off additions do not
                // count towards it - only a real raise moves that needle.
                target == null ? null : Money.subtract(target, amount),
                target == null ? Money.ZERO : Money.cappedPercentage(amount, target),
                deductions,
                additions,
                Money.subtract(Money.add(amount, additions), deductions),
                salary.getUpdatedAt());
    }

    /**
     * Money credited on top of the salary in the window, e.g. a repayment received. All of
     * it comes from the Money Tracker, so it goes when that section is switched off.
     */
    public BigDecimal additionsFor(Long userId, LocalDate from, LocalDate to) {
        if (!visibility.salaryAdditionsVisible()) {
            return Money.ZERO;
        }
        return Money.scale(salaryAdjustmentRepository.sumForUserBetween(userId, from, to));
    }

    /** Expenses plus EMI instalments paid in the window, less any section switched off. */
    public BigDecimal deductionsFor(Long userId, LocalDate from, LocalDate to) {
        BigDecimal emi = visibility.emiVisible()
                ? emiPaymentRepository.sumPaidForUserBetween(userId, from, to)
                : Money.ZERO;
        return Money.add(
                expenseRepository.sumForUserBetween(userId, from, to, visibility.expenseSources()),
                emi);
    }
}
