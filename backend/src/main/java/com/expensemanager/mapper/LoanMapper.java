package com.expensemanager.mapper;

import com.expensemanager.dto.loan.EmiPaymentResponse;
import com.expensemanager.dto.loan.LoanResponse;
import com.expensemanager.entity.EmiPayment;
import com.expensemanager.entity.Loan;
import com.expensemanager.util.Money;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;

@Component
public class LoanMapper {

    public LoanResponse toResponse(Loan loan, BigDecimal paid, long paymentCount) {
        BigDecimal original = Money.scale(loan.getOriginalAmount());
        BigDecimal paidAmount = Money.scale(paid);
        BigDecimal remaining = Money.scale(loan.getRemainingAmount());
        BigDecimal emi = Money.scale(loan.getMonthlyEmi());

        Integer instalmentsLeft = null;
        if (Money.isPositive(emi) && Money.isPositive(remaining)) {
            instalmentsLeft = remaining.divide(emi, 0, RoundingMode.CEILING).intValue();
        } else if (!Money.isPositive(remaining)) {
            instalmentsLeft = 0;
        }

        return new LoanResponse(
                loan.getId(),
                loan.getName(),
                original,
                remaining,
                paidAmount,
                emi,
                loan.getInterestRate(),
                loan.getStartDate(),
                loan.getEndDate(),
                loan.getStatus().name(),
                Money.cappedPercentage(paidAmount, original),
                paymentCount,
                instalmentsLeft);
    }

    public EmiPaymentResponse toResponse(EmiPayment payment) {
        return new EmiPaymentResponse(
                payment.getId(),
                payment.getLoan().getId(),
                payment.getLoan().getName(),
                Money.scale(payment.getAmount()),
                payment.getPaymentDate(),
                payment.getDescription(),
                payment.getCreatedAt());
    }
}
