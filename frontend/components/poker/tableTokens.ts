/**
 * Canonical formatting helpers for preflop-table BB amounts — the single copy
 * every table/seat component reads from, replacing the near-identical
 * `formatBb`/`fmtStack` copies that used to live inline in
 * `components/learn/visuals/PreflopTable.tsx` (moved here verbatim).
 */

export function formatBb(n: number): string {
  return n % 1 === 0 ? String(n) : n.toFixed(1).replace(/\.0$/, '')
}

export function formatAnte(anteBb: number): string {
  return formatBb(anteBb) === String(anteBb) ? String(anteBb) : anteBb.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')
}
