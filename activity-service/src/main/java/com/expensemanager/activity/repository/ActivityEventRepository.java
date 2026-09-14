package com.expensemanager.activity.repository;

import com.expensemanager.activity.entity.ActivityEvent;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface ActivityEventRepository extends JpaRepository<ActivityEvent, Long> {

    boolean existsByEventId(UUID eventId);

    Page<ActivityEvent> findByUserIdOrderByOccurredAtDescIdDesc(Long userId, Pageable pageable);

    @Query("""
            select e.entityType as entityType, e.action as action, count(e) as count
            from ActivityEvent e
            where e.userId = :userId
            group by e.entityType, e.action
            order by e.entityType, e.action
            """)
    List<ActionCount> countByTypeAndAction(@Param("userId") Long userId);

    interface ActionCount {
        String getEntityType();

        String getAction();

        long getCount();
    }
}
