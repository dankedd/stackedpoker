import { DEFENSE_CHARTS, OPEN_CHARTS, PUSH_FOLD_CHARTS } from "@/lib/ranges/data";
import { displayPos, newDeal, spotLabel, type Deal, type TrainerMode, type TrainerType } from "@/lib/ranges/logic";
import { trainerQuery } from "@/lib/ranges/urlState";

/**
 * Poker content for the lifecycle emails, built only from the trainer's own
 * chart data (data/ranges/*.json, read through lib/ranges). Nothing here
 * states a frequency or an answer: the teaser asks the question and the
 * trainer grades it.
 */

/** Small deterministic PRNG (mulberry32), so a user gets the same teaser if a run is retried. */
function rng(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface TeaserSpot {
  /** "BTN · 8bb · A5s" */
  headline: string;
  /** "Folded to you. Shove or fold?" */
  question: string;
  /** "BTN, 8bb, A5s — shove or fold?" for the subject line and preheader. */
  oneLine: string;
}

function teaserFrom(deal: Deal): TeaserSpot {
  const hero = displayPos(deal.hero);
  const stack = deal.fmt === "cash" ? `${deal.stack}bb cash` : `${deal.stack}bb`;
  const headline = `${hero} · ${stack} · ${deal.hand}`;
  if (deal.type === "def") {
    const before = spotLabel(deal);
    return { headline, question: `${before}. What's your play?`, oneLine: `${hero}, ${stack}, ${deal.hand} — ${before}.` };
  }
  if (deal.kind === "pf") {
    return { headline, question: "Folded to you. Shove or fold?", oneLine: `${hero}, ${stack}, ${deal.hand} — shove or fold?` };
  }
  return { headline, question: "Folded to you. Open or fold?", oneLine: `${hero}, ${stack}, ${deal.hand} — open or fold?` };
}

/** One real trainer spot, picked per user and day. Skips trivial folds like the trainer does. */
export function teaserSpot(seed: string): TeaserSpot {
  return teaserFrom(newDeal("mix", "all", true, rng(seed)));
}

export interface SpotInfo {
  /** "SB push/fold (≤10bb)" */
  label: string;
  /** Trainer query that drills this kind of spot, e.g. "?type=open&game=pf". */
  query: string;
}

/** Turns trainer_hand_log's "kind:chart_id" (weakest_ref) into a label and a trainer filter. */
export function spotInfo(ref: string | null): SpotInfo | null {
  if (!ref) return null;
  // Refs logged before chart ids existed carry a number; they resolve to nothing.
  const [kind, id] = ref.split(":");
  if (!id) return null;
  const q = (type: TrainerType, game: TrainerMode) => trainerQuery({ type, game, fewerFolds: true });

  if (kind === "pushfold") {
    const c = PUSH_FOLD_CHARTS.find((x) => x.id === id);
    return c ? { label: `${displayPos(c.pos)} push/fold (≤10bb)`, query: q("open", "pf") } : null;
  }
  if (kind === "open") {
    const c = OPEN_CHARTS.find((x) => x.id === id);
    return c
      ? { label: `${displayPos(c.pos)} open at ${c.stack}bb${c.group === "cash" ? " (cash)" : ""}`, query: q("open", c.group) }
      : null;
  }
  if (kind === "defense") {
    const c = DEFENSE_CHARTS.find((x) => x.id === id);
    if (!c) return null;
    const vs = { open: "open", push: "shove", limp: "limp", "4bet": "4-bet", lr: "limp-raise" }[c.spot];
    return {
      label: `${displayPos(c.hero)} vs ${displayPos(c.vil)} ${vs}${c.group === "cash" ? " (cash)" : ` at ${c.stack}bb`}`,
      query: q("def", c.group),
    };
  }
  return null;
}
