package com.expensemanager.dto.auth;

import jakarta.validation.constraints.NotBlank;

/** The mobile app obtains this ID token from Google and posts it here for verification. */
public record GoogleLoginRequest(@NotBlank String idToken) {}
