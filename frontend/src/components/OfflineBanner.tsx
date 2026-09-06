import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useNetwork } from '../store/NetworkContext';
import { useTheme } from '../theme';

/** Thin always-on strip so the user knows why data may be stale. */
export function OfflineBanner() {
  const { isOnline } = useNetwork();
  const { colors, spacing, typography, radius } = useTheme();

  if (isOnline) {
    return null;
  }

  return (
    <View
      style={[
        styles.banner,
        {
          backgroundColor: colors.warning,
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.lg,
          borderRadius: radius.sm,
          marginBottom: spacing.md,
        },
      ]}
    >
      <Ionicons name="cloud-offline-outline" size={16} color="#1B1B1B" />
      <Text style={[typography.caption, { color: '#1B1B1B', marginLeft: spacing.sm }]}>
        You are offline. Showing the last saved data.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center' },
});
