package com.expensemanager.cache;

import com.expensemanager.events.DataCommittedEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.event.EventListener;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.util.UUID;

/**
 * A per-user counter that is part of every cache key.
 *
 * Instead of hunting down and deleting each cached entry a write might affect, a committed
 * write increments the user's counter. Old entries then simply stop matching and expire on
 * their TTL. It is race-free: a read picks up the version before it queries the database, and
 * the bump happens only after the write commits, so a read that saw pre-commit data can only
 * have stored it under the old version.
 *
 * The counter keys have no TTL, so Redis must run with a volatile-* eviction policy (see
 * docker-compose.yml) - otherwise an evicted counter could reset and revive stale entries.
 */
@Component
@ConditionalOnProperty(name = "app.redis.enabled", havingValue = "true")
public class UserCacheVersion {

    private static final Logger log = LoggerFactory.getLogger(UserCacheVersion.class);
    private static final String KEY_PREFIX = "expense-manager:cache-version:";

    private final StringRedisTemplate redis;

    public UserCacheVersion(StringRedisTemplate redis) {
        this.redis = redis;
    }

    String current(Long userId) {
        try {
            String version = redis.opsForValue().get(KEY_PREFIX + userId);
            return version == null ? "0" : version;
        } catch (RuntimeException ex) {
            log.warn("Redis unavailable, skipping the cache for this call: {}", ex.getMessage());
            // A key nothing else can have, so no possibly stale entry is ever read.
            return "unavailable-" + UUID.randomUUID();
        }
    }

    @EventListener
    public void onDataCommitted(DataCommittedEvent event) {
        for (Long userId : event.userIds()) {
            try {
                redis.opsForValue().increment(KEY_PREFIX + userId);
            } catch (RuntimeException ex) {
                log.warn("Could not invalidate cached responses for user {}: {}", userId, ex.getMessage());
            }
        }
    }
}
