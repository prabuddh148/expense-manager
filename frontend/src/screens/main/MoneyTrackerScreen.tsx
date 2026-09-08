import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { moneyTrackerApi } from '../../api';
import {
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  FloatingActionButton,
  Screen,
  SkeletonList,
} from '../../components';
import { useAsyncData } from '../../hooks/useAsyncData';
import { AppStackParamList } from '../../navigation/types';
import { useToast } from '../../store/ToastContext';
import { useTheme } from '../../theme';
import { MoneyTrackerTransaction } from '../../types/api';
import { formatDate } from '../../utils/date';
import { formatMoney } from '../../utils/format';

type Nav = NativeStackNavigationProp<AppStackParamList>;

type Filter = 'ALL' | 'PAY' | 'RECEIVE' | 'LINKED';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'PAY', label: 'To pay' },
  { key: 'RECEIVE', label: 'To receive' },
  { key: 'LINKED', label: 'Moved' },
];

/** Which action is waiting on a confirmation dialog. */
type PendingAction =
  | { kind: 'deduct'; transaction: MoneyTrackerTransaction }
  | { kind: 'addOn'; transaction: MoneyTrackerTransaction }
  | { kind: 'undo'; transaction: MoneyTrackerTransaction }
  | null;

/**
 * Money owed in either direction, kept out of the salary figures on purpose. Nothing on
 * this screen changes a balance until the user taps Deduct or Add on, and each of those
 * asks first, because it writes into the expense/salary side of the app.
 */
