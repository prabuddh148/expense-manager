package com.expensemanager.repository;

import com.expensemanager.entity.Expense;
import com.expensemanager.entity.RecordSource;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

/**
 * The window aggregates all take the expense origins that still count - see
 * {@link com.expensemanager.security.FeatureVisibility}. Rows written before the source
 * column existed, and manual rows since, carry no source and are read as MANUAL.
 */
public interface ExpenseRepository extends JpaRepository<Expense, Long>, JpaSpecificationExecutor<Expense> {

    @EntityGraph(attributePaths = "category")
    Optional<Expense> findByIdAndUserId(Long id, Long userId);

    /** Specification queries lazy-load the category, so fetch it eagerly for list responses. */
    @Override
    @EntityGraph(attributePaths = "category")
    Page<Expense> findAll(org.springframework.data.jpa.domain.Specification<Expense> spec, Pageable pageable);

    long countByCategoryId(Long categoryId);

    @Query("select coalesce(sum(e.amount), 0) from Expense e where e.user.id = :userId")
    BigDecimal sumForUser(@Param("userId") Long userId);

    @Query("""
            select coalesce(sum(e.amount), 0)
            from Expense e
            where e.user.id = :userId and e.date between :from and :to
              and coalesce(e.source, com.expensemanager.entity.RecordSource.MANUAL) in :sources
            """)
    BigDecimal sumForUserBetween(@Param("userId") Long userId,
                                 @Param("from") LocalDate from,
                                 @Param("to") LocalDate to,
                                 @Param("sources") Collection<RecordSource> sources);

    @Query("""
            select count(e)
            from Expense e
            where e.user.id = :userId and e.date between :from and :to
              and coalesce(e.source, com.expensemanager.entity.RecordSource.MANUAL) in :sources
            """)
    long countForUserBetween(@Param("userId") Long userId,
                             @Param("from") LocalDate from,
                             @Param("to") LocalDate to,
                             @Param("sources") Collection<RecordSource> sources);

    @Query("""
            select coalesce(sum(e.amount), 0)
            from Expense e
            where e.category.id = :categoryId and e.date between :from and :to
              and coalesce(e.source, com.expensemanager.entity.RecordSource.MANUAL) in :sources
            """)
    BigDecimal sumForCategoryBetween(@Param("categoryId") Long categoryId,
                                     @Param("from") LocalDate from,
                                     @Param("to") LocalDate to,
                                     @Param("sources") Collection<RecordSource> sources);

    /**
     * Spend per category for a window. The join has to be an explicit LEFT JOIN: a path
     * expression like e.category.name would become an inner join and silently drop every
     * expense filed under Other. Those rows group by their one-off name instead.
     */
    @Query("""
            select c.id as categoryId,
                   case when c.id is null then coalesce(e.expenseName, 'Other') else c.name end as categoryName,
                   c.color as color,
                   sum(e.amount) as total,
                   count(e) as transactions
            from Expense e
            left join e.category c
            where e.user.id = :userId and e.date between :from and :to
              and coalesce(e.source, com.expensemanager.entity.RecordSource.MANUAL) in :sources
            group by c.id, c.name, c.color,
                     case when c.id is null then coalesce(e.expenseName, 'Other') else c.name end
            order by sum(e.amount) desc
            """)
    List<CategoryTotal> sumByCategoryBetween(@Param("userId") Long userId,
                                             @Param("from") LocalDate from,
                                             @Param("to") LocalDate to,
                                             @Param("sources") Collection<RecordSource> sources);

    /** Daily totals used by the analytics line chart. */
    @Query("""
            select e.date as day, sum(e.amount) as total
            from Expense e
            where e.user.id = :userId and e.date between :from and :to
              and coalesce(e.source, com.expensemanager.entity.RecordSource.MANUAL) in :sources
            group by e.date
            order by e.date
            """)
    List<DailyTotal> sumByDayBetween(@Param("userId") Long userId,
                                     @Param("from") LocalDate from,
                                     @Param("to") LocalDate to,
                                     @Param("sources") Collection<RecordSource> sources);

    interface CategoryTotal {
        Long getCategoryId();

        String getCategoryName();

        String getColor();

        BigDecimal getTotal();

        long getTransactions();
    }

    interface DailyTotal {
        LocalDate getDay();

        BigDecimal getTotal();
    }
}
