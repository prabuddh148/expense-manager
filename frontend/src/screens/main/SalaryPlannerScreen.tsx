import { useNavigation } from '@react-navigation/native';
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
  ProgressBar,
  Screen,
  SkeletonPlanner,
} from '../../components';
import { useAsyncData } from '../../hooks/useAsyncData';
import { useSubmit } from '../../hooks/useSubmit';
import { AppStackParamList } from '../../navigation/types';
import { useToast } from '../../store/ToastContext';
import { colorForIndex, useTheme } from '../../theme';
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

        {/* A stacked bar of the sections themselves, so the split is readable before
            opening the plan. */}
        {item.items.length > 0 ? (
          <View style={[styles.stack, { marginTop: spacing.lg }]}>
            {item.items.map((section, index) => (
              <View
                key={section.id}
                style={{
                  flex: Math.max(section.amount, 1),
                  backgroundColor: colorForIndex(index),
                }}
              />
            ))}
            {item.remainingAmount > 0 ? (
              <View style={{ flex: item.remainingAmount, backgroundColor: colors.surfaceAlt }} />
            ) : null}
          </View>
        ) : (
          <View style={{ marginTop: spacing.lg }}>
            <ProgressBar
              percentage={item.allocatedPercentage}
              overflow={item.overAllocated}
              trailing={formatPercent(item.allocatedPercentage)}
            />
          </View>
        )}

        <View style={[styles.figures, { marginTop: spacing.md }]}>
          <PlanFigure label="SALARY" value={formatMoney(item.totalSalary)} />
          <PlanFigure label="ALLOCATED" value={formatMoney(item.totalAllocated)} />
          <PlanFigure
            label={item.overAllocated ? 'OVER BY' : 'UNALLOCATED'}
            value={formatMoney(Math.abs(item.remainingAmount))}
            color={item.overAllocated ? colors.danger : colors.success}
            align="right"
          />
        </View>
      </Card>
    ),
    [colors, navigation, spacing, typography],
  );

  if (loading) {
    return (
      <Screen>
        <SkeletonPlanner />
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
        ListHeaderComponent={
          (data ?? []).length > 0 ? (
            <View style={{ marginBottom: spacing.lg }}>
              <Text style={[typography.title, { color: colors.text }]}>Salary planner</Text>
              <Text style={[typography.caption, { color: colors.textMuted, marginTop: 4 }]}>
                {(data ?? []).length} {(data ?? []).length === 1 ? 'plan' : 'plans'} · tap one to
                preview, share or export
              </Text>
            </View>
          ) : null
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

/** One labelled figure in the salary / allocated / unallocated row. */
function PlanFigure({
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
  stack: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center' },
});
