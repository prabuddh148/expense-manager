import React, { useEffect, useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { categoryApi, cycleApi } from '../../api';
import {
  BottomSheet,
  Button,
  Card,
  DateTimeField,
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
import { Category } from '../../types/api';
import { formatLongDate, toIsoDate } from '../../utils/date';
import { formatMoney } from '../../utils/format';

const parseAmount = (text: string) => Number(text.replace(/,/g, ''));

/**
 * The running budget cycle. The target stays fixed while money is spent; it moves only when
 * the user resets on salary day, changes a category budget or edits it here. What is left
 * comes from the categories.
 */
export function SalaryTargetScreen() {
  const { colors, spacing, typography } = useTheme();
  const { showToast } = useToast();

  const { data, loading, refreshing, error, refresh, reload } = useAsyncData(
    () => cycleApi.get(),
    [],
    { cacheKey: 'cycle' },
  );

  const [target, setTarget] = useState('');
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!data) return;
    setTarget(data.targetAmount ? String(data.targetAmount) : '');
  }, [data]);

  const save = useSubmit((amount: number) => cycleApi.setTarget(amount));

  const numericTarget = parseAmount(target);
  const targetValid = target.trim() === '' || (Number.isFinite(numericTarget) && numericTarget >= 0);

  const onSave = async () => {
    setTouched(true);
    if (!targetValid) return;
    const result = await save.submit(numericTarget || 0);
    if (result) {
      showToast('Target saved', 'success');
      void reload();
    }
  };

  // Reset sheet: the salary date plus a fresh, empty amount for every category.
  const [resetOpen, setResetOpen] = useState(false);
  const [resetDate, setResetDate] = useState(toIsoDate(new Date()));
  const [categories, setCategories] = useState<Category[]>([]);
  const [amounts, setAmounts] = useState<Record<number, string>>({});
  const [loadingCategories, setLoadingCategories] = useState(false);
  const reset = useSubmit(() =>
    cycleApi.reset({
      startDate: resetDate,
      budgets: categories.map((category) => ({
        categoryId: category.id,
        amount: parseAmount(amounts[category.id] ?? '') || 0,
      })),
    }),
  );

  const openReset = async () => {
    setResetDate(toIsoDate(new Date()));
    setAmounts({});
    setResetOpen(true);
    setLoadingCategories(true);
    try {
      setCategories(await categoryApi.list());
    } catch (caught) {
      const { toAppError } = await import('../../api');
      showToast(toAppError(caught).message, 'error');
      setResetOpen(false);
    } finally {
      setLoadingCategories(false);
    }
  };

  const invalidAmount = categories.some((category) => {
    const text = amounts[category.id]?.trim() ?? '';
    const value = parseAmount(text);
    return text !== '' && (!Number.isFinite(value) || value < 0);
  });
  const newTarget = categories.reduce(
    (sum, category) => sum + (parseAmount(amounts[category.id] ?? '') || 0),
    0,
  );

  const onReset = async () => {
    if (invalidAmount) return;
    const result = await reset.submit();
    if (result) {
      setResetOpen(false);
      showToast(`New cycle from ${formatLongDate(result.startDate)}`, 'success');
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

  const cycle = data!;

  return (
    <Screen
      scroll
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />
      }
    >
      <Card style={{ marginTop: spacing.md, backgroundColor: colors.primary }}>
        <Text style={[typography.caption, { color: colors.textInverse, opacity: 0.85 }]}>
          TARGET · SINCE {formatLongDate(cycle.startDate).toUpperCase()}
        </Text>
        <Text style={[typography.display, { color: colors.textInverse, marginTop: spacing.xs }]}>
          {formatMoney(cycle.targetAmount)}
        </Text>

        <View style={[styles.row, { marginTop: spacing.lg }]}>
          <Stat label="IN CATEGORIES" value={formatMoney(cycle.allocatedTotal)} />
          <Stat label="SPENT" value={formatMoney(cycle.totalDeductions)} />
          <Stat label="REMAINING" value={formatMoney(cycle.remainingAmount)} />
        </View>
      </Card>

      <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.md }]}>
        Remaining is what is left across your categories. Spending does not change the target.
      </Text>

      <SectionHeader title="Salary came in?" style={{ marginTop: spacing.xl }} />
      <Text style={[typography.body, { color: colors.textMuted, marginBottom: spacing.md }]}>
        Start a new cycle from your salary date and fill in fresh amounts for each category. The
        target becomes their total.
      </Text>
      <Button label="Reset for new salary" icon="refresh-outline" onPress={openReset} />

      <SectionHeader title="Edit target" style={{ marginTop: spacing.xl }} />
      <TextField
        label="Target"
        value={target}
        onChangeText={setTarget}
        keyboardType="decimal-pad"
        placeholder="45000"
        icon="flag-outline"
        required
        error={touched && !targetValid ? 'Enter a valid amount' : save.fieldErrors.amount}
        hint="Set automatically to your category total. Changing a category budget sets it back."
      />

      {save.error && save.error.kind !== 'validation' ? (
        <Text style={[typography.caption, { color: colors.danger, marginBottom: spacing.md }]}>
          {save.error.message}
        </Text>
      ) : null}

      <Button label="Save target" variant="secondary" onPress={onSave} loading={save.submitting} />

      <BottomSheet visible={resetOpen} onClose={() => setResetOpen(false)} title="New salary cycle">
        <DateTimeField
          label="Salary date"
          mode="date"
          value={resetDate}
          onChange={setResetDate}
          maximumDate={new Date()}
        />

        <Text
          style={[
            typography.label,
            { color: colors.textMuted, marginTop: spacing.md, marginBottom: spacing.sm },
          ]}
        >
          FRESH AMOUNT FOR EACH CATEGORY
        </Text>

        {loadingCategories ? (
          <Text style={[typography.body, { color: colors.textMuted, marginBottom: spacing.md }]}>
            Loading categories...
          </Text>
        ) : (
          categories.map((category) => (
            <TextField
              key={category.id}
              label={category.name}
              value={amounts[category.id] ?? ''}
              onChangeText={(text) => setAmounts((current) => ({ ...current, [category.id]: text }))}
              keyboardType="decimal-pad"
              placeholder="0"
              icon={(category.icon as React.ComponentProps<typeof Ionicons>['name']) ?? 'pricetag-outline'}
              hint={`Last cycle: ${formatMoney(category.allocatedAmount)}`}
            />
          ))
        )}

        <View style={[styles.totalRow, { marginBottom: spacing.md }]}>
          <Text style={[typography.body, { color: colors.textMuted }]}>New target</Text>
          <Text style={[typography.heading, { color: colors.text }]}>{formatMoney(newTarget)}</Text>
        </View>

        {invalidAmount ? (
          <Text style={[typography.caption, { color: colors.danger, marginBottom: spacing.md }]}>
            Enter valid amounts (0 or more)
          </Text>
        ) : null}
        {reset.error && reset.error.kind !== 'validation' ? (
          <Text style={[typography.caption, { color: colors.danger, marginBottom: spacing.md }]}>
            {reset.error.message}
          </Text>
        ) : null}

        <Button
          label="Start new cycle"
          onPress={onReset}
          loading={reset.submitting}
          disabled={loadingCategories || invalidAmount}
        />
        <Button
          label="Cancel"
          variant="ghost"
          onPress={() => setResetOpen(false)}
          style={{ marginTop: spacing.sm }}
        />
      </BottomSheet>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const { colors, typography } = useTheme();
  return (
    <View style={styles.flex}>
      <Text style={[typography.caption, { color: colors.textInverse, opacity: 0.8, fontSize: 10 }]}>
        {label}
      </Text>
      <Text style={[typography.heading, { color: colors.textInverse }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
