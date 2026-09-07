import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { loanApi } from '../../api';
import { Button, Card, DateTimeField, Screen, SkeletonPlanner, TextField } from '../../components';
import { useAsyncData } from '../../hooks/useAsyncData';
import { useSubmit } from '../../hooks/useSubmit';
import { AppStackParamList } from '../../navigation/types';
import { useToast } from '../../store/ToastContext';
import { useTheme } from '../../theme';
import { toIsoDate } from '../../utils/date';
import { formatMoney } from '../../utils/format';

type Props = NativeStackScreenProps<AppStackParamList, 'EmiPayment'>;

export function EmiPaymentScreen({ navigation, route }: Props) {
  const { loanId, paymentId } = route.params;
  const isEditing = typeof paymentId === 'number';
  const { colors, spacing, typography } = useTheme();
  const { showToast } = useToast();

  const loan = useAsyncData(() => loanApi.get(loanId), [loanId]);
  const payments = useAsyncData(() => loanApi.payments(loanId), [loanId], { enabled: isEditing });

  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(toIsoDate(new Date()));
  const [description, setDescription] = useState('');
  const [touched, setTouched] = useState(false);
  const [prefilled, setPrefilled] = useState(false);

  useEffect(() => {
    navigation.setOptions({ title: isEditing ? 'Edit Payment' : 'Record Payment' });
  }, [isEditing, navigation]);

  // New payments default to the loan's own EMI, which is what the user pays most months.
  useEffect(() => {
    if (prefilled) return;
    if (isEditing) {
      const existing = payments.data?.find((payment) => payment.id === paymentId);
      if (existing) {
        setAmount(String(existing.amount));
        setPaymentDate(existing.paymentDate);
        setDescription(existing.description ?? '');
        setPrefilled(true);
      }
    } else if (loan.data) {
      setAmount(String(loan.data.monthlyEmi));
      setPrefilled(true);
    }
  }, [isEditing, loan.data, paymentId, payments.data, prefilled]);

  const numericAmount = Number(amount.replace(/,/g, ''));
  const amountValid = Number.isFinite(numericAmount) && numericAmount > 0;

  const save = useSubmit(async () => {
    const payload = {
      amount: numericAmount,
      paymentDate,
      description: description.trim() || null,
    };
    return isEditing
      ? loanApi.updatePayment(loanId, paymentId as number, payload)
      : loanApi.addPayment(loanId, payload);
  });

  const onSubmit = async () => {
    setTouched(true);
    if (!amountValid) return;
    const result = await save.submit();
    if (result) {
      showToast(isEditing ? 'Payment updated' : 'Payment recorded', 'success');
      navigation.goBack();
    }
  };

  if (loan.loading || (isEditing && payments.loading)) {
    return (
      <Screen>
        <SkeletonPlanner rows={2} />
      </Screen>
    );
  }

  const remaining = loan.data?.remainingAmount ?? 0;

  return (
    <Screen scroll>
      <Card style={{ marginTop: spacing.md, marginBottom: spacing.xl }}>
        <View style={styles.row}>
          <Ionicons name="card-outline" size={20} color={colors.primary} />
          <Text style={[typography.heading, { color: colors.text, marginLeft: spacing.sm, flex: 1 }]}>
            {loan.data?.name}
          </Text>
        </View>
        <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.md }]}>
          OUTSTANDING
        </Text>
        <Text style={[typography.title, { color: colors.text }]}>{formatMoney(remaining)}</Text>
      </Card>

      <TextField
        label="Payment amount"
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
        placeholder="15000"
        icon="cash-outline"
        required
        hint={`Cannot be more than the ${formatMoney(remaining)} still outstanding.`}
        error={touched && !amountValid ? 'Enter an amount greater than zero' : save.fieldErrors.amount}
      />

      <DateTimeField
        label="Payment date"
        mode="date"
        value={paymentDate}
        onChange={setPaymentDate}
      />

      <TextField
        label="Note"
        value={description}
        onChangeText={setDescription}
        placeholder="September instalment"
        icon="document-text-outline"
      />

      {save.error && save.error.kind !== 'validation' ? (
        <Text style={[typography.caption, { color: colors.danger, marginBottom: spacing.md }]}>
          {save.error.message}
        </Text>
      ) : null}

      <Button
        label={isEditing ? 'Save payment' : 'Record payment'}
        onPress={onSubmit}
        loading={save.submitting}
      />
      <Button
        label="Cancel"
        variant="ghost"
        onPress={() => navigation.goBack()}
        style={{ marginTop: spacing.sm }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
});
