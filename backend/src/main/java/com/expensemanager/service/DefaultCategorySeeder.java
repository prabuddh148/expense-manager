package com.expensemanager.service;

import com.expensemanager.entity.Category;
import com.expensemanager.entity.User;
import com.expensemanager.repository.CategoryRepository;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.List;

/**
 * A brand new account with no categories has nothing to chart, so every user starts with a
 * small set of zero-budget buckets they can rename, re-budget or delete.
 */
@Service
public class DefaultCategorySeeder {

    private record Seed(String name, String color, String icon) {}

    private static final List<Seed> DEFAULTS = List.of(
            new Seed("Food", "#F2704A", "fast-food-outline"),
            new Seed("Commute", "#4F8DFD", "bus-outline"),
            new Seed("Bike Petrol", "#F5B942", "bicycle-outline"),
            new Seed("Personal", "#9B6BF2", "person-outline"),
            new Seed("Recharge", "#2EC4A6", "phone-portrait-outline"),
            new Seed("Savings", "#3FB27F", "wallet-outline"));

    private final CategoryRepository categoryRepository;

    public DefaultCategorySeeder(CategoryRepository categoryRepository) {
        this.categoryRepository = categoryRepository;
    }

    public void seedFor(User user) {
        List<Category> categories = DEFAULTS.stream()
                .map(seed -> new Category(user, seed.name(), BigDecimal.ZERO, seed.color(), seed.icon()))
                .toList();
        categoryRepository.saveAll(categories);
    }
}
