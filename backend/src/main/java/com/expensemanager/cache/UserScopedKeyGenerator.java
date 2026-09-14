package com.expensemanager.cache;

import com.expensemanager.security.CurrentUser;
import com.expensemanager.security.FeatureVisibility;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.cache.interceptor.KeyGenerator;
import org.springframework.stereotype.Component;

import java.lang.reflect.Method;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.stream.Collectors;

/**
 * Builds a key from everything a cached response depends on besides its arguments:
 *
 * user id     - responses are per user
 * version     - bumped on every committed write, see {@link UserCacheVersion}
 * today       - "this month" / "this week" resolve against the current date
 * hidden      - the X-Hidden-Features header changes every total
 *
 * e.g. 42:v7:2026-09-14:hidden=[SMS]:get:2026,9
 */
@Component(CacheNames.KEY_GENERATOR)
@ConditionalOnProperty(name = "app.redis.enabled", havingValue = "true")
public class UserScopedKeyGenerator implements KeyGenerator {

    private final CurrentUser currentUser;
    private final FeatureVisibility visibility;
    private final UserCacheVersion cacheVersion;

    public UserScopedKeyGenerator(CurrentUser currentUser,
                                  FeatureVisibility visibility,
                                  UserCacheVersion cacheVersion) {
        this.currentUser = currentUser;
        this.visibility = visibility;
        this.cacheVersion = cacheVersion;
    }

    @Override
    public Object generate(Object target, Method method, Object... params) {
        Long userId = currentUser.id();
        String hidden = Arrays.stream(FeatureVisibility.Feature.values())
                .filter(visibility::isHidden)
                .map(Enum::name)
                .collect(Collectors.joining(",", "[", "]"));
        String args = Arrays.stream(params)
                .map(String::valueOf)
                .collect(Collectors.joining(","));

        return userId
                + ":v" + cacheVersion.current(userId)
                + ":" + LocalDate.now()
                + ":hidden=" + hidden
                + ":" + method.getName()
                + ":" + args;
    }
}
