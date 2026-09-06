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

  logout: (refreshToken: string) => bareClient.post('/auth/logout', { refreshToken }),

  me: () => apiClient.get<User>('/auth/me').then((r) => r.data),
};
