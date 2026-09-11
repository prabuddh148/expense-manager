import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { categoryApi, smsApi, toAppError } from '../../api';
import {
  BottomSheet,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Screen,
  SkeletonList,
} from '../../components';
import { useAsyncData } from '../../hooks/useAsyncData';
import { useSmsScanner } from '../../hooks/useSmsScanner';
import { AppStackParamList } from '../../navigation/types';
import { useToast } from '../../store/ToastContext';
import { useTheme } from '../../theme';
import { Category, SmsTransaction, SmsTransactionStatus } from '../../types/api';
import { formatDate, formatTime } from '../../utils/date';
import { formatMoney } from '../../utils/format';

type Nav = NativeStackNavigationProp<AppStackParamList>;

const STATUS_FILTERS: { key: SmsTransactionStatus | 'ALL'; label: string }[] = [
  { key: 'UNCATEGORIZED', label: 'Pending' },
  { key: 'CATEGORIZED', label: 'Ready' },
  { key: 'ADDED_TO_EXPENSE', label: 'Added' },
  { key: 'ALL', label: 'All' },
];

/**
 * Bank transactions recognised on the device.
 *
 * Nothing here is automatic beyond the detection itself: every row arrives
 * uncategorised, the user picks the category, and only then can it become an expense.
 */
