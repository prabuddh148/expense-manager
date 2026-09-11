import React, { useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import {
  applyApiBaseUrl,
  getApiBaseUrl,
  getDefaultApiBaseUrl,
  normalise,
  resetApiBaseUrl,
  setApiBaseUrl,
} from '../../api';
import {
  Button,
  Card,
  ConfirmDialog,
  Screen,
  SectionHeader,
  TextField,
} from '../../components';
import { isGoogleConfigured } from '../../constants/config';
import { clearDataCache } from '../../hooks/useAsyncData';
import { FEATURES, useFeatures } from '../../store/FeaturesContext';
import { useNetwork } from '../../store/NetworkContext';
import { useToast } from '../../store/ToastContext';
import { ThemeMode, useTheme } from '../../theme';

const MODES: { key: ThemeMode; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'light', label: 'Light', icon: 'sunny-outline' },
  { key: 'dark', label: 'Dark', icon: 'moon-outline' },
  { key: 'system', label: 'System', icon: 'phone-portrait-outline' },
];

export function SettingsScreen() {
  const { colors, radius, spacing, typography, mode, setMode, isDark, toggleTheme } = useTheme();
  const { isOnline } = useNetwork();
  const { showToast } = useToast();
  const { isEnabled, setEnabled } = useFeatures();
  const [clearing, setClearing] = useState(false);
  const [host, setHost] = useState(getApiBaseUrl());
  const [savingHost, setSavingHost] = useState(false);

  return (
    <Screen scroll>
      <SectionHeader title="Sections" style={{ marginTop: spacing.md }} />
      <Card padded={false}>
        {FEATURES.map((feature, index) => {
          const enabled = isEnabled(feature.key);
          return (
            <View
              key={feature.key}
              style={[
                styles.row,
                {
                  padding: spacing.lg,
                  borderTopWidth: index === 0 ? 0 : StyleSheet.hairlineWidth,
                  borderTopColor: colors.border,
                },
              ]}
            >
              <View
                style={[
                  styles.iconBubble,
                  {
                    backgroundColor: enabled ? colors.primarySoft : colors.surfaceAlt,
                    borderRadius: radius.md,
                  },
                ]}
              >
                <Ionicons
                  name={feature.icon}
                  size={18}
                  color={enabled ? colors.primary : colors.textMuted}
                />
              </View>
              <View style={[styles.flex, { marginHorizontal: spacing.md }]}>
                <Text style={[typography.body, { color: enabled ? colors.text : colors.textMuted }]}>
                  {feature.label}
                </Text>
                <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
                  {enabled ? 'Shown' : `Hidden. ${feature.hides}`}
                </Text>
              </View>
              <Switch
                value={enabled}
                onValueChange={(value) => {
                  void setEnabled(feature.key, value);
                  showToast(
                    value ? `${feature.label} is back` : `${feature.label} hidden`,
                    'success',
                  );
                }}
                accessibilityLabel={`Show ${feature.label}`}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.surface}
              />
            </View>
          );
        })}
      </Card>
      <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.sm }]}>
        Hiding a section never deletes anything - switch it back on and everything returns as
        it was. Home and Profile are always shown.
      </Text>

      <SectionHeader title="Appearance" style={{ marginTop: spacing.xl }} />

      <Card>
        <View style={styles.row}>
          <View style={styles.flex}>
            <Text style={[typography.body, { color: colors.text }]}>Dark mode</Text>
            <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
              Quick switch between light and dark
            </Text>
          </View>
          <Switch
            value={isDark}
            onValueChange={toggleTheme}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={colors.surface}
          />
        </View>

        <Text
          style={[
            typography.label,
            { color: colors.textMuted, marginTop: spacing.xl, marginBottom: spacing.sm },
          ]}
        >
          THEME
        </Text>
        <View style={styles.modeRow}>
          {MODES.map((option) => {
            const active = mode === option.key;
            return (
              <Pressable
                key={option.key}
                onPress={() => setMode(option.key)}
                style={[
                  styles.modeTile,
                  {
                    backgroundColor: active ? colors.primary : colors.surfaceAlt,
                    borderColor: active ? colors.primary : colors.border,
                    borderRadius: radius.md,
                    paddingVertical: spacing.md,
                  },
                ]}
              >
                <Ionicons
                  name={option.icon}
                  size={20}
                  color={active ? colors.textInverse : colors.text}
                />
                <Text
                  style={[
                    typography.caption,
                    { color: active ? colors.textInverse : colors.text, marginTop: spacing.xs },
                  ]}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.md }]}>
          System follows your device setting and changes with it.
        </Text>
      </Card>

      <SectionHeader title="Data" style={{ marginTop: spacing.xl }} />
      <Card>
        <Text style={[typography.body, { color: colors.text }]}>Offline cache</Text>
        <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs }]}>
          The dashboard, categories and loans keep a copy of their last successful response so
          the app still shows something without a connection. The server always stays the source
          of truth.
        </Text>
        <Button
          label="Clear cached data"
          icon="trash-outline"
          variant="secondary"
          loading={clearing}
          onPress={async () => {
            setClearing(true);
            await clearDataCache();
            setClearing(false);
            showToast('Cached data cleared', 'success');
          }}
          style={{ marginTop: spacing.lg }}
        />
      </Card>

      <SectionHeader title="Server" style={{ marginTop: spacing.xl }} />
      <Card>
        <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.sm }]}>
          Where the app sends its requests. Change this to move between a backend on your
          machine and a deployed one without reinstalling.
        </Text>

        <TextField
          label="API server"
          value={host}
          onChangeText={setHost}
          placeholder="https://your-api.onrender.com"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />

        <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.md }]}>
          Currently using {getApiBaseUrl()}
        </Text>

        <Button
          label="Save server"
          loading={savingHost}
          onPress={async () => {
            if (!host.trim()) {
              showToast('Enter a server address', 'error');
              return;
            }
            setSavingHost(true);
            const url = normalise(host);
            await setApiBaseUrl(url);
            applyApiBaseUrl(url);
            // Cached responses came from the previous server and would be misleading.
            await clearDataCache();
            setHost(url);
            setSavingHost(false);
            showToast('Server updated. Sign in again if needed.', 'success');
          }}
        />
        <Button
          label="Reset to default"
          variant="ghost"
          style={{ marginTop: spacing.sm }}
          onPress={async () => {
            await resetApiBaseUrl();
            applyApiBaseUrl(getDefaultApiBaseUrl());
            await clearDataCache();
            setHost(getDefaultApiBaseUrl());
            showToast('Back to the built-in server', 'success');
          }}
        />
      </Card>

      <SectionHeader title="About" style={{ marginTop: spacing.xl }} />
      <Card padded={false}>
        <InfoRow label="Connection" value={isOnline ? 'Online' : 'Offline'} first />
        <InfoRow label="API endpoint" value={getApiBaseUrl()} />
        <InfoRow label="Google sign-in" value={isGoogleConfigured ? 'Configured' : 'Not configured'} />
        <InfoRow label="Version" value="1.0.0" />
      </Card>

      <Text
        style={[
          typography.caption,
          { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl },
        ]}
      >
        Tokens are stored in the device keystore through expo-secure-store.
      </Text>
    </Screen>
  );
}

function InfoRow({ label, value, first }: { label: string; value: string; first?: boolean }) {
  const { colors, spacing, typography } = useTheme();
  return (
    <View
      style={[
        styles.infoRow,
        {
          padding: spacing.lg,
          borderTopWidth: first ? 0 : StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
        },
      ]}
    >
      <Text style={[typography.body, { color: colors.textMuted }]}>{label}</Text>
      <Text
        style={[typography.label, { color: colors.text, flexShrink: 1, textAlign: 'right' }]}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  iconBubble: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  modeRow: { flexDirection: 'row', gap: 10 },
  modeTile: { flex: 1, alignItems: 'center', borderWidth: StyleSheet.hairlineWidth },
  infoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
});
