"""
Hand Pipeline Orchestrator.

Implements the full deterministic pipeline:

  INPUT (text hand history OR confirmed screenshot state)
      ↓
  EXTRACTION LAYER    — parse raw text / accept extraction result
      ↓
  NORMALIZATION LAYER — convert to CanonicalHand
      ↓
  VALIDATION LAYER    — mathematical + structural checks
      ↓
  PipelineResult      — returned to caller / frontend

The analysis engine (GTO/EV/replay) MUST only be invoked if
  result.validation.can_analyze is True.

No AI is called from this module — it is entirely deterministic.
"""
from __future__ import annotations

import logging
from app.models.schemas import (
    ParsedHand, ExtractionResult,
    BoardCards, PlayerInfo, HandAction,
)
from app.models.canonical import CanonicalHand, PipelineResult, ParseSource
from app.parsers.detector import detect_and_parse
from app.engines.normalizer import normalize_hand
from app.engines.canonical_validator import validate_canonical

_log = logging.getLogger(__name__)

# Analysis is blocked below this confidence threshold even if no hard errors
_MIN_ANALYSIS_CONFIDENCE = 0.40


def run_text_pipeline(
    raw_text: str,
    *,
    debug: bool = False,
) -> PipelineResult:
    """Full pipeline for a pasted hand history text.

    Steps:
      1. Parse (auto-detect site)
      2. Normalize to CanonicalHand
      3. Validate
      4. Return PipelineResult

    Args:
        raw_text:  Raw hand history paste.
        debug:     If True, include parse_diagnostics and raw entities in result.
    """
    _log.debug("pipeline.run_text_pipeline: len=%d chars", len(raw_text))

    # ── Step 1: Parse ─────────────────────────────────────────────────────────
    parsed: ParsedHand = detect_and_parse(raw_text)
    _log.debug(
        "pipeline: parsed site=%s hand_id=%s actions=%d",
        parsed.site, parsed.hand_id, len(parsed.actions),
    )

    # ── Step 2: Normalize ─────────────────────────────────────────────────────
    canonical: CanonicalHand = normalize_hand(parsed, raw_text=raw_text)

    # ── Step 3: Validate ──────────────────────────────────────────────────────
    validation = validate_canonical(canonical)

    # Apply confidence gate: block analysis even if no hard errors when confidence is too low
    if validation.can_analyze and validation.confidence < _MIN_ANALYSIS_CONFIDENCE:
        validation.can_analyze = False
        from app.models.canonical import PipelineValidationError, ValidationSeverity
        validation.errors.append(PipelineValidationError(
            code="LOW_CONFIDENCE",
            message=(
                f"Parsing confidence {validation.confidence:.0%} is below the "
                f"minimum threshold ({_MIN_ANALYSIS_CONFIDENCE:.0%}). "
                "Please review the extracted hand in the repair UI."
            ),
            severity=ValidationSeverity.ERROR,
            field=None,
        ))

    # ── Step 4: Assemble result ────────────────────────────────────────────────
    diagnostics_payload: dict | None = None
    raw_entities_payload: dict | None = None
    if debug and parsed.parse_diagnostics:
        diagnostics_payload = parsed.parse_diagnostics.model_dump()
        raw_entities_payload = {
            "site": parsed.site,
            "hand_id": parsed.hand_id,
            "stakes": parsed.stakes,
            "big_blind": parsed.big_blind,
            "hero_name": parsed.hero_name,
            "players": [p.model_dump() for p in parsed.players],
            "actions_count": len(parsed.actions),
            "board": parsed.board.model_dump(),
        }

    _log.info(
        "pipeline complete: hand=%s valid=%s can_analyze=%s confidence=%.3f errors=%d warnings=%d",
        canonical.hand_id,
        validation.valid,
        validation.can_analyze,
        validation.confidence,
        len(validation.errors),
        len(validation.warnings),
    )

    return PipelineResult(
        canonical=canonical,
        validation=validation,
        parse_diagnostics=diagnostics_payload,
        raw_extracted_entities=raw_entities_payload,
    )


