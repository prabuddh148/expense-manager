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
 * One slice of a planner. The percentage is recomputed from the amount whenever the planner
 * changes, so it is always consistent with the total.
 */
@Entity
@Table(name = "salary_planner_items")
public class SalaryPlannerItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "planner_id", nullable = false)
    private SalaryPlanner planner;

    @Column(nullable = false, length = 60)
    private String name;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal amount;

    /** Share of the planner total, 0-100 with two decimals. */
    @Column(nullable = false, precision = 6, scale = 2)
    private BigDecimal percentage = BigDecimal.ZERO;

    @Column(length = 9)
    private String color;

    /** Display order, so the user can reorder slices. */
    @Column(nullable = false)
    private int position;

    protected SalaryPlannerItem() {
        // for JPA
    }

    public SalaryPlannerItem(String name, BigDecimal amount, String color, int position) {
        this.name = name;
        this.amount = amount;
        this.color = color;
        this.position = position;
    }

    public Long getId() {
        return id;
    }

    public SalaryPlanner getPlanner() {
        return planner;
    }

    public void setPlanner(SalaryPlanner planner) {
        this.planner = planner;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public BigDecimal getAmount() {
        return amount;
    }

    public void setAmount(BigDecimal amount) {
        this.amount = amount;
    }

    public BigDecimal getPercentage() {
        return percentage;
    }

    public void setPercentage(BigDecimal percentage) {
        this.percentage = percentage;
    }

    public String getColor() {
        return color;
    }

    public void setColor(String color) {
        this.color = color;
    }

    public int getPosition() {
        return position;
    }

    public void setPosition(int position) {
        this.position = position;
    }
}
