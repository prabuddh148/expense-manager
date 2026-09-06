import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { plannerApi } from '../../api';
import {
  Button,
  Card,
  DonutChart,
  LoadingState,
  ProgressBar,
  Screen,
  SectionHeader,
  TextField,
} from '../../components';
import { useAsyncData } from '../../hooks/useAsyncData';
import { useSubmit } from '../../hooks/useSubmit';
import { AppStackParamList } from '../../navigation/types';
import { useToast } from '../../store/ToastContext';
import { chartPalette, useTheme } from '../../theme';
import { formatMoney, formatPercent } from '../../utils/format';

type Props = NativeStackScreenProps<AppStackParamList, 'SalaryPlannerEditor'>;

type DraftItem = { key: string; name: string; amount: string; color: string };

const STARTER_SECTIONS = ['EMI', 'Commute', 'Food', 'Personal', 'Recharge', 'Savings', 'Other'];

let keyCounter = 0;
const nextKey = () => `item-${keyCounter++}`;

export function SalaryPlannerEditorScreen({ navigation, route }: Props) {
  const plannerId = route.params?.plannerId;
  const isEditing = typeof plannerId === 'number';
  const { colors, radius, spacing, typography } = useTheme();
  const { showToast } = useToast();

  const [name, setName] = useState('');
  const [totalSalary, setTotalSalary] = useState('');
  const [items, setItems] = useState<DraftItem[]>([]);
  const [touched, setTouched] = useState(false);

  const existing = useAsyncData(() => plannerApi.get(plannerId as number), [plannerId], {
    enabled: isEditing,
  });

  useEffect(() => {
    navigation.setOptions({ title: isEditing ? 'Edit Plan' : 'New Plan' });
  }, [isEditing, navigation]);

  useEffect(() => {
    const planner = existing.data;
    if (!planner) return;
    setName(planner.name);
    setTotalSalary(String(planner.totalSalary));
    setItems(
      planner.items.map((item, index) => ({
        key: nextKey(),
        name: item.name,
        amount: String(item.amount),
        color: item.color ?? chartPalette[index % chartPalette.length],
      })),
    );
  }, [existing.data]);

  // A blank plan is not much use, so a new one starts with the usual sections at zero.
  useEffect(() => {
    if (!isEditing && items.length === 0) {
      setItems(
        STARTER_SECTIONS.map((section, index) => ({
          key: nextKey(),
          name: section,
          amount: '',
          color: chartPalette[index % chartPalette.length],
        })),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing]);

  const numeric = (value: string) => Number(value.replace(/,/g, '')) || 0;
  const salary = numeric(totalSalary);
  const allocated = items.reduce((sum, item) => sum + numeric(item.amount), 0);
  const remaining = salary - allocated;

  const save = useSubmit(async () => {
    const payload = {
      name: name.trim() || 'My Plan',
      totalSalary: salary,
      items: items
        .filter((item) => item.name.trim())
        .map((item, index) => ({
          name: item.name.trim(),
          amount: numeric(item.amount),
          color: item.color,
          position: index,
        })),
    };
    return isEditing ? plannerApi.update(plannerId as number, payload) : plannerApi.create(payload);
  });

  const onSave = async () => {
    setTouched(true);
    if (salary <= 0) return;
    const result = await save.submit();
    if (result) {
      showToast(isEditing ? 'Plan updated' : 'Plan created', 'success');
      navigation.replace('SalaryPlannerPreview', { plannerId: result.id });
    }
  };

  const updateItem = (key: string, patch: Partial<DraftItem>) =>
    setItems((current) =>
      current.map((item) => (item.key === key ? { ...item, ...patch } : item)),
    );

  const moveItem = (index: number, direction: -1 | 1) =>
    setItems((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const copy = [...current];
      [copy[index], copy[target]] = [copy[target], copy[index]];
      return copy;
    });

  if (isEditing && existing.loading) {
    return (
      <Screen>
        <LoadingState label="Loading plan" />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <TextField
        label="Plan name"
        value={name}
        onChangeText={setName}
        placeholder="September Plan"
        icon="bookmark-outline"
        containerStyle={{ marginTop: spacing.md }}
      />

      <TextField
        label="Total salary"
        value={totalSalary}
        onChangeText={setTotalSalary}
        keyboardType="decimal-pad"
        placeholder="45000"
        icon="cash-outline"
        required
        error={touched && salary <= 0 ? 'Enter the salary you are splitting' : save.fieldErrors.totalSalary}
      />

      <Card>
        <View style={styles.summaryRow}>
          <View style={styles.flex}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>ALLOCATED</Text>
            <Text style={[typography.title, { color: colors.text }]}>{formatMoney(allocated)}</Text>
          </View>
          <View style={styles.flex}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>REMAINING</Text>
            <Text
              style={[
                typography.title,
                { color: remaining < 0 ? colors.danger : colors.success },
              ]}
            >
              {formatMoney(remaining)}
            </Text>
          </View>
          {allocated > 0 ? (
            <DonutChart
              data={items
                .filter((item) => numeric(item.amount) > 0)
                .map((item) => ({
                  label: item.name,
                  value: numeric(item.amount),
                  color: item.color,
                }))}
              size={72}
              thickness={12}
            />
          ) : null}
        </View>

        <View style={{ marginTop: spacing.lg }}>
          <ProgressBar
            percentage={salary > 0 ? (allocated / salary) * 100 : 0}
            overflow={remaining < 0}
            trailing={formatPercent(salary > 0 ? (allocated / salary) * 100 : 0)}
          />
        </View>
      </Card>

      <SectionHeader title="Sections" style={{ marginTop: spacing.xl }} />

      {items.map((item, index) => (
        <Card key={item.key} style={{ marginBottom: spacing.md }}>
          <View style={styles.itemHeader}>
            <Pressable
              onPress={() =>
                updateItem(item.key, {
                  color:
                    chartPalette[
                      (chartPalette.indexOf(item.color) + 1 + chartPalette.length) % chartPalette.length
                    ],
                })
              }
              hitSlop={8}
              style={[styles.swatch, { backgroundColor: item.color }]}
            />

            <TextField
              label=""
              value={item.name}
              onChangeText={(value) => updateItem(item.key, { name: value })}
              placeholder="Section name"
              containerStyle={{ flex: 1, marginBottom: 0, marginLeft: spacing.md }}
            />
          </View>

          <View style={[styles.itemFooter, { marginTop: spacing.md }]}>
            <TextField
              label=""
              value={item.amount}
              onChangeText={(value) => updateItem(item.key, { amount: value })}
              keyboardType="decimal-pad"
              placeholder="0"
              containerStyle={{ flex: 1, marginBottom: 0 }}
            />

            <View style={[styles.controls, { marginLeft: spacing.md }]}>
              <Pressable
                onPress={() => moveItem(index, -1)}
                hitSlop={6}
                style={[styles.control, { backgroundColor: colors.surfaceAlt, borderRadius: radius.sm }]}
              >
                <Ionicons name="chevron-up" size={16} color={colors.text} />
              </Pressable>
              <Pressable
                onPress={() => moveItem(index, 1)}
                hitSlop={6}
                style={[
                  styles.control,
                  { backgroundColor: colors.surfaceAlt, borderRadius: radius.sm, marginLeft: 6 },
                ]}
              >
                <Ionicons name="chevron-down" size={16} color={colors.text} />
              </Pressable>
              <Pressable
                onPress={() => setItems((current) => current.filter((row) => row.key !== item.key))}
                hitSlop={6}
                style={[
                  styles.control,
                  { backgroundColor: colors.danger + '18', borderRadius: radius.sm, marginLeft: 6 },
                ]}
              >
                <Ionicons name="trash-outline" size={16} color={colors.danger} />
              </Pressable>
            </View>
          </View>

          {salary > 0 && numeric(item.amount) > 0 ? (
            <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.sm }]}>
              {formatPercent((numeric(item.amount) / salary) * 100, 2)} of salary
            </Text>
          ) : null}
        </Card>
      ))}

      <Button
        label="Add section"
        icon="add"
        variant="secondary"
        onPress={() =>
          setItems((current) => [
            ...current,
            {
              key: nextKey(),
              name: '',
              amount: '',
              color: chartPalette[current.length % chartPalette.length],
            },
          ])
        }
      />

      {save.error && save.error.kind !== 'validation' ? (
        <Text style={[typography.caption, { color: colors.danger, marginTop: spacing.md }]}>
          {save.error.message}
        </Text>
      ) : null}

      <Button
        label={isEditing ? 'Save plan' : 'Create plan'}
        onPress={onSave}
        loading={save.submitting}
        style={{ marginTop: spacing.lg }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  summaryRow: { flexDirection: 'row', alignItems: 'center' },
  itemHeader: { flexDirection: 'row', alignItems: 'center' },
  itemFooter: { flexDirection: 'row', alignItems: 'center' },
  swatch: { width: 26, height: 26, borderRadius: 13 },
  controls: { flexDirection: 'row', alignItems: 'center' },
  control: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
});
