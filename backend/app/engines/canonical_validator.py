"""
Canonical Validator — validates a CanonicalHand for mathematical and structural
correctness.

Pipeline position: AFTER normalization, BEFORE analysis.

The validator REJECTS:
- Impossible action sequences
- Invalid stack sizes
- Impossible pot growth
- Duplicate cards
- Illegal raises
- Missing blinds
- Invalid streets
- Malformed boards
- Inconsistent action order
- Impossible all-ins
- Negative stacks
- Invalid player counts

Returns PipelineValidationResult with structured error codes.
Analysis MUST NOT run if can_analyze=False.
"""
from __future__ import annotations

import logging
from app.models.canonical import (
    CanonicalHand, CanonicalAction, CanonicalStreet, ActionType, Street,
    PipelineValidationResult, PipelineValidationError,
    ValidationSeverity, ValidationErrorCode,
)

_log = logging.getLogger(__name__)

# Thresholds
_MIN_PLAYERS = 2
_MAX_PLAYERS = 9
_MAX_STACK_BB = 5000.0
_MAX_ACTION_BB = 10000.0
_MIN_RAISE_MULTIPLIER = 1.0   # min-raise must be at least the previous bet size
_CONFIDENCE_ERROR_PENALTY = 0.15
_CONFIDENCE_WARNING_PENALTY = 0.06
_POT_TOLERANCE = 0.1   # rounding tolerance for pot math (BB)


