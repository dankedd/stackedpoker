import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  formatCountdown,
  handLimitReached,
  hasProAccess,
  parseEntitlements,
  trialEndingSoon,
  trialEndsLabel,
  uploadLimitReached,
} from "../entitlements";
import { amsterdamDay, guestHandsToday, nextAmsterdamMidnight, recordGuestDailyHand } from "../guestLimit";
import { keepLatestTournament, type ParseOutcome } from "@/lib/handHistory/importer";
import { ApiError, trainerLimitDetail } from "@/lib/ranges/api";

const RAW = {
  plan: "free",
  trial_ends_at: null,
  trial_ended: false,
  trial_ended_seen: false,
  subscription: { status: null, current_period_end: null, cancel_at_period_end: false, has_customer: false },
  limits: { trainer_hands_per_day: 50, tournaments_per_week: 1, ai_questions_per_day: 3 },
  usage: { trainer_hands_today: 32, ai_questions_today: 2, tournaments_this_week: 0 },
  daily_reset_at: "2026-10-13T22:00:00+00:00",
  next_upload_at: null,
  hidden_tournaments: 0,
};

const ent = (over: Record<string, unknown> = {}) => parseEntitlements({ ...RAW, ...over })!;

describe("parseEntitlements", () => {
  it("maps the database shape", () => {
    const e = ent();
    expect(e.plan).toBe("free");
    expect(e.limits).toEqual({ trainerHandsPerDay: 50, tournamentsPerWeek: 1, aiQuestionsPerDay: 3 });
    expect(e.usage).toEqual({ trainerHandsToday: 32, aiQuestionsToday: 2, tournamentsThisWeek: 0 });
    expect(e.dailyResetAt).toBe("2026-10-13T22:00:00+00:00");
  });

  it("null limits mean unlimited (Pro / trial)", () => {
    const e = ent({ plan: "trial", limits: { trainer_hands_per_day: null, tournaments_per_week: null, ai_questions_per_day: null } });
    expect(e.limits.trainerHandsPerDay).toBeNull();
    expect(hasProAccess(e)).toBe(true);
    expect(handLimitReached(ent({ plan: "trial", limits: { trainer_hands_per_day: null }, usage: { trainer_hands_today: 999 } }))).toBe(false);
  });

  it("an unknown plan value is treated as free, garbage as nothing", () => {
    expect(ent({ plan: "elite" }).plan).toBe("free");
    expect(parseEntitlements(null)).toBeNull();
    expect(parseEntitlements("pro")).toBeNull();
  });
});

describe("limit edges", () => {
  it("hands: 49 and 50 used vs limit 50", () => {
    expect(handLimitReached(ent({ usage: { trainer_hands_today: 49 } }))).toBe(false);
    expect(handLimitReached(ent({ usage: { trainer_hands_today: 50 } }))).toBe(true);
  });

  it("uploads: 0 and 1 used vs limit 1", () => {
    expect(uploadLimitReached(ent({ usage: { tournaments_this_week: 0 } }))).toBe(false);
    expect(uploadLimitReached(ent({ usage: { tournaments_this_week: 1 } }))).toBe(true);
    expect(uploadLimitReached(null)).toBe(false);
  });
});

describe("trial banner window", () => {
  const now = Date.parse("2026-10-13T12:00:00Z");
  const trial = (endsInHours: number) => ent({ plan: "trial", trial_ends_at: new Date(now + endsInHours * 3_600_000).toISOString() });

  it("shows only in the last 48 hours of the trial (day 6 and 7)", () => {
    expect(trialEndingSoon(trial(49), now)).toBe(false);
    expect(trialEndingSoon(trial(47), now)).toBe(true);
    expect(trialEndingSoon(trial(1), now)).toBe(true);
    expect(trialEndingSoon(trial(-1), now)).toBe(false);
    expect(trialEndingSoon(ent({ trial_ends_at: new Date(now + 3_600_000).toISOString() }), now)).toBe(false); // not on trial
  });

  it("says tomorrow on day 6, today on day 7", () => {
    expect(trialEndsLabel(new Date(now + 30 * 3_600_000).toISOString(), now)).toBe("tomorrow");
    expect(trialEndsLabel(new Date(now + 5 * 3_600_000).toISOString(), now)).toBe("today");
  });
});

describe("formatCountdown", () => {
  it("formats hours, minutes and seconds", () => {
    expect(formatCountdown(4 * 3_600_000 + 12 * 60_000 + 5_000)).toBe("4h 12m");
    expect(formatCountdown(12 * 60_000 + 5_000)).toBe("12m 05s");
    expect(formatCountdown(9_000)).toBe("9s");
    expect(formatCountdown(-5)).toBe("0s");
  });
});

