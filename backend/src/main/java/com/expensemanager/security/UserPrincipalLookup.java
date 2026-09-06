package com.expensemanager.security;

import com.expensemanager.repository.UserRepository;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Loads a principal by id, which is what the JWT subject carries. */
@Service
public class UserPrincipalLookup {

    private final UserRepository userRepository;

    public UserPrincipalLookup(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public AppUserPrincipal loadById(Long userId) {
        return userRepository.findById(userId)
                .map(AppUserPrincipal::new)
                .orElseThrow(() -> new UsernameNotFoundException("No user with id " + userId));
    }
}
