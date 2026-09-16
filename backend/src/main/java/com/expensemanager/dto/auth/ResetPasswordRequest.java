package com.expensemanager.dto.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record ResetPasswordRequest(
        @NotBlank String email,
        @NotBlank @Pattern(regexp = "\\d{6}", message = "must be the 6 digit code") String otp,
        @NotBlank @Size(min = 8, max = 100) String newPassword
) {}
