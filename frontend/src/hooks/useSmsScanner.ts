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
import { analyseSms, parseSms, type ParsedSms } from '../utils/smsParser';

/**
 * Versioned because earlier builds stored "now" here after reading only the newest 200
 * messages, which put everything behind that point permanently out of reach. A new key
 * makes the first scan on this version cover the whole window once; the server's dedup
 * absorbs whatever was already imported.
 */
const WATERMARK_KEY = 'sms.scan-watermark.v2';
const LEGACY_WATERMARK_KEYS = ['sms.last-scan-at'];
/** How far back the very first scan reaches. Older messages are history, not pending work. */
const FIRST_SCAN_WINDOW_DAYS = 30;
/**
 * Messages per native read. Deliberately far above a month's inbox: a build installed
 * before the native side switched to oldest-first still returns the newest N, and a
 * page that size is what lets such a build reach the whole window anyway.
 */
const READ_PAGE = 5000;
/** The server's per-request ceiling. */
const UPLOAD_BATCH = 200;
/** A stop on the drain loop, so a misbehaving watermark cannot spin forever. */
const MAX_PAGES_PER_SCAN = 20;
/** How many passed-over bank messages the report keeps, newest first. */
const MAX_UNRECOGNISED = 40;
const DAY_MS = 24 * 60 * 60 * 1000;

/** A message from a bank-shaped sender that talked about money but was not imported. */
export type UnrecognisedSms = {
  sender: string | null;
  body: string;
  timestamp: number;
  reason: string;
};

/**
 * What one scan saw and did. Shown on the screen so that "nothing new" can be told
 * apart from "nothing read" and from "read, but not understood" - three failures that
 * otherwise look identical from the outside.
 */
export type ScanResult = {
  finishedAt: number;
  /** Inbox messages read, and the span of time they covered. */
  read: number;
  oldest: number | null;
  newest: number | null;
  /** Of those, the ones recognised as transactions. */
  recognised: number;
  imported: number;
  skipped: number;
  /** Messages the server would not accept, left behind so they cannot block the rest. */
  rejected: number;
  /** Kept on the device only; never uploaded. */
  unrecognised: UnrecognisedSms[];
  error: string | null;
};

export type ScanOptions = {
  /**
   * Read from here instead of from the watermark, e.g. to pull in the dates a filter is
   * showing. The watermark still only ever moves forward.
   */
  fromMillis?: number;
};

/** A 4xx on import is about the data, which retrying cannot fix. Anything else can be. */
function isRejection(caught: unknown): boolean {
  const status = toAppError(caught).status;
  return status !== undefined && status >= 400 && status < 500 && status !== 401 && status !== 403;
}

/**
 * Uploads one batch. Should the server refuse it, the batch is retried a message at a
 * time: one row it will not take must not hold every later message hostage, which is
 * exactly what happened when the watermark could only move past a batch that landed.
 */
