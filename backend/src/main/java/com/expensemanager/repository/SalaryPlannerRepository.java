package com.expensemanager.repository;

import com.expensemanager.entity.SalaryPlanner;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SalaryPlannerRepository extends JpaRepository<SalaryPlanner, Long> {

    List<SalaryPlanner> findByUserIdOrderByUpdatedAtDesc(Long userId);

    Optional<SalaryPlanner> findByIdAndUserId(Long id, Long userId);
}
