package com.expensemanager.util;

import com.expensemanager.exception.BadRequestException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class DateRangesTest {

    // A Thursday, so the week boundaries are unambiguous.
    private static final LocalDate TODAY = LocalDate.of(2026, 9, 3);

    @Test
    @DisplayName("this week runs Monday to Sunday around today")
    void thisWeek() {
        DateRanges.Range range = DateRanges.resolve("this_week", null, null, TODAY);

        assertThat(range.from()).isEqualTo(LocalDate.of(2026, 8, 31));
        assertThat(range.to()).isEqualTo(LocalDate.of(2026, 9, 6));
        assertThat(range.days()).isEqualTo(7);
    }

    @Test
    @DisplayName("last month covers the whole previous calendar month")
    void lastMonth() {
        DateRanges.Range range = DateRanges.resolve("last_month", null, null, TODAY);

        assertThat(range.from()).isEqualTo(LocalDate.of(2026, 8, 1));
        assertThat(range.to()).isEqualTo(LocalDate.of(2026, 8, 31));
    }

    @Test
    @DisplayName("a custom range needs both ends and rejects a backwards window")
    void customValidation() {
        assertThatThrownBy(() -> DateRanges.resolve("custom", TODAY, null, TODAY))
                .isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> DateRanges.resolve("custom", TODAY, TODAY.minusDays(1), TODAY))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    @DisplayName("an unknown period name is rejected")
    void unknownPeriod() {
        assertThatThrownBy(() -> DateRanges.resolve("last_decade", null, null, TODAY))
                .isInstanceOf(BadRequestException.class);
    }
}
