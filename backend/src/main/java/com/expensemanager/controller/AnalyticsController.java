package com.expensemanager.controller;

import com.expensemanager.dto.analytics.AnalyticsResponse;
import com.expensemanager.dto.analytics.CategorySpendResponse;
import com.expensemanager.service.AnalyticsService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/analytics")
public class AnalyticsController {

    private final AnalyticsService analyticsService;

    public AnalyticsController(AnalyticsService analyticsService) {
        this.analyticsService = analyticsService;
    }

    /** this_week or last_week. */
    @GetMapping("/weekly")
    public AnalyticsResponse weekly(@RequestParam(defaultValue = "this_week") String period) {
        return analyticsService.forPeriod(period, null, null);
    }

    /** this_month or last_month. */
    @GetMapping("/monthly")
    public AnalyticsResponse monthly(@RequestParam(defaultValue = "this_month") String period) {
        return analyticsService.forPeriod(period, null, null);
    }

    /** Any supported period, including custom with explicit from/to dates. */
    @GetMapping
    public AnalyticsResponse forPeriod(
            @RequestParam(defaultValue = "this_month") String period,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return analyticsService.forPeriod(period, from, to);
    }

    @GetMapping("/category")
    public List<CategorySpendResponse> category(
            @RequestParam(defaultValue = "this_month") String period,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return analyticsService.categoryBreakdown(period, from, to);
    }
}
