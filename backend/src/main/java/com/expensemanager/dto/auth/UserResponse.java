package com.expensemanager.dto.auth;

import java.time.Instant;

public record UserResponse(
        Long id,
        String name,
        String email,
        String provider,
        Instant createdAt
) {}
