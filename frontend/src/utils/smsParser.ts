import type { SmsTransactionPayload } from '../types/api';
import { fromIsoDate, toIsoDate } from './date';

/**
 * Turns a bank SMS into a transaction, or decides it is not one.
 *
 * Parsing lives on the device so message text never leaves it, and so the patterns can
 * be adjusted without touching the server.
 *
 * The bias throughout is to return null. A missed transaction is a minor annoyance the
 * user can enter by hand; a wrongly parsed one puts a made-up figure in their finances.
 * Nothing is guessed: no category is inferred, and a message without a recognisable
 * amount and direction is rejected outright.
 */

export type ParsedSms = SmsTransactionPayload & { matched: true };

/** Bank senders are of the form AD-ICICIB, VM-HDFCBK, JD-SBIINB and so on. */
const SENDER_PATTERN = /^(?:[A-Z]{2}-)?([A-Z]{4,10})(?:-[A-Z])?$/i;

/**
 * Maps the sender code to a readable name. Only used for display - an unknown code
 * still produces a transaction, labelled with the code itself, so no bank is excluded
 * by not being on a list.
 */
const SENDER_NAMES: Record<string, string> = {
  ICICIB: 'ICICI',
  ICICIT: 'ICICI',
  HDFCBK: 'HDFC',
  SBIINB: 'SBI',
  SBIUPI: 'SBI',
  ATMSBI: 'SBI',
  AXISBK: 'Axis',
  KOTAKB: 'Kotak',
  CBSSBI: 'SBI',
  CENTBK: 'Central Bank',
  PNBSMS: 'PNB',
  BOIIND: 'Bank of India',
  CANBNK: 'Canara',
  UNIONB: 'Union Bank',
  YESBNK: 'Yes Bank',
  IDFCFB: 'IDFC First',
  INDUSB: 'IndusInd',
  PAYTMB: 'Paytm Payments Bank',
};

/** A message must look like money moving in a direction we understand. "Sent" is Kotak's. */
const DEBIT_WORDS = /\b(debited|debit|spent|paid|sent|withdrawn|purchase|deducted)\b/i;
const CREDIT_WORDS = /\b(credited|credit|received|deposited|refund)\b/i;

/** Anything that means "this is not a transaction that happened". */
const NEGATIVE_WORDS =
  /\b(otp|will be|request|failed|declined|reversed|due|statement|balance is|available balance is|offer|apply now|eligible|reminder)\b/i;

