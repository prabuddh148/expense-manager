package com.expensemanager.dto.sms;

import java.math.BigDecimal;

/** One entry in the dynamically built bank filter row. */
public record SmsBankSummary(
        String bank,
        long total,
        long uncategorized,
        BigDecimal debitTotal,
        BigDecimal creditTotal
) {}
