package com.expensemanager.controller;

import com.expensemanager.dto.planner.SalaryPlannerItemRequest;
import com.expensemanager.dto.planner.SalaryPlannerRequest;
import com.expensemanager.dto.planner.SalaryPlannerResponse;
import com.expensemanager.service.SalaryPlannerService;
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
@RequestMapping("/api/salary-planner")
public class SalaryPlannerController {

    private final SalaryPlannerService plannerService;

    public SalaryPlannerController(SalaryPlannerService plannerService) {
        this.plannerService = plannerService;
    }

    @GetMapping
    public List<SalaryPlannerResponse> list() {
        return plannerService.list();
    }

    @GetMapping("/{id}")
    public SalaryPlannerResponse get(@PathVariable Long id) {
        return plannerService.get(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public SalaryPlannerResponse create(@Valid @RequestBody SalaryPlannerRequest request) {
        return plannerService.create(request);
    }

    @PutMapping("/{id}")
    public SalaryPlannerResponse update(@PathVariable Long id,
                                        @Valid @RequestBody SalaryPlannerRequest request) {
        return plannerService.update(id, request);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        plannerService.delete(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/items")
    @ResponseStatus(HttpStatus.CREATED)
    public SalaryPlannerResponse addItem(@PathVariable Long id,
                                         @Valid @RequestBody SalaryPlannerItemRequest request) {
        return plannerService.addItem(id, request);
    }

    @PutMapping("/{id}/items/{itemId}")
    public SalaryPlannerResponse updateItem(@PathVariable Long id,
                                            @PathVariable Long itemId,
                                            @Valid @RequestBody SalaryPlannerItemRequest request) {
        return plannerService.updateItem(id, itemId, request);
    }

    @DeleteMapping("/{id}/items/{itemId}")
    public SalaryPlannerResponse deleteItem(@PathVariable Long id, @PathVariable Long itemId) {
        return plannerService.deleteItem(id, itemId);
    }
}
