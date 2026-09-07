import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useState } from 'react';
import {
  BackHandler,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { loanApi } from '../../api';
import {
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  FloatingActionButton,
  SkeletonList,
  ProgressBar,
  Screen,
} from '../../components';
import { useAsyncData } from '../../hooks/useAsyncData';
import { AppStackParamList } from '../../navigation/types';
import { useToast } from '../../store/ToastContext';
import { useTheme } from '../../theme';
import { Loan } from '../../types/api';
import { formatMoney, formatPercent } from '../../utils/format';

type Nav = NativeStackNavigationProp<AppStackParamList>;

export function EmiScreen() {
  const navigation = useNavigation<Nav>();
  const { colors, radius, spacing, typography } = useTheme();
  const { showToast } = useToast();

  const { data, loading, refreshing, error, refresh, reload } = useAsyncData(
    () => loanApi.list(),
    [],
    { cacheKey: 'loans' },
  );

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loans = data ?? [];
  const outstanding = loans
    .filter((loan) => loan.status === 'ACTIVE')
    .reduce((sum, loan) => sum + loan.remainingAmount, 0);
  const monthlyEmi = loans
    .filter((loan) => loan.status === 'ACTIVE')
    .reduce((sum, loan) => sum + loan.monthlyEmi, 0);

  // Long-pressing a card starts selection; from then on a plain tap toggles instead of
  // opening the loan, which is what makes bulk delete feel natural.
  const selectionMode = selected.size > 0;

  const toggleSelected = useCallback((id: number) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelected(new Set()), []);

  // Android's back gesture should leave selection rather than leave the screen.
  useEffect(() => {
    if (!selectionMode) {
      return undefined;
    }
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      clearSelection();
      return true;
    });
    return () => subscription.remove();
  }, [clearSelection, selectionMode]);

  const deleteSelected = async () => {
    const ids = [...selected];
    setDeleting(true);
    // There is no bulk endpoint, so fire the deletes together and report partial failure
    // honestly rather than pretending the whole batch worked.
    const results = await Promise.allSettled(ids.map((id) => loanApi.remove(id)));
    const failed = results.filter((result) => result.status === 'rejected').length;

    setDeleting(false);
    setConfirmDelete(false);
    clearSelection();

    if (failed === 0) {
      showToast(`${ids.length} ${ids.length === 1 ? 'loan' : 'loans'} deleted`, 'success');
    } else {
      showToast(`${ids.length - failed} deleted, ${failed} could not be deleted`, 'error');
    }
    void refresh();
  };

  const renderItem = useCallback(
    ({ item }: { item: Loan }) => {
      const closed = item.status === 'CLOSED';
      const isSelecting = selected.size > 0;
      const isChecked = selected.has(item.id);

      return (
        <Card
          style={{
            marginBottom: spacing.md,
            ...(isChecked
              ? { backgroundColor: colors.primarySoft, borderColor: colors.primary }
              : null),
          }}
          onPress={() =>
            isSelecting
              ? toggleSelected(item.id)
              : navigation.navigate('LoanDetail', { loanId: item.id })
          }
          onLongPress={() => toggleSelected(item.id)}
        >
          <View style={styles.row}>
            {isSelecting ? (
              <View
                style={[
                  styles.checkbox,
                  {
                    backgroundColor: isChecked ? colors.primary : 'transparent',
                    borderColor: isChecked ? colors.primary : colors.border,
                  },
                ]}
              >
                {isChecked ? (
                  <Ionicons name="checkmark" size={18} color={colors.textInverse} />
                ) : null}
              </View>
            ) : (
              <View
                style={[
                  styles.bubble,
                  { backgroundColor: closed ? colors.success + '22' : colors.primary + '22' },
                ]}
              >
                <Ionicons
                  name={closed ? 'checkmark-done' : 'card-outline'}
                  size={20}
                  color={closed ? colors.success : colors.primary}
                />
              </View>
            )}

            <View style={[styles.flex, { marginLeft: spacing.md }]}>
              <Text style={[typography.heading, { color: colors.text }]} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
                {closed
                  ? 'Fully repaid'
                  : `${formatMoney(item.monthlyEmi)} per month, ${item.estimatedInstalmentsLeft ?? 0} left`}
              </Text>
            </View>

            {/* While selecting, the whole card acts as a checkbox, so the per-row
                controls step aside and the toolbar trash is the only destructive one. */}
            {isSelecting ? null : (
              <>
                <View
                  style={[
                    styles.badge,
                    {
                      backgroundColor: closed ? colors.success + '22' : colors.primarySoft,
                      borderRadius: radius.pill,
                    },
                  ]}
                >
                  <Text
                    style={[
                      typography.caption,
                      { color: closed ? colors.success : colors.primary, fontSize: 10 },
                    ]}
                  >
                    {item.status}
                  </Text>
                </View>

                {/* Always on the card, so editing never needs a detour through the
                    loan detail screen. */}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Edit ${item.name}`}
                  onPress={() => navigation.navigate('LoanForm', { loanId: item.id })}
                  hitSlop={10}
                  style={({ pressed }) => [
                    styles.editButton,
                    {
                      backgroundColor: colors.surfaceAlt,
                      borderRadius: radius.sm,
                      marginLeft: spacing.sm,
                      opacity: pressed ? 0.6 : 1,
                    },
                  ]}
                >
                  <Ionicons name="create-outline" size={16} color={colors.textMuted} />
                </Pressable>
              </>
            )}
          </View>

          <View style={{ marginTop: spacing.lg }}>
            <ProgressBar
              percentage={item.progressPercentage}
              color={closed ? colors.success : colors.primary}
              label={`${formatMoney(item.paidAmount)} of ${formatMoney(item.originalAmount)} repaid`}
              trailing={formatPercent(item.progressPercentage)}
            />
            <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.sm }]}>
              {formatMoney(item.remainingAmount)} remaining, {item.paymentCount}{' '}
              {item.paymentCount === 1 ? 'payment' : 'payments'} recorded
            </Text>
          </View>
        </Card>
      );
    },
    [colors, navigation, radius, selected, spacing, toggleSelected, typography],
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
      {selectionMode ? (
        <View
          style={[
            styles.selectionBar,
            { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md },
          ]}
        >
          <Pressable onPress={clearSelection} hitSlop={10} accessibilityLabel="Cancel selection">
            <Ionicons name="close" size={24} color={colors.text} />
          </Pressable>

          <Text style={[typography.title, { color: colors.text, flex: 1, marginLeft: spacing.md }]}>
            {selected.size} selected
          </Text>

          <Pressable
            onPress={() => setSelected(new Set(loans.map((loan) => loan.id)))}
            hitSlop={10}
            style={{ marginRight: spacing.lg }}
          >
            <Text style={[typography.label, { color: colors.primary }]}>All</Text>
          </Pressable>

          <Pressable
            onPress={() => setConfirmDelete(true)}
            hitSlop={10}
            accessibilityLabel="Delete selected loans"
          >
            <Ionicons name="trash-outline" size={22} color={colors.danger} />
          </Pressable>
        </View>
      ) : null}

      <FlatList
        data={loans}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        // Rows read the selection set, so the list has to know it changed.
        extraData={selected}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />
        }
        ListHeaderComponent={
          <View>
            {selectionMode ? null : (
              <Text style={[typography.title, { color: colors.text, marginBottom: spacing.md }]}>
                EMI & Loans
              </Text>
            )}
            {loans.length > 0 ? (
              <Card style={{ marginBottom: spacing.lg }}>
                <View style={styles.row}>
                  <View style={styles.flex}>
                    <Text style={[typography.caption, { color: colors.textMuted }]}>
                      TOTAL OUTSTANDING
                    </Text>
                    <Text style={[typography.title, { color: colors.text }]}>
                      {formatMoney(outstanding)}
                    </Text>
                  </View>
                  <View style={styles.flex}>
                    <Text style={[typography.caption, { color: colors.textMuted }]}>
                      MONTHLY EMI
                    </Text>
                    <Text style={[typography.title, { color: colors.text }]}>
                      {formatMoney(monthlyEmi)}
                    </Text>
                  </View>
                </View>
              </Card>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon="card-outline"
            title="No loans tracked"
            // Adding is the + button, so the empty state does not repeat the action.
            message="Tap the + button to add a loan and follow its EMI schedule and remaining balance."
          />
        }
      />

      {/* Hidden while selecting so the trash in the toolbar is the only destructive
          control on screen. */}
      {selectionMode ? null : (
        <FloatingActionButton
          accessibilityLabel="Add loan"
          onPress={() => navigation.navigate('LoanForm')}
        />
      )}

      <ConfirmDialog
        visible={confirmDelete}
        title={`Delete ${selected.size} ${selected.size === 1 ? 'loan' : 'loans'}?`}
        message="Each loan and all of its payment history will be removed. This cannot be undone."
        confirmLabel="Delete"
        destructive
        loading={deleting}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={deleteSelected}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  bubble: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  checkbox: {
    width: 40,
    height: 40,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  badge: { paddingHorizontal: 8, paddingVertical: 3 },
  selectionBar: { flexDirection: 'row', alignItems: 'center' },
});
