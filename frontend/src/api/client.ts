import axios, { AxiosError, AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios';

import { REQUEST_TIMEOUT_MS } from '../constants/config';
import { AuthResponse } from '../types/api';
import { getApiBaseUrl } from './apiHost';
import { clearTokens, loadTokens, saveTokens } from './tokenStorage';

type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean };

export const apiClient = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: REQUEST_TIMEOUT_MS,
  headers: { 'Content-Type': 'application/json' },
});

/** Access token held in memory so the common path never touches the keystore. */
let accessToken: string | null = null;
let refreshToken: string | null = null;

/** Set by the auth store so an unrecoverable 401 can drop the session. */
let onSessionExpired: (() => void) | null = null;

/** In-flight refresh, shared by every request that 401s at the same time. */
let refreshPromise: Promise<string> | null = null;

export function setSessionExpiredHandler(handler: (() => void) | null) {
  onSessionExpired = handler;
}

export function setTokens(tokens: { accessToken: string; refreshToken: string } | null) {
  accessToken = tokens?.accessToken ?? null;
  refreshToken = tokens?.refreshToken ?? null;
}

export async function hydrateTokensFromStorage() {
  const stored = await loadTokens();
  setTokens(stored);
  return stored;
}

apiClient.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.set('Authorization', `Bearer ${accessToken}`);
  }
  return config;
});

/** Refresh endpoints must not go through the interceptor, or a failure would loop. */
const bareClient = axios.create({ baseURL: getApiBaseUrl(), timeout: REQUEST_TIMEOUT_MS });

/** Both clients are created once, so a host change has to be pushed into them. */
export function applyApiBaseUrl(url: string) {
  apiClient.defaults.baseURL = url;
  bareClient.defaults.baseURL = url;
}

async function refreshAccessToken(): Promise<string> {
  if (!refreshToken) {
    throw new Error('No refresh token');
  }
  const response = await bareClient.post<AuthResponse>('/auth/refresh', { refreshToken });
  const tokens = {
    accessToken: response.data.accessToken,
    refreshToken: response.data.refreshToken,
  };
  setTokens(tokens);
  await saveTokens(tokens);
  return tokens.accessToken;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetriableConfig | undefined;
    const status = error.response?.status;
    const isAuthCall = config?.url?.includes('/auth/');

    if (status !== 401 || !config || config._retried || isAuthCall || !refreshToken) {
      return Promise.reject(error);
    }

    config._retried = true;
    try {
      // Every request that 401s while a refresh is running waits on the same promise,
      // so the app makes exactly one refresh call instead of one per request.
      if (!refreshPromise) {
        refreshPromise = refreshAccessToken().finally(() => {
          refreshPromise = null;
        });
      }
      const fresh = await refreshPromise;
      config.headers.set('Authorization', `Bearer ${fresh}`);
      return apiClient.request(config as AxiosRequestConfig);
    } catch (refreshError) {
      // Only a refusal from the server means the session is really over. A refresh that
      // failed because the request never landed - timeout, no signal, server asleep -
      // must leave the tokens alone, otherwise a bad moment of connectivity signs the
      // user out permanently and they have to log in again on next launch.
      const refused =
        axios.isAxiosError(refreshError) &&
        refreshError.response !== undefined &&
        [400, 401, 403].includes(refreshError.response.status);

      if (refused) {
        setTokens(null);
        await clearTokens();
        onSessionExpired?.();
      }
      return Promise.reject(refreshError);
    }
  },
);

/** Unauthenticated ping used to tell "server down" apart from "signed out". */
export async function pingServer(): Promise<boolean> {
  try {
    await bareClient.get('/health', { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

export { bareClient };
