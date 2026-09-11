import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
  Theme,
  useNavigationContainerRef,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Notifications from 'expo-notifications';
import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '../store/AuthContext';
import { useFeatures } from '../store/FeaturesContext';
import { useTheme } from '../theme';
import {
  cancelPendingReminder,
  SMS_REMINDER_TYPE,
  syncPendingReminder,
} from '../utils/notifications';
import { AuthStack } from './AuthStack';
import { AppStack } from './AppStack';
import { SplashScreen } from '../screens/SplashScreen';
import type { NavigatorScreenParams } from '@react-navigation/native';

import { AppStackParamList } from './types';

/** The three top-level subtrees. Typed so the notification deep link is checked. */
type RootStackParamList = {
  Splash: undefined;
  App: NavigatorScreenParams<AppStackParamList>;
  Auth: undefined;
};

const RootStack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { status: authStatus } = useAuth();
  const { ready: featuresReady, isEnabled } = useFeatures();
  const { colors, isDark } = useTheme();
  const [splashDone, setSplashDone] = useState(false);
  const navigationRef = useNavigationContainerRef<RootStackParamList>();
  const smsEnabled = isEnabled('sms');

  // The tabs wait for the hidden sections too: a screen that fetched before they were
  // read would count figures from sections the user switched off.
  const status = featuresReady ? authStatus : 'loading';

  /**
   * Tapping the daily reminder should land on the transactions it is about, not just
   * open the app. Handles both a tap while running and a cold start from the
   * notification, and does nothing until the session is restored - navigating into the
   * tabs before they are mounted would throw.
   */
  useEffect(() => {
    if (status !== 'authenticated' || !smsEnabled) return undefined;

    const openSmsTab = (response: Notifications.NotificationResponse) => {
      if (response.notification.request.content.data?.type !== SMS_REMINDER_TYPE) return;
      navigationRef.navigate('App', { screen: 'Tabs', params: { screen: 'SmsTab' } });
    };

    // A notification that launched the app is waiting here rather than in the listener.
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) openSmsTab(response);
    });

    const subscription = Notifications.addNotificationResponseReceivedListener(openSmsTab);
    return () => subscription.remove();
  }, [navigationRef, smsEnabled, status]);

  // Keep the reminder in step with what is actually outstanding - and silent altogether
  // while SMS is switched off, since it is about a screen that is not there.
  useEffect(() => {
    if (status !== 'authenticated') return;
    if (smsEnabled) {
      void syncPendingReminder();
    } else {
      void cancelPendingReminder();
    }
  }, [smsEnabled, status]);

  // React Navigation keeps its own theme for card backgrounds and the status bar.
  const navigationTheme = useMemo<Theme>(() => {
    const base = isDark ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: colors.primary,
        background: colors.background,
        card: colors.surface,
        text: colors.text,
        border: colors.border,
        notification: colors.accent,
      },
    };
  }, [colors, isDark]);

  return (
    <View style={styles.flex}>
      <NavigationContainer theme={navigationTheme} ref={navigationRef}>
        <RootStack.Navigator screenOptions={{ headerShown: false }}>
          {status === 'loading' ? (
            <RootStack.Screen name="Splash" component={SplashScreen} />
          ) : status === 'authenticated' ? (
            // Swapping the whole subtree is what makes the guard real: while signed in
            // the auth screens are not mounted at all, so there is nothing to go back to.
            <RootStack.Screen name="App" component={AppStack} />
          ) : (
            <RootStack.Screen name="Auth" component={AuthStack} />
          )}
        </RootStack.Navigator>
      </NavigationContainer>

      {/* Sits above the navigator rather than inside it, so the real screen mounts and
          finishes its own first render underneath while the splash is still visible.
          By the time this fades there is a painted screen behind it, not a blank one. */}
      {splashDone ? null : (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <SplashScreen ready={status !== 'loading'} onFinish={() => setSplashDone(true)} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 } });

export type { AppStackParamList };
