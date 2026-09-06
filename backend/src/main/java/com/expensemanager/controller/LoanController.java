package com.expensemanager.controller;

import com.expensemanager.dto.loan.EmiPaymentRequest;
import com.expensemanager.dto.loan.EmiPaymentResponse;
import com.expensemanager.dto.loan.LoanRequest;
import com.expensemanager.dto.loan.LoanResponse;
import com.expensemanager.service.LoanService;
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
@RequestMapping("/api/loans")
public class LoanController {

    private final LoanService loanService;

    public LoanController(LoanService loanService) {
        this.loanService = loanService;
    }

    @GetMapping
    public List<LoanResponse> list() {
        return loanService.list();
    }

    @GetMapping("/{id}")
    public LoanResponse get(@PathVariable Long id) {
        return loanService.get(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public LoanResponse create(@Valid @RequestBody LoanRequest request) {
        return loanService.create(request);
    }

    @PutMapping("/{id}")
    public LoanResponse update(@PathVariable Long id, @Valid @RequestBody LoanRequest request) {
        return loanService.update(id, request);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        loanService.delete(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{loanId}/payments")
    public List<EmiPaymentResponse> payments(@PathVariable Long loanId) {
        return loanService.payments(loanId);
    }

    @PostMapping("/{loanId}/payments")
    @ResponseStatus(HttpStatus.CREATED)
    public EmiPaymentResponse addPayment(@PathVariable Long loanId,
                                         @Valid @RequestBody EmiPaymentRequest request) {
        return loanService.addPayment(loanId, request);
    }

    @PutMapping("/{loanId}/payments/{paymentId}")
    public EmiPaymentResponse updatePayment(@PathVariable Long loanId,
                                            @PathVariable Long paymentId,
                                            @Valid @RequestBody EmiPaymentRequest request) {
        return loanService.updatePayment(loanId, paymentId, request);
    }

    @DeleteMapping("/{loanId}/payments/{paymentId}")
    public ResponseEntity<Void> deletePayment(@PathVariable Long loanId, @PathVariable Long paymentId) {
        loanService.deletePayment(loanId, paymentId);
        return ResponseEntity.noContent().build();
    }
}
