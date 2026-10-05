import React, { useEffect, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { categoryApi, cycleApi, plannerApi } from '../../api';
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
import { Category, SalaryPlanner } from '../../types/api';
import { formatLongDate, toIsoDate } from '../../utils/date';
import { formatMoney } from '../../utils/format';

const parseAmount = (text: string) => Number(text.replace(/,/g, ''));

/**
 * The running budget cycle. The target stays fixed while money is spent; it moves only when
 * the user resets on salary day, changes a category budget or edits it here. What is left
 * comes from the categories.
 */
export function SalaryTargetScreen() {
  const { colors, radius, spacing, typography } = useTheme();
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
  // Plan buckets with no matching category; they are created with the reset.
  const [newRows, setNewRows] = useState<NewRow[]>([]);
  const [plans, setPlans] = useState<SalaryPlanner[] | null>(null);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [importedFrom, setImportedFrom] = useState<string | null>(null);
  const reset = useSubmit(() =>
    cycleApi.reset({
      startDate: resetDate,
      budgets: categories.map((category) => ({
        categoryId: category.id,
        amount: parseAmount(amounts[category.id] ?? '') || 0,
      })),
      newCategories: newRows.map((row) => ({
        name: row.name.trim(),
        amount: parseAmount(row.amount) || 0,
        color: row.color,
      })),
    }),
  );

  /**
   * Fills the sheet from a plan: buckets named like a category set that category's amount,
   * the rest become new categories, and categories the plan leaves out start at zero.
   */
  const applyPlan = (plan: SalaryPlanner) => {
    const byName = new Map(categories.map((category) => [category.name.trim().toLowerCase(), category]));
    const filled: Record<number, string> = {};
    const extra: NewRow[] = [];
    plan.items.forEach((item) => {
      const match = byName.get(item.name.trim().toLowerCase());
      if (match) {
        const before = parseAmount(filled[match.id] ?? '') || 0;
        filled[match.id] = String(before + item.amount);
      } else {
        extra.push({ key: `plan-${item.id}`, name: item.name, amount: String(item.amount), color: item.color });
      }
    });
    setAmounts(filled);
    setNewRows(extra);
    setPlans(null);
    setImportedFrom(plan.name);
  };

  const importFromPlan = async () => {
    setLoadingPlans(true);
    try {
      const list = await plannerApi.list();
      if (list.length === 0) {
        showToast('No salary plan yet. Make one in Salary Planner first', 'info');
      } else if (list.length === 1) {
        applyPlan(list[0]);
      } else {
        setPlans(list);
      }
    } catch (caught) {
      const { toAppError } = await import('../../api');
      showToast(toAppError(caught).message, 'error');
    } finally {
      setLoadingPlans(false);
    }
  };

  const updateRow = (key: string, change: Partial<NewRow>) =>
    setNewRows((rows) => rows.map((row) => (row.key === key ? { ...row, ...change } : row)));

  const openReset = async () => {
    setResetDate(toIsoDate(new Date()));
    setAmounts({});
    setNewRows([]);
    setPlans(null);
    setImportedFrom(null);
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
  const takenNames = new Set(categories.map((category) => category.name.trim().toLowerCase()));
  const rowError = (row: NewRow) => {
    const name = row.name.trim().toLowerCase();
    if (!name) return 'Enter a name';
    if (name === 'other') return 'Other is reserved, pick another name';
    if (takenNames.has(name)) return 'You already have this category';
    if (newRows.filter((other) => other.name.trim().toLowerCase() === name).length > 1) {
      return 'Name used twice';
    }
    const value = parseAmount(row.amount);
    if (row.amount.trim() !== '' && (!Number.isFinite(value) || value < 0)) return 'Enter a valid amount';
    return null;
  };
  const invalidRows = newRows.some((row) => rowError(row) !== null);
  const newTarget =
    categories.reduce((sum, category) => sum + (parseAmount(amounts[category.id] ?? '') || 0), 0) +
    newRows.reduce((sum, row) => sum + (parseAmount(row.amount) || 0), 0);

  const onReset = async () => {
    if (invalidAmount || invalidRows) return;
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
        Start a new cycle from your salary date and fill in fresh amounts for each category, or
        import them from a salary plan. The target becomes their total and spent starts again
        from zero.
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

        <Button
          label={importedFrom ? `Imported from ${importedFrom} · change` : 'Import from salary plan'}
          icon="download-outline"
          variant="secondary"
          onPress={importFromPlan}
          loading={loadingPlans}
          disabled={loadingCategories}
          style={{ marginTop: spacing.md }}
        />

        {plans ? (
          <View style={{ marginTop: spacing.md }}>
            <Text style={[typography.label, { color: colors.textMuted, marginBottom: spacing.sm }]}>
              CHOOSE A PLAN
            </Text>
            {plans.map((plan) => (
              <Pressable
                key={plan.id}
                onPress={() => applyPlan(plan)}
                style={({ pressed }) => [
                  styles.planRow,
                  {
                    borderColor: colors.border,
                    borderRadius: radius.md,
                    padding: spacing.md,
                    marginBottom: spacing.sm,
                    opacity: pressed ? 0.6 : 1,
                  },
                ]}
              >
                <View style={styles.flex}>
                  <Text style={[typography.body, { color: colors.text }]} numberOfLines={1}>
                    {plan.name}
                  </Text>
                  <Text style={[typography.caption, { color: colors.textMuted }]}>
                    {plan.items.length} {plan.items.length === 1 ? 'item' : 'items'} ·{' '}
                    {formatMoney(plan.totalAllocated)}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </Pressable>
            ))}
            <Button label="Cancel" variant="ghost" onPress={() => setPlans(null)} />
          </View>
        ) : null}

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

        {newRows.length > 0 ? (
          <>
            <Text
              style={[
                typography.label,
                { color: colors.textMuted, marginTop: spacing.md, marginBottom: spacing.sm },
              ]}
            >
              NEW CATEGORIES FROM THE PLAN
            </Text>
            {newRows.map((row) => (
              <View key={row.key} style={styles.newRow}>
                <View style={styles.flex}>
                  <TextField
                    label="Name"
                    value={row.name}
                    onChangeText={(name) => updateRow(row.key, { name })}
                    icon="pricetag-outline"
                    error={rowError(row) ?? undefined}
                  />
                  <TextField
                    label="Amount"
                    value={row.amount}
                    onChangeText={(amount) => updateRow(row.key, { amount })}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    icon="cash-outline"
                  />
                </View>
                <Pressable
                  onPress={() => setNewRows((rows) => rows.filter((other) => other.key !== row.key))}
                  hitSlop={10}
                  style={{ marginLeft: spacing.sm, marginTop: spacing.xl }}
                >
                  <Ionicons name="close-circle-outline" size={22} color={colors.danger} />
                </Pressable>
              </View>
            ))}
          </>
        ) : null}

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
          disabled={loadingCategories || invalidAmount || invalidRows}
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
  planRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1 },
  newRow: { flexDirection: 'row', alignItems: 'flex-start' },
});

type NewRow = { key: string; name: string; amount: string; color: string | null };
