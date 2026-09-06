package com.expensemanager.util;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;

class MoneyTest {

    @Test
    @DisplayName("scales to two decimals and treats null as zero")
    void scales() {
        assertThat(Money.scale(new BigDecimal("1500"))).isEqualByComparingTo("1500.00");
        assertThat(Money.scale(new BigDecimal("10.005"))).isEqualByComparingTo("10.01");
        assertThat(Money.scale(null)).isEqualByComparingTo("0.00");
    }

    @Test
    @DisplayName("adds and subtracts without floating point drift")
    void arithmetic() {
        BigDecimal salary = new BigDecimal("45000.00");
        BigDecimal spent = Money.add(new BigDecimal("0.1"), new BigDecimal("0.2"));

        assertThat(spent).isEqualByComparingTo("0.30");
        assertThat(Money.subtract(salary, new BigDecimal("500"))).isEqualByComparingTo("44500.00");
    }

    @Test
    @DisplayName("percentage of a zero total is zero rather than an error")
    void percentageGuardsAgainstZero() {
        assertThat(Money.percentage(new BigDecimal("100"), BigDecimal.ZERO)).isEqualByComparingTo("0.00");
        assertThat(Money.percentage(new BigDecimal("45000"), new BigDecimal("100000")))
                .isEqualByComparingTo("45.00");
    }

    @Test
    @DisplayName("capped percentage never exceeds 100 for progress bars")
    void cappedPercentage() {
        assertThat(Money.cappedPercentage(new BigDecimal("4000"), new BigDecimal("3500")))
                .isEqualByComparingTo("100.00");
        assertThat(Money.percentage(new BigDecimal("4000"), new BigDecimal("3500")))
                .isEqualByComparingTo("114.29");
    }

    @Test
    @DisplayName("remaining balances clamp at zero")
    void atLeastZero() {
        assertThat(Money.atLeastZero(new BigDecimal("-25.00"))).isEqualByComparingTo("0.00");
        assertThat(Money.atLeastZero(new BigDecimal("25.00"))).isEqualByComparingTo("25.00");
    }

    @Test
    @DisplayName("averages guard against a zero divisor")
    void divide() {
        assertThat(Money.divide(new BigDecimal("700"), 7)).isEqualByComparingTo("100.00");
        assertThat(Money.divide(new BigDecimal("700"), 0)).isEqualByComparingTo("0.00");
    }
}
