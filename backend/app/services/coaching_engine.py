"""
Coaching Engine — generates personalised, prioritised coaching advice from
detected leaks and aggregated player stats.

Design principles:
  • Every piece of advice is derived from actual data (no generic filler).
  • Advice adapts to skill level: beginner gets fundamentals, advanced gets
    solver-level nuance.
  • The top 3 leaks drive the top 3 coaching messages (EV-first priority).
  • Strengths and weaknesses are extracted from position/pot-type stats.
  • Tilt indicators are detected from score variance patterns.
"""
from __future__ import annotations

import math
from statistics import stdev
from typing import Any

from app.models.schemas import (
    CoachingAdvice,
    PlayerLeak,
    PlayerProfile,
    PlayerStats,
)

# ── Playing style classification ──────────────────────────────────────────────

_STYLE_THRESHOLDS = [
    # (condition_fn, style, description)
    (
        lambda v, p: v < 12,
        "Nit",
        "You play extremely tight, entering only the top few percent of hands. "
        "While this protects you from marginal spots, you're leaving significant "
        "money on the table by over-folding profitable situations.",
    ),
    (
        lambda v, p: v <= 26 and p >= 15,
        "TAG",
        "Tight-Aggressive — you're in the right ballpark of solid fundamentals. "
        "You select hands carefully and attack when you play. The focus now is "
        "refining postflop decisions and reducing leak EV.",
    ),
    (
        lambda v, p: v > 30 and p >= 22,
        "LAG",
        "Loose-Aggressive — you play many hands and apply constant pressure. "
        "This style is powerful at high stakes with precise hand-reading, but "
        "requires excellent post-flop discipline to avoid bleeding chips.",
    ),
    (
        lambda v, p: v > 35 and p < 15,
        "Calling Station",
        "You play too many hands passively — calling wide but rarely raising. "
        "This style is highly exploitable: opponents can value-bet relentlessly "
        "and never have to balance their range against your aggression.",
    ),
    (
        lambda v, p: v > 35 and p >= 28,
        "Aggressive Fish",
        "You enter many pots and apply heavy aggression, but without the "
        "hand-reading and range discipline to make it profitable long-term. "
        "Focus on tightening preflop and being more selective with aggression.",
    ),
    (
        lambda v, p: 20 <= v <= 28 and 15 <= p <= 22,
        "Balanced Reg",
        "Your preflop stats are close to GTO ranges for 6-max cash. "
        "The primary areas for improvement are postflop execution and "
        "exploiting population tendencies.",
    ),
    (
        lambda v, p: True,   # catch-all
        "Recreational",
        "Your play style is varied — sometimes tight, sometimes loose. "
        "Establishing consistent preflop fundamentals will unlock the most "
        "immediate EV improvement.",
    ),
]


def classify_style(vpip: float, pfr: float) -> tuple[str, str]:
    for condition, style, desc in _STYLE_THRESHOLDS:
        if condition(vpip, pfr):
            return style, desc
    return "Recreational", "Mixed style — focus on preflop fundamentals."


def determine_skill_level(avg_score: float, avg_mistakes: float) -> str:
    if avg_score >= 80 and avg_mistakes < 0.8:
        return "advanced"
    if avg_score >= 65 and avg_mistakes < 1.8:
        return "intermediate"
    return "beginner"


def determine_data_quality(sample_size: int) -> str:
    if sample_size < 5:
        return "insufficient"
    if sample_size < 15:
        return "low"
    if sample_size < 40:
        return "moderate"
    return "high"


# ── Coaching advice generation ────────────────────────────────────────────────

def generate_coaching_advice(
    leaks: list[PlayerLeak],
    stats: PlayerStats,
    style: str,
    skill_level: str,
) -> list[CoachingAdvice]:
    """
    Return up to 6 coaching advice items, prioritised by EV impact.
    The first items come from the biggest leaks; later items from stat trends.
    """
    advice_items: list[CoachingAdvice] = []

    # ── 1. Leak-driven advice (top 4 leaks) ───────────────────────────────────
    for i, leak in enumerate(leaks[:4]):
        item = _leak_to_advice(leak, stats, skill_level, priority=i + 1)
        if item:
            advice_items.append(item)

    # ── 2. Stat-driven supplementary advice ───────────────────────────────────
    extra = _stat_advice(stats, style, skill_level, start_priority=len(advice_items) + 1)
    advice_items.extend(extra)

    # Trim to 6, renumber priorities
    advice_items = advice_items[:6]
    for idx, item in enumerate(advice_items):
        item.priority = idx + 1

    return advice_items


