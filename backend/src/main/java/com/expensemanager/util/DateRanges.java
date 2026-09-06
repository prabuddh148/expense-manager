package com.expensemanager.util;

import com.expensemanager.exception.BadRequestException;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.TextStyle;
import java.time.temporal.TemporalAdjusters;
import java.util.Locale;

/** Resolves the analytics filter names the mobile app sends into concrete date windows. */
public final class DateRanges {

    private DateRanges() {
    }

    public record Range(LocalDate from, LocalDate to, String label) {

        public long days() {
            return java.time.temporal.ChronoUnit.DAYS.between(from, to) + 1;
        }
    }

    public static Range resolve(String period, LocalDate from, LocalDate to, LocalDate today) {
        String key = period == null || period.isBlank() ? "this_month" : period.trim().toLowerCase(Locale.ROOT);
        return switch (key) {
            case "this_week" -> weekOf(today, "This Week");
            case "last_week" -> weekOf(today.minusWeeks(1), "Last Week");
            case "this_month" -> monthOf(YearMonth.from(today), "This Month");
            case "last_month" -> monthOf(YearMonth.from(today).minusMonths(1), "Last Month");
            case "this_year" -> new Range(today.withDayOfYear(1),
                    today.withDayOfYear(today.lengthOfYear()), "This Year");
            case "custom" -> custom(from, to);
            default -> throw new BadRequestException(
                    "Unknown period '" + period + "'. Use this_week, last_week, this_month, last_month, this_year or custom.");
        };
    }

    private static Range custom(LocalDate from, LocalDate to) {
        if (from == null || to == null) {
            throw new BadRequestException("A custom range needs both 'from' and 'to' dates");
        }
        if (to.isBefore(from)) {
            throw new BadRequestException("'to' cannot be before 'from'");
        }
        return new Range(from, to, "Custom Range");
    }

    private static Range weekOf(LocalDate day, String label) {
        LocalDate start = day.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        return new Range(start, start.plusDays(6), label);
    }

    private static Range monthOf(YearMonth month, String label) {
        return new Range(month.atDay(1), month.atEndOfMonth(), label);
    }

    public static Range ofMonth(int year, int month) {
        YearMonth yearMonth = YearMonth.of(year, month);
        return new Range(yearMonth.atDay(1), yearMonth.atEndOfMonth(), monthLabel(year, month));
    }

    public static String monthLabel(int year, int month) {
        return YearMonth.of(year, month).getMonth()
                .getDisplayName(TextStyle.FULL, Locale.ENGLISH) + " " + year;
    }
}
