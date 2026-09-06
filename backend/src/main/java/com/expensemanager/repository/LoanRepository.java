package com.expensemanager.repository;

import com.expensemanager.entity.Loan;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

public interface LoanRepository extends JpaRepository<Loan, Long> {

    List<Loan> findByUserIdOrderByStatusAscNameAsc(Long userId);

    Optional<Loan> findByIdAndUserId(Long id, Long userId);

    @Query("""
            select coalesce(sum(l.remainingAmount), 0)
            from Loan l
            where l.user.id = :userId and l.status = com.expensemanager.entity.LoanStatus.ACTIVE
            """)
    BigDecimal sumOutstanding(@Param("userId") Long userId);

    @Query("""
            select coalesce(sum(l.monthlyEmi), 0)
            from Loan l
            where l.user.id = :userId and l.status = com.expensemanager.entity.LoanStatus.ACTIVE
            """)
    BigDecimal sumMonthlyEmi(@Param("userId") Long userId);

    @Query("select coalesce(sum(l.originalAmount), 0) from Loan l where l.user.id = :userId")
    BigDecimal sumOriginal(@Param("userId") Long userId);
}
