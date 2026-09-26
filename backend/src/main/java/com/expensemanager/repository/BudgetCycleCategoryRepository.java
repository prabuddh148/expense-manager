package com.expensemanager.repository;

import com.expensemanager.entity.BudgetCycleCategory;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BudgetCycleCategoryRepository extends JpaRepository<BudgetCycleCategory, Long> {
}
