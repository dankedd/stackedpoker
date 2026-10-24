import { describe, expect, it } from "vitest";
import type { PreflopDetail, PreflopVerdict } from "../../preflop";
import type { FlopVerdict } from "../../flopCheck";
import { SUMMARY_CONFIG } from "../config";
import {
  SUMMARY_VERSION,
  assessHand,
  bigHands,
  computeScore,
  computeSummary,
  flopRecommendation,
  isSummaryCurrent,
  preflopGap,
  scoreLabel,
  type SummarySourceRow,
} from "../compute";

let n = 0;

/** A hand row; preflop/flop only when given. */
function row(over: Partial<SummarySourceRow> = {}): SummarySourceRow {
  n++;
  return {
    id: `h${n}`,
    played_at: "2026-10-08T20:00:00",
    hero_cards: ["As", "Kd"],
    hero_position: "CO",
    pot_bb: 3,
    hero_involved: true,
    preflop_check: null,
    preflop_detail: null,
    flop_check: null,
    flop_detail: null,
    ...over,
  };
}

function pre(
  verdict: PreflopVerdict,
  action: "fold" | "call" | "raise" | "allin" | "limp",
  freqs: PreflopDetail["freqs"],
  expected: PreflopDetail["expected"],
  over: Partial<SummarySourceRow> = {},
): SummarySourceRow {
  const detail = {
    spot: { kind: "rfi", tablePosition: "CO", playersBehind: 3, effStackBb: 25, hand: "AKo", action },
    range: { kind: "open", position: "CO", bucket: 25, chart: "open_mtt_co_25" },
    freqs,
    expected,
  } as PreflopDetail;
  return row({ preflop_check: verdict, preflop_detail: detail, ...over });
}

function flop(verdict: FlopVerdict, kind: string, over: Partial<SummarySourceRow> = {}, advice?: unknown): SummarySourceRow {
  return row({
    flop_check: verdict,
    flop_detail: { verdict, line: { kind, eventIndex: 5, betPct: 33 }, ...(advice ? { advice } : {}) } as SummarySourceRow["flop_detail"],
    ...over,
  });
}

const correct = () => pre("correct", "raise", { raise: 1, fold: 0 }, "raise");

describe("preflopGap", () => {
  it("is the recommended frequency minus Hero's", () => {
    expect(preflopGap(pre("too_tight", "fold", { raise: 1, fold: 0 }, "raise").preflop_detail!)).toBe(1);
    expect(preflopGap(pre("too_loose", "raise", { raise: 0.05, fold: 0.95 }, "fold").preflop_detail!)).toBeCloseTo(0.9);
    expect(preflopGap(pre("wrong_action", "call", { raise: 0.6, call: 0.08, fold: 0.32 }, "raise").preflop_detail!)).toBeCloseTo(0.52);
  });

  it("uses the graded chart action when it differs from Hero's", () => {
    const r = pre("too_loose", "raise", { allin: 0.02, fold: 0.98 }, "fold");
    r.preflop_detail!.graded = "allin";
    expect(preflopGap(r.preflop_detail!)).toBeCloseTo(0.96);
  });
});

describe("assessHand", () => {
  it("does not grade hands without a usable verdict", () => {
    expect(assessHand(row()).graded).toBe(false);
    expect(assessHand(pre("not_evaluated", "raise", null, null)).graded).toBe(false);
    expect(assessHand(flop("not_evaluated", "lead")).graded).toBe(false);
  });

  it("splits small and big mistakes on the configured gap", () => {
    expect(assessHand(pre("too_tight", "fold", { raise: 1 }, "raise")).mistake).toBe("big");
    expect(assessHand(pre("too_tight", "fold", { raise: 0.7, fold: 0.05 }, "raise")).mistake).toBe("small");
    expect(assessHand(flop("questionable", "call")).mistake).toBe("small");
    expect(assessHand(pre("mixed", "call", { raise: 0.6, call: 0.4 }, "raise")).mistake).toBeNull();
  });

  it("takes the larger penalty when preflop and flop are both graded", () => {
    const r = pre("too_loose", "raise", { raise: 0.05, fold: 0.95 }, "fold", {
      flop_check: "questionable",
      flop_detail: { line: { kind: "call", eventIndex: 1 } } as SummarySourceRow["flop_detail"],
    });
    expect(assessHand(r).penalty).toBeCloseTo(0.9);
  });
});

describe("computeScore", () => {
  it("is null below the minimum sample", () => {
    expect(computeScore(Array(SUMMARY_CONFIG.score.minGradedHands - 1).fill(0))).toBeNull();
  });

  it("is 100 for a clean tournament and weights mistakes by size", () => {
    expect(computeScore(Array(20).fill(0))).toBe(100);
    // One full-size mistake in 20 hands → 95; one half-size → 98 (97.5 rounded).
    expect(computeScore([1, ...Array(19).fill(0)])).toBe(95);
    expect(computeScore([0.5, ...Array(19).fill(0)])).toBe(98);
  });

  it("stays within 0–100", () => {
    expect(computeScore(Array(10).fill(1))).toBe(0);
  });

  it("labels scores by the configured thresholds", () => {
    expect(scoreLabel(100)).toBe("solid");
    expect(scoreLabel(95)).toBe("solid");
    expect(scoreLabel(92)).toBe("decent");
    expect(scoreLabel(85)).toBe("leaky");
    expect(scoreLabel(10)).toBe("puntProne");
  });
});

