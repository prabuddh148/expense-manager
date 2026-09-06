import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Button, Logo, Screen, TextField } from '../../components';
import { useGoogleSignIn } from '../../hooks/useGoogleSignIn';
import { useSubmit } from '../../hooks/useSubmit';
import { useAuth } from '../../store/AuthContext';
import { useTheme } from '../../theme';
import { AuthStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props) {
  const { colors, spacing, typography, radius, toggleTheme, isDark } = useTheme();
  const { signIn, sessionExpired, clearSessionExpired } = useAuth();
  const google = useGoogleSignIn();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState(false);

  const { submit, submitting, error, fieldErrors } = useSubmit(signIn);

  useEffect(() => {
    if (sessionExpired) {
      // Shown once, then cleared so it does not follow the user around.
      const timer = setTimeout(clearSessionExpired, 6000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [sessionExpired, clearSessionExpired]);

  const emailError = touched && !email.trim() ? 'Enter your email' : fieldErrors.email;
  const passwordError = touched && !password ? 'Enter your password' : fieldErrors.password;

  const onSubmit = () => {
    setTouched(true);
    if (!email.trim() || !password) return;
    void submit(email, password);
  };

  return (
    <Screen scroll>
      <View style={[styles.themeRow, { marginTop: spacing.md }]}>
        <Pressable
          onPress={toggleTheme}
          hitSlop={10}
          accessibilityRole="switch"
          accessibilityLabel="Toggle dark mode"
          style={[styles.themeButton, { backgroundColor: colors.surfaceAlt, borderRadius: radius.pill }]}
        >
          <Ionicons name={isDark ? 'sunny' : 'moon'} size={18} color={colors.text} />
        </Pressable>
      </View>

      <View style={{ marginTop: spacing.lg }}>
        <Logo size={58} />
      </View>

      <Text style={[typography.display, { color: colors.text, marginTop: spacing.lg }]}>
        Welcome back
      </Text>
      <Text style={[typography.body, { color: colors.textMuted, marginBottom: spacing.xl }]}>
        Sign in to pick up where you left off.
      </Text>

      {sessionExpired ? (
        <View
          style={[
            styles.notice,
            { backgroundColor: colors.primarySoft, borderRadius: radius.md, marginBottom: spacing.lg },
          ]}
        >
          <Ionicons name="time-outline" size={18} color={colors.primary} />
          <Text style={[typography.caption, { color: colors.text, flex: 1, marginLeft: spacing.sm }]}>
            Your session expired. Please sign in again.
          </Text>
        </View>
      ) : null}

      <TextField
        label="Email"
        icon="mail-outline"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        placeholder="you@example.com"
        error={emailError}
        required
      />

      <TextField
        label="Password"
        icon="lock-closed-outline"
        value={password}
        onChangeText={setPassword}
        secure
        autoComplete="password"
        placeholder="Your password"
        error={passwordError}
        required
      />

      {error && error.kind !== 'validation' ? (
        <Text style={[typography.caption, { color: colors.danger, marginBottom: spacing.md }]}>
          {error.message}
        </Text>
      ) : null}

      <Button label="Sign in" onPress={onSubmit} loading={submitting} />

      {google.available ? (
        <>
          <View style={[styles.divider, { marginVertical: spacing.lg }]}>
            <View style={[styles.line, { backgroundColor: colors.border }]} />
            <Text style={[typography.caption, { color: colors.textMuted, marginHorizontal: spacing.md }]}>
              OR
            </Text>
            <View style={[styles.line, { backgroundColor: colors.border }]} />
          </View>

          <Button
            label="Continue with Google"
            icon="logo-google"
            variant="secondary"
            loading={google.busy}
            onPress={google.signIn}
          />
        </>
      ) : null}

      {google.error ? (
        <Text style={[typography.caption, { color: colors.danger, marginTop: spacing.sm }]}>
          {google.error}
        </Text>
      ) : null}

      <View style={[styles.footer, { marginTop: spacing.xl }]}>
        <Text style={[typography.body, { color: colors.textMuted }]}>New here? </Text>
        <Pressable onPress={() => navigation.navigate('Signup')} hitSlop={8}>
          <Text style={[typography.label, { color: colors.primary }]}>Create an account</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  themeRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  themeButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  notice: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  divider: { flexDirection: 'row', alignItems: 'center' },
  line: { flex: 1, height: StyleSheet.hairlineWidth },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
});
