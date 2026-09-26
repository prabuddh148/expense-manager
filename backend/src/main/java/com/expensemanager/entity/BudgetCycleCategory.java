package com.expensemanager.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.math.BigDecimal;

/**
 * What a category was budgeted at when its cycle ended. Written on reset so the fresh
 * values for the new cycle never overwrite the history of the old one. The name is copied
 * rather than referenced so a later rename or delete does not rewrite the past.
 */
@Entity
@Table(name = "budget_cycle_categories")
public class BudgetCycleCategory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "cycle_id", nullable = false)
    private BudgetCycle cycle;

    @Column(name = "category_id")
    private Long categoryId;

    @Column(name = "category_name", nullable = false, length = 60)
    private String categoryName;

    @Column(name = "allocated_amount", nullable = false, precision = 15, scale = 2)
    private BigDecimal allocatedAmount;

    protected BudgetCycleCategory() {
        // for JPA
    }

    public BudgetCycleCategory(BudgetCycle cycle, Category category) {
        this.cycle = cycle;
        this.categoryId = category.getId();
        this.categoryName = category.getName();
        this.allocatedAmount = category.getAllocatedAmount();
    }
}
