package com.expensemanager.repository;

import com.expensemanager.entity.EmiPayment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface EmiPaymentRepository extends JpaRepository<EmiPayment, Long> {

    List<EmiPayment> findByLoanIdOrderByPaymentDateDescIdDesc(Long loanId);

    Optional<EmiPayment> findByIdAndLoanId(Long id, Long loanId);

    @Query("select coalesce(sum(p.amount), 0) from EmiPayment p where p.loan.id = :loanId")
    BigDecimal sumPaidForLoan(@Param("loanId") Long loanId);

    @Query("select coalesce(sum(p.amount), 0) from EmiPayment p where p.loan.user.id = :userId")
    BigDecimal sumPaidForUser(@Param("userId") Long userId);

    @Query("""
            select coalesce(sum(p.amount), 0)
            from EmiPayment p
            where p.loan.user.id = :userId and p.paymentDate between :from and :to
            """)
    BigDecimal sumPaidForUserBetween(@Param("userId") Long userId,
                                     @Param("from") LocalDate from,
                                     @Param("to") LocalDate to);

    @Query("""
            select p from EmiPayment p
            where p.loan.user.id = :userId and p.paymentDate between :from and :to
            order by p.paymentDate desc, p.id desc
            """)
    List<EmiPayment> findForUserBetween(@Param("userId") Long userId,
                                        @Param("from") LocalDate from,
                                        @Param("to") LocalDate to);
}
