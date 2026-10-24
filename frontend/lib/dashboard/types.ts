/**
 * my_dashboard() (supabase/migrations/20261025_05_dashboard.sql), parsed.
 * Raw counts only; lib/dashboard/model.ts turns them into what the blocks say.
 */

/** [answers, good answers] */
export type Tally = [number, number];

export interface LastTournament {
  id: string;
  name: string | null;
  site: string;
  createdAt: string;
  handCount: number;
  reviewed: boolean;
  mistakes: number;
  score: number | null;
}

export interface Leak {
  handId: string;
  tournamentId: string | null;
  playedAt: string;
  /** "AQo", null when Hero's cards are unknown. */
  hand: string | null;
  position: string | null;
  street: "preflop" | "flop";
  verdict: string;
  /** "open:open_mtt_lj_25" — the chart the preflop check used. */
  chart: string | null;
  board: string[];
  potBb: number;
}

export interface Skill {
  days: number;
  preflop: Partial<Record<"open" | "defense" | "pushfold", Tally>>;
  /** [kind:chart, hands, wrong], worst wrong rate first. */
  preflopSpots: [string, number, number][];
  flop: { n: number; good: number; categories: Record<string, Tally> };
  /** This 7 days, the 7 before. Both trainers. */
  week: [Tally, Tally];
}

export interface SocialCard {
  id: string | null;
  handle: string | null;
  name: string;
  deleted: boolean;
}

export interface MyShare {
  slug: string;
  question: string | null;
  guessMode: boolean;
  createdAt: string;
  views: number;
  votes: number;
  /** Most picked choice and its votes. */
  top: [string, number] | null;
  heroCards: string[] | null;
}

export type FeedItem =
  | {
      kind: "share";
      at: string;
      actor: SocialCard;
      slug: string;
      question: string | null;
      guessMode: boolean;
      options: string[] | null;
      myChoice: string | null;
      votes: number;
    }
  | { kind: "streak"; at: string; actor: SocialCard; streak: number };

/**
 * Phases 4–6 (groups, forum, growth) fill these in with their own RPCs; until
 * then they are absent and the blocks stay off (lib/features.ts SOCIAL_PHASES).
 */
export interface Community {
  handOfWeek?: { slug: string; question: string | null; options: string[]; myChoice: string | null; votes: number } | null;
  groups?: { id: string; name: string; rank: number | null; members: number; weeklyHand: string | null }[];
  challenges?: { id: string; title: string; endsAt: string; progress: number; goal: number }[];
}

export interface Social {
  friends: number;
  requests: SocialCard[];
  /** Unread notifications by type. */
  unread: Record<string, number>;
  shares: MyShare[];
  feed: FeedItem[];
  community?: Community;
}

export interface DashboardData {
  hands: { imported: number; tournaments: number };
  lastTournament: LastTournament | null;
  leaks: Leak[];
  skill: Skill;
  /** null before the social migrations have run. */
  social: Social | null;
}

// ── Parsing ─────────────────────────────────────────────────────────────────

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0);
const str = (v: unknown): string | null => (typeof v === "string" ? v : null);
const tally = (v: unknown): Tally | undefined => (Array.isArray(v) && v.length >= 2 ? [num(v[0]), num(v[1])] : undefined);

function card(v: unknown): SocialCard {
  const c = obj(v);
  return { id: str(c.id), handle: str(c.handle), name: str(c.name) ?? "[deleted user]", deleted: c.deleted === true };
}

function feedItem(v: unknown): FeedItem | null {
  const f = obj(v);
  if (f.kind === "share" && str(f.slug)) {
    return {
      kind: "share",
      at: str(f.at) ?? "",
      actor: card(f.actor),
      slug: str(f.slug)!,
      question: str(f.question),
      guessMode: f.guess_mode === true,
      options: Array.isArray(f.options) ? f.options.filter((o): o is string => typeof o === "string") : null,
      myChoice: str(f.my_choice),
      votes: num(f.votes),
    };
  }
  if (f.kind === "streak") return { kind: "streak", at: str(f.at) ?? "", actor: card(f.actor), streak: num(f.streak) };
  return null;
}

