package com.expensemanager.activity.kafka;

import com.expensemanager.activity.entity.ActivityEvent;
import com.expensemanager.activity.repository.ActivityEventRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.support.KafkaHeaders;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.stereotype.Component;

/**
 * Kafka delivers at least once, so the same message can arrive twice (a rebalance, or a
 * crash after saving but before the offset commit). Storing is therefore idempotent: the
 * event id is unique in the table, and a duplicate is acknowledged and skipped.
 *
 * A message that keeps failing is retried a few times and then parked on the dead-letter
 * topic (see KafkaConsumerConfig), so one bad record never blocks its partition.
 */
@Component
public class ActivityEventConsumer {

    private static final Logger log = LoggerFactory.getLogger(ActivityEventConsumer.class);

    private final ActivityEventRepository repository;

    public ActivityEventConsumer(ActivityEventRepository repository) {
        this.repository = repository;
    }

    @KafkaListener(topics = "${app.kafka.activity-topic}")
    public void onMessage(ActivityEventMessage message,
                          @Header(KafkaHeaders.RECEIVED_PARTITION) int partition,
                          @Header(KafkaHeaders.OFFSET) long offset) {
        boolean stored = store(message);
        log.info("{} {} {} for user {} (partition {}, offset {}){}", message.action(), message.entityType(),
                message.entityId(), message.userId(), partition, offset, stored ? "" : " - duplicate, skipped");
    }

    /** Returns false when the event was already stored. */
    public boolean store(ActivityEventMessage message) {
        if (message.eventId() == null || message.userId() == null
                || message.entityType() == null || message.action() == null) {
            // Not retryable: goes straight to the dead-letter topic.
            throw new IllegalArgumentException("Incomplete activity event: " + message);
        }
        if (repository.existsByEventId(message.eventId())) {
            return false;
        }
        try {
            repository.saveAndFlush(new ActivityEvent(
                    message.eventId(),
                    message.userId(),
                    message.entityType(),
                    message.entityId(),
                    message.action(),
                    message.amount(),
                    message.occurredAt() == null ? java.time.Instant.now() : message.occurredAt()));
            return true;
        } catch (DataIntegrityViolationException raced) {
            // Another consumer thread stored the same redelivered event between the check and the insert.
            return false;
        }
    }
}
