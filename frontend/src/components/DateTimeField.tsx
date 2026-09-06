import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../theme';
import { formatDate, formatTime, toIsoDate, toIsoTime } from '../utils/date';

type Props = {
  label: string;
  mode: 'date' | 'time';
  /** ISO date (yyyy-MM-dd) or ISO time (HH:mm:ss). */
  value: string;
  onChange: (value: string) => void;
  minimumDate?: Date;
  maximumDate?: Date;
};

/** Wraps the platform picker so screens deal only in ISO strings. */
export function DateTimeField({ label, mode, value, onChange, minimumDate, maximumDate }: Props) {
  const { colors, radius, spacing, typography } = useTheme();
  const [open, setOpen] = useState(false);

  const asDate = () => {
    if (mode === 'date') {
      const [year, month, day] = value.split('-').map(Number);
      return new Date(year, (month ?? 1) - 1, day ?? 1);
    }
    const [hours, minutes] = value.split(':').map(Number);
    const date = new Date();
    date.setHours(hours ?? 0, minutes ?? 0, 0, 0);
    return date;
  };

  const handleChange = (event: DateTimePickerEvent, selected?: Date) => {
    // On Android the dialog is modal and must be dismissed on every outcome.
    if (Platform.OS === 'android') {
      setOpen(false);
    }
    if (event.type === 'dismissed' || !selected) {
      return;
    }
    onChange(mode === 'date' ? toIsoDate(selected) : toIsoTime(selected));
  };

  return (
    <View style={{ marginBottom: spacing.lg }}>
      <Text style={[typography.label, { color: colors.textMuted, marginBottom: spacing.xs }]}>
        {label}
      </Text>

      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.field,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderRadius: radius.md,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.md + 2,
            opacity: pressed ? 0.8 : 1,
          },
        ]}
      >
        <Ionicons
          name={mode === 'date' ? 'calendar-outline' : 'time-outline'}
          size={18}
          color={colors.textMuted}
        />
        <Text
          // The short month keeps a date on one line even at half width, next to the
          // time field; wrapping here made the two fields different heights.
          numberOfLines={1}
          style={[typography.body, { color: colors.text, flex: 1, marginLeft: spacing.sm }]}
        >
          {mode === 'date' ? formatDate(value) : formatTime(value)}
        </Text>
        <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
      </Pressable>

      {open ? (
        <DateTimePicker
          value={asDate()}
          mode={mode}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleChange}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
        />
      ) : null}

      {open && Platform.OS === 'ios' ? (
        <Pressable onPress={() => setOpen(false)} style={{ paddingVertical: spacing.sm }}>
          <Text style={[typography.label, { color: colors.primary, textAlign: 'center' }]}>
            Done
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    // Matches the height a TextField settles at, so a date sitting beside a time or a
    // text input lines up exactly.
    minHeight: 50,
  },
});
