import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { plannerApi } from '../../api';
import {
  Button,
  Card,
  ChartLegend,
  DonutChart,
  ErrorState,
  LoadingState,
  ProgressBar,
  Screen,
} from '../../components';
import { useAsyncData } from '../../hooks/useAsyncData';
import { AppStackParamList } from '../../navigation/types';
import { useToast } from '../../store/ToastContext';
import { useTheme } from '../../theme';
import { exportPlannerAsImage, exportPlannerAsPdf } from '../../utils/plannerExport';
import { formatMoney, formatPercent } from '../../utils/format';

type Props = NativeStackScreenProps<AppStackParamList, 'SalaryPlannerPreview'>;

export function SalaryPlannerPreviewScreen({ navigation, route }: Props) {
  const { plannerId } = route.params;
  const { colors, radius, spacing, typography } = useTheme();
  const { showToast } = useToast();

  const shotRef = useRef<View>(null);
  const [exporting, setExporting] = useState<'image' | 'pdf' | null>(null);

  const { data, loading, error, reload } = useAsyncData(
    () => plannerApi.get(plannerId),
    [plannerId],
  );

  const share = async (kind: 'image' | 'pdf') => {
    if (!data) return;
    setExporting(kind);
    try {
      if (kind === 'image') {
        await exportPlannerAsImage(shotRef, data);
      } else {
        await exportPlannerAsPdf(data);
      }
    } catch {
      showToast(`Could not export the ${kind === 'pdf' ? 'PDF' : 'image'}`, 'error');
    } finally {
      setExporting(null);
    }
  };

  if (loading) {
    return (
      <Screen>
        <LoadingState label="Loading plan" />
      </Screen>
    );
  }

  if (error || !data) {
    return (
      <Screen>
        <ErrorState
          message={error?.message ?? 'That plan could not be found.'}
          offline={error?.kind === 'network'}
          onRetry={reload}
        />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      {/* Everything inside this view is what the exported PNG captures. */}
      <View
        ref={shotRef}
        collapsable={false}
        style={{ backgroundColor: colors.background, paddingVertical: spacing.md }}
      >
        <Card>
          <Text style={[typography.title, { color: colors.text }]}>{data.name}</Text>
          <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
            SALARY PLAN
          </Text>

          <View style={[styles.donutWrap, { marginTop: spacing.xl }]}>
            <DonutChart
              data={data.items.map((item) => ({
                label: item.name,
                value: item.amount,
                color: item.color,
              }))}
              size={190}
              thickness={28}
              centerValue={formatMoney(data.totalSalary)}
              centerLabel="total salary"
            />
          </View>

          <View style={[styles.summary, { marginTop: spacing.xl }]}>
            <View style={styles.flex}>
              <Text style={[typography.caption, { color: colors.textMuted, fontSize: 10 }]}>
                ALLOCATED
              </Text>
              <Text style={[typography.heading, { color: colors.text }]}>
                {formatMoney(data.totalAllocated)}
              </Text>
            </View>
            <View style={styles.flex}>
              <Text style={[typography.caption, { color: colors.textMuted, fontSize: 10 }]}>
                REMAINING
              </Text>
              <Text
                style={[
                  typography.heading,
                  { color: data.overAllocated ? colors.danger : colors.success },
                ]}
              >
                {formatMoney(data.remainingAmount)}
              </Text>
            </View>
            <View style={styles.flex}>
              <Text style={[typography.caption, { color: colors.textMuted, fontSize: 10 }]}>
                SHARE USED
              </Text>
              <Text style={[typography.heading, { color: colors.text }]}>
                {formatPercent(data.allocatedPercentage)}
              </Text>
            </View>
          </View>

          <View style={{ marginTop: spacing.lg }}>
            <ProgressBar
              percentage={data.allocatedPercentage}
              overflow={data.overAllocated}
              height={10}
            />
          </View>

          <View
            style={[
              styles.divider,
              { backgroundColor: colors.border, marginVertical: spacing.lg },
            ]}
          />

          <ChartLegend
            items={data.items.map((item) => ({
              label: item.name,
              value: item.amount,
              percentage: item.percentage,
              color: item.color,
            }))}
          />
        </Card>
      </View>

      {data.overAllocated ? (
        <View
          style={[
            styles.warning,
            {
              backgroundColor: colors.danger + '18',
              borderRadius: radius.md,
              padding: spacing.md,
              marginTop: spacing.md,
            },
          ]}
        >
          <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
          <Text style={[typography.caption, { color: colors.text, marginLeft: spacing.sm, flex: 1 }]}>
            This plan allocates more than the salary. Adjust a section before sharing it.
          </Text>
        </View>
      ) : null}

      <Button
        label="Export as image"
        icon="image-outline"
        onPress={() => share('image')}
        loading={exporting === 'image'}
        style={{ marginTop: spacing.xl }}
      />
      <Button
        label="Export as PDF"
        icon="document-outline"
        variant="secondary"
        onPress={() => share('pdf')}
        loading={exporting === 'pdf'}
        style={{ marginTop: spacing.sm }}
      />
      <Button
        label="Edit plan"
        variant="ghost"
        onPress={() => navigation.navigate('SalaryPlannerEditor', { plannerId })}
        style={{ marginTop: spacing.sm }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  donutWrap: { alignItems: 'center' },
  summary: { flexDirection: 'row' },
  divider: { height: StyleSheet.hairlineWidth },
  warning: { flexDirection: 'row', alignItems: 'center' },
});
