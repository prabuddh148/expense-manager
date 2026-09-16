package com.expensemanager.mail;

import com.expensemanager.exception.ServiceUnavailableException;
import com.fasterxml.jackson.databind.JsonNode;
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
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Sends transactional email over HTTPS, never SMTP: Render's free web services block
 * outbound traffic on the SMTP ports, so a Gmail app password would time out once deployed.
 *
 * Two routes, tried in this order:
 * <ol>
 *   <li>Gmail, through the Google Apps Script web app in backend/gmail-apps-script.gs.
 *       The script runs as the Gmail account that deployed it and sends from that inbox.</li>
 *   <li>Brevo's transactional email API.</li>
 * </ol>
 *
 * With neither configured, local runs can set app.mail.log-only to print the message
 * instead; anywhere else the send fails loudly rather than pretending an email went out.
 */
@Service
public class EmailSender {

    private static final Logger log = LoggerFactory.getLogger(EmailSender.class);
    private static final URI BREVO_SEND_URI = URI.create("https://api.brevo.com/v3/smtp/email");
    private static final String SEND_FAILED = "Could not send the email right now. Please try again shortly.";

    // Apps Script answers a POST with a redirect to where its output is served.
    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .followRedirects(HttpClient.Redirect.NORMAL)
            .build();

    private final ObjectMapper objectMapper;
    private final String gmailScriptUrl;
    private final String gmailScriptSecret;
    private final String brevoApiKey;
    private final String fromEmail;
    private final String fromName;
    private final boolean logOnly;

    public EmailSender(ObjectMapper objectMapper,
                       @Value("${app.mail.gmail-script-url:}") String gmailScriptUrl,
                       @Value("${app.mail.gmail-script-secret:}") String gmailScriptSecret,
                       @Value("${app.mail.brevo-api-key:}") String brevoApiKey,
                       @Value("${app.mail.from-email:}") String fromEmail,
                       @Value("${app.mail.from-name:Expense Manager}") String fromName,
                       @Value("${app.mail.log-only:false}") boolean logOnly) {
        this.objectMapper = objectMapper;
        this.gmailScriptUrl = gmailScriptUrl.trim();
        this.gmailScriptSecret = gmailScriptSecret.trim();
        this.brevoApiKey = brevoApiKey.trim();
        this.fromEmail = fromEmail.trim();
        this.fromName = fromName.trim();
        this.logOnly = logOnly;
    }

    public boolean isConfigured() {
        return usesGmail() || usesBrevo();
    }

    private boolean usesGmail() {
        return !gmailScriptUrl.isEmpty() && !gmailScriptSecret.isEmpty();
    }

    private boolean usesBrevo() {
        return !brevoApiKey.isEmpty() && !fromEmail.isEmpty();
    }

    public void send(String toEmail, String toName, String subject, String text, String html) {
        if (usesGmail()) {
            sendThroughGmail(toEmail, subject, text, html);
        } else if (usesBrevo()) {
            sendThroughBrevo(toEmail, toName, subject, text, html);
        } else if (logOnly) {
            log.warn("Email not configured, logging instead. To: {} | {}\n{}", toEmail, subject, text);
        } else {
            throw new ServiceUnavailableException(
                    "Email is not configured on this server. Set GMAIL_SCRIPT_URL and GMAIL_SCRIPT_SECRET.");
        }
    }

    private void sendThroughGmail(String toEmail, String subject, String text, String html) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("secret", gmailScriptSecret);
        body.put("to", toEmail);
        body.put("subject", subject);
        body.put("text", text);
        body.put("html", html);
        body.put("fromName", fromName);

        HttpResponse<String> response = post(URI.create(gmailScriptUrl), body, Map.of(), toEmail);
        // The script always answers 200, so success is only what its JSON says.
        boolean ok = false;
        try {
            JsonNode reply = objectMapper.readTree(response.body());
            ok = reply.path("ok").asBoolean(false);
        } catch (IOException ex) {
            // Not JSON: usually Google's HTML sign-in page, meaning the web app is not
            // deployed with access for "Anyone".
        }
        if (response.statusCode() / 100 != 2 || !ok) {
            log.error("Gmail script did not send the email to {}: {} {}",
                    toEmail, response.statusCode(), abbreviate(response.body()));
            throw new ServiceUnavailableException(SEND_FAILED);
        }
    }

    private void sendThroughBrevo(String toEmail, String toName, String subject, String text, String html) {
        Map<String, Object> body = Map.of(
                "sender", Map.of("name", fromName, "email", fromEmail),
                "to", List.of(Map.of("email", toEmail, "name", toName)),
                "subject", subject,
                "textContent", text,
                "htmlContent", html);

        HttpResponse<String> response = post(BREVO_SEND_URI, body, Map.of("api-key", brevoApiKey), toEmail);
        if (response.statusCode() / 100 != 2) {
            log.error("Brevo rejected the email to {}: {} {}", toEmail, response.statusCode(), response.body());
            throw new ServiceUnavailableException(SEND_FAILED);
        }
    }

    private HttpResponse<String> post(URI uri, Object body, Map<String, String> headers, String toEmail) {
        try {
            HttpRequest.Builder request = HttpRequest.newBuilder(uri)
                    .timeout(Duration.ofSeconds(15))
                    .header("Content-Type", "application/json")
                    .header("Accept", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(body)));
            headers.forEach(request::header);
            return http.send(request.build(), HttpResponse.BodyHandlers.ofString());
        } catch (IOException ex) {
            log.error("Could not reach the email provider to email {}", toEmail, ex);
            throw new ServiceUnavailableException(SEND_FAILED);
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new ServiceUnavailableException(SEND_FAILED);
        }
    }

    private static String abbreviate(String value) {
        return value == null || value.length() <= 300 ? value : value.substring(0, 300) + "...";
    }
}
