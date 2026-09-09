import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { savingsApi, toAppError } from '../../api';
import {
  BottomSheet,
  Button,
  Card,
  ConfirmDialog,
  DateTimeField,
  EmptyState,
  ErrorState,
  FloatingActionButton,
  ProgressBar,
  Screen,
  SkeletonPlanner,
  TextField,
} from '../../components';
import { useAsyncData } from '../../hooks/useAsyncData';
import { useToast } from '../../store/ToastContext';
import { colorForIndex, useTheme } from '../../theme';
import { SavingsEntry, SavingsMethod } from '../../types/api';
import { formatDate, toIsoDate } from '../../utils/date';
import { formatMoney, formatPercent } from '../../utils/format';

/** Kept in the order someone is most likely to reach for. */
const METHODS: { key: SavingsMethod; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'BANK_ACCOUNT', label: 'Bank account', icon: 'business-outline' },
  { key: 'CASH', label: 'Cash', icon: 'cash-outline' },
  { key: 'RECURRING_DEPOSIT', label: 'Recurring deposit', icon: 'repeat-outline' },
  { key: 'FIXED_DEPOSIT', label: 'Fixed deposit', icon: 'lock-closed-outline' },
  { key: 'SIP', label: 'SIP', icon: 'trending-up-outline' },
  { key: 'MUTUAL_FUND', label: 'Mutual fund', icon: 'pie-chart-outline' },
  { key: 'STOCKS', label: 'Stocks', icon: 'stats-chart-outline' },
  { key: 'GOLD', label: 'Gold', icon: 'diamond-outline' },
  { key: 'PPF', label: 'PPF', icon: 'shield-checkmark-outline' },
  { key: 'OTHER', label: 'Other', icon: 'ellipsis-horizontal-outline' },
];

const iconFor = (method: SavingsMethod) =>
  METHODS.find((entry) => entry.key === method)?.icon ?? 'wallet-outline';

/**
 * What has been put aside, and by what means.
 *
 * A record rather than part of the balance: money moved into savings has usually
 * already left the account as an expense, so counting it here as well would deduct it
 * twice. The salary figures are deliberately untouched by anything on this screen.
 */
