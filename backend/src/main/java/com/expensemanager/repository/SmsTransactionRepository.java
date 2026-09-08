package com.expensemanager.repository;

import com.expensemanager.entity.SmsTransaction;
import com.expensemanager.entity.SmsTransactionStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface SmsTransactionRepository extends JpaRepository<SmsTransaction, Long> {

    Optional<SmsTransaction> findByIdAndUserId(Long id, Long userId);

    /** The dedup lookup: a hash already present means the message was seen before. */
    boolean existsByUserIdAndDedupeHash(Long userId, String dedupeHash);

    List<SmsTransaction> findByUserIdOrderByTransactionDateDescIdDesc(Long userId);

    long countByUserIdAndStatus(Long userId, SmsTransactionStatus status);

    /**
     * Bank names are never hard-coded - the filter list is whatever has actually been
     * detected for this user, with how many are still waiting on them.
     */
    @Query("select t.bankName, count(t), "
            + "sum(case when t.status = com.expensemanager.entity.SmsTransactionStatus.UNCATEGORIZED then 1 else 0 end) "
            + "from SmsTransaction t where t.user.id = :userId "
            + "group by t.bankName order by t.bankName")
    List<Object[]> countByBank(@Param("userId") Long userId);
}
