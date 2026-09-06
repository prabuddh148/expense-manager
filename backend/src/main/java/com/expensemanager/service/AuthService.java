package com.expensemanager.service;

import com.expensemanager.dto.auth.AuthResponse;
import com.expensemanager.dto.auth.LoginRequest;
import com.expensemanager.dto.auth.SignupRequest;
import com.expensemanager.entity.AuthProvider;
import com.expensemanager.entity.RefreshToken;
import com.expensemanager.entity.User;
import com.expensemanager.exception.ConflictException;
import com.expensemanager.exception.UnauthorizedException;
import com.expensemanager.mapper.UserMapper;
import com.expensemanager.repository.RefreshTokenRepository;
import com.expensemanager.repository.UserRepository;
import com.expensemanager.security.GoogleTokenVerifier;
import com.expensemanager.security.JwtService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.Optional;

@Service
public class AuthService {

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final Base64.Encoder ENCODER = Base64.getUrlEncoder().withoutPadding();

    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final JwtService jwtService;
    private final GoogleTokenVerifier googleTokenVerifier;
    private final UserMapper userMapper;
    private final DefaultCategorySeeder categorySeeder;
    private final long refreshTokenExpirationMs;

    public AuthService(UserRepository userRepository,
                       RefreshTokenRepository refreshTokenRepository,
                       PasswordEncoder passwordEncoder,
                       AuthenticationManager authenticationManager,
                       JwtService jwtService,
                       GoogleTokenVerifier googleTokenVerifier,
                       UserMapper userMapper,
                       DefaultCategorySeeder categorySeeder,
                       @Value("${app.jwt.refresh-token-expiration-ms}") long refreshTokenExpirationMs) {
        this.userRepository = userRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.passwordEncoder = passwordEncoder;
        this.authenticationManager = authenticationManager;
        this.jwtService = jwtService;
        this.googleTokenVerifier = googleTokenVerifier;
        this.userMapper = userMapper;
        this.categorySeeder = categorySeeder;
        this.refreshTokenExpirationMs = refreshTokenExpirationMs;
    }

    @Transactional
    public AuthResponse signup(SignupRequest request) {
        String email = request.email().trim().toLowerCase();
        if (userRepository.existsByEmailIgnoreCase(email)) {
            throw new ConflictException("An account with that email already exists");
        }
        User user = new User(
                request.name().trim(),
                email,
                passwordEncoder.encode(request.password()),
                AuthProvider.LOCAL);
        user = userRepository.save(user);
        categorySeeder.seedFor(user);
        return issueTokens(user);
    }

    @Transactional
    public AuthResponse login(LoginRequest request) {
        String email = request.email().trim().toLowerCase();
        try {
            authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(email, request.password()));
        } catch (org.springframework.security.core.AuthenticationException ex) {
            throw new BadCredentialsException("Invalid email or password");
        }
        User user = userRepository.findByEmailIgnoreCase(email)
                .orElseThrow(() -> new BadCredentialsException("Invalid email or password"));
        return issueTokens(user);
    }

    /**
     * Signs the holder of a verified Google ID token in, creating the account on first use.
     * An existing local account with the same email is linked rather than duplicated.
     */
    @Transactional
    public AuthResponse loginWithGoogle(String idToken) {
        GoogleTokenVerifier.GoogleUser googleUser = googleTokenVerifier.verify(idToken);
        String email = googleUser.email().toLowerCase();

        Optional<User> byGoogleId = userRepository.findByGoogleId(googleUser.googleId());
        User user;
        if (byGoogleId.isPresent()) {
            user = byGoogleId.get();
        } else {
            Optional<User> byEmail = userRepository.findByEmailIgnoreCase(email);
            if (byEmail.isPresent()) {
                user = byEmail.get();
                user.setGoogleId(googleUser.googleId());
                user = userRepository.save(user);
            } else {
                user = new User(googleUser.name(), email, null, AuthProvider.GOOGLE);
                user.setGoogleId(googleUser.googleId());
                user = userRepository.save(user);
                categorySeeder.seedFor(user);
            }
        }
        return issueTokens(user);
    }

    /**
     * Exchanges a refresh token for a new pair. The presented token is revoked in the same
     * transaction, so a stolen token stops working the moment the real client rotates it.
     */
    @Transactional
    public AuthResponse refresh(String refreshToken) {
        RefreshToken stored = refreshTokenRepository.findByToken(refreshToken)
                .orElseThrow(() -> new UnauthorizedException("Invalid refresh token"));
        if (!stored.isUsable()) {
            // Reuse of a revoked token is treated as compromise: drop the whole family.
            refreshTokenRepository.revokeAllForUser(stored.getUser());
            throw new UnauthorizedException("Refresh token expired or already used");
        }
        stored.setRevoked(true);
        refreshTokenRepository.save(stored);
        return issueTokens(stored.getUser());
    }

    @Transactional
    public void logout(String refreshToken) {
        refreshTokenRepository.findByToken(refreshToken).ifPresent(token -> {
            token.setRevoked(true);
            refreshTokenRepository.save(token);
        });
    }

    @Transactional
    public void logoutEverywhere(User user) {
        refreshTokenRepository.revokeAllForUser(user);
    }

    private AuthResponse issueTokens(User user) {
        String accessToken = jwtService.generateAccessToken(user.getId(), user.getEmail());
        byte[] bytes = new byte[48];
        RANDOM.nextBytes(bytes);
        RefreshToken refreshToken = new RefreshToken(
                ENCODER.encodeToString(bytes),
                user,
                Instant.now().plusMillis(refreshTokenExpirationMs));
        refreshTokenRepository.save(refreshToken);

        return new AuthResponse(
                accessToken,
                refreshToken.getToken(),
                "Bearer",
                jwtService.getAccessTokenExpirationMs(),
                userMapper.toResponse(user));
    }
}
