package com.expensemanager.controller;

import com.expensemanager.dto.salary.SalaryRequest;
import com.expensemanager.dto.salary.SalaryResponse;
import com.expensemanager.service.SalaryService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/salary")
public class SalaryController {

    private final SalaryService salaryService;

    public SalaryController(SalaryService salaryService) {
        this.salaryService = salaryService;
    }

    @GetMapping
    public SalaryResponse get(@RequestParam(required = false) Integer year,
                              @RequestParam(required = false) Integer month) {
        return salaryService.get(year, month);
    }

    @GetMapping("/history")
    public List<SalaryResponse> history() {
        return salaryService.history();
    }

    @PostMapping
    public SalaryResponse save(@Valid @RequestBody SalaryRequest request) {
        return salaryService.save(request);
    }

    @PutMapping("/{id}")
    public SalaryResponse update(@PathVariable Long id, @Valid @RequestBody SalaryRequest request) {
        return salaryService.update(id, request);
    }
}
