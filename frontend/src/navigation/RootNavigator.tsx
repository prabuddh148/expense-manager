import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
  Theme,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { useMemo } from 'react';

import { useAuth } from '../store/AuthContext';
import { useTheme } from '../theme';
import { AuthStack } from './AuthStack';
import { AppStack } from './AppStack';
import { SplashScreen } from '../screens/SplashScreen';
import { AppStackParamList } from './types';

const RootStack = createNativeStackNavigator();

export function RootNavigator() {
  const { status } = useAuth();
  const { colors, isDark } = useTheme();

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
    <NavigationContainer theme={navigationTheme}>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {status === 'loading' ? (
          <RootStack.Screen name="Splash" component={SplashScreen} />
        ) : status === 'authenticated' ? (
          // Swapping the whole subtree is what makes the guard real: while signed in the
          // auth screens are not mounted at all, so there is nothing to navigate back to.
          <RootStack.Screen name="App" component={AppStack} />
        ) : (
          <RootStack.Screen name="Auth" component={AuthStack} />
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}

export type { AppStackParamList };
