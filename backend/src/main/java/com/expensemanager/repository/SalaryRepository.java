package com.expensemanager.repository;

import com.expensemanager.entity.Salary;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SalaryRepository extends JpaRepository<Salary, Long> {

    Optional<Salary> findByUserIdAndPeriodYearAndPeriodMonth(Long userId, int periodYear, int periodMonth);

    Optional<Salary> findByIdAndUserId(Long id, Long userId);

    List<Salary> findByUserIdOrderByPeriodYearDescPeriodMonthDesc(Long userId);
}
