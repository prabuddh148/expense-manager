import type { SmsTransactionPayload } from '../types/api';

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

/** A message must look like money moving in a direction we understand. */
const DEBIT_WORDS = /\b(debited|debit|spent|paid|withdrawn|purchase|deducted)\b/i;
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

function isoFrom(day: number, month: number, year: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const fullYear = year < 100 ? 2000 + year : year;
  if (fullYear < 2000 || fullYear > 2100) return null;
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${fullYear}-${pad(month)}-${pad(day)}`;
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

function parseDate(body: string, fallback: number): string {
  for (const { pattern, build } of DATE_PATTERNS) {
    const match = body.match(pattern);
    if (match) {
      const iso = build(match);
      if (iso) return iso;
    }
  }
  // No date printed: the message arrived when it arrived.
  return new Date(fallback).toISOString().slice(0, 10);
}

function clean(value: string | undefined | null): string | null {
  if (!value) return null;
  const trimmed = value.trim().replace(/\s+/g, ' ');
  return trimmed.length === 0 ? null : trimmed;
}

/**
 * Returns a transaction, or null when the message is not one we are confident about.
 *
 * `sender` decides the bank; a message from a person is ignored because it will not
 * match the sender shape.
 */
export function parseSms(
  body: string,
  sender: string | null,
  receivedAt: number,
): ParsedSms | null {
  if (!body) return null;

  const bank = bankFrom(sender);
  if (!bank) return null;

  // "Your OTP is", "will be debited", "payment due" - not money that has moved.
  if (NEGATIVE_WORDS.test(body)) return null;

  // "Credit Card" and "Debit Card" name the instrument, not the direction the money
  // went. Left in, every card spend read as both a debit and a credit and was dropped.
  const direction = body.replace(/(?:credit|debit)s*cards?/gi, " card ");

  const isDebit = DEBIT_WORDS.test(direction);
  const isCredit = CREDIT_WORDS.test(direction);
  // Exactly one direction, or we cannot say what happened.
  if (isDebit === isCredit) return null;

  const amountMatch = body.match(AMOUNT_PATTERN) ?? body.match(AMOUNT_FALLBACK_PATTERN);
  if (!amountMatch) return null;

  const amount = Number(amountMatch[1].replace(/,/g, ''));
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const accountMatch = body.match(ACCOUNT_PATTERN);
  const referenceMatch = body.match(REFERENCE_PATTERN);
  const merchantMatch = body.match(MERCHANT_PATTERN);

  return {
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
  };
}

/** Parses a batch, dropping everything that is not a transaction. */
export function parseMessages(
  messages: { body: string; sender: string | null; timestamp: number }[],
): ParsedSms[] {
  return messages
    .map((message) => parseSms(message.body, message.sender, message.timestamp))
    .filter((parsed): parsed is ParsedSms => parsed !== null);
}
