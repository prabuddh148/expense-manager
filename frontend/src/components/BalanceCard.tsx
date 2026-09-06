import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { Logo } from './Logo';
import { useTheme } from '../theme';

type Stat = { label: string; value: string };

type Props = {
  label: string;
  amount: string;
  stats: Stat[];
  progress?: { percentage: number; label: string; trailing: string };
  hint?: string;
  onPress?: () => void;
};

/**
 * The dashboard hero. Deliberately keeps its own dark palette in both themes rather than
 * following the theme surface: like a physical card it should read as one fixed object,
 * which is what separates it from the ordinary Cards stacked beneath it.
 */
export function BalanceCard({ label, amount, stats, progress, hint, onPress }: Props) {
  const { colors, radius, spacing, typography, shadow } = useTheme();

  const content = (
    <View style={[styles.card, shadow(8), { borderRadius: radius.lg }]}>
      {/* Background: a slow diagonal ink gradient plus two soft accent glows. Drawn in
          SVG so no extra gradient dependency is needed. */}
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <LinearGradient id="ink" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#131A2B" />
            <Stop offset="0.55" stopColor="#1B2438" />
            <Stop offset="1" stopColor="#0E1420" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#ink)" />
        {/* Accent glows: the brand blue top-right, a green "money" cast bottom-left. */}
        <Circle cx="94%" cy="4%" r="70" fill={colors.primary} opacity={0.22} />
        <Circle cx="4%" cy="102%" r="80" fill="#2FBF87" opacity={0.12} />
      </Svg>

      {/* Hairline highlight along the top edge, the way a pressed metal card catches light. */}
      <View style={[styles.topHighlight, { borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg }]} />

      <View style={[styles.watermark, { opacity: 0.07 }]} pointerEvents="none">
        <Logo size={116} variant="glyph" glyphColor="#FFFFFF" color="#FFFFFF" />
      </View>

      <View style={{ padding: spacing.lg }}>
        <Text style={[styles.label, { marginBottom: spacing.xs }]}>{label.toUpperCase()}</Text>

        <Text style={[typography.display, styles.amount]} numberOfLines={1} adjustsFontSizeToFit>
          {amount}
        </Text>

        <View style={[styles.divider, { marginVertical: spacing.lg }]} />

        <View style={styles.row}>
          {stats.map((stat, index) => (
            <View key={stat.label} style={[styles.flex, index > 0 ? { marginLeft: spacing.lg } : null]}>
              <Text style={styles.statLabel}>{stat.label.toUpperCase()}</Text>
              <Text style={[typography.heading, styles.statValue]} numberOfLines={1}>
                {stat.value}
              </Text>
            </View>
          ))}
        </View>

        {progress ? (
          <View style={{ marginTop: spacing.lg }}>
            <View style={[styles.row, { marginBottom: spacing.sm }]}>
              <Text style={[styles.statLabel, styles.flex]}>{progress.label}</Text>
              <Text style={styles.progressTrailing}>{progress.trailing}</Text>
            </View>
            <View style={styles.track}>
              <View
                style={[
                  styles.fill,
                  {
                    // Clamped so a target already met cannot overflow the track.
                    width: `${Math.max(0, Math.min(100, progress.percentage))}%`,
                    backgroundColor: '#4ADE9B',
                  },
                ]}
              />
            </View>
          </View>
        ) : hint ? (
          <Text style={[styles.hint, { marginTop: spacing.md }]}>{hint}</Text>
        ) : null}
      </View>
    </View>
  );

  if (!onPress) {
    return content;
  }

  return (
    <Pressable onPress={onPress} style={({ pressed }) => (pressed ? { opacity: 0.9 } : null)}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { overflow: 'hidden', backgroundColor: '#131A2B' },
  topHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  watermark: { position: 'absolute', right: -18, top: -14 },
  row: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
  label: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.6,
  },
  amount: { color: '#FFFFFF', fontSize: 36, letterSpacing: -1 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.14)' },
  statLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 3,
  },
  statValue: { color: '#F1F5F9' },
  progressTrailing: { color: '#4ADE9B', fontSize: 12, fontWeight: '700' },
  track: {
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: 3 },
  hint: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '600' },
});