export function MoneyTrackerScreen() {
  const navigation = useNavigation<Nav>();
  const { colors, radius, spacing, typography } = useTheme();
  const { showToast } = useToast();

  const [filter, setFilter] = useState<Filter>('ALL');
  const [pending, setPending] = useState<PendingAction>(null);
  const [working, setWorking] = useState(false);

  const listFetcher = useCallback(() => moneyTrackerApi.list(), []);
  const { data, loading, refreshing, error, refresh, reload } = useAsyncData(listFetcher, [], {
    cacheKey: 'money-tracker',
  });

  const summaryFetcher = useCallback(() => moneyTrackerApi.summary(), []);
  const { data: summary, refresh: refreshSummary } = useAsyncData(summaryFetcher, [], {
    cacheKey: 'money-tracker-summary',
  });

  const reloadAll = useCallback(() => {
    void refresh();
    void refreshSummary();
  }, [refresh, refreshSummary]);

  const transactions = (data ?? []).filter((item) => {
    if (filter === 'LINKED') return item.action !== 'NONE';
    if (filter === 'PAY') return item.type === 'PAY' && item.action === 'NONE';
    if (filter === 'RECEIVE') return item.type === 'RECEIVE' && item.action === 'NONE';
    return true;
  });

  const runAction = async () => {
    if (!pending) return;
    const { kind, transaction } = pending;
    setWorking(true);
    try {
      if (kind === 'deduct') {
        await moneyTrackerApi.deduct(transaction.id);
        showToast(`${transaction.title} deducted from your salary`, 'success');
      } else if (kind === 'addOn') {
        await moneyTrackerApi.addOn(transaction.id);
        showToast(`${transaction.title} added to your salary`, 'success');
      } else {
        await moneyTrackerApi.undo(transaction.id);
        showToast('Reversed and returned to Money Tracker', 'success');
      }
      setPending(null);
      reloadAll();
    } catch (caught) {
      // The transaction is left exactly as it was, so nothing is lost on failure.
      const { toAppError } = await import('../../api');
      showToast(toAppError(caught).message, 'error');
    } finally {
      setWorking(false);
    }
  };

  const toggleComplete = async (transaction: MoneyTrackerTransaction) => {
    const done = transaction.status === 'COMPLETED';
    try {
      await moneyTrackerApi.complete(transaction.id, !done);
      showToast(done ? 'Marked as pending' : 'Marked as settled', 'success');
      reloadAll();
    } catch (caught) {
      const { toAppError } = await import('../../api');
      showToast(toAppError(caught).message, 'error');
    }
  };

  const renderItem = useCallback(
    ({ item }: { item: MoneyTrackerTransaction }) => {
      const isPay = item.type === 'PAY';
      const tone = isPay ? colors.danger : colors.success;
      const moved = item.action !== 'NONE';
      const settled = item.status === 'COMPLETED';

      return (
        <Card
          style={{ marginBottom: spacing.md }}
          onPress={() => navigation.navigate('MoneyTrackerForm', { transactionId: item.id })}
        >
          <View style={styles.row}>
            <View style={[styles.bubble, { backgroundColor: tone + '22' }]}>
              <Ionicons
                name={isPay ? 'arrow-up-outline' : 'arrow-down-outline'}
                size={19}
                color={tone}
              />
            </View>

            <View style={[styles.flex, { marginLeft: spacing.md }]}>
              <Text style={[typography.heading, { color: colors.text }]} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
                {isPay ? 'Pay' : 'Receive'} · {formatDate(item.date)}
                {item.dueDate ? ` · due ${formatDate(item.dueDate)}` : ''}
              </Text>
            </View>

            <Text style={[typography.heading, { color: tone }]}>
              {isPay ? '-' : '+'}
              {formatMoney(item.amount)}
            </Text>
          </View>

          <View style={[styles.badges, { marginTop: spacing.md }]}>
            <Badge
              label={moved ? (item.action === 'DEDUCTED' ? 'Deducted' : 'Add on') : item.status}
              color={moved ? colors.primary : settled ? colors.success : colors.warning}
            />
            {item.overdue ? <Badge label="OVERDUE" color={colors.danger} /> : null}
          </View>

          {moved ? (
            <>
              <Text
                style={[typography.caption, { color: colors.textMuted, marginTop: spacing.md }]}
              >
                Source: Money Tracker · Action: {item.action === 'DEDUCTED' ? 'Deducted' : 'Add On'}
              </Text>
              <Button
                label="Undo"
                variant="secondary"
                icon="arrow-undo-outline"
                style={{ marginTop: spacing.md }}
                onPress={() => setPending({ kind: 'undo', transaction: item })}
              />
            </>
          ) : (
            <View style={[styles.actions, { marginTop: spacing.md }]}>
              <Button
                label={settled ? (isPay ? 'Paid' : 'Received') : isPay ? 'Mark paid' : 'Mark received'}
                variant={settled ? 'ghost' : 'secondary'}
                icon={settled ? 'checkmark-circle' : 'checkmark-outline'}
                style={styles.flex}
                onPress={() => toggleComplete(item)}
              />
              <View style={{ width: spacing.sm }} />
              <Button
                label={isPay ? 'Deduct' : 'Add on'}
                style={styles.flex}
                onPress={() =>
                  setPending({ kind: isPay ? 'deduct' : 'addOn', transaction: item })
                }
              />
            </View>
          )}
        </Card>
      );
    },
    [colors, navigation, spacing, typography],
  );

  if (loading) {
    return (
      <Screen edges={['bottom']}>
        <SkeletonList rows={4} />
      </Screen>
    );
  }

  if (error && !data) {
    return (
      <Screen edges={['bottom']}>
        <ErrorState message={error.message} offline={error.kind === 'network'} onRetry={reload} />
      </Screen>
    );
  }

  return (
    <Screen edges={['bottom']} padded={false}>
      <FlatList
        data={transactions}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={reloadAll} tintColor={colors.primary} />
        }
        ListHeaderComponent={
          <View style={{ marginBottom: spacing.lg }}>
            <Text style={[typography.title, { color: colors.text }]}>Money Tracker</Text>
            <Text style={[typography.caption, { color: colors.textMuted, marginTop: 4 }]}>
              Kept out of your expenses until you say otherwise
            </Text>

            <View style={[styles.summaryRow, { marginTop: spacing.lg }]}>
              <SummaryTile
                label="TO PAY"
                value={formatMoney(summary?.toPay ?? 0)}
                color={colors.danger}
              />
              <View style={{ width: spacing.md }} />
              <SummaryTile
                label="TO RECEIVE"
                value={formatMoney(summary?.toReceive ?? 0)}
                color={colors.success}
              />
            </View>

            <View style={[styles.chips, { marginTop: spacing.lg }]}>
              {FILTERS.map((option) => {
                const active = filter === option.key;
                return (
                  <Pressable
                    key={option.key}
                    onPress={() => setFilter(option.key)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: active ? colors.primary : colors.surface,
                        borderColor: active ? colors.primary : colors.border,
                        borderRadius: radius.pill,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        typography.caption,
                        { color: active ? colors.textInverse : colors.textMuted },
                      ]}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon="swap-horizontal-outline"
            title={filter === 'ALL' ? 'Nothing tracked yet' : 'Nothing here'}
            message={
              filter === 'ALL'
                ? 'Tap the + button to record money you owe or money owed to you. It stays out of your expenses until you choose otherwise.'
                : 'Try a different filter.'
            }
          />
        }
      />

      <FloatingActionButton
        accessibilityLabel="Add transaction"
        onPress={() => navigation.navigate('MoneyTrackerForm')}
      />

      <ConfirmDialog
        visible={pending !== null}
        title={
          pending?.kind === 'undo'
            ? 'Undo this transaction?'
            : pending?.kind === 'deduct'
              ? `Deduct ${formatMoney(pending.transaction.amount)} from salary?`
              : `Add ${pending ? formatMoney(pending.transaction.amount) : ''} to salary?`
        }
        message={
          pending?.kind === 'undo'
            ? 'This will reverse the previous salary or expense adjustment and return the transaction to Money Tracker.'
            : pending?.kind === 'deduct'
              ? 'An expense will be created and your remaining salary will go down by this amount. You can undo it later.'
              : 'This amount will be credited on top of your salary for this month. Your stated salary stays the same. You can undo it later.'
        }
        confirmLabel={pending?.kind === 'undo' ? 'Undo' : 'Confirm'}
        loading={working}
        onCancel={() => setPending(null)}
        onConfirm={runAction}
      />
    </Screen>
  );
}

function SummaryTile({ label, value, color }: { label: string; value: string; color: string }) {
  const { colors, radius, spacing, typography } = useTheme();
  return (
    <View
      style={[
        styles.flex,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderWidth: StyleSheet.hairlineWidth,
          borderRadius: radius.lg,
          padding: spacing.lg,
        },
      ]}
    >
      <Text style={[typography.caption, { color: colors.textMuted, fontSize: 10 }]}>{label}</Text>
      <Text style={[typography.title, { color, marginTop: 4 }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function Badge({ label, color }: { label: string; color: string }) {
  const { radius, spacing, typography } = useTheme();
  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: color + '22',
          borderRadius: radius.pill,
          paddingHorizontal: spacing.md,
        },
      ]}
    >
      <Text style={[typography.caption, { color, fontSize: 10 }]}>{label.toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  bubble: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  summaryRow: { flexDirection: 'row' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderWidth: StyleSheet.hairlineWidth },
  badges: { flexDirection: 'row', gap: 8 },
  badge: { paddingVertical: 4 },
  actions: { flexDirection: 'row' },
});
