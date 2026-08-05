/**
 * Parses a number typed into an <input type="number">, tolerating a comma
 * decimal separator. The DOM's number input is supposed to canonicalize to
 * a period, but some browser/OS locale combinations (observed: Firefox on
 * a Dutch-language OS) accept and echo back a typed comma as-is via
 * onChange — plain Number("4,99") then silently returns NaN, and every
 * caller in this feature treated NaN the same as "field left blank",
 * silently discarding whatever the user typed instead of showing an error.
 * Only the first comma is replaced (decimal separator, not thousands
 * grouping) — these fields are always small dollar amounts or buy-in
 * counts, never typed with grouping separators.
 */
export function parseLocaleNumber(value: string): number {
  return Number(value.trim().replace(",", "."));
}
