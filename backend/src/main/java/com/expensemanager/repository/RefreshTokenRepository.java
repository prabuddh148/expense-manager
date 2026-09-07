package com.expensemanager.repository;

import com.expensemanager.entity.RefreshToken;
import com.expensemanager.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Optional;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, Long> {

    Optional<RefreshToken> findByToken(String token);

    @Modifying
    @Query("update RefreshToken t set t.revoked = true where t.user = :user and t.revoked = false")
    int revokeAllForUser(User user);

    /**
     * Housekeeping: drop tokens that have expired, plus revoked ones old enough that
     * reuse detection no longer needs them. Idempotent - it only ever removes rows that
     * already match, so running it twice changes nothing.
     */
    @Modifying
    @Query("delete from RefreshToken t "
            + "where t.expiryDate < :now "
            + "or (t.revoked = true and t.createdAt < :revokedBefore)")
    int deleteExpiredOrRevoked(@Param("now") Instant now,
                               @Param("revokedBefore") Instant revokedBefore);
}
