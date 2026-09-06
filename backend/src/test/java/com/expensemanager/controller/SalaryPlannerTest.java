package com.expensemanager.controller;

import com.expensemanager.dto.planner.SalaryPlannerItemRequest;
import com.expensemanager.dto.planner.SalaryPlannerRequest;
import com.expensemanager.support.ApiTestBase;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** The 45,000 salary split from the brief, including the leftover the pie chart shows. */
class SalaryPlannerTest extends ApiTestBase {

    private SalaryPlannerItemRequest item(String name, String amount) {
        return new SalaryPlannerItemRequest(name, new BigDecimal(amount), null, null);
    }

    private long createPlan() throws Exception {
        SalaryPlannerRequest request = new SalaryPlannerRequest("September Plan",
                new BigDecimal("45000"),
                List.of(item("EMI", "18000"),
                        item("Commute", "3500"),
                        item("Food", "5000"),
                        item("Personal", "2000"),
                        item("Recharge", "500"),
                        item("Savings", "10000"),
                        item("Other", "6000")));

        String body = mockMvc.perform(authed(post("/api/salary-planner"), request))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(body).get("id").asLong();
    }

    @Test
    @DisplayName("allocations, remainder and percentages are computed from the amounts")
    void percentagesAreDerived() throws Exception {
        long plan = createPlan();

        mockMvc.perform(authed(get("/api/salary-planner/" + plan)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalSalary").value(45000.00))
                .andExpect(jsonPath("$.totalAllocated").value(45000.00))
                .andExpect(jsonPath("$.remainingAmount").value(0.00))
                .andExpect(jsonPath("$.allocatedPercentage").value(100.00))
                .andExpect(jsonPath("$.overAllocated").value(false))
                .andExpect(jsonPath("$.items.length()").value(7))
                .andExpect(jsonPath("$.items[0].name").value("EMI"))
                .andExpect(jsonPath("$.items[0].percentage").value(40.00))
                .andExpect(jsonPath("$.items[2].name").value("Food"))
                .andExpect(jsonPath("$.items[2].percentage").value(11.11))
                .andExpect(jsonPath("$.items[0].color").isNotEmpty());
    }

    @Test
    @DisplayName("a partly allocated plan reports what is left over")
    void underAllocationLeavesRemainder() throws Exception {
        String body = mockMvc.perform(authed(post("/api/salary-planner"),
                        new SalaryPlannerRequest(null, new BigDecimal("45000"),
                                List.of(item("Savings", "10000")))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("My Plan"))
                .andExpect(jsonPath("$.totalAllocated").value(10000.00))
                .andExpect(jsonPath("$.remainingAmount").value(35000.00))
                .andExpect(jsonPath("$.allocatedPercentage").value(22.22))
                .andReturn().getResponse().getContentAsString();

        org.assertj.core.api.Assertions.assertThat(body).contains("Savings");
    }

    @Test
    @DisplayName("over-allocating is allowed but flagged")
    void overAllocationIsFlagged() throws Exception {
        mockMvc.perform(authed(post("/api/salary-planner"),
                        new SalaryPlannerRequest("Tight", new BigDecimal("10000"),
                                List.of(item("Rent", "12000")))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.remainingAmount").value(-2000.00))
                .andExpect(jsonPath("$.overAllocated").value(true));
    }

    @Test
    @DisplayName("adding, editing and deleting a section recomputes every percentage")
    void itemLifecycle() throws Exception {
        long plan = createPlan();

        String afterAdd = mockMvc.perform(authed(post("/api/salary-planner/" + plan + "/items"),
                        item("Gym", "1000")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.totalAllocated").value(46000.00))
                .andExpect(jsonPath("$.overAllocated").value(true))
                .andReturn().getResponse().getContentAsString();

        long gymId = objectMapper.readTree(afterAdd).get("items").get(7).get("id").asLong();

        mockMvc.perform(authed(put("/api/salary-planner/" + plan + "/items/" + gymId),
                        item("Gym membership", "2250")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[7].name").value("Gym membership"))
                .andExpect(jsonPath("$.items[7].percentage").value(5.00));

        mockMvc.perform(authed(delete("/api/salary-planner/" + plan + "/items/" + gymId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(7))
                .andExpect(jsonPath("$.totalAllocated").value(45000.00));
    }

    @Test
    @DisplayName("updating a plan replaces its sections and rescales the percentages")
    void updateReplacesItems() throws Exception {
        long plan = createPlan();

        mockMvc.perform(authed(put("/api/salary-planner/" + plan),
                        new SalaryPlannerRequest("October Plan", new BigDecimal("50000"),
                                List.of(item("EMI", "20000"), item("Savings", "30000")))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("October Plan"))
                .andExpect(jsonPath("$.items.length()").value(2))
                .andExpect(jsonPath("$.items[0].percentage").value(40.00))
                .andExpect(jsonPath("$.items[1].percentage").value(60.00));
    }

    @Test
    @DisplayName("plans are private to their owner")
    void plansAreScopedPerUser() throws Exception {
        long plan = createPlan();
        signUpFreshUser();

        mockMvc.perform(authed(get("/api/salary-planner/" + plan)))
                .andExpect(status().isNotFound());
        mockMvc.perform(authed(get("/api/salary-planner")))
                .andExpect(jsonPath("$.length()").value(0));
    }
}
