package com.expensemanager.security;

import com.expensemanager.entity.RecordSource;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.EnumSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Which sections of the app the caller has switched off.
 *
 * The app sends the list in a header on every request, and every total the server
 * computes reads it through here. Hiding a section in the app is then also hiding its
 * figures: with EMI off, instalments stop counting against the salary, and with SMS off
 * the expenses created from SMS drop out of every sum and list. Nothing is deleted - the
 * next request without the header sees everything again.
 *
 * Kept per request rather than stored per user so the setting belongs to the device
 * that made it, and so an unknown or missing header can only ever mean "show it all".
 */
@Component
public class FeatureVisibility {

    public static final String HEADER = "X-Hidden-Features";

    /** The sections whose data other parts of the app count. The rest only hide a tab. */
    public enum Feature {
        EXPENSES,
        EMI,
        MONEY_TRACKER,
        SMS
    }

    public boolean isHidden(Feature feature) {
        return hidden().contains(feature);
    }

    public boolean emiVisible() {
        return !isHidden(Feature.EMI);
    }

    /** Salary additions only ever come from the Money Tracker's add-on action. */
    public boolean salaryAdditionsVisible() {
        return !isHidden(Feature.MONEY_TRACKER);
    }

    /**
     * The expense origins that still count. Empty when expenses are hidden altogether,
     * which every query treats as "match nothing".
     */
    public List<RecordSource> expenseSources() {
        Set<Feature> hidden = hidden();
        if (hidden.contains(Feature.EXPENSES)) {
            return List.of();
        }
        List<RecordSource> sources = new ArrayList<>(List.of(RecordSource.values()));
        if (hidden.contains(Feature.SMS)) {
            sources.remove(RecordSource.SMS);
        }
        if (hidden.contains(Feature.MONEY_TRACKER)) {
            sources.remove(RecordSource.MONEY_TRACKER);
        }
        return sources;
    }

    private Set<Feature> hidden() {
        if (!(RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attributes)) {
            // Scheduled work has no caller to ask, so it sees everything.
            return EnumSet.noneOf(Feature.class);
        }
        return parse(attributes.getRequest());
    }

    private static Set<Feature> parse(HttpServletRequest request) {
        Set<Feature> hidden = EnumSet.noneOf(Feature.class);
        String header = request.getHeader(HEADER);
        if (header == null || header.isBlank()) {
            return hidden;
        }
        Arrays.stream(header.split(","))
                .map(token -> token.trim().toUpperCase(Locale.ROOT).replace('-', '_'))
                .forEach(token -> {
                    // Sections that only hide a tab (analytics, savings...) arrive here too.
                    for (Feature feature : Feature.values()) {
                        if (feature.name().equals(token)) {
                            hidden.add(feature);
                        }
                    }
                });
        return hidden;
    }
}
