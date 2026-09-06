import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { plannerApi } from '../../api';
import {
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  FloatingActionButton,
  LoadingState,
  ProgressBar,
  Screen,
} from '../../components';
import { useAsyncData } from '../../hooks/useAsyncData';
import { useSubmit } from '../../hooks/useSubmit';
import { AppStackParamList } from '../../navigation/types';
import { useToast } from '../../store/ToastContext';
import { useTheme } from '../../theme';
import { SalaryPlanner } from '../../types/api';
import { formatMoney, formatPercent } from '../../utils/format';

type Nav = NativeStackNavigationProp<AppStackParamList>;

export function SalaryPlannerScreen() {
  const navigation = useNavigation<Nav>();
  const { colors, spacing, typography } = useTheme();
  const { showToast } = useToast();

  const { data, loading, refreshing, error, refresh, reload } = useAsyncData(
    () => plannerApi.list(),
    [],
    { cacheKey: 'planners' },
  );

  const [deleting, setDeleting] = useState<SalaryPlanner | null>(null);
  const remove = useSubmit((id: number) => plannerApi.remove(id));

  useFocusEffect(
    useCallback(() => {
      void refresh();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const renderItem = useCallback(
    ({ item }: { item: SalaryPlanner }) => (
      <Card
        style={{ marginBottom: spacing.md }}
        onPress={() => navigation.navigate('SalaryPlannerPreview', { plannerId: item.id })}
      >
        <View style={styles.row}>
          <View style={styles.flex}>
            <Text style={[typography.heading, { color: colors.text }]} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
              {item.items.length} {item.items.length === 1 ? 'section' : 'sections'} ·{' '}
              {formatMoney(item.totalSalary)}
            </Text>
          </View>

          <Pressable
            onPress={() => navigation.navigate('SalaryPlannerEditor', { plannerId: item.id })}
            hitSlop={10}
            style={{ marginRight: spacing.md }}
          >
            <Ionicons name="create-outline" size={18} color={colors.textMuted} />
          </Pressable>
          <Pressable onPress={() => setDeleting(item)} hitSlop={10}>
            <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
          </Pressable>
        </View>

        <View style={{ marginTop: spacing.lg }}>
          <ProgressBar
            percentage={item.allocatedPercentage}
            overflow={item.overAllocated}
            label={`${formatMoney(item.totalAllocated)} allocated`}
            trailing={formatPercent(item.allocatedPercentage)}
          />
          <Text
            style={[
              typography.caption,
              {
                color: item.overAllocated ? colors.danger : colors.success,
                marginTop: spacing.sm,
              },
            ]}
          >
            {item.overAllocated
              ? `Over-allocated by ${formatMoney(Math.abs(item.remainingAmount))}`
              : `${formatMoney(item.remainingAmount)} unallocated`}
          </Text>
        </View>
      </Card>
    ),
    [colors, navigation, spacing, typography],
  );

  if (loading) {
    return (
      <Screen>
        <LoadingState label="Loading plans" />
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
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          <EmptyState
            icon="pie-chart-outline"
            title="No plans yet"
            message="Split a salary into sections like EMI, Food and Savings, then export it as an image or PDF."
            actionLabel="Create a plan"
            onAction={() => navigation.navigate('SalaryPlannerEditor')}
          />
        }
      />

      <FloatingActionButton onPress={() => navigation.navigate('SalaryPlannerEditor')} />

      <ConfirmDialog
        visible={deleting !== null}
        title={`Delete ${deleting?.name ?? 'plan'}?`}
        message="The plan and all of its sections will be removed. Your real expenses are not affected."
        confirmLabel="Delete"
        destructive
        loading={remove.submitting}
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          const done = await remove.submit(deleting.id);
          setDeleting(null);
          if (done !== null) {
            showToast('Plan deleted', 'success');
            void reload();
          } else {
            showToast(remove.error?.message ?? 'Could not delete', 'error');
          }
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
});
