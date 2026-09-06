package com.expensemanager.util;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * Every monetary value in the API is a BigDecimal scaled to 2 decimals with HALF_UP rounding.
 * Percentages are also BigDecimal so nothing in the money path ever touches a float.
 */
public final class Money {

    public static final BigDecimal ZERO = BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
    public static final BigDecimal HUNDRED = new BigDecimal("100");

    private static final int MONEY_SCALE = 2;
    private static final int PERCENT_SCALE = 2;

    private Money() {
    }

    /** Null-safe normalisation to 2 decimals. Null becomes 0.00. */
    public static BigDecimal scale(BigDecimal value) {
        return value == null ? ZERO : value.setScale(MONEY_SCALE, RoundingMode.HALF_UP);
    }

    public static BigDecimal add(BigDecimal a, BigDecimal b) {
        return scale(nullToZero(a).add(nullToZero(b)));
    }

    public static BigDecimal subtract(BigDecimal a, BigDecimal b) {
        return scale(nullToZero(a).subtract(nullToZero(b)));
    }

    public static BigDecimal nullToZero(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    public static boolean isPositive(BigDecimal value) {
        return value != null && value.compareTo(BigDecimal.ZERO) > 0;
    }

    public static boolean isNegative(BigDecimal value) {
        return value != null && value.compareTo(BigDecimal.ZERO) < 0;
    }

    /** Clamps a value at zero, used for remaining balances that must not go negative. */
    public static BigDecimal atLeastZero(BigDecimal value) {
        return isNegative(value) ? ZERO : scale(value);
    }

    /**
     * part / total as a percentage, 2 decimals. A zero or null total yields 0.00 rather than
     * blowing up, which is what an empty dashboard needs.
     */
    public static BigDecimal percentage(BigDecimal part, BigDecimal total) {
        if (total == null || total.compareTo(BigDecimal.ZERO) == 0) {
            return BigDecimal.ZERO.setScale(PERCENT_SCALE, RoundingMode.HALF_UP);
        }
        return nullToZero(part)
                .multiply(HUNDRED)
                .divide(total, PERCENT_SCALE, RoundingMode.HALF_UP);
    }

    /** Same as {@link #percentage} but never above 100, for progress bars. */
    public static BigDecimal cappedPercentage(BigDecimal part, BigDecimal total) {
        BigDecimal percentage = percentage(part, total);
        return percentage.compareTo(HUNDRED) > 0 ? HUNDRED.setScale(PERCENT_SCALE) : percentage;
    }

    /** Divides for averages, guarding against a zero divisor. */
    public static BigDecimal divide(BigDecimal value, long divisor) {
        if (divisor <= 0) {
            return ZERO;
        }
        return nullToZero(value).divide(BigDecimal.valueOf(divisor), MONEY_SCALE, RoundingMode.HALF_UP);
    }
}
