const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const SHORT_MONTHS = MONTHS.map((month) => month.slice(0, 3));

/** The backend speaks ISO dates (yyyy-MM-dd) and ISO times (HH:mm:ss). */
export function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function toIsoTime(date: Date): string {
  const hours = `${date.getHours()}`.padStart(2, '0');
  const minutes = `${date.getMinutes()}`.padStart(2, '0');
  return `${hours}:${minutes}:00`;
}

/** Parses yyyy-MM-dd as a local date, avoiding the UTC shift of new Date(string). */
export function fromIsoDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = fromIsoDate(iso);
  return `${date.getDate()} ${SHORT_MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

export function formatLongDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = fromIsoDate(iso);
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

/** 16:30:00 becomes 4:30 PM. */
export function formatTime(time: string | null | undefined): string {
  if (!time) return '';
  const [hourText, minuteText] = time.split(':');
  const hour = Number(hourText);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:${minuteText ?? '00'} ${suffix}`;
}

export function formatDateTime(date: string | null, time: string | null): string {
  const parts = [formatDate(date), formatTime(time)].filter(Boolean);
  return parts.join(' at ');
}

/** "Today", "Yesterday" or the date - used as section headers in history. */
export function relativeDay(iso: string): string {
  const today = new Date();
  const date = fromIsoDate(iso);
  const diffDays = Math.round(
    (new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() - date.getTime()) /
      86400000,
  );
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return formatDate(iso);
}

export function monthName(month: number): string {
  return MONTHS[Math.min(Math.max(month - 1, 0), 11)];
}

export function currentPeriod() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

export { MONTHS, SHORT_MONTHS };
