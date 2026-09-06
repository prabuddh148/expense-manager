package com.expensemanager.controller;

import com.expensemanager.dto.auth.AuthResponse;
import com.expensemanager.dto.auth.LoginRequest;
import com.expensemanager.dto.auth.RefreshTokenRequest;
import com.expensemanager.dto.auth.SignupRequest;
import com.expensemanager.support.ApiTestBase;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class AuthControllerTest extends ApiTestBase {

    @Test
    @DisplayName("signup returns a token pair and the new user")
    void signupIssuesTokens() {
        assertThat(session.accessToken()).isNotBlank();
        assertThat(session.refreshToken()).isNotBlank();
        assertThat(session.tokenType()).isEqualTo("Bearer");
        assertThat(session.user().email()).endsWith("@example.com");
    }

    @Test
    @DisplayName("signup is rejected when the email is already taken")
    void duplicateSignupConflicts() throws Exception {
        var request = new SignupRequest("Someone Else", session.user().email(), "another-password");

        mockMvc.perform(post("/api/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isConflict());
    }

    @Test
    @DisplayName("signup rejects a short password with field level detail")
    void shortPasswordIsRejected() throws Exception {
        var request = new SignupRequest("Tiny", "tiny@example.com", "short");

        mockMvc.perform(post("/api/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.password").exists());
    }

    @Test
    @DisplayName("login works with the signup credentials and fails with a wrong password")
    void login() throws Exception {
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new LoginRequest(session.user().email(), "correct-horse-battery"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").isNotEmpty());

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new LoginRequest(session.user().email(), "wrong-password"))))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("protected endpoints need a token")
    void protectedEndpointsRequireAToken() throws Exception {
        mockMvc.perform(get("/api/dashboard"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(authed(get("/api/auth/me")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value(session.user().email()));
    }

    @Test
    @DisplayName("refresh rotates the pair and the old refresh token stops working")
    void refreshRotatesTokens() throws Exception {
        String response = mockMvc.perform(post("/api/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new RefreshTokenRequest(session.refreshToken()))))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        AuthResponse rotated = read(response, AuthResponse.class);
        assertThat(rotated.refreshToken()).isNotEqualTo(session.refreshToken());

        // Replaying the consumed token is refused.
        mockMvc.perform(post("/api/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new RefreshTokenRequest(session.refreshToken()))))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("logout revokes the refresh token")
    void logoutRevokes() throws Exception {
        mockMvc.perform(post("/api/auth/logout")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new RefreshTokenRequest(session.refreshToken()))))
                .andExpect(status().isNoContent());

        mockMvc.perform(post("/api/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new RefreshTokenRequest(session.refreshToken()))))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("google sign-in reports unavailable until client ids are configured")
    void googleUnconfigured() throws Exception {
        mockMvc.perform(post("/api/auth/google")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"idToken\":\"anything\"}"))
                .andExpect(status().isServiceUnavailable());
    }
}
