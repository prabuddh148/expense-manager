package com.expensemanager.dto.analytics;

import java.math.BigDecimal;
import java.time.LocalDate;

public record DailySpendResponse(LocalDate date, BigDecimal amount) {}
