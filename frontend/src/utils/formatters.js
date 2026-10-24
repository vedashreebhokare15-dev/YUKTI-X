import { format, formatDistanceToNowStrict, isValid, parseISO } from 'date-fns';

function toDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : parseISO(value);
  return isValid(date) ? date : null;
}

export function formatDate(value, fallback = '—') {
  const date = toDate(value);
  return date ? format(date, 'dd MMM yyyy') : fallback;
}

export function formatShortDate(value, fallback = '—') {
  const date = toDate(value);
  return date ? format(date, 'dd MMM') : fallback;
}

export function formatDateTime(value, fallback = '—') {
  const date = toDate(value);
  return date ? format(date, 'dd MMM yyyy, HH:mm') : fallback;
}

export function formatRelative(value) {
  const date = toDate(value);
  if (!date) return '—';
  return `${formatDistanceToNowStrict(date)} ago`;
}

export function formatArea(value, digits = 1) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return `${Number(value).toLocaleString('en-IN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })} km²`;
}

export function formatNumber(value, digits = 0) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return Number(value).toLocaleString('en-IN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatPercent(value, digits = 1) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return `${Number(value).toFixed(digits)}%`;
}

export function formatConfidence(value) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return `${Math.round(Number(value) * 100)}%`;
}

export function percentageOf(part, total) {
  if (!total) return 0;
  return (Number(part) / Number(total)) * 100;
}

export function getInitials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}

export function todayIso() {
  return format(new Date(), 'yyyy-MM-dd');
}

export function daysAgoIso(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return format(date, 'yyyy-MM-dd');
}

export function dedupeBy(items, keyFn) {
  const seen = new Set();
  return items.filter((item) => {
    const key = keyFn(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function classificationSlug(classification = '') {
  if (classification === 'Likely Forest Loss') return 'likely';
  if (classification === 'Possible Forest Loss') return 'possible';
  if (classification === 'No Detected Loss') return 'none';
  return 'insufficient';
}

export function reportTypeSlug(type = '') {
  return type.toLowerCase().replace(/\s+/g, '-');
}
