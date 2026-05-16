"""
Leak Detector — scans all findings from a player's hand history and groups
them into ranked, categorised PlayerLeak objects.

Detection strategy:
  1. Scan every HeuristicFinding (severity: mistake / suboptimal) across all hands.
  2. Match finding text against keyword patterns to assign a leak category.
  3. Score each category by  frequency × severity_weight.
  4. Return top leaks sorted by estimated EV loss, de-duplicated.
"""
from __future__ import annotations

import re
from collections import defaultdict
from typing import Any

from app.models.schemas import PlayerLeak, PlayerStats

# ── Severity weight for EV-loss estimation ────────────────────────────────────

_SEV_WEIGHT = {"mistake": 3.0, "suboptimal": 1.0}

# ── Leak catalogue ────────────────────────────────────────────────────────────
# Each entry defines:
#   keywords  — matched against (action_taken + recommendation + explanation) lower
#   title     — human-readable name
#   description — shown on profile card
#   street    — where the mistake typically occurs
#   coaching_note — one-liner coaching tip

_LEAK_CATALOGUE: list[dict] = [
    {
        "id": "cbet_oversizing",
        "keywords": [
            "oversize", "too large", "reduce sizing", "smaller sizing",
            "downsize", "75%+", "pot bet", "pot-size bet",
        ],
        "title": "C-Bet Oversizing",
        "description": (
            "You frequently use oversized c-bets on boards that don't warrant it. "
            "Large sizing on dry/medium boards folds out hands you want to keep in and "
            "telegraphs your strong holdings."
        ),
        "street": "flop",
        "coaching_note": (
            "On dry boards (A72r, K54r) prefer 25–33% pot. Reserve large sizing for "
            "wet, draw-heavy textures where charging equity is critical."
        ),
    },
    {
        "id": "missed_value",
        "keywords": [
            "missed value", "should bet", "bet for value", "checked back with",
            "thin value", "leave value", "under-bet", "underbet river",
        ],
        "title": "Missed Value Bets",
        "description": (
            "You frequently check back strong hands or bet too small on the river, "
            "missing EV against opponents who would call bigger."
        ),
        "street": "river",
        "coaching_note": (
            "When villain calls two streets and checks river, their range is capped. "
            "Use 70–90% pot bets with your value hands to maximise extraction."
        ),
    },
    {
        "id": "overfold",
        "keywords": [
            "overfold", "fold too much", "should call", "alpha",
            "minimum defense", "mdf", "too tight", "folding too wide",
            "overly tight",
        ],
        "title": "Overfolding vs Bets",
        "description": (
            "You fold too often against bets and raises, allowing opponents to "
            "profit with bluffs at well above MDF (minimum defense frequency)."
        ),
        "street": "various",
        "coaching_note": (
            "Calculate the pot odds you're being laid. If a half-pot bet gives you "
            "25% pot odds, you need to defend at least 33% of your range to deny "
            "automatic profit. Widen your calling range with blockers and equity."
        ),
    },
    {
        "id": "overcall",
        "keywords": [
            "overcall", "calling too wide", "should fold", "dominated",
            "dominated call", "drawing dead", "too loose", "spewy call",
        ],
        "title": "Overcalling / Loose Calls",
        "description": (
            "You call too wide in certain spots, investing chips with insufficient "
            "equity or being dominated by the betting range."
        ),
        "street": "various",
        "coaching_note": (
            "Ask: does my hand have enough equity vs villain's betting range? "
            "Against strong ranges (check-raise, 3bet-call), tighten your calls "
            "significantly — positional reads matter here."
        ),
    },
    {
        "id": "river_bluff",
        "keywords": [
            "bluff river", "river bluff", "river shove", "over-bluff",
            "bluff frequency", "bluff too", "missed bluff", "under-bluff",
            "not bluffing", "need more bluffs",
        ],
        "title": "River Bluffing Imbalance",
        "description": (
            "Your river bluffing frequency is out of balance — you either bluff "
            "too rarely (making you exploitably foldy on rivers) or too often "
            "(burning chips with unselective air)."
        ),
        "street": "river",
        "coaching_note": (
            "GTO river bluff:value ratio depends on sizing. At 75% pot, you need "
            "~43% bluffs in your betting range. Prioritise bluffs with blockers "
            "to villain's calling range and unblock their fold range."
        ),
    },
    {
        "id": "preflop_3bet",
        "keywords": [
            "3bet", "three-bet", "should 3-bet", "3-bet preflop",
            "re-raise preflop", "under-3bet", "squeeze",
        ],
        "title": "Preflop 3-Bet Frequency",
        "description": (
            "Issues with your 3-bet range — you either 3bet too infrequently "
            "(allowing open-raisers to steal) or select poor 3bet candidates."
        ),
        "street": "preflop",
        "coaching_note": (
            "From CO/BTN vs EP opens, your 3bet range should include premiums "
            "(TT+, AK) and selected bluffs (A2s-A5s, suited connectors). "
            "Flat-only ranges become exploitable at 6-max."
        ),
    },
    {
        "id": "bb_defense",
        "keywords": [
            "big blind defense", "bb defense", "defend big blind", "bb fold",
            "from bb", "out of bb", "blind defense", "facing open from bb",
        ],
        "title": "BB Defense Issues",
        "description": (
            "Your big blind defense strategy is leaking EV — most commonly by "
            "over-folding to positional opens, surrendering the equity edge "
            "you have as the last preflop caller."
        ),
        "street": "preflop",
        "coaching_note": (
            "Vs BTN opens (wide range), defend BB with ~55% of hands. "
            "You have the best price in the hand and close the action. "
            "Prioritise suited hands, connected hands, and any pair."
        ),
    },
    {
        "id": "check_raise_response",
        "keywords": [
            "check-raise", "check raise", "facing check-raise",
            "vs check-raise", "fold to check-raise", "overcall check-raise",
        ],
        "title": "Check-Raise Response",
        "description": (
            "You make suboptimal decisions when facing check-raises — either "
            "over-folding (letting opponents run exploitable check-raise bluffs) "
            "or continuing too wide (paying off the strong end of their range)."
        ),
        "street": "flop",
        "coaching_note": (
            "Evaluate check-raises vs your hand's equity, position, and pot odds. "
            "In SRPs, flop check-raises are polarised. Fold dominated hands, "
            "continue with nut draws + top pair, fold marginal pairs."
        ),
    },
    {
        "id": "turn_barrel",
        "keywords": [
            "turn barrel", "double barrel", "give up turn", "turn bet",
            "second barrel", "turn sizing", "turn cbet",
        ],
        "title": "Turn Barreling Issues",
        "description": (
            "Your turn betting strategy is unbalanced — either giving up too "
            "often (turning the hand face-up) or barreling without equity."
        ),
        "street": "turn",
        "coaching_note": (
            "Continue firing on turns that improve your range advantage: "
            "overcards to the flop, flush draws completing, cards that give "
            "you nut straight draws. Slow down on turns that favour the caller."
        ),
    },
    {
        "id": "stack_depth_play",
        "keywords": [
            "short stack", "push-fold", "shove", "jam", "effective stack",
            "stack-to-pot", "spr", "stack depth", "committed",
        ],
        "title": "Stack-Depth Awareness",
        "description": (
            "Mistakes related to stack depth — poor SPR calculation, "
            "mis-played short-stack push-fold decisions, or incorrect "
            "commitment thresholds in deep/shallow spots."
        ),
        "street": "preflop",
        "coaching_note": (
            "At <20bb push any pair, A2+, K8s+, QTs+. At <10bb the "
            "push range widens to almost any two cards in late position. "
            "Never raise-fold when your stack is <15bb — shove or fold."
        ),
    },
    {
        "id": "ip_aggression",
        "keywords": [
            "in position", "ip betting", "passive ip", "should bet ip",
            "check ip with", "too passive in position",
        ],
        "title": "Passive Play In Position",
        "description": (
            "You play too passively when in position, forfeiting the equity "
            "and information advantages that IP play provides."
        ),
        "street": "flop",
        "coaching_note": (
            "In position, your betting frequency should be higher because "
            "you realise equity better and can set your own price. "
            "Bet more medium-strength hands for value/protection when IP."
        ),
    },
    {
        "id": "oop_sizing",
        "keywords": [
            "out of position", "oop bet", "oop sizing", "donk bet",
            "probe bet", "leading oop",
        ],
        "title": "OOP Sizing Issues",
        "description": (
            "Out-of-position bet sizing decisions are sub-optimal — often "
            "using incorrect sizes that either fold out equity or build pots "
            "where you have a disadvantage."
        ),
        "street": "various",
        "coaching_note": (
            "OOP with strong hands: use larger sizing (55–75%) to deny "
            "realisation to draws and build the pot. OOP with marginal hands: "
            "prefer check-call or check-raise over donk-betting."
        ),
    },
    {
        "id": "icm_pressure",
        "keywords": [
            "icm", "icm pressure", "bubble", "pay jump", "tournament pressure",
            "independent chip model", "final table", "in the money",
        ],
        "title": "ICM Mistakes",
        "description": (
            "Decisions in ICM-sensitive tournament spots are costing chip EV. "
            "Near the bubble or pay jumps, risk-aversion should be higher "
            "unless you have a significant stack advantage."
        ),
        "street": "preflop",
        "coaching_note": (
            "Near the bubble: widen your fold range vs aggressive shoves "
            "from large stacks. Exploit short stacks by shoving wider "
            "into them — they can't call without a premium hand."
        ),
    },
]

