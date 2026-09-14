package com.expensemanager.events;

import org.apache.kafka.clients.admin.NewTopic;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.config.TopicBuilder;
import org.springframework.scheduling.annotation.EnableAsync;

/** Only loaded with app.kafka.enabled=true. */
@Configuration
@EnableAsync
@ConditionalOnProperty(name = "app.kafka.enabled", havingValue = "true")
public class KafkaConfig {

    /**
     * Three partitions so the activity-service can consume in parallel. Messages are keyed by
     * user id, which keeps each user's events in order on a single partition.
     */
    @Bean
    public NewTopic activityTopic(@Value("${app.kafka.activity-topic}") String topic) {
        return TopicBuilder.name(topic).partitions(3).replicas(1).build();
    }
}