_LEAK_ADVICE_TEMPLATES: dict[str, dict] = {
    "cbet_oversizing": {
        "beginner": {
            "headline": "Downsize your flop c-bets on dry boards",
            "detail": (
                "When you c-bet on boards like A72 rainbow or K54 with no flush draw, "
                "the flop is already very dry — draws are rare. A bet of 25–33% pot is "
                "enough to charge pairs and keep them from folding. Bigger bets fold out "
                "hands you want to stack later."
            ),
            "example": "A72r flop: use $4 into $11 (36% pot), not $9 (82% pot).",
        },
        "intermediate": {
            "headline": "Use board-texture-aware c-bet sizing",
            "detail": (
                "On dry boards (low connectivity, rainbow), solver output shows 25–33% "
                "sizing at high frequency. Reserve 75%+ sizing for wet, coordinated boards "
                "(JT9 two-tone, QJ8 flush draw) where charging equity matters. Your oversized "
                "c-bets on dry boards fold out the exact medium-strength hands that pay you off."
            ),
            "example": "K72r: prefer 33% pot. K98 two-tone: 60–75% is appropriate.",
        },
        "advanced": {
            "headline": "C-bet size polarisation is off — audit your board buckets",
            "detail": (
                "On disconnected low-card boards your solver shows a nearly-pure small "
                "c-bet strategy. Mixing in large sizing without enough bluffs creates a "
                "range that's capped mid-strength. Review your population's response to "
                "small c-bets — if they're under-raising, move EV to the sizing, not the frequency."
            ),
            "example": "Node lock: if BTN's raise freq < 10% on A72r, small c-bets extract more total EV.",
        },
    },
    "missed_value": {
        "beginner": {
            "headline": "Stop checking back the river when you're ahead",
            "detail": (
                "If you made top pair or better and villain called two bets then checked "
                "the river, you're almost always the best hand. Bet 60–80% pot. Most of "
                "the time they'll call with second pair or a missed draw."
            ),
            "example": "AK on K72A — villain checks river after two calls. Bet $30 into $38, not check.",
        },
        "intermediate": {
            "headline": "Maximise thin river value vs capped ranges",
            "detail": (
                "When villain's river check signals a capped range (they'd raise with nutted "
                "hands), use 70–90% pot bets. Your TPTK / over-pair is strong enough for a "
                "large value bet. Missing this spot is one of the highest-EV leaks in cash games."
            ),
            "example": "Pot $60, villain checks river: bet $45–$54 rather than $25.",
        },
        "advanced": {
            "headline": "River bet-sizing is leaving EV vs calling ranges",
            "detail": (
                "Review hands where you bet <50% pot on the river with value — check if "
                "villain's calling range at that sizing is strong enough to justify going bigger. "
                "Against most populations, medium-strength value hands (TPTK, two pair) can "
                "extract 70–80% pot and still get called by worse."
            ),
            "example": "Identify 10 river spots where you bet <40% pot with TP+; rerun the EV calculation.",
        },
    },
    "overfold": {
        "beginner": {
            "headline": "You're folding too much — check your pot odds",
            "detail": (
                "When someone bets half the pot, you only need 25% equity to break even on a call. "
                "Many of the hands you're folding have more than that equity. Before folding, "
                "quickly count your outs: each out is worth about 2% equity on the flop."
            ),
            "example": "Open-ended straight draw (8 outs) = ~32% equity on flop. Call a half-pot bet.",
        },
        "intermediate": {
            "headline": "Your MDF is too low — you're giving up too easily",
            "detail": (
                "At pot odds x, you need to defend at least MDF = 1 − (bet / (pot + bet)) of your range. "
                "For a 75% pot bet, MDF is 57%. If you fold more than 43% of your range, you're "
                "giving opponents automatic profit on bluffs regardless of their hand."
            ),
            "example": "Vs 3/4-pot flop cbet, defend ~57% of your BB range — widen with any pair, any gutshot.",
        },
        "advanced": {
            "headline": "Exploit-fold population is crushing you — check your solver MDF",
            "detail": (
                "If your postflop fold-to-cbet is above 65%, you're exploitably over-folding. "
                "Rebalance by adding more check-raise bluffs and floats with backdoor equity. "
                "Consider position-specific MDF — you can fold more OOP on very wet boards where "
                "you can't realise equity."
            ),
            "example": "BB vs BTN cbet — widen continues to include A-high floats with backdoors on K-high boards.",
        },
    },
    "overcall": {
        "beginner": {
            "headline": "Tighten your calling range — not every hand is worth a call",
            "detail": (
                "When someone raises big (3-bet or 4-bet), ask if your hand beats theirs often enough. "
                "Hands like KJ, QT, and small pairs usually don't — they're dominated or have to hit "
                "lucky. Fold these and save the chips for better spots."
            ),
            "example": "KJo vs 3-bet: fold. You're dominated by AK, KK, QQ, and behind AJ.",
        },
        "intermediate": {
            "headline": "Your continue range is too wide vs strong lines",
            "detail": (
                "Against check-raises and 3-bets, the betting range is polarised toward the nuts. "
                "Continuing with medium-strength hands (second pair, MPTK) is often a mistake. "
                "Fold marginal holdings and only continue with strong equity or the nuts."
            ),
            "example": "Facing a flop check-raise: fold JT on T82 two-tone — you're rarely ahead.",
        },
        "advanced": {
            "headline": "Identify which opponent ranges make continuing profitable",
            "detail": (
                "Overcalling is often population-specific. If villains over-bluff check-raises, "
                "widening your continue range is correct. Run a node-lock analysis with their "
                "actual bluff:value ratio — it will tell you how wide to continue profitably."
            ),
            "example": "Node-lock villain check-raise bluff% to 50% — this changes your EV-best range significantly.",
        },
    },
    "river_bluff": {
        "beginner": {
            "headline": "Use missed draws as river bluffs",
            "detail": (
                "When you chase a flush or straight draw that missed, your hand has no showdown value. "
                "This is the perfect time to bluff — you can represent made hands and force villain "
                "off pairs. Don't just give up and check."
            ),
            "example": "You had 7h6h on a heart-heavy board that bricked. Bet 75% pot as a bluff.",
        },
        "intermediate": {
            "headline": "Balance your river bet-fold and value-bluff ratio",
            "detail": (
                "For a 75% pot river bet to be GTO-balanced, your range needs roughly 43% bluffs. "
                "Prioritise bluffs that block villain's calling hands (A-blocker vs Ax range) and "
                "unblock their folding range. Don't bluff with hands that might have showdown value."
            ),
            "example": "Ahigh no pair on a dry board can bluff-bet river — you block Ax calls and represent strong Ax.",
        },
        "advanced": {
            "headline": "River bluffing frequency is off equilibrium — review blockers",
            "detail": (
                "Your bluff selection should be driven by blocker effects. Audit your river bluffs: "
                "are you choosing hands that block the nuts (villain's calling range) and unblock "
                "their folding range? Bluffs with Ah on an Axx board are weaker than Ah on Kxx."
            ),
            "example": "Kh on KJ4 board: blocks KK, KJ, K4 — villain's calling range. Poor bluff candidate.",
        },
    },
    "preflop_3bet": {
        "beginner": {
            "headline": "3-bet your premiums instead of just calling",
            "detail": (
                "With hands like AK, QQ, KK, AA, JJ — always 3-bet instead of flat-calling. "
                "You build a bigger pot with the best hand and reduce the number of opponents. "
                "Calling gives opponents the chance to draw out cheaply."
            ),
            "example": "AKo faces a BTN open: 3-bet to 3x their open, don't just call.",
        },
        "intermediate": {
            "headline": "Add suited bluffs to your 3-bet range",
            "detail": (
                "A 3-bet range of only premiums is easy to read. Add suited Ax hands (A2s–A5s) "
                "and some suited connectors (KQs, JTs) as bluffs. These have strong equity when "
                "called and give your range balance — villain can't know if you have AA or A3s."
            ),
            "example": "CO opens, you're on BTN: 3-bet AA, KK, QQ, JJ, AK + A2s-A5s, KQs, QJs.",
        },
        "advanced": {
            "headline": "Your 3-bet range construction is leaving EV vs positional opens",
            "detail": (
                "Review your BTN vs CO 3-bet frequency — solver shows ~12–16% is optimal. "
                "If you're 3-betting <8%, you're allowing CO to open too profitably. "
                "Expand with bluffs that have board coverage post-flop on your best textures."
            ),
            "example": "BTN vs CO: mix in KJs, QJs, JTs as 3-bet bluffs — they have high flop equity.",
        },
    },
    "bb_defense": {
        "beginner": {
            "headline": "Don't over-fold your big blind",
            "detail": (
                "You already put money in the pot as BB. You get the best price of anyone to call "
                "an open (you only need to add the difference). Against a BTN open of 2.5bb, "
                "you're getting 3.5:1 pot odds — you need just 22% equity to profit. Most hands qualify."
            ),
            "example": "87s facing a BTN open: call. You have 35%+ equity in position with a suited connector.",
        },
        "intermediate": {
            "headline": "Widen BB defense vs late-position opens",
            "detail": (
                "BTN opens ~45–55% of hands. Against this wide range, you can defend BB profitably "
                "with ~55% of hands yourself. Include all pairs, suited hands, and connected hands. "
                "Fold weak offsuit hands (J3o, Q2o) but keep any pair, any suited Ax, and 87o+."
            ),
            "example": "BB vs BTN: call with T6s, 42s, 87o, 33. Fold 72o, J2o, Q3o.",
        },
        "advanced": {
            "headline": "Positional BB defense is leaking EV — audit your solver MDF by position",
            "detail": (
                "Run a solver solution for BB vs BTN open. Your defend frequency vs a specific "
                "sizing should hit the MDF threshold. If you're below it, add the hands just "
                "outside your current range — they're typically borderline suited low Ax or "
                "low suited connectors that gain equity from their playability."
            ),
            "example": "Solver BB vs 2.5x BTN: defend 54% including 87o, 96s, T7s, A2o, K6s.",
        },
    },
    "check_raise_response": {
        "beginner": {
            "headline": "Facing a check-raise means villain has strength",
            "detail": (
                "A check-raise is one of the strongest lines in poker — villain is saying "
                "they want more money in the pot. Unless you have a very strong hand (top pair "
                "good kicker or better) or a strong draw, folding is usually correct."
            ),
            "example": "You c-bet flop with middle pair. Villain check-raises. Fold — they have top pair at least.",
        },
        "intermediate": {
            "headline": "Defend check-raises with equity + strong hands, fold marginal pairs",
            "detail": (
                "Vs a flop check-raise, continue with: top pair strong kicker, two pair, "
                "sets, strong flush draws (9 outs), open-ended straight draws. Fold: middle pair, "
                "bottom pair, backdoor draws only, overcards with no pair."
            ),
            "example": "C-bet flop → villain check-raises: fold JJ on Q86 two-tone (you're behind Qx, sets, draws).",
        },
        "advanced": {
            "headline": "Check-raise responding range depends on board texture and SPR",
            "detail": (
                "On dry boards, villain's check-raise range is nutted — fold more. On wet boards, "
                "their range includes more semi-bluffs — you can continue wider. Also consider SPR: "
                "low SPR makes calling or jamming correct with top pair vs polarised check-raises."
            ),
            "example": "SPR 3 on T65 two-tone: jam top pair vs check-raise — you're committed and have equity.",
        },
    },
    "turn_barrel": {
        "beginner": {
            "headline": "Keep betting on turns that help your hand",
            "detail": (
                "If you c-bet the flop and then check the turn, you're giving up your aggressor "
                "advantage. If a card comes that helps your hand (pairs the board, gives you a draw, "
                "is a high card for your range), bet again to keep the pressure on."
            ),
            "example": "You bet flop with AK on A62. Turn comes K. Bet again — you now have two pair.",
        },
        "intermediate": {
            "headline": "Double barrel with hands that improve or maintain equity",
            "detail": (
                "Fire a second barrel on turns that: (1) improve your equity, (2) improve your "
                "perceived range, (3) blank the draws you were representing. Give up on turns that "
                "clearly help the caller (completes obvious draws, pairs the board in their favour)."
            ),
            "example": "C-bet K72r. Turn: Q. Barrel — the Q hits your 3-bet/open range harder than the caller's.",
        },
        "advanced": {
            "headline": "Turn barrel selection should match your range advantage",
            "detail": (
                "Your turn c-bet frequency should correlate with range advantage. On boards where "
                "your range hits harder, barrel at 70%+. On boards where the caller's range improves "
                "(low-card turns on low-card flops for BTN's cold-calling range), reduce frequency "
                "significantly and check-call your value."
            ),
            "example": "Flop K72r BTN vs BB: barrel on turn 3 (your range improves more than caller's).",
        },
    },
    "stack_depth_play": {
        "beginner": {
            "headline": "With a short stack, shove instead of raise-folding",
            "detail": (
                "If your stack is less than 20 big blinds, raising and then folding to a 3-bet "
                "is a big mistake — you've committed chips without getting to showdown. "
                "Instead, open-shove or fold. Don't raise and give fold equity to your opponent."
            ),
            "example": "15bb stack, BTN — open-shove any two broadways, any pair, any suited Ax.",
        },
        "intermediate": {
            "headline": "Memorise push-fold thresholds by position and stack depth",
            "detail": (
                "At 10bb: shove any pair, any Ax, any two broadways from any position. "
                "At 15bb: shove 88+, ATs+, KQs from early; widen to any pair, A5s+, KQo from late. "
                "At 20bb: start with ranges closer to normal but shove vs wide opens."
            ),
            "example": "15bb CO: open-shove ATo, 77, KJs. These are profitable shoves vs most SB/BB defending ranges.",
        },
        "advanced": {
            "headline": "Push-fold EV calculation: use nash equilibrium ranges by stack",
            "detail": (
                "At 20bb, your push range should be derived from HoldemResources nash calculator. "
                "Against an unknown opponent, push J5s from BTN — nash says it's profitable. "
                "Adjust for reads: tighter defender → push wider; calling station → push only strong hands."
            ),
            "example": "20bb BTN vs unknown: nash says push 52% of hands. Don't raise-fold ATo into a blind who calls 40%.",
        },
    },
    "icm_pressure": {
        "beginner": {
            "headline": "Near the bubble, fold more than usual",
            "detail": (
                "When you're close to the money (bubble), chips you win are worth less than chips "
                "you lose — because surviving to get paid is more valuable. Be more careful "
                "with marginal spots and let small stacks bust first."
            ),
            "example": "Bubble of a 50-player tournament: fold JJ facing an all-in from a big stack if you're average stack.",
        },
        "intermediate": {
            "headline": "Exploit large stacks and protect vs short stacks near pay jumps",
            "detail": (
                "ICM: large stacks can apply maximum pressure — they can't be eliminated. "
                "Short stacks must call to survive but can't hurt you much. As medium stack: "
                "avoid confrontations with big stacks; attack small stacks mercilessly."
            ),
            "example": "You have 25bb on bubble. Big stack (80bb) shoves. Fold QQ — ICM loss from busting >> chip gain.",
        },
        "advanced": {
            "headline": "Model ICM pressure with ICMIZER or HRC for precise decisions",
            "detail": (
                "Use tournament equity tools to calculate exact push/fold ranges adjusted for "
                "prize structure. Nash equilibrium push-fold ignores ICM — always use ICM-adjusted "
                "ranges near pay jumps. Your risk-premium should increase as the pay jump grows."
            ),
            "example": "Final table, 3-way for $10k/$6k/$3k: run the exact spot in HRC. The ranges shift dramatically.",
        },
    },
}


