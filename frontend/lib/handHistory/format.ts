/** Dutch number and date formatting for the hand history pages. */

const chipsFmt = new Intl.NumberFormat("nl-NL", { maximumFractionDigits: 2 });
const bbFmt = new Intl.NumberFormat("nl-NL", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** 47892 → "47.892". */
export function fmtChips(n: number): string {
  return chipsFmt.format(n);
}

/** 21.56 → "21,6 BB". */
export function fmtBb(n: number): string {
  return `${bbFmt.format(n)} BB`;
}

/** Signed BB for results: "+12,3 BB" / "−4,0 BB". */
export function fmtSignedBb(n: number): string {
  if (Math.abs(n) < 0.05) return fmtBb(0);
  return `${n > 0 ? "+" : "−"}${fmtBb(Math.abs(n))}`;
}

export function fmtSignedChips(n: number): string {
  if (n === 0) return "0";
  return `${n > 0 ? "+" : "−"}${fmtChips(Math.abs(n))}`;
}

/** "2026-10-08T21:40:24" → "8 okt 2026, 21:40". The time is the site's local time — no zone conversion. */
export function fmtPlayedAt(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(iso);
  if (!m) return iso;
  const months = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
  return `${Number(m[3])} ${months[Number(m[2]) - 1]} ${m[1]}, ${m[4]}:${m[5]}`;
}

export type AmountUnit = "chips" | "bb";

export function amountFormatter(unit: AmountUnit, bigBlind: number): (chips: number) => string {
  return unit === "bb" ? (c) => fmtBb(c / bigBlind) : fmtChips;
}
