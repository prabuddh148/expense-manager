import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { RootNavigator } from './src/navigation/RootNavigator';
import { AuthProvider } from './src/store/AuthContext';
import { NetworkProvider } from './src/store/NetworkContext';
import { ToastProvider } from './src/store/ToastContext';
import { ThemeProvider, useTheme } from './src/theme';

/**
 * Provider order matters: the theme wraps everything so toasts and navigation can read
 * colours, and auth sits inside the network provider so it can react to connectivity.
 */
export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* Tracks the keyboard natively. The app draws edge-to-edge, where Android no
          longer resizes the window, so the built-in KeyboardAvoidingView had nothing
          to react to and inputs stayed hidden behind the keyboard. */}
      <KeyboardProvider>
        <SafeAreaProvider>
          <ThemeProvider>
            <NetworkProvider>
              <AuthProvider>
                <ToastProvider>
                  <ThemedStatusBar />
                  <RootNavigator />
                </ToastProvider>
              </AuthProvider>
            </NetworkProvider>
          </ThemeProvider>
        </SafeAreaProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}

/** Keeps the status bar icons readable when the theme flips. */
function ThemedStatusBar() {
  const { isDark } = useTheme();
  return <StatusBar style={isDark ? 'light' : 'dark'} />;
}
