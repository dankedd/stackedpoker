import { calculateBankroll, BANKROLL_CATEGORY_META, BANKROLL_PROVENANCE } from "@/lib/tools/bankroll";
import { calculateEquity } from "@/lib/tools/equity";
import { calculatePotOdds } from "@/lib/tools/potOdds";
import { calculateVariance } from "@/lib/tools/variance";
import {
  drawProbabilityByRiver,
  drawProbabilityNextCard,
  alpha as breakEvenFoldFrequency,
} from "@/lib/theory/math";
import { RFI_DEEP } from "@/lib/learn/preflopBaselines";
import {
  BB_DEFENSE_COMPLETE_100BB,
  BB_DEFENSE_COMPLETE_100BB_PROVENANCE,
} from "@/lib/learn/bbDefenseComplete";
import { POSITIONS, positionById } from "@/lib/tools/positions";
import { analyzeHand } from "@/lib/tools/handAnalysis/analyze";
import type { HandInput } from "@/lib/tools/handAnalysis/types";
import type { ArticleSection } from "../types";

/**
 * Worked examples for the tool pages.
 *
 * Every number below is COMPUTED by the same function the widget calls, at
 * build time — never typed in. A worked example that disagrees with the
 * calculator above it is worse than no example at all, and this makes that
 * impossible rather than merely unlikely.
 *
 * Equity examples deliberately use post-flop spots. Those enumerate 990 or 44
 * boards (about a millisecond); a preflop example would enumerate 1.7 million
 * and add half a second to every build and every test run for one number.
 */

const pct = (fraction: number, decimals = 1) => `${(fraction * 100).toFixed(decimals)}%`;

// ── Pot odds ─────────────────────────────────────────────────────────────────

export function potOddsExamples(): ArticleSection {
  const spots = [
    { pot: 100, bet: 25, story: "Villain fires a small probe on the turn." },
    { pot: 100, bet: 50, story: "The standard half-pot bet." },
    { pot: 100, bet: 100, story: "A pot-sized river bet." },
    { pot: 100, bet: 200, story: "An overbet shove." },
  ];

  return {
    heading: "Practical examples",
    definitions: spots.map(({ pot, bet, story }) => {
      const result = calculatePotOdds({ pot, bet });
      return {
        term: `${pot} pot, ${bet} bet`,
        description:
          `${story} You risk ${bet} to win ${pot + bet}, so you need ` +
          `${result.requiredEquityPct.toFixed(1)}% equity — odds of ${result.oddsRatio}. ` +
          `Across your whole range, minimum defense frequency asks you to continue with ` +
          `${result.mdfPct.toFixed(0)}%.`,
      };
    }),
  };
}

// ── Equity ───────────────────────────────────────────────────────────────────

export function equityExamples(): ArticleSection {
  const spots: { hero: string[]; villain: string[]; board: string[]; story: string }[] = [
    {
      hero: ["Ah", "Kh"],
      villain: ["Qs", "Qd"],
      board: ["Jh", "7h", "2c"],
      story: "Two overcards and the nut flush draw against an overpair",
    },
    {
      hero: ["8c", "7c"],
      villain: ["As", "Ad"],
      board: ["9c", "6d", "2h"],
      story: "An open-ended draw against aces",
    },
    {
      hero: ["Ks", "Kd"],
      villain: ["Ac", "Qh"],
      board: ["Kh", "8s", "3d", "Tc"],
      story: "A set against a gutshot and two overs, one card to come",
    },
  ];

  return {
    heading: "Practical examples",
    definitions: spots.map(({ hero, villain, board, story }) => {
      const result = calculateEquity(hero, villain, board);
      return {
        term: `${hero.join("")} vs ${villain.join("")} on ${board.join(" ")}`,
        description:
          `${story}: ${pct(result.heroEquity, 2)} against ${pct(result.villainEquity, 2)}, ` +
          `counted over all ${result.boardsEvaluated.toLocaleString("en-US")} remaining runouts.`,
      };
    }),
  };
}

// ── Bankroll ─────────────────────────────────────────────────────────────────

