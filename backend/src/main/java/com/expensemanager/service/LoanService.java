package com.expensemanager.service;

import com.expensemanager.dto.loan.EmiPaymentRequest;
import com.expensemanager.dto.loan.EmiPaymentResponse;
import com.expensemanager.dto.loan.LoanRequest;
import com.expensemanager.dto.loan.LoanResponse;
import com.expensemanager.entity.EmiPayment;
import com.expensemanager.entity.Loan;
import com.expensemanager.entity.LoanStatus;
import com.expensemanager.entity.User;
import com.expensemanager.exception.BadRequestException;
import com.expensemanager.exception.ResourceNotFoundException;
import com.expensemanager.mapper.LoanMapper;
import com.expensemanager.repository.EmiPaymentRepository;
import com.expensemanager.repository.LoanRepository;
import com.expensemanager.security.CurrentUser;
import com.expensemanager.util.Money;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * Loans and their instalments. Payment rows are append-only; the loan balance is always
 * recomputed as original minus the sum of payments, so editing or deleting one payment
 * corrects the balance without losing the rest of the history.
 */
@Service
public class LoanService {

    private final LoanRepository loanRepository;
    private final EmiPaymentRepository paymentRepository;
    private final LoanMapper loanMapper;
    private final CurrentUser currentUser;

    public LoanService(LoanRepository loanRepository,
                       EmiPaymentRepository paymentRepository,
                       LoanMapper loanMapper,
                       CurrentUser currentUser) {
        this.loanRepository = loanRepository;
        this.paymentRepository = paymentRepository;
        this.loanMapper = loanMapper;
        this.currentUser = currentUser;
    }

