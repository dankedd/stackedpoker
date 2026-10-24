/**
 * Skill card, leak cards and the footer line, from my_dashboard() counts.
 * Server-side: spotInfo() reads the trainer's chart data.
 */

import type { Entitlements } from "@/lib/billing/entitlements";
import { CATEGORY_LABEL, type Category } from "@/lib/flopTrainer/logic";
import { FLOP_TRAINER_PATH } from "@/lib/flopTrainer/feature";
import { spotInfo } from "@/lib/lifecycle/spots";
import { PREFLOP_TRAINER_PATH } from "@/lib/ranges/feature";
import { DASHBOARD_CONFIG } from "./config";
import { DASH } from "./strings";
import type { Leak, Skill, Tally } from "./types";

const pct = ([n, good]: Tally) => (n > 0 ? Math.round((100 * good) / n) : 0);
const sum = (ts: Tally[]): Tally => ts.reduce<Tally>((a, t) => [a[0] + t[0], a[1] + t[1]], [0, 0]);

// ── Board texture ───────────────────────────────────────────────────────────

const RANKS = "23456789TJQKA";

/**
 * The flop trainer's texture category for a flop given as cards ("Kh",
 * "7c", "2d") — the same rules as textureCategory() in lib/flopTrainer/logic.ts
 * (paired, monotone, then the highest card, then whether a straight is
 * possible), which works on the database's texture tags instead.
 */
export function boardCategory(board: string[]): Category | null {
  const flop = board.slice(0, 3);
  if (flop.length < 3) return null;
  const ranks = flop.map((c) => RANKS.indexOf(c[0]?.toUpperCase() ?? ""));
  if (ranks.some((r) => r < 0)) return null;
  if (new Set(ranks).size < 3) return "paired";
  if (new Set(flop.map((c) => c[1]?.toLowerCase())).size === 1) return "monotone";
  const high = RANKS[Math.max(...ranks)];
  if (high === "A") return "ace_high";
  if (high === "K") return "king_high";
  if (high === "Q" || high === "J") return "high";
  // Ten-high or lower: a straight is possible when the three ranks fit in five.
  return Math.max(...ranks) - Math.min(...ranks) <= 4 ? "connected" : "low_dry";
}

const flopHref = (category: Category | null, cbet = false) => {
  const q = [cbet ? "cbet=1" : null, category ? `focus=${category}` : null].filter(Boolean).join("&");
  return q ? `${FLOP_TRAINER_PATH}?${q}` : FLOP_TRAINER_PATH;
};

// ── Skill ───────────────────────────────────────────────────────────────────

export interface SkillView {
  days: number;
  /** Nothing reaches a minimum: show "Not enough hands yet". */
  enough: boolean;
  /** Answers still needed before the first percentage shows. */
  needed: number;
  preflop: { pct: number | null; n: number; kinds: { key: string; label: string; pct: number | null; n: number }[] };
  flop: { pct: number | null; n: number };
  weakestTexture: { label: string; pct: number } | null;
  trend: { dir: "up" | "down" | "steady"; points: number } | null;
  weakest: { label: string; href: string } | null;
}

