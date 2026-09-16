import { apiClient, bareClient } from '../client';
import { AuthResponse, User } from '../../types/api';

export const authApi = {
  signup: (name: string, email: string, password: string) =>
    bareClient
      .post<AuthResponse>('/auth/signup', { name, email, password })
      .then((response) => response.data),

  login: (email: string, password: string) =>
    bareClient.post<AuthResponse>('/auth/login', { email, password }).then((r) => r.data),

  /** Exchanges a Google ID token for an application session. */
  google: (idToken: string) =>
    bareClient.post<AuthResponse>('/auth/google', { idToken }).then((r) => r.data),

  /** Emails a 6 digit reset code. Answers the same whether or not the account exists. */
  forgotPassword: (email: string) =>
    bareClient
      .post<{ message: string }>('/auth/forgot-password', { email })
      .then((r) => r.data),

  /** Checks the code without using it up, so the next step can ask for the new password. */
  verifyResetOtp: (email: string, otp: string) =>
    bareClient
      .post<{ message: string }>('/auth/verify-reset-otp', { email, otp })
      .then((r) => r.data),

  resetPassword: (email: string, otp: string, newPassword: string) =>
    bareClient.post('/auth/reset-password', { email, otp, newPassword }).then(() => true),

  logout: (refreshToken: string) => bareClient.post('/auth/logout', { refreshToken }),

  me: () => apiClient.get<User>('/auth/me').then((r) => r.data),
};
