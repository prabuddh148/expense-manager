package com.expensemanager.events;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.event.EventListener;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

/**
 * Sends every committed data change to Kafka for the activity-service.
 *
 * Runs on the async executor, after the transaction committed and usually after the response
 * went out, so a slow or unreachable broker never delays or fails a request. The trade-off is
 * at-most-once on a crash between commit and send; a transactional outbox table would close
 * that gap if the activity feed ever had to be complete.
 */
@Component
@ConditionalOnProperty(name = "app.kafka.enabled", havingValue = "true")
public class ActivityEventPublisher {

    private static final Logger log = LoggerFactory.getLogger(ActivityEventPublisher.class);

    private final KafkaTemplate<String, Object> kafkaTemplate;
    private final String topic;

    public ActivityEventPublisher(KafkaTemplate<String, Object> kafkaTemplate,
                                  @Value("${app.kafka.activity-topic}") String topic) {
        this.kafkaTemplate = kafkaTemplate;
        this.topic = topic;
    }

    @Async
    @EventListener
    public void onDataCommitted(DataCommittedEvent event) {
        for (DataChange change : event.changes()) {
            try {
                // Keyed by user id: all of one user's events land on one partition, in order.
                kafkaTemplate.send(topic, String.valueOf(change.userId()), change)
                        .whenComplete((result, ex) -> {
                            if (ex != null) {
                                log.warn("Could not publish {} {} {}: {}", change.action(),
                                        change.entityType(), change.entityId(), ex.getMessage());
                            }
                        });
            } catch (RuntimeException ex) {
                log.warn("Could not publish {} {} {}: {}", change.action(),
                        change.entityType(), change.entityId(), ex.getMessage());
            }
        }
    }
}
