package com.expensemanager.gateway;

import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.reactive.server.WebTestClient;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;

/** Two stub HTTP servers stand in for the expense API and the activity-service. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class GatewayRoutingTest {

    private static final HttpServer EXPENSE_API = stub("expense-api");
    private static final HttpServer ACTIVITY_SERVICE = stub("activity-service");

    @Autowired
    private WebTestClient client;

    @DynamicPropertySource
    static void routes(DynamicPropertyRegistry registry) {
        registry.add("EXPENSE_API_URL", () -> "http://localhost:" + EXPENSE_API.getAddress().getPort());
        registry.add("ACTIVITY_SERVICE_URL", () -> "http://localhost:" + ACTIVITY_SERVICE.getAddress().getPort());
    }

    @AfterAll
    static void stop() {
        EXPENSE_API.stop(0);
        ACTIVITY_SERVICE.stop(0);
    }

    /** Replies "<name> <path> auth=<Authorization> id=<X-Request-Id>" with status 201 for POSTs. */
    private static HttpServer stub(String name) {
        try {
            HttpServer server = HttpServer.create(new InetSocketAddress("localhost", 0), 0);
            server.createContext("/", exchange -> {
                String body = name + " " + exchange.getRequestURI()
                        + " auth=" + exchange.getRequestHeaders().getFirst("Authorization")
                        + " id=" + exchange.getRequestHeaders().getFirst(RequestIdFilter.HEADER);
                byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
                exchange.sendResponseHeaders("POST".equals(exchange.getRequestMethod()) ? 201 : 200, bytes.length);
                exchange.getResponseBody().write(bytes);
                exchange.close();
            });
            server.start();
            return server;
        } catch (IOException ex) {
            throw new UncheckedIOException(ex);
        }
    }

    @Test
    @DisplayName("/api/activity goes to the activity-service")
    void activityRoute() {
        client.get().uri("/api/activity/summary").header("Authorization", "Bearer abc")
                .exchange()
                .expectStatus().isOk()
                .expectBody(String.class).value(body -> org.assertj.core.api.Assertions.assertThat(body)
                        .startsWith("activity-service /api/activity/summary auth=Bearer abc"));
    }

    @Test
    @DisplayName("everything else under /api goes to the expense API with query, headers and status intact")
    void expenseRoute() {
        client.post().uri("/api/expenses?page=2")
                .header("Authorization", "Bearer xyz")
                .header(RequestIdFilter.HEADER, "req-123")
                .exchange()
                .expectStatus().isCreated()
                .expectHeader().valueEquals(RequestIdFilter.HEADER, "req-123")
                .expectBody(String.class).isEqualTo("expense-api /api/expenses?page=2 auth=Bearer xyz id=req-123");
    }

    @Test
    @DisplayName("a request without an id gets one generated")
    void generatesRequestId() {
        client.get().uri("/api/health")
                .exchange()
                .expectStatus().isOk()
                .expectHeader().exists(RequestIdFilter.HEADER);
    }
}
