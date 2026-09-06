import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../theme';
import { Button } from './Button';

export function LoadingState({ label = 'Loading' }: { label?: string }) {
  const { colors, spacing, typography } = useTheme();
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.primary} size="large" />
      <Text style={[typography.body, { color: colors.textMuted, marginTop: spacing.md }]}>
        {label}
      </Text>
    </View>
  );
}

type EmptyProps = {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Right-aligned reads as a next step rather than the screen's only action. */
  actionAlign?: 'center' | 'right';
};

export function EmptyState({
  icon = 'file-tray-outline',
  title,
  message,
  actionLabel,
  onAction,
  actionAlign = 'center',
}: EmptyProps) {
  const { colors, spacing, typography } = useTheme();
  return (
    <View style={styles.center}>
      <View
        style={[
          styles.iconCircle,
          { backgroundColor: colors.surfaceAlt, marginBottom: spacing.lg },
        ]}
      >
        <Ionicons name={icon} size={30} color={colors.textMuted} />
      </View>
      <Text style={[typography.heading, { color: colors.text, textAlign: 'center' }]}>{title}</Text>
      {message ? (
        <Text
          style={[
            typography.body,
            {
              color: colors.textMuted,
              textAlign: 'center',
              marginTop: spacing.sm,
              maxWidth: 280,
            },
          ]}
        >
          {message}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <Button
          label={actionLabel}
          onPress={onAction}
          fullWidth={false}
          style={{
            marginTop: spacing.lg,
            // Button sets alignSelf itself when fullWidth is off, so this has to come
            // after it in the style array to win.
            alignSelf: actionAlign === 'right' ? 'flex-end' : 'center',
          }}
        />
      ) : null}
    </View>
  );
}

type ErrorProps = {
  message: string;
  onRetry?: () => void;
  /** Network failures get a different icon and wording from server errors. */
  offline?: boolean;
};

export function ErrorState({ message, onRetry, offline }: ErrorProps) {
  const { colors, spacing, typography } = useTheme();
  return (
    <View style={styles.center}>
      <View
        style={[
          styles.iconCircle,
          { backgroundColor: colors.surfaceAlt, marginBottom: spacing.lg },
        ]}
      >
        <Ionicons
          name={offline ? 'cloud-offline-outline' : 'warning-outline'}
          size={30}
          color={offline ? colors.warning : colors.danger}
        />
      </View>
      <Text style={[typography.heading, { color: colors.text, textAlign: 'center' }]}>
        {offline ? 'No internet connection' : 'Something went wrong'}
      </Text>
      <Text
        style={[
          typography.body,
          { color: colors.textMuted, textAlign: 'center', marginTop: spacing.sm, maxWidth: 300 },
        ]}
      >
        {message}
      </Text>
      {onRetry ? (
        <Button
          label="Try again"
          icon="refresh"
          onPress={onRetry}
          variant="secondary"
          fullWidth={false}
          style={{ marginTop: spacing.lg }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  iconCircle: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
});
