package com.expensemanager.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

/**
 * Free hosting spins the service down after a stretch with no inbound request, and
 * waking it again costs the first caller ~40 seconds. This keeps the instance warm by
 * calling its own public health endpoint, which arrives through the platform's proxy
 * and therefore counts as real traffic.
 *
 * It is deliberately not the only defence: it can only keep an already-running instance
 * awake, so the scheduled GitHub workflow stays in place to wake a service that did go
 * to sleep - after a deploy, a crash, or a platform restart.
 *
 * Disabled unless a public URL is known, so local runs and tests never ping anything.
 */
@Component
public class KeepAwakeTask {

    private static final Logger log = LoggerFactory.getLogger(KeepAwakeTask.class);

    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .followRedirects(HttpClient.Redirect.NORMAL)
            .build();

    private final String healthUrl;

    public KeepAwakeTask(@Value("${app.self-url:}") String selfUrl) {
        String trimmed = selfUrl == null ? "" : selfUrl.trim();
        this.healthUrl = trimmed.isEmpty()
                ? null
                : trimmed.replaceAll("/+$", "") + "/api/health";
    }

    @Scheduled(initialDelayString = "PT30S", fixedRateString = "PT30S")
    public void ping() {
        if (healthUrl == null) {
            return;
        }
        try {
            HttpRequest request = HttpRequest.newBuilder(URI.create(healthUrl))
                    .timeout(Duration.ofSeconds(10))
                    .GET()
                    .build();
            // The response body is irrelevant; the request itself is the point.
            http.send(request, HttpResponse.BodyHandlers.discarding());
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
        } catch (Exception ex) {
            // A failed ping is not worth an error log every 30 seconds - the next one
            // is a moment away, and the external workflow covers a genuine outage.
            log.debug("Keep-awake ping failed: {}", ex.getMessage());
        }
    }
}
