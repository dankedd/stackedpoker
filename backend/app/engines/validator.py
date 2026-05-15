"""
Deterministic hand validator.

Runs before AI coaching to catch structural problems in parsed hands:
- Duplicate cards between hero hole cards and community cards
- Invalid card format
- Out-of-order street sequence in the action list
- Missing hero data
- Unreasonable stack depth

Returns ValidationInfo so the route can gate AI calls on confidence level
and expose per-check diagnostics to the frontend.
"""
from __future__ import annotations

from app.models.schemas import ParsedHand, ValidationInfo

_VALID_RANKS = set("23456789TJQKA")
_VALID_SUITS = set("cdhs")


def validate_hand(hand: ParsedHand) -> ValidationInfo:
    warnings: list[str] = []
    errors: list[str] = []

    # ── 1. Card format validity ────────────────────────────────────────────
    all_known_cards: list[str] = []

    for card in hand.hero_cards:
        if not _is_valid_card(card):
            errors.append(f"Invalid hero card: {card!r}")
        else:
            all_known_cards.append(card.upper()[0] + card[1].lower())

    board_cards = (
        [c for c in hand.board.flop]
        + [c for c in hand.board.turn]
        + [c for c in hand.board.river]
    )
    for card in board_cards:
        if not _is_valid_card(card):
            errors.append(f"Invalid board card: {card!r}")
        else:
            all_known_cards.append(card.upper()[0] + card[1].lower())

    # ── 2. Duplicate card detection ────────────────────────────────────────
    seen: set[str] = set()
    for card in all_known_cards:
        if card in seen:
            errors.append(f"Duplicate card detected: {card}")
        seen.add(card)

    # ── 3. Hero presence ───────────────────────────────────────────────────
    hero_in_players = any(p.name == hand.hero_name for p in hand.players)
    if not hero_in_players:
        errors.append(f"Hero {hand.hero_name!r} not found in players list")

    if not hand.hero_cards:
        warnings.append("Hero hole cards not identified")

    if not hand.hero_position:
        warnings.append("Hero position not identified")

    # ── 4. Hero detection method (used for confidence explanation) ─────────
    hero_detected_by = _infer_hero_detection_method(hand)

    # ── 5. Stack sanity ────────────────────────────────────────────────────
    if hand.effective_stack_bb <= 0:
        errors.append("Effective stack is zero or negative")
    elif hand.effective_stack_bb > 1000:
        warnings.append(f"Unusually large stack: {hand.effective_stack_bb:.0f}BB")

    # ── 6. Action street ordering ─────────────────────────────────────────
    _STREET_ORDER = {"preflop": 0, "flop": 1, "turn": 2, "river": 3}
    prev_street_rank = -1
    prev_street = None
    for action in hand.actions:
        rank = _STREET_ORDER.get(action.street, 0)
        if rank < prev_street_rank:
            errors.append(
                f"Action street out of order: {action.street!r} after {prev_street!r}"
            )
        prev_street_rank = max(prev_street_rank, rank)
        prev_street = action.street

    # ── 7. Board consistency ───────────────────────────────────────────────
    has_flop_action = any(a.street == "flop" for a in hand.actions)
    if has_flop_action and not hand.board.flop:
        warnings.append("Flop actions present but no flop cards recorded")

    has_turn_action = any(a.street == "turn" for a in hand.actions)
    if has_turn_action and not hand.board.turn:
        warnings.append("Turn actions present but no turn card recorded")

    # ── 8. Confidence score ───────────────────────────────────────────────
    confidence = _compute_confidence(hand, errors, warnings)

    return ValidationInfo(
        confidence=confidence,
        hero_detected_by=hero_detected_by,
        warnings=warnings,
        errors=errors,
        is_valid=len(errors) == 0,
    )


# ── Helpers ────────────────────────────────────────────────────────────────

def _is_valid_card(card: str) -> bool:
    if not isinstance(card, str) or len(card) != 2:
        return False
    return card[0].upper() in _VALID_RANKS and card[1].lower() in _VALID_SUITS


def _infer_hero_detection_method(hand: ParsedHand) -> str:
    """Explain how the parser identified the hero (for the confidence tooltip)."""
    if hand.site in ("GGPoker", "PokerStars"):
        return f"{hand.site} hand history parser"
    return "heuristic detection"


def _compute_confidence(
    hand: ParsedHand,
    errors: list[str],
    warnings: list[str],
) -> float:
    """Compute 0-1 confidence score based on parse quality signals."""
    if errors:
        # Hard errors reduce confidence drastically
        return max(0.0, 0.5 - len(errors) * 0.15)

    score = 1.0

    # Penalise for each warning
    score -= len(warnings) * 0.08

    # No hole cards — a significant unknown
    if not hand.hero_cards:
        score -= 0.20

    # No position detected
    if not hand.hero_position or hand.hero_position in ("Unknown", ""):
        score -= 0.10

    # Very few actions (< 2) suggests a truncated history
    hero_actions = [a for a in hand.actions if a.is_hero]
    if len(hero_actions) == 0:
        score -= 0.15
    elif len(hero_actions) == 1 and hand.board.flop:
        score -= 0.05

    # Known site gets a slight boost
    if hand.site in ("GGPoker", "PokerStars"):
        score += 0.05

    return round(max(0.0, min(1.0, score)), 3)