// The comma-grouped branch demands at least one comma. With `*` it also matched the
// first three digits of a plain number and stopped there, turning INR 1200.00 into 120.
const AMOUNT_PATTERN =
  /(?:INR|Rs\.?|₹)\s*([0-9]{1,3}(?:,[0-9]{2,3})+(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)/i;

/** Plenty of banks write "debited by 150.0", with no currency marker at all. */
const AMOUNT_FALLBACK_PATTERN =
  /\b(?:debited|credited)\s+(?:by|with|for)\s+([0-9]{1,3}(?:,[0-9]{2,3})+(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)/i;

const ACCOUNT_PATTERN =
  /\b(?:a\/c|acct|account|card|ac)\s*(?:no\.?|number)?\s*[:.]?\s*((?:x|\*){2,}\s*[0-9]{3,6}|[0-9]{3,6})\b/i;

const REFERENCE_PATTERN =
  /\b(?:ref|refno|reference|txn|transaction|uti|rrn|uPI Ref)\s*(?:no\.?|id)?\s*[:.# ]\s*([A-Za-z0-9]{4,20})\b/i;

const MERCHANT_PATTERN =
  /\b(?:at|to|towards|for|VPA)\s+([A-Za-z0-9][A-Za-z0-9 .&'@_-]{2,40}?)(?=\s+(?:on|dated|ref|txn|rrn|upi|avl|available|a\/c|your|info)\b|[.,;]|$)/i;

const DATE_PATTERNS: { pattern: RegExp; build: (m: RegExpMatchArray) => string | null }[] = [
  // 08-09-2026, 08/09/26
  {
    pattern: /\b(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})\b/,
    build: (m) => isoFrom(Number(m[1]), Number(m[2]), Number(m[3])),
  },
  // 08-Sep-2026, 8 Sep 26
  {
    pattern: /\b(\d{1,2})[-\s]([A-Za-z]{3,9})[-\s](\d{2,4})\b/,
    build: (m) => {
      const month = MONTHS.indexOf(m[2].slice(0, 3).toLowerCase()) + 1;
      return month === 0 ? null : isoFrom(Number(m[1]), month, Number(m[3]));
    },
  },
  // 2026-09-08
  {
    pattern: /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/,
    build: (m) => isoFrom(Number(m[3]), Number(m[2]), Number(m[1])),
  },
];

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

const TIME_PATTERN = /\b(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm)?\b/i;

/**
 * A printed date this far from when the message arrived is not the transaction date -
 * it is a misread (month and day swapped, a reference number that looks like a date)
 * and would file the row under the wrong month, where nobody looks for it.
 */
const MAX_DAYS_BEFORE_RECEIPT = 7;
const MAX_DAYS_AFTER_RECEIPT = 1;
const DAY_MS = 24 * 60 * 60 * 1000;

function isoFrom(day: number, month: number, year: number): string | null {
  const fullYear = year < 100 ? 2000 + year : year;
  if (fullYear < 2000 || fullYear > 2100) return null;
  // Checked against a real calendar, not just 1-31: 31-09 is not a date, and the
  // server refuses the whole batch that carries one.
  const date = new Date(fullYear, month - 1, day);
  if (date.getFullYear() !== fullYear || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return toIsoDate(date);
}

function isPlausible(iso: string, receivedAt: number): boolean {
  const received = new Date(receivedAt);
  const receivedDay = new Date(received.getFullYear(), received.getMonth(), received.getDate());
  const days = Math.round((fromIsoDate(iso).getTime() - receivedDay.getTime()) / DAY_MS);
  return days >= -MAX_DAYS_BEFORE_RECEIPT && days <= MAX_DAYS_AFTER_RECEIPT;
}

function bankFrom(sender: string | null): string | null {
  if (!sender) return null;
  const match = sender.trim().toUpperCase().match(SENDER_PATTERN);
  if (!match) return null;
  const code = match[1];
  return SENDER_NAMES[code] ?? code;
}

function parseTime(body: string): string | null {
  const match = body.match(TIME_PATTERN);
  if (!match) return null;

  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const meridiem = match[3]?.toLowerCase();

  if (minutes > 59) return null;
  if (meridiem === 'pm' && hours < 12) hours += 12;
  if (meridiem === 'am' && hours === 12) hours = 0;
  if (hours > 23) return null;

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
}

function parseDate(body: string, receivedAt: number): string {
  for (const { pattern, build } of DATE_PATTERNS) {
    const match = body.match(pattern);
    if (match) {
      const iso = build(match);
      if (iso && isPlausible(iso, receivedAt)) return iso;
    }
  }
  // No usable date printed: the message arrived when it arrived. Local, not UTC - a
  // payment at 00:30 IST is on that day, not the one before.
  return toIsoDate(new Date(receivedAt));
}

function clean(value: string | undefined | null): string | null {
  if (!value) return null;
  const trimmed = value.trim().replace(/\s+/g, ' ');
  return trimmed.length === 0 ? null : trimmed;
}

export type SmsVerdict =
  | { ok: true; parsed: ParsedSms }
  | {
      ok: false;
      /** Why it was passed over, in words the scan report can show. */
      reason: string;
      /**
       * From a bank-shaped sender and talking about money - the kind of message a
       * person would expect to see as a transaction, so worth listing when skipped.
       */
      suspicious: boolean;
    };

function skip(reason: string, suspicious: boolean): SmsVerdict {
  return { ok: false, reason, suspicious };
}

/**
 * Decides whether a message is a transaction, and says why when it is not.
 *
 * `sender` decides the bank; a message from a person is ignored because it will not
 * match the sender shape.
 */
export function analyseSms(body: string, sender: string | null, receivedAt: number): SmsVerdict {
  if (!body) return skip('Empty message', false);

  const bank = bankFrom(sender);
  if (!bank) return skip('Not from a bank or business sender', false);

  const amountMatch = body.match(AMOUNT_PATTERN) ?? body.match(AMOUNT_FALLBACK_PATTERN);
  // "Credit Card" and "Debit Card" name the instrument, not the direction the money
  // went. Left in, every card spend read as both a debit and a credit and was dropped.
  const direction = body.replace(/\b(?:credit|debit)\s*cards?\b/gi, ' card ');
  const debitAt = direction.search(DEBIT_WORDS);
  const creditAt = direction.search(CREDIT_WORDS);
  const talksMoney = amountMatch !== null || debitAt >= 0 || creditAt >= 0;

  // "Your OTP is", "will be debited", "payment due" - not money that has moved.
  const negative = body.match(NEGATIVE_WORDS);
  if (negative) return skip(`Passed over because it says "${negative[0]}"`, talksMoney);

  if (debitAt < 0 && creditAt < 0) return skip('No debit or credit wording found', talksMoney);
  // Both words is the normal shape of a transfer - "A/c XX12 debited for Rs 500; ABC
  // credited" - and the one naming this account comes first. Rejecting these as
  // ambiguous threw away most UPI payments.
  const isDebit = creditAt < 0 || (debitAt >= 0 && debitAt < creditAt);

  if (!amountMatch) return skip('No amount found', true);

  const amount = Number(amountMatch[1].replace(/,/g, ''));
  if (!Number.isFinite(amount) || amount <= 0) return skip('The amount reads as zero', true);

  const accountMatch = body.match(ACCOUNT_PATTERN);
  const referenceMatch = body.match(REFERENCE_PATTERN);
  const merchantMatch = body.match(MERCHANT_PATTERN);

  return {
    ok: true,
    parsed: {
      matched: true,
      bankName: bank,
      accountIdentifier: accountMatch ? clean(accountMatch[1])?.replace(/\s+/g, '') ?? null : null,
      amount,
      transactionType: isDebit ? 'DEBIT' : 'CREDIT',
      transactionDate: parseDate(body, receivedAt),
      transactionTime: parseTime(body),
      merchant: merchantMatch ? clean(merchantMatch[1]) : null,
      smsReference: referenceMatch ? clean(referenceMatch[1]) : null,
      // The server hashes from these fields when this is absent. Left to it on purpose:
      // one implementation of the fingerprint means devices cannot disagree about it.
      dedupeHash: null,
    },
  };
}

/** Returns a transaction, or null when the message is not one we are confident about. */
export function parseSms(
  body: string,
  sender: string | null,
  receivedAt: number,
): ParsedSms | null {
  const verdict = analyseSms(body, sender, receivedAt);
  return verdict.ok ? verdict.parsed : null;
}
