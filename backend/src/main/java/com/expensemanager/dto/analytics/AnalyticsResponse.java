package com.expensemanager.dto.analytics;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record AnalyticsResponse(
        String rangeLabel,
        LocalDate from,
        LocalDate to,
        BigDecimal totalExpenses,
        BigDecimal totalEmiPaid,
        /** Expenses plus EMI payments. */
        BigDecimal totalDeductions,
        BigDecimal salary,
        BigDecimal remainingAmount,
        long transactionCount,
        BigDecimal averagePerDay,
        BigDecimal highestDayAmount,
        LocalDate highestDay,
        List<CategorySpendResponse> categories,
        List<DailySpendResponse> daily
) {}
