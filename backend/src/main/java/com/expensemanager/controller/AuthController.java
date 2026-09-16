package com.expensemanager.controller;

import com.expensemanager.dto.auth.AuthResponse;
import com.expensemanager.dto.auth.ForgotPasswordRequest;
import com.expensemanager.dto.auth.GoogleLoginRequest;
import com.expensemanager.dto.auth.LoginRequest;
import com.expensemanager.dto.auth.RefreshTokenRequest;
import com.expensemanager.dto.auth.ResetPasswordRequest;
import com.expensemanager.dto.auth.SignupRequest;
import com.expensemanager.dto.auth.UserResponse;
import com.expensemanager.dto.auth.VerifyResetOtpRequest;
import com.expensemanager.dto.common.MessageResponse;
import com.expensemanager.mapper.UserMapper;
import com.expensemanager.security.CurrentUser;
import com.expensemanager.service.AuthService;
import com.expensemanager.service.PasswordResetService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;
    private final PasswordResetService passwordResetService;
    private final CurrentUser currentUser;
    private final UserMapper userMapper;

    public AuthController(AuthService authService, PasswordResetService passwordResetService,
                          CurrentUser currentUser, UserMapper userMapper) {
        this.authService = authService;
        this.passwordResetService = passwordResetService;
        this.currentUser = currentUser;
        this.userMapper = userMapper;
    }

    @PostMapping("/signup")
    @ResponseStatus(HttpStatus.CREATED)
    public AuthResponse signup(@Valid @RequestBody SignupRequest request) {
        return authService.signup(request);
    }

    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest request) {
        return authService.login(request);
    }

    /** The app posts the Google ID token it got from expo-auth-session; the server verifies it. */
    @PostMapping("/google")
    public AuthResponse google(@Valid @RequestBody GoogleLoginRequest request) {
        return authService.loginWithGoogle(request.idToken());
    }

    @PostMapping("/refresh")
    public AuthResponse refresh(@Valid @RequestBody RefreshTokenRequest request) {
        return authService.refresh(request.refreshToken());
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(@Valid @RequestBody RefreshTokenRequest request) {
        authService.logout(request.refreshToken());
        return ResponseEntity.noContent().build();
    }

    /** Same answer whether or not the account exists, so it cannot reveal who has signed up. */
    @PostMapping("/forgot-password")
    public MessageResponse forgotPassword(@Valid @RequestBody ForgotPasswordRequest request) {
        passwordResetService.requestCode(request.email());
        return new MessageResponse("If an account exists for that email, a reset code is on its way.");
    }

    @PostMapping("/verify-reset-otp")
    public MessageResponse verifyResetOtp(@Valid @RequestBody VerifyResetOtpRequest request) {
        passwordResetService.verifyCode(request.email(), request.otp());
        return new MessageResponse("Code verified");
    }

    @PostMapping("/reset-password")
    public ResponseEntity<Void> resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        passwordResetService.resetPassword(request.email(), request.otp(), request.newPassword());
        return ResponseEntity.noContent().build();
    }

    /** Requires a valid access token - used by the app on cold start to confirm the session. */
    @GetMapping("/me")
    public UserResponse me() {
        return userMapper.toResponse(currentUser.entity());
    }
}
