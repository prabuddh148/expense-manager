import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  applyApiBaseUrl,
  authApi,
  clearCachedUser,
  clearTokens,
  hydrateTokensFromStorage,
  loadApiBaseUrl,
  loadCachedUser,
  saveCachedUser,
  saveTokens,
  setSessionExpiredHandler,
  setTokens,
} from '../api';
import { AuthResponse, User } from '../types/api';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

type AuthContextValue = {
  status: AuthStatus;
  user: User | null;
  /** Set when the session ended on its own, so Login can explain why. */
  sessionExpired: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signInWithGoogle: (idToken: string) => Promise<void>;
  signOut: () => Promise<void>;
  clearSessionExpired: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [refreshToken, setRefreshTokenValue] = useState<string | null>(null);

  const applySession = useCallback(async (session: AuthResponse) => {
    setTokens({ accessToken: session.accessToken, refreshToken: session.refreshToken });
    await saveTokens({
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
    });
    setRefreshTokenValue(session.refreshToken);
    setUser(session.user);
    void saveCachedUser(session.user);
    setSessionExpired(false);
    setStatus('authenticated');
  }, []);

  const endSession = useCallback(async (expired: boolean) => {
    setTokens(null);
    await Promise.all([clearTokens(), clearCachedUser()]);
    setRefreshTokenValue(null);
    setUser(null);
    setSessionExpired(expired);
    setStatus('unauthenticated');
  }, []);

  // The API client calls this when a refresh fails, i.e. the session cannot be saved.
  useEffect(() => {
    setSessionExpiredHandler(() => {
      void endSession(true);
    });
    return () => setSessionExpiredHandler(null);
  }, [endSession]);

  /**
   * Cold start. Everything that decides which screen to show is read from the device,
   * so the splash lasts as long as a keystore read rather than a network round trip.
   *
   * The old flow awaited /auth/me before letting anyone in, which meant the splash sat
   * there for the API's cold start - and worse, treated a failed request as "signed
   * out" and wiped the session. Now the server only ever confirms what the device
   * already decided, in the background, and a network failure changes nothing.
   */
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const [apiBaseUrl, stored, cachedUser] = await Promise.all([
        loadApiBaseUrl(),
        hydrateTokensFromStorage(),
        loadCachedUser<User>(),
      ]);
      applyApiBaseUrl(apiBaseUrl);

      if (cancelled) return;

      if (!stored) {
        setStatus('unauthenticated');
        return;
      }

      setRefreshTokenValue(stored.refreshToken);

      // A stored refresh token is enough to enter the app. The access token may well be
      // expired after a few hours away; the interceptor renews it on the first request.
      setUser(cachedUser);
      setStatus('authenticated');

      // Background confirmation. Nothing here blocks the UI, and only an explicit
      // refusal from the server ends the session - handled by setSessionExpiredHandler.
      void (async () => {
        try {
          const me = await authApi.me();
          if (!cancelled) {
            setUser(me);
            void saveCachedUser(me);
          }
        } catch {
          // Offline or server asleep: keep the cached profile and stay signed in.
        }
      })();
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(
    async (email: string, password: string) => {
      await applySession(await authApi.login(email.trim(), password));
    },
    [applySession],
  );

  const signUp = useCallback(
    async (name: string, email: string, password: string) => {
      await applySession(await authApi.signup(name.trim(), email.trim(), password));
    },
    [applySession],
  );

  const signInWithGoogle = useCallback(
    async (idToken: string) => {
      await applySession(await authApi.google(idToken));
    },
    [applySession],
  );

  const signOut = useCallback(async () => {
    if (refreshToken) {
      // Best effort: the local session ends regardless of what the server says.
      await authApi.logout(refreshToken).catch(() => undefined);
    }
    await endSession(false);
  }, [endSession, refreshToken]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      sessionExpired,
      signIn,
      signUp,
      signInWithGoogle,
      signOut,
      clearSessionExpired: () => setSessionExpired(false),
    }),
    [status, user, sessionExpired, signIn, signUp, signInWithGoogle, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside an AuthProvider');
  }
  return context;
}
