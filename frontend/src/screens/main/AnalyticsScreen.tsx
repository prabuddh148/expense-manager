import React, { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { analyticsApi } from '../../api';
import {
  BarChart,
  BottomSheet,
  Button,
  Card,
  ChartLegend,
  DateTimeField,
  DonutChart,
  EmptyState,
  ErrorState,
  LineChart,
  SkeletonDashboard,
  Screen,
  SectionHeader,
} from '../../components';
import { useAsyncData } from '../../hooks/useAsyncData';
import { useTheme } from '../../theme';
import { AnalyticsPeriod } from '../../types/api';
import { formatDate, toIsoDate } from '../../utils/date';
import { formatMoney } from '../../utils/format';

type PeriodOption = { key: AnalyticsPeriod; label: string };

const PERIODS: PeriodOption[] = [
  { key: 'this_week', label: 'This Week' },
  { key: 'last_week', label: 'Last Week' },
  { key: 'this_month', label: 'This Month' },
  { key: 'last_month', label: 'Last Month' },
  { key: 'custom', label: 'Custom' },
];

export function AnalyticsScreen() {
  const { colors, radius, spacing, typography } = useTheme();

  const [period, setPeriod] = useState<AnalyticsPeriod>('this_month');
  const [customOpen, setCustomOpen] = useState(false);
  const [range, setRange] = useState({
    from: toIsoDate(new Date(Date.now() - 6 * 86400000)),
    to: toIsoDate(new Date()),
  });
  const [appliedRange, setAppliedRange] = useState(range);

  const fetcher = useCallback(
    () =>
      period === 'custom'
        ? analyticsApi.forPeriod('custom', appliedRange.from, appliedRange.to)
        : analyticsApi.forPeriod(period),
    [appliedRange.from, appliedRange.to, period],
  );

  const { data, loading, refreshing, error, refresh, reload } = useAsyncData(
    fetcher,
    [period, appliedRange.from, appliedRange.to],
    { cacheKey: `analytics-${period}` },
  );

  const selectPeriod = (option: PeriodOption) => {
    if (option.key === 'custom') {
      setCustomOpen(true);
      return;
    }
    setPeriod(option.key);
  };

  const chips = (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8, paddingRight: spacing.lg }}
      style={{ marginBottom: spacing.lg }}
    >
      {PERIODS.map((option) => {
        const active = period === option.key;
        return (
          <Pressable
            key={option.key}
            onPress={() => selectPeriod(option)}
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
            <Text
              style={[typography.caption, { color: active ? colors.textInverse : colors.text }]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );

  if (loading) {
    return (
      <Screen edges={['bottom']}>
        <SkeletonDashboard />
      </Screen>
    );
  }

  if (error && !data) {
    return (
      <Screen edges={['bottom']} scroll>
        <Text style={[typography.title, { color: colors.text, marginVertical: spacing.md }]}>
          Analytics
        </Text>
        {chips}
        <ErrorState message={error.message} offline={error.kind === 'network'} onRetry={reload} />
      </Screen>
    );
  }

  const analytics = data!;
  const hasSpending = analytics.totalExpenses > 0 || analytics.totalEmiPaid > 0;

  // Daily bars for short windows, weekly buckets for anything longer than a fortnight.
  const bars =
    analytics.daily.length <= 14
      ? analytics.daily.map((day) => ({
          label: formatDate(day.date).slice(0, 2),
          value: day.amount,
        }))
      : analytics.daily.reduce<{ label: string; value: number }[]>((acc, day, index) => {
          const week = Math.floor(index / 7);
          if (!acc[week]) acc[week] = { label: `W${week + 1}`, value: 0 };
          acc[week].value += day.amount;
          return acc;
        }, []);

  return (
    <Screen edges={['bottom']}
      scroll
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />
      }
    >
      <Text style={[typography.title, { color: colors.text, marginTop: spacing.sm, marginBottom: spacing.md }]}>
        Analytics
      </Text>

      {chips}

      <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.md }]}>
        {analytics.rangeLabel.toUpperCase()} · {formatDate(analytics.from)} to {formatDate(analytics.to)}
      </Text>

      <Card>
        <View style={styles.grid}>
          <Metric label="TOTAL SPENT" value={formatMoney(analytics.totalExpenses)} />
          <Metric label="EMI PAID" value={formatMoney(analytics.totalEmiPaid)} />
        </View>
        <View style={[styles.grid, { marginTop: spacing.lg }]}>
          <Metric label="DEDUCTIONS" value={formatMoney(analytics.totalDeductions)} />
          <Metric
            label="REMAINING"
            value={formatMoney(analytics.remainingAmount)}
            tone={analytics.remainingAmount < 0 ? colors.danger : colors.success}
          />
        </View>
        <View style={[styles.grid, { marginTop: spacing.lg }]}>
          <Metric label="TRANSACTIONS" value={String(analytics.transactionCount)} />
          <Metric label="AVG PER DAY" value={formatMoney(analytics.averagePerDay)} />
        </View>
        {analytics.highestDay ? (
          <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.lg }]}>
            Highest day: {formatDate(analytics.highestDay)} ({formatMoney(analytics.highestDayAmount)})
          </Text>
        ) : null}
      </Card>

      {hasSpending ? (
        <>
          <SectionHeader title="Spending over time" style={{ marginTop: spacing.xl }} />
          <Card>
            <LineChart
              data={analytics.daily.map((day) => ({
                label: formatDate(day.date).slice(0, 6),
                value: day.amount,
              }))}
            />
            <View style={{ marginTop: spacing.lg }}>
              <BarChart data={bars} height={130} />
            </View>
          </Card>

          <SectionHeader title="Where it went" style={{ marginTop: spacing.xl }} />
          <Card>
            {analytics.categories.length > 0 ? (
              <>
                <View style={styles.donutWrap}>
                  <DonutChart
                    data={analytics.categories.map((item) => ({
                      label: item.name,
                      value: item.amount,
                      color: item.color,
                    }))}
                    size={170}
                    centerValue={formatMoney(analytics.totalExpenses)}
                    centerLabel={analytics.rangeLabel.toLowerCase()}
                  />
                </View>
                <View style={{ marginTop: spacing.lg }}>
                  <ChartLegend
                    items={analytics.categories.map((item) => ({
                      label: item.name,
                      value: item.amount,
                      percentage: item.percentage,
                      color: item.color,
                    }))}
                  />
                </View>
              </>
            ) : (
              <Text style={[typography.body, { color: colors.textMuted }]}>
                No categorised spending in this range.
              </Text>
            )}
          </Card>
        </>
      ) : (
        <Card style={{ marginTop: spacing.lg }}>
          <EmptyState
            icon="stats-chart-outline"
            title="Nothing to analyse yet"
            message="Add expenses or record an EMI payment in this period and the charts will fill in."
          />
        </Card>
      )}

      <BottomSheet
        visible={customOpen}
        onClose={() => setCustomOpen(false)}
        title="Custom date range"
      >
        <DateTimeField
          label="From"
          mode="date"
          value={range.from}
          onChange={(value) => setRange((current) => ({ ...current, from: value }))}
        />
        <DateTimeField
          label="To"
          mode="date"
          value={range.to}
          onChange={(value) => setRange((current) => ({ ...current, to: value }))}
        />
        <Button
          label="Apply range"
          onPress={() => {
            setAppliedRange(range);
            setPeriod('custom');
            setCustomOpen(false);
          }}
        />
        <Button
          label="Cancel"
          variant="ghost"
          onPress={() => setCustomOpen(false)}
          style={{ marginTop: spacing.sm }}
        />
      </BottomSheet>
    </Screen>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: string }) {
  const { colors, typography } = useTheme();
  return (
    <View style={styles.metric}>
      <Text style={[typography.caption, { color: colors.textMuted, fontSize: 10 }]}>{label}</Text>
      <Text style={[typography.heading, { color: tone ?? colors.text, marginTop: 2 }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { borderWidth: StyleSheet.hairlineWidth },
  grid: { flexDirection: 'row' },
  metric: { flex: 1 },
  donutWrap: { alignItems: 'center' },
});
