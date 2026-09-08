import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { smsApi } from '../api';

const DAILY_REMINDER_ID = 'sms-uncategorised-daily';
/** Evening, when the day's spending has happened and there is something to categorise. */
const REMINDER_HOUR = 20;
const REMINDER_MINUTE = 0;

/** Marks a notification as ours, so tapping it can open the right screen. */
export const SMS_REMINDER_TYPE = 'sms-pending';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function requestNotificationPermission(): Promise<boolean> {
  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) return true;
  if (!existing.canAskAgain) return false;

  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

/**
 * Schedules the daily reminder, but only when there is something to be reminded about.
 *
 * The count is checked at scheduling time and the reminder is cancelled outright when
 * it reaches zero, so the user is never told about seven pending transactions they
 * already dealt with, and never pinged for nothing.
 */
export async function syncPendingReminder(): Promise<void> {
  try {
    const granted = await requestNotificationPermission();
    if (!granted) return;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('reminders', {
        name: 'Reminders',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const pending = await smsApi.pendingCount();

    // Replacing rather than adding: scheduling this repeatedly must not stack up.
    await Notifications.cancelScheduledNotificationAsync(DAILY_REMINDER_ID).catch(() => {});

    if (pending <= 0) {
      return;
    }

    await Notifications.scheduleNotificationAsync({
      identifier: DAILY_REMINDER_ID,
      content: {
        title: 'Expense Manager',
        body:
          pending === 1
            ? 'You have 1 uncategorized transaction pending. Tap to categorize it.'
            : `You have ${pending} uncategorized transactions pending. Tap to categorize them.`,
        data: { type: SMS_REMINDER_TYPE },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: REMINDER_HOUR,
        minute: REMINDER_MINUTE,
        channelId: 'reminders',
      },
    });
  } catch {
    // A reminder is a convenience; failing to schedule one must not break the app.
  }
}

export async function cancelPendingReminder(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(DAILY_REMINDER_ID).catch(() => {});
}