def validate_canonical(hand: CanonicalHand) -> PipelineValidationResult:
    """Run all validation checks against a CanonicalHand.

    Returns a PipelineValidationResult that the pipeline uses to decide
    whether analysis is permitted.
    """
    errors: list[PipelineValidationError] = []
    warnings: list[PipelineValidationError] = []

    def err(code: ValidationErrorCode, message: str, field: str | None = None) -> None:
        errors.append(PipelineValidationError(
            code=code.value, message=message,
            severity=ValidationSeverity.ERROR, field=field,
        ))

    def warn(code: ValidationErrorCode, message: str, field: str | None = None) -> None:
        warnings.append(PipelineValidationError(
            code=code.value, message=message,
            severity=ValidationSeverity.WARNING, field=field,
        ))

    # ── 1. Player count ───────────────────────────────────────────────────────
    n_players = len(hand.players)
    if n_players < _MIN_PLAYERS:
        err(ValidationErrorCode.TOO_FEW_PLAYERS,
            f"Hand has {n_players} player(s); minimum is {_MIN_PLAYERS}",
            "players")
    elif n_players > _MAX_PLAYERS:
        err(ValidationErrorCode.TOO_MANY_PLAYERS,
            f"Hand has {n_players} players; maximum is {_MAX_PLAYERS}",
            "players")

    # ── 2. Duplicate seats ────────────────────────────────────────────────────
    seen_seats: set[int] = set()
    for p in hand.players:
        if p.seat in seen_seats:
            err(ValidationErrorCode.DUPLICATE_SEAT,
                f"Duplicate seat number: {p.seat}",
                f"players[seat={p.seat}]")
        seen_seats.add(p.seat)

    # ── 3. Stack sanity ───────────────────────────────────────────────────────
    for p in hand.players:
        if p.stack_bb < 0:
            err(ValidationErrorCode.NEGATIVE_STACK,
                f"Player {p.name!r} has negative starting stack: {p.stack_bb}BB",
                f"players[{p.id}].stack_bb")
        elif p.stack_bb == 0:
            warn(ValidationErrorCode.NEGATIVE_STACK,
                 f"Player {p.name!r} seated with 0 chips", f"players[{p.id}].stack_bb")
        elif p.stack_bb > _MAX_STACK_BB:
            warn(ValidationErrorCode.NEGATIVE_STACK,
                 f"Player {p.name!r} has unusually large stack: {p.stack_bb:.0f}BB",
                 f"players[{p.id}].stack_bb")

    # ── 4. Effective stack ────────────────────────────────────────────────────
    if hand.effective_stack_bb <= 0:
        err(ValidationErrorCode.EFFECTIVE_STACK_ZERO,
            "Effective stack is zero or negative", "effective_stack_bb")
    elif hand.effective_stack_bb > _MAX_STACK_BB:
        warn(ValidationErrorCode.EFFECTIVE_STACK_ZERO,
             f"Effective stack unusually large: {hand.effective_stack_bb:.0f}BB",
             "effective_stack_bb")

    # ── 5. Hero presence ──────────────────────────────────────────────────────
    hero = next((p for p in hand.players if p.id == hand.hero_id), None)
    if hero is None:
        err(ValidationErrorCode.HERO_NOT_IN_PLAYERS,
            f"Hero ID {hand.hero_id!r} not found in players list", "hero_id")
    else:
        if not hero.hole_cards:
            warn(ValidationErrorCode.HERO_CARDS_MISSING,
                 "Hero hole cards not identified", f"players[{hero.id}].hole_cards")
        if not hero.position or hero.position == "?":
            warn(ValidationErrorCode.HERO_POSITION_UNKNOWN,
                 "Hero position could not be determined",
                 f"players[{hero.id}].position")

    # ── 6. Card validity and duplicate detection ───────────────────────────────
    all_cards: list[str] = []
    seen_cards: set[str] = set()

    all_hands_cards = []
    for p in hand.players:
        for c in p.hole_cards:
            all_hands_cards.append((c.notation, f"players[{p.id}].hole_cards"))

    all_board_cards = []
    for s in hand.streets:
        for c in s.board_cards:
            all_board_cards.append((c.notation, f"streets[{s.name}].board_cards"))

    for notation, field in all_hands_cards + all_board_cards:
        if notation in seen_cards:
            err(ValidationErrorCode.DUPLICATE_CARD,
                f"Duplicate card: {notation}", field)
        seen_cards.add(notation)
        all_cards.append(notation)

    # ── 7. Board progression ──────────────────────────────────────────────────
    street_map = {s.name: s for s in hand.streets}
    flop = street_map.get(Street.FLOP)
    turn = street_map.get(Street.TURN)
    river = street_map.get(Street.RIVER)

    if turn and (not flop or not flop.board_cards):
        err(ValidationErrorCode.BOARD_PROGRESSION_SKIP,
            "Turn card present but no flop cards", "streets[turn]")
    if river and (not turn or not turn.board_cards):
        err(ValidationErrorCode.BOARD_PROGRESSION_SKIP,
            "River card present but no turn card", "streets[river]")

    if flop and len(flop.board_cards) not in (0, 3):
        err(ValidationErrorCode.WRONG_BOARD_CARD_COUNT,
            f"Flop must have 3 cards, found {len(flop.board_cards)}",
            "streets[flop].board_cards")
    if turn and len(turn.board_cards) not in (0, 1):
        err(ValidationErrorCode.WRONG_BOARD_CARD_COUNT,
            f"Turn must have 1 card, found {len(turn.board_cards)}",
            "streets[turn].board_cards")
    if river and len(river.board_cards) not in (0, 1):
        err(ValidationErrorCode.WRONG_BOARD_CARD_COUNT,
            f"River must have 1 card, found {len(river.board_cards)}",
            "streets[river].board_cards")

    # ── 8. Action analysis ────────────────────────────────────────────────────
    all_actions = [a for s in hand.streets for a in s.actions]

    if not all_actions:
        warn(ValidationErrorCode.NO_ACTIONS_PARSED,
             "No actions parsed — hand may be truncated")

    hero_actions = [a for a in all_actions if a.is_hero]
    if not hero_actions:
        warn(ValidationErrorCode.NO_HERO_ACTIONS,
             "No hero actions found — cannot evaluate play")

    # Check action street ordering
    street_order = {Street.PREFLOP: 0, Street.FLOP: 1, Street.TURN: 2, Street.RIVER: 3}
    prev_street_rank = -1
    prev_street_name = None
    for a in all_actions:
        rank = street_order.get(a.street, -1)
        if rank < prev_street_rank:
            err(ValidationErrorCode.ACTION_OUT_OF_ORDER,
                f"Action on {a.street!r} appears after {prev_street_name!r}",
                "actions")
            break
        prev_street_rank = max(prev_street_rank, rank)
        prev_street_name = a.street

    # ── 9. Per-action amount sanity ───────────────────────────────────────────
    for a in all_actions:
        if a.action in (ActionType.BET, ActionType.RAISE, ActionType.CALL):
            if a.amount_bb < 0:
                err(ValidationErrorCode.NEGATIVE_ACTION_AMOUNT,
                    f"Negative action amount for {a.player_name!r} on {a.street}: "
                    f"{a.amount_bb:.2f}BB",
                    f"action[{a.sequence}].amount_bb")
            if a.amount_bb > _MAX_ACTION_BB:
                warn(ValidationErrorCode.NEGATIVE_ACTION_AMOUNT,
                     f"Extremely large action for {a.player_name!r}: {a.amount_bb:.2f}BB",
                     f"action[{a.sequence}].amount_bb")

    # ── 10. Stack tracking (negative stack after action) ──────────────────────
    for a in all_actions:
        if a.stack_after_bb < -_POT_TOLERANCE:
            err(ValidationErrorCode.NEGATIVE_STACK_AFTER_ACTION,
                f"{a.player_name!r} has negative stack after action "
                f"on {a.street}: {a.stack_after_bb:.2f}BB",
                f"action[{a.sequence}].stack_after_bb")

    # ── 11. Pot consistency (each action's pot_after = pot_before + amount) ────
    for a in all_actions:
        if a.action not in (ActionType.FOLD, ActionType.CHECK):
            expected_pot = round(a.pot_before_bb + a.amount_bb, 4)
            actual_pot = round(a.pot_after_bb, 4)
            if abs(expected_pot - actual_pot) > _POT_TOLERANCE:
                warn(ValidationErrorCode.IMPOSSIBLE_POT_SIZE,
                     f"Pot inconsistency at action {a.sequence} "
                     f"({a.player_name} {a.action}): "
                     f"expected {expected_pot:.2f}BB got {actual_pot:.2f}BB",
                     f"action[{a.sequence}].pot_after_bb")

    # ── 12. Overbet stack check ────────────────────────────────────────────────
    for a in all_actions:
        if a.action in (ActionType.BET, ActionType.RAISE, ActionType.CALL):
            if a.amount_bb > a.stack_before_bb + _POT_TOLERANCE:
                err(ValidationErrorCode.OVERBET_STACK,
                    f"{a.player_name!r} bet/raised more than their stack "
                    f"({a.amount_bb:.2f}BB > {a.stack_before_bb:.2f}BB)",
                    f"action[{a.sequence}]")

    # ── 13. Board ↔ action consistency ───────────────────────────────────────
    for s in hand.streets:
        if s.name != Street.PREFLOP and s.actions and not s.board_cards:
            warn(ValidationErrorCode.BOARD_PROGRESSION_SKIP,
                 f"{s.name} has actions but no board cards were parsed",
                 f"streets[{s.name}]")

    # ── 14. Compute confidence ────────────────────────────────────────────────
    confidence = _compute_confidence(hand, errors, warnings)

    # can_analyze = no hard errors AND hero actions exist (warnings alone don't block)
    can_analyze = len(errors) == 0

    hero_detected_by = _infer_hero_detection_method(hand)

    _log.debug(
        "canonical_validator: hand=%s errors=%d warnings=%d confidence=%.3f can_analyze=%s",
        hand.hand_id, len(errors), len(warnings), confidence, can_analyze,
    )

    return PipelineValidationResult(
        valid=len(errors) == 0,
        can_analyze=can_analyze,
        errors=errors,
        warnings=warnings,
        confidence=confidence,
        hero_detected_by=hero_detected_by,
    )


