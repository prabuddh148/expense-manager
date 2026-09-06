package com.expensemanager.dto.common;

import org.springframework.data.domain.Page;

import java.util.List;
import java.util.function.Function;

/** Slim page envelope - the client only needs these fields, not the whole Spring Page shape. */
public record PageResponse<T>(
        List<T> content,
        int page,
        int size,
        long totalElements,
        int totalPages,
        boolean last
) {
    public static <E, T> PageResponse<T> of(Page<E> page, Function<E, T> mapper) {
        return new PageResponse<>(
                page.getContent().stream().map(mapper).toList(),
                page.getNumber(),
                page.getSize(),
                page.getTotalElements(),
                page.getTotalPages(),
                page.isLast());
    }
}