def run_screenshot_pipeline(
    extraction: ExtractionResult,
    *,
    debug: bool = False,
) -> PipelineResult:
    """Full pipeline for a confirmed screenshot extraction.

    Converts ExtractionResult (from vision AI) into a CanonicalHand,
    then validates it.

    Args:
        extraction:  Confirmed ExtractionResult from the frontend.
        debug:       If True, include raw entities in result.
    """
    _log.debug(
        "pipeline.run_screenshot_pipeline: players=%d actions=%d confidence=%.2f",
        len(extraction.players), len(extraction.actions), extraction.overall_confidence,
    )

    # ── Build a ParsedHand from ExtractionResult ───────────────────────────────
    parsed = _extraction_to_parsed_hand(extraction)

    # ── Normalize ─────────────────────────────────────────────────────────────
    canonical = normalize_hand(parsed, raw_text=None)
    canonical.parse_source = ParseSource.SCREENSHOT

    # ── Validate ──────────────────────────────────────────────────────────────
    validation = validate_canonical(canonical)

    # Blend screenshot confidence with structural confidence
    blended = round(
        0.5 * extraction.overall_confidence + 0.5 * validation.confidence, 3
    )
    validation.confidence = blended

    # Propagate screenshot-level errors/warnings as pipeline warnings
    from app.models.canonical import PipelineValidationError, ValidationSeverity
    for msg in extraction.errors:
        validation.errors.append(PipelineValidationError(
            code="EXTRACTION_ERROR",
            message=msg,
            severity=ValidationSeverity.ERROR,
        ))
    for msg in extraction.warnings:
        validation.warnings.append(PipelineValidationError(
            code="EXTRACTION_WARNING",
            message=msg,
            severity=ValidationSeverity.WARNING,
        ))

    # Re-check can_analyze after extraction errors
    if extraction.errors:
        validation.can_analyze = False

    if validation.can_analyze and blended < _MIN_ANALYSIS_CONFIDENCE:
        validation.can_analyze = False
        validation.errors.append(PipelineValidationError(
            code="LOW_CONFIDENCE",
            message=(
                f"Extraction + structural confidence {blended:.0%} is below minimum. "
                "Please review fields in the repair UI."
            ),
            severity=ValidationSeverity.ERROR,
        ))

    raw_entities: dict | None = None
    if debug:
        raw_entities = {
            "players": [p.model_dump() for p in extraction.players],
            "actions": [a.model_dump() for a in extraction.actions],
            "board": extraction.board.model_dump(),
            "overall_confidence": extraction.overall_confidence,
            "hero_detected_by": extraction.hero_detected_by,
        }

    return PipelineResult(
        canonical=canonical,
        validation=validation,
        parse_diagnostics=None,
        raw_extracted_entities=raw_entities,
    )


# ── Canonical → ParsedHand bridge (for existing analysis engine) ──────────────

def _canonical_to_parsed_hand(canonical: CanonicalHand) -> ParsedHand:
    """Convert a CanonicalHand back into a ParsedHand for the existing analysis engine.

    This bridge lets the new pipeline feed the pre-existing GTO/EV engines
    without rewriting them. Only required fields are populated.
    """
    from app.models.schemas import (
        ParsedHand, BoardCards, PlayerInfo, HandAction,
    )

    # Players
    players = [
        PlayerInfo(
            name=p.name,
            seat=p.seat,
            stack_bb=p.stack_bb,
            position=p.position,
        )
        for p in canonical.players
    ]

    # Hero info
    hero = next((p for p in canonical.players if p.id == canonical.hero_id), None)
    hero_name = hero.name if hero else "Hero"
    hero_position = hero.position if hero else "BTN"
    hero_cards = [c.notation for c in hero.hole_cards] if hero else []

    # Flatten actions
    actions: list[HandAction] = []
    for street in canonical.streets:
        for a in street.actions:
            if a.action.value in ("post_sb", "post_bb", "post_ante", "post_straddle"):
                continue  # skip posting actions — analysis engine doesn't use them
            actions.append(HandAction(
                street=a.street.value,
                player=a.player_name,
                action=a.action.value,
                size_bb=a.total_bet_bb or a.amount_bb or None,
                is_hero=a.is_hero,
                is_all_in=a.is_all_in,
            ))

    # Board
    flop = [c.notation for c in (next((s for s in canonical.streets if s.name.value == "flop"), None) or _empty_street()).board_cards]
    turn = [c.notation for c in (next((s for s in canonical.streets if s.name.value == "turn"), None) or _empty_street()).board_cards]
    river = [c.notation for c in (next((s for s in canonical.streets if s.name.value == "river"), None) or _empty_street()).board_cards]
    board = BoardCards(flop=flop, turn=turn, river=river)

    # Site must be a valid Literal
    site_value = canonical.site
    if site_value not in ("GGPoker", "PokerStars"):
        site_value = "Unknown"

    return ParsedHand(
        site=site_value,
        game_type=canonical.game_type,
        stakes=canonical.stakes.display,
        hand_id=canonical.hand_id,
        hero_name=hero_name,
        hero_position=hero_position,
        effective_stack_bb=canonical.effective_stack_bb,
        hero_cards=hero_cards,
        board=board,
        players=players,
        actions=actions,
        pot_size_bb=canonical.final_pot_bb,
        big_blind=canonical.stakes.big_blind,
        table_max_seats=canonical.table_max_seats,
    )


