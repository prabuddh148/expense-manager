package com.expensemanager.controller;

import com.expensemanager.dto.moneytracker.MoneyTrackerLinkRequest;
import com.expensemanager.dto.moneytracker.MoneyTrackerRequest;
import com.expensemanager.dto.moneytracker.MoneyTrackerResponse;
import com.expensemanager.dto.moneytracker.MoneyTrackerSummary;
import com.expensemanager.entity.MoneyTrackerStatus;
import com.expensemanager.service.MoneyTrackerService;
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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/money-tracker")
public class MoneyTrackerController {

    private final MoneyTrackerService moneyTrackerService;

    public MoneyTrackerController(MoneyTrackerService moneyTrackerService) {
        this.moneyTrackerService = moneyTrackerService;
    }

    @GetMapping
    public List<MoneyTrackerResponse> list(@RequestParam(required = false) MoneyTrackerStatus status) {
        return moneyTrackerService.list(status);
    }

    @GetMapping("/summary")
    public MoneyTrackerSummary summary() {
        return moneyTrackerService.summary();
    }

    @GetMapping("/{id}")
    public MoneyTrackerResponse get(@PathVariable Long id) {
        return moneyTrackerService.get(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public MoneyTrackerResponse create(@Valid @RequestBody MoneyTrackerRequest request) {
        return moneyTrackerService.create(request);
    }

    @PutMapping("/{id}")
    public MoneyTrackerResponse update(@PathVariable Long id,
                                       @Valid @RequestBody MoneyTrackerRequest request) {
        return moneyTrackerService.update(id, request);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        moneyTrackerService.delete(id);
        return ResponseEntity.noContent().build();
    }

    /** Marks the money as actually moved, or takes that back. */
    @PostMapping("/{id}/complete")
    public MoneyTrackerResponse complete(@PathVariable Long id,
                                         @RequestParam(defaultValue = "true") boolean completed) {
        return moneyTrackerService.complete(id, completed);
    }

    /** Pay -> creates an expense, which is what reduces the salary. */
    @PostMapping("/{id}/deduct")
    public MoneyTrackerResponse deduct(@PathVariable Long id,
                                       @RequestBody(required = false) MoneyTrackerLinkRequest request) {
        return moneyTrackerService.deduct(id, request);
    }

    /** Receive -> credits the month on top of the stated salary. */
    @PostMapping("/{id}/add-on")
    public MoneyTrackerResponse addOn(@PathVariable Long id) {
        return moneyTrackerService.addOn(id);
    }

    /** Reverses whichever of the two happened and returns the transaction to the list. */
    @PostMapping("/{id}/undo")
    public MoneyTrackerResponse undo(@PathVariable Long id) {
        return moneyTrackerService.undo(id);
    }
}