# Build a lookup index: id → catalogue entry
_CATALOGUE_BY_ID = {entry["id"]: entry for entry in _LEAK_CATALOGUE}


# ── Main detection function ───────────────────────────────────────────────────

def detect_leaks(rows: list[dict[str, Any]]) -> list[PlayerLeak]:
    """
    Scan all hand analysis rows, match findings to leak categories,
    and return PlayerLeak objects sorted by estimated EV loss desc.
    """
    # category_id → {frequency, ev_loss, hand_ids, sample_findings}
    category_data: dict[str, dict] = defaultdict(lambda: {
        "frequency": 0,
        "ev_loss": 0.0,
        "hand_ids": [],
        "sample_findings": [],
    })

    for row in rows:
        findings = row.get("findings") or []
        hand_id  = str(row.get("id", ""))

        for finding in findings:
            sev = finding.get("severity", "")
            if sev not in _SEV_WEIGHT:
                continue  # skip 'good' / 'note'

            weight = _SEV_WEIGHT[sev]
            matched = _match_finding(finding)

            for cat_id in matched:
                data = category_data[cat_id]
                data["frequency"] += 1
                data["ev_loss"]   += weight
                if hand_id and hand_id not in data["hand_ids"][:5]:
                    data["hand_ids"].append(hand_id)
                if len(data["sample_findings"]) < 3:
                    data["sample_findings"].append(finding)

    leaks: list[PlayerLeak] = []
    for cat_id, data in category_data.items():
        if cat_id not in _CATALOGUE_BY_ID:
            continue
        meta    = _CATALOGUE_BY_ID[cat_id]
        freq    = data["frequency"]
        ev_loss = round(data["ev_loss"], 1)
        severity = _severity_label(freq, ev_loss)

        leak = PlayerLeak(
            id=cat_id,
            category=cat_id,
            title=meta["title"],
            description=meta["description"],
            severity=severity,
            frequency=freq,
            ev_loss_bb=ev_loss,
            street=meta["street"],
            example_hand_ids=data["hand_ids"][:5],
            coaching_note=meta["coaching_note"],
        )
        leaks.append(leak)

    # Sort by EV loss descending, then frequency
    leaks.sort(key=lambda l: (-l.ev_loss_bb, -l.frequency))
    return leaks[:8]  # top 8 leaks maximum


