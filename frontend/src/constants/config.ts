import { Platform } from 'react-native';

/**
 * EXPO_PUBLIC_ variables are inlined at build time and are visible in the bundle, so only
 * non-secret values belong here. The JWT secret and Google client secret stay server side.
 */
const fallbackHost = Platform.select({
  // The Android emulator reaches the host machine on 10.0.2.2, not localhost.
  android: 'http://10.0.2.2:8080/api',
  ios: 'http://localhost:8080/api',
  default: 'http://localhost:8080/api',
});

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? fallbackHost;

export const GOOGLE_CLIENT_IDS = {
  android: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
  ios: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  web: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
};

export const isGoogleConfigured =
  Boolean(GOOGLE_CLIENT_IDS.android || GOOGLE_CLIENT_IDS.ios || GOOGLE_CLIENT_IDS.web);

export const REQUEST_TIMEOUT_MS = 15000;

export const CURRENCY = {
  code: 'INR',
  symbol: String.fromCharCode(8377),
  locale: 'en-IN',
};
