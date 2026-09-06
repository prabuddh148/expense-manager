import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';

import { colorForIndex, useTheme } from '../../theme';

export type DonutSlice = {
  label: string;
  value: number;
  color?: string | null;
};

type Props = {
  data: DonutSlice[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerValue?: string;
};

/**
 * Drawn with stroke-dasharray on concentric circles rather than arc paths: fewer nodes,
 * no path maths, and it animates cleanly if that is added later.
 */
export function DonutChart({
  data,
  size = 180,
  thickness = 26,
  centerLabel,
  centerValue,
}: Props) {
  const { colors, typography } = useTheme();

  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = data.reduce((sum, slice) => sum + Math.max(slice.value, 0), 0);

  const segments = useMemo(() => {
    if (total <= 0) return [];
    let offset = 0;
    return data
      .filter((slice) => slice.value > 0)
      .map((slice, index) => {
        const fraction = slice.value / total;
        const segment = {
          key: `${slice.label}-${index}`,
          color: slice.color ?? colorForIndex(index),
          length: fraction * circumference,
          offset,
        };
        offset += segment.length;
        return segment;
      });
  }, [circumference, data, total]);

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {/* Rotated so the first slice starts at 12 o'clock. */}
        <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={colors.surfaceAlt}
            strokeWidth={thickness}
            fill="none"
          />
          {segments.map((segment) => (
            <Circle
              key={segment.key}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={segment.color}
              strokeWidth={thickness}
              strokeDasharray={`${segment.length} ${circumference - segment.length}`}
              strokeDashoffset={-segment.offset}
              strokeLinecap="butt"
              fill="none"
            />
          ))}
        </G>
      </Svg>

      {centerValue || centerLabel ? (
        <View style={styles.center} pointerEvents="none">
          {centerValue ? (
            <Text style={[typography.title, { color: colors.text, fontSize: 20 }]} numberOfLines={1}>
              {centerValue}
            </Text>
          ) : null}
          {centerLabel ? (
            <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
              {centerLabel}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center', justifyContent: 'center' },
  center: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