# ── Stat-derived leaks ────────────────────────────────────────────────────────

def derive_stat_leaks(stats: PlayerStats) -> list[PlayerLeak]:
    """
    Generate additional leaks directly from aggregated stats
    (e.g. VPIP too high, OOP/IP score gap).
    """
    leaks: list[PlayerLeak] = []

    # Over-VPIP → too loose preflop
    if stats.vpip_pct > 40 and stats.pfr_pct < 20:
        leaks.append(PlayerLeak(
            id="stat_loose_passive",
            category="overcall",
            title="Loose-Passive Preflop Leak",
            description=(
                f"Your VPIP ({stats.vpip_pct}%) is very high while PFR ({stats.pfr_pct}%) "
                "is low, indicating a loose-passive style that over-calls and under-raises."
            ),
            severity="critical" if stats.vpip_pct > 50 else "major",
            frequency=int(stats.total_hands * (stats.vpip_pct / 100)),
            ev_loss_bb=round(stats.vpip_pct * 0.15, 1),
            street="preflop",
            coaching_note=(
                "Tighten your preflop calling range. Swap passive calls for 3-bets "
                "with hands like ATs, KQs, 99+. This raises your PFR and reduces "
                "your VPIP simultaneously."
            ),
        ))

    # Under-VPIP → too tight (nit)
    if stats.vpip_pct < 12 and stats.total_hands >= 10:
        leaks.append(PlayerLeak(
            id="stat_nit",
            category="preflop_3bet",
            title="Nit Preflop Style",
            description=(
                f"VPIP of {stats.vpip_pct}% is extremely tight. You're folding profitable "
                "hands preflop and surrendering EV by missing playable scenarios."
            ),
            severity="major",
            frequency=int(stats.total_hands * 0.3),
            ev_loss_bb=round((15 - stats.vpip_pct) * 0.2, 1),
            street="preflop",
            coaching_note=(
                "Widen your opening range in late position. BTN should open ~45–55% "
                "of hands, CO 25–30%, HJ 18–22%. Even suited connectors and small "
                "pairs have profitable open-raising ranges."
            ),
        ))

    # Massive IP/OOP gap → position leaking EV
    if stats.ip_score and stats.oop_score:
        gap = stats.ip_score - stats.oop_score
        if gap > 15:
            leaks.append(PlayerLeak(
                id="stat_oop_struggles",
                category="oop_sizing",
                title="Significant OOP Struggles",
                description=(
                    f"Your IP score ({stats.ip_score}) is {gap:.0f} points higher than "
                    f"OOP score ({stats.oop_score}). Playing out of position is a "
                    "consistent weakness."
                ),
                severity="major" if gap > 20 else "minor",
                frequency=int(stats.total_hands * 0.35),
                ev_loss_bb=round(gap * 0.1, 1),
                street="various",
                coaching_note=(
                    "OOP: favour checking your range more, use check-raise as your "
                    "primary aggression tool, and avoid donk-betting weak hands. "
                    "Study OOP c-bet frequencies in solver output."
                ),
            ))

    # Short-stack score significantly worse
    if stats.short_score and stats.deep_score:
        ss_gap = stats.deep_score - stats.short_score
        if ss_gap > 12:
            leaks.append(PlayerLeak(
                id="stat_short_stack",
                category="stack_depth_play",
                title="Short-Stack Play Weakness",
                description=(
                    f"You score {stats.deep_score} deep-stacked but only "
                    f"{stats.short_score} with a short stack. Push-fold and "
                    "commitment decisions are costing EV."
                ),
                severity="major" if ss_gap > 20 else "minor",
                frequency=int(stats.total_hands * 0.2),
                ev_loss_bb=round(ss_gap * 0.12, 1),
                street="preflop",
                coaching_note=(
                    "Study push-fold charts for 10–20bb stack depth. At these "
                    "depths, avoid standard raises — shove or fold preflop. "
                    "Use ICMIZER or HoldemResources to calibrate your ranges."
                ),
            ))

    return leaks


