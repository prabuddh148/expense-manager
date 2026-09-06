package com.expensemanager.security;

import com.expensemanager.entity.User;
import com.expensemanager.exception.UnauthorizedException;
import com.expensemanager.repository.UserRepository;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

/**
 * Single place that answers "who is calling?". Every service scopes its queries through
 * this so a user can never read or write another user's rows.
 */
@Component
public class CurrentUser {

    private final UserRepository userRepository;

    public CurrentUser(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public Long id() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof AppUserPrincipal principal)) {
            throw new UnauthorizedException("Not authenticated");
        }
        return principal.getId();
    }

    public User entity() {
        Long id = id();
        return userRepository.findById(id)
                .orElseThrow(() -> new UnauthorizedException("Account no longer exists"));
    }
}
