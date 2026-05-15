"""
Deterministic hand validator.

Pipeline position: runs AFTER parsing, BEFORE AI coaching.
Returns ValidationInfo with a confidence score and per-check diagnostics.

If is_valid is False, the API route should NOT call AI coaching.
"""
from __future__ import annotations

from app.models.schemas import ParsedHand, ValidationInfo

_VALID_RANKS = set("23456789TJQKA")
_VALID_SUITS = set("cdhs")
_STREET_ORDER = {"preflop": 0, "flop": 1, "turn": 2, "river": 3}


def validate_hand(hand: ParsedHand) -> ValidationInfo:
    warnings: list[str] = []
    errors: list[str] = []

    # 1. Card format ──────────────────────────────────────────────────────────
    all_known_cards: list[str] = []

    for card in hand.hero_cards:
        if not _is_valid_card(card):
            errors.append(f"Invalid hero card format: {card!r}")
        else:
            all_known_cards.append(_normalise(card))

    board_cards = hand.board.flop + hand.board.turn + hand.board.river
    for card in board_cards:
        if not _is_valid_card(card):
            errors.append(f"Invalid board card format: {card!r}")
        else:
            all_known_cards.append(_normalise(card))

    # 2. Duplicate card detection ──────────────────────────────────────────────
    seen: set[str] = set()
    for card in all_known_cards:
        if card in seen:
            errors.append(f"Duplicate card: {card}")
        seen.add(card)

    # 3. Board progression consistency ────────────────────────────────────────
    if hand.board.turn and not hand.board.flop:
        errors.append("Turn card present but no flop cards")
    if hand.board.river and not hand.board.turn:
        errors.append("River card present but no turn card")
    if hand.board.river and not hand.board.flop:
        errors.append("River card present but no flop cards")

    # 4. Hero presence ────────────────────────────────────────────────────────
    hero_in_players = any(p.name == hand.hero_name for p in hand.players)
    if not hero_in_players:
        errors.append(f"Hero {hand.hero_name!r} not found in players list")

    if not hand.hero_cards:
        warnings.append("Hero hole cards not identified")

    if not hand.hero_position or hand.hero_position in ("", "?"):
        warnings.append("Hero position could not be determined")

    # 5. Player seat validity ─────────────────────────────────────────────────
    seats_seen: set[int] = set()
    for p in hand.players:
        if p.seat in seats_seen:
            errors.append(f"Duplicate seat number: {p.seat}")
        seats_seen.add(p.seat)
        if p.stack_bb < 0:
            errors.append(f"Negative stack for player {p.name!r}: {p.stack_bb}BB")
        if p.stack_bb == 0:
            warnings.append(f"Player {p.name!r} seated with 0 chips")
        if p.stack_bb > 5000:
            warnings.append(f"Unusually large stack for {p.name!r}: {p.stack_bb:.0f}BB")
        if p.position == "?":
            warnings.append(f"Position unknown for player {p.name!r} at seat {p.seat}")

    # 6. Effective stack sanity ───────────────────────────────────────────────
    if hand.effective_stack_bb <= 0:
        errors.append("Effective stack is zero or negative")
    elif hand.effective_stack_bb > 2000:
        warnings.append(f"Effective stack unusually large: {hand.effective_stack_bb:.0f}BB")

    # 7. Action street ordering ───────────────────────────────────────────────
    prev_rank = -1
    prev_street = None
    for action in hand.actions:
        rank = _STREET_ORDER.get(action.street, -1)
        if rank < prev_rank:
            errors.append(
                f"Actions out of order: {action.street!r} after {prev_street!r}"
            )
            break
        prev_rank = max(prev_rank, rank)
        prev_street = action.street

    # 8. Action amount sanity ─────────────────────────────────────────────────
    for action in hand.actions:
        if action.action in ("bet", "raise", "call") and action.size_bb is not None:
            if action.size_bb < 0:
                errors.append(
                    f"Negative action size for {action.player!r} on {action.street}: "
                    f"{action.size_bb}BB"
                )
            if action.size_bb > 5000:
                warnings.append(
                    f"Extremely large action size for {action.player!r}: {action.size_bb}BB"
                )

    # 9. Board ↔ action consistency ───────────────────────────────────────────
    has_flop_actions = any(a.street == "flop" for a in hand.actions)
    if has_flop_actions and not hand.board.flop:
        warnings.append("Flop actions present but no flop cards parsed")

    has_turn_actions = any(a.street == "turn" for a in hand.actions)
    if has_turn_actions and not hand.board.turn:
        warnings.append("Turn actions present but no turn card parsed")

    has_river_actions = any(a.street == "river" for a in hand.actions)
    if has_river_actions and not hand.board.river:
        warnings.append("River actions present but no river card parsed")

    # 10. Minimum action count ────────────────────────────────────────────────
    if not hand.actions:
        warnings.append("No actions parsed — hand may be truncated")

    hero_actions = [a for a in hand.actions if a.is_hero]
    if not hero_actions:
        warnings.append("No hero actions found — cannot evaluate play")

    # 11. Known site boost ────────────────────────────────────────────────────
    hero_detected_by = _infer_hero_detection_method(hand)

    # 12. Confidence score ────────────────────────────────────────────────────
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


def _normalise(card: str) -> str:
    return card[0].upper() + card[1].lower()


def _infer_hero_detection_method(hand: ParsedHand) -> str:
    if hand.site in ("GGPoker", "PokerStars"):
        return f"{hand.site} hand history (Dealt to line)"
    return "heuristic detection"


def _compute_confidence(
    hand: ParsedHand,
    errors: list[str],
    warnings: list[str],
) -> float:
    if errors:
        return max(0.0, 0.5 - len(errors) * 0.15)

    score = 1.0
    score -= len(warnings) * 0.07

    if not hand.hero_cards:
        score -= 0.20
    if not hand.hero_position or hand.hero_position in ("", "?"):
        score -= 0.12

    hero_actions = [a for a in hand.actions if a.is_hero]
    if len(hero_actions) == 0:
        score -= 0.18
    elif len(hero_actions) == 1 and hand.board.flop:
        score -= 0.05

    if hand.site in ("GGPoker", "PokerStars"):
        score += 0.05

    # Bonus if we got a full board
    if hand.board.flop and hand.board.turn and hand.board.river:
        score += 0.03

    return round(max(0.0, min(1.0, score)), 3)
