import React from 'react';
import type { RefreshControlProps } from 'react-native';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { Edge, SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '../theme';

type Props = {
  children: React.ReactNode;
  /** Wraps the content in a ScrollView. Turn off for screens that own a FlatList. */
  scroll?: boolean;
  padded?: boolean;
  edges?: readonly Edge[];
  refreshControl?: React.ReactElement<RefreshControlProps>;
  contentStyle?: ViewStyle;
  footer?: React.ReactNode;
};

/** Safe-area, keyboard handling and background colour in one place. */
export function Screen({
  children,
  scroll = false,
  padded = true,
  // The app is edge-to-edge, so without the bottom edge a footer button or FAB draws
  // underneath the Android navigation bar. Tab screens override this with ['bottom']
  // because the brand bar above the tabs already consumes the top inset.
  edges = ['top', 'bottom'],
  refreshControl,
  contentStyle,
  footer,
}: Props) {
  const { colors, spacing } = useTheme();
  const padding = padded ? { paddingHorizontal: spacing.lg } : null;

  const body = scroll ? (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[padding, { paddingBottom: spacing.xxl }, contentStyle]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      refreshControl={refreshControl}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex, padding, contentStyle]}>{children}</View>
  );

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]} edges={edges}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {body}
        {footer}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 } });
