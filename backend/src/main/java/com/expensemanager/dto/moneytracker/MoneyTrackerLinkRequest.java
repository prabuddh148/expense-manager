package com.expensemanager.dto.moneytracker;

/** Optional extras when pushing a payable into the expense system. */
public record MoneyTrackerLinkRequest(
        /** Files the generated expense under one of the user categories; Other when null. */
        Long categoryId
) {}