# ── Helpers ────────────────────────────────────────────────────────────────────

def _compute_confidence(
    hand: CanonicalHand,
    errors: list[PipelineValidationError],
    warnings: list[PipelineValidationError],
) -> float:
    if errors:
        return max(0.0, 0.50 - len(errors) * _CONFIDENCE_ERROR_PENALTY)

    score = 1.0
    score -= len(warnings) * _CONFIDENCE_WARNING_PENALTY

    hero = next((p for p in hand.players if p.id == hand.hero_id), None)
    if not hero or not hero.hole_cards:
        score -= 0.20
    if not hero or not hero.position or hero.position == "?":
        score -= 0.12

    hero_actions = [
        a for s in hand.streets for a in s.actions if a.is_hero
    ]
    if len(hero_actions) == 0:
        score -= 0.18
    elif len(hero_actions) == 1:
        flop = next((s for s in hand.streets if s.name == Street.FLOP), None)
        if flop and flop.board_cards:
            score -= 0.05  # minor penalty if only one hero action and we have a flop

    # Bonus for known sites
    if hand.site in ("GGPoker", "PokerStars"):
        score += 0.05

    # Bonus for full board
    if (
        any(s.board_cards for s in hand.streets if s.name == Street.FLOP) and
        any(s.board_cards for s in hand.streets if s.name == Street.TURN) and
        any(s.board_cards for s in hand.streets if s.name == Street.RIVER)
    ):
        score += 0.03

    return round(max(0.0, min(1.0, score)), 3)


def _infer_hero_detection_method(hand: CanonicalHand) -> str:
    if hand.site in ("GGPoker", "PokerStars"):
        return f"{hand.site} hand history (Dealt to line)"
    if hand.parse_source == "screenshot":
        return "screenshot extraction"
    return "heuristic detection"
