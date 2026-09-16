package com.expensemanager.mail;

import com.expensemanager.exception.ServiceUnavailableException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Stands in for a deployed Apps Script web app, which answers the POST with a 302 to the
 * URL its output is served from - the part most likely to break a real send.
 */
class EmailSenderTest {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final AtomicReference<String> received = new AtomicReference<>();
    private final AtomicReference<String> scriptReply = new AtomicReference<>("{\"ok\":true}");
    private HttpServer server;
    private String execUrl;

    @BeforeEach
    void startFakeScript() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/exec", exchange -> {
            received.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            exchange.getResponseHeaders().add("Location", "/echo");
            exchange.sendResponseHeaders(302, -1);
            exchange.close();
        });
        server.createContext("/echo", exchange -> respond(exchange, scriptReply.get()));
        server.start();
        execUrl = "http://127.0.0.1:" + server.getAddress().getPort() + "/exec";
    }

    @AfterEach
    void stop() {
        server.stop(0);
    }

    @Test
    @DisplayName("Gmail route posts the message and secret, following the script's redirect")
    void sendsThroughGmailScript() throws Exception {
        sender(execUrl, "s3cret").send("user@example.com", "User", "Subject", "Code 123456", "<b>123456</b>");

        JsonNode body = objectMapper.readTree(received.get());
        assertThat(body.path("secret").asText()).isEqualTo("s3cret");
        assertThat(body.path("to").asText()).isEqualTo("user@example.com");
        assertThat(body.path("subject").asText()).isEqualTo("Subject");
        assertThat(body.path("text").asText()).isEqualTo("Code 123456");
        assertThat(body.path("html").asText()).isEqualTo("<b>123456</b>");
    }

    @Test
    @DisplayName("a script that reports failure, or answers with HTML, fails the send")
    void scriptFailureIsAnError() {
        scriptReply.set("{\"ok\":false,\"error\":\"forbidden\"}");
        assertThatThrownBy(() -> sender(execUrl, "wrong").send("u@example.com", "U", "S", "T", "H"))
                .isInstanceOf(ServiceUnavailableException.class);

        scriptReply.set("<html>Sign in</html>");
        assertThatThrownBy(() -> sender(execUrl, "s3cret").send("u@example.com", "U", "S", "T", "H"))
                .isInstanceOf(ServiceUnavailableException.class);
    }

    @Test
    @DisplayName("with nothing configured the send is refused unless log-only is on")
    void unconfigured() {
        EmailSender strict = new EmailSender(objectMapper, "", "", "", "", "Expense Manager", false);
        assertThat(strict.isConfigured()).isFalse();
        assertThatThrownBy(() -> strict.send("u@example.com", "U", "S", "T", "H"))
                .isInstanceOf(ServiceUnavailableException.class);

        new EmailSender(objectMapper, "", "", "", "", "Expense Manager", true)
                .send("u@example.com", "U", "S", "T", "H");
    }

    private EmailSender sender(String url, String secret) {
        return new EmailSender(objectMapper, url, secret, "", "", "Expense Manager", false);
    }

    private static void respond(HttpExchange exchange, String body) throws IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        exchange.sendResponseHeaders(200, bytes.length);
        exchange.getResponseBody().write(bytes);
        exchange.close();
    }
}
