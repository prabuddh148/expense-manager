import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { loanApi } from '../../api';
import {
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  LoadingState,
  ProgressBar,
  Screen,
  SectionHeader,
} from '../../components';
import { useAsyncData } from '../../hooks/useAsyncData';
import { useSubmit } from '../../hooks/useSubmit';
import { AppStackParamList } from '../../navigation/types';
import { useToast } from '../../store/ToastContext';
import { useTheme } from '../../theme';
import { EmiPayment } from '../../types/api';
import { formatLongDate } from '../../utils/date';
import { formatMoney, formatPercent } from '../../utils/format';

type Props = NativeStackScreenProps<AppStackParamList, 'LoanDetail'>;

export function LoanDetailScreen({ navigation, route }: Props) {
  const { loanId } = route.params;
  const { colors, radius, spacing, typography } = useTheme();
  const { showToast } = useToast();

  const loan = useAsyncData(() => loanApi.get(loanId), [loanId]);
  const payments = useAsyncData(() => loanApi.payments(loanId), [loanId]);

  const [deletingLoan, setDeletingLoan] = useState(false);
  const [deletingPayment, setDeletingPayment] = useState<EmiPayment | null>(null);

  const removeLoan = useSubmit(() => loanApi.remove(loanId));
  const removePayment = useSubmit((paymentId: number) => loanApi.removePayment(loanId, paymentId));

  const reloadAll = useCallback(() => {
    void loan.refresh();
    void payments.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFocusEffect(reloadAll);

  if (loan.loading) {
    return (
      <Screen>
        <LoadingState label="Loading loan" />
      </Screen>
    );
  }

  if (loan.error || !loan.data) {
    return (
      <Screen>
        <ErrorState
          message={loan.error?.message ?? 'That loan could not be found.'}
          offline={loan.error?.kind === 'network'}
          onRetry={loan.reload}
        />
      </Screen>
    );
  }

  const data = loan.data;
  const closed = data.status === 'CLOSED';
  const history = payments.data ?? [];

  return (
    <Screen
      scroll
      refreshControl={
        <RefreshControl
          refreshing={loan.refreshing || payments.refreshing}
          onRefresh={reloadAll}
          tintColor={colors.primary}
        />
      }
    >
      <Card style={{ marginTop: spacing.md }}>
        <View style={styles.row}>
          <View style={styles.flex}>
            <Text style={[typography.title, { color: colors.text }]}>{data.name}</Text>
            <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
              Started {formatLongDate(data.startDate)}
              {data.interestRate ? `, ${data.interestRate}% p.a.` : ''}
            </Text>
          </View>
          <Pressable
            onPress={() => navigation.navigate('LoanForm', { loanId })}
            hitSlop={10}
            style={[
              styles.iconButton,
              { backgroundColor: colors.surfaceAlt, borderRadius: radius.pill },
            ]}
          >
            <Ionicons name="create-outline" size={18} color={colors.text} />
          </Pressable>
        </View>

        <Text style={[typography.display, { color: colors.text, marginTop: spacing.lg }]}>
          {formatMoney(data.remainingAmount)}
        </Text>
        <Text style={[typography.caption, { color: colors.textMuted }]}>REMAINING BALANCE</Text>

        <View style={{ marginTop: spacing.lg }}>
          <ProgressBar
            percentage={data.progressPercentage}
            color={closed ? colors.success : colors.primary}
            height={10}
            label={`${formatMoney(data.paidAmount)} of ${formatMoney(data.originalAmount)}`}
            trailing={formatPercent(data.progressPercentage)}
          />
        </View>

        <View style={[styles.statRow, { marginTop: spacing.lg }]}>
          <Stat label="MONTHLY EMI" value={formatMoney(data.monthlyEmi)} />
          <Stat
            label="INSTALMENTS LEFT"
            value={closed ? 'Done' : String(data.estimatedInstalmentsLeft ?? 0)}
          />
          <Stat label="PAYMENTS" value={String(data.paymentCount)} />
        </View>
      </Card>

      {!closed ? (
        <Button
          label="Record a payment"
          icon="add-circle-outline"
          onPress={() => navigation.navigate('EmiPayment', { loanId })}
          style={{ marginTop: spacing.lg }}
        />
      ) : (
        <Card style={{ marginTop: spacing.lg, backgroundColor: colors.success + '18' }}>
          <View style={styles.row}>
            <Ionicons name="checkmark-done-circle" size={22} color={colors.success} />
            <Text style={[typography.body, { color: colors.text, marginLeft: spacing.sm, flex: 1 }]}>
              This loan is fully repaid.
            </Text>
          </View>
        </Card>
      )}

      <SectionHeader title="Payment history" style={{ marginTop: spacing.xl }} />

      {history.length === 0 ? (
        <Card>
          <EmptyState
            icon="time-outline"
            title="No payments yet"
            message="Every instalment is kept as its own row, so the history is never overwritten."
          />
        </Card>
      ) : (
        <Card padded={false}>
          {history.map((payment, index) => (
            <View
              key={payment.id}
              style={[
                styles.paymentRow,
                {
                  padding: spacing.lg,
                  borderTopWidth: index === 0 ? 0 : StyleSheet.hairlineWidth,
                  borderTopColor: colors.border,
                },
              ]}
            >
              <View style={styles.flex}>
                <Text style={[typography.body, { color: colors.text }]}>
                  {formatLongDate(payment.paymentDate)}
                </Text>
                {payment.description ? (
                  <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
                    {payment.description}
                  </Text>
                ) : null}
              </View>

              <Text style={[typography.heading, { color: colors.success, marginRight: spacing.md }]}>
                {formatMoney(payment.amount)}
              </Text>

              <Pressable
                onPress={() => navigation.navigate('EmiPayment', { loanId, paymentId: payment.id })}
                hitSlop={8}
                style={{ marginRight: spacing.md }}
              >
                <Ionicons name="create-outline" size={18} color={colors.textMuted} />
              </Pressable>
              <Pressable onPress={() => setDeletingPayment(payment)} hitSlop={8}>
                <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
              </Pressable>
            </View>
          ))}
        </Card>
      )}

      <Button
        label="Delete loan"
        icon="trash-outline"
        variant="danger"
        onPress={() => setDeletingLoan(true)}
        style={{ marginTop: spacing.xl }}
      />

      <ConfirmDialog
        visible={deletingLoan}
        title={`Delete ${data.name}?`}
        message="The loan and all of its payment history will be removed. This cannot be undone."
        confirmLabel="Delete loan"
        destructive
        loading={removeLoan.submitting}
        onCancel={() => setDeletingLoan(false)}
        onConfirm={async () => {
          const done = await removeLoan.submit();
          setDeletingLoan(false);
          if (done !== null) {
            showToast('Loan deleted', 'success');
            navigation.goBack();
          } else {
            showToast(removeLoan.error?.message ?? 'Could not delete', 'error');
          }
        }}
      />

      <ConfirmDialog
        visible={deletingPayment !== null}
        title="Delete this payment?"
        message="The amount goes back onto the loan balance and the loan reopens if it was closed."
        confirmLabel="Delete"
        destructive
        loading={removePayment.submitting}
        onCancel={() => setDeletingPayment(null)}
        onConfirm={async () => {
          if (!deletingPayment) return;
          const done = await removePayment.submit(deletingPayment.id);
          setDeletingPayment(null);
          if (done !== null) {
            showToast('Payment deleted', 'success');
            reloadAll();
          } else {
            showToast(removePayment.error?.message ?? 'Could not delete', 'error');
          }
        }}
      />
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const { colors, typography } = useTheme();
  return (
    <View style={styles.flex}>
      <Text style={[typography.caption, { color: colors.textMuted, fontSize: 10 }]}>{label}</Text>
      <Text style={[typography.label, { color: colors.text, marginTop: 2 }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  statRow: { flexDirection: 'row' },
  iconButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  paymentRow: { flexDirection: 'row', alignItems: 'center' },
});
