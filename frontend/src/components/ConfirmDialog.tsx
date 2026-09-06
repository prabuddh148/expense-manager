import React from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../theme';
import { Button } from './Button';

type Props = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/** Used before anything irreversible: deleting an expense, a loan, a plan. */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  loading = false,
  onConfirm,
  onCancel,
}: Props) {
  const { colors, radius, spacing, typography } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={[styles.backdrop, { backgroundColor: colors.overlay }]}>
        <View
          style={[
            styles.dialog,
            { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.xl },
          ]}
        >
          <Text style={[typography.title, { color: colors.text, fontSize: 19 }]}>{title}</Text>
          <Text
            style={[
              typography.body,
              { color: colors.textMuted, marginTop: spacing.sm, marginBottom: spacing.xl },
            ]}
          >
            {message}
          </Text>

          <Button
            label={confirmLabel}
            variant={destructive ? 'danger' : 'primary'}
            loading={loading}
            onPress={onConfirm}
          />
          <Button
            label={cancelLabel}
            variant="ghost"
            onPress={onCancel}
            style={{ marginTop: spacing.sm }}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  dialog: { width: '100%', maxWidth: 380 },
});
