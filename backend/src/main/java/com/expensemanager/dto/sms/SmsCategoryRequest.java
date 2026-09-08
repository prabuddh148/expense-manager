package com.expensemanager.dto.sms;

import jakarta.validation.constraints.NotNull;

/** The category the user picked. Never inferred by the server. */
public record SmsCategoryRequest(
        @NotNull Long categoryId
) {}
