package com.expensemanager.dto.category;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * Folds several categories into one. keepId must be one of categoryIds: that category
 * survives with the combined budget and every other one is removed.
 */
public record CategoryMergeRequest(
        @NotNull @Size(min = 2, message = "pick at least two categories to merge") List<@NotNull Long> categoryIds,
        @NotNull Long keepId
) {}
