package com.expensemanager.repository;

import com.expensemanager.entity.MoneyTrackerStatus;
import com.expensemanager.entity.MoneyTrackerTransaction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

public interface MoneyTrackerRepository extends JpaRepository<MoneyTrackerTransaction, Long> {

    /** Always scoped by user - an id alone must never be enough to reach a row. */
    Optional<MoneyTrackerTransaction> findByIdAndUserId(Long id, Long userId);

    List<MoneyTrackerTransaction> findByUserIdOrderByDateDescIdDesc(Long userId);

    List<MoneyTrackerTransaction> findByUserIdAndStatusOrderByDateDescIdDesc(
            Long userId, MoneyTrackerStatus status);

    /** Outstanding total in one direction, used for the summary cards. */
    @Query("select coalesce(sum(t.amount), 0) from MoneyTrackerTransaction t "
            + "where t.user.id = :userId and t.type = :type and t.status = :status")
    BigDecimal sumByTypeAndStatus(@Param("userId") Long userId,
                                  @Param("type") com.expensemanager.entity.MoneyTrackerType type,
                                  @Param("status") MoneyTrackerStatus status);
}
