package com.expensemanager.cache;

import com.expensemanager.dto.analytics.AnalyticsResponse;
import com.expensemanager.dto.dashboard.DashboardResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.commons.logging.LogFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.cache.annotation.CachingConfigurer;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.interceptor.CacheErrorHandler;
import org.springframework.cache.interceptor.LoggingCacheErrorHandler;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.cache.RedisCacheConfiguration;
import org.springframework.data.redis.cache.RedisCacheManager;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.serializer.Jackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.RedisSerializationContext.SerializationPair;
import org.springframework.data.redis.serializer.RedisSerializer;

import java.time.Duration;

/**
 * Redis-backed cache for the two heaviest reads: the dashboard and analytics, each of which
 * runs a dozen aggregate queries.
 *
 * Only loaded with app.redis.enabled=true. Without this class there is no @EnableCaching,
 * so the @Cacheable annotations on the services are inert and every call hits the database
 * exactly as before.
 *
 * Correctness rules:
 * - Keys are scoped per user and carry a version that every committed write bumps
 *   ({@link UserCacheVersion}), so a cached response is never served after the data changed.
 * - Any Redis error is logged and the method simply runs, so Redis going down costs speed,
 *   never an error response.
 */
@Configuration
@EnableCaching
@ConditionalOnProperty(name = "app.redis.enabled", havingValue = "true")
public class RedisCacheConfig implements CachingConfigurer {

    @Bean
    public RedisCacheManager cacheManager(RedisConnectionFactory connectionFactory,
                                          ObjectMapper objectMapper,
                                          @Value("${app.cache.ttl}") Duration ttl) {
        RedisCacheConfiguration base = RedisCacheConfiguration.defaultCacheConfig()
                .entryTtl(ttl)
                .disableCachingNullValues()
                .prefixCacheNameWith("expense-manager:");

        return RedisCacheManager.builder(connectionFactory)
                .withCacheConfiguration(CacheNames.DASHBOARD, base.serializeValuesWith(
                        SerializationPair.fromSerializer(valueSerializer(objectMapper, DashboardResponse.class))))
                .withCacheConfiguration(CacheNames.ANALYTICS, base.serializeValuesWith(
                        SerializationPair.fromSerializer(valueSerializer(objectMapper, AnalyticsResponse.class))))
                .disableCreateOnMissingCache()
                .build();
    }

    /**
     * A serializer typed to the exact response record, using the same ObjectMapper as the
     * HTTP layer - so a response read back from Redis renders byte-for-byte like a fresh one.
     */
    public static <T> RedisSerializer<T> valueSerializer(ObjectMapper objectMapper, Class<T> type) {
        return new Jackson2JsonRedisSerializer<>(objectMapper, type);
    }

    @Override
    public CacheErrorHandler errorHandler() {
        return new LoggingCacheErrorHandler(LogFactory.getLog(RedisCacheConfig.class), false);
    }
}
