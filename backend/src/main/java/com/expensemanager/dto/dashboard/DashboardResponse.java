package com.expensemanager.dto.dashboard;

import com.expensemanager.dto.analytics.CategorySpendResponse;
import com.expensemanager.dto.analytics.DailySpendResponse;
import com.expensemanager.dto.expense.ExpenseResponse;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/** Everything the dashboard tab needs, in one round trip. */
public record DashboardResponse(
        int year,
        int month,
        String monthLabel,
        SalarySummary salary,
        ExpenseSummary expenses,
        LoanSummary loans,
        List<CategorySpendResponse> categoryBreakdown,
        List<DailySpendResponse> dailyTrend,
        List<ExpenseResponse> recentExpenses
) {
    public record SalarySummary(
            BigDecimal amount,
            BigDecimal totalDeductions,
            BigDecimal totalAdditions,
            BigDecimal remainingAmount,
            /** First day of the window: salary day for a cycle, the 1st for a calendar month. */
            LocalDate periodStart,
            /** Sum of the category budgets. */
            BigDecimal allocatedTotal
    ) {}

    public record ExpenseSummary(
            BigDecimal totalSpent,
            BigDecimal totalBudgeted,
            BigDecimal remainingBudget,
            long transactionCount,
            BigDecimal averagePerDay
    ) {}

    public record LoanSummary(
            BigDecimal totalOutstanding,
            BigDecimal totalOriginal,
            BigDecimal totalPaid,
            BigDecimal monthlyEmi,
            BigDecimal paidThisMonth,
            long activeLoans,
            BigDecimal progressPercentage
    ) {}
}
