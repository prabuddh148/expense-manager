import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../../theme';
import { formatCompact } from '../../utils/format';

export type Bar = { label: string; value: number; color?: string | null };

type Props = {
  data: Bar[];
  height?: number;
  /** Shows the value above each bar. Turn off when bars get narrow. */
  showValues?: boolean;
};

/**
 * Plain views rather than SVG: a bar chart is just flex boxes, and this keeps the
 * component cheap enough to sit inside a scrolling dashboard.
 */
export function BarChart({ data, height = 160, showValues = true }: Props) {
  const { colors, radius, spacing, typography } = useTheme();
  const max = Math.max(...data.map((bar) => bar.value), 1);

  return (
    <View>
      <View style={[styles.plot, { height }]}>
        {data.map((bar, index) => {
          const ratio = Math.max(bar.value / max, 0);
          return (
            <View key={`${bar.label}-${index}`} style={styles.column}>
              {showValues && bar.value > 0 ? (
                <Text
                  style={[typography.caption, { color: colors.textMuted, fontSize: 10 }]}
                  numberOfLines={1}
                >
                  {formatCompact(bar.value)}
                </Text>
              ) : null}
              <View
                style={{
                  width: '62%',
                  height: Math.max(ratio * (height - 28), bar.value > 0 ? 4 : 2),
                  borderRadius: radius.sm,
                  backgroundColor: bar.value > 0 ? bar.color ?? colors.primary : colors.surfaceAlt,
                  marginTop: spacing.xs,
                }}
              />
            </View>
          );
        })}
      </View>

      <View style={styles.labels}>
        {data.map((bar, index) => (
          <Text
            key={`label-${bar.label}-${index}`}
            numberOfLines={1}
            style={[
              typography.caption,
              { color: colors.textMuted, flex: 1, textAlign: 'center', fontSize: 10 },
            ]}
          >
            {bar.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  plot: { flexDirection: 'row', alignItems: 'flex-end' },
  column: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  labels: { flexDirection: 'row', marginTop: 6 },
});
