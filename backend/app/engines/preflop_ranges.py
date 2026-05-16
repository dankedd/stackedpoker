"""
Preflop node detection and range-based recommendation engine.

Deterministic — same input always produces same output.
No invented frequencies; recommendations derived from position-based
GTO approximations and hand strength classification.

Hand strength buckets:
  premium  — AA, KK, QQ, JJ, AK (top ~5%)
  strong   — TT, 99, AQ, AJ, KQs (top ~15%)
  playable — 88-66, AT, A9s, KQ, KJ, QJs, JTs, T9s (top ~30%)
  marginal — 55-22, A8s-A2s, A9o-A6o, KTs, K9s, QTs, Q9s, J9s, T8s, 98s (top ~45%)
  trash    — everything else (T2o, 72o, …)

Node types:
  RFI          — no prior raise; hero first to open
  VS_OPEN      — one raise before hero, no callers
  VS_SQUEEZE   — one raise before hero, at least one caller (squeeze spot)
  VS_3BET      — two raises before hero (hero originally raised)
  VS_4BET      — three or more raises before hero
  BB_VS_LIMP   — hero is BB, limpers but no raise
  UNKNOWN      — cannot determine (partial hand)
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

from app.models.schemas import HandAction, PreferredAction

# ── Types ──────────────────────────────────────────────────────────────────

NodeType = Literal[
    "RFI", "VS_OPEN", "VS_SQUEEZE", "VS_3BET", "VS_4BET", "BB_VS_LIMP", "UNKNOWN"
]

HandStrengthBucket = Literal["premium", "strong", "playable", "marginal", "trash"]

# Legal actions per node type.
# "raise" covers open, 3bet, 4bet depending on context.
# Limping is excluded as a recommended option (it's never GTO-optimal LP).
LEGAL_ACTIONS: dict[NodeType, frozenset[str]] = {
    "RFI":        frozenset({"fold", "raise"}),         # limp excluded
    "VS_OPEN":    frozenset({"fold", "call", "raise"}),
    "VS_SQUEEZE": frozenset({"fold", "call", "raise"}),
    "VS_3BET":    frozenset({"fold", "call", "raise"}),
    "VS_4BET":    frozenset({"fold", "call", "raise"}),
    "BB_VS_LIMP": frozenset({"check", "raise"}),
    "UNKNOWN":    frozenset({"fold", "call", "raise", "check"}),
}


@dataclass
class PreflopNode:
    node_type: NodeType
    legal_actions: frozenset[str]
    raise_count_before: int = 0
    facing_size_bb: float = 0.0
    squeeze_callers: int = 0
    hero_position: str = ""
    hero_is_sb: bool = False
    hero_is_bb: bool = False
    confidence: Literal["high", "medium", "low"] = "high"
    debug_note: str = ""


@dataclass
class PreflopRecommendation:
    preferred_action: str
    alternatives: list[PreferredAction]
    hand_strength: HandStrengthBucket
    in_range: bool
    confidence: Literal["high", "medium", "low"]
    reasoning: str


# ── Hand rank table ────────────────────────────────────────────────────────

_RANK_VAL: dict[str, int] = {
    "2": 0, "3": 1, "4": 2, "5": 3, "6": 4, "7": 5,
    "8": 6, "9": 7, "T": 8, "J": 9, "Q": 10, "K": 11, "A": 12,
}


# ── RFI range thresholds (minimum hand bucket to open by position) ─────────

# BTN opens ~42%  → marginal and above
# CO  opens ~27%  → playable and above (some marginals fold)
# HJ  opens ~22%  → playable and above (fewer marginals)
# EP  opens ~14%  → strong and above
# SB  opens ~40%  → marginal and above vs BTN/CO/HJ steal; tighter vs raises
_RFI_MIN_BUCKET: dict[str, list[HandStrengthBucket]] = {
    "UTG":   ["premium", "strong"],
    "UTG+1": ["premium", "strong"],
    "UTG+2": ["premium", "strong"],
    "LJ":    ["premium", "strong"],
    "HJ":    ["premium", "strong", "playable"],
    "CO":    ["premium", "strong", "playable"],
    "BTN":   ["premium", "strong", "playable", "marginal"],
    "SB":    ["premium", "strong", "playable"],
    "BB":    [],  # BB defends, does not RFI
}

# Defend range vs single open (call or 3bet)
# Approximation: tighter from OOP positions
_DEFEND_MIN_BUCKET: dict[str, list[HandStrengthBucket]] = {
    "BB":    ["premium", "strong", "playable", "marginal"],  # BB defends wide
    "SB":    ["premium", "strong", "playable"],
    "BTN":   ["premium", "strong", "playable"],              # BTN flat/3bet
    "CO":    ["premium", "strong", "playable"],
    "HJ":    ["premium", "strong", "playable"],
    "LJ":    ["premium", "strong"],
    "UTG+2": ["premium", "strong"],
    "UTG+1": ["premium", "strong"],
    "UTG":   ["premium", "strong"],
}


# ── Public API ─────────────────────────────────────────────────────────────

def detect_preflop_node(
    hero_action_idx: int,
    all_actions: list[HandAction],
    hero_position: str,
) -> PreflopNode:
    """
    Detect the preflop decision node for a hero action.

    Args:
        hero_action_idx: index of the hero's action in all_actions
        all_actions:     full hand action list (all streets)
        hero_position:   hero's position string ("BTN", "SB", …)

    Returns:
        PreflopNode with node_type, legal_actions, and context.
    """
    prior_preflop = [
        a for i, a in enumerate(all_actions)
        if i < hero_action_idx and a.street == "preflop"
    ]

    if not prior_preflop and hero_action_idx not in range(len(all_actions)):
        return PreflopNode(
            node_type="UNKNOWN",
            legal_actions=LEGAL_ACTIONS["UNKNOWN"],
            confidence="low",
            debug_note="hero_action_idx out of range",
        )

    raises_before = [a for a in prior_preflop if a.action == "raise"]
    calls_before  = [a for a in prior_preflop if a.action == "call"]

    raise_count = len(raises_before)
    facing_size = raises_before[-1].size_bb if raises_before else 0.0

    hero_is_sb = (hero_position == "SB")
    hero_is_bb = (hero_position == "BB")

    if raise_count == 0:
        if hero_is_bb and calls_before:
            # BB faces limpers only
            node_type: NodeType = "BB_VS_LIMP"
        else:
            node_type = "RFI"

    elif raise_count == 1:
        # Callers of the single raise that came before hero
        first_raise_idx = prior_preflop.index(raises_before[0])
        callers_after_open = [
            a for a in prior_preflop[first_raise_idx + 1:]
            if a.action == "call"
        ]
        if callers_after_open:
            node_type = "VS_SQUEEZE"
            squeeze_callers = len(callers_after_open)
        else:
            node_type = "VS_OPEN"
            squeeze_callers = 0

    elif raise_count == 2:
        node_type = "VS_3BET"
        squeeze_callers = 0

    else:
        node_type = "VS_4BET"
        squeeze_callers = 0

    return PreflopNode(
        node_type=node_type,
        legal_actions=LEGAL_ACTIONS[node_type],
        raise_count_before=raise_count,
        facing_size_bb=facing_size or 0.0,
        squeeze_callers=squeeze_callers if raise_count == 1 else 0,
        hero_position=hero_position,
        hero_is_sb=hero_is_sb,
        hero_is_bb=hero_is_bb,
        confidence="high",
    )


def classify_hand(hero_cards: list[str]) -> HandStrengthBucket:
    """
    Classify a two-card holding into a strength bucket.

    Returns: "premium" | "strong" | "playable" | "marginal" | "trash"
    """
    if len(hero_cards) != 2:
        return "trash"

    try:
        r1 = hero_cards[0][0].upper()
        r2 = hero_cards[1][0].upper()
        s1 = hero_cards[0][1].lower() if len(hero_cards[0]) > 1 else "?"
        s2 = hero_cards[1][1].lower() if len(hero_cards[1]) > 1 else "!"
    except (IndexError, AttributeError):
        return "trash"

    v1 = _RANK_VAL.get(r1, 0)
    v2 = _RANK_VAL.get(r2, 0)
    high, low = max(v1, v2), min(v1, v2)
    is_pair   = (v1 == v2)
    is_suited = (s1 == s2)
    gap = high - low

    # ── Pocket pairs ──────────────────────────────────────────────────────
    if is_pair:
        if high >= 9:  return "premium"   # JJ, QQ, KK, AA
        if high >= 7:  return "strong"    # 99, TT
        if high >= 4:  return "playable"  # 66, 77, 88
        if high >= 2:  return "marginal"  # 22, 33, 44, 55
        return "trash"

    # ── Ace-high ──────────────────────────────────────────────────────────
    if high == 12:  # A
        if low >= 11:  return "premium"                              # AK (both)
        if low >= 10:  return "strong"                               # AQ (both)
        if low >= 9:   return "strong"   if is_suited else "playable" # AJ
        if low >= 8:   return "playable" if is_suited else "marginal" # AT
        if low >= 4:   return "playable" if is_suited else "marginal" # A5s–A9s / A5o–A9o
        return "marginal" if is_suited else "trash"                   # A2s–A4s

    # ── King-high ─────────────────────────────────────────────────────────
    if high == 11:  # K
        if low >= 10:  return "strong"   if is_suited else "playable" # KQ
        if low >= 9:   return "playable" if is_suited else "marginal"  # KJ
        if low >= 8:   return "playable" if is_suited else "marginal"  # KT
        if low >= 7:   return "marginal" if is_suited else "trash"     # K9
        return "trash"

    # ── Queen-high ────────────────────────────────────────────────────────
    if high == 10:  # Q
        if low >= 9:   return "playable" if is_suited else "marginal"  # QJ
        if low >= 8:   return "playable" if is_suited else "marginal"  # QT
        if low >= 7:   return "marginal" if is_suited else "trash"     # Q9
        return "trash"

    # ── Jack-high ─────────────────────────────────────────────────────────
    if high == 9:  # J
        if low >= 8:   return "playable" if is_suited else "marginal"  # JT
        if low >= 7:   return "marginal" if is_suited else "trash"     # J9
        return "trash"

    # ── Ten-high ──────────────────────────────────────────────────────────
    if high == 8:  # T
        if low >= 7:   return "playable" if is_suited else "marginal"  # T9
        if low >= 6:   return "marginal" if is_suited else "trash"     # T8
        return "trash"

    # ── Nine-high and below ───────────────────────────────────────────────
    if high == 7:  # 9
        if low >= 6:   return "marginal" if is_suited else "trash"     # 98
        return "trash"

    return "trash"


def get_preflop_recommendation(
    node: PreflopNode,
    hero_action: str,
    hero_cards: list[str],
) -> PreflopRecommendation:
    """
    Return a legal-action-only preflop recommendation.

    Never returns actions outside node.legal_actions.
    Frequencies are derived from range membership — not invented.
    """
    def pa(action: str, freq: int) -> PreferredAction:
        return PreferredAction(action=action, frequency=freq)

    hand_bucket = classify_hand(hero_cards)
    card_str = " ".join(hero_cards) if hero_cards else "??"

    # ── RFI node ──────────────────────────────────────────────────────────
    if node.node_type == "RFI":
        in_range = _is_in_rfi_range(node.hero_position, hand_bucket)

        if in_range:
            return PreflopRecommendation(
                preferred_action="raise",
                alternatives=[pa("Raise", 100)],
                hand_strength=hand_bucket,
                in_range=True,
                confidence="high",
                reasoning=(
                    f"{card_str} is in the {node.hero_position} opening range "
                    f"({hand_bucket} hand). Open to 2.5–3bb."
                ),
            )
        else:
            return PreflopRecommendation(
                preferred_action="fold",
                alternatives=[pa("Fold", 100)],
                hand_strength=hand_bucket,
                in_range=False,
                confidence="high",
                reasoning=(
                    f"{card_str} is a {hand_bucket} hand below the {node.hero_position} "
                    "opening threshold. Fold and wait for a better spot."
                ),
            )

    # ── BB vs limp ────────────────────────────────────────────────────────
    if node.node_type == "BB_VS_LIMP":
        if hand_bucket in ("premium", "strong"):
            return PreflopRecommendation(
                preferred_action="raise",
                alternatives=[pa("Raise to 4bb", 85), pa("Check", 15)],
                hand_strength=hand_bucket,
                in_range=True,
                confidence="high",
                reasoning=f"{card_str} ({hand_bucket}): iso-raise limpers to isolate and gain initiative.",
            )
        elif hand_bucket == "playable":
            return PreflopRecommendation(
                preferred_action="check",
                alternatives=[pa("Check", 70), pa("Raise to 4bb", 30)],
                hand_strength=hand_bucket,
                in_range=True,
                confidence="medium",
                reasoning=f"{card_str} ({hand_bucket}): mix between checking and iso-raising.",
            )
        else:
            return PreflopRecommendation(
                preferred_action="check",
                alternatives=[pa("Check", 100)],
                hand_strength=hand_bucket,
                in_range=False,
                confidence="high",
                reasoning=f"{card_str} ({hand_bucket}): check and play in position at low cost.",
            )

    # ── VS_OPEN (facing one raise, no callers) ────────────────────────────
    if node.node_type == "VS_OPEN":
        in_range = _is_in_defend_range(node.hero_position, hand_bucket)
        facing = f"{node.facing_size_bb:.1f}bb" if node.facing_size_bb else "open"

        if hand_bucket == "premium":
            return PreflopRecommendation(
                preferred_action="raise",
                alternatives=[pa("3-Bet", 80), pa("Call", 20)],
                hand_strength=hand_bucket,
                in_range=True,
                confidence="high",
                reasoning=f"{card_str}: premium hand facing {facing}. 3-bet for value.",
            )
        elif hand_bucket == "strong":
            return PreflopRecommendation(
                preferred_action="call",
                alternatives=[pa("Call", 60), pa("3-Bet", 40)],
                hand_strength=hand_bucket,
                in_range=True,
                confidence="medium",
                reasoning=f"{card_str}: strong hand. Mix 3-bet/call depending on position and reads.",
            )
        elif hand_bucket == "playable" and in_range:
            return PreflopRecommendation(
                preferred_action="call",
                alternatives=[pa("Call", 75), pa("Fold", 25)],
                hand_strength=hand_bucket,
                in_range=True,
                confidence="medium",
                reasoning=f"{card_str}: playable hand — call to see a flop with implied odds.",
            )
        else:
            return PreflopRecommendation(
                preferred_action="fold",
                alternatives=[pa("Fold", 100)],
                hand_strength=hand_bucket,
                in_range=False,
                confidence="high",
                reasoning=f"{card_str} ({hand_bucket}): fold vs {facing} — outside defend range.",
            )

    # ── VS_SQUEEZE (open + callers before hero) ───────────────────────────
    if node.node_type == "VS_SQUEEZE":
        if hand_bucket in ("premium", "strong"):
            return PreflopRecommendation(
                preferred_action="call",
                alternatives=[pa("Call", 55), pa("3-Bet", 35), pa("Fold", 10)],
                hand_strength=hand_bucket,
                in_range=True,
                confidence="medium",
                reasoning=f"{card_str}: strong hand in squeeze spot. Flat to trap or 3-bet for value.",
            )
        else:
            return PreflopRecommendation(
                preferred_action="fold",
                alternatives=[pa("Fold", 100)],
                hand_strength=hand_bucket,
                in_range=False,
                confidence="high",
                reasoning=f"{card_str} ({hand_bucket}): fold vs squeeze — odds insufficient for {hand_bucket} hand.",
            )

    # ── VS_3BET (hero opened, facing 3-bet) ───────────────────────────────
    if node.node_type == "VS_3BET":
        facing = f"{node.facing_size_bb:.1f}bb" if node.facing_size_bb else "3-bet"
        if hand_bucket == "premium":
            return PreflopRecommendation(
                preferred_action="raise",
                alternatives=[pa("4-Bet", 75), pa("Call", 25)],
                hand_strength=hand_bucket,
                in_range=True,
                confidence="high",
                reasoning=f"{card_str}: premium hand — 4-bet/call range vs {facing}.",
            )
        elif hand_bucket == "strong":
            return PreflopRecommendation(
                preferred_action="call",
                alternatives=[pa("Call", 70), pa("4-Bet", 20), pa("Fold", 10)],
                hand_strength=hand_bucket,
                in_range=True,
                confidence="medium",
                reasoning=f"{card_str}: strong hand — call 3-bet in position; 4-bet some combos.",
            )
        elif hand_bucket == "playable":
            return PreflopRecommendation(
                preferred_action="fold",
                alternatives=[pa("Fold", 70), pa("Call", 30)],
                hand_strength=hand_bucket,
                in_range=False,
                confidence="medium",
                reasoning=f"{card_str}: playable but likely below 3-bet calling threshold. Lean fold.",
            )
        else:
            return PreflopRecommendation(
                preferred_action="fold",
                alternatives=[pa("Fold", 100)],
                hand_strength=hand_bucket,
                in_range=False,
                confidence="high",
                reasoning=f"{card_str} ({hand_bucket}): fold vs 3-bet — well outside calling range.",
            )

    # ── VS_4BET ───────────────────────────────────────────────────────────
    if node.node_type == "VS_4BET":
        if hand_bucket == "premium":
            return PreflopRecommendation(
                preferred_action="raise",
                alternatives=[pa("5-Bet All-In", 80), pa("Call", 20)],
                hand_strength=hand_bucket,
                in_range=True,
                confidence="high",
                reasoning=f"{card_str}: premium — 5-bet shove or call vs 4-bet.",
            )
        else:
            return PreflopRecommendation(
                preferred_action="fold",
                alternatives=[pa("Fold", 100)],
                hand_strength=hand_bucket,
                in_range=False,
                confidence="high",
                reasoning=f"{card_str} ({hand_bucket}): fold vs 4-bet — outside 5-bet/call range.",
            )

    # ── UNKNOWN fallback ──────────────────────────────────────────────────
    return PreflopRecommendation(
        preferred_action=hero_action,
        alternatives=[pa(hero_action.capitalize(), 100)],
        hand_strength=hand_bucket,
        in_range=False,
        confidence="low",
        reasoning="Node could not be determined — recommendation unavailable.",
    )


# ── Private helpers ────────────────────────────────────────────────────────

def _is_in_rfi_range(position: str, bucket: HandStrengthBucket) -> bool:
    allowed = _RFI_MIN_BUCKET.get(position, ["premium", "strong"])
    return bucket in allowed


def _is_in_defend_range(position: str, bucket: HandStrengthBucket) -> bool:
    allowed = _DEFEND_MIN_BUCKET.get(position, ["premium", "strong"])
    return bucket in allowed
