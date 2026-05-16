"""Deterministic per-action scoring engine.

Converts heuristic findings + spot/texture context into structured ActionCoaching.
Same input always produces the same output — no randomness, no LLM decisions.

The LLM may only improve wording later; it never controls scores or frequencies.
"""
from __future__ import annotations

from app.models.schemas import (
    ActionCoaching,
    BoardTexture,
    HandAction,
    HeuristicFinding,
    ParsedHand,
    PreferredAction,
    SpotClassification,
)
from app.engines.preflop_ranges import detect_preflop_node, get_preflop_recommendation


# ── Public API ─────────────────────────────────────────────────────────────

def score_all_hero_actions(
    hand: ParsedHand,
    findings: list[HeuristicFinding],
    spot: SpotClassification,
    texture: BoardTexture,
) -> dict[int, ActionCoaching]:
    """Return {action_index: ActionCoaching} for every hero action in the hand."""
    return {
        i: _score_action(action, findings, spot, texture, hand)
        for i, action in enumerate(hand.actions)
        if action.is_hero
    }


# ── Core scoring ───────────────────────────────────────────────────────────

def _score_action(
    action: HandAction,
    findings: list[HeuristicFinding],
    spot: SpotClassification,
    texture: BoardTexture,
    hand: ParsedHand,
) -> ActionCoaching:
    relevant = _find_relevant(action, findings)
    severity = relevant[0].severity if relevant else "note"

    score = _severity_to_score(severity, action, spot)
    quality = _score_to_quality(score)
    mistake_level = _severity_to_mistake_level(severity)

    # Resolve action index for preflop node detection
    try:
        action_idx = hand.actions.index(action)
    except ValueError:
        action_idx = 0

    return ActionCoaching(
        score=score,
        quality=quality,
        mistake_level=mistake_level,
        preferred_actions=_preferred_actions(action, relevant, spot, texture, hand, action_idx),
        reason_codes=_reason_codes(action, relevant, spot, texture),
        explanation=relevant[0].explanation if relevant else _default_explanation(action, spot, texture),
        adjustment=relevant[0].recommendation if relevant else _default_adjustment(action, spot, texture),
    )


# ── Finding matcher ────────────────────────────────────────────────────────

def _find_relevant(
    action: HandAction, findings: list[HeuristicFinding]
) -> list[HeuristicFinding]:
    result = []
    for f in findings:
        if f.street.lower() != action.street.lower():
            continue
        at = f.action_taken.lower()
        verb = action.action
        if verb == "bet" and any(k in at for k in ("bet", "cbet", "c-bet", "barrel", "donk")):
            result.append(f)
        elif verb == "check" and "check" in at:
            result.append(f)
        elif verb == "raise" and any(k in at for k in ("raise", "open", "min-raise")):
            result.append(f)
        elif verb == "call" and "call" in at:
            result.append(f)
        elif verb == "fold" and "fold" in at:
            result.append(f)
    return result


# ── Score + quality mapping ────────────────────────────────────────────────

_SEVERITY_BASE: dict[str, int] = {
    "good":      90,
    "note":      80,
    "suboptimal": 72,
    "mistake":   55,
}

def _severity_to_score(severity: str, action: HandAction, spot: SpotClassification) -> int:
    base = _SEVERITY_BASE.get(severity, 80)
    # Small deterministic context adjustment
    if action.street in ("flop", "turn") and spot.hero_is_ip and severity == "note":
        base = min(base + 2, 95)
    return max(0, min(100, base))


def _score_to_quality(score: int) -> str:
    if score >= 90: return "Elite"
    if score >= 80: return "Good"
    if score >= 65: return "Standard"
    if score >= 50: return "Mistake"
    return "Punt"


def _severity_to_mistake_level(severity: str) -> str:
    return {
        "good":       "None",
        "note":       "None",
        "suboptimal": "Minor",
        "mistake":    "Major",
    }.get(severity, "None")


# ── Preferred actions lookup ───────────────────────────────────────────────

