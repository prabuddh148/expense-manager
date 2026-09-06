package com.expensemanager.mapper;

import com.expensemanager.dto.auth.UserResponse;
import com.expensemanager.entity.User;
import org.springframework.stereotype.Component;

/** Keeps entities from leaking out of the controllers. */
@Component
public class UserMapper {

    public UserResponse toResponse(User user) {
        return new UserResponse(
                user.getId(),
                user.getName(),
                user.getEmail(),
                user.getProvider().name(),
                user.getCreatedAt()
        );
    }
}
