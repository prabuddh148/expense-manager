package com.expensemanager.controller;

import com.expensemanager.dto.cycle.CycleResetRequest;
import com.expensemanager.dto.cycle.CycleResponse;
import com.expensemanager.dto.cycle.CycleTargetRequest;
import com.expensemanager.service.BudgetCycleService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/cycle")
public class CycleController {

    private final BudgetCycleService cycleService;

    public CycleController(BudgetCycleService cycleService) {
        this.cycleService = cycleService;
    }

    @GetMapping
    public CycleResponse current() {
        return cycleService.current();
    }

    @PutMapping("/target")
    public CycleResponse setTarget(@Valid @RequestBody CycleTargetRequest request) {
        return cycleService.setTarget(request);
    }

    /** Salary day: a new cycle from the given date with fresh category budgets. */
    @PostMapping("/reset")
    public CycleResponse reset(@Valid @RequestBody CycleResetRequest request) {
        return cycleService.reset(request);
    }
}
