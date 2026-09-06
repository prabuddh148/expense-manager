import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Button, Screen, TextField } from '../../components';
import { useGoogleSignIn } from '../../hooks/useGoogleSignIn';
import { useSubmit } from '../../hooks/useSubmit';
import { useAuth } from '../../store/AuthContext';
import { AuthStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme';

type Props = NativeStackScreenProps<AuthStackParamList, 'Signup'>;

const MIN_PASSWORD = 8;

export function SignupScreen({ navigation }: Props) {
  const { colors, spacing, typography } = useTheme();
  const { signUp } = useAuth();
  const google = useGoogleSignIn();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState(false);

  const { submit, submitting, error, fieldErrors } = useSubmit(signUp);

  const localErrors = {
    name: !name.trim() ? 'Enter your name' : undefined,
    email: !email.trim()
      ? 'Enter your email'
      : !/^\S+@\S+\.\S+$/.test(email.trim())
        ? 'Enter a valid email address'
        : undefined,
    password:
      password.length < MIN_PASSWORD ? `Use at least ${MIN_PASSWORD} characters` : undefined,
  };

  const onSubmit = () => {
    setTouched(true);
    if (localErrors.name || localErrors.email || localErrors.password) return;
    void submit(name, email, password);
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

      <Text style={[typography.display, { color: colors.text }]}>Create account</Text>
      <Text style={[typography.body, { color: colors.textMuted, marginBottom: spacing.xl }]}>
        Track your salary, budgets and EMIs from day one.
      </Text>

      <TextField
        label="Name"
        icon="person-outline"
        value={name}
        onChangeText={setName}
        placeholder="Your name"
        autoComplete="name"
        error={touched ? localErrors.name ?? fieldErrors.name : fieldErrors.name}
        required
      />

      <TextField
        label="Email"
        icon="mail-outline"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
        placeholder="you@example.com"
        error={touched ? localErrors.email ?? fieldErrors.email : fieldErrors.email}
        required
      />

      <TextField
        label="Password"
        icon="lock-closed-outline"
        value={password}
        onChangeText={setPassword}
        secure
        autoComplete="new-password"
        placeholder="At least 8 characters"
        hint="Stored as a bcrypt hash - never in plain text."
        error={touched ? localErrors.password ?? fieldErrors.password : fieldErrors.password}
        required
      />

      {error && error.kind !== 'validation' ? (
        <Text style={[typography.caption, { color: colors.danger, marginBottom: spacing.md }]}>
          {error.message}
        </Text>
      ) : null}

      <Button label="Create account" onPress={onSubmit} loading={submitting} />

      {google.available ? (
        <Button
          label="Sign up with Google"
          icon="logo-google"
          variant="secondary"
          loading={google.busy}
          onPress={google.signIn}
          style={{ marginTop: spacing.md }}
        />
      ) : null}

      <View style={[styles.footer, { marginTop: spacing.xl }]}>
        <Text style={[typography.body, { color: colors.textMuted }]}>Already registered? </Text>
        <Pressable onPress={() => navigation.navigate('Login')} hitSlop={8}>
          <Text style={[typography.label, { color: colors.primary }]}>Sign in</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
});
