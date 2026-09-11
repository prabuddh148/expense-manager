import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Button, Card, ConfirmDialog, Screen, SectionHeader } from '../../components';
import { AppStackParamList } from '../../navigation/types';
import { useAuth } from '../../store/AuthContext';
import { FeatureKey, useFeatures } from '../../store/FeaturesContext';
import { useNetwork } from '../../store/NetworkContext';
import { useTheme } from '../../theme';

type Nav = NativeStackNavigationProp<AppStackParamList>;

export function ProfileScreen() {
  const navigation = useNavigation<Nav>();
  const { colors, radius, spacing, typography, isDark, toggleTheme } = useTheme();
  const { user, signOut } = useAuth();
  const { isOnline } = useNetwork();
  const { isEnabled } = useFeatures();
  const [signingOut, setSigningOut] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const initials = (user?.name ?? '?')
    .split(' ')
    .map((part) => part.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const allLinks: {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    hint: string;
    onPress: () => void;
    feature?: FeatureKey;
  }[] = [
    {
      icon: 'cash-outline',
      label: 'Salary & Target',
      hint: 'Set your monthly salary and goal',
      onPress: () => navigation.navigate('SalaryTarget'),
    },
    {
      icon: 'pricetags-outline',
      label: 'Categories',
      hint: 'Budgets for each spending bucket',
      onPress: () => navigation.navigate('Categories'),
    },
    {
      icon: 'wallet-outline',
      label: 'Savings',
      hint: 'What you have put aside, and how',
      onPress: () => navigation.navigate('Savings'),
      feature: 'savings',
    },
    {
      icon: 'pie-chart-outline',
      label: 'Salary Planner',
      hint: 'Split a salary and export it',
      onPress: () => navigation.navigate('SalaryPlanner'),
      feature: 'planner',
    },
    {
      icon: 'settings-outline',
      label: 'Settings',
      hint: 'Sections, appearance, data and about',
      onPress: () => navigation.navigate('Settings'),
    },
  ];
  const links = allLinks.filter((link) => !link.feature || isEnabled(link.feature));

  return (
    <Screen edges={['bottom']} scroll>
      <Text style={[typography.title, { color: colors.text, marginTop: spacing.sm, marginBottom: spacing.lg }]}>
        Profile
      </Text>

      <Card>
        <View style={styles.row}>
          <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
            <Text style={[typography.title, { color: colors.textInverse }]}>{initials}</Text>
          </View>

          <View style={[styles.flex, { marginLeft: spacing.lg }]}>
            <Text style={[typography.heading, { color: colors.text }]} numberOfLines={1}>
              {user?.name ?? 'Signed in'}
            </Text>
            <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]} numberOfLines={1}>
              {user?.email}
            </Text>
            <View style={[styles.row, { marginTop: spacing.sm }]}>
              <View
                style={[
                  styles.dot,
                  { backgroundColor: isOnline ? colors.success : colors.warning },
                ]}
              />
              <Text style={[typography.caption, { color: colors.textMuted, marginLeft: 6 }]}>
                {isOnline ? 'Online' : 'Offline'} · signed in with{' '}
                {user?.provider === 'GOOGLE' ? 'Google' : 'email'}
              </Text>
            </View>
          </View>
        </View>
      </Card>

      <SectionHeader title="Appearance" style={{ marginTop: spacing.xl }} />
      <Card>
        <View style={styles.row}>
          <View
            style={[styles.iconBubble, { backgroundColor: colors.primarySoft, borderRadius: radius.md }]}
          >
            <Ionicons name={isDark ? 'moon' : 'sunny'} size={18} color={colors.primary} />
          </View>
          <View style={[styles.flex, { marginLeft: spacing.md }]}>
            <Text style={[typography.body, { color: colors.text }]}>Dark mode</Text>
            <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
              {isDark ? 'On' : 'Off'} · choose System in Settings
            </Text>
          </View>
          <Switch
            value={isDark}
            onValueChange={toggleTheme}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={colors.surface}
          />
        </View>
      </Card>

      <SectionHeader title="Manage" style={{ marginTop: spacing.xl }} />
      <Card padded={false}>
        {links.map((link, index) => (
          <Pressable
            key={link.label}
            onPress={link.onPress}
            style={({ pressed }) => [
              styles.linkRow,
              {
                padding: spacing.lg,
                borderTopWidth: index === 0 ? 0 : StyleSheet.hairlineWidth,
                borderTopColor: colors.border,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <View
              style={[styles.iconBubble, { backgroundColor: colors.surfaceAlt, borderRadius: radius.md }]}
            >
              <Ionicons name={link.icon} size={18} color={colors.text} />
            </View>
            <View style={[styles.flex, { marginLeft: spacing.md }]}>
              <Text style={[typography.body, { color: colors.text }]}>{link.label}</Text>
              <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
                {link.hint}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        ))}
      </Card>

      <Button
        label="Sign out"
        icon="log-out-outline"
        variant="danger"
        onPress={() => setConfirming(true)}
        style={{ marginTop: spacing.xl }}
      />

      <ConfirmDialog
        visible={confirming}
        title="Sign out?"
        message="Your tokens are removed from this device. Your data stays safe on the server."
        confirmLabel="Sign out"
        destructive
        loading={signingOut}
        onCancel={() => setConfirming(false)}
        onConfirm={async () => {
          setSigningOut(true);
          await signOut();
          setSigningOut(false);
          setConfirming(false);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  iconBubble: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  linkRow: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
