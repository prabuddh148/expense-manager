import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { categoryApi } from '../../api';
import {
  BottomSheet,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  FloatingActionButton,
  SkeletonCategoryList,
  ProgressBar,
  Screen,
  TextField,
} from '../../components';
import { useAsyncData } from '../../hooks/useAsyncData';
import { useSubmit } from '../../hooks/useSubmit';
import { AppStackParamList } from '../../navigation/types';
import { useToast } from '../../store/ToastContext';
import { chartPalette, useTheme } from '../../theme';
import { Category } from '../../types/api';
import { formatMoney, formatPercent } from '../../utils/format';

type Nav = NativeStackNavigationProp<AppStackParamList>;

const ICON_CHOICES: (keyof typeof import('@expo/vector-icons').Ionicons.glyphMap)[] = [
  'fast-food-outline',
  'bus-outline',
  'bicycle-outline',
  'home-outline',
  'cart-outline',
  'phone-portrait-outline',
  'wallet-outline',
  'medkit-outline',
  'school-outline',
  'game-controller-outline',
];

export function CategoriesScreen() {
  const navigation = useNavigation<Nav>();
  const { colors, radius, spacing, typography } = useTheme();
  const { showToast } = useToast();

  const { data, loading, refreshing, error, refresh, reload } = useAsyncData(
    () => categoryApi.list(),
    [],
    { cacheKey: 'categories' },
  );

  const [editing, setEditing] = useState<Category | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [name, setName] = useState('');
  const [budget, setBudget] = useState('');
  const [color, setColor] = useState(chartPalette[0]);
  const [icon, setIcon] = useState<string>(ICON_CHOICES[0]);
  const [touched, setTouched] = useState(false);
  const [deleting, setDeleting] = useState<Category | null>(null);

  // Add money: a category that got cash from somewhere else gets its budget raised.
  const [fundsFor, setFundsFor] = useState<Category | null>(null);
  const [fundsAmount, setFundsAmount] = useState('');
  const [fundsTouched, setFundsTouched] = useState(false);

  // Merge: pick two or more categories, then the one that survives with the combined budget.
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeIds, setMergeIds] = useState<number[]>([]);
  const [keepId, setKeepId] = useState<number | null>(null);

  const save = useSubmit(async (payload: Parameters<typeof categoryApi.create>[0]) =>
    editing ? categoryApi.update(editing.id, payload) : categoryApi.create(payload),
  );
  const remove = useSubmit((id: number) => categoryApi.remove(id));
  const addFunds = useSubmit((id: number, amount: number) => categoryApi.addFunds(id, amount));
  const merge = useSubmit(categoryApi.merge);

  const openFunds = useCallback((category: Category) => {
    setFundsFor(category);
    setFundsAmount('');
    setFundsTouched(false);
  }, []);

  const numericFunds = Number(fundsAmount.replace(/,/g, ''));
  const fundsValid = Number.isFinite(numericFunds) && numericFunds > 0;

  const onAddFunds = async () => {
    setFundsTouched(true);
    if (!fundsFor || !fundsValid) return;
    const result = await addFunds.submit(fundsFor.id, numericFunds);
    if (result) {
      setFundsFor(null);
      showToast(`${formatMoney(numericFunds)} added to ${result.name}`, 'success');
      void reload();
    }
  };

  const openMerge = () => {
    setMergeIds([]);
    setKeepId(null);
    setMergeOpen(true);
  };

  const toggleMerge = (id: number) => {
    const next = mergeIds.includes(id) ? mergeIds.filter((x) => x !== id) : [...mergeIds, id];
    setMergeIds(next);
    // The kept category has to be one of the selected ones.
    if (keepId !== null && !next.includes(keepId)) setKeepId(null);
  };

  const onMerge = async () => {
    if (mergeIds.length < 2 || keepId === null) return;
    const result = await merge.submit({ categoryIds: mergeIds, keepId });
    if (result) {
      setMergeOpen(false);
      showToast(`Merged into ${result.name}`, 'success');
      void reload();
    }
  };

  const openSheet = useCallback((category: Category | null) => {
    setEditing(category);
    setName(category?.name ?? '');
    setBudget(category ? String(category.allocatedAmount) : '');
    setColor(category?.color ?? chartPalette[0]);
    setIcon(category?.icon ?? ICON_CHOICES[0]);
    setTouched(false);
    setSheetOpen(true);
  }, []);

  const onSave = async () => {
    setTouched(true);
    const numericBudget = Number(budget.replace(/,/g, '')) || 0;
    if (!name.trim() || numericBudget < 0) return;

    const result = await save.submit({
      name: name.trim(),
      allocatedAmount: numericBudget,
      color,
      icon,
    });
    if (result) {
      setSheetOpen(false);
      showToast(editing ? 'Category updated' : 'Category created', 'success');
      void reload();
    }
  };

  const renderItem = useCallback(
    ({ item }: { item: Category }) => (
      <Card style={{ marginBottom: spacing.md }} onPress={() => openSheet(item)}>
        <View style={styles.row}>
          <View style={[styles.bubble, { backgroundColor: (item.color ?? colors.primary) + '22' }]}>
            <Ionicons
              name={(item.icon as keyof typeof Ionicons.glyphMap) ?? 'pricetag-outline'}
              size={20}
              color={item.color ?? colors.primary}
            />
          </View>

          <View style={[styles.flex, { marginLeft: spacing.md }]}>
            <Text style={[typography.heading, { color: colors.text }]} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
              {item.transactionCount} {item.transactionCount === 1 ? 'expense' : 'expenses'}
            </Text>
          </View>

          <Pressable
            onPress={() => openFunds(item)}
            hitSlop={10}
            style={{ marginRight: spacing.lg }}
            accessibilityLabel={`Add money to ${item.name}`}
          >
            <Ionicons name="add-circle-outline" size={20} color={colors.success} />
          </Pressable>
          <Pressable onPress={() => setDeleting(item)} hitSlop={10}>
            <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
          </Pressable>
        </View>

        <View style={{ marginTop: spacing.lg }}>
          <ProgressBar
            percentage={item.usedPercentage}
            color={item.color ?? colors.primary}
            overflow={item.overspent}
            trailing={formatPercent(item.usedPercentage)}
          />

          {/* Budget, spent and remaining side by side rather than buried in a sentence,
              so the three numbers can be compared at a glance. */}
          <View style={[styles.figures, { marginTop: spacing.md }]}>
            <Figure label="BUDGET" value={formatMoney(item.allocatedAmount)} />
            <Figure label="SPENT" value={formatMoney(item.spentAmount)} />
            <Figure
              label={item.overspent ? 'OVER BY' : 'REMAINING'}
              value={formatMoney(Math.abs(item.remainingAmount))}
              // The one number people look for, so it carries the colour.
              color={item.overspent ? colors.danger : colors.success}
              align="right"
            />
          </View>
        </View>
      </Card>
    ),
    [colors, openFunds, openSheet, spacing, typography],
  );

  if (loading) {
    return (
      <Screen>
        <SkeletonCategoryList />
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

  const totalBudget = (data ?? []).reduce((sum, item) => sum + item.allocatedAmount, 0);
  const totalSpent = (data ?? []).reduce((sum, item) => sum + item.spentAmount, 0);
  // Summed from the server's per-category figures rather than recomputed, so this can
  // never disagree with the rows underneath it.
  const totalRemaining = (data ?? []).reduce((sum, item) => sum + item.remainingAmount, 0);
  const overspentCount = (data ?? []).filter((item) => item.overspent).length;

  return (
    <Screen padded={false}>
      <FlatList
        data={data ?? []}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />
        }
        ListHeaderComponent={
          (data ?? []).length > 0 ? (
            <Card style={{ marginBottom: spacing.lg }}>
              <Text style={[typography.caption, { color: colors.textMuted }]}>
                REMAINING ACROSS ALL CATEGORIES
              </Text>
              <Text
                style={[
                  typography.display,
                  {
                    color: totalRemaining < 0 ? colors.danger : colors.text,
                    marginTop: spacing.xs,
                  },
                ]}
              >
                {formatMoney(totalRemaining)}
              </Text>

              <View style={[styles.figures, { marginTop: spacing.lg }]}>
                <Figure label="TOTAL BUDGET" value={formatMoney(totalBudget)} />
                <Figure label="TOTAL SPENT" value={formatMoney(totalSpent)} align="right" />
              </View>

              {overspentCount > 0 ? (
                <Text
                  style={[typography.caption, { color: colors.danger, marginTop: spacing.md }]}
                >
                  {overspentCount} {overspentCount === 1 ? 'category is' : 'categories are'} over
                  budget
                </Text>
              ) : null}

              {(data ?? []).length >= 2 ? (
                <Button
                  label="Merge categories"
                  variant="secondary"
                  icon="git-merge-outline"
                  onPress={openMerge}
                  style={{ marginTop: spacing.lg }}
                />
              ) : null}
            </Card>
          ) : null
        }
        ListEmptyComponent={
          <EmptyState
            icon="pricetags-outline"
            title="No categories yet"
            message="Create buckets like Food or Commute and give each one a monthly budget."
            actionLabel="Create category"
            onAction={() => openSheet(null)}
          />
        }
      />

      <FloatingActionButton onPress={() => openSheet(null)} />

      <BottomSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={editing ? 'Edit category' : 'New category'}
      >
        <TextField
          label="Name"
          value={name}
          onChangeText={setName}
          placeholder="Bike Petrol"
          required
          error={touched && !name.trim() ? 'Give the category a name' : save.fieldErrors.name}
        />

        <TextField
          label="Monthly budget"
          value={budget}
          onChangeText={setBudget}
          keyboardType="decimal-pad"
          placeholder="3500"
          hint="Set 0 if you only want to track spending here."
          error={save.fieldErrors.allocatedAmount}
        />

        <Text style={[typography.label, { color: colors.textMuted, marginBottom: spacing.sm }]}>
          COLOUR
        </Text>
        <View style={[styles.wrap, { marginBottom: spacing.lg }]}>
          {chartPalette.map((swatch) => (
            <Pressable
              key={swatch}
              onPress={() => setColor(swatch)}
              style={[
                styles.swatch,
                {
                  backgroundColor: swatch,
                  borderColor: color === swatch ? colors.text : 'transparent',
                },
              ]}
            />
          ))}
        </View>

        <Text style={[typography.label, { color: colors.textMuted, marginBottom: spacing.sm }]}>
          ICON
        </Text>
        <View style={[styles.wrap, { marginBottom: spacing.lg }]}>
          {ICON_CHOICES.map((choice) => (
            <Pressable
              key={choice}
              onPress={() => setIcon(choice)}
              style={[
                styles.iconOption,
                {
                  backgroundColor: icon === choice ? colors.primary : colors.surfaceAlt,
                  borderRadius: radius.md,
                },
              ]}
            >
              <Ionicons
                name={choice}
                size={20}
                color={icon === choice ? colors.textInverse : colors.text}
              />
            </Pressable>
          ))}
        </View>

        {save.error && save.error.kind !== 'validation' ? (
          <Text style={[typography.caption, { color: colors.danger, marginBottom: spacing.md }]}>
            {save.error.message}
          </Text>
        ) : null}

        <Button
          label={editing ? 'Save changes' : 'Create category'}
          onPress={onSave}
          loading={save.submitting}
        />
        <Button
          label="Cancel"
          variant="ghost"
          onPress={() => setSheetOpen(false)}
          style={{ marginTop: spacing.sm }}
        />
      </BottomSheet>

      <BottomSheet
        visible={fundsFor !== null}
        onClose={() => setFundsFor(null)}
        title={`Add money to ${fundsFor?.name ?? 'category'}`}
      >
        <Text style={[typography.body, { color: colors.textMuted, marginBottom: spacing.lg }]}>
          Got money for this from somewhere else? It is added on top of the current budget of{' '}
          {formatMoney(fundsFor?.allocatedAmount ?? 0)}.
        </Text>

        <TextField
          label="Amount to add"
          value={fundsAmount}
          onChangeText={setFundsAmount}
          keyboardType="decimal-pad"
          placeholder="500"
          icon="add-circle-outline"
          required
          error={
            fundsTouched && !fundsValid ? 'Enter an amount above 0' : addFunds.fieldErrors.amount
          }
          hint={
            fundsFor && fundsValid
              ? `New budget: ${formatMoney(fundsFor.allocatedAmount + numericFunds)}`
              : undefined
          }
        />

        {addFunds.error && addFunds.error.kind !== 'validation' ? (
          <Text style={[typography.caption, { color: colors.danger, marginBottom: spacing.md }]}>
            {addFunds.error.message}
          </Text>
        ) : null}

        <Button label="Add money" onPress={onAddFunds} loading={addFunds.submitting} />
        <Button
          label="Cancel"
          variant="ghost"
          onPress={() => setFundsFor(null)}
          style={{ marginTop: spacing.sm }}
        />
      </BottomSheet>

      <BottomSheet visible={mergeOpen} onClose={() => setMergeOpen(false)} title="Merge categories">
        <Text style={[typography.label, { color: colors.textMuted, marginBottom: spacing.sm }]}>
          1. PICK THE CATEGORIES TO MERGE
        </Text>
        {(data ?? []).map((category) => {
          const selected = mergeIds.includes(category.id);
          return (
            <Pressable
              key={category.id}
              onPress={() => toggleMerge(category.id)}
              style={[styles.row, { paddingVertical: spacing.sm }]}
            >
              <Ionicons
                name={selected ? 'checkbox' : 'square-outline'}
                size={22}
                color={selected ? colors.primary : colors.textMuted}
              />
              <Text
                style={[typography.body, styles.flex, { color: colors.text, marginLeft: spacing.md }]}
                numberOfLines={1}
              >
                {category.name}
              </Text>
              <Text style={[typography.caption, { color: colors.textMuted }]}>
                {formatMoney(category.allocatedAmount)}
              </Text>
            </Pressable>
          );
        })}

        {mergeIds.length >= 2 ? (
          <>
            <Text
              style={[
                typography.label,
                { color: colors.textMuted, marginTop: spacing.lg, marginBottom: spacing.sm },
              ]}
            >
              2. WHICH ONE SHOULD STAY?
            </Text>
            {(data ?? [])
              .filter((category) => mergeIds.includes(category.id))
              .map((category) => {
                const kept = keepId === category.id;
                return (
                  <Pressable
                    key={category.id}
                    onPress={() => setKeepId(category.id)}
                    style={[styles.row, { paddingVertical: spacing.sm }]}
                  >
                    <Ionicons
                      name={kept ? 'radio-button-on' : 'radio-button-off'}
                      size={22}
                      color={kept ? colors.primary : colors.textMuted}
                    />
                    <Text
                      style={[
                        typography.body,
                        styles.flex,
                        { color: colors.text, marginLeft: spacing.md },
                      ]}
                      numberOfLines={1}
                    >
                      {category.name}
                    </Text>
                  </Pressable>
                );
              })}

            <Card style={{ marginTop: spacing.lg, marginBottom: spacing.lg }}>
              <Text style={[typography.caption, { color: colors.textMuted }]}>FINAL BUDGET</Text>
              <Text style={[typography.title, { color: colors.text, marginTop: spacing.xs }]}>
                {formatMoney(
                  (data ?? [])
                    .filter((category) => mergeIds.includes(category.id))
                    .reduce((sum, category) => sum + category.allocatedAmount, 0),
                )}
              </Text>
              <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.sm }]}>
                {keepId !== null
                  ? `Everything moves into ${
                      (data ?? []).find((category) => category.id === keepId)?.name
                    }. The other ${mergeIds.length - 1} will be deleted, their expenses are kept.`
                  : 'Choose the category to keep.'}
              </Text>
            </Card>
          </>
        ) : (
          <Text style={[typography.caption, { color: colors.textMuted, marginVertical: spacing.md }]}>
            Select at least two.
          </Text>
        )}

        {merge.error ? (
          <Text style={[typography.caption, { color: colors.danger, marginBottom: spacing.md }]}>
            {merge.error.message}
          </Text>
        ) : null}

        <Button
          label="Merge"
          icon="git-merge-outline"
          onPress={onMerge}
          loading={merge.submitting}
          disabled={mergeIds.length < 2 || keepId === null}
        />
        <Button
          label="Cancel"
          variant="ghost"
          onPress={() => setMergeOpen(false)}
          style={{ marginTop: spacing.sm }}
        />
      </BottomSheet>

      <ConfirmDialog
        visible={deleting !== null}
        title={`Delete ${deleting?.name ?? 'category'}?`}
        message="Expenses in this category are kept - they move to Other with the category name so your history and totals stay correct."
        confirmLabel="Delete"
        destructive
        loading={remove.submitting}
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          const done = await remove.submit(deleting.id);
          setDeleting(null);
          if (done !== null) {
            showToast('Category deleted', 'success');
            void reload();
          } else {
            showToast(remove.error?.message ?? 'Could not delete', 'error');
          }
        }}
      />
    </Screen>
  );
}

/** One labelled figure in a budget / spent / remaining row. */
function Figure({
  label,
  value,
  color,
  align = 'left',
}: {
  label: string;
  value: string;
  color?: string;
  align?: 'left' | 'right';
}) {
  const { colors, typography } = useTheme();
  return (
    <View style={[styles.flex, align === 'right' ? styles.alignRight : null]}>
      <Text style={[typography.caption, { color: colors.textMuted, fontSize: 10 }]}>{label}</Text>
      <Text
        style={[typography.heading, { color: color ?? colors.text, marginTop: 3 }]}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  alignRight: { alignItems: 'flex-end' },
  figures: { flexDirection: 'row', alignItems: 'flex-start' },
  row: { flexDirection: 'row', alignItems: 'center' },
  bubble: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  swatch: { width: 34, height: 34, borderRadius: 17, borderWidth: 2 },
  iconOption: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
