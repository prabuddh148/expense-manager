package com.expensemanager.mail;

import com.expensemanager.exception.ServiceUnavailableException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.Map;

/**
 * Sends transactional email through Brevo's HTTP API.
 *
 * Not SMTP on purpose: Render's free web services block outbound traffic on the SMTP
 * ports, so Gmail or any other SMTP relay would time out once deployed. An HTTPS API
 * goes out on 443 like any other request.
 *
 * With no API key, local runs can set app.mail.log-only to print the message instead;
 * anywhere else the send fails loudly rather than pretending an email went out.
 */
@Service
public class EmailSender {

    private static final Logger log = LoggerFactory.getLogger(EmailSender.class);
    private static final URI BREVO_SEND_URI = URI.create("https://api.brevo.com/v3/smtp/email");

    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();

    private final ObjectMapper objectMapper;
    private final String apiKey;
    private final String fromEmail;
    private final String fromName;
    private final boolean logOnly;

    public EmailSender(ObjectMapper objectMapper,
                       @Value("${app.mail.brevo-api-key:}") String apiKey,
                       @Value("${app.mail.from-email:}") String fromEmail,
                       @Value("${app.mail.from-name:Expense Manager}") String fromName,
                       @Value("${app.mail.log-only:false}") boolean logOnly) {
        this.objectMapper = objectMapper;
        this.apiKey = apiKey.trim();
        this.fromEmail = fromEmail.trim();
        this.fromName = fromName.trim();
        this.logOnly = logOnly;
    }

    public boolean isConfigured() {
        return !apiKey.isEmpty() && !fromEmail.isEmpty();
    }

    public void send(String toEmail, String toName, String subject, String text, String html) {
        if (!isConfigured()) {
            if (logOnly) {
                log.warn("Email not configured, logging instead. To: {} | {}\n{}", toEmail, subject, text);
                return;
            }
            throw new ServiceUnavailableException(
                    "Email is not configured on this server. Set BREVO_API_KEY and MAIL_FROM_EMAIL.");
        }

        Map<String, Object> body = Map.of(
                "sender", Map.of("name", fromName, "email", fromEmail),
                "to", List.of(Map.of("email", toEmail, "name", toName)),
                "subject", subject,
                "textContent", text,
                "htmlContent", html);

        try {
            HttpRequest request = HttpRequest.newBuilder(BREVO_SEND_URI)
                    .timeout(Duration.ofSeconds(10))
                    .header("api-key", apiKey)
                    .header("Content-Type", "application/json")
                    .header("Accept", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(body)))
                    .build();
            HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() / 100 != 2) {
                log.error("Brevo rejected the email to {}: {} {}", toEmail, response.statusCode(), response.body());
                throw new ServiceUnavailableException("Could not send the email right now. Please try again shortly.");
            }
        } catch (IOException ex) {
            log.error("Could not reach Brevo to email {}", toEmail, ex);
            throw new ServiceUnavailableException("Could not send the email right now. Please try again shortly.");
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new ServiceUnavailableException("Could not send the email right now. Please try again shortly.");
        }
    }
}