def _leak_to_advice(
    leak: PlayerLeak,
    stats: PlayerStats,
    skill_level: str,
    priority: int,
) -> CoachingAdvice | None:
    templates = _LEAK_ADVICE_TEMPLATES.get(leak.category)
    if not templates:
        # Generic fallback
        return CoachingAdvice(
            priority=priority,
            headline=f"Fix: {leak.title}",
            detail=leak.coaching_note or leak.description,
            category=leak.category,
            example=None,
        )

    template = templates.get(skill_level, templates.get("intermediate", {}))
    return CoachingAdvice(
        priority=priority,
        headline=template.get("headline", leak.title),
        detail=template.get("detail", leak.description),
        category=leak.category,
        example=template.get("example"),
    )


def _stat_advice(
    stats: PlayerStats,
    style: str,
    skill_level: str,
    start_priority: int,
) -> list[CoachingAdvice]:
    items: list[CoachingAdvice] = []
    p = start_priority

    # Style-specific catch-all advice
    if style == "Calling Station" and skill_level == "beginner":
        items.append(CoachingAdvice(
            priority=p,
            headline="Raise more — stop just calling",
            detail=(
                "Your stats show you call a lot but rarely raise. Raising has two "
                "ways to win: villain folds immediately, or you build a bigger pot "
                "when you're ahead. Calls only win at showdown."
            ),
            category="preflop_3bet",
            example="AJs facing a raise: 3-bet to 3x instead of calling.",
        ))
        p += 1

    # IP/OOP gap
    if stats.ip_score and stats.oop_score and (stats.ip_score - stats.oop_score) > 12:
        items.append(CoachingAdvice(
            priority=p,
            headline="Study OOP play — your biggest positional leak",
            detail=(
                f"You average {stats.ip_score:.0f} in-position vs {stats.oop_score:.0f} "
                "out-of-position. Study BB single-raised pot defence: check-raise bluffs, "
                "OOP c-bet frequencies on different board textures, and probe bets on turns."
            ),
            category="oop_sizing",
            example="OOP with TPTK on A72r: bet 33% pot rather than checking. You want protection and value.",
        ))
        p += 1

    # River is the worst street
    sm = stats.street_mistakes
    total_sm = sm.preflop + sm.flop + sm.turn + sm.river
    if total_sm > 0 and sm.river / max(total_sm, 1) > 0.35:
        items.append(CoachingAdvice(
            priority=p,
            headline="River decision-making is your biggest street leak",
            detail=(
                f"{sm.river} of your mistakes happen on the river — the highest EV street. "
                "Drill river bet-sizing (use 70–90% pot for value, 60–80% for bluffs) "
                "and review 10 river hands from your history this week."
            ),
            category="river_bluff",
            example="River bet-size trees: small (33%) for thin value, large (75–100%) for polarised betting.",
        ))
        p += 1

    # Short stack under-performance
    if stats.short_score and stats.deep_score and (stats.deep_score - stats.short_score) > 15:
        items.append(CoachingAdvice(
            priority=p,
            headline="Improve your short-stack play urgently",
            detail=(
                f"Deep-stacked you score {stats.deep_score:.0f}, but only {stats.short_score:.0f} "
                "with a short stack. Study push-fold tables for 10–20bb: these spots are high-frequency "
                "in tournaments and cash rebuys. Drill with HoldemResources Nash calculator."
            ),
            category="stack_depth_play",
            example="15bb UTG: push JTs, 66+, A8o+ — these are profitable by push-fold theory.",
        ))
        p += 1

    return items[:3]  # max 3 supplementary items


