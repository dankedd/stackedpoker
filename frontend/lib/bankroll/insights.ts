import { formatCurrency } from "@/lib/utils";
import { computeSessionResult } from "./sessionForm";
import { groupSessionsBy, type SessionForStats } from "./stats";

/**
 * Minimum sessions before a comparison (best vs. worst stake, duration
 * bucket, time-of-day bucket) is surfaced as an insight or tip. Below this,
 * a single lucky/unlucky session could flip the "best"/"worst" label —
 * this threshold is this implementation's own reliability heuristic, not a
 * statistical or poker-theory standard.
 */
const MIN_SAMPLE_SIZE = 3;

// ── Stakes ───────────────────────────────────────────────────────────────

export interface StakeInsight {
  label: string;
  avgProfit: number;
  sessionCount: number;
}

export function computeStakeInsights(sessions: SessionForStats[]): { best: StakeInsight | null; worst: StakeInsight | null } {
  const eligible = groupSessionsBy(sessions, "stakes")
    .filter((g) => g.sessionCount >= MIN_SAMPLE_SIZE)
    .map((g) => ({ label: g.label, avgProfit: g.profit / g.sessionCount, sessionCount: g.sessionCount }));

  if (eligible.length === 0) return { best: null, worst: null };

  const sorted = [...eligible].sort((a, b) => b.avgProfit - a.avgProfit);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];
  return { best, worst: worst.label === best.label ? null : worst };
}

// ── Session duration ─────────────────────────────────────────────────────

interface DurationBucketDef {
  label: string;
  minMinutes: number;
  maxMinutes: number | null;
}

const DURATION_BUCKETS: DurationBucketDef[] = [
  { label: "Under 1h", minMinutes: 0, maxMinutes: 60 },
  { label: "1-2h", minMinutes: 60, maxMinutes: 120 },
  { label: "2-3h", minMinutes: 120, maxMinutes: 180 },
  { label: "3-4h", minMinutes: 180, maxMinutes: 240 },
  { label: "4h+", minMinutes: 240, maxMinutes: null },
];

function durationBucketFor(minutes: number): DurationBucketDef {
  return DURATION_BUCKETS.find((b) => minutes >= b.minMinutes && (b.maxMinutes == null || minutes < b.maxMinutes)) ?? DURATION_BUCKETS[DURATION_BUCKETS.length - 1];
}

export interface DurationInsight {
  label: string;
  avgProfit: number;
  avgProfitPerHour: number;
  sessionCount: number;
}

export function computeDurationInsight(sessions: SessionForStats[]): { best: DurationInsight | null } {
  const settled = sessions.filter((s) => s.cash_out_amount != null && s.duration_minutes != null);
  const buckets = new Map<string, { profit: number; hours: number; count: number }>();

  for (const session of settled) {
    const bucket = durationBucketFor(session.duration_minutes!);
    const entry = buckets.get(bucket.label) ?? { profit: 0, hours: 0, count: 0 };
    entry.profit += computeSessionResult(session);
    entry.hours += session.duration_minutes! / 60;
    entry.count += 1;
    buckets.set(bucket.label, entry);
  }

  const candidates: DurationInsight[] = [];
  for (const [label, { profit, hours, count }] of buckets) {
    if (count < MIN_SAMPLE_SIZE) continue;
    candidates.push({ label, avgProfit: profit / count, avgProfitPerHour: hours > 0 ? profit / hours : 0, sessionCount: count });
  }
  if (candidates.length === 0) return { best: null };

  candidates.sort((a, b) => b.avgProfitPerHour - a.avgProfitPerHour);
  return { best: candidates[0] };
}

// ── Time of day ──────────────────────────────────────────────────────────

interface TimeOfDayBucketDef {
  label: string;
  startHour: number;
  endHour: number;
}

