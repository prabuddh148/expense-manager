import React, { useEffect, useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';

import { salaryApi } from '../../api';
import {
  Button,
  Card,
  ErrorState,
  SkeletonPlanner,
  Screen,
  SectionHeader,
  TextField,
} from '../../components';
import { useAsyncData } from '../../hooks/useAsyncData';
import { useSubmit } from '../../hooks/useSubmit';
import { useToast } from '../../store/ToastContext';
import { useTheme } from '../../theme';
import { currentPeriod, monthName } from '../../utils/date';
import { formatMoney } from '../../utils/format';

export function SalaryTargetScreen() {
  const { colors, spacing, typography } = useTheme();
  const { showToast } = useToast();
  const period = currentPeriod();

  const { data, loading, refreshing, error, refresh, reload } = useAsyncData(
    () => salaryApi.get(period.year, period.month),
    [period.year, period.month],
    { cacheKey: 'salary' },
  );

  const [target, setTarget] = useState('');
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!data) return;
    setTarget(data.amount ? String(data.amount) : '');
  }, [data]);

  const save = useSubmit(() =>
    salaryApi.save({
      amount: Number(target.replace(/,/g, '')) || 0,
      year: period.year,
      month: period.month,
    }),
  );

  const numericTarget = Number(target.replace(/,/g, ''));
  const targetValid = target.trim() === '' || (Number.isFinite(numericTarget) && numericTarget >= 0);

  const onSave = async () => {
    setTouched(true);
    if (!targetValid) return;
    const result = await save.submit();
    if (result) {
      showToast('Target salary saved', 'success');
      void reload();
    }
  };

  if (loading) {
    return (
      <Screen>
        <SkeletonPlanner rows={2} />
      </Screen>
    );
  }

  if (error && !data) {
    return (
      <Screen>
        <ErrorState message={error.message} offline={error.kind === 'network'} onRetry={reload} />
      </Screen>
    );
  }

  const salary = data!;

  return (
    <Screen
      scroll
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />
      }
    >
      <Card style={{ marginTop: spacing.md, backgroundColor: colors.primary }}>
        <Text style={[typography.caption, { color: colors.textInverse, opacity: 0.85 }]}>
          TARGET SALARY · {monthName(salary.month).toUpperCase()} {salary.year}
        </Text>
        <Text style={[typography.display, { color: colors.textInverse, marginTop: spacing.xs }]}>
          {formatMoney(salary.amount)}
        </Text>

        <View style={[styles.row, { marginTop: spacing.lg }]}>
          <View style={styles.flex}>
            <Text style={[typography.caption, { color: colors.textInverse, opacity: 0.8 }]}>
              DEDUCTIONS
            </Text>
            <Text style={[typography.heading, { color: colors.textInverse }]}>
              {formatMoney(salary.totalDeductions)}
            </Text>
          </View>
          <View style={styles.flex}>
            <Text style={[typography.caption, { color: colors.textInverse, opacity: 0.8 }]}>
              REMAINING
            </Text>
            <Text style={[typography.heading, { color: colors.textInverse }]}>
              {formatMoney(salary.remainingAmount)}
            </Text>
          </View>
        </View>
      </Card>

      <SectionHeader title="Update target salary" style={{ marginTop: spacing.xl }} />

      <TextField
        label="Target salary"
        value={target}
        onChangeText={setTarget}
        keyboardType="decimal-pad"
        placeholder="45000"
        icon="flag-outline"
        required
        error={touched && !targetValid ? 'Enter a valid amount' : save.fieldErrors.amount}
        hint="Every expense and EMI this month is deducted from this amount."
      />

      {save.error && save.error.kind !== 'validation' ? (
        <Text style={[typography.caption, { color: colors.danger, marginBottom: spacing.md }]}>
          {save.error.message}
        </Text>
      ) : null}

      <Button label="Save target salary" onPress={onSave} loading={save.submitting} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
});
