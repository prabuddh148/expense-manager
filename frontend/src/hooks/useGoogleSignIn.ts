import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useState } from 'react';

import { GOOGLE_CLIENT_IDS, isGoogleConfigured } from '../constants/config';
import { useAuth } from '../store/AuthContext';

// Closes the in-app browser tab automatically once Google redirects back.
WebBrowser.maybeCompleteAuthSession();

export type GoogleSignIn = {
  signIn: () => Promise<void>;
  busy: boolean;
  error: string | null;
  clearError: () => void;
  /** False when the build has no OAuth client IDs, so the button is hidden. */
  available: boolean;
};

/**
 * The Expo-compatible OAuth flow: expo-auth-session opens the system browser, Google
 * redirects back with an ID token, and the backend verifies that token against Google's
 * public keys. No Firebase popup APIs are involved - those are browser-only and cannot
 * work on device.
 */
function useConfiguredGoogleSignIn(): GoogleSignIn {
  const { signInWithGoogle } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    androidClientId: GOOGLE_CLIENT_IDS.android,
    iosClientId: GOOGLE_CLIENT_IDS.ios,
    clientId: GOOGLE_CLIENT_IDS.web,
  });

  useEffect(() => {
    if (response?.type === 'success') {
      const idToken = response.params?.id_token ?? response.authentication?.idToken;
      if (!idToken) {
        setError('Google did not return an ID token. Check the OAuth client configuration.');
        setBusy(false);
        return;
      }
      signInWithGoogle(idToken)
        .catch(() => setError('Google sign-in failed. Please try again.'))
        .finally(() => setBusy(false));
    } else if (response?.type === 'error') {
      setError('Google sign-in was cancelled or failed.');
      setBusy(false);
    } else if (response?.type === 'dismiss' || response?.type === 'cancel') {
      setBusy(false);
    }
  }, [response, signInWithGoogle]);

  const signIn = useCallback(async () => {
    setError(null);
    setBusy(true);
    await promptAsync();
  }, [promptAsync]);

  return {
    signIn,
    busy,
    error,
    clearError: useCallback(() => setError(null), []),
    available: Boolean(request),
  };
}

/**
 * Used when no EXPO_PUBLIC_GOOGLE_* client id is set. The provider hook throws on a
 * missing client id for the running platform, so it must not be called at all - hence
 * a separate implementation rather than an early return.
 */
function useDisabledGoogleSignIn(): GoogleSignIn {
  return {
    signIn: async () => {},
    busy: false,
    error: null,
    clearError: () => {},
    available: false,
  };
}

// The client ids come from build-time env vars, so which implementation applies is fixed
// for the life of the process. Choosing here keeps every hook call unconditional.
export const useGoogleSignIn: () => GoogleSignIn = isGoogleConfigured
  ? useConfiguredGoogleSignIn
  : useDisabledGoogleSignIn;