const TIME_OF_DAY_BUCKETS: TimeOfDayBucketDef[] = [
  { label: "Night (12am-6am)", startHour: 0, endHour: 6 },
  { label: "Morning (6am-12pm)", startHour: 6, endHour: 12 },
  { label: "Afternoon (12pm-6pm)", startHour: 12, endHour: 18 },
  { label: "Evening (6pm-12am)", startHour: 18, endHour: 24 },
];

function timeOfDayFor(hour: number): TimeOfDayBucketDef {
  return TIME_OF_DAY_BUCKETS.find((b) => hour >= b.startHour && hour < b.endHour) ?? TIME_OF_DAY_BUCKETS[0];
}

export interface TimeOfDayInsight {
  label: string;
  avgProfit: number;
  sessionCount: number;
  winRate: number;
}

/** Every time-of-day bucket with at least one session, in chronological (Night→Evening) order — the full "results per time slot" picture, unfiltered by sample size. */
export function computeTimeOfDayBreakdown(sessions: SessionForStats[]): TimeOfDayInsight[] {
  const settled = sessions.filter((s) => s.cash_out_amount != null);
  const buckets = new Map<string, SessionForStats[]>();

  for (const session of settled) {
    const bucket = timeOfDayFor(new Date(session.started_at).getHours());
    const arr = buckets.get(bucket.label) ?? [];
    arr.push(session);
    buckets.set(bucket.label, arr);
  }

  return TIME_OF_DAY_BUCKETS.filter((b) => buckets.has(b.label)).map((b) => {
    const group = buckets.get(b.label)!;
    const results = group.map(computeSessionResult);
    const profit = results.reduce((sum, r) => sum + r, 0);
    const wins = results.filter((r) => r >= 0).length;
    return { label: b.label, avgProfit: profit / group.length, sessionCount: group.length, winRate: (wins / group.length) * 100 };
  });
}

/** Best/worst time-of-day bucket, filtered to a reliable sample size — used for the coach's tips, distinct from the full breakdown shown on the page. */
export function bestAndWorstTimeOfDay(breakdown: TimeOfDayInsight[]): { best: TimeOfDayInsight | null; worst: TimeOfDayInsight | null } {
  const eligible = breakdown.filter((b) => b.sessionCount >= MIN_SAMPLE_SIZE);
  if (eligible.length === 0) return { best: null, worst: null };

  const sorted = [...eligible].sort((a, b) => b.avgProfit - a.avgProfit);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];
  return { best, worst: worst.label === best.label ? null : worst };
}

// ── Volume, ROI, bankroll growth ────────────────────────────────────────

export interface VolumeInsight {
  sessionCount: number;
  totalHours: number;
  totalHands: number;
}

export function computeVolumeInsight(sessions: SessionForStats[]): VolumeInsight {
  const settled = sessions.filter((s) => s.cash_out_amount != null);
  return {
    sessionCount: settled.length,
    totalHours: settled.reduce((sum, s) => sum + (s.duration_minutes ?? 0), 0) / 60,
    totalHands: settled.reduce((sum, s) => sum + (s.hands_played ?? 0), 0),
  };
}

/** Profit relative to total deposits — same definition as /bankroll and /bankroll/stats (see stats.ts), for consistency across the app. */
export function computeRoi(profit: number, totalDeposits: number): number | null {
  return totalDeposits > 0 ? (profit / totalDeposits) * 100 : null;
}

export interface BankrollGrowthInsight {
  growthAmount: number;
  growthPercent: number | null;
  perDay: number;
}

export function computeBankrollGrowth(currentBankroll: number, startingBankroll: number, daysElapsed: number): BankrollGrowthInsight {
  const growthAmount = currentBankroll - startingBankroll;
  return {
    growthAmount,
    growthPercent: startingBankroll > 0 ? (growthAmount / startingBankroll) * 100 : null,
    perDay: daysElapsed > 0 ? growthAmount / daysElapsed : 0,
  };
}

// ── Concrete tips ────────────────────────────────────────────────────────

