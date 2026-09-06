import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { dashboardApi } from '../../api';
import {
  BalanceCard,
  BarChart,
  Card,
  ChartLegend,
  DonutChart,
  EmptyState,
  ErrorState,
  LineChart,
  LoadingState,
  OfflineBanner,
  ProgressBar,
  Screen,
  SectionHeader,
} from '../../components';
import { useAsyncData } from '../../hooks/useAsyncData';
import { AppStackParamList } from '../../navigation/types';
import { useAuth } from '../../store/AuthContext';
import { useTheme } from '../../theme';
import { formatDate, relativeDay } from '../../utils/date';
import { formatMoney, formatPercent } from '../../utils/format';

type Nav = NativeStackNavigationProp<AppStackParamList>;

export function DashboardScreen() {
  const navigation = useNavigation<Nav>();
  const { colors, spacing, typography } = useTheme();
  const { user } = useAuth();

  const fetcher = useCallback(() => dashboardApi.get(), []);
  const { data, loading, refreshing, error, fromCache, refresh, reload } = useAsyncData(
    fetcher,
    [],
    { cacheKey: 'dashboard' },
  );

  if (loading) {
    return (
      <Screen edges={['bottom']}>
        <LoadingState label="Loading your dashboard" />
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

  if (!data) {
    return null;
  }

  const { salary, expenses, loans, categoryBreakdown, dailyTrend, recentExpenses } = data;

  // Weekly buckets read better than 31 daily bars on a phone.
  const weeklyBars = dailyTrend.reduce<{ label: string; value: number }[]>((bars, day, index) => {
    const week = Math.floor(index / 7);
    if (!bars[week]) bars[week] = { label: `W${week + 1}`, value: 0 };
    bars[week].value += day.amount;
    return bars;
  }, []);

  return (
    <Screen edges={['bottom']}
      scroll
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />
      }
    >
      <View style={[styles.header, { marginTop: spacing.sm, marginBottom: spacing.lg }]}>
        <View style={styles.flex}>
          <Text style={[typography.caption, { color: colors.textMuted }]}>
            {data.monthLabel.toUpperCase()}
          </Text>
          <Text style={[typography.title, { color: colors.text }]} numberOfLines={1}>
            Hi, {user?.name?.split(' ')[0] ?? 'there'}
          </Text>
        </View>
      </View>

      <OfflineBanner />
      {fromCache ? (
        <Text style={[typography.caption, { color: colors.warning, marginBottom: spacing.md }]}>
          Showing saved data from your last visit.
        </Text>
      ) : null}

      <BalanceCard
        label="Remaining this month"
        amount={formatMoney(salary.remainingAmount)}
        stats={[
          { label: 'Salary', value: formatMoney(salary.amount) },
          { label: 'Deductions', value: formatMoney(salary.totalDeductions) },
        ]}
        progress={
          salary.targetAmount
            ? {
                percentage: salary.progressPercentage,
                label: `Target ${formatMoney(salary.targetAmount)}`,
                trailing: formatPercent(salary.progressPercentage),
              }
            : undefined
        }
        hint="Tap to set a target salary"
        onPress={() => navigation.navigate('SalaryTarget')}
      />

      <View style={[styles.quickRow, { marginTop: spacing.lg }]}>
        <QuickTile
          icon="pricetags-outline"
          label="Categories"
          onPress={() => navigation.navigate('Categories')}
        />
        <QuickTile
          icon="pie-chart-outline"
          label="Planner"
          onPress={() => navigation.navigate('SalaryPlanner')}
        />
        <QuickTile
          icon="add-circle-outline"
          label="Add expense"
          onPress={() => navigation.navigate('AddExpense')}
        />
      </View>

      <SectionHeader title="Spending" style={{ marginTop: spacing.xl }} />
      <Card>
        <View style={styles.row}>
          <View style={styles.flex}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>SPENT</Text>
            <Text style={[typography.title, { color: colors.text }]}>
              {formatMoney(expenses.totalSpent)}
            </Text>
            <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
              {expenses.transactionCount} transactions
            </Text>
          </View>
          <View style={styles.flex}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>BUDGET LEFT</Text>
            <Text
              style={[
                typography.title,
                { color: expenses.remainingBudget < 0 ? colors.danger : colors.success },
              ]}
            >
              {formatMoney(expenses.remainingBudget)}
            </Text>
            <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
              of {formatMoney(expenses.totalBudgeted)}
            </Text>
          </View>
        </View>

        {categoryBreakdown.length > 0 ? (
          <View style={[styles.donutRow, { marginTop: spacing.lg }]}>
            <DonutChart
              data={categoryBreakdown.slice(0, 6).map((item) => ({
                label: item.name,
                value: item.amount,
                color: item.color,
              }))}
              size={150}
              thickness={22}
              centerValue={formatMoney(expenses.totalSpent)}
              centerLabel="spent"
            />
            <View style={[styles.flex, { marginLeft: spacing.md }]}>
              <ChartLegend
                items={categoryBreakdown.slice(0, 4).map((item) => ({
                  label: item.name,
                  value: item.amount,
                  percentage: item.percentage,
                  color: item.color,
                }))}
              />
            </View>
          </View>
        ) : (
          <Text style={[typography.body, { color: colors.textMuted, marginTop: spacing.md }]}>
            No spending recorded this month yet.
          </Text>
        )}
      </Card>

      {dailyTrend.some((day) => day.amount > 0) ? (
        <Card style={{ marginTop: spacing.md }}>
          <Text style={[typography.label, { color: colors.textMuted, marginBottom: spacing.md }]}>
            DAILY TREND
          </Text>
          <LineChart
            data={dailyTrend.map((day) => ({
              label: formatDate(day.date).slice(0, 6),
              value: day.amount,
            }))}
          />
          <View style={{ marginTop: spacing.lg }}>
            <Text style={[typography.label, { color: colors.textMuted, marginBottom: spacing.sm }]}>
              BY WEEK
            </Text>
            <BarChart data={weeklyBars} height={120} />
          </View>
        </Card>
      ) : null}

      <SectionHeader
        title="Loans & EMI"
        actionLabel="Manage"
        onAction={() => navigation.navigate('Tabs', { screen: 'EmiTab' })}
        style={{ marginTop: spacing.xl }}
      />
      <Card>
        <View style={styles.row}>
          <View style={styles.flex}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>OUTSTANDING</Text>
            <Text style={[typography.title, { color: colors.text }]}>
              {formatMoney(loans.totalOutstanding)}
            </Text>
          </View>
          <View style={styles.flex}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>MONTHLY EMI</Text>
            <Text style={[typography.title, { color: colors.text }]}>
              {formatMoney(loans.monthlyEmi)}
            </Text>
          </View>
        </View>

        <View style={{ marginTop: spacing.lg }}>
          <ProgressBar
            percentage={loans.progressPercentage}
            color={colors.success}
            label={`${formatMoney(loans.totalPaid)} repaid`}
            trailing={formatPercent(loans.progressPercentage)}
          />
          <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.sm }]}>
            {loans.activeLoans} active {loans.activeLoans === 1 ? 'loan' : 'loans'}, {formatMoney(loans.paidThisMonth)} paid this month
          </Text>
        </View>
      </Card>

      <SectionHeader
        title="Recent expenses"
        actionLabel="See all"
        onAction={() => navigation.navigate('Tabs', { screen: 'ExpensesTab' })}
        style={{ marginTop: spacing.xl }}
      />
      {recentExpenses.length === 0 ? (
        <Card>
          <EmptyState
            icon="receipt-outline"
            title="No expenses yet"
            message="Add your first expense to see it here."
            actionLabel="Add expense"
            onAction={() => navigation.navigate('AddExpense')}
          />
        </Card>
      ) : (
        <Card padded={false}>
          {recentExpenses.map((expense, index) => (
            <Pressable
              key={expense.id}
              onPress={() => navigation.navigate('ExpenseDetail', { expenseId: expense.id })}
              style={[
                styles.expenseRow,
                {
                  padding: spacing.lg,
                  borderTopWidth: index === 0 ? 0 : StyleSheet.hairlineWidth,
                  borderTopColor: colors.border,
                },
              ]}
            >
              <View
                style={[styles.dot, { backgroundColor: expense.categoryColor ?? colors.textMuted }]}
              />
              <View style={[styles.flex, { marginLeft: spacing.md }]}>
                <Text style={[typography.body, { color: colors.text }]} numberOfLines={1}>
                  {expense.displayName}
                </Text>
                <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
                  {relativeDay(expense.date)}
                </Text>
              </View>
              <Text style={[typography.heading, { color: colors.text }]}>
                -{formatMoney(expense.amount)}
              </Text>
            </Pressable>
          ))}
        </Card>
      )}
    </Screen>
  );
}

function QuickTile({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  const { colors, radius, spacing, typography } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: radius.md,
          paddingVertical: spacing.md,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <Ionicons name={icon} size={22} color={colors.primary} />
      <Text
        style={[typography.caption, { color: colors.text, marginTop: spacing.xs }]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  quickRow: { flexDirection: 'row', gap: 10 },
  tile: { flex: 1, alignItems: 'center', borderWidth: StyleSheet.hairlineWidth },
  donutRow: { flexDirection: 'row', alignItems: 'center' },
  expenseRow: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
