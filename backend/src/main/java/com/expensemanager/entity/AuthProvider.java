package com.expensemanager.entity;

/** How the account was created. Local accounts have a password hash, Google accounts do not. */
public enum AuthProvider {
    LOCAL,
    GOOGLE
}