    @Transactional(readOnly = true)
    public List<LoanResponse> list() {
        return loanRepository.findByUserIdOrderByStatusAscNameAsc(currentUser.id()).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public LoanResponse get(Long id) {
        return toResponse(requireOwned(id));
    }

    @Transactional
    public LoanResponse create(LoanRequest request) {
        User user = currentUser.entity();
        validateDates(request);

        Loan loan = new Loan(
                user,
                request.name().trim(),
                Money.scale(request.originalAmount()),
                Money.scale(request.monthlyEmi()),
                request.interestRate(),
                request.startDate() == null ? LocalDate.now() : request.startDate(),
                request.endDate());

        return toResponse(loanRepository.save(loan));
    }

    @Transactional
    public LoanResponse update(Long id, LoanRequest request) {
        Loan loan = requireOwned(id);
        validateDates(request);

        BigDecimal paid = paymentRepository.sumPaidForLoan(id);
        BigDecimal newOriginal = Money.scale(request.originalAmount());
        if (newOriginal.compareTo(Money.scale(paid)) < 0) {
            throw new BadRequestException(
                    "The loan amount cannot be less than the " + Money.scale(paid) + " already paid");
        }

        loan.setName(request.name().trim());
        loan.setOriginalAmount(newOriginal);
        loan.setMonthlyEmi(Money.scale(request.monthlyEmi()));
        loan.setInterestRate(request.interestRate());
        if (request.startDate() != null) {
            loan.setStartDate(request.startDate());
        }
        loan.setEndDate(request.endDate());
        recalculate(loan, paid);

        return toResponse(loanRepository.save(loan));
    }

    @Transactional
    public void delete(Long id) {
        Loan loan = requireOwned(id);
        // Payments are meaningless without their loan, so they go with it.
        paymentRepository.deleteAll(paymentRepository.findByLoanIdOrderByPaymentDateDescIdDesc(id));
        loanRepository.delete(loan);
    }

    @Transactional(readOnly = true)
    public List<EmiPaymentResponse> payments(Long loanId) {
        requireOwned(loanId);
        return paymentRepository.findByLoanIdOrderByPaymentDateDescIdDesc(loanId).stream()
                .map(loanMapper::toResponse)
                .toList();
    }

    @Transactional
    public EmiPaymentResponse addPayment(Long loanId, EmiPaymentRequest request) {
        Loan loan = requireOwned(loanId);
        BigDecimal amount = Money.scale(request.amount());

        BigDecimal alreadyPaid = Money.scale(paymentRepository.sumPaidForLoan(loanId));
        BigDecimal outstanding = Money.subtract(loan.getOriginalAmount(), alreadyPaid);
        if (amount.compareTo(outstanding) > 0) {
            throw new BadRequestException(
                    "That payment is more than the " + outstanding + " still outstanding on this loan");
        }

        EmiPayment payment = new EmiPayment(
                loan,
                amount,
                request.paymentDate() == null ? LocalDate.now() : request.paymentDate(),
                blankToNull(request.description()));
        payment = paymentRepository.save(payment);

        recalculate(loan, Money.add(alreadyPaid, amount));
        loanRepository.save(loan);

        return loanMapper.toResponse(payment);
    }

    @Transactional
    public EmiPaymentResponse updatePayment(Long loanId, Long paymentId, EmiPaymentRequest request) {
        Loan loan = requireOwned(loanId);
        EmiPayment payment = paymentRepository.findByIdAndLoanId(paymentId, loanId)
                .orElseThrow(() -> new ResourceNotFoundException("Payment " + paymentId + " not found"));

        BigDecimal newAmount = Money.scale(request.amount());
        BigDecimal paidExcludingThis = Money.subtract(
                paymentRepository.sumPaidForLoan(loanId), payment.getAmount());
        BigDecimal outstanding = Money.subtract(loan.getOriginalAmount(), paidExcludingThis);
        if (newAmount.compareTo(outstanding) > 0) {
            throw new BadRequestException(
                    "That payment is more than the " + outstanding + " still outstanding on this loan");
        }

        payment.setAmount(newAmount);
        if (request.paymentDate() != null) {
            payment.setPaymentDate(request.paymentDate());
        }
        payment.setDescription(blankToNull(request.description()));
        payment = paymentRepository.save(payment);

        recalculate(loan, Money.add(paidExcludingThis, newAmount));
        loanRepository.save(loan);

        return loanMapper.toResponse(payment);
    }

    @Transactional
    public void deletePayment(Long loanId, Long paymentId) {
        Loan loan = requireOwned(loanId);
        EmiPayment payment = paymentRepository.findByIdAndLoanId(paymentId, loanId)
                .orElseThrow(() -> new ResourceNotFoundException("Payment " + paymentId + " not found"));

        BigDecimal remainingPaid = Money.subtract(
                paymentRepository.sumPaidForLoan(loanId), payment.getAmount());
        paymentRepository.delete(payment);

        recalculate(loan, remainingPaid);
        loanRepository.save(loan);
    }

    /** Single place where the balance and status are derived from the payment total. */
    private void recalculate(Loan loan, BigDecimal totalPaid) {
        BigDecimal remaining = Money.atLeastZero(Money.subtract(loan.getOriginalAmount(), totalPaid));
        loan.setRemainingAmount(remaining);
        loan.setStatus(Money.isPositive(remaining) ? LoanStatus.ACTIVE : LoanStatus.CLOSED);
    }

    private LoanResponse toResponse(Loan loan) {
        BigDecimal paid = paymentRepository.sumPaidForLoan(loan.getId());
        long count = paymentRepository.findByLoanIdOrderByPaymentDateDescIdDesc(loan.getId()).size();
        return loanMapper.toResponse(loan, paid, count);
    }

    private void validateDates(LoanRequest request) {
        if (request.startDate() != null && request.endDate() != null
                && request.endDate().isBefore(request.startDate())) {
            throw new BadRequestException("The end date cannot be before the start date");
        }
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    Loan requireOwned(Long id) {
        return loanRepository.findByIdAndUserId(id, currentUser.id())
                .orElseThrow(() -> new ResourceNotFoundException("Loan " + id + " not found"));
    }
}
