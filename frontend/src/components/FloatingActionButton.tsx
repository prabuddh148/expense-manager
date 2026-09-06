import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../theme';

type Props = {
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  accessibilityLabel?: string;
};

/**
 * Circular add action pinned to the bottom right. The tab bar lives at the top and the
 * enclosing Screen reserves the safe-area inset, so a flat offset is all it needs.
 */
export function FloatingActionButton({
  onPress,
  icon = 'add',
  accessibilityLabel = 'Add',
}: Props) {
  const { colors, shadow } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [
        styles.fab,
        shadow(6),
        {
          backgroundColor: colors.primary,
          // The enclosing Screen already reserves the safe-area inset; adding it here
          // too lifted the button a second time.
          bottom: 20,
          transform: [{ scale: pressed ? 0.95 : 1 }],
        },
      ]}
    >
      <Ionicons name={icon} size={26} color={colors.textInverse} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
