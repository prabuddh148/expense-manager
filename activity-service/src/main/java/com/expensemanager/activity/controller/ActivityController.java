package com.expensemanager.activity.controller;

import com.expensemanager.activity.entity.ActivityEvent;
import com.expensemanager.activity.repository.ActivityEventRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/** The signed-in user's activity feed, built entirely from Kafka events. */
@RestController
@RequestMapping("/api/activity")
public class ActivityController {

    private static final int MAX_PAGE_SIZE = 100;

    private final ActivityEventRepository repository;

    public ActivityController(ActivityEventRepository repository) {
        this.repository = repository;
    }

    @GetMapping
    public ActivityPage feed(@AuthenticationPrincipal Long userId,
                             @RequestParam(defaultValue = "0") int page,
                             @RequestParam(defaultValue = "20") int size) {
        Page<ActivityEvent> result = repository.findByUserIdOrderByOccurredAtDescIdDesc(
                userId, PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), MAX_PAGE_SIZE)));
        return new ActivityPage(
                result.map(ActivityItem::from).getContent(),
                result.getNumber(),
                result.getSize(),
                result.getTotalElements(),
                result.getTotalPages());
    }

    @GetMapping("/summary")
    public List<ActivityCount> summary(@AuthenticationPrincipal Long userId) {
        return repository.countByTypeAndAction(userId).stream()
                .map(row -> new ActivityCount(row.getEntityType(), row.getAction(), row.getCount()))
                .toList();
    }

    public record ActivityItem(Long id, String entityType, Long entityId, String action,
                               BigDecimal amount, Instant occurredAt) {
        static ActivityItem from(ActivityEvent event) {
            return new ActivityItem(event.getId(), event.getEntityType(), event.getEntityId(),
                    event.getAction(), event.getAmount(), event.getOccurredAt());
        }
    }

    public record ActivityPage(List<ActivityItem> content, int page, int size,
                               long totalElements, int totalPages) {}

    public record ActivityCount(String entityType, String action, long count) {}
}
