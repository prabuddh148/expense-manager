import React, { useEffect, useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { salaryApi } from '../../api';
import {
  Button,
  Card,
  DateTimeField,
  ErrorState,
  SkeletonPlanner,
  ProgressBar,
  Screen,
  SectionHeader,
  TextField,
} from '../../components';
import { useAsyncData } from '../../hooks/useAsyncData';
import { useSubmit } from '../../hooks/useSubmit';
import { useToast } from '../../store/ToastContext';
import { useTheme } from '../../theme';
import { currentPeriod, monthName, toIsoDate } from '../../utils/date';
import { formatMoney, formatPercent } from '../../utils/format';

export function SalaryTargetScreen() {
  const { colors, spacing, typography } = useTheme();
  const { showToast } = useToast();
  const period = currentPeriod();

  const { data, loading, refreshing, error, refresh, reload } = useAsyncData(
    () => salaryApi.get(period.year, period.month),
    [period.year, period.month],
    { cacheKey: 'salary' },
  );

  const [amount, setAmount] = useState('');
  const [target, setTarget] = useState('');
  const [targetDate, setTargetDate] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!data) return;
    setAmount(data.amount ? String(data.amount) : '');
    setTarget(data.targetAmount ? String(data.targetAmount) : '');
    setTargetDate(data.targetDate);
  }, [data]);

  const save = useSubmit(() =>
    salaryApi.save({
      amount: Number(amount.replace(/,/g, '')) || 0,
      targetAmount: target.trim() ? Number(target.replace(/,/g, '')) : null,
      targetDate,
      year: period.year,
      month: period.month,
    }),
  );

  const numericAmount = Number(amount.replace(/,/g, ''));
  const amountValid = amount.trim() === '' || (Number.isFinite(numericAmount) && numericAmount >= 0);

  const onSave = async () => {
    setTouched(true);
    if (!amountValid) return;
    const result = await save.submit();
    if (result) {
      showToast('Salary saved', 'success');
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
  const hasTarget = salary.targetAmount !== null && salary.targetAmount > 0;

  return (
    <Screen
      scroll
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />
      }
    >
      <Card style={{ marginTop: spacing.md, backgroundColor: colors.primary }}>
        <Text style={[typography.caption, { color: colors.textInverse, opacity: 0.85 }]}>
          {monthName(salary.month).toUpperCase()} {salary.year}
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

      {hasTarget ? (
        <Card style={{ marginTop: spacing.md }}>
          <View style={styles.row}>
            <Ionicons name="trending-up" size={20} color={colors.success} />
            <Text style={[typography.heading, { color: colors.text, marginLeft: spacing.sm }]}>
              Progress to target
            </Text>
          </View>

          <View style={{ marginTop: spacing.lg }}>
            <ProgressBar
              percentage={salary.progressPercentage}
              color={colors.success}
              height={10}
              label={`${formatMoney(salary.amount)} of ${formatMoney(salary.targetAmount)}`}
              trailing={formatPercent(salary.progressPercentage, 1)}
            />
          </View>

          <View style={[styles.row, { marginTop: spacing.lg }]}>
            <View style={styles.flex}>
              <Text style={[typography.caption, { color: colors.textMuted }]}>STILL TO GO</Text>
              <Text style={[typography.heading, { color: colors.text }]}>
                {formatMoney(salary.difference ?? 0)}
              </Text>
            </View>
            {salary.targetDate ? (
              <View style={styles.flex}>
                <Text style={[typography.caption, { color: colors.textMuted }]}>TARGET DATE</Text>
                <Text style={[typography.heading, { color: colors.text }]}>
                  {salary.targetDate}
                </Text>
              </View>
            ) : null}
          </View>
        </Card>
      ) : null}

      <SectionHeader title="Update salary" style={{ marginTop: spacing.xl }} />

      <TextField
        label="Monthly salary"
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
        placeholder="45000"
        icon="cash-outline"
        required
        error={touched && !amountValid ? 'Enter a valid amount' : save.fieldErrors.amount}
        hint="This is the parent balance every expense and EMI is deducted from."
      />

      <TextField
        label="Target salary"
        value={target}
        onChangeText={setTarget}
        keyboardType="decimal-pad"
        placeholder="100000"
        icon="flag-outline"
        hint="Optional. Leave blank if you are not tracking a goal."
        error={save.fieldErrors.targetAmount}
      />

      {target.trim() ? (
        <DateTimeField
          label="Target date (optional)"
          mode="date"
          value={targetDate ?? toIsoDate(new Date())}
          onChange={setTargetDate}
        />
      ) : null}

      {save.error && save.error.kind !== 'validation' ? (
        <Text style={[typography.caption, { color: colors.danger, marginBottom: spacing.md }]}>
          {save.error.message}
        </Text>
      ) : null}

      <Button label="Save salary" onPress={onSave} loading={save.submitting} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
});