function parseSocial(v: unknown): Social | null {
  if (!v || typeof v !== "object") return null;
  const s = obj(v);
  return {
    friends: num(s.friends),
    requests: arr(s.requests).map(card),
    unread: Object.fromEntries(Object.entries(obj(s.unread)).map(([k, n]) => [k, num(n)])),
    shares: arr(s.shares).map((x) => {
      const m = obj(x);
      const top = Array.isArray(m.top) && typeof m.top[0] === "string" ? ([m.top[0], num(m.top[1])] as [string, number]) : null;
      return {
        slug: str(m.slug) ?? "",
        question: str(m.question),
        guessMode: m.guess_mode === true,
        createdAt: str(m.created_at) ?? "",
        views: num(m.views),
        votes: num(m.votes),
        top,
        heroCards: Array.isArray(m.hero_cards) ? m.hero_cards.filter((c): c is string => typeof c === "string") : null,
      };
    }),
    feed: arr(s.feed)
      .map(feedItem)
      .filter((x): x is FeedItem => x !== null)
      .sort((a, b) => b.at.localeCompare(a.at)),
    community: s.community && typeof s.community === "object" ? (s.community as Community) : undefined,
  };
}

export function parseDashboard(raw: unknown): DashboardData | null {
  if (!raw || typeof raw !== "object") return null;
  const d = obj(raw);
  const hands = obj(d.hands);
  const lt = d.last_tournament && typeof d.last_tournament === "object" ? obj(d.last_tournament) : null;
  const sk = obj(d.skill);
  const flop = obj(sk.flop);
  const pre = obj(sk.preflop);
  const week = arr(sk.week);
  return {
    hands: { imported: num(hands.imported), tournaments: num(hands.tournaments) },
    lastTournament: lt
      ? {
          id: str(lt.id) ?? "",
          name: str(lt.name),
          site: str(lt.site) ?? "",
          createdAt: str(lt.created_at) ?? "",
          handCount: num(lt.hand_count),
          reviewed: lt.reviewed === true,
          mistakes: num(lt.mistakes),
          score: lt.score == null ? null : num(lt.score),
        }
      : null,
    leaks: arr(d.leaks).map((x) => {
      const l = obj(x);
      return {
        handId: str(l.hand_id) ?? "",
        tournamentId: str(l.tournament_id),
        playedAt: str(l.played_at) ?? "",
        hand: str(l.hand),
        position: str(l.position),
        street: l.street === "flop" ? "flop" : "preflop",
        verdict: str(l.verdict) ?? "",
        chart: str(l.chart),
        board: arr(l.board).filter((c): c is string => typeof c === "string"),
        potBb: num(l.pot_bb),
      };
    }),
    skill: {
      days: num(sk.days) || 30,
      preflop: Object.fromEntries(
        (["open", "defense", "pushfold"] as const).flatMap((k) => {
          const t = tally(pre[k]);
          return t ? [[k, t]] : [];
        }),
      ),
      preflopSpots: arr(sk.preflop_spots)
        .filter((x): x is unknown[] => Array.isArray(x) && typeof x[0] === "string")
        .map((x) => [x[0] as string, num(x[1]), num(x[2])]),
      flop: {
        n: num(flop.n),
        good: num(flop.good),
        categories: Object.fromEntries(
          Object.entries(obj(flop.categories)).flatMap(([k, v]) => {
            const t = tally(v);
            return t ? [[k, t]] : [];
          }),
        ),
      },
      week: [tally(week[0]) ?? [0, 0], tally(week[1]) ?? [0, 0]],
    },
    social: parseSocial(d.social),
  };
}

/** my_streak() — the same shape hooks/useStreak.ts reads (that module is client-only). */
export function parseStreakRow(raw: unknown): { streak: number; activeToday: boolean } | null {
  const r = obj(raw);
  return typeof r.streak === "number" ? { streak: r.streak, activeToday: r.active_today === true } : null;
}
