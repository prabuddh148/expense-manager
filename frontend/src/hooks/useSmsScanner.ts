import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';

import { smsApi, toAppError } from '../api';
import {
  hasSmsPermission,
  isSmsReaderAvailable,
  readMessages,
  subscribeToSms,
} from '../../modules/expo-sms-reader/src';
import { parseMessages, parseSms } from '../utils/smsParser';

const LAST_SCAN_KEY = 'sms.last-scan-at';
/** How far back the very first scan reaches. Older messages are history, not pending work. */
const FIRST_SCAN_WINDOW_DAYS = 30;
const MAX_PER_SCAN = 200;

export type SmsPermissionState =
  | 'unsupported'
  | 'undetermined'
  | 'granted'
  | 'denied'
  /** Denied with "don't ask again": only Settings can change it now. */
  | 'blocked';

/**
 * Owns everything device-side about SMS: asking for access, reading messages, parsing
 * them here rather than on the server, and handing the results to the backend.
 *
 * Every path degrades quietly. In Expo Go or on iOS the native module is absent and the
 * state is 'unsupported', so the screen explains itself instead of crashing; a refused
 * permission leaves the rest of the app untouched.
 */
export function useSmsScanner() {
  const [permission, setPermission] = useState<SmsPermissionState>('undetermined');
  const [scanning, setScanning] = useState(false);
  const [lastResult, setLastResult] = useState<{ imported: number; skipped: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scanningRef = useRef(false);

  const available = isSmsReaderAvailable();

  useEffect(() => {
    if (!available) {
      setPermission('unsupported');
      return;
    }
    setPermission(hasSmsPermission() ? 'granted' : 'undetermined');
  }, [available]);

  /** Shows the system prompt. Returns whether access ended up granted. */
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!available || Platform.OS !== 'android') {
      setPermission('unsupported');
      return false;
    }

    try {
      const result = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.READ_SMS,
        PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
      ]);

      const read = result[PermissionsAndroid.PERMISSIONS.READ_SMS];
      if (read === PermissionsAndroid.RESULTS.GRANTED) {
        setPermission('granted');
        return true;
      }
      setPermission(
        read === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN ? 'blocked' : 'denied',
      );
      return false;
    } catch {
      setPermission('denied');
      return false;
    }
  }, [available]);

  /**
   * Reads, parses and uploads. Guarded against overlapping runs, because the live
   * listener and a manual pull can easily fire together and would otherwise send the
   * same messages twice - harmless thanks to server-side dedup, but wasteful.
   */
  const scan = useCallback(async (): Promise<{ imported: number; skipped: number } | null> => {
    if (!available || !hasSmsPermission() || scanningRef.current) {
      return null;
    }

    scanningRef.current = true;
    setScanning(true);
    setError(null);

    try {
      const storedSince = await AsyncStorage.getItem(LAST_SCAN_KEY).catch(() => null);
      const since = storedSince
        ? Number(storedSince)
        : Date.now() - FIRST_SCAN_WINDOW_DAYS * 24 * 60 * 60 * 1000;

      const messages = await readMessages(since, MAX_PER_SCAN);
      const parsed = parseMessages(messages);

      if (parsed.length === 0) {
        // Still move the watermark: these messages were looked at and were not transactions.
        await AsyncStorage.setItem(LAST_SCAN_KEY, String(Date.now())).catch(() => {});
        const empty = { imported: 0, skipped: 0 };
        setLastResult(empty);
        return empty;
      }

      const result = await smsApi.import(parsed);
      // Only advance once the server has them, so a failed upload is retried next time
      // rather than skipped over.
      await AsyncStorage.setItem(LAST_SCAN_KEY, String(Date.now())).catch(() => {});

      const summary = { imported: result.imported, skipped: result.skipped };
      setLastResult(summary);
      return summary;
    } catch (caught) {
      setError(toAppError(caught).message);
      return null;
    } finally {
      scanningRef.current = false;
      setScanning(false);
    }
  }, [available]);

  /** Uploads a single message as it arrives, so new transactions appear on their own. */
  const handleIncoming = useCallback(
    async (body: string, sender: string | null, timestamp: number) => {
      const parsed = parseSms(body, sender, timestamp);
      if (!parsed) return;
      try {
        await smsApi.import([parsed]);
      } catch {
        // Left for the next scan to pick up; the message is still in the inbox.
      }
    },
    [],
  );

  return {
    available,
    permission,
    scanning,
    lastResult,
    error,
    requestPermission,
    scan,
    handleIncoming,
    subscribe: subscribeToSms,
  };
}
