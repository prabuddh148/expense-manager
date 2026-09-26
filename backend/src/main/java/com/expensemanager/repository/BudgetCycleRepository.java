package com.expensemanager.repository;

import com.expensemanager.entity.BudgetCycle;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface BudgetCycleRepository extends JpaRepository<BudgetCycle, Long> {

    Optional<BudgetCycle> findFirstByUserIdOrderByStartDateDesc(Long userId);
}
