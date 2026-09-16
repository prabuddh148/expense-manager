package com.expensemanager.controller;

import com.expensemanager.dto.auth.ForgotPasswordRequest;
import com.expensemanager.dto.auth.LoginRequest;
import com.expensemanager.dto.auth.RefreshTokenRequest;
import com.expensemanager.dto.auth.ResetPasswordRequest;
import com.expensemanager.dto.auth.VerifyResetOtpRequest;
import com.expensemanager.mail.EmailSender;
import com.expensemanager.support.ApiTestBase;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.ResultActions;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class PasswordResetTest extends ApiTestBase {

    private static final Pattern CODE = Pattern.compile("\\b(\\d{6})\\b");

    @MockitoBean
    private EmailSender emailSender;

    @Test
    @DisplayName("the emailed code verifies, resets the password and signs old sessions out")
    void fullResetFlow() throws Exception {
        String email = session.user().email();
        String code = requestCode(email);

        postJson("/api/auth/verify-reset-otp", new VerifyResetOtpRequest(email, code))
                .andExpect(status().isOk());

        postJson("/api/auth/reset-password", new ResetPasswordRequest(email, code, "brand-new-password"))
                .andExpect(status().isNoContent());

        postJson("/api/auth/login", new LoginRequest(email, "correct-horse-battery"))
                .andExpect(status().isUnauthorized());
        postJson("/api/auth/login", new LoginRequest(email, "brand-new-password"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").isNotEmpty());

        postJson("/api/auth/refresh", new RefreshTokenRequest(session.refreshToken()))
                .andExpect(status().isUnauthorized());

        // A code works once.
        postJson("/api/auth/reset-password", new ResetPasswordRequest(email, code, "third-password-here"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("an unknown email gets the same answer and no email is sent")
    void unknownEmailRevealsNothing() throws Exception {
        postJson("/api/auth/forgot-password", new ForgotPasswordRequest("nobody-here@example.com"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").isNotEmpty());

        verify(emailSender, never()).send(anyString(), anyString(), anyString(), anyString(), anyString());
    }

    @Test
    @DisplayName("a wrong code is rejected and five wrong guesses lock the code")
    void wrongCodesLockOut() throws Exception {
        String email = session.user().email();
        String code = requestCode(email);
        String wrong = code.equals("000000") ? "111111" : "000000";

        for (int i = 0; i < 5; i++) {
            postJson("/api/auth/verify-reset-otp", new VerifyResetOtpRequest(email, wrong))
                    .andExpect(status().isBadRequest());
        }

        // Even the right code no longer works once the attempts are spent.
        postJson("/api/auth/verify-reset-otp", new VerifyResetOtpRequest(email, code))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Too many wrong attempts. Request a new code."));
    }

    @Test
    @DisplayName("asking again straight away does not send a second email")
    void resendCooldown() throws Exception {
        String email = session.user().email();
        requestCode(email);
        clearInvocations(emailSender);

        postJson("/api/auth/forgot-password", new ForgotPasswordRequest(email))
                .andExpect(status().isOk());

        verify(emailSender, never()).send(anyString(), anyString(), anyString(), anyString(), anyString());
    }

    @Test
    @DisplayName("the new password is validated")
    void shortNewPasswordRejected() throws Exception {
        String email = session.user().email();
        String code = requestCode(email);

        postJson("/api/auth/reset-password", new ResetPasswordRequest(email, code, "short"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.newPassword").exists());
    }

    private String requestCode(String email) throws Exception {
        postJson("/api/auth/forgot-password", new ForgotPasswordRequest(email))
                .andExpect(status().isOk());

        ArgumentCaptor<String> text = ArgumentCaptor.forClass(String.class);
        verify(emailSender, times(1)).send(eq(email), any(), any(), text.capture(), any());
        Matcher matcher = CODE.matcher(text.getValue());
        assertThat(matcher.find()).isTrue();
        return matcher.group(1);
    }

    private ResultActions postJson(String path, Object body) throws Exception {
        return mockMvc.perform(post(path)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(body)));
    }
}
