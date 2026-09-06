import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { Logo } from '../components/Logo';
import { useTheme } from '../theme';

/**
 * Shown while the stored session is restored and checked against the server.
 *
 * Everything animates on the native driver (opacity and transform only), so the sequence
 * stays smooth even while the auth request is in flight on the JS thread.
 */
export function SplashScreen() {
  const { colors, spacing, typography } = useTheme();

  const logoScale = useRef(new Animated.Value(0.6)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const ringScale = useRef(new Animated.Value(0.7)).current;
  const ringOpacity = useRef(new Animated.Value(0)).current;
  const titleShift = useRef(new Animated.Value(18)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const taglineShift = useRef(new Animated.Value(14)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const barProgress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const entrance = Animated.sequence([
      // Logo springs in first.
      Animated.parallel([
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 320,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.spring(logoScale, {
          toValue: 1,
          friction: 6,
          tension: 70,
          useNativeDriver: true,
        }),
      ]),
      // Then the wordmark and tagline rise into place, staggered.
      Animated.stagger(90, [
        Animated.parallel([
          Animated.timing(titleOpacity, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(titleShift, {
            toValue: 0,
            duration: 380,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(taglineOpacity, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(taglineShift, {
            toValue: 0,
            duration: 380,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
      ]),
    ]);

    // A halo that keeps pulsing for as long as the session check runs.
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(ringScale, {
            toValue: 1.35,
            duration: 1400,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.sequence([
            Animated.timing(ringOpacity, {
              toValue: 0.35,
              duration: 500,
              useNativeDriver: true,
            }),
            Animated.timing(ringOpacity, {
              toValue: 0,
              duration: 900,
              useNativeDriver: true,
            }),
          ]),
        ]),
        Animated.timing(ringScale, { toValue: 0.7, duration: 0, useNativeDriver: true }),
      ]),
    );

    // Indeterminate sweep instead of a spinner - it reads as branded, not generic.
    const sweep = Animated.loop(
      Animated.timing(barProgress, {
        toValue: 1,
        duration: 1200,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
    );

    entrance.start();
    pulse.start();
    sweep.start();

    return () => {
      entrance.stop();
      pulse.stop();
      sweep.stop();
    };
  }, [
    barProgress,
    logoOpacity,
    logoScale,
    ringOpacity,
    ringScale,
    taglineOpacity,
    taglineShift,
    titleOpacity,
    titleShift,
  ]);

  const sweepShift = barProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [-90, 90],
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.logoArea}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.ring,
            {
              borderColor: colors.primary,
              opacity: ringOpacity,
              transform: [{ scale: ringScale }],
            },
          ]}
        />
        <Animated.View
          style={{ opacity: logoOpacity, transform: [{ scale: logoScale }] }}
        >
          <Logo size={104} />
        </Animated.View>
      </View>

      <Animated.Text
        style={[
          typography.display,
          {
            color: colors.text,
            marginTop: spacing.xl,
            opacity: titleOpacity,
            transform: [{ translateY: titleShift }],
          },
        ]}
      >
        Expense Manager
      </Animated.Text>

      <Animated.Text
        style={[
          typography.body,
          {
            color: colors.textMuted,
            marginTop: spacing.xs,
            opacity: taglineOpacity,
            transform: [{ translateY: taglineShift }],
          },
        ]}
      >
        Salary, spending and EMIs in one place
      </Animated.Text>

      <View style={[styles.track, { backgroundColor: colors.surfaceAlt, marginTop: spacing.xxl }]}>
        <Animated.View
          style={[
            styles.sweep,
            { backgroundColor: colors.primary, transform: [{ translateX: sweepShift }] },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  logoArea: { alignItems: 'center', justifyContent: 'center' },
  ring: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 2,
  },
  track: { width: 140, height: 4, borderRadius: 2, overflow: 'hidden' },
  sweep: { width: 60, height: '100%', borderRadius: 2 },
});
