package com.expensemanager.events;

import com.expensemanager.entity.EmiPayment;
import com.expensemanager.entity.Expense;
import com.expensemanager.entity.MoneyTrackerTransaction;
import com.expensemanager.entity.RefreshToken;
import com.expensemanager.entity.Salary;
import com.expensemanager.entity.SalaryAdjustment;
import com.expensemanager.entity.SalaryPlannerItem;
import com.expensemanager.entity.SavingsEntry;
import com.expensemanager.entity.SmsTransaction;
import com.expensemanager.security.AppUserPrincipal;
import jakarta.annotation.PostConstruct;
import jakarta.persistence.EntityManagerFactory;
import org.hibernate.engine.spi.SessionFactoryImplementor;
import org.hibernate.event.service.spi.EventListenerRegistry;
import org.hibernate.event.spi.EventType;
import org.hibernate.event.spi.PostDeleteEvent;
import org.hibernate.event.spi.PostDeleteEventListener;
import org.hibernate.event.spi.PostInsertEvent;
import org.hibernate.event.spi.PostInsertEventListener;
import org.hibernate.event.spi.PostUpdateEvent;
import org.hibernate.event.spi.PostUpdateEventListener;
import org.hibernate.persister.entity.EntityPersister;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Watches every row Hibernate writes and, once the transaction commits, publishes a
 * {@link DataCommittedEvent}. The Redis cache invalidation and the Kafka publisher both hang
 * off that one event, so no service had to change to feed them - and no write path can be
 * forgotten.
 *
 * Changes are only published after commit: a rolled-back write publishes nothing. Nested
 * REQUIRES_NEW transactions get their own batch, because the batch is kept on the
 * transaction's synchronizations, which Spring suspends and resumes with the transaction.
 *
 * Only writes by a signed-in user are tracked. Signup, login and scheduled cleanups have no
 * user whose cached views or activity feed could be affected.
 */
@Component
public class EntityChangeTracker
        implements PostInsertEventListener, PostUpdateEventListener, PostDeleteEventListener {

    private static final Logger log = LoggerFactory.getLogger(EntityChangeTracker.class);

    private final EntityManagerFactory entityManagerFactory;
    private final ApplicationEventPublisher publisher;

    public EntityChangeTracker(EntityManagerFactory entityManagerFactory, ApplicationEventPublisher publisher) {
        this.entityManagerFactory = entityManagerFactory;
        this.publisher = publisher;
    }

    @PostConstruct
    void register() {
        EventListenerRegistry registry = entityManagerFactory.unwrap(SessionFactoryImplementor.class)
                .getServiceRegistry()
                .getService(EventListenerRegistry.class);
        registry.appendListeners(EventType.POST_INSERT, this);
        registry.appendListeners(EventType.POST_UPDATE, this);
        registry.appendListeners(EventType.POST_DELETE, this);
    }

    @Override
    public void onPostInsert(PostInsertEvent event) {
        record(event.getEntity(), event.getId(), ChangeAction.CREATED);
    }

    @Override
    public void onPostUpdate(PostUpdateEvent event) {
        record(event.getEntity(), event.getId(), ChangeAction.UPDATED);
    }

    @Override
    public void onPostDelete(PostDeleteEvent event) {
        record(event.getEntity(), event.getId(), ChangeAction.DELETED);
    }

    @Override
    public boolean requiresPostCommitHandling(EntityPersister persister) {
        return false;
    }

    private void record(Object entity, Object id, ChangeAction action) {
        if (entity instanceof RefreshToken) {
            return;
        }
        Long userId = signedInUserId();
        if (userId == null) {
            return;
        }

        DataChange change = new DataChange(
                UUID.randomUUID(),
                userId,
                entity.getClass().getSimpleName(),
                id instanceof Long longId ? longId : null,
                action,
                amountOf(entity),
                Instant.now());

        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            publish(List.of(change));
            return;
        }
        pendingBatch().changes.add(change);
    }

    private PendingChanges pendingBatch() {
        for (TransactionSynchronization synchronization : TransactionSynchronizationManager.getSynchronizations()) {
            if (synchronization instanceof PendingChanges pending) {
                return pending;
            }
        }
        PendingChanges pending = new PendingChanges();
        TransactionSynchronizationManager.registerSynchronization(pending);
        return pending;
    }

    /** Listeners must never turn a committed write into an error response. */
    private void publish(List<DataChange> changes) {
        try {
            publisher.publishEvent(new DataCommittedEvent(changes));
        } catch (RuntimeException ex) {
            log.warn("A data-change listener failed; the write itself is committed", ex);
        }
    }

    private static Long signedInUserId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        return authentication != null && authentication.getPrincipal() instanceof AppUserPrincipal principal
                ? principal.getId()
                : null;
    }

    private static BigDecimal amountOf(Object entity) {
        return switch (entity) {
            case Expense expense -> expense.getAmount();
            case EmiPayment payment -> payment.getAmount();
            case Salary salary -> salary.getAmount();
            case SalaryAdjustment adjustment -> adjustment.getAmount();
            case SalaryPlannerItem item -> item.getAmount();
            case SavingsEntry entry -> entry.getAmount();
            case SmsTransaction sms -> sms.getAmount();
            case MoneyTrackerTransaction tracked -> tracked.getAmount();
            default -> null;
        };
    }

    private final class PendingChanges implements TransactionSynchronization {

        private final List<DataChange> changes = new ArrayList<>();

        @Override
        public void afterCommit() {
            publish(List.copyOf(changes));
        }
    }
}
