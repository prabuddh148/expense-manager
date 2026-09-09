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
/** Matches the server's per-request ceiling; a backlog is drained in pages of this. */
const MAX_PER_SCAN = 200;
/** A stop on the drain loop, so a misbehaving watermark cannot spin forever. */
const MAX_PAGES_PER_SCAN = 50;

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
   * Reads, parses and uploads everything that arrived since the watermark.
   *
   * The watermark only ever moves over messages the server has actually accepted, and
   * it moves to the timestamp of the last message handled rather than to "now". Moving
   * it to now was the bug this replaces: one pass reads at most MAX_PER_SCAN messages,
   * so anything beyond that page was stepped over and never looked at again.
   *
   * A backlog larger than one page is therefore drained a page at a time instead of
   * truncated. Guarded against overlapping runs, because the live listener and a manual
   * pull can easily fire together and would otherwise send the same messages twice -
   * harmless thanks to server-side dedup, but wasteful.
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
      const stored = storedSince === null ? NaN : Number(storedSince);
      let since = Number.isFinite(stored)
        ? stored
        : Date.now() - FIRST_SCAN_WINDOW_DAYS * 24 * 60 * 60 * 1000;

      let imported = 0;
      let skipped = 0;
      let sawAnything = false;

      for (let page = 0; page < MAX_PAGES_PER_SCAN; page += 1) {
        const messages = await readMessages(since, MAX_PER_SCAN);
        if (messages.length === 0) break;

        // Oldest first, so the last one is the furthest the watermark may travel.
        const newest = messages[messages.length - 1].timestamp;
        const parsed = parseMessages(messages);

        // Chunked rather than sent whole: not every Android provider honours the LIMIT
        // in the query, and one oversized batch is rejected outright by the server.
        for (let i = 0; i < parsed.length; i += MAX_PER_SCAN) {
          const result = await smsApi.import(parsed.slice(i, i + MAX_PER_SCAN));
          imported += result.imported;
          skipped += result.skipped;
        }
        sawAnything = true;

        // Only now that the server has them, and only as far as we actually read.
        // Never backwards: a build whose native side still returns newest first would
        // otherwise drag the watermark back and re-read the same window every time.
        if (newest <= since) break;
        await AsyncStorage.setItem(LAST_SCAN_KEY, String(newest)).catch(() => {});

        // A short page means the inbox is drained.
        if (messages.length < MAX_PER_SCAN) break;
        since = newest;
      }

      if (!sawAnything) {
        const empty = { imported: 0, skipped: 0 };
        setLastResult(empty);
        return empty;
      }

      const summary = { imported, skipped };
      setLastResult(summary);
      return summary;
    } catch (caught) {
      // The watermark stays where the last accepted page left it, so a failure here
      // costs a retry rather than the messages.
      setError(toAppError(caught).message);
      return null;
    } finally {
      scanningRef.current = false;
      setScanning(false);
    }
  }, [available]);

  /**
   * Forgets how far the scan has read, so the next one covers the full window again.
   *
   * Deleting a detection is documented as letting a later rescan find the message
   * afresh, which the watermark would otherwise quietly prevent: the row goes but the
   * scan never looks at that message again.
   */
  const resetWatermark = useCallback(async () => {
    await AsyncStorage.removeItem(LAST_SCAN_KEY).catch(() => {});
  }, []);

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
    resetWatermark,
    handleIncoming,
    subscribe: subscribeToSms,
  };
}
