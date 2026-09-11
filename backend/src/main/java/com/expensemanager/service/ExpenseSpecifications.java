package com.expensemanager.service;

import com.expensemanager.entity.Expense;
import com.expensemanager.entity.RecordSource;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Locale;

/** Builds the expense-history filter from the query parameters the mobile app sends. */
final class ExpenseSpecifications {

    private ExpenseSpecifications() {
    }

    /** {@code sources} are the origins still shown; an empty collection matches nothing. */
    static Specification<Expense> forUser(Long userId,
                                          Collection<RecordSource> sources,
                                          String search,
                                          Long categoryId,
                                          boolean otherOnly,
                                          LocalDate from,
                                          LocalDate to,
                                          BigDecimal minAmount,
                                          BigDecimal maxAmount) {
        return (root, query, builder) -> {
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(builder.equal(root.get("user").get("id"), userId));

            if (sources.isEmpty()) {
                predicates.add(builder.disjunction());
            } else if (sources.size() < RecordSource.values().length) {
                // A row with no source predates the column and was entered by hand.
                predicates.add(builder.coalesce(root.<RecordSource>get("source"), RecordSource.MANUAL)
                        .in(sources));
            }

            if (search != null && !search.isBlank()) {
                String pattern = "%" + search.trim().toLowerCase(Locale.ROOT) + "%";
                // Left join so Other expenses, which have no category row, still match.
                var categoryJoin = root.join("category", JoinType.LEFT);
                predicates.add(builder.or(
                        builder.like(builder.lower(builder.coalesce(root.get("expenseName"), "")), pattern),
                        builder.like(builder.lower(builder.coalesce(root.get("description"), "")), pattern),
                        builder.like(builder.lower(builder.coalesce(categoryJoin.get("name"), "")), pattern)));
            }
            if (otherOnly) {
                predicates.add(builder.isNull(root.get("category")));
            } else if (categoryId != null) {
                predicates.add(builder.equal(root.get("category").get("id"), categoryId));
            }
            if (from != null) {
                predicates.add(builder.greaterThanOrEqualTo(root.get("date"), from));
            }
            if (to != null) {
                predicates.add(builder.lessThanOrEqualTo(root.get("date"), to));
            }
            if (minAmount != null) {
                predicates.add(builder.greaterThanOrEqualTo(root.get("amount"), minAmount));
            }
            if (maxAmount != null) {
                predicates.add(builder.lessThanOrEqualTo(root.get("amount"), maxAmount));
            }
            return builder.and(predicates.toArray(new Predicate[0]));
        };
    }
}