export interface InsightsBundle {
  stakes: { best: StakeInsight | null; worst: StakeInsight | null };
  duration: { best: DurationInsight | null };
  timeOfDay: { best: TimeOfDayInsight | null; worst: TimeOfDayInsight | null };
  volume: VolumeInsight;
  roi: number | null;
  growth: BankrollGrowthInsight;
  currency: string;
}

export type InsightTone = "positive" | "warning" | "neutral";

export interface InsightTip {
  id: string;
  tone: InsightTone;
  /** May contain **bold** markdown-lite spans, same convention as components/poker/CoachingCard.tsx's renderer. */
  text: string;
}

/**
 * Every tip is a direct readout of the bundle's own computed numbers — no
 * generic poker-strategy advice is generated here. This is a data/behavior
 * coach (stake selection, session length, schedule, bankroll trend), not a
 * GTO coach, so nothing here needs a Modern Poker Theory citation.
 */
export function generateInsightTips(bundle: InsightsBundle): InsightTip[] {
  const { stakes, duration, timeOfDay, volume, roi, growth, currency } = bundle;
  const fmt = (n: number) => formatCurrency(n, currency);
  const tips: InsightTip[] = [];

  if (volume.sessionCount < MIN_SAMPLE_SIZE) {
    tips.push({
      id: "not-enough-data",
      tone: "neutral",
      text: `You've logged **${volume.sessionCount}** session${volume.sessionCount === 1 ? "" : "s"} so far — insights get sharper with more volume. Log a few more before leaning too hard on any single comparison below.`,
    });
  }

  if (stakes.best && stakes.worst) {
    tips.push({
      id: "stake-comparison",
      tone: stakes.worst.avgProfit < 0 ? "warning" : "positive",
      text: `You average **${fmt(stakes.best.avgProfit)}** per session at **${stakes.best.label}** (${stakes.best.sessionCount} sessions), versus **${fmt(stakes.worst.avgProfit)}** at **${stakes.worst.label}** (${stakes.worst.sessionCount} sessions). Consider weighting more volume toward ${stakes.best.label}.`,
    });
  }

  if (duration.best) {
    tips.push({
      id: "duration",
      tone: duration.best.avgProfitPerHour >= 0 ? "positive" : "warning",
      text: `Your best results come from **${duration.best.label}** sessions, averaging **${fmt(duration.best.avgProfitPerHour)}/hour** over ${duration.best.sessionCount} sessions. Worth keeping that session length in mind next time you sit down.`,
    });
  }

  if (timeOfDay.best && timeOfDay.worst) {
    tips.push({
      id: "time-of-day",
      tone: timeOfDay.worst.avgProfit < 0 ? "warning" : "neutral",
      text: `You do best during the **${timeOfDay.best.label}** (${fmt(timeOfDay.best.avgProfit)}/session avg) and weakest during the **${timeOfDay.worst.label}** (${fmt(timeOfDay.worst.avgProfit)}/session avg). If fatigue or distractions play a role at that time, it may be worth shifting your schedule.`,
    });
  }

  if (roi != null) {
    tips.push({
      id: "roi",
      tone: roi >= 0 ? "positive" : "warning",
      text: roi >= 0
        ? `Your ROI is **${roi.toFixed(1)}%** relative to what you've deposited. Keep logging sessions to see if that holds up over more volume.`
        : `Your ROI is **${roi.toFixed(1)}%** relative to what you've deposited — you're currently down. Not unusual over a small sample, but worth monitoring.`,
    });
  }

  if (growth.growthPercent != null) {
    tips.push({
      id: "growth",
      tone: growth.growthAmount >= 0 ? "positive" : "warning",
      text: growth.growthAmount >= 0
        ? `Your bankroll has grown **${fmt(growth.growthAmount)}** (**${growth.growthPercent.toFixed(1)}%**) since you started tracking.`
        : `Your bankroll is down **${fmt(Math.abs(growth.growthAmount))}** (**${growth.growthPercent.toFixed(1)}%**) since you started tracking — the stake and session-length breakdowns above may point to why.`,
    });
  }

  return tips;
}