async function upload(
  parsed: ParsedSms[],
): Promise<Pick<ScanResult, 'imported' | 'skipped' | 'rejected'>> {
  const totals = { imported: 0, skipped: 0, rejected: 0 };
  if (parsed.length === 0) return totals;

  try {
    const result = await smsApi.import(parsed);
    return { ...totals, imported: result.imported, skipped: result.skipped };
  } catch (caught) {
    if (!isRejection(caught)) throw caught;
  }

  for (const one of parsed) {
    try {
      const result = await smsApi.import([one]);
      totals.imported += result.imported;
      totals.skipped += result.skipped;
    } catch (caught) {
      if (!isRejection(caught)) throw caught;
      totals.rejected += 1;
    }
  }
  return totals;
}

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
  const [lastResult, setLastResult] = useState<ScanResult | null>(null);
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
   * A backlog is drained a page at a time instead of truncated. Guarded against
   * overlapping runs, because the live listener and a manual pull can easily fire
   * together and would otherwise send the same messages twice - harmless thanks to
   * server-side dedup, but wasteful.
   *
   * Returns null only when no scan ran. A failed one comes back with `error` set, so the
   * caller can say so - reading the hook's error state straight after awaiting this sees
   * the value from before the scan.
   */
  const scan = useCallback(
    async (options: ScanOptions = {}): Promise<ScanResult | null> => {
      if (!available || !hasSmsPermission() || scanningRef.current) {
        return null;
      }

      scanningRef.current = true;
      setScanning(true);
      setError(null);

      const report: ScanResult = {
        finishedAt: 0,
        read: 0,
        oldest: null,
        newest: null,
        recognised: 0,
        imported: 0,
        skipped: 0,
        rejected: 0,
        unrecognised: [],
        error: null,
      };

      try {
        AsyncStorage.multiRemove(LEGACY_WATERMARK_KEYS).catch(() => {});
        const storedSince = await AsyncStorage.getItem(WATERMARK_KEY).catch(() => null);
        const stored = storedSince === null ? NaN : Number(storedSince);
        // A watermark in the future would hide every message until that moment arrived.
        const watermark = Number.isFinite(stored) && stored <= Date.now() ? stored : null;
        let mark = watermark ?? 0;
        let since =
          options.fromMillis ?? watermark ?? Date.now() - FIRST_SCAN_WINDOW_DAYS * DAY_MS;

        for (let page = 0; page < MAX_PAGES_PER_SCAN; page += 1) {
          const batch = await readMessages(since, READ_PAGE);
          if (batch.length === 0) break;

          // Sorted here rather than trusted: which order the native side returns depends
          // on the build installed, and the watermark may only ever walk forward.
          const messages = [...batch].sort((a, b) => a.timestamp - b.timestamp);
          report.read += messages.length;
          report.oldest ??= messages[0].timestamp;
          report.newest = messages[messages.length - 1].timestamp;

          for (let i = 0; i < messages.length; i += UPLOAD_BATCH) {
            const slice = messages.slice(i, i + UPLOAD_BATCH);
            const parsed: ParsedSms[] = [];
            for (const message of slice) {
              const verdict = analyseSms(message.body, message.sender, message.timestamp);
              if (verdict.ok) {
                parsed.push(verdict.parsed);
              } else if (verdict.suspicious) {
                report.unrecognised.unshift({
                  sender: message.sender,
                  body: message.body,
                  timestamp: message.timestamp,
                  reason: verdict.reason,
                });
                if (report.unrecognised.length > MAX_UNRECOGNISED) report.unrecognised.pop();
              }
            }
            report.recognised += parsed.length;

            const result = await upload(parsed);
            report.imported += result.imported;
            report.skipped += result.skipped;
            report.rejected += result.rejected;

            // Only past what the server has now dealt with, and never backwards - a
            // rescan from an earlier date leaves the watermark where it was.
            const reached = slice[slice.length - 1].timestamp;
            if (reached > since) since = reached;
            if (reached > mark) {
              mark = reached;
              await AsyncStorage.setItem(WATERMARK_KEY, String(mark)).catch(() => {});
            }
          }

          // A short page means the inbox is drained.
          if (batch.length < READ_PAGE) break;
        }

        report.finishedAt = Date.now();
        setLastResult(report);
        return report;
      } catch (caught) {
        // The watermark stays where the last accepted batch left it, so a failure here
        // costs a retry rather than the messages.
        report.error = toAppError(caught).message;
        report.finishedAt = Date.now();
        setError(report.error);
        setLastResult(report);
        return report;
      } finally {
        scanningRef.current = false;
        setScanning(false);
      }
    },
    [available],
  );

  /**
   * Forgets how far the scan has read, so the next one covers the full window again.
   *
   * Deleting a detection is documented as letting a later rescan find the message
   * afresh, which the watermark would otherwise quietly prevent: the row goes but the
   * scan never looks at that message again.
   */
  const resetWatermark = useCallback(async () => {
    await AsyncStorage.removeItem(WATERMARK_KEY).catch(() => {});
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
