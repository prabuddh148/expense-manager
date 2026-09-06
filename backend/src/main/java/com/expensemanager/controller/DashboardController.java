package com.expensemanager.controller;

import com.expensemanager.dto.dashboard.DashboardResponse;
import com.expensemanager.service.DashboardService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/dashboard")
public class DashboardController {

    private final DashboardService dashboardService;

    public DashboardController(DashboardService dashboardService) {
        this.dashboardService = dashboardService;
    }

    @GetMapping
    public DashboardResponse get(@RequestParam(required = false) Integer year,
                                 @RequestParam(required = false) Integer month) {
        return dashboardService.get(year, month);
    }
}