describe("filters", () => {
  it("tight: too_tight, a less aggressive wrong action, and questionable flop folds/checks", () => {
    expect(assessHand(pre("too_tight", "fold", { raise: 1 }, "raise")).tight).toBe(true);
    expect(assessHand(pre("wrong_action", "call", { raise: 0.9, call: 0.02, fold: 0.08 }, "raise")).tight).toBe(true);
    expect(assessHand(flop("questionable", "fold")).tight).toBe(true);
    expect(assessHand(flop("questionable", "check")).tight).toBe(true);
    expect(assessHand(pre("too_loose", "raise", { fold: 1 }, "fold")).tight).toBe(false);
    expect(assessHand(flop("good", "fold")).tight).toBe(false);
  });

  it("loose: too_loose, a more aggressive wrong action, and questionable flop calls/bets", () => {
    expect(assessHand(pre("too_loose", "raise", { fold: 1 }, "fold")).loose).toBe(true);
    expect(assessHand(pre("wrong_action", "allin", { call: 0.9, allin: 0.01, fold: 0.09 }, "call")).loose).toBe(true);
    expect(assessHand(flop("questionable", "call")).loose).toBe(true);
    expect(assessHand(flop("questionable", "cbet")).loose).toBe(true);
    expect(assessHand(pre("too_tight", "fold", { raise: 1 }, "raise")).loose).toBe(false);
  });

  it("mixed: at least two chart actions above the minimum frequency, preflop or on a reference flop", () => {
    expect(assessHand(pre("mixed", "call", { raise: 0.6, call: 0.4 }, "raise")).mixed).toBe(true);
    expect(assessHand(pre("correct", "raise", { raise: 0.55, fold: 0.45 }, "raise")).mixed).toBe(true);
    expect(assessHand(pre("correct", "raise", { raise: 0.95, fold: 0.05 }, "raise")).mixed).toBe(false);
    // Not graded hands are never mixed.
    expect(assessHand(pre("not_evaluated", "raise", { raise: 0.5, fold: 0.5 }, null)).mixed).toBe(false);
    const ref = { strategy: { bet_1_3: 45, bet_2_3: 0, check: 55 } };
    expect(assessHand(flop("good", "check", {}, ref)).mixed).toBe(true);
    expect(assessHand(flop("good", "check", {}, { strategy: { bet_1_3: 5, check: 95 } })).mixed).toBe(false);
  });

  it("big: pots at the threshold, plus the top share of Hero's pots", () => {
    const rows = [
      ...Array.from({ length: 18 }, (_, i) => row({ id: `s${i}`, pot_bb: 2 + i * 0.1 })),
      row({ id: "mid", pot_bb: 8 }),
      row({ id: "huge", pot_bb: 40 }),
      row({ id: "edge", pot_bb: SUMMARY_CONFIG.filters.big.minPotBb }),
      row({ id: "notMine", pot_bb: 90, hero_involved: false }),
    ];
    // 21 eligible hands → top 3 by pot (huge, edge, mid); edge also passes the bb threshold.
    expect(bigHands(rows)).toEqual(["huge", "edge", "mid"]);
  });
});

describe("computeSummary", () => {
  it("counts mistakes against graded hands and sorts misplayed hands biggest first", () => {
    const small = pre("too_tight", "fold", { raise: 0.7, fold: 0.05 }, "raise", { id: "small", pot_bb: 30 });
    const big = pre("too_loose", "raise", { fold: 1 }, "fold", { id: "big", pot_bb: 2 });
    const flopMiss = flop("questionable", "call", { id: "flop", pot_bb: 12 });
    const rows = [...Array.from({ length: 12 }, correct), small, big, flopMiss, row({ id: "ungraded" })];
    const s = computeSummary(rows);

    expect(s.graded).toBe(15);
    expect(s.handCount).toBe(16);
    expect(s.mistakes).toEqual({ total: 3, small: 2, big: 1 });
    expect(s.lists.misplayed).toEqual(["big", "small", "flop"]);
    expect(s.lists.tight).toEqual(["small"]);
    expect(s.lists.loose).toEqual(["big", "flop"]);
    // (1 + 0.65 + 0.35) / 15 → 86.7 → 87.
    expect(s.score).toBe(87);
    expect(s.hands.big.pre).toMatchObject({ verdict: "too_loose", act: "raise", exp: "fold" });
    expect(s.hands.flop.flop).toMatchObject({ verdict: "questionable", rec: "fold" });
    expect(s.hands.flop.flop!.line).not.toHaveProperty("eventIndex");
  });

  it("is current only for the same version and hand count", () => {
    const s = computeSummary([correct()]);
    expect(s.version).toBe(SUMMARY_VERSION);
    expect(isSummaryCurrent(s, 1)).toBe(true);
    expect(isSummaryCurrent(s, 2)).toBe(false);
    expect(isSummaryCurrent({ ...s, version: "old" }, 1)).toBe(false);
    expect(isSummaryCurrent(null, 1)).toBe(false);
  });
});

describe("flopRecommendation", () => {
  it("picks the reference strategy's most frequent line when there is one", () => {
    expect(flopRecommendation({ line: { kind: "cbet", eventIndex: 1 }, advice: { strategy: { bet_1_3: 20, bet_2_3: 5, check: 75 } } as never })).toBe("check");
    expect(flopRecommendation({ line: { kind: "check", eventIndex: 1 }, advice: { strategy: { bet_1_3: 70, check: 30 } } as never })).toBe("bet_small");
  });

  it("otherwise inverts the questioned line", () => {
    expect(flopRecommendation({ line: { kind: "fold", eventIndex: 1 } })).toBe("call");
    expect(flopRecommendation({ line: { kind: "call", eventIndex: 1 } })).toBe("fold");
    expect(flopRecommendation({ line: { kind: "cbet", eventIndex: 1 } })).toBe("check");
  });
});
