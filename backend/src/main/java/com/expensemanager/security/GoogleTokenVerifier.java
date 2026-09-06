package com.expensemanager.security;

import com.expensemanager.exception.ServiceUnavailableException;
import com.expensemanager.exception.UnauthorizedException;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.security.GeneralSecurityException;
import java.util.Arrays;
import java.util.List;

/**
 * Verifies the Google ID token the Expo app obtains through expo-auth-session.
 * The signature, issuer and audience are all checked against Google's public keys - the
 * client is never trusted to say who it is.
 */
@Service
public class GoogleTokenVerifier {

    private final List<String> clientIds;
    private final GoogleIdTokenVerifier verifier;

    public GoogleTokenVerifier(@Value("${app.google.client-ids}") String clientIds) {
        this.clientIds = Arrays.stream(clientIds.split(","))
                .map(String::trim)
                .filter(value -> !value.isEmpty())
                .toList();
        this.verifier = this.clientIds.isEmpty() ? null : new GoogleIdTokenVerifier.Builder(
                new NetHttpTransport(), GsonFactory.getDefaultInstance())
                .setAudience(this.clientIds)
                .build();
    }

    public boolean isConfigured() {
        return verifier != null;
    }

    public GoogleUser verify(String idToken) {
        if (!isConfigured()) {
            throw new ServiceUnavailableException(
                    "Google Sign-In is not configured on this server. Set GOOGLE_CLIENT_IDS.");
        }
        GoogleIdToken token;
        try {
            token = verifier.verify(idToken);
        } catch (GeneralSecurityException | IOException ex) {
            throw new ServiceUnavailableException("Could not reach Google to verify the token");
        }
        if (token == null) {
            throw new UnauthorizedException("Invalid Google token");
        }
        GoogleIdToken.Payload payload = token.getPayload();
        if (!Boolean.TRUE.equals(payload.getEmailVerified())) {
            throw new UnauthorizedException("This Google account has no verified email address");
        }
        String name = (String) payload.get("name");
        return new GoogleUser(
                payload.getSubject(),
                payload.getEmail(),
                name == null || name.isBlank() ? payload.getEmail() : name);
    }

    public record GoogleUser(String googleId, String email, String name) {}
}
