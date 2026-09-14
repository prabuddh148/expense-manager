package com.expensemanager.activity.kafka;

import org.apache.kafka.clients.admin.NewTopic;
import org.apache.kafka.common.serialization.ByteArraySerializer;
import org.apache.kafka.common.serialization.StringSerializer;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.kafka.KafkaProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.config.TopicBuilder;
import org.springframework.kafka.core.DefaultKafkaProducerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.listener.DeadLetterPublishingRecoverer;
import org.springframework.kafka.listener.DefaultErrorHandler;
import org.springframework.kafka.support.serializer.DelegatingByTypeSerializer;
import org.springframework.kafka.support.serializer.JsonSerializer;
import org.springframework.util.backoff.FixedBackOff;

import java.util.LinkedHashMap;
import java.util.Map;

@Configuration
public class KafkaConsumerConfig {

    /** Same partition count as the source topic: a failed record keeps its partition number. */
    @Bean
    public NewTopic deadLetterTopic(@Value("${app.kafka.activity-topic}") String topic) {
        return TopicBuilder.name(topic + "-dlt").partitions(3).replicas(1).build();
    }

    /**
     * Retry a failing record 3 times, one second apart, then publish it to "<topic>-dlt".
     * Records that could not even be deserialized, and IllegalArgumentException, skip the
     * retries - retrying cannot fix them. Spring Boot wires this handler into the listener
     * container automatically.
     */
    @Bean
    public DefaultErrorHandler kafkaErrorHandler(KafkaTemplate<String, Object> deadLetterTemplate) {
        DeadLetterPublishingRecoverer recoverer = new DeadLetterPublishingRecoverer(deadLetterTemplate);
        DefaultErrorHandler handler = new DefaultErrorHandler(recoverer, new FixedBackOff(1000L, 3));
        handler.addNotRetryableExceptions(IllegalArgumentException.class);
        return handler;
    }

    /**
     * A record that failed deserialization reaches the recoverer as its raw bytes; one that
     * failed later reaches it as the parsed message. Each needs its own serializer.
     */
    @Bean
    public KafkaTemplate<String, Object> deadLetterTemplate(KafkaProperties properties) {
        JsonSerializer<Object> json = new JsonSerializer<>();
        json.setAddTypeInfo(false);

        Map<Class<?>, org.apache.kafka.common.serialization.Serializer<?>> byType = new LinkedHashMap<>();
        byType.put(byte[].class, new ByteArraySerializer());
        byType.put(Object.class, json);

        return new KafkaTemplate<>(new DefaultKafkaProducerFactory<>(
                properties.buildProducerProperties(null),
                new StringSerializer(),
                new DelegatingByTypeSerializer(byType, true)));
    }
}
