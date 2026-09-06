import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  /** Caps the sheet height as a fraction of the screen. */
  maxHeightRatio?: number;
};

export function BottomSheet({ visible, onClose, title, children, maxHeightRatio = 0.88 }: Props) {
  const { colors, radius, spacing, typography } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
      <View style={[styles.backdrop, { backgroundColor: colors.overlay }]}>
        <Pressable style={styles.dismissArea} onPress={onClose} accessibilityLabel="Close" />

        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
              borderTopLeftRadius: radius.xl,
              borderTopRightRadius: radius.xl,
              // The app runs edge-to-edge, so inside a Modal insets.bottom is the whole
              // gesture/navigation bar. Adding padding on top of it stacked two gaps and
              // left a visibly empty strip under short sheets; take whichever is larger.
              paddingBottom: Math.max(insets.bottom, spacing.md),
              maxHeight: `${maxHeightRatio * 100}%`,
            },
          ]}
        >
          <View style={[styles.grabber, { backgroundColor: colors.border }]} />

          <View style={[styles.header, { paddingHorizontal: spacing.lg, marginBottom: spacing.md }]}>
            <Text style={[typography.title, { color: colors.text, fontSize: 19 }]}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={24} color={colors.textMuted} />
            </Pressable>
          </View>

          <ScrollView
            // Without flexGrow 0 the ScrollView expands to the sheet's maxHeight and
            // leaves dead space under short content; flexShrink 1 still lets it scroll
            // once the content is taller than the cap.
            style={styles.scroll}
            // The bottom padding belongs to the scrolled content, not the sheet: without
            // it the last control ends flush with the scroll edge and looks clipped once
            // the sheet is tall enough to scroll.
            contentContainerStyle={{
              paddingHorizontal: spacing.lg,
              paddingBottom: spacing.md,
            }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {children}
          </ScrollView>
        </View>
      </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  dismissArea: { flex: 1 },
  sheet: { paddingTop: 8 },
  scroll: { flexGrow: 0, flexShrink: 1 },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
