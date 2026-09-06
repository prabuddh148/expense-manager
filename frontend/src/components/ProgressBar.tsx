import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../theme';

type Props = {
  /** 0-100. Values above 100 are clamped but flagged through `overflow`. */
  percentage: number;
  color?: string;
  overflow?: boolean;
  height?: number;
  label?: string;
  trailing?: string;
};

export function ProgressBar({ percentage, color, overflow, height = 8, label, trailing }: Props) {
  const { colors, radius, spacing, typography } = useTheme();
  const clamped = Math.max(0, Math.min(percentage, 100));
  const tone = overflow ? colors.danger : color ?? colors.primary;

  return (
    <View>
      {label || trailing ? (
        <View style={[styles.row, { marginBottom: spacing.xs }]}>
          {label ? (
            <Text style={[typography.caption, { color: colors.textMuted }]}>{label}</Text>
          ) : null}
          {trailing ? (
            <Text style={[typography.caption, { color: overflow ? colors.danger : colors.textMuted }]}>
              {trailing}
            </Text>
          ) : null}
        </View>
      ) : null}
      <View
        style={{
          height,
          borderRadius: radius.pill,
          backgroundColor: colors.surfaceAlt,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            width: `${clamped}%`,
            height: '100%',
            borderRadius: radius.pill,
            backgroundColor: tone,
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
