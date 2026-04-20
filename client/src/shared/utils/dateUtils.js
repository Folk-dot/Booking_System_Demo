import { format, parseISO } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

const TZ = 'Asia/Bangkok';

export function toBkkDate(isoString) {
  if (!isoString) return null;
  return toZonedTime(parseISO(String(isoString)), TZ);
}

export function formatDate(isoString, fmt = 'EEE d MMM yyyy') {
  const d = toBkkDate(isoString);
  return d ? format(d, fmt) : '-';
}

export function formatTime(isoString) {
  const d = toBkkDate(isoString);
  return d ? format(d, 'HH:mm') : '-';
}

export function formatDateRange(startsAt, endsAt) {
  return `${formatDate(startsAt)} · ${formatTime(startsAt)}–${formatTime(endsAt)}`;
}

// Returns YYYY-MM-DD string in Bangkok time for a JS Date or ISO string
export function toBkkDateStr(date) {
  const d = typeof date === 'string' ? toZonedTime(parseISO(date), TZ) : toZonedTime(date, TZ);
  return format(d, 'yyyy-MM-dd');
}

// Returns an ISO string representing Bangkok midnight of a YYYY-MM-DD date string
export function bkkDateToUtcIso(dateStr) {
  return new Date(`${dateStr}T00:00:00+07:00`).toISOString();
}
