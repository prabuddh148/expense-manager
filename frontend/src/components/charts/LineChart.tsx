import React, { useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { useTheme } from '../../theme';
import { formatCompact } from '../../utils/format';

export type LinePoint = { label: string; value: number };

type Props = {
  data: LinePoint[];
  height?: number;
  color?: string;
  /** Labels under the first, middle and last point only, so small screens stay readable. */
  showEdgeLabels?: boolean;
};

export function LineChart({ data, height = 170, color, showEdgeLabels = true }: Props) {
  const { colors, spacing, typography } = useTheme();
  const [width, setWidth] = useState(0);
  const stroke = color ?? colors.primary;

  const plotHeight = height - 24;
  const max = Math.max(...data.map((point) => point.value), 1);

  const { linePath, areaPath, lastPoint } = useMemo(() => {
    if (width === 0 || data.length === 0) {
      return { linePath: '', areaPath: '', lastPoint: null as { x: number; y: number } | null };
    }
    const step = data.length > 1 ? width / (data.length - 1) : 0;
    const points = data.map((point, index) => ({
      x: data.length === 1 ? width / 2 : index * step,
      y: plotHeight - (point.value / max) * (plotHeight - 8) - 4,
    }));

    const line = points
      .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(2)},${point.y.toFixed(2)}`)
      .join(' ');
    const area = `${line} L${points[points.length - 1].x.toFixed(2)},${plotHeight} L${points[0].x.toFixed(2)},${plotHeight} Z`;

    return { linePath: line, areaPath: area, lastPoint: points[points.length - 1] };
  }, [data, max, plotHeight, width]);

  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);

  return (
    <View onLayout={onLayout}>
      <View style={{ height: plotHeight }}>
        {width > 0 ? (
          <Svg width={width} height={plotHeight}>
            <Defs>
              <LinearGradient id="lineFill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={stroke} stopOpacity={0.28} />
                <Stop offset="1" stopColor={stroke} stopOpacity={0.02} />
              </LinearGradient>
            </Defs>

            {areaPath ? <Path d={areaPath} fill="url(#lineFill)" /> : null}
            {linePath ? (
              <Path
                d={linePath}
                stroke={stroke}
                strokeWidth={2.5}
                fill="none"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ) : null}
            {lastPoint ? (
              <Circle
                cx={lastPoint.x}
                cy={lastPoint.y}
                r={4}
                fill={stroke}
                stroke={colors.surface}
                strokeWidth={2}
              />
            ) : null}
          </Svg>
        ) : null}
      </View>

      {showEdgeLabels && data.length > 1 ? (
        <View style={[styles.labels, { marginTop: spacing.xs }]}>
          <Text style={[typography.caption, { color: colors.textMuted, fontSize: 10 }]}>
            {data[0].label}
          </Text>
          <Text style={[typography.caption, { color: colors.textMuted, fontSize: 10 }]}>
            peak {formatCompact(max)}
          </Text>
          <Text style={[typography.caption, { color: colors.textMuted, fontSize: 10 }]}>
            {data[data.length - 1].label}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  labels: { flexDirection: 'row', justifyContent: 'space-between' },
});
