import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { moneyTrackerApi } from '../../api';
import {
  Button,
  ConfirmDialog,
  DateTimeField,
  Screen,
  SkeletonPlanner,
  TextField,
} from '../../components';
import { useAsyncData } from '../../hooks/useAsyncData';
import { useSubmit } from '../../hooks/useSubmit';
import { AppStackParamList } from '../../navigation/types';
import { useToast } from '../../store/ToastContext';
import { useTheme } from '../../theme';
import { MoneyTrackerType } from '../../types/api';
import { toIsoDate } from '../../utils/date';

type Nav = NativeStackNavigationProp<AppStackParamList>;
type Route = RouteProp<AppStackParamList, 'MoneyTrackerForm'>;

export function MoneyTrackerFormScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const transactionId = route.params?.transactionId;
  const editing = transactionId !== undefined;

  const { colors, radius, spacing, typography } = useTheme();
  const { showToast } = useToast();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<MoneyTrackerType>('PAY');
  const [date, setDate] = useState(toIsoDate(new Date()));
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<{ title?: string; amount?: string }>({});
  const [confirmDelete, setConfirmDelete] = useState(false);

  const fetcher = useCallback(
    () => (editing ? moneyTrackerApi.get(transactionId) : Promise.resolve(null)),
    [editing, transactionId],
  );
  const { data: existing, loading } = useAsyncData(fetcher, [transactionId], {
    enabled: editing,
  });

  useEffect(() => {
    if (!existing) return;
    setTitle(existing.title);
    setDescription(existing.description ?? '');
    setAmount(String(existing.amount));
    setType(existing.type);
    setDate(existing.date);
    setDueDate(existing.dueDate);
    setNotes(existing.notes ?? '');
  }, [existing]);

  const save = useSubmit(() => {
    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      amount: Number(amount),
      type,
      date,
      dueDate,
      notes: notes.trim() || null,
    };
    return editing
      ? moneyTrackerApi.update(transactionId, payload)
      : moneyTrackerApi.create(payload);
  });

  const remove = useSubmit(() => moneyTrackerApi.remove(transactionId as number));

  const validate = () => {
    const next: { title?: string; amount?: string } = {};
    if (!title.trim()) next.title = 'Give it a name so you recognise it later';
    const parsed = Number(amount);
    if (!amount || Number.isNaN(parsed) || parsed <= 0) {
      next.amount = 'Enter an amount greater than zero';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  if (editing && loading) {
    return (
      <Screen>
        <SkeletonPlanner rows={2} />
      </Screen>
    );
  }

  // A transaction already reflected in the salary must be undone before it can change,
  // otherwise the linked expense or adjustment would disagree with it.
  const locked = Boolean(existing?.undoable);

  return (
    <Screen scroll>
      <Text style={[typography.title, { color: colors.text, marginTop: spacing.sm }]}>
        {editing ? 'Edit transaction' : 'New transaction'}
      </Text>
      <Text style={[typography.caption, { color: colors.textMuted, marginTop: 4, marginBottom: spacing.lg }]}>
        This stays in Money Tracker until you deduct it or add it on.
      </Text>

      {locked ? (
        <View
          style={[
            styles.notice,
            {
              backgroundColor: colors.warning + '22',
              borderRadius: radius.md,
              padding: spacing.md,
              marginBottom: spacing.lg,
            },
          ]}
        >
          <Ionicons name="lock-closed-outline" size={16} color={colors.warning} />
          <Text style={[typography.caption, { color: colors.text, flex: 1, marginLeft: spacing.sm }]}>
            Already added to your salary. Undo it from Money Tracker before editing.
          </Text>
        </View>
      ) : null}

      <Text style={[typography.label, { color: colors.textMuted, marginBottom: spacing.sm }]}>
        TYPE
      </Text>
      <View style={[styles.typeRow, { marginBottom: spacing.lg }]}>
        {(['PAY', 'RECEIVE'] as MoneyTrackerType[]).map((option) => {
          const active = type === option;
          const tone = option === 'PAY' ? colors.danger : colors.success;
          return (
            <Pressable
              key={option}
              disabled={locked}
              onPress={() => setType(option)}
              style={[
                styles.typeTile,
                {
                  backgroundColor: active ? tone + '22' : colors.surface,
                  borderColor: active ? tone : colors.border,
                  borderRadius: radius.md,
                  paddingVertical: spacing.md,
                  opacity: locked ? 0.5 : 1,
                },
              ]}
            >
              <Ionicons
                name={option === 'PAY' ? 'arrow-up-outline' : 'arrow-down-outline'}
                size={18}
                color={active ? tone : colors.textMuted}
              />
              <Text
                style={[
                  typography.body,
                  { color: active ? tone : colors.textMuted, marginLeft: spacing.sm },
                ]}
              >
                {option === 'PAY' ? 'I have to pay' : 'I will receive'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <TextField
        label="Title"
        value={title}
        onChangeText={setTitle}
        placeholder="Laundry, Parking, a person's name"
        error={errors.title}
        editable={!locked}
      />

      <TextField
        label="Amount"
        value={amount}
        onChangeText={setAmount}
        placeholder="0"
        keyboardType="decimal-pad"
        error={errors.amount}
        editable={!locked}
      />

      <DateTimeField label="Date" mode="date" value={date} onChange={setDate} />

      <Text style={[typography.label, { color: colors.textMuted, marginBottom: spacing.sm }]}>
        DUE DATE (OPTIONAL)
      </Text>
      {dueDate ? (
        <>
          <DateTimeField label="Due" mode="date" value={dueDate} onChange={setDueDate} />
          <Button
            label="Remove due date"
            variant="ghost"
            onPress={() => setDueDate(null)}
            style={{ marginBottom: spacing.lg }}
          />
        </>
      ) : (
        <Button
          label="Add a due date"
          variant="secondary"
          icon="calendar-outline"
          onPress={() => setDueDate(toIsoDate(new Date()))}
          style={{ marginBottom: spacing.lg }}
        />
      )}

      <TextField
        label="Description"
        value={description}
        onChangeText={setDescription}
        placeholder="What is it for?"
        editable={!locked}
      />

      <TextField
        label="Notes"
        value={notes}
        onChangeText={setNotes}
        placeholder="Anything else worth remembering"
        multiline
        editable={!locked}
      />

      <Button
        label={editing ? 'Save changes' : 'Add transaction'}
        loading={save.submitting}
        disabled={locked}
        style={{ marginTop: spacing.md }}
        onPress={async () => {
          if (!validate()) return;
          const done = await save.submit();
          if (done !== null) {
            showToast(editing ? 'Transaction updated' : 'Transaction added', 'success');
            navigation.goBack();
          } else {
            showToast(save.error?.message ?? 'Could not save', 'error');
          }
        }}
      />

      {editing && !locked ? (
        <Button
          label="Delete"
          variant="ghost"
          icon="trash-outline"
          style={{ marginTop: spacing.sm }}
          onPress={() => setConfirmDelete(true)}
        />
      ) : null}

      <ConfirmDialog
        visible={confirmDelete}
        title={`Delete ${title || 'this transaction'}?`}
        message="It will be removed from Money Tracker. Your expenses and salary are not affected."
        confirmLabel="Delete"
        destructive
        loading={remove.submitting}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          const done = await remove.submit();
          setConfirmDelete(false);
          if (done !== null) {
            showToast('Transaction deleted', 'success');
            navigation.goBack();
          } else {
            showToast(remove.error?.message ?? 'Could not delete', 'error');
          }
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  typeRow: { flexDirection: 'row', gap: 10 },
  typeTile: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  notice: { flexDirection: 'row', alignItems: 'center' },
});
