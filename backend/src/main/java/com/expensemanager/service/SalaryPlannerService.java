package com.expensemanager.service;

import com.expensemanager.dto.planner.SalaryPlannerItemRequest;
import com.expensemanager.dto.planner.SalaryPlannerRequest;
import com.expensemanager.dto.planner.SalaryPlannerResponse;
import com.expensemanager.entity.SalaryPlanner;
import com.expensemanager.entity.SalaryPlannerItem;
import com.expensemanager.entity.User;
import com.expensemanager.exception.ResourceNotFoundException;
import com.expensemanager.mapper.SalaryPlannerMapper;
import com.expensemanager.repository.SalaryPlannerRepository;
import com.expensemanager.security.CurrentUser;
import com.expensemanager.util.Money;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * The planner is a standalone what-if breakdown. Percentages are never sent by the client -
 * they are recomputed from the amounts after every change so they always add up.
 */
@Service
public class SalaryPlannerService {

    private static final List<String> PALETTE = List.of(
            "#4F8DFD", "#F2704A", "#3FB27F", "#9B6BF2", "#F5B942", "#2EC4A6", "#E5647B", "#6C7A93");

    private final SalaryPlannerRepository plannerRepository;
    private final SalaryPlannerMapper plannerMapper;
    private final CurrentUser currentUser;

    public SalaryPlannerService(SalaryPlannerRepository plannerRepository,
                                SalaryPlannerMapper plannerMapper,
                                CurrentUser currentUser) {
        this.plannerRepository = plannerRepository;
        this.plannerMapper = plannerMapper;
        this.currentUser = currentUser;
    }

    @Transactional(readOnly = true)
    public List<SalaryPlannerResponse> list() {
        return plannerRepository.findByUserIdOrderByUpdatedAtDesc(currentUser.id()).stream()
                .map(plannerMapper::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public SalaryPlannerResponse get(Long id) {
        return plannerMapper.toResponse(requireOwned(id));
    }

    @Transactional
    public SalaryPlannerResponse create(SalaryPlannerRequest request) {
        User user = currentUser.entity();
        SalaryPlanner planner = new SalaryPlanner(
                user,
                request.name() == null || request.name().isBlank() ? "My Plan" : request.name().trim(),
                Money.scale(request.totalSalary()));

        if (request.items() != null) {
            int position = 0;
            for (SalaryPlannerItemRequest item : request.items()) {
                planner.addItem(newItem(item, position++));
            }
        }
        recalculatePercentages(planner);
        return plannerMapper.toResponse(plannerRepository.save(planner));
    }

    /** Items sent on update replace the existing list wholesale; omitting them leaves them alone. */
    @Transactional
    public SalaryPlannerResponse update(Long id, SalaryPlannerRequest request) {
        SalaryPlanner planner = requireOwned(id);
        if (request.name() != null && !request.name().isBlank()) {
            planner.setName(request.name().trim());
        }
        planner.setTotalSalary(Money.scale(request.totalSalary()));

        if (request.items() != null) {
            planner.getItems().clear();
            int position = 0;
            for (SalaryPlannerItemRequest item : request.items()) {
                planner.addItem(newItem(item, position++));
            }
        }
        recalculatePercentages(planner);
        return plannerMapper.toResponse(plannerRepository.save(planner));
    }

    @Transactional
    public void delete(Long id) {
        plannerRepository.delete(requireOwned(id));
    }

    @Transactional
    public SalaryPlannerResponse addItem(Long plannerId, SalaryPlannerItemRequest request) {
        SalaryPlanner planner = requireOwned(plannerId);
        planner.addItem(newItem(request, planner.getItems().size()));
        recalculatePercentages(planner);
        return plannerMapper.toResponse(plannerRepository.save(planner));
    }

    @Transactional
    public SalaryPlannerResponse updateItem(Long plannerId, Long itemId, SalaryPlannerItemRequest request) {
        SalaryPlanner planner = requireOwned(plannerId);
        SalaryPlannerItem item = planner.getItems().stream()
                .filter(candidate -> candidate.getId().equals(itemId))
                .findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("Planner item " + itemId + " not found"));

        item.setName(request.name().trim());
        item.setAmount(Money.scale(request.amount()));
        if (request.color() != null) {
            item.setColor(request.color());
        }
        if (request.position() != null) {
            item.setPosition(request.position());
        }
        recalculatePercentages(planner);
        return plannerMapper.toResponse(plannerRepository.save(planner));
    }

    @Transactional
    public SalaryPlannerResponse deleteItem(Long plannerId, Long itemId) {
        SalaryPlanner planner = requireOwned(plannerId);
        SalaryPlannerItem item = planner.getItems().stream()
                .filter(candidate -> candidate.getId().equals(itemId))
                .findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("Planner item " + itemId + " not found"));

        planner.removeItem(item);
        recalculatePercentages(planner);
        return plannerMapper.toResponse(plannerRepository.save(planner));
    }

    private SalaryPlannerItem newItem(SalaryPlannerItemRequest request, int fallbackPosition) {
        String color = request.color() != null
                ? request.color()
                : PALETTE.get(fallbackPosition % PALETTE.size());
        return new SalaryPlannerItem(
                request.name().trim(),
                Money.scale(request.amount()),
                color,
                request.position() == null ? fallbackPosition : request.position());
    }

    /** Percentage of the salary, not of the allocated total, so under-allocation stays visible. */
    private void recalculatePercentages(SalaryPlanner planner) {
        planner.getItems().forEach(item ->
                item.setPercentage(Money.percentage(item.getAmount(), planner.getTotalSalary())));
    }

    private SalaryPlanner requireOwned(Long id) {
        return plannerRepository.findByIdAndUserId(id, currentUser.id())
                .orElseThrow(() -> new ResourceNotFoundException("Salary planner " + id + " not found"));
    }
}