def _preferred_actions(
    action: HandAction,
    findings: list[HeuristicFinding],
    spot: SpotClassification,
    texture: BoardTexture,
    hand: ParsedHand,
    action_idx: int,
) -> list[PreferredAction]:
    street = action.street
    act = action.action
    bucket = texture.bucket
    is_pfr = spot.hero_is_pfr
    is_ip = spot.hero_is_ip
    severity = findings[0].severity if findings else None

    def pa(a: str, f: int) -> PreferredAction:
        return PreferredAction(action=a, frequency=f)

    if street == "preflop":
        # Node-validated: only legal-action alternatives, range-based frequencies.
        node = detect_preflop_node(action_idx, hand.actions, hand.hero_position)
        rec = get_preflop_recommendation(node, act, hand.hero_cards)
        return rec.alternatives

    # ── Postflop: node-aware, made-hand-priority alternatives ──────────────
    # Resolve made-hand strength to drive sizing recommendations.
    # Strong made hands (2pair+) bias toward value; draws bias toward semibluff.
    made_category = _resolve_made_category(hand)

    # Whether findings flag the action as wrong
    is_mistake = severity in ("mistake", "suboptimal")
    # Strong made hand (category >= 2 = two pair or better)
    is_strong_made = made_category >= 2
    # Weak made hand (category == 1, pair)
    is_pair = made_category == 1

    if street == "flop":
        if act == "bet":
            return _flop_bet_alts(pa, bucket, is_pfr, is_ip, is_strong_made, is_mistake)
        if act == "check":
            return _flop_check_alts(pa, bucket, is_pfr, is_ip, is_strong_made)
        if act == "call":
            # Call is always legal when facing a bet
            if is_strong_made:
                return [pa("Call", 55), pa("Raise", 45)]
            return [pa("Call", 70), pa("Fold", 30)]
        if act == "fold":
            if is_strong_made:
                # Folding with strong made hand is likely wrong
                return [pa("Call", 65), pa("Raise", 35)]
            return [pa("Fold", 65), pa("Call", 35)]

    elif street == "turn":
        if act == "bet":
            if is_strong_made:
                return [pa("Bet 75%", 55), pa("Bet 50%", 30), pa("Check", 15)]
            if is_pair:
                return [pa("Bet 50%", 45), pa("Check", 35), pa("Bet 75%", 20)]
            # Draw or air
            return [pa("Check", 50), pa("Bet 50%", 30), pa("Bet 75%", 20)]
        if act == "check":
            if is_strong_made and is_pfr and is_ip:
                return [pa("Bet 75%", 55), pa("Check", 45)]
            return [pa("Check", 55), pa("Bet 50%", 45)]
        if act == "call":
            if is_strong_made:
                return [pa("Call", 60), pa("Raise", 40)]
            return [pa("Call", 60), pa("Fold", 40)]
        if act == "fold":
            if is_strong_made:
                return [pa("Call", 60), pa("Raise", 40)]
            return [pa("Fold", 65), pa("Call", 35)]

    elif street == "river":
        if act == "bet":
            if is_strong_made:
                return [pa("Bet 75%", 55), pa("Bet 50%", 30), pa("Check", 15)]
            # Bluff or thin value — check is always an alternative
            return [pa("Check", 55), pa("Bet 75%", 45)]
        if act == "check":
            if is_strong_made and is_pfr and is_ip:
                return [pa("Bet 75%", 55), pa("Check", 45)]
            return [pa("Check", 60), pa("Bet 75%", 40)]
        if act == "call":
            if is_strong_made:
                return [pa("Call", 65), pa("Fold", 35)]
            return [pa("Fold", 55), pa("Call", 45)]
        if act == "fold":
            if is_strong_made:
                return [pa("Call", 70), pa("Fold", 30)]
            return [pa("Fold", 65), pa("Call", 35)]

    return [pa(act.capitalize(), 100)]


# ── Postflop alternative helpers ───────────────────────────────────────────

def _resolve_made_category(hand: ParsedHand) -> int:
    """Return made-hand category (0-8) for hero using available board cards."""
    try:
        from app.engines.hand_evaluator import evaluate_hole_and_board
        board = list(hand.board.flop)
        if hand.board.turn:
            board += list(hand.board.turn)
        if hand.board.river:
            board += list(hand.board.river)
        if hand.hero_cards and board:
            return evaluate_hole_and_board(hand.hero_cards, board).category
    except Exception:
        pass
    return 0


def _flop_bet_alts(
    pa,
    bucket: str,
    is_pfr: bool,
    is_ip: bool,
    is_strong_made: bool,
    is_mistake: bool,
) -> list:
    """Node-aware flop bet alternatives.  Sizing derived from texture + made-hand strength.

    Donk bet (OOP caller betting into PFR) always includes check as primary alternative.
    IP PFR on a dry board with strong made hand prefers small sizing for value.
    """
    is_donk = not is_pfr and not is_ip  # OOP caller leading into PFR = donk

    if is_strong_made:
        if is_donk:
            # Donk with strong hand: check-raise is often better
            return [pa("Check", 55), pa("Bet 50%", 30), pa("Bet 75%", 15)]
        if bucket in ("A_high_dry", "K_high_dry"):
            return [pa("Bet 33%", 50), pa("Bet 50%", 35), pa("Check", 15)]
        if bucket in ("wet_broadway", "A_high_wet", "low_connected"):
            return [pa("Bet 50%", 50), pa("Bet 75%", 30), pa("Check", 20)]
        return [pa("Bet 50%", 55), pa("Bet 33%", 25), pa("Check", 20)]

    # Weak made hand or draw: bucket-appropriate sizing
    if is_donk:
        return [pa("Check", 65), pa("Bet 33%", 35)]
    if bucket in ("A_high_dry", "K_high_dry"):
        if is_mistake:
            return [pa("Bet 33%", 65), pa("Check", 35)]
        return [pa("Bet 33%", 55), pa("Bet 50%", 30), pa("Check", 15)]
    if bucket in ("wet_broadway", "A_high_wet"):
        if is_mistake:
            return [pa("Check", 50), pa("Bet 33%", 35), pa("Bet 50%", 15)]
        return [pa("Bet 33%", 45), pa("Bet 50%", 30), pa("Check", 25)]
    if bucket in ("low_connected", "monotone"):
        return [pa("Check", 55), pa("Bet 33%", 30), pa("Bet 50%", 15)]
    return [pa("Bet 33%", 50), pa("Bet 50%", 30), pa("Check", 20)]


