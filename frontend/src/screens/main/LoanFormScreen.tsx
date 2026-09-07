import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { loanApi } from '../../api';
import { Button, DateTimeField, Screen, SkeletonPlanner, TextField } from '../../components';
import { useAsyncData } from '../../hooks/useAsyncData';
import { useSubmit } from '../../hooks/useSubmit';
import { AppStackParamList } from '../../navigation/types';
import { useToast } from '../../store/ToastContext';
import { useTheme } from '../../theme';
import { toIsoDate } from '../../utils/date';

type Props = NativeStackScreenProps<AppStackParamList, 'LoanForm'>;

export function LoanFormScreen({ navigation, route }: Props) {
  const loanId = route.params?.loanId;
  const isEditing = typeof loanId === 'number';
  const { colors, spacing, typography } = useTheme();
  const { showToast } = useToast();

  const [name, setName] = useState('');
  const [originalAmount, setOriginalAmount] = useState('');
  const [monthlyEmi, setMonthlyEmi] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [startDate, setStartDate] = useState(toIsoDate(new Date()));
  const [endDate, setEndDate] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const existing = useAsyncData(() => loanApi.get(loanId as number), [loanId], {
    enabled: isEditing,
  });

  useEffect(() => {
    navigation.setOptions({ title: isEditing ? 'Edit Loan' : 'New Loan' });
  }, [isEditing, navigation]);

  useEffect(() => {
    const loan = existing.data;
    if (!loan) return;
    setName(loan.name);
    setOriginalAmount(String(loan.originalAmount));
    setMonthlyEmi(String(loan.monthlyEmi));
    setInterestRate(loan.interestRate ? String(loan.interestRate) : '');
    setStartDate(loan.startDate);
    setEndDate(loan.endDate);
  }, [existing.data]);

  const numeric = (value: string) => Number(value.replace(/,/g, ''));
  const amountValid = numeric(originalAmount) > 0;
  const emiValid = numeric(monthlyEmi) > 0;

  const save = useSubmit(async () => {
    const payload = {
      name: name.trim(),
      originalAmount: numeric(originalAmount),
      monthlyEmi: numeric(monthlyEmi),
      interestRate: interestRate.trim() ? numeric(interestRate) : null,
      startDate,
      endDate,
    };
    return isEditing ? loanApi.update(loanId as number, payload) : loanApi.create(payload);
  });

  const onSubmit = async () => {
    setTouched(true);
    if (!name.trim() || !amountValid || !emiValid) return;

    const result = await save.submit();
    if (result) {
      showToast(isEditing ? 'Loan updated' : 'Loan added', 'success');
      navigation.goBack();
    }
  };

  if (isEditing && existing.loading) {
    return (
      <Screen>
        <SkeletonPlanner rows={3} />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <Text style={[typography.body, { color: colors.textMuted, marginTop: spacing.md, marginBottom: spacing.lg }]}>
        The remaining balance is worked out from the payments you record, so you never edit it
        directly.
      </Text>

      <TextField
        label="Loan name"
        value={name}
        onChangeText={setName}
        placeholder="Bike Loan"
        icon="card-outline"
        required
        error={touched && !name.trim() ? 'Give the loan a name' : save.fieldErrors.name}
      />

      <TextField
        label="Original amount"
        value={originalAmount}
        onChangeText={setOriginalAmount}
        keyboardType="decimal-pad"
        placeholder="60000"
        icon="cash-outline"
        required
        error={
          touched && !amountValid
            ? 'Enter the amount borrowed'
            : save.fieldErrors.originalAmount
        }
      />

      <TextField
        label="Monthly EMI"
        value={monthlyEmi}
        onChangeText={setMonthlyEmi}
        keyboardType="decimal-pad"
        placeholder="15000"
        icon="repeat-outline"
        required
        error={touched && !emiValid ? 'Enter the monthly instalment' : save.fieldErrors.monthlyEmi}
      />

      <TextField
        label="Interest rate"
        value={interestRate}
        onChangeText={setInterestRate}
        keyboardType="decimal-pad"
        placeholder="9.5"
        icon="trending-up-outline"
        hint="Annual percentage. Optional."
        error={save.fieldErrors.interestRate}
      />

      <View style={styles.row}>
        <View style={styles.half}>
          <DateTimeField label="Start date" mode="date" value={startDate} onChange={setStartDate} />
        </View>
        <View style={[styles.half, { marginLeft: spacing.md }]}>
          <DateTimeField
            label="End date"
            mode="date"
            value={endDate ?? toIsoDate(new Date())}
            onChange={setEndDate}
          />
        </View>
      </View>

      {save.error && save.error.kind !== 'validation' ? (
        <Text style={[typography.caption, { color: colors.danger, marginBottom: spacing.md }]}>
          {save.error.message}
        </Text>
      ) : null}

      <Button
        label={isEditing ? 'Save changes' : 'Add loan'}
        onPress={onSubmit}
        loading={save.submitting}
      />
      <Button
        label="Cancel"
        variant="ghost"
        onPress={() => navigation.goBack()}
        style={{ marginTop: spacing.sm }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  half: { flex: 1 },
});
