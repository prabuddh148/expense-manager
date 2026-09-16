package com.expensemanager.dto.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record VerifyResetOtpRequest(
        @NotBlank String email,
        @NotBlank @Pattern(regexp = "\\d{6}", message = "must be the 6 digit code") String otp
) {}
