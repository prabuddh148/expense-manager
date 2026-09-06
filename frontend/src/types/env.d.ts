/**
 * Environment variables inlined by the Expo bundler. Only EXPO_PUBLIC_ names reach the app,
 * and their values end up in the JS bundle, so none of them may be secret.
 *
 * This lives here rather than in expo-env.d.ts, which Expo regenerates on every start.
 */
declare const process: {
  env: {
    EXPO_PUBLIC_API_URL?: string;
    EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID?: string;
    EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?: string;
    EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?: string;
    [key: string]: string | undefined;
  };
};
