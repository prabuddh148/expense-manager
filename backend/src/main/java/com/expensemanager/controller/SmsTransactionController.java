package com.expensemanager.controller;

import com.expensemanager.dto.sms.SmsBankSummary;
import com.expensemanager.dto.sms.SmsCategoryRequest;
import com.expensemanager.dto.sms.SmsImportResult;
import com.expensemanager.dto.sms.SmsTransactionRequest;
import com.expensemanager.dto.sms.SmsTransactionResponse;
import com.expensemanager.entity.SmsTransactionStatus;
import com.expensemanager.entity.SmsTransactionType;
import com.expensemanager.service.SmsTransactionService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
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
import java.util.Map;

@RestController
@RequestMapping("/api/sms-transactions")
@Validated
public class SmsTransactionController {

    /** A sane ceiling on one import, so a first full-inbox scan arrives in pages. */
    private static final int MAX_BATCH = 200;

    private final SmsTransactionService smsTransactionService;

    public SmsTransactionController(SmsTransactionService smsTransactionService) {
        this.smsTransactionService = smsTransactionService;
    }

    @GetMapping
    public List<SmsTransactionResponse> list(@RequestParam(required = false) String bank,
                                             @RequestParam(required = false) SmsTransactionStatus status,
                                             @RequestParam(required = false) SmsTransactionType type) {
        return smsTransactionService.list(bank, status, type);
    }

    /** The filter row, built from banks actually seen rather than a fixed list. */
    @GetMapping("/banks")
    public List<SmsBankSummary> banks() {
        return smsTransactionService.banks();
    }

    /** Drives the daily reminder and the badge on the tab. */
    @GetMapping("/pending-count")
    public Map<String, Long> pendingCount() {
        return Map.of("pending", smsTransactionService.pendingCount());
    }

    /** Everything the device parsed. Already-seen messages are counted, not rejected. */
    @PostMapping("/import")
    @ResponseStatus(HttpStatus.CREATED)
    public SmsImportResult importAll(
            @RequestBody @Valid @Size(max = MAX_BATCH, message = "Send at most 200 at a time")
            List<@Valid SmsTransactionRequest> requests) {
        return smsTransactionService.importAll(requests);
    }

    @PutMapping("/{id}/category")
    public SmsTransactionResponse categorise(@PathVariable Long id,
                                             @Valid @RequestBody SmsCategoryRequest request) {
        return smsTransactionService.categorise(id, request.categoryId());
    }

    @PostMapping("/{id}/add-to-expense")
    public SmsTransactionResponse addToExpense(@PathVariable Long id) {
        return smsTransactionService.addToExpense(id);
    }

    /** Not for me: keeps the row so the message is never detected again. */
    @PostMapping("/{id}/ignore")
    public SmsTransactionResponse ignore(@PathVariable Long id) {
        return smsTransactionService.ignore(id);
    }

    /** Forgets the record entirely, so a later rescan can pick the message up again. */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        smsTransactionService.delete(id);
        return ResponseEntity.noContent().build();
    }

    /** Clears everything that has not become an expense. */
    @DeleteMapping
    public Map<String, Integer> deleteAllPending() {
        return Map.of("deleted", smsTransactionService.deleteAllPending());
    }
}