# ── Strengths / weaknesses ────────────────────────────────────────────────────

def identify_strengths_weaknesses(
    stats: PlayerStats,
    leaks: list[PlayerLeak],
) -> tuple[list[str], list[str]]:
    strengths:  list[str] = []
    weaknesses: list[str] = []

    # Position strengths
    if stats.position_stats:
        best  = max(stats.position_stats, key=lambda p: p.avg_score)
        worst = min(stats.position_stats, key=lambda p: p.avg_score)
        if best.avg_score >= 70 and best.hands >= 3:
            strengths.append(
                f"Strong {best.position} play — avg score {best.avg_score:.0f} "
                f"across {best.hands} hands."
            )
        if worst.avg_score <= 55 and worst.hands >= 3:
            weaknesses.append(
                f"Weakest from {worst.position} — avg score only {worst.avg_score:.0f}."
            )

    # Pot-type strengths / weaknesses
    if stats.srp_score >= 70:
        strengths.append(f"Solid SRP play — avg score {stats.srp_score:.0f} in single-raised pots.")
    if stats.three_bet_pot_score and stats.three_bet_pot_score < 55:
        weaknesses.append(
            f"3-bet pot struggles — avg score {stats.three_bet_pot_score:.0f}. "
            "Focus on SPR-awareness and range vs range equity in 3-bet spots."
        )

    # IP advantage
    if stats.ip_score and stats.oop_score:
        if stats.ip_score >= 72:
            strengths.append(f"Good in-position discipline — avg score {stats.ip_score:.0f} when IP.")
        if stats.oop_score < 58:
            weaknesses.append(f"OOP struggles persist — avg score {stats.oop_score:.0f} when OOP.")

    # Overall score
    if stats.avg_score >= 75:
        strengths.append(f"High overall decision quality — avg score {stats.avg_score:.0f}.")
    elif stats.avg_score < 55:
        weaknesses.append(f"Overall decision quality needs work — avg score {stats.avg_score:.0f}.")

    # Leak-based weaknesses (top 2 leaks → weaknesses)
    for leak in leaks[:2]:
        weaknesses.append(f"{leak.title}: {leak.frequency} occurrences detected, est. −{leak.ev_loss_bb}bb EV.")

    return strengths[:4], weaknesses[:4]


