package com.expensemanager.repository;

import com.expensemanager.entity.SavingsEntry;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface SavingsRepository extends JpaRepository<SavingsEntry, Long> {

    Optional<SavingsEntry> findByIdAndUserId(Long id, Long userId);

    List<SavingsEntry> findByUserIdOrderByDateDescIdDesc(Long userId);

    @Query("select coalesce(sum(s.amount), 0) from SavingsEntry s where s.user.id = :userId")
    BigDecimal sumForUser(@Param("userId") Long userId);

    @Query("select coalesce(sum(s.amount), 0) from SavingsEntry s "
            + "where s.user.id = :userId and s.date between :from and :to")
    BigDecimal sumForUserBetween(@Param("userId") Long userId,
                                 @Param("from") LocalDate from,
                                 @Param("to") LocalDate to);

    /** Totals per method, so the client can show where the money actually went. */
    @Query("select s.method, coalesce(sum(s.amount), 0), count(s) from SavingsEntry s "
            + "where s.user.id = :userId group by s.method order by sum(s.amount) desc")
    List<Object[]> totalsByMethod(@Param("userId") Long userId);
}