def merge_and_rank_leaks(
    finding_leaks: list[PlayerLeak],
    stat_leaks: list[PlayerLeak],
) -> list[PlayerLeak]:
    """Merge finding-based and stat-based leaks, deduplicate by category, rank."""
    seen_categories: set[str] = set()
    merged: list[PlayerLeak] = []

    for leak in finding_leaks + stat_leaks:
        if leak.category not in seen_categories:
            seen_categories.add(leak.category)
            merged.append(leak)

    merged.sort(key=lambda l: (-l.ev_loss_bb, -l.frequency))
    return merged[:8]


# ── Private helpers ───────────────────────────────────────────────────────────

def _finding_text(finding: dict) -> str:
    parts = [
        finding.get("action_taken", ""),
        finding.get("recommendation", ""),
        finding.get("explanation", ""),
    ]
    return " ".join(p for p in parts if p).lower()


def _match_finding(finding: dict) -> list[str]:
    """Return list of matching catalogue IDs for this finding."""
    text    = _finding_text(finding)
    matched = []
    for entry in _LEAK_CATALOGUE:
        if any(re.search(re.escape(kw), text) for kw in entry["keywords"]):
            matched.append(entry["id"])
    return matched


def _severity_label(freq: int, ev_loss: float) -> str:
    if ev_loss >= 12 or freq >= 8:
        return "critical"
    if ev_loss >= 5 or freq >= 4:
        return "major"
    return "minor"