export function bankrollExamples(): ArticleSection {
  const buyIn = 100;
  return {
    heading: "Practical examples",
    definitions: BANKROLL_CATEGORY_META
      ? (Object.keys(BANKROLL_CATEGORY_META) as (keyof typeof BANKROLL_CATEGORY_META)[]).map(
          (category) => {
            const meta = BANKROLL_CATEGORY_META[category];
            const rule = meta.buyInPresets[Math.floor(meta.buyInPresets.length / 2)];
            const result = calculateBankroll({ bankroll: 0, category, buyIn, buyInCount: rule });
            const provenance = BANKROLL_PROVENANCE[category];
            return {
              term: `${meta.label} at a $${buyIn} buy-in`,
              description:
                `A ${rule}-buy-in rule asks for ` +
                `$${result.recommendedBankroll.toLocaleString("en-US")}. Moving up becomes ` +
                `reasonable around $${result.moveUpAt.toLocaleString("en-US")}. ` +
                (provenance.cited
                  ? "This one is a published figure."
                  : "This is a StackedPoker default, not a published figure."),
            };
          },
        )
      : [],
  };
}

// ── Variance ─────────────────────────────────────────────────────────────────

export function varianceExamples(): ArticleSection {
  const winRate = 3;
  const stdDev = 100;
  const samples = [10000, 100000, 500000, 1000000];

  return {
    heading: "Practical examples",
    definitions: samples.map((hands) => {
      const result = calculateVariance({ winRateBb100: winRate, stdDevBb100: stdDev, hands });
      return {
        term: `${hands.toLocaleString("en-US")} hands at ${winRate} bb/100`,
        description:
          `95% of the time you finish between ${Math.round(result.lowerBb).toLocaleString("en-US")} ` +
          `and ${Math.round(result.upperBb).toLocaleString("en-US")} big blinds, against an ` +
          `expectation of ${Math.round(result.expectedBb).toLocaleString("en-US")}. ` +
          `Chance of being down after the whole sample: ` +
          `${result.probabilityOfLossPct.toFixed(1)}%. The same results are consistent with a true ` +
          `win rate anywhere from ${result.lowerWinRate.toFixed(1)} to ` +
          `${result.upperWinRate.toFixed(1)} bb/100.`,
      };
    }),
  };
}

// ── Outs ─────────────────────────────────────────────────────────────────────

export function outsExamples(): ArticleSection {
  const draws = [
    { outs: 9, name: "Flush draw", note: "Nine cards of your suit remain." },
    { outs: 8, name: "Open-ended straight draw", note: "Either end completes it." },
    { outs: 4, name: "Gutshot", note: "One rank fills the hole." },
    { outs: 15, name: "Flush draw plus open-ender", note: "The biggest common draw." },
  ];

  return {
    heading: "Practical examples",
    definitions: draws.map(({ outs, name, note }) => ({
      term: `${name} — ${outs} outs`,
      description:
        `${note} ${(drawProbabilityNextCard(outs) * 100).toFixed(1)}% to hit on the next card, ` +
        `${(drawProbabilityByRiver(outs) * 100).toFixed(1)}% by the river.`,
    })),
  };
}

// ── Expected value ───────────────────────────────────────────────────────────

export function evExamples(): ArticleSection {
  const bluffs = [0.33, 0.5, 0.75, 1, 2];
  return {
    heading: "Practical examples",
    definitions: bluffs.map((fraction) => ({
      term: `Bluffing ${(fraction * 100).toFixed(0)}% of the pot`,
      description:
        `You risk ${fraction} to win 1, so the bluff breaks even when villain folds ` +
        `${(breakEvenFoldFrequency(fraction, 1) * 100).toFixed(1)}% of the time. Fold more often ` +
        `than that and every hand in your bluffing range prints money; fold less and it burns it.`,
    })),
  };
}

// ── Starting hands ───────────────────────────────────────────────────────────

