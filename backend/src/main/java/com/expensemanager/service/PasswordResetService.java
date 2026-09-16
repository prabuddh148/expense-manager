package com.expensemanager.service;

import com.expensemanager.entity.PasswordResetOtp;
import com.expensemanager.entity.User;
import com.expensemanager.exception.BadRequestException;
import com.expensemanager.mail.EmailSender;
import com.expensemanager.repository.PasswordResetOtpRepository;
import com.expensemanager.repository.RefreshTokenRepository;
import com.expensemanager.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.util.HtmlUtils;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Optional;

/**
 * Forgot password: email a six digit code, check it, then let it set a new password.
 *
 * Every answer about an email address looks the same whether or not an account exists,
 * so the flow cannot be used to find out who has signed up.
 */
@Service
public class PasswordResetService {

    private static final Logger log = LoggerFactory.getLogger(PasswordResetService.class);
    private static final SecureRandom RANDOM = new SecureRandom();

    static final Duration CODE_VALID_FOR = Duration.ofMinutes(10);
    static final Duration RESEND_COOLDOWN = Duration.ofSeconds(60);
    static final int MAX_ATTEMPTS = 5;

    private static final String INVALID_CODE = "That code is wrong or has expired. Request a new one.";

    private final UserRepository userRepository;
    private final PasswordResetOtpRepository otpRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final EmailSender emailSender;

    public PasswordResetService(UserRepository userRepository,
                                PasswordResetOtpRepository otpRepository,
                                RefreshTokenRepository refreshTokenRepository,
                                PasswordEncoder passwordEncoder,
                                EmailSender emailSender) {
        this.userRepository = userRepository;
        this.otpRepository = otpRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.passwordEncoder = passwordEncoder;
        this.emailSender = emailSender;
    }

    /**
     * Emails a fresh code. A request inside the cooldown is ignored rather than refused, so
     * repeated taps cannot flood an inbox. If the email fails the new code rolls back with it.
     */
    @Transactional
    public void requestCode(String rawEmail) {
        Optional<User> found = userRepository.findByEmailIgnoreCase(normalize(rawEmail));
        if (found.isEmpty()) {
            log.debug("Password reset requested for an unknown email");
            return;
        }
        User user = found.get();

        Optional<PasswordResetOtp> latest = otpRepository.findFirstByUserOrderByCreatedAtDesc(user);
        if (latest.isPresent() && !latest.get().isUsed()
                && latest.get().getCreatedAt().isAfter(Instant.now().minus(RESEND_COOLDOWN))) {
            return;
        }

        otpRepository.deleteAllForUser(user);
        String code = String.format("%06d", RANDOM.nextInt(1_000_000));
        otpRepository.save(new PasswordResetOtp(
                user, passwordEncoder.encode(code), Instant.now().plus(CODE_VALID_FOR)));

        sendCode(user, code);
    }

    /** Lets the app check the code before asking for the new password. Does not use it up. */
    @Transactional(noRollbackFor = BadRequestException.class)
    public void verifyCode(String rawEmail, String code) {
        checkCode(rawEmail, code);
    }

    /** Sets the new password and signs every existing session out. */
    @Transactional(noRollbackFor = BadRequestException.class)
    public void resetPassword(String rawEmail, String code, String newPassword) {
        PasswordResetOtp otp = checkCode(rawEmail, code);
        User user = otp.getUser();
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        userRepository.save(user);
        otp.markUsed();
        otpRepository.save(otp);
        refreshTokenRepository.revokeAllForUser(user);
    }

    /**
     * Wrong guesses are counted and saved even though the request fails - that is why the
     * callers do not roll back on BadRequestException.
     */
    private PasswordResetOtp checkCode(String rawEmail, String code) {
        User user = userRepository.findByEmailIgnoreCase(normalize(rawEmail))
                .orElseThrow(() -> new BadRequestException(INVALID_CODE));
        PasswordResetOtp otp = otpRepository.findFirstByUserOrderByCreatedAtDesc(user)
                .orElseThrow(() -> new BadRequestException(INVALID_CODE));

        if (otp.isUsed() || otp.getExpiresAt().isBefore(Instant.now())) {
            throw new BadRequestException(INVALID_CODE);
        }
        if (otp.getAttempts() >= MAX_ATTEMPTS) {
            throw new BadRequestException("Too many wrong attempts. Request a new code.");
        }
        if (code == null || !passwordEncoder.matches(code.trim(), otp.getCodeHash())) {
            otp.recordFailedAttempt();
            otpRepository.save(otp);
            throw new BadRequestException(INVALID_CODE);
        }
        return otp;
    }

    private void sendCode(User user, String code) {
        long minutes = CODE_VALID_FOR.toMinutes();
        String name = HtmlUtils.htmlEscape(user.getName());
        String text = "Hi " + user.getName() + ",\n\n"
                + "Your Expense Manager password reset code is: " + code + "\n\n"
                + "It expires in " + minutes + " minutes. If you did not ask to reset your password, "
                + "ignore this email - your password stays the same.";
        String html = "<div style=\"font-family:Arial,sans-serif;max-width:480px;margin:auto;color:#1b1f27\">"
                + "<h2 style=\"color:#3D7BF7\">Reset your password</h2>"
                + "<p>Hi " + name + ",</p>"
                + "<p>Use this code in the Expense Manager app to reset your password:</p>"
                + "<p style=\"font-size:32px;font-weight:bold;letter-spacing:8px;margin:24px 0\">" + code + "</p>"
                + "<p>It expires in " + minutes + " minutes.</p>"
                + "<p style=\"color:#6b7280;font-size:13px\">If you did not ask to reset your password, "
                + "ignore this email - your password stays the same.</p>"
                + "</div>";
        emailSender.send(user.getEmail(), user.getName(),
                "Your Expense Manager reset code: " + code, text, html);
    }

    private static String normalize(String email) {
        return email == null ? "" : email.trim().toLowerCase();
    }
}
