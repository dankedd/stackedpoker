/**
 * Card search for the hand list: text like "AQ, 55, AhQd" → one database filter.
 *
 *   "AQ"    any AQ          hero_hand IN (AQs, AQo)
 *   "AQs"   suited          hero_hand = AQs     ("AQo" offsuit)
 *   "55"    a pair          hero_hand = 55
 *   "AhQd"  exact cards     hero_cards contains {Ah, Qd}   (either order)
 *   "Ah"    one exact card  hero_cards contains {Ah}
 *
 * Terms are separated by commas and combine with OR. hero_hand is a generated
 * column (supabase_hand_history_cards.sql).
 */

const RANKS = "AKQJT98765432";
const SUITS = "shdc";

export type CardTerm =
  | { kind: "class"; value: string } // AQs, AQo, 55
  | { kind: "ranks"; value: string } // AQ (both suitednesses)
  | { kind: "cards"; value: string[] }; // ["Ah","Qd"] or ["Ah"]

const rankOf = (c: string) => RANKS.indexOf(c.toUpperCase());

function card(rank: string, suit: string): string {
  return rank.toUpperCase() + suit.toLowerCase();
}

/** Parses one term; null when it is not a card search. */
export function parseTerm(raw: string): CardTerm | null {
  const s = raw.trim().replace(/\s+/g, "");
  if (!s) return null;
  let m: RegExpMatchArray | null;

  if ((m = /^([2-9tjqka])([shdc])([2-9tjqka])([shdc])$/i.exec(s))) {
    const a = card(m[1], m[2]);
    const b = card(m[3], m[4]);
    if (a === b) return null;
    return { kind: "cards", value: rankOf(a[0]) <= rankOf(b[0]) ? [a, b] : [b, a] };
  }
  if ((m = /^([2-9tjqka])([shdc])$/i.exec(s))) return { kind: "cards", value: [card(m[1], m[2])] };

  if ((m = /^([2-9tjqka])([2-9tjqka])([so])?$/i.exec(s))) {
    let [r1, r2] = [m[1].toUpperCase(), m[2].toUpperCase()];
    if (rankOf(r2) < rankOf(r1)) [r1, r2] = [r2, r1];
    if (r1 === r2) return m[3] ? null : { kind: "class", value: r1 + r2 };
    return m[3] ? { kind: "class", value: r1 + r2 + m[3].toLowerCase() } : { kind: "ranks", value: r1 + r2 };
  }
  return null;
}

/** Canonical spelling of a term, as stored in the URL and shown on chips. */
export function termText(t: CardTerm): string {
  return t.kind === "cards" ? t.value.join("") : t.value;
}

/** Splits a query into recognised terms (deduplicated) and the parts it could not read. */
export function parseCardQuery(query: string): { terms: CardTerm[]; invalid: string[] } {
  const terms: CardTerm[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();
  for (const part of query.split(",")) {
    if (!part.trim()) continue;
    const t = parseTerm(part);
    if (!t) {
      invalid.push(part.trim());
      continue;
    }
    const key = termText(t);
    if (!seen.has(key)) {
      seen.add(key);
      terms.push(t);
    }
  }
  return { terms, invalid };
}

/** PostgREST `or` filter for a set of terms (OR between them). */
export function cardFilter(terms: CardTerm[]): string | null {
  const parts: string[] = [];
  const classes = new Set<string>();
  for (const t of terms) {
    if (t.kind === "class") classes.add(t.value);
    else if (t.kind === "ranks") {
      classes.add(`${t.value}s`);
      classes.add(`${t.value}o`);
    } else parts.push(`hero_cards.cs.{${t.value.join(",")}}`);
  }
  if (classes.size) parts.unshift(`hero_hand.in.(${[...classes].join(",")})`);
  return parts.length ? parts.join(",") : null;
}

export const CARD_RANKS = RANKS;
export const CARD_SUITS = SUITS;