/** Real rows from the charts the quiz grades against — never invented. */
export function startingHandExamples(): ArticleSection {
  const rfiRows = [
    { position: "UTG", hand: "AKo" },
    { position: "UTG", hand: "JTs" },
    { position: "BTN", hand: "A5s" },
  ].map(({ position, hand }) => {
    const entry = (RFI_DEEP[position] ?? []).find((e) => e.hand === hand);
    const freq = entry?.freq ?? 0;
    return {
      term: `${hand} from ${position}, first in`,
      description:
        freq >= 1
          ? `A standard open — the chart raises it every time.`
          : freq > 0
            ? `A mixed open: the chart raises it ${(freq * 100).toFixed(0)}% of the time and folds the rest.`
            : `Not in the ${position} opening range, so it folds.`,
    };
  });

  const matchup = "BB_vs_BTN" as const;
  const chart = BB_DEFENSE_COMPLETE_100BB[matchup];
  const provenance = BB_DEFENSE_COMPLETE_100BB_PROVENANCE[matchup];
  const defendRows = ["A5s", "KQo", "72o"]
    .filter((hand) => chart[hand])
    .map((hand) => {
      const mix = chart[hand];
      const parts = Object.entries(mix)
        .filter(([, freq]) => (freq ?? 0) > 0.001)
        .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
        .map(([action, freq]) => `${action} ${((freq ?? 0) * 100).toFixed(0)}%`);
      return {
        term: `${hand} in the big blind facing a button open`,
        description: `${parts.join(", ")} — ${provenance.figure}, p.${provenance.page}.`,
      };
    });

  return { heading: "Practical examples", definitions: [...rfiRows, ...defendRows] };
}

// ── Position ─────────────────────────────────────────────────────────────────

export function positionExamples(): ArticleSection {
  const pairs: [string, string][] = [
    ["UTG", "BTN"],
    ["SB", "CO"],
    ["BB", "MP"],
  ];

  return {
    heading: "Practical examples",
    definitions: [
      ...pairs.map(([a, b]) => {
        const first = positionById(a as never);
        const second = positionById(b as never);
        const preflop = first.preflopOrder < second.preflopOrder ? first : second;
        const postflop = first.postflopOrder < second.postflopOrder ? first : second;
        return {
          term: `${a} versus ${b}`,
          description:
            `${preflop.id} acts first preflop; ${postflop.id} acts first postflop. ` +
            (preflop.id === postflop.id
              ? "The same seat is first on both, so nothing changes after the flop."
              : "The order flips after the flop, which is the part that catches beginners out."),
        };
      }),
      {
        term: "Who is in position postflop",
        description: `Only ${POSITIONS.filter((p) => p.inPositionPostflop)
          .map((p) => p.id)
          .join(", ")} — the button acts last on the flop, turn and river.`,
      },
    ],
  };
}

// ── Hand analyzer ────────────────────────────────────────────────────────────

/**
 * Worked examples produced by running the analyser itself at build time.
 *
 * Same discipline as every other tool page here: the page cannot show a
 * conclusion the tool would not reach, because the tool reached it. Both
 * spots use known villain cards, which is the only case where the analyser is
 * entitled to a verdict — showing an example where it says "needs review"
 * would be honest but would teach nothing about the output.
 */
export function handAnalyzerExamples(): ArticleSection {
  const spots: { label: string; hand: HandInput }[] = [
    {
      label: "Flush draw facing a half-pot flop bet",
      hand: {
        heroPosition: "BTN",
        heroCards: ["Ah", "Kh"],
        villainCards: ["Qs", "Qd"],
        board: ["Jh", "7h", "2c"],
        potBb: 10,
        effectiveStackBb: 100,
        actions: [{ street: "flop", actor: "villain", type: "bet", amountBb: 5 }],
      },
    },
    {
      label: "Bottom pair facing a pot-sized turn bet",
      hand: {
        heroPosition: "BB",
        heroCards: ["8c", "7d"],
        villainCards: ["As", "Ad"],
        board: ["Kc", "Qd", "7s", "2h"],
        potBb: 20,
        effectiveStackBb: 80,
        actions: [{ street: "turn", actor: "villain", type: "bet", amountBb: 20 }],
      },
    },
  ];

  return {
    heading: "Practical examples",
    definitions: spots.map(({ label, hand }) => {
      const analysis = analyzeHand(hand);
      const equity = analysis.calculations.find((c) => c.id === "equity")?.value ?? "n/a";
      const required = analysis.calculations.find((c) => c.id === "required-equity")?.value ?? "n/a";
      return {
        term: label,
        description:
          `${analysis.summary.heroCards} on ${analysis.summary.board}: you need ${required} to call ` +
          `and hold ${equity} against that exact hand. ${analysis.verdictBasis} ` +
          `Concepts raised: ${analysis.concepts.map((c) => c.name).join(", ")}.`,
      };
    }),
  };
}
