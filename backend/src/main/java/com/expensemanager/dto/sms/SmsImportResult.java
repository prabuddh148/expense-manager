package com.expensemanager.dto.sms;

import java.util.List;

/**
 * What an import did. Skipped is the interesting number: it means the device offered
 * messages that had already been seen, which is the normal case on a rescan.
 */
public record SmsImportResult(
        int imported,
        int skipped,
        List<SmsTransactionResponse> transactions
) {}
