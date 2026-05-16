"""
Deterministic poker hand reconstruction layer.

Converts raw AI extraction into a validated, poker-rule-consistent ReplayAnalysis.
No AI involved — all decisions are rule-based.

Hero identification priority:
  1. Explicit hero_signal (highlight / YOU / badge)
  2. "hero" substring in player label
  3. Sole player with 2 visible cards
  4. Player with most visible cards
  5. First player in list (last-resort fallback)
"""
from __future__ import annotations

import logging

from app.models.schemas import (
    BoardCards,
    CoachingFeedbackItem,
    CoachingOutput,
    HandSummaryData,
    OverallVerdict,
    RawExtraction,
    RawPlayerSeen,
    ReplayAction,
    ReplayAnalysis,
    ReplayFeedback,
    SeatedPlayer,
    ValidationInfo,
)
from app.services.money_normalizer import (
    StakesInfo,
    parse_amount,
    parse_stakes,
    validate_pot_bb,
    validate_stack_bb,
)
from app.services.position_engine import (
    ALL_POSITIONS,
    infer_positions,
    normalize_position as _normalize_position,
    visual_seat_index,
)

logger = logging.getLogger(__name__)

# ── Canonical position constants ───────────────────────────────────────────

POSITIONS_6MAX = ["UTG", "HJ", "CO", "BTN", "SB", "BB"]   # kept for import compat

_VALID_RANKS = set("23456789TJQKA")
_VALID_SUITS = set("hdcs")

# ── Normalization helpers ──────────────────────────────────────────────────

def normalize_pos(raw: str) -> str:
    """Map any position label variant to its canonical name."""
    return _normalize_position(raw)


def normalize_card(raw: str) -> str | None:
    """Normalize card string to rank+suit format. Returns None if invalid."""
    if not raw:
        return None
    c = raw.strip().upper()
    if c.startswith("10") and len(c) == 3:
        c = "T" + c[2]
    if len(c) != 2:
        return None
    rank, suit = c[0], c[1].lower()
    if rank not in _VALID_RANKS or suit not in _VALID_SUITS:
        return None
    return f"{rank}{suit}"


def _clean_cards(raw_list: list[str]) -> list[str]:
    """Normalize a list of card strings, drop invalids and duplicates."""
    seen: set[str] = set()
    result: list[str] = []
    for c in raw_list:
        nc = normalize_card(c)
        if nc and nc not in seen:
            seen.add(nc)
            result.append(nc)
    return result


def _parse_bb(text: str | None) -> float | None:
    """
    Backward-compatible shim: parse numeric value, assuming bb units.
    Currency amounts without stakes context fall back to raw numeric.
    Prefer _amount_bb() with stakes when available.
    """
    result = parse_amount(text, stakes=None)
    return result.amount_bb if result else None


def _amount_bb(text: str | None, stakes: StakesInfo | None) -> float:
    """Parse amount text to bb value using stakes context. Returns 0.0 on failure."""
    pa = parse_amount(text, stakes)
    return pa.amount_bb if pa else 0.0


def _amount_display(text: str | None, stakes: StakesInfo | None) -> str | None:
    """Return formatted display string for an amount, or original text as fallback."""
    if text is None:
        return None
    pa = parse_amount(text, stakes)
    return pa.display if pa else text


# ── Hero identification ────────────────────────────────────────────────────

def identify_hero(players: list[RawPlayerSeen]) -> tuple[int, str]:
    """
    Return (index_in_players, detection_method_string).
    Uses explicit signals before falling back to heuristics.
    """
    # Priority 1: explicit hero badge / highlight / YOU marker
    for i, p in enumerate(players):
        if p.hero_signal:
            return i, "hero_badge"

    # Priority 2: "hero" substring in player label
    for i, p in enumerate(players):
        if "hero" in p.label.lower():
            return i, "hero_label"

    # Priority 3: sole player with exactly 2 visible cards
    with_two = [i for i, p in enumerate(players) if len(p.cards) == 2]
    if len(with_two) == 1:
        return with_two[0], "sole_visible_cards"

    # Priority 4: player with the most visible cards
    if players:
        best = max(range(len(players)), key=lambda i: len(players[i].cards))
        if players[best].cards:
            return best, "most_visible_cards"

    # Priority 5: fallback — first player in list
    return 0, "fallback_first_player"


