package com.expensemanager.cache;

/** Names shared by the @Cacheable annotations and the Redis cache configuration. */
public final class CacheNames {

    public static final String DASHBOARD = "dashboard";
    public static final String ANALYTICS = "analytics";
    public static final String KEY_GENERATOR = "userScopedKeyGenerator";

    private CacheNames() {
    }
}
