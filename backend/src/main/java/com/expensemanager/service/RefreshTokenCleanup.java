package com.expensemanager.service;

import com.expensemanager.repository.RefreshTokenRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;

/**
 * Refresh tokens are rotated on every use, so each session leaves a trail of revoked
 * rows behind it and every abandoned session leaves an expired one. Nothing deletes
 * them during normal operation, so the table only ever grows.
 *
 * This is the one thing in the system that genuinely needs to run on a schedule: it is
 * housekeeping no request path can reasonably do, it touches no external service, and
 * running it twice has the same effect as running it once.
 */
@Component
public class RefreshTokenCleanup {

    private static final Logger log = LoggerFactory.getLogger(RefreshTokenCleanup.class);

    /** Revoked rows are kept briefly so token-reuse detection still has something to see. */
    private static final Duration REVOKED_GRACE = Duration.ofDays(2);

    private final RefreshTokenRepository refreshTokenRepository;

    public RefreshTokenCleanup(RefreshTokenRepository refreshTokenRepository) {
        this.refreshTokenRepository = refreshTokenRepository;
    }

    /**
     * Daily, an hour after startup so a cold boot is never competing with it. The delay
     * also means a restart loop cannot turn this into a hot loop of deletes.
     */
    @Scheduled(initialDelayString = "PT1H", fixedDelayString = "P1D")
    @Transactional
    public void purge() {
        Instant now = Instant.now();
        int removed = refreshTokenRepository.deleteExpiredOrRevoked(now, now.minus(REVOKED_GRACE));
        if (removed > 0) {
            log.info("Purged {} expired or revoked refresh tokens", removed);
        }
    }
}
