/** Number and date formatting for the hand history pages (LOCALE in strings.ts). */

import { LOCALE } from "./strings";

const chipsFmt = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 2 });
const bbFmt = new Intl.NumberFormat(LOCALE, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** 47892 → "47,892". */
export function fmtChips(n: number): string {
  return chipsFmt.format(n);
}

/** 21.56 → "21.6 BB". */
export function fmtBb(n: number): string {
  return `${bbFmt.format(n)} BB`;
}

/** Signed BB for results: "+12.3 BB" / "−4.0 BB". */
export function fmtSignedBb(n: number): string {
  if (Math.abs(n) < 0.05) return fmtBb(0);
  return `${n > 0 ? "+" : "−"}${fmtBb(Math.abs(n))}`;
}

export function fmtSignedChips(n: number): string {
  if (n === 0) return "0";
  return `${n > 0 ? "+" : "−"}${fmtChips(Math.abs(n))}`;
}

/** Plain number in LOCALE: 1500 → "1,500"; 28.56 with 1 digit → "28.6". */
export function fmtNum(n: number, maxDigits = 0, minDigits = 0): string {
  return n.toLocaleString(LOCALE, { minimumFractionDigits: minDigits, maximumFractionDigits: maxDigits });
}

/** 0.286 → "28.6%". */
export function fmtPct(x: number, digits = 1): string {
  return `${fmtNum(x * 100, digits, digits)}%`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-10-08T21:40:24" → "Oct 8, 2026, 21:40". The time is the site's local time — no zone conversion. */
export function fmtPlayedAt(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}, ${m[1]}, ${m[4]}:${m[5]}`;
}

/** "Oct 8, 2026" — the date part of fmtPlayedAt. */
export function fmtPlayedDate(iso: string): string {
  return fmtPlayedAt(iso).replace(/, \d{2}:\d{2}$/, "");
}

/** Short day and month of a timestamp in the viewer's time zone: "Oct 8". */
export function fmtShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(LOCALE, { day: "numeric", month: "short" });
}

export type AmountUnit = "chips" | "bb";

export function amountFormatter(unit: AmountUnit, bigBlind: number): (chips: number) => string {
  return unit === "bb" ? (c) => fmtBb(c / bigBlind) : fmtChips;
}
