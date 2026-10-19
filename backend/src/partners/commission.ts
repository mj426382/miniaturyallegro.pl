import { createHash } from 'crypto';

/**
 * Spec 24 – partner programme rules that do not need the database. The defaults are the model approved by the owner
 * (2026-10-19) and are mirrored on the landing page (`landing-page/src/data/partnerProgram.ts`, AC-SEO-027).
 */
export const PARTNER_DEFAULTS = {
  customerDiscountPercent: 10,
  commissionPercent: 20,
  commissionMonths: 12,
} as const;

/** Minimum payout shown as a hint in the panel (a payout below it is allowed with a warning, AC-PRT-012). */
export const MIN_PAYOUT_GROSZE = 5000;

/** Limits of the partner form (AC-PRT-002). */
export const PARTNER_LIMITS = {
  discountPercent: { min: 1, max: 100 },
  commissionPercent: { min: 1, max: 50 },
  commissionMonths: { min: 1, max: 60 },
  maxPayoutGrosze: 10_000_000,
} as const;

/** Statement months are calendar months in Poland, also across DST changes (AC-PRT-011). */
export const STATEMENT_TIME_ZONE = 'Europe/Warsaw';

/**
 * Commission in grosze: `round(percent × net / 100)` with halves rounded up, in integer arithmetic (no float error).
 * Never negative – a fully refunded payment earns 0 (AC-PRT-009).
 */
export function commissionOf(netGrosze: number, percent: number): number {
  if (!Number.isFinite(netGrosze) || !Number.isFinite(percent) || netGrosze <= 0 || percent <= 0) return 0;
  return Math.floor((Math.round(netGrosze) * Math.round(percent) + 50) / 100);
}

/**
 * Adds calendar months in UTC; the day is clamped to the end of a shorter month (31 Jan + 1 month = 28/29 Feb), the
 * time of day is kept. Used for the end of the commission period (spec 24, decision 3).
 */
export function addMonthsUtc(date: Date, months: number): Date {
  const day = date.getUTCDate();
  const target = new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth() + months,
      1,
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds(),
      date.getUTCMilliseconds(),
    ),
  );
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target;
}

/** A customer in a statement: "K-" + the first 8 hex characters of SHA-256 of the account id (no personal data). */
export function customerRef(userId: string): string {
  return `K-${createHash('sha256').update(userId).digest('hex').slice(0, 8)}`;
}

/** NIP without spaces, dashes and an optional "PL" prefix. */
export function normalizeNip(raw: string): string {
  return raw.trim().replace(/^PL/i, '').replace(/[\s-]/g, '');
}

/** 10 digits with the official check digit (weights 6 5 7 2 3 4 5 6 7, sum mod 11, never 10). */
export function isValidNip(raw: string): boolean {
  const nip = normalizeNip(raw);
  if (!/^\d{10}$/.test(nip)) return false;
  const weights = [6, 5, 7, 2, 3, 4, 5, 6, 7];
  const sum = weights.reduce((acc, w, i) => acc + w * Number(nip[i]), 0);
  const check = sum % 11;
  return check !== 10 && check === Number(nip[9]);
}

/** Today's date in Poland as YYYY-MM-DD (a payout date may not be later). */
export function todayInPoland(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: STATEMENT_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** A real calendar date in YYYY-MM-DD form (2026-02-30 is not). */
export function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
