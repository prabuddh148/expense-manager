import AsyncStorage from '@react-native-async-storage/async-storage';

import { API_BASE_URL } from '../constants/config';

const STORAGE_KEY = 'api.base-url.override';

/**
 * The build-time EXPO_PUBLIC_API_URL is the default, but a release APK is otherwise stuck
 * with whatever address it was compiled against. Keeping an override in storage lets the
 * same installed build follow the backend from a laptop on the LAN to a deployed host.
 *
 * Held in a module-level variable as well as storage so the axios interceptors can read it
 * synchronously on every request.
 */
let current = API_BASE_URL;

export function getApiBaseUrl(): string {
  return current;
}

export function getDefaultApiBaseUrl(): string {
  return API_BASE_URL;
}

/** Called once on startup, before the first request goes out. */
export async function loadApiBaseUrl(): Promise<string> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (stored) {
      current = stored;
    }
  } catch {
    // A storage failure just means the build-time default stays in force.
  }
  return current;
}

export async function setApiBaseUrl(url: string): Promise<void> {
  const cleaned = normalise(url);
  current = cleaned;
  await AsyncStorage.setItem(STORAGE_KEY, cleaned);
}

export async function resetApiBaseUrl(): Promise<void> {
  current = API_BASE_URL;
  await AsyncStorage.removeItem(STORAGE_KEY);
}

/** Trims trailing slashes and appends the /api suffix when the user omits it. */
export function normalise(url: string): string {
  let value = url.trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(value)) {
    value = `https://${value}`;
  }
  if (!/\/api$/i.test(value)) {
    value = `${value}/api`;
  }
  return value;
}
