import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colorForIndex, useTheme } from '../../theme';
import { formatMoney, formatPercent } from '../../utils/format';

export type LegendItem = {
  label: string;
  value: number;
  percentage?: number;
  color?: string | null;
};

export function ChartLegend({ items }: { items: LegendItem[] }) {
  const { colors, spacing, typography } = useTheme();

  return (
    <View>
      {items.map((item, index) => (
        <View key={`${item.label}-${index}`} style={[styles.row, { paddingVertical: spacing.sm }]}>
          <View
            style={[styles.dot, { backgroundColor: item.color ?? colorForIndex(index) }]}
          />
          <Text
            numberOfLines={1}
            style={[typography.body, { color: colors.text, flex: 1, marginLeft: spacing.sm }]}
          >
            {item.label}
          </Text>
          {item.percentage !== undefined ? (
            <Text style={[typography.caption, { color: colors.textMuted, marginRight: spacing.md }]}>
              {formatPercent(item.percentage)}
            </Text>
          ) : null}
          <Text style={[typography.label, { color: colors.text }]}>{formatMoney(item.value)}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
