import React, { useContext, useEffect, useRef } from 'react';
import { Animated, DimensionValue, Easing, StyleSheet, View, ViewStyle } from 'react-native';

import { useTheme } from '../theme';

/**
 * Placeholder blocks that mirror the shape of the content still loading, so a screen
 * keeps its layout instead of collapsing to a spinner and jumping when data lands.
 *
 * One shared Animated.Value drives the pulse for a whole tree on the native driver, so
 * a screenful of blocks costs a single animation rather than one per block.
 */
const PulseContext = React.createContext<Animated.Value | null>(null);

function useLoopedPulse(value: Animated.Value, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return undefined;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(value, {
          toValue: 1,
          duration: 750,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(value, {
          toValue: 0.45,
          duration: 750,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [enabled, value]);
}

/** Wrap a screenful of skeletons so they pulse in step off one animation. */
export function SkeletonGroup({ children }: { children: React.ReactNode }) {
  const pulse = useRef(new Animated.Value(0.45)).current;
  useLoopedPulse(pulse, true);
  return <PulseContext.Provider value={pulse}>{children}</PulseContext.Provider>;
}

function usePulse(): Animated.Value {
  const shared = useContext(PulseContext);
  const own = useRef(new Animated.Value(0.45)).current;
  // Only animate the local value when there is no group already driving one.
  useLoopedPulse(own, shared === null);
  return shared ?? own;
}

type BlockProps = {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: ViewStyle;
};

export function Skeleton({ width = '100%', height = 14, radius = 6, style }: BlockProps) {
  const { colors } = useTheme();
  const pulse = usePulse();

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: radius,
          backgroundColor: colors.surfaceAlt,
          opacity: pulse,
        },
        style,
      ]}
    />
  );
}

/** Card-shaped placeholder: same radius, border and padding as the real Card. */
export function SkeletonCard({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  const { colors, radius, spacing } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          padding: spacing.lg,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** Icon, two lines and a trailing amount - the expense and loan list rows. */
export function SkeletonList({ rows = 6 }: { rows?: number }) {
  const { colors, radius, spacing } = useTheme();
  return (
    <SkeletonGroup>
      {Array.from({ length: rows }).map((_, index) => (
        <View
          key={index}
          style={[
            styles.row,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderWidth: StyleSheet.hairlineWidth,
              borderRadius: radius.md,
              padding: spacing.md,
              marginBottom: spacing.sm,
            },
          ]}
        >
          <Skeleton width={38} height={38} radius={12} />
          <View style={[styles.flex, { marginLeft: spacing.md }]}>
            <Skeleton width="55%" height={13} />
            <Skeleton width="35%" height={10} style={{ marginTop: 7 }} />
          </View>
          <Skeleton width={64} height={15} />
        </View>
      ))}
    </SkeletonGroup>
  );
}

/** Category cards: name, figures and the usage bar. */
export function SkeletonCategoryList({ rows = 5 }: { rows?: number }) {
  const { spacing } = useTheme();
  return (
    <SkeletonGroup>
      {Array.from({ length: rows }).map((_, index) => (
        <SkeletonCard key={index} style={{ marginBottom: spacing.md }}>
          <View style={styles.row}>
            <Skeleton width={34} height={34} radius={10} />
            <View style={[styles.flex, { marginLeft: spacing.md }]}>
              <Skeleton width="45%" height={14} />
            </View>
            <Skeleton width={70} height={14} />
          </View>
          <Skeleton height={6} radius={3} style={{ marginTop: spacing.lg }} />
          <View style={[styles.row, { marginTop: spacing.md }]}>
            <Skeleton width={72} height={11} />
            <View style={styles.flex} />
            <Skeleton width={72} height={11} />
          </View>
        </SkeletonCard>
      ))}
    </SkeletonGroup>
  );
}

/** Dashboard: hero balance card, stat tiles, then a chart block. */
export function SkeletonDashboard() {
  const { colors, radius, spacing } = useTheme();
  return (
    <SkeletonGroup>
      <View style={{ marginTop: spacing.sm, marginBottom: spacing.lg }}>
        <Skeleton width={110} height={10} />
        <Skeleton width="45%" height={22} style={{ marginTop: spacing.sm }} />
      </View>

      <View
        style={{
          backgroundColor: colors.surfaceAlt,
          borderRadius: radius.lg,
          padding: spacing.lg,
        }}
      >
        <Skeleton width={120} height={10} />
        <Skeleton width="60%" height={32} style={{ marginTop: spacing.md }} />
        <Skeleton height={1} style={{ marginTop: spacing.lg }} />
        <View style={[styles.row, { marginTop: spacing.lg }]}>
          <View style={styles.flex}>
            <Skeleton width={54} height={9} />
            <Skeleton width="70%" height={15} style={{ marginTop: 6 }} />
          </View>
          <View style={styles.flex}>
            <Skeleton width={70} height={9} />
            <Skeleton width="70%" height={15} style={{ marginTop: 6 }} />
          </View>
        </View>
      </View>

      <View style={[styles.row, { marginTop: spacing.lg }]}>
        <SkeletonCard style={{ flex: 1, marginRight: spacing.sm }}>
          <Skeleton width={22} height={22} radius={11} />
          <Skeleton width="70%" height={16} style={{ marginTop: spacing.md }} />
          <Skeleton width="45%" height={10} style={{ marginTop: 6 }} />
        </SkeletonCard>
        <SkeletonCard style={{ flex: 1, marginLeft: spacing.sm }}>
          <Skeleton width={22} height={22} radius={11} />
          <Skeleton width="70%" height={16} style={{ marginTop: spacing.md }} />
          <Skeleton width="45%" height={10} style={{ marginTop: 6 }} />
        </SkeletonCard>
      </View>

      <SkeletonCard style={{ marginTop: spacing.lg }}>
        <Skeleton width="40%" height={14} />
        <View style={[styles.chartRow, { marginTop: spacing.xl }]}>
          <Skeleton width={140} height={140} radius={70} />
        </View>
      </SkeletonCard>
    </SkeletonGroup>
  );
}

/** Planner: the total card, then a few section rows. */
export function SkeletonPlanner({ rows = 3 }: { rows?: number }) {
  const { spacing } = useTheme();
  return (
    <SkeletonGroup>
      <SkeletonCard>
        <Skeleton width={90} height={10} />
        <Skeleton width="55%" height={26} style={{ marginTop: spacing.sm }} />
        <Skeleton height={6} radius={3} style={{ marginTop: spacing.lg }} />
        <View style={[styles.row, { marginTop: spacing.md }]}>
          <Skeleton width={80} height={11} />
          <View style={styles.flex} />
          <Skeleton width={80} height={11} />
        </View>
      </SkeletonCard>

      {Array.from({ length: rows }).map((_, index) => (
        <SkeletonCard key={index} style={{ marginTop: spacing.md }}>
          <View style={styles.row}>
            <Skeleton width={10} height={10} radius={5} />
            <View style={[styles.flex, { marginLeft: spacing.md }]}>
              <Skeleton width="50%" height={14} />
              <Skeleton width="30%" height={10} style={{ marginTop: 6 }} />
            </View>
            <Skeleton width={68} height={15} />
          </View>
        </SkeletonCard>
      ))}
    </SkeletonGroup>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
  chartRow: { alignItems: 'center' },
});
