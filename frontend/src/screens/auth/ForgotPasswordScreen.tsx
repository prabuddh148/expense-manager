import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { Pressable, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { authApi } from '../../api';
import { Button, Screen, TextField } from '../../components';
import { useSubmit } from '../../hooks/useSubmit';
import { AuthStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

export function ForgotPasswordScreen({ navigation, route }: Props) {
  const { colors, spacing, typography } = useTheme();
  const [email, setEmail] = useState(route.params?.email ?? '');
  const [touched, setTouched] = useState(false);

  const { submit, submitting, error, fieldErrors } = useSubmit(authApi.forgotPassword);

  const emailError = !email.trim()
    ? 'Enter your email'
    : !/^\S+@\S+\.\S+$/.test(email.trim())
      ? 'Enter a valid email address'
      : undefined;

  const onSubmit = async () => {
    setTouched(true);
    if (emailError) return;
    const trimmed = email.trim().toLowerCase();
    const sent = await submit(trimmed);
    if (sent) navigation.navigate('ResetOtp', { email: trimmed });
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

      <Text style={[typography.display, { color: colors.text }]}>Forgot password?</Text>
      <Text style={[typography.body, { color: colors.textMuted, marginBottom: spacing.xl }]}>
        Enter the email you signed up with and we will send you a 6 digit code to reset it.
      </Text>

      <TextField
        label="Email"
        icon="mail-outline"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        placeholder="you@example.com"
        error={touched ? emailError ?? fieldErrors.email : fieldErrors.email}
        required
      />

      {error && error.kind !== 'validation' ? (
        <Text style={[typography.caption, { color: colors.danger, marginBottom: spacing.md }]}>
          {error.message}
        </Text>
      ) : null}

      <Button label="Send code" icon="send-outline" onPress={onSubmit} loading={submitting} />
    </Screen>
  );
}