def _flop_check_alts(
    pa,
    bucket: str,
    is_pfr: bool,
    is_ip: bool,
    is_strong_made: bool,
) -> list:
    """Node-aware flop check alternatives."""
    if is_strong_made and is_pfr and is_ip:
        # IP PFR with strong made hand checking: bet is the main alternative
        if bucket in ("A_high_dry", "K_high_dry"):
            return [pa("Bet 33%", 60), pa("Check", 40)]
        return [pa("Bet 50%", 55), pa("Check", 45)]
    if is_pfr and is_ip and bucket in ("A_high_dry", "K_high_dry"):
        return [pa("Bet 33%", 65), pa("Check", 35)]
    return [pa("Check", 55), pa("Bet 33%", 45)]


# ── Reason codes ───────────────────────────────────────────────────────────

def _reason_codes(
    action: HandAction,
    findings: list[HeuristicFinding],
    spot: SpotClassification,
    texture: BoardTexture,
) -> list[str]:
    codes: list[str] = []

    # Range advantage (relative to hero role)
    if texture.range_advantage == "pfr" and spot.hero_is_pfr:
        codes.append("RANGE_ADVANTAGE")
    elif texture.range_advantage == "caller" and not spot.hero_is_pfr:
        codes.append("RANGE_ADVANTAGE")
    elif texture.range_advantage == "caller" and spot.hero_is_pfr:
        codes.append("RANGE_DISADVANTAGE")

    # Board texture
    if texture.wetness == "dry":
        codes.append("DRY_BOARD")
    elif texture.wetness == "wet":
        codes.append("WET_BOARD")

    if texture.suitedness == "monotone":
        codes.append("MONOTONE_BOARD")
    elif texture.suitedness == "two_tone":
        codes.append("FLUSH_DRAW_PRESENT")

    if texture.connectivity in ("connected", "oesd"):
        codes.append("STRAIGHT_DRAWS_PRESENT")

    if texture.is_paired:
        codes.append("PAIRED_BOARD")

    # Position + role
    codes.append("IN_POSITION" if spot.hero_is_ip else "OUT_OF_POSITION")
    codes.append("AGGRESSOR" if spot.hero_is_pfr else "CALLER")

    # From findings
    for f in findings:
        at = f.action_taken.lower()
        expl = (f.explanation or "").lower()
        if "large" in at or "over" in at:
            codes.append("OVER_SIZING")
        if "donk" in at:
            codes.append("DONK_BET")
        if "min-raise" in at or "min raise" in at:
            codes.append("MIN_RAISE")
        if "blocker" in expl:
            codes.append("BLOCKER_SPOT")

    return list(dict.fromkeys(codes))  # deduplicate, preserve order


# ── Default text ───────────────────────────────────────────────────────────

def _default_explanation(
    action: HandAction, spot: SpotClassification, texture: BoardTexture
) -> str:
    street = action.street
    act = action.action
    pfr_str = "the preflop aggressor" if spot.hero_is_pfr else "the caller"
    ip_str = "in position" if spot.hero_is_ip else "out of position"

    if street == "preflop":
        if act in ("raise", "bet"):
            return (
                "Your preflop sizing is within a reasonable range for this spot. "
                "Maintain consistent opens to avoid becoming exploitable."
            )
        if act == "call":
            return "Calling defends your range appropriately for this position and depth."
        return "Folding keeps you out of marginal spots outside your opening range."

    if street == "flop":
        bucket = texture.bucket.replace("_", "-")
        return (
            f"As {pfr_str}, {ip_str}, your action is consistent with a balanced "
            f"strategy on this {bucket} board."
        )

    if street == "turn":
        return (
            "Your turn action maintains a balanced range across value and protection. "
            "Keep sizing consistent with your flop line."
        )

    return (
        "River action. Your bluff-to-value ratio should account for opponent "
        "calling frequencies and blockers you hold."
    )


def _default_adjustment(
    action: HandAction, spot: SpotClassification, texture: BoardTexture
) -> str:
    street = action.street
    act = action.action

    if street == "preflop":
        if act in ("raise", "bet"):
            return "Use 2.5bb from late position, 3bb from early position as default sizing."
        return "Maintain a balanced defend/3bet range for your position."

    if street == "flop":
        if act == "bet":
            if texture.range_advantage == "pfr" and spot.hero_is_pfr:
                return "High range affinity: use 25-33% pot at high frequency on this texture."
            return "Use 33-50% pot sizing to keep your range balanced across strong hands and bluffs."
        return "Include strong draws and weak made hands in your check range for balance."

    if street == "turn":
        return "Use ~50-75% pot for polar bets. Check non-continuing hands to protect your range."

    return "River: pot-sized bluffs with blockers to the nuts; 50-75% pot for thin value."
