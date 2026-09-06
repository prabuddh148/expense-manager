import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { categoryApi, expenseApi } from '../../api';
import { Button, DateTimeField, LoadingState, Screen, TextField } from '../../components';
import { useAsyncData } from '../../hooks/useAsyncData';
import { useSubmit } from '../../hooks/useSubmit';
import { AppStackParamList } from '../../navigation/types';
import { useToast } from '../../store/ToastContext';
import { useTheme } from '../../theme';
import { toIsoDate, toIsoTime } from '../../utils/date';
import { CURRENCY } from '../../constants/config';

type Props = NativeStackScreenProps<AppStackParamList, 'AddExpense'>;

export function AddExpenseScreen({ navigation, route }: Props) {
  const expenseId = route.params?.expenseId;
  const isEditing = typeof expenseId === 'number';
  const { colors, radius, spacing, typography } = useTheme();
  const { showToast } = useToast();

  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(route.params?.categoryId ?? null);
  const [pickedOther, setPickedOther] = useState(false);
  const [expenseName, setExpenseName] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(toIsoDate(new Date()));
  const [time, setTime] = useState(toIsoTime(new Date()));
  const [touched, setTouched] = useState(false);

  const categories = useAsyncData(() => categoryApi.list(), [], { cacheKey: 'categories' });
  const existing = useAsyncData(() => expenseApi.get(expenseId as number), [expenseId], {
    enabled: isEditing,
  });

  useEffect(() => {
    navigation.setOptions({ title: isEditing ? 'Edit Expense' : 'Add Expense' });
  }, [isEditing, navigation]);

  useEffect(() => {
    const expense = existing.data;
    if (!expense) return;
    setAmount(String(expense.amount));
    setCategoryId(expense.categoryId);
    setPickedOther(expense.categoryId === null);
    setExpenseName(expense.expenseName ?? '');
    setDescription(expense.description ?? '');
    setDate(expense.date);
    setTime(expense.time ?? toIsoTime(new Date()));
  }, [existing.data]);

  const numericAmount = Number(amount.replace(/,/g, ''));
  const amountValid = Number.isFinite(numericAmount) && numericAmount > 0;
  const categoryChosen = pickedOther || categoryId !== null;
  const otherNameMissing = pickedOther && !expenseName.trim();

  const save = useSubmit(async () => {
    const payload = {
      amount: numericAmount,
      categoryId: pickedOther ? null : categoryId,
      expenseName: expenseName.trim() || null,
      description: description.trim() || null,
      date,
      time,
    };
    return isEditing
      ? expenseApi.update(expenseId as number, payload)
      : expenseApi.create(payload);
  });

  const onSubmit = async () => {
    setTouched(true);
    if (!amountValid || !categoryChosen || otherNameMissing) {
      return;
    }
    const result = await save.submit();
    if (result) {
      showToast(isEditing ? 'Expense updated' : 'Expense added', 'success');
      navigation.goBack();
    }
  };

  if (isEditing && existing.loading) {
    return (
      <Screen>
        <LoadingState label="Loading expense" />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.lg }]}>
        AMOUNT
      </Text>
      <View style={[styles.amountRow, { marginBottom: spacing.lg }]}>
        <Text style={[typography.display, { color: colors.textMuted, marginRight: 6 }]}>
          {CURRENCY.symbol}
        </Text>
        <TextField
          label=""
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          placeholder="0"
          containerStyle={{ flex: 1, marginBottom: 0 }}
          style={{ fontSize: 28, fontWeight: '800' }}
          error={touched && !amountValid ? 'Enter an amount greater than zero' : undefined}
        />
      </View>

      <Text style={[typography.label, { color: colors.textMuted, marginBottom: spacing.sm }]}>
        CATEGORY <Text style={{ color: colors.danger }}>*</Text>
      </Text>

      {categories.loading ? (
        <Text style={[typography.body, { color: colors.textMuted, marginBottom: spacing.md }]}>
          Loading categories...
        </Text>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingRight: spacing.lg, gap: 8 }}
          style={{ marginBottom: spacing.md }}
        >
          {(categories.data ?? []).map((category) => {
            const active = !pickedOther && categoryId === category.id;
            return (
              <Pressable
                key={category.id}
                onPress={() => {
                  setCategoryId(category.id);
                  setPickedOther(false);
                }}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? colors.primary : colors.surface,
                    borderColor: active ? colors.primary : colors.border,
                    borderRadius: radius.pill,
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.sm,
                  },
                ]}
              >
                <View
                  style={[styles.chipDot, { backgroundColor: category.color ?? colors.primary }]}
                />
                <Text
                  style={[typography.caption, { color: active ? colors.textInverse : colors.text }]}
                >
                  {category.name}
                </Text>
              </Pressable>
            );
          })}

          <Pressable
            onPress={() => {
              setPickedOther(true);
              setCategoryId(null);
            }}
            style={[
              styles.chip,
              {
                backgroundColor: pickedOther ? colors.accent : colors.surface,
                borderColor: pickedOther ? colors.accent : colors.border,
                borderRadius: radius.pill,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
              },
            ]}
          >
            <Ionicons
              name="ellipsis-horizontal-circle-outline"
              size={14}
              color={pickedOther ? '#FFFFFF' : colors.text}
              style={{ marginRight: 6 }}
            />
            <Text style={[typography.caption, { color: pickedOther ? '#FFFFFF' : colors.text }]}>
              Other
            </Text>
          </Pressable>
        </ScrollView>
      )}

      {touched && !categoryChosen ? (
        <Text style={[typography.caption, { color: colors.danger, marginBottom: spacing.md }]}>
          Pick a category, or Other for a one-off expense
        </Text>
      ) : null}

      {pickedOther ? (
        <TextField
          label="Other expense name"
          value={expenseName}
          onChangeText={setExpenseName}
          placeholder="Shopping"
          icon="pricetag-outline"
          required
          error={touched && otherNameMissing ? 'Name this expense so you can find it later' : undefined}
        />
      ) : null}

      <View style={styles.dateRow}>
        <View style={styles.half}>
          <DateTimeField label="Date" mode="date" value={date} onChange={setDate} />
        </View>
        <View style={[styles.half, { marginLeft: spacing.md }]}>
          <DateTimeField label="Time" mode="time" value={time} onChange={setTime} />
        </View>
      </View>

      <TextField
        label="Description"
        value={description}
        onChangeText={setDescription}
        placeholder="Optional note"
        icon="document-text-outline"
        multiline
      />

      {save.error ? (
        <Text style={[typography.caption, { color: colors.danger, marginBottom: spacing.md }]}>
          {save.error.message}
        </Text>
      ) : null}

      <Button
        label={isEditing ? 'Save changes' : 'Add expense'}
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
  amountRow: { flexDirection: 'row', alignItems: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', borderWidth: StyleSheet.hairlineWidth },
  chipDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  dateRow: { flexDirection: 'row' },
  half: { flex: 1 },
});
