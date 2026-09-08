package com.expensemanager.dto.sms;

import com.expensemanager.entity.SmsTransactionType;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;

/**
 * A transaction the device recognised in an SMS.
 *
 * Note what is absent: the message body. Parsing happens on the phone and only these
 * fields are sent, so no one's inbox ends up on the server. {@code dedupeHash} is
 * computed on the device from the parts of the message that identify it; when it is
 * missing the server derives one from the fields below.
 */
public record SmsTransactionRequest(
        @NotBlank @Size(max = 60) String bankName,
        @Size(max = 40) String accountIdentifier,
        @NotNull @DecimalMin(value = "0.01", message = "Amount must be greater than zero")
        BigDecimal amount,
        @NotNull SmsTransactionType transactionType,
        @NotNull LocalDate transactionDate,
        LocalTime transactionTime,
        @Size(max = 120) String merchant,
        @Size(max = 120) String smsReference,
        @Size(max = 64) String dedupeHash
) {}