# ── Card integrity check ───────────────────────────────────────────────────

def _check_duplicates(
    hero_cards: list[str],
    villain_cards: list[str],
    board: list[str],
    errors: list[str],
) -> None:
    seen: set[str] = set()
    for c in hero_cards + villain_cards + board:
        if c in seen:
            errors.append(f"Duplicate card detected: {c}")
        seen.add(c)


# ── Main entry point ───────────────────────────────────────────────────────

def reconstruct_and_build(
    raw: RawExtraction,
    coaching: CoachingOutput,
    stakes: StakesInfo | None = None,
) -> tuple[ReplayAnalysis, ValidationInfo]:
    """
    Apply poker rules to raw AI extraction + coaching to produce a validated
    ReplayAnalysis and a ValidationInfo summary.

    stakes: pre-parsed StakesInfo. If omitted, parsed internally from raw.stakes_text.
    """
    warnings: list[str] = []
    errors: list[str] = []
    confidence = raw.extraction_confidence

    # ── Resolve stakes ─────────────────────────────────────────────────────
    if stakes is None:
        stakes = parse_stakes(raw.stakes_text)
        if stakes:
            logger.info(
                "Stakes parsed: SB=%.4f BB=%.4f currency=%s",
                stakes.small_blind, stakes.big_blind, stakes.currency or "unitless",
            )
        elif raw.stakes_text:
            warnings.append(
                f"Could not parse stakes '{raw.stakes_text}' — "
                "currency amounts treated as bb (may be inaccurate)"
            )
            confidence -= 0.05

    # ── Step 1: normalize all player positions ─────────────────────────
    norm_positions: list[str] = []
    for p in raw.players:
        norm = normalize_pos(p.position_label)
        if norm not in ALL_POSITIONS:
            warnings.append(
                f"Unrecognized position '{p.position_label}' for player '{p.label}' — kept as-is"
            )
            confidence -= 0.05
        norm_positions.append(norm)

    if len(norm_positions) != len(set(norm_positions)) and norm_positions:
        warnings.append("Duplicate seat positions found — screenshot may be ambiguous")
        confidence -= 0.10

    N = len(raw.players)
    inferred_positions, infer_method = infer_positions(norm_positions)
    logger.info("Position inference: method=%s positions=%s", infer_method, inferred_positions)

    player_data = [
        (p.label, inferred_positions[i], p.cards[:], p.hero_signal, p.stack_text)
        for i, p in enumerate(raw.players)
    ]

    # ── Step 2: identify hero ──────────────────────────────────────────
    hero_idx, hero_method = identify_hero(raw.players)
    logger.info(
        "Hero identified: index=%d method=%s label=%s",
        hero_idx, hero_method, player_data[hero_idx][0] if player_data else "?",
    )

    hero_label, hero_pos, hero_raw_cards, _, hero_stack_text = player_data[hero_idx]
    villain_data = [t for i, t in enumerate(player_data) if i != hero_idx]
    primary_villain = villain_data[0] if villain_data else None

    # ── Step 3: normalize all cards ───────────────────────────────────
    hero_cards    = _clean_cards(hero_raw_cards)
    villain_cards = _clean_cards(primary_villain[2]) if primary_villain else []
    flop  = _clean_cards(raw.flop)
    turn  = _clean_cards(raw.turn)
    river = _clean_cards(raw.river)

    _check_duplicates(hero_cards, villain_cards, flop + turn + river, errors)

    if len(hero_cards) == 0:
        warnings.append("Hero hole cards not visible or not extractable from screenshot")
        confidence -= 0.15
    elif len(hero_cards) != 2:
        warnings.append(f"Expected 2 hero cards, extracted {len(hero_cards)}")
        confidence -= 0.10

    # ── Step 4: parse stacks (stakes-aware) ───────────────────────────
    hero_stack_bb = _amount_bb(hero_stack_text, stakes) or 100.0
    validate_stack_bb(hero_stack_bb, warnings, label="Hero stack")

    # ── Step 4b: build seated player list ─────────────────────────────
    seated_players: list[SeatedPlayer] = []
    for i, (p_label, p_pos, p_raw_cards, _, p_stack_text) in enumerate(player_data):
        p_stack = _amount_bb(p_stack_text, stakes) or None
        seated_players.append(SeatedPlayer(
            name=p_label,
            position=p_pos,
            stack_bb=p_stack,
            hole_cards=_clean_cards(p_raw_cards),
            is_hero=(i == hero_idx),
            seat_index=visual_seat_index(p_pos, hero_pos, N),
        ))

    # ── Step 5: build action attribution helper ────────────────────────
    def _is_hero(player_label: str) -> bool:
        return player_label == hero_label or "hero" in player_label.lower()

    # ── Step 6: track pot + build replay (stakes-aware amounts) ───────
    pot = 0.0
    feedback_map: dict[int, CoachingFeedbackItem] = {
        fb.action_idx: fb for fb in coaching.action_feedback
    }
    replay_actions: list[ReplayAction] = []

    for idx, a in enumerate(raw.actions):
        if a.action in ("post", "blind", "call", "bet", "raise", "allin"):
            pot += _amount_bb(a.amount_text, stakes)

        if a.action in ("post", "blind"):
            continue

        hero_flag = _is_hero(a.player_label)

        feedback: ReplayFeedback | None = None
        if hero_flag and idx in feedback_map:
            fb = feedback_map[idx]
            feedback = ReplayFeedback(
                rating=fb.rating,
                title=fb.title,
                explanation=fb.explanation,
                gto_note=fb.gto_note,
            )

        replay_actions.append(ReplayAction(
            id=len(replay_actions) + 1,
            street=a.street,
            player=a.player_label,
            action=a.action,
            amount=_amount_display(a.amount_text, stakes),
            pot_after=round(pot, 2),
            is_hero=hero_flag,
            feedback=feedback,
        ))

    # ── Step 7: validate pot ───────────────────────────────────────────
    validate_pot_bb(pot, warnings)

    # ── Step 8: assemble output ────────────────────────────────────────
    villain_pos       = primary_villain[1] if primary_villain else None
    villain_label_out = primary_villain[0] if primary_villain else None

    hand_summary = HandSummaryData(
        stakes=raw.stakes_text or "NL?",
        hero_position=hero_pos,
        hero_cards=hero_cards,
        villain_position=villain_pos,
        villain_cards=villain_cards if villain_cards else None,
        effective_stack_bb=hero_stack_bb,
        board=BoardCards(flop=flop, turn=turn, river=river),
        big_blind=stakes.big_blind if stakes else 1.0,
        currency=stakes.currency if stakes else "",
        players=seated_players,   # full topology — enables deterministic frontend layout
        player_count=N,           # table size for SEAT_COORDS selection
    )

    analysis = ReplayAnalysis(
        hand_summary=hand_summary,
        actions=replay_actions,
        overall_verdict=coaching.overall_verdict,
    )

    if errors:
        confidence = min(confidence, 0.45)
    confidence = round(max(0.05, min(1.0, confidence)), 2)

    logger.info(
        "Reconstruction: hero=%s pos=%s cards=%s villain=%s stakes=%s "
        "confidence=%.2f warnings=%d errors=%d",
        hero_label, hero_pos, hero_cards, villain_label_out,
        f"BB={stakes.big_blind}" if stakes else "unknown",
        confidence, len(warnings), len(errors),
    )

    validation = ValidationInfo(
        confidence=confidence,
        hero_detected_by=hero_method,
        warnings=warnings,
        errors=errors,
        is_valid=len(errors) == 0,
    )

    return analysis, validation
