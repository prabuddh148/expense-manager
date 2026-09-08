import { NativeModule, requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

export type SmsMessage = {
  /** Inbox row id, absent for a message delivered live. */
  id: string | null;
  sender: string | null;
  body: string;
  /** Milliseconds since the epoch. */
  timestamp: number;
};

type SmsReaderEvents = {
  onSmsReceived: (message: SmsMessage) => void;
};

declare class SmsReaderModuleType extends NativeModule<SmsReaderEvents> {
  hasPermission(): boolean;
  readMessages(sinceMillis: number, limit: number): Promise<SmsMessage[]>;
  startListening(): void;
  stopListening(): void;
}

/**
 * Optional on purpose. The module only exists in a development or release build for
 * Android; in Expo Go, or anywhere on iOS, this is null and every helper below degrades
 * to "unavailable" rather than throwing at import time.
 */
const SmsReaderModule = requireOptionalNativeModule<SmsReaderModuleType>('ExpoSmsReader');

/** Whether this build can read SMS at all, before any question of permission. */
export function isSmsReaderAvailable(): boolean {
  return Platform.OS === 'android' && SmsReaderModule != null;
}

export function hasSmsPermission(): boolean {
  if (!isSmsReaderAvailable()) return false;
  try {
    return SmsReaderModule!.hasPermission();
  } catch {
    return false;
  }
}

export async function readMessages(sinceMillis: number, limit = 200): Promise<SmsMessage[]> {
  if (!isSmsReaderAvailable()) return [];
  return SmsReaderModule!.readMessages(sinceMillis, limit);
}

/** Emits new messages as they arrive. Returns a function that stops the subscription. */
export function subscribeToSms(listener: (message: SmsMessage) => void): () => void {
  if (!isSmsReaderAvailable()) return () => undefined;

  const subscription = SmsReaderModule!.addListener('onSmsReceived', listener);
  SmsReaderModule!.startListening();

  return () => {
    subscription.remove();
    try {
      SmsReaderModule!.stopListening();
    } catch {
      // Already torn down with the native context; nothing to do.
    }
  };
}