export function skillView(s: Skill): SkillView {
  const m = DASHBOARD_CONFIG.min;
  const kinds = (["open", "defense", "pushfold"] as const).map((key) => {
    const t = s.preflop[key] ?? [0, 0];
    return { key, label: DASH.skill.kinds[key], n: t[0], pct: t[0] >= m.preflopKind ? pct(t) : null };
  });
  const pre = sum(Object.values(s.preflop));
  const preflop = { pct: pre[0] >= m.preflop ? pct(pre) : null, n: pre[0], kinds };
  const flopT: Tally = [s.flop.n, s.flop.good];
  const flop = { pct: flopT[0] >= m.flop ? pct(flopT) : null, n: flopT[0] };

  // Weakest texture: lowest good rate among textures with enough answers (at least two to compare).
  const cats = (Object.entries(s.flop.categories) as [string, Tally][])
    .filter(([c, t]) => c in CATEGORY_LABEL && t[0] >= m.flopCategory)
    .sort((a, b) => pct(a[1]) - pct(b[1]) || b[1][0] - a[1][0]);
  const worstCat = cats.length >= 2 ? (cats[0] as [Category, Tally]) : null;

  // Weakest preflop chart the trainer can still name.
  const worstSpot = s.preflopSpots
    .filter(([, n]) => n >= m.preflopSpot)
    .map(([ref, n, wrong]) => ({ info: spotInfo(ref), wrongPct: Math.round((100 * wrong) / n) }))
    .find((x) => x.info);

  // Train button: the bigger error rate of the two.
  const flopMiss = worstCat ? 100 - pct(worstCat[1]) : -1;
  const preMiss = worstSpot ? worstSpot.wrongPct : -1;
  const weakest =
    preMiss < 0 && flopMiss < 0
      ? null
      : preMiss >= flopMiss
        ? { label: worstSpot!.info!.label, href: `${PREFLOP_TRAINER_PATH}${worstSpot!.info!.query}` }
        : { label: CATEGORY_LABEL[worstCat![0]], href: flopHref(worstCat![0]) };

  const [thisWeek, lastWeek] = s.week;
  const trend =
    thisWeek[0] >= m.week && lastWeek[0] >= m.week
      ? (() => {
          const d = pct(thisWeek) - pct(lastWeek);
          return Math.abs(d) < DASHBOARD_CONFIG.trendSteadyPoints
            ? { dir: "steady" as const, points: 0 }
            : { dir: d > 0 ? ("up" as const) : ("down" as const), points: Math.abs(d) };
        })()
      : null;

  return {
    days: s.days,
    enough: preflop.pct !== null || flop.pct !== null,
    needed: Math.max(0, Math.min(m.preflop - pre[0], m.flop - flopT[0])),
    preflop,
    flop,
    weakestTexture: worstCat ? { label: CATEGORY_LABEL[worstCat[0]], pct: pct(worstCat[1]) } : null,
    trend,
    weakest,
  };
}

// ── Leaks ───────────────────────────────────────────────────────────────────

const SUITS: Record<string, string> = { s: "♠", h: "♥", d: "♦", c: "♣" };
export const prettyCards = (cards: string[]) => cards.map((c) => `${c[0]}${SUITS[c[1]?.toLowerCase()] ?? c.slice(1)}`).join(" ");

export interface LeakView {
  handId: string;
  href: string;
  /** "A9o · LJ" */
  title: string;
  /** "LJ open at 25bb", "Flop K♥ 7♣ 2♦" */
  spot: string;
  verdict: string;
  street: "preflop" | "flop";
  trainHref: string;
}

export function leakView(l: Leak): LeakView {
  const title = [l.hand, l.position].filter(Boolean).join(" · ") || DASH.leaks.unknownSpot;
  if (l.street === "flop") {
    return {
      handId: l.handId,
      href: `/hands/${l.handId}`,
      title,
      spot: DASH.leaks.flopSpot(prettyCards(l.board.slice(0, 3))),
      verdict: DASH.leaks.flopVerdict,
      street: "flop",
      trainHref: flopHref(boardCategory(l.board), true),
    };
  }
  const info = spotInfo(l.chart);
  return {
    handId: l.handId,
    href: `/hands/${l.handId}`,
    title,
    spot: info?.label ?? DASH.leaks.unknownSpot,
    verdict: DASH.leaks.preflopVerdict[l.verdict] ?? l.verdict,
    street: "preflop",
    trainHref: `${PREFLOP_TRAINER_PATH}${info?.query ?? ""}`,
  };
}

// ── Footer ──────────────────────────────────────────────────────────────────

/** "24 Nov" */
export const shortDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Europe/Amsterdam" });

export interface PlanLine {
  label: string;
  detail: string | null;
  action: "upgrade" | "manage" | null;
}

export function planLine(e: Entitlements | null): PlanLine | null {
  if (!e) return null;
  const f = DASH.footer;
  if (e.plan === "free") {
    const limit = e.limits.tournamentsPerWeek;
    return { label: f.free, detail: limit !== null ? f.tournamentsThisWeek(Math.min(e.usage.tournamentsThisWeek, limit), limit) : null, action: "upgrade" };
  }
  if (e.plan === "trial") {
    return { label: f.trial, detail: e.trialEndsAt ? f.ends(shortDate(e.trialEndsAt)) : null, action: "upgrade" };
  }
  const end = e.subscription.currentPeriodEnd;
  return {
    label: f.pro,
    detail: end ? (e.subscription.cancelAtPeriodEnd ? f.ends(shortDate(end)) : f.renews(shortDate(end))) : null,
    action: e.subscription.hasCustomer ? "manage" : null,
  };
}
