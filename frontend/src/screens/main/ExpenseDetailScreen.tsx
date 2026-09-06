import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { expenseApi } from '../../api';
import {
  Button,
  Card,
  ConfirmDialog,
  ErrorState,
  LoadingState,
  Screen,
} from '../../components';
import { useAsyncData } from '../../hooks/useAsyncData';
import { useSubmit } from '../../hooks/useSubmit';
import { AppStackParamList } from '../../navigation/types';
import { useToast } from '../../store/ToastContext';
import { useTheme } from '../../theme';
import { formatLongDate, formatTime } from '../../utils/date';
import { formatMoney } from '../../utils/format';

type Props = NativeStackScreenProps<AppStackParamList, 'ExpenseDetail'>;

export function ExpenseDetailScreen({ navigation, route }: Props) {
  const { expenseId } = route.params;
  const { colors, radius, spacing, typography } = useTheme();
  const { showToast } = useToast();
  const [confirming, setConfirming] = useState(false);

  const { data, loading, error, reload } = useAsyncData(
    () => expenseApi.get(expenseId),
    [expenseId],
  );

  const remove = useSubmit(() => expenseApi.remove(expenseId));

  if (loading) {
    return (
      <Screen>
        <LoadingState label="Loading expense" />
      </Screen>
    );
  }

  if (error || !data) {
    return (
      <Screen>
        <ErrorState
          message={error?.message ?? 'That expense could not be found.'}
          offline={error?.kind === 'network'}
          onRetry={reload}
        />
      </Screen>
    );
  }

  const rows = [
    { icon: 'pricetag-outline' as const, label: 'Category', value: data.categoryName ?? 'Other' },
    ...(data.expenseName && data.categoryName
      ? [{ icon: 'bookmark-outline' as const, label: 'Name', value: data.expenseName }]
      : []),
    { icon: 'calendar-outline' as const, label: 'Date', value: formatLongDate(data.date) },
    ...(data.time
      ? [{ icon: 'time-outline' as const, label: 'Time', value: formatTime(data.time) }]
      : []),
    ...(data.description
      ? [{ icon: 'document-text-outline' as const, label: 'Note', value: data.description }]
      : []),
  ];

  return (
    <Screen scroll>
      <Card style={{ marginTop: spacing.md, alignItems: 'center' }}>
        <View
          style={[
            styles.bubble,
            { backgroundColor: (data.categoryColor ?? colors.primary) + '22', borderRadius: radius.lg },
          ]}
        >
          <Ionicons
            name={(data.categoryIcon as keyof typeof Ionicons.glyphMap) ?? 'pricetag-outline'}
            size={26}
            color={data.categoryColor ?? colors.primary}
          />
        </View>
        <Text style={[typography.display, { color: colors.text, marginTop: spacing.md }]}>
          -{formatMoney(data.amount)}
        </Text>
        <Text style={[typography.body, { color: colors.textMuted, marginTop: spacing.xs }]}>
          {data.displayName}
        </Text>
      </Card>

      <Card style={{ marginTop: spacing.md }} padded={false}>
        {rows.map((row, index) => (
          <View
            key={row.label}
            style={[
              styles.row,
              {
                padding: spacing.lg,
                borderTopWidth: index === 0 ? 0 : StyleSheet.hairlineWidth,
                borderTopColor: colors.border,
              },
            ]}
          >
            <Ionicons name={row.icon} size={18} color={colors.textMuted} />
            <Text style={[typography.body, { color: colors.textMuted, marginLeft: spacing.md, flex: 1 }]}>
              {row.label}
            </Text>
            <Text style={[typography.label, { color: colors.text, flexShrink: 1 }]} numberOfLines={2}>
              {row.value}
            </Text>
          </View>
        ))}
      </Card>

      <Button
        label="Edit expense"
        icon="create-outline"
        onPress={() => navigation.navigate('AddExpense', { expenseId })}
        style={{ marginTop: spacing.xl }}
      />
      <Button
        label="Delete expense"
        icon="trash-outline"
        variant="danger"
        onPress={() => setConfirming(true)}
        style={{ marginTop: spacing.sm }}
      />

      <ConfirmDialog
        visible={confirming}
        title="Delete this expense?"
        message="It will be removed from your history and added back to your salary and category balances."
        confirmLabel="Delete"
        destructive
        loading={remove.submitting}
        onCancel={() => setConfirming(false)}
        onConfirm={async () => {
          const done = await remove.submit();
          setConfirming(false);
          if (done !== null) {
            showToast('Expense deleted', 'success');
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
  bubble: { width: 60, height: 60, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
});
