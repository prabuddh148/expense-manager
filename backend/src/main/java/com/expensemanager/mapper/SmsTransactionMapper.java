package com.expensemanager.mapper;

import com.expensemanager.dto.sms.SmsTransactionResponse;
import com.expensemanager.entity.Category;
import com.expensemanager.entity.SmsTransaction;
import com.expensemanager.entity.SmsTransactionStatus;
import com.expensemanager.entity.SmsTransactionType;
import com.expensemanager.util.Money;
import org.springframework.stereotype.Component;

@Component
public class SmsTransactionMapper {

    public SmsTransactionResponse toResponse(SmsTransaction transaction) {
        Category category = transaction.getCategory();

        return new SmsTransactionResponse(
                transaction.getId(),
                transaction.getBankName(),
                transaction.getAccountIdentifier(),
                Money.scale(transaction.getAmount()),
                transaction.getTransactionType(),
                transaction.getTransactionDate(),
                transaction.getTransactionTime(),
                transaction.getMerchant(),
                transaction.getSmsReference(),
                category != null ? category.getId() : null,
                category != null ? category.getName() : null,
                category != null ? category.getColor() : null,
                category != null ? category.getIcon() : null,
                transaction.getStatus(),
                transaction.getLinkedExpenseId(),
                readyForExpense(transaction),
                transaction.getCreatedAt(),
                transaction.getProcessedAt());
    }

    /**
     * Only a categorised debit can become an expense. Credits are shown for completeness
     * but there is nothing sensible to file them as.
     */
    private boolean readyForExpense(SmsTransaction transaction) {
        return transaction.getCategory() != null
                && transaction.getStatus() == SmsTransactionStatus.CATEGORIZED
                && transaction.getTransactionType() == SmsTransactionType.DEBIT;
    }
}
