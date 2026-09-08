package com.expensemanager.repository;

import com.expensemanager.entity.SalaryAdjustment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.LocalDate;

public interface SalaryAdjustmentRepository extends JpaRepository<SalaryAdjustment, Long> {

    /** Credits landing in the window, added on top of the salary for that period. */
    @Query("select coalesce(sum(a.amount), 0) from SalaryAdjustment a "
            + "where a.user.id = :userId and a.date between :from and :to")
    BigDecimal sumForUserBetween(@Param("userId") Long userId,
                                 @Param("from") LocalDate from,
                                 @Param("to") LocalDate to);
}
