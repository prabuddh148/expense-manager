import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { Pressable, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { authApi } from '../../api';
import { Button, Screen, TextField } from '../../components';
import { useSubmit } from '../../hooks/useSubmit';
import { AuthStackParamList } from '../../navigation/types';
import { useAuth } from '../../store/AuthContext';
import { useToast } from '../../store/ToastContext';
import { useTheme } from '../../theme';

type Props = NativeStackScreenProps<AuthStackParamList, 'NewPassword'>;

const MIN_PASSWORD = 8;

export function NewPasswordScreen({ navigation, route }: Props) {
  const { email, otp } = route.params;
  const { colors, spacing, typography } = useTheme();
  const { signIn } = useAuth();
  const { showToast } = useToast();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [touched, setTouched] = useState(false);

  const { submit, submitting, error, fieldErrors } = useSubmit(authApi.resetPassword);

  const localErrors = {
    password:
      password.length < MIN_PASSWORD ? `Use at least ${MIN_PASSWORD} characters` : undefined,
    confirm: confirm !== password ? 'Passwords do not match' : undefined,
  };

  const onSubmit = async () => {
    setTouched(true);
    if (localErrors.password || localErrors.confirm) return;
    const done = await submit(email, otp, password);
    if (!done) return;

    showToast('Password changed', 'success');
    try {
      // Signing in swaps the auth stack for the app, so nothing else needs to navigate.
      await signIn(email, password);
    } catch {
      navigation.popToTop();
    }
  };

  return (
    <Screen scroll>
      <Pressable
        onPress={() => navigation.goBack()}
        hitSlop={10}
        style={{ marginTop: spacing.md, marginBottom: spacing.lg, alignSelf: 'flex-start' }}
      >
        <Ionicons name="arrow-back" size={24} color={colors.text} />
      </Pressable>

      <Text style={[typography.display, { color: colors.text }]}>Set a new password</Text>
      <Text style={[typography.body, { color: colors.textMuted, marginBottom: spacing.xl }]}>
        Pick something you have not used here before. You will be signed out on other devices.
      </Text>

      <TextField
        label="New password"
        icon="lock-closed-outline"
        value={password}
        onChangeText={setPassword}
        secure
        autoComplete="new-password"
        placeholder="At least 8 characters"
        error={touched ? localErrors.password ?? fieldErrors.newPassword : fieldErrors.newPassword}
        required
      />

      <TextField
        label="Confirm password"
        icon="lock-closed-outline"
        value={confirm}
        onChangeText={setConfirm}
        secure
        autoComplete="new-password"
        placeholder="Type it again"
        error={touched ? localErrors.confirm : undefined}
        required
      />

      {error && error.kind !== 'validation' ? (
        <Text style={[typography.caption, { color: colors.danger, marginBottom: spacing.md }]}>
          {error.message}
        </Text>
      ) : null}

      {error && error.status === 400 && error.kind !== 'validation' ? (
        <Button
          label="Get a new code"
          variant="secondary"
          onPress={() => navigation.navigate('ForgotPassword', { email })}
          style={{ marginBottom: spacing.md }}
        />
      ) : null}

      <Button label="Change password" onPress={onSubmit} loading={submitting} />
    </Screen>
  );
}