export function SavingsScreen() {
  const { colors, radius, spacing, typography } = useTheme();
  const { showToast } = useToast();

  const listFetcher = useCallback(() => savingsApi.list(), []);
  const { data, loading, refreshing, error, refresh, reload } = useAsyncData(listFetcher, [], {
    cacheKey: 'savings',
  });

  const summaryFetcher = useCallback(() => savingsApi.summary(), []);
  const { data: summary, refresh: refreshSummary } = useAsyncData(summaryFetcher, [], {
    cacheKey: 'savings-summary',
  });

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<SavingsEntry | null>(null);
  const [deleting, setDeleting] = useState<SavingsEntry | null>(null);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<SavingsMethod>('BANK_ACCOUNT');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(toIsoDate(new Date()));
  const [errors, setErrors] = useState<{ title?: string; amount?: string }>({});

  const reloadAll = useCallback(() => {
    void refresh();
    void refreshSummary();
  }, [refresh, refreshSummary]);

  const openSheet = (entry: SavingsEntry | null) => {
    setEditing(entry);
    setTitle(entry?.title ?? '');
    setAmount(entry ? String(entry.amount) : '');
    setMethod(entry?.method ?? 'BANK_ACCOUNT');
    setNote(entry?.note ?? '');
    setDate(entry?.date ?? toIsoDate(new Date()));
    setErrors({});
    setSheetOpen(true);
  };

  const save = async () => {
    const next: { title?: string; amount?: string } = {};
    if (!title.trim()) next.title = 'What is this saving for?';
    const parsed = Number(amount);
    if (!amount || Number.isNaN(parsed) || parsed <= 0) next.amount = 'Enter an amount above zero';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        amount: parsed,
        method,
        note: note.trim() || null,
        date,
      };
      if (editing) {
        await savingsApi.update(editing.id, payload);
      } else {
        await savingsApi.create(payload);
      }
      setSheetOpen(false);
      showToast(editing ? 'Saving updated' : 'Saving recorded', 'success');
      reloadAll();
    } catch (caught) {
      showToast(toAppError(caught).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const renderItem = useCallback(
    ({ item }: { item: SavingsEntry }) => (
      <Card style={{ marginBottom: spacing.md }} onPress={() => openSheet(item)}>
        <View style={styles.row}>
          <View style={[styles.bubble, { backgroundColor: colors.success + '22' }]}>
            <Ionicons name={iconFor(item.method)} size={18} color={colors.success} />
          </View>

          <View style={[styles.flex, { marginLeft: spacing.md }]}>
            <Text style={[typography.heading, { color: colors.text }]} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
              {item.methodLabel} · {formatDate(item.date)}
            </Text>
          </View>

          <Text style={[typography.heading, { color: colors.success }]}>
            {formatMoney(item.amount)}
          </Text>
        </View>

        {item.note ? (
          <Text
            style={[typography.caption, { color: colors.textMuted, marginTop: spacing.md }]}
            numberOfLines={2}
          >
            {item.note}
          </Text>
        ) : null}

        <Pressable
          onPress={() => setDeleting(item)}
          hitSlop={8}
          style={[styles.deleteRow, { marginTop: spacing.md }]}
        >
          <Ionicons name="trash-outline" size={14} color={colors.textMuted} />
          <Text style={[typography.caption, { color: colors.textMuted, marginLeft: 6 }]}>
            Delete
          </Text>
        </Pressable>
      </Card>
    ),
    [colors, spacing, typography],
  );

  if (loading) {
    return (
      <Screen>
        <SkeletonPlanner rows={3} />
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

  return (
    <Screen padded={false}>
      <FlatList
        data={data ?? []}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={reloadAll} tintColor={colors.primary} />
        }
        ListHeaderComponent={
          (data ?? []).length > 0 ? (
            <View style={{ marginBottom: spacing.lg }}>
              <Card>
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                  TOTAL SAVED
                </Text>
                <Text
                  style={[typography.display, { color: colors.success, marginTop: spacing.xs }]}
                >
                  {formatMoney(summary?.total ?? 0)}
                </Text>
                <Text style={[typography.caption, { color: colors.textMuted, marginTop: 4 }]}>
                  {formatMoney(summary?.thisMonth ?? 0)} this month ·{' '}
                  {summary?.entryCount ?? 0} {summary?.entryCount === 1 ? 'entry' : 'entries'}
                </Text>
              </Card>

              {/* Where it went, which the expense list cannot tell you. */}
              {(summary?.byMethod ?? []).length > 0 ? (
                <Card style={{ marginTop: spacing.md }}>
                  <Text
                    style={[typography.label, { color: colors.textMuted, marginBottom: spacing.md }]}
                  >
                    HOW IT IS SAVED
                  </Text>
                  {(summary?.byMethod ?? []).map((entry, index) => (
                    <View key={entry.method} style={{ marginBottom: spacing.md }}>
                      <ProgressBar
                        percentage={entry.percentage}
                        color={colorForIndex(index)}
                        label={entry.label}
                        trailing={`${formatMoney(entry.amount)} · ${formatPercent(entry.percentage)}`}
                      />
                    </View>
                  ))}
                </Card>
              ) : null}
            </View>
          ) : null
        }
        ListEmptyComponent={
          <EmptyState
            icon="wallet-outline"
            title="No savings recorded"
            message="Keep a note of what you put aside and how - a recurring deposit, an SIP, cash at home. This is a record only; it does not change your salary or expenses."
            actionLabel="Record a saving"
            onAction={() => openSheet(null)}
          />
        }
      />

      <FloatingActionButton accessibilityLabel="Record a saving" onPress={() => openSheet(null)} />

      <BottomSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={editing ? 'Edit saving' : 'Record a saving'}
      >
        <TextField
          label="What is it for"
          value={title}
          onChangeText={setTitle}
          placeholder="Emergency fund, bike down payment"
          error={errors.title}
        />

        <TextField
          label="Amount"
          value={amount}
          onChangeText={setAmount}
          placeholder="0"
          keyboardType="decimal-pad"
          error={errors.amount}
        />

        <Text style={[typography.label, { color: colors.textMuted, marginBottom: spacing.sm }]}>
          HOW DID YOU SAVE IT
        </Text>
        <View style={[styles.methodWrap, { marginBottom: spacing.lg }]}>
          {METHODS.map((option) => {
            const active = method === option.key;
            return (
              <Pressable
                key={option.key}
                onPress={() => setMethod(option.key)}
                style={[
                  styles.methodChip,
                  {
                    backgroundColor: active ? colors.primary : colors.surfaceAlt,
                    borderColor: active ? colors.primary : colors.border,
                    borderRadius: radius.pill,
                  },
                ]}
              >
                <Ionicons
                  name={option.icon}
                  size={14}
                  color={active ? colors.textInverse : colors.textMuted}
                />
                <Text
                  style={[
                    typography.caption,
                    { color: active ? colors.textInverse : colors.textMuted, marginLeft: 6 },
                  ]}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <DateTimeField label="Date" mode="date" value={date} onChange={setDate} />

        <TextField
          label="Note"
          value={note}
          onChangeText={setNote}
          placeholder="Which bank or fund, anything worth remembering"
          multiline
        />

        <Button label={editing ? 'Save changes' : 'Record saving'} loading={saving} onPress={save} />
      </BottomSheet>

      <ConfirmDialog
        visible={deleting !== null}
        title={`Delete ${deleting?.title ?? 'this entry'}?`}
        message="The record is removed. Your expenses and salary are not affected."
        confirmLabel="Delete"
        destructive
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await savingsApi.remove(deleting.id);
            setDeleting(null);
            showToast('Entry deleted', 'success');
            reloadAll();
          } catch (caught) {
            showToast(toAppError(caught).message, 'error');
          }
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  bubble: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  deleteRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start' },
  methodWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  methodChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
