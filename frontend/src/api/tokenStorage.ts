import * as SecureStore from 'expo-secure-store';

/**
 * Tokens live in the platform keystore (Android Keystore / iOS Keychain) through
 * expo-secure-store - never AsyncStorage, which is plain text on disk.
 */
const ACCESS_KEY = 'em_access_token';
const REFRESH_KEY = 'em_refresh_token';

export type StoredTokens = {
  accessToken: string;
  refreshToken: string;
};

export async function saveTokens(tokens: StoredTokens): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(ACCESS_KEY, tokens.accessToken),
    SecureStore.setItemAsync(REFRESH_KEY, tokens.refreshToken),
  ]);
}

export async function loadTokens(): Promise<StoredTokens | null> {
  try {
    const [accessToken, refreshToken] = await Promise.all([
      SecureStore.getItemAsync(ACCESS_KEY),
      SecureStore.getItemAsync(REFRESH_KEY),
    ]);
    if (!accessToken || !refreshToken) {
      return null;
    }
    return { accessToken, refreshToken };
  } catch {
    // A corrupt or unavailable keystore is treated as "not signed in".
    return null;
  }
}

export async function clearTokens(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_KEY).catch(() => {}),
    SecureStore.deleteItemAsync(REFRESH_KEY).catch(() => {}),
  ]);
}

const USER_KEY = 'em_cached_user';

/**
 * The signed-in user's profile, kept alongside the tokens so a cold start can render
 * the app immediately instead of waiting on /auth/me. It is refreshed from the server
 * in the background; this copy only decides what to paint first.
 */
export async function saveCachedUser(user: unknown): Promise<void> {
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user)).catch(() => {});
}

export async function loadCachedUser<T>(): Promise<T | null> {
  try {
    const raw = await SecureStore.getItemAsync(USER_KEY);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function clearCachedUser(): Promise<void> {
  await SecureStore.deleteItemAsync(USER_KEY).catch(() => {});
}

/**
 * Reads the exp claim without verifying the signature. That is safe here because the
 * answer only decides whether to refresh proactively - the server still rejects a bad
 * token. Returns null when the token cannot be parsed.
 */
export function getTokenExpiry(token: string): number | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const normalised = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalised + '='.repeat((4 - (normalised.length % 4)) % 4);
    const json = JSON.parse(globalThis.atob(padded)) as { exp?: number };
    return typeof json.exp === 'number' ? json.exp * 1000 : null;
  } catch {
    return null;
  }
}

/** True when the token is missing, unparseable, or within a minute of expiring. */
export function isTokenExpired(token: string | null | undefined): boolean {
  if (!token) return true;
  const expiry = getTokenExpiry(token);
  if (expiry === null) return true;
  return expiry - Date.now() < 60_000;
}
