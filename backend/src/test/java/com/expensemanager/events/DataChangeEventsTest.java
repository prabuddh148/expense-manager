package com.expensemanager.events;

import com.expensemanager.dto.expense.ExpenseRequest;
import com.expensemanager.support.ApiTestBase;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.event.ApplicationEvents;
import org.springframework.test.context.event.RecordApplicationEvents;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@RecordApplicationEvents
class DataChangeEventsTest extends ApiTestBase {

    @Autowired
    private ApplicationEvents events;

    private List<DataChange> expenseChanges() {
        return events.stream(DataCommittedEvent.class)
                .flatMap(event -> event.changes().stream())
                .filter(change -> change.entityType().equals("Expense"))
                .toList();
    }

    @Test
    @DisplayName("creating and deleting an expense publishes both changes after commit")
    void expenseWritesArePublished() throws Exception {
        String body = mockMvc.perform(authed(post("/api/expenses"), new ExpenseRequest(
                        new BigDecimal("250.50"), null, "Chai", null, LocalDate.now(), null)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        long id = objectMapper.readTree(body).get("id").asLong();

        mockMvc.perform(authed(delete("/api/expenses/" + id)))
                .andExpect(status().isNoContent());

        assertThat(expenseChanges())
                .extracting(DataChange::action, DataChange::entityId, DataChange::userId)
                .containsExactly(
                        org.assertj.core.groups.Tuple.tuple(ChangeAction.CREATED, id, session.user().id()),
                        org.assertj.core.groups.Tuple.tuple(ChangeAction.DELETED, id, session.user().id()));
        assertThat(expenseChanges().getFirst().amount()).isEqualByComparingTo("250.50");
    }

    @Test
    @DisplayName("a rejected write publishes nothing")
    void failedWritePublishesNothing() throws Exception {
        // Other without a name is refused before anything is saved.
        mockMvc.perform(authed(post("/api/expenses"), new ExpenseRequest(
                        new BigDecimal("10"), null, null, null, LocalDate.now(), null)))
                .andExpect(status().isBadRequest());

        assertThat(expenseChanges()).isEmpty();
    }
}
