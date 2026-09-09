package com.expensemanager.controller;

import com.expensemanager.dto.savings.SavingsRequest;
import com.expensemanager.dto.savings.SavingsResponse;
import com.expensemanager.dto.savings.SavingsSummary;
import com.expensemanager.service.SavingsService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/savings")
public class SavingsController {

    private final SavingsService savingsService;

    public SavingsController(SavingsService savingsService) {
        this.savingsService = savingsService;
    }

    @GetMapping
    public List<SavingsResponse> list() {
        return savingsService.list();
    }

    /** Totals for the profile card, including the split by method. */
    @GetMapping("/summary")
    public SavingsSummary summary() {
        return savingsService.summary();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public SavingsResponse create(@Valid @RequestBody SavingsRequest request) {
        return savingsService.create(request);
    }

    @PutMapping("/{id}")
    public SavingsResponse update(@PathVariable Long id,
                                  @Valid @RequestBody SavingsRequest request) {
        return savingsService.update(id, request);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        savingsService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
