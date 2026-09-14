package com.expensemanager.events;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/** Published once for every transaction that committed changes to user data. */
public record DataCommittedEvent(List<DataChange> changes) {

    public Set<Long> userIds() {
        Set<Long> ids = new LinkedHashSet<>();
        changes.forEach(change -> ids.add(change.userId()));
        return ids;
    }
}