export function SmsTransactionsScreen() {
  const navigation = useNavigation<Nav>();
  const { colors, radius, spacing, typography } = useTheme();
  const { showToast } = useToast();
  const scanner = useSmsScanner();

  const [bank, setBank] = useState<string | null>(null);
  const [status, setStatus] = useState<SmsTransactionStatus | 'ALL'>('UNCATEGORIZED');
  const [picking, setPicking] = useState<SmsTransaction | null>(null);
  const [deleting, setDeleting] = useState<SmsTransaction | null>(null);
  const [clearingAll, setClearingAll] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const listFetcher = useCallback(
    () =>
      smsApi.list({
        bank: bank ?? undefined,
        status: status === 'ALL' ? undefined : status,
      }),
    [bank, status],
  );
  const { data, loading, refreshing, error, refresh, reload } = useAsyncData(
    listFetcher,
    [bank, status],
    { cacheKey: 'sms-transactions' },
  );

  const banksFetcher = useCallback(() => smsApi.banks(), []);
  const { data: banks, refresh: refreshBanks } = useAsyncData(banksFetcher, [], {
    cacheKey: 'sms-banks',
  });

  const categoriesFetcher = useCallback(() => categoryApi.list(), []);
  const { data: categories } = useAsyncData(categoriesFetcher, []);

  const reloadAll = useCallback(() => {
    void refresh();
    void refreshBanks();
  }, [refresh, refreshBanks]);

  // Counts come from the bank summaries, which cover every transaction regardless of
  // the filter currently applied - counting the visible list would always agree with
  // itself and tell us nothing about the other tabs.
  const statusCounts: Partial<Record<SmsTransactionStatus | 'ALL', number>> = {
    UNCATEGORIZED: (banks ?? []).reduce((sum, entry) => sum + entry.uncategorized, 0),
    CATEGORIZED: (banks ?? []).reduce((sum, entry) => sum + entry.categorized, 0),
    ADDED_TO_EXPENSE: (banks ?? []).reduce((sum, entry) => sum + entry.addedToExpense, 0),
    ALL: (banks ?? []).reduce((sum, entry) => sum + entry.total, 0),
  };

  // Scan as soon as the screen can. Without this the list only ever showed what a
  // previous session had imported, and the feature looked broken until the refresh
  // button was found - the watermark means this reads only what arrived since last time.
  const scanOnOpen = scanner.scan;
  useEffect(() => {
    if (scanner.permission !== 'granted') return;
    void scanOnOpen().then((result) => {
      if (result && result.imported > 0) reloadAll();
    });
  }, [reloadAll, scanOnOpen, scanner.permission]);

  // Watch for new messages while the screen is open, so a transaction that arrives now
  // shows up without the user doing anything.
  useEffect(() => {
    if (scanner.permission !== 'granted') return undefined;

    const unsubscribe = scanner.subscribe((message) => {
      void scanner
        .handleIncoming(message.body, message.sender, message.timestamp)
        .then(() => reloadAll());
    });
    return unsubscribe;
  }, [reloadAll, scanner]);

  const runScan = async () => {
    const result = await scanner.scan();
    if (!result) return;
    if (result.error) {
      showToast(result.error, 'error');
    } else {
      showToast(
        result.imported > 0
          ? `${result.imported} new ${result.imported === 1 ? 'transaction' : 'transactions'} found`
          : 'No new transactions found',
        'success',
      );
    }
    reloadAll();
  };

  const chooseCategory = async (transaction: SmsTransaction, category: Category) => {
    setBusyId(transaction.id);
    try {
      await smsApi.categorise(transaction.id, category.id);
      setPicking(null);
      reloadAll();
    } catch (caught) {
      showToast(toAppError(caught).message, 'error');
    } finally {
      setBusyId(null);
    }
  };

  const addToExpense = async (transaction: SmsTransaction) => {
    setBusyId(transaction.id);
    try {
      await smsApi.addToExpense(transaction.id);
      showToast('Added to your expenses', 'success');
      reloadAll();
    } catch (caught) {
      // Left in the list on failure, so nothing is lost.
      showToast(toAppError(caught).message, 'error');
    } finally {
      setBusyId(null);
    }
  };

  const removeOne = async (transaction: SmsTransaction) => {
    setBusyId(transaction.id);
    try {
      await smsApi.remove(transaction.id);
      // Deleting is a "look at this again" action, unlike ignore. The scan has to be
      // allowed back over the message for that to hold.
      await scanner.resetWatermark();
      setDeleting(null);
      // A bank with nothing left disappears from the filters, so do not stay on it.
      const remaining = (data ?? []).filter((row) => row.id !== transaction.id);
      if (bank && !remaining.some((row) => row.bankName === bank)) {
        setBank(null);
      }
      showToast('Record deleted', 'success');
      reloadAll();
    } catch (caught) {
      showToast(toAppError(caught).message, 'error');
    } finally {
      setBusyId(null);
    }
  };

  const renderItem = useCallback(
    ({ item }: { item: SmsTransaction }) => {
      const isDebit = item.transactionType === 'DEBIT';
      const tone = isDebit ? colors.danger : colors.success;
      const added = item.status === 'ADDED_TO_EXPENSE';

      return (
        <Card style={{ marginBottom: spacing.md }}>
          <View style={styles.row}>
            <View style={[styles.bubble, { backgroundColor: tone + '22' }]}>
              <Ionicons name={isDebit ? 'arrow-up' : 'arrow-down'} size={18} color={tone} />
            </View>
            <View style={[styles.flex, { marginLeft: spacing.md }]}>
              <Text style={[typography.heading, { color: colors.text }]} numberOfLines={1}>
                {item.bankName}
              </Text>
              <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
                {item.accountIdentifier ? `${item.accountIdentifier} · ` : ''}
                {formatDate(item.transactionDate)}
                {item.transactionTime ? ` · ${formatTime(item.transactionTime)}` : ''}
              </Text>
            </View>
            <View style={styles.alignRight}>
              <Text style={[typography.heading, { color: tone }]}>
                {formatMoney(item.amount)}
              </Text>
              <Text style={[typography.caption, { color: colors.textMuted, fontSize: 10 }]}>
                {isDebit ? 'DEBIT' : 'CREDIT'}
              </Text>
            </View>
          </View>

          {item.merchant ? (
            <Text
              style={[typography.body, { color: colors.textMuted, marginTop: spacing.md }]}
              numberOfLines={1}
            >
              {item.merchant}
            </Text>
          ) : null}

          <View style={[styles.row, { marginTop: spacing.md }]}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>Category: </Text>
            <Text
              style={[
                typography.caption,
                { color: item.categoryName ? colors.text : colors.warning },
              ]}
            >
              {item.categoryName ?? 'Uncategorized'}
            </Text>
          </View>

          {added ? (
            <View
              style={[
                styles.addedRow,
                { backgroundColor: colors.success + '22', borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md },
              ]}
            >
              <Ionicons name="checkmark-circle" size={16} color={colors.success} />
              <Text style={[typography.caption, { color: colors.success, marginLeft: spacing.sm }]}>
                Added to expenses
              </Text>
            </View>
          ) : (
            <View style={[styles.actions, { marginTop: spacing.md }]}>
              <Button
                label={item.categoryName ? 'Change category' : 'Select category'}
                variant="secondary"
                style={styles.flex}
                onPress={() => setPicking(item)}
              />
              {isDebit ? (
                <>
                  <View style={{ width: spacing.sm }} />
                  <Button
                    label="Add to expense"
                    style={styles.flex}
                    disabled={!item.readyForExpense}
                    loading={busyId === item.id}
                    onPress={() => addToExpense(item)}
                  />
                </>
              ) : null}
            </View>
          )}

          {/* Deleting is allowed on anything that has not become an expense; one that
              has keeps its record so the expense can still be traced back. */}
          {added ? null : (
            <Pressable
              onPress={() => setDeleting(item)}
              hitSlop={8}
              style={[styles.deleteRow, { marginTop: spacing.md }]}
            >
              <Ionicons name="trash-outline" size={14} color={colors.textMuted} />
              <Text style={[typography.caption, { color: colors.textMuted, marginLeft: 6 }]}>
                Delete this record
              </Text>
            </Pressable>
          )}
        </Card>
      );
    },
    [busyId, colors, radius, spacing, typography],
  );

  // The module is missing entirely in Expo Go and on iOS - say so rather than failing.
  if (!scanner.available) {
    return (
      <Screen edges={['bottom']}>
        <EmptyState
          icon="phone-portrait-outline"
          title="Not available in this build"
          message="Reading bank messages needs the Android development build of the app. iOS gives apps no way to read SMS at all, so this section is Android only."
        />
      </Screen>
    );
  }

  if (scanner.permission !== 'granted') {
    return (
      <Screen edges={['bottom']} scroll>
        <Text style={[typography.title, { color: colors.text, marginTop: spacing.lg }]}>
          SMS Transactions
        </Text>

        <Card style={{ marginTop: spacing.lg }}>
          <Ionicons name="chatbubble-ellipses-outline" size={26} color={colors.primary} />
          <Text style={[typography.heading, { color: colors.text, marginTop: spacing.md }]}>
            Allow Expense Manager to read transaction SMS
          </Text>
          <Text style={[typography.body, { color: colors.textMuted, marginTop: spacing.sm }]}>
            Only messages that look like bank transactions are read, and they are parsed on
            this phone - the text is never uploaded. Everything else in the app works
            without this.
          </Text>

          {scanner.permission === 'blocked' ? (
            <>
              <Text style={[typography.caption, { color: colors.warning, marginTop: spacing.md }]}>
                Permission was denied permanently, so it can only be re-enabled from
                Android settings.
              </Text>
              <Button
                label="Open settings"
                style={{ marginTop: spacing.lg }}
                onPress={() => Linking.openSettings()}
              />
            </>
          ) : (
            <Button
              label="Allow permission"
              style={{ marginTop: spacing.lg }}
              onPress={async () => {
                const granted = await scanner.requestPermission();
                if (granted) {
                  void runScan();
                } else {
                  showToast('SMS detection stays off until permission is given', 'error');
                }
              }}
            />
          )}
        </Card>
      </Screen>
    );
  }

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
        data={data ?? []}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={reloadAll} tintColor={colors.primary} />
        }
        ListHeaderComponent={
          <View style={{ marginBottom: spacing.lg }}>
            <View style={styles.row}>
              <View style={styles.flex}>
                <Text style={[typography.title, { color: colors.text }]}>SMS Transactions</Text>
                <Text style={[typography.caption, { color: colors.textMuted, marginTop: 4 }]}>
                  Detected on this phone · nothing is added to expenses on its own
                </Text>
              </View>
              <Pressable
                onPress={runScan}
                hitSlop={10}
                accessibilityLabel="Scan for new messages"
                style={[
                  styles.scanButton,
                  { backgroundColor: colors.surfaceAlt, borderRadius: radius.pill },
                ]}
              >
                <Ionicons
                  name={scanner.scanning ? "hourglass-outline" : "refresh-outline"}
                  size={18}
                  color={colors.text}
                />
              </Pressable>
              {(banks ?? []).length > 0 ? (
                <Pressable
                  onPress={() => setClearingAll(true)}
                  hitSlop={10}
                  accessibilityLabel="Clear all detected transactions"
                  style={[styles.scanButton, { backgroundColor: colors.surfaceAlt, borderRadius: radius.pill, marginLeft: 8 }]}
                >
                  <Ionicons name="trash-outline" size={17} color={colors.textMuted} />
                </Pressable>
              ) : null}
            </View>

            {/* The scan on open has no toast, so without this a failing one looked
                exactly like an inbox with nothing new in it. */}
            {scanner.error ? (
              <Text style={[typography.caption, { color: colors.danger, marginTop: spacing.md }]}>
                Scan failed: {scanner.error}
              </Text>
            ) : null}
            {scanner.lastResult && scanner.lastResult.rejected > 0 ? (
              <Text style={[typography.caption, { color: colors.warning, marginTop: spacing.md }]}>
                {scanner.lastResult.rejected}{' '}
                {scanner.lastResult.rejected === 1 ? 'message was' : 'messages were'} skipped
                because the server would not accept them.
              </Text>
            ) : null}

            {/* Banks come from what has been detected, so this row grows by itself. */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginTop: spacing.lg }}
              contentContainerStyle={styles.chipRow}
            >
              <FilterChip label="All" active={bank === null} onPress={() => setBank(null)} />
              {(banks ?? []).map((entry) => (
                <FilterChip
                  key={entry.bank}
                  label={entry.bank}
                  badge={entry.uncategorized > 0 ? entry.uncategorized : undefined}
                  active={bank === entry.bank}
                  onPress={() => setBank(entry.bank)}
                />
              ))}
            </ScrollView>

            {/* A status with nothing behind it is a dead end, so it is not offered.
                The one in use always stays, or the row would jump as it emptied. */}
            <View style={[styles.chipRow, { marginTop: spacing.md, flexWrap: 'wrap' }]}>
              {STATUS_FILTERS.filter(
                (option) => option.key === status || (statusCounts[option.key] ?? 0) > 0,
              ).map((option) => (
                <FilterChip
                  key={option.key}
                  label={option.label}
                  badge={option.key === 'ALL' ? undefined : statusCounts[option.key]}
                  active={status === option.key}
                  onPress={() => setStatus(option.key)}
                />
              ))}
            </View>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon="chatbubbles-outline"
            title="Nothing here"
            message={
              status === 'UNCATEGORIZED'
                ? 'No transactions waiting to be categorised. Pull down or tap refresh to scan for new messages.'
                : 'No transactions match this filter.'
            }
          />
        }
      />

      <ConfirmDialog
        visible={deleting !== null}
        title="Delete this record?"
        message="It is removed from this list only - your expenses and salary are untouched. A later scan can pick the message up again."
        confirmLabel="Delete"
        destructive
        loading={busyId === deleting?.id}
        onCancel={() => setDeleting(null)}
        onConfirm={() => deleting && removeOne(deleting)}
      />

      <ConfirmDialog
        visible={clearingAll}
        title="Clear all detected transactions?"
        message="Everything not already added to your expenses is removed. Expenses you created from these stay exactly as they are."
        confirmLabel="Clear all"
        destructive
        onCancel={() => setClearingAll(false)}
        onConfirm={async () => {
          try {
            const removed = await smsApi.clearPending();
            // The rows are gone; without this the scan would never re-read those
            // messages, so "cleared" would quietly mean "gone for good".
            await scanner.resetWatermark();
            setClearingAll(false);
            setBank(null);
            showToast(`${removed} ${removed === 1 ? 'record' : 'records'} cleared`, 'success');
            reloadAll();
          } catch (caught) {
            showToast(toAppError(caught).message, 'error');
          }
        }}
      />

      <BottomSheet
        visible={picking !== null}
        onClose={() => setPicking(null)}
        title="Choose a category"
      >
        <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.md }]}>
          Categories are never chosen automatically - pick the one this belongs to.
        </Text>
        {(categories ?? []).map((category) => (
          <Pressable
            key={category.id}
            onPress={() => picking && chooseCategory(picking, category)}
            style={({ pressed }) => [
              styles.categoryRow,
              {
                borderColor: colors.border,
                borderRadius: radius.md,
                padding: spacing.md,
                marginBottom: spacing.sm,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <View
              style={[styles.dot, { backgroundColor: category.color ?? colors.primary }]}
            />
            <Text style={[typography.body, { color: colors.text, marginLeft: spacing.md }]}>
              {category.name}
            </Text>
          </Pressable>
        ))}
        <Button
          label="Manage categories"
          variant="ghost"
          onPress={() => {
            setPicking(null);
            navigation.navigate('Categories');
          }}
        />
      </BottomSheet>
    </Screen>
  );
}

function FilterChip({
  label,
  active,
  badge,
  onPress,
}: {
  label: string;
  active: boolean;
  badge?: number;
  onPress: () => void;
}) {
  const { colors, radius, typography } = useTheme();
  return (
    <Pressable
      onPress={onPress}
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
        style={[typography.caption, { color: active ? colors.textInverse : colors.textMuted }]}
      >
        {label}
        {badge !== undefined ? ` · ${badge}` : ''}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  alignRight: { alignItems: 'flex-end' },
  bubble: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  scanButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  chipRow: { flexDirection: 'row', gap: 8, paddingRight: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderWidth: StyleSheet.hairlineWidth },
  actions: { flexDirection: 'row' },
  addedRow: { flexDirection: 'row', alignItems: 'center' },
  categoryRow: { flexDirection: 'row', alignItems: 'center', borderWidth: StyleSheet.hairlineWidth },
  deleteRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start' },
  dot: { width: 12, height: 12, borderRadius: 6 },
});