describe("Amsterdam day for guests", () => {
  it("rolls over at 00:00 Amsterdam, not UTC", () => {
    expect(amsterdamDay(Date.parse("2026-10-13T21:59:59Z"))).toBe("2026-10-13");
    expect(amsterdamDay(Date.parse("2026-10-13T22:00:00Z"))).toBe("2026-10-14");
  });

  it("finds the next midnight in summer, winter and on the DST switch day", () => {
    expect(new Date(nextAmsterdamMidnight(Date.parse("2026-10-13T10:00:00Z"))).toISOString()).toBe("2026-10-13T22:00:00.000Z");
    expect(new Date(nextAmsterdamMidnight(Date.parse("2026-12-01T12:00:00Z"))).toISOString()).toBe("2026-12-01T23:00:00.000Z");
    expect(new Date(nextAmsterdamMidnight(Date.parse("2026-10-25T12:00:00Z"))).toISOString()).toBe("2026-10-25T23:00:00.000Z");
    expect(new Date(nextAmsterdamMidnight(Date.parse("2026-03-29T00:30:00Z"))).toISOString()).toBe("2026-03-29T22:00:00.000Z");
  });

  describe("daily count", () => {
    let store: Record<string, string>;
    beforeEach(() => {
      store = {};
      (globalThis as { window?: unknown }).window = {
        localStorage: {
          getItem: (k: string) => store[k] ?? null,
          setItem: (k: string, v: string) => void (store[k] = v),
        },
      };
    });
    afterEach(() => {
      delete (globalThis as { window?: unknown }).window;
    });

    it("counts per day and starts over on a new Amsterdam day", () => {
      const day1 = Date.parse("2026-10-13T21:00:00Z");
      for (let i = 0; i < 50; i++) recordGuestDailyHand(day1);
      expect(guestHandsToday(day1)).toBe(50);
      expect(guestHandsToday(Date.parse("2026-10-13T21:59:59Z"))).toBe(50);
      expect(guestHandsToday(Date.parse("2026-10-13T22:00:00Z"))).toBe(0);
      expect(recordGuestDailyHand(Date.parse("2026-10-13T22:00:01Z"))).toBe(1);
    });

    it("blocked storage counts nothing and never throws", () => {
      delete (globalThis as { window?: unknown }).window;
      expect(recordGuestDailyHand()).toBe(0);
      expect(guestHandsToday()).toBe(0);
    });
  });
});

describe("keepLatestTournament (Free: one tournament per upload)", () => {
  const hand = (tournamentId: string, playedAt: string, name = tournamentId) =>
    ({ hand: { site: "ggpoker", tournamentId, tournamentName: name, playedAt }, rawText: "", parser: {}, fileName: "f" }) as unknown as ParseOutcome["entries"][number];

  it("keeps the tournament whose last hand is the most recent", () => {
    const parsed: ParseOutcome = {
      entries: [hand("A", "2026-10-01T20:00:00"), hand("B", "2026-10-02T19:00:00", "Bounty Hunters"), hand("A", "2026-10-02T21:00:00"), hand("B", "2026-10-02T20:00:00")],
      failures: [],
      fileErrors: [],
      duplicatesInUpload: 0,
    };
    const out = keepLatestTournament(parsed);
    expect(out.skipped).toBe(1);
    expect(out.name).toBe("A");
    expect(out.parsed.entries.map((e) => e.hand.tournamentId)).toEqual(["A", "A"]);
  });

  it("leaves a single-tournament upload untouched", () => {
    const parsed: ParseOutcome = { entries: [hand("A", "2026-10-01T20:00:00")], failures: [], fileErrors: [], duplicatesInUpload: 0 };
    expect(keepLatestTournament(parsed)).toEqual({ parsed, skipped: 0, name: null });
  });
});

describe("trainerLimitDetail", () => {
  it("recognises the daily-limit 429 and nothing else", () => {
    const detail = { code: "TRAINER_DAILY_LIMIT_REACHED", used: 50, limit: 50, reset_at: "2026-10-13T22:00:00+00:00" };
    expect(trainerLimitDetail(new ApiError(429, detail))).toEqual(detail);
    expect(trainerLimitDetail(new ApiError(429, "Too many requests"))).toBeNull();
    expect(trainerLimitDetail(new ApiError(502, detail))).toBeNull();
    expect(trainerLimitDetail(new Error("x"))).toBeNull();
  });
});
