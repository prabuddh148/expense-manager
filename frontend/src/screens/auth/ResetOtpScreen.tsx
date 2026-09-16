import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { authApi } from '../../api';
import { Button, Screen, TextField } from '../../components';
import { useSubmit } from '../../hooks/useSubmit';
import { AuthStackParamList } from '../../navigation/types';
import { useToast } from '../../store/ToastContext';
import { useTheme } from '../../theme';

type Props = NativeStackScreenProps<AuthStackParamList, 'ResetOtp'>;

/** Matches the server, which ignores a new request within a minute of the last code. */
const RESEND_AFTER_SECONDS = 60;

export function ResetOtpScreen({ navigation, route }: Props) {
  const { email } = route.params;
  const { colors, spacing, typography } = useTheme();
  const { showToast } = useToast();

  const [otp, setOtp] = useState('');
  const [touched, setTouched] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_AFTER_SECONDS);

  const verify = useSubmit(authApi.verifyResetOtp);
  const resend = useSubmit(authApi.forgotPassword);

  useEffect(() => {
    if (secondsLeft <= 0) return undefined;
    const timer = setTimeout(() => setSecondsLeft((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  const otpError = otp.length !== 6 ? 'Enter the 6 digit code from the email' : undefined;

  const onVerify = async () => {
    setTouched(true);
    if (otpError) return;
    const ok = await verify.submit(email, otp);
    if (ok) navigation.navigate('NewPassword', { email, otp });
  };

  const onResend = async () => {
    verify.clearError();
    const sent = await resend.submit(email);
    if (sent) {
      setOtp('');
      setTouched(false);
      setSecondsLeft(RESEND_AFTER_SECONDS);
      showToast('A new code is on its way', 'success');
    }
  };

  const error = verify.error ?? resend.error;

  return (
    <Screen scroll>
      <Pressable
        onPress={() => navigation.goBack()}
        hitSlop={10}
        style={{ marginTop: spacing.md, marginBottom: spacing.lg, alignSelf: 'flex-start' }}
      >
        <Ionicons name="arrow-back" size={24} color={colors.text} />
      </Pressable>

      <Text style={[typography.display, { color: colors.text }]}>Check your email</Text>
      <Text style={[typography.body, { color: colors.textMuted, marginBottom: spacing.xl }]}>
        If an account exists for <Text style={{ color: colors.text }}>{email}</Text>, we sent it a
        6 digit code. It expires in 10 minutes. Check spam too.
      </Text>

      <TextField
        label="Reset code"
        icon="keypad-outline"
        value={otp}
        onChangeText={(value) => setOtp(value.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        maxLength={6}
        placeholder="000000"
        style={styles.code}
        error={touched ? otpError ?? verify.fieldErrors.otp : verify.fieldErrors.otp}
        required
      />

      {error && error.kind !== 'validation' ? (
        <Text style={[typography.caption, { color: colors.danger, marginBottom: spacing.md }]}>
          {error.message}
        </Text>
      ) : null}

      <Button label="Verify code" onPress={onVerify} loading={verify.submitting} />

      <View style={[styles.footer, { marginTop: spacing.xl }]}>
        <Text style={[typography.body, { color: colors.textMuted }]}>Didn't get it? </Text>
        {secondsLeft > 0 ? (
          <Text style={[typography.label, { color: colors.textMuted }]}>
            Resend in {secondsLeft}s
          </Text>
        ) : (
          <Pressable onPress={onResend} disabled={resend.submitting} hitSlop={8}>
            <Text style={[typography.label, { color: colors.primary }]}>
              {resend.submitting ? 'Sending...' : 'Resend code'}
            </Text>
          </Pressable>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  code: { letterSpacing: 8, fontSize: 22, fontWeight: '600' },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
});