# ── Tilt indicators ───────────────────────────────────────────────────────────

def detect_tilt_indicators(trend: list[Any]) -> list[str]:
    indicators: list[str] = []
    if len(trend) < 4:
        return indicators

    scores = [t.score for t in trend]

    # High variance = volatile / emotional play
    try:
        score_std = stdev(scores)
        if score_std > 22:
            indicators.append(
                f"High score variance (σ={score_std:.0f}) suggests inconsistent decision-making "
                "— possibly tilt-induced swings between sessions."
            )
    except Exception:
        pass

    # Downward trend (last 5 vs first 5)
    if len(scores) >= 10:
        early_avg = sum(scores[:5]) / 5
        late_avg  = sum(scores[-5:]) / 5
        if early_avg - late_avg > 18:
            indicators.append(
                "Declining score trend — recent sessions are performing worse than earlier ones. "
                "Consider taking a break or reviewing your mental game."
            )

    # Three consecutive low scores
    for i in range(len(scores) - 2):
        if all(s < 45 for s in scores[i:i+3]):
            indicators.append(
                "Three consecutive low-score sessions detected — "
                "classic tilt or study fatigue pattern. Review and reset."
            )
            break

    return indicators[:3]


# ── Main profile builder ──────────────────────────────────────────────────────

def build_ai_summary(
    style: str,
    style_desc: str,
    skill_level: str,
    stats: PlayerStats,
    leaks: list[PlayerLeak],
) -> str:
    top_leak_titles = ", ".join(l.title for l in leaks[:3]) if leaks else "none detected yet"
    best_pos = ""
    if stats.position_stats:
        bp = max(stats.position_stats, key=lambda p: p.avg_score)
        best_pos = f" You perform best from {bp.position}."

    return (
        f"You play a {style} style at {skill_level} level with an average score of "
        f"{stats.avg_score:.0f}/100 across {stats.total_hands} analysed hands. "
        f"Your top leaks are: {top_leak_titles}.{best_pos} "
        f"VPIP {stats.vpip_pct:.0f}% / PFR {stats.pfr_pct:.0f}% — "
        f"{'well within GTO ranges' if 18 <= stats.vpip_pct <= 28 else 'outside GTO ranges, needs adjustment'}. "
        f"Estimated cumulative EV loss across all reviewed hands: −{stats.total_ev_loss_bb:.0f}bb. "
        f"Focus on the study plan below to close your biggest gaps."
    )
