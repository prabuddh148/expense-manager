package com.expensemanager.repository;

import com.expensemanager.entity.PasswordResetOtp;
import com.expensemanager.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface PasswordResetOtpRepository extends JpaRepository<PasswordResetOtp, Long> {

    Optional<PasswordResetOtp> findFirstByUserOrderByCreatedAtDesc(User user);

    /** Issuing a new code retires every older one, so a user only ever has a single row. */
    @Modifying
    @Query("delete from PasswordResetOtp o where o.user = :user")
    int deleteAllForUser(@Param("user") User user);
}