class _EmptyStreet:
    board_cards: list = []

def _empty_street() -> _EmptyStreet:
    return _EmptyStreet()


# ── Helpers ────────────────────────────────────────────────────────────────────

def _extraction_to_parsed_hand(ext: ExtractionResult) -> ParsedHand:
    """Convert an ExtractionResult into a ParsedHand for the normalizer."""
    # Big blind
    bb = ext.big_blind or 1.0

    # Build PlayerInfo list
    hero_name = "Hero"
    players: list[PlayerInfo] = []
    for i, ep in enumerate(ext.players):
        if ep.is_hero:
            hero_name = ep.name
        players.append(PlayerInfo(
            name=ep.name,
            seat=i + 1,
            stack_bb=ep.stack_bb or ext.effective_stack_bb,
            position=ep.position or "?",
        ))

    # Hero cards
    hero_player = next((p for p in ext.players if p.is_hero), None)
    hero_cards = [c.card for c in hero_player.cards] if hero_player else []

    # Build HandAction list
    actions: list[HandAction] = []
    for ea in ext.actions:
        normalized_action = ea.action.lower()
        if normalized_action in ("allin", "all-in", "all_in"):
            normalized_action = "raise"
        if normalized_action not in ("fold", "check", "call", "bet", "raise"):
            continue
        actions.append(HandAction(
            street=ea.street,
            player=ea.player_name,
            action=normalized_action,
            size_bb=ea.amount_bb,
            is_hero=(ea.player_name == hero_name),
            is_all_in=(ea.action.lower() in ("allin", "all-in", "all_in")),
        ))

    board = ext.board

    # Button seat heuristic: player with BTN position
    btn_player = next((p for p in ext.players if p.position in ("BTN", "Button", "Dealer")), None)
    if btn_player:
        pass  # button seat derived from position assignment in normalizer

    # Effective stack
    effective_stack = ext.effective_stack_bb

    # Stakes display
    currency = ext.currency or ""
    if currency == "USD":
        stakes_display = f"${bb * 0.5:.2f}/${bb:.2f}"
    elif currency == "EUR":
        stakes_display = f"€{bb * 0.5:.2f}/€{bb:.2f}"
    else:
        stakes_display = f"{bb * 0.5}/{bb}"

    from app.models.schemas import ParseDiagnostics
    diagnostics = ParseDiagnostics(
        sections_found=[],
        sections_missing=[],
        actions_parsed=len(actions),
        board_cards_parsed=len(board.flop) + len(board.turn) + len(board.river),
        hero_cards_found=bool(hero_cards),
        recovered_actions=len(actions),
        warnings=ext.warnings,
        errors=ext.errors,
        is_partial=True,
    )

    return ParsedHand(
        site="Unknown",
        game_type="NLHE",
        stakes=stakes_display,
        hand_id="screenshot",
        hero_name=hero_name,
        hero_position=next((p.position for p in players if p.name == hero_name), "?"),
        effective_stack_bb=effective_stack,
        hero_cards=hero_cards,
        board=board,
        players=players,
        actions=actions,
        pot_size_bb=0.0,
        big_blind=bb,
        table_max_seats=max(len(players), 6),
        parse_diagnostics=diagnostics,
    )
