"""
Poker coaching service.

Two entry points:
  analyze_image()   — full pipeline (extract → reconstruct → coach → replay)
                      Used by the legacy /api/analyze-image endpoint.
  coach_confirmed() — coaching only, given a user-confirmed PokerState.
                      Used by the new /api/confirm-hand endpoint.
"""
from __future__ import annotations

import json
import logging
import re

from openai import AsyncOpenAI

from app.config import get_settings
from app.models.schemas import (
    BoardCards,
    ConfirmedPokerState,
    CoachingOutput,
    ExtractedAction,
    HandSummaryData,
    OverallVerdict,
    RawExtraction,
    ReplayAction,
    ReplayAnalysis,
    ReplayFeedback,
    ValidationInfo,
)
from app.services.hand_reconstructor import (
    identify_hero,
    normalize_card,
    normalize_pos,
    reconstruct_and_build,
)
from app.services.money_normalizer import (
    parse_amount,
    parse_stakes,
)
from app.services.image_preprocessor import preprocess_screenshot
from app.services.ocr_extractor import extract_text
from app.services.vision_extractor import extract_raw

logger = logging.getLogger(__name__)

# ── Coaching prompt ──────────────────────────────────────────────────────────

_COACHING_SYSTEM = """\
You are an expert GTO poker coach for No-Limit Hold'em cash games.
Given a validated, confirmed poker hand, evaluate hero's decisions.

Output ONLY valid JSON — no markdown, no extra text:

{
  "action_feedback": [
    {
      "action_idx": 0,
      "rating": "good",
      "title": "Standard BTN open raise",
      "explanation": "AKo is a clear open from all positions at any depth. 2.5bb is the correct sizing at 100bb.",
      "gto_note": "Solvers open AKo 100% from BTN in all rake structures."
    }
  ],
  "overall_verdict": {
    "score": 82,
    "title": "Solid execution with one sizing leak",
    "summary": "2-3 sentence overall assessment of hero's play quality.",
    "key_mistakes": ["Turn bet sizing too large on low-connectivity board"],
    "key_strengths": ["Correct preflop range selection", "Good flop c-bet frequency"]
  }
}

RULES:
• action_idx  — 0-based index in the action list where is_hero=true
• rating      — "good" = optimal | "okay" = acceptable | "mistake" = clear error
• explanation — 2-3 sentences of precise strategic reasoning
• gto_note    — one sentence solver insight, or null
• score       — 0-100 integer for hero's overall quality
• Provide feedback ONLY for hero actions
• All amounts in the prompt are in big blinds (bb)
• JSON only
"""


def _parse_json(raw: str) -> dict:
    raw = raw.strip()
    m = re.search(r"```(?:json)?\s*([\s\S]+?)\s*```", raw)
    return json.loads(m.group(1) if m else raw)


def _fallback_coaching() -> CoachingOutput:
    return CoachingOutput(
        action_feedback=[],
        overall_verdict=OverallVerdict(
            score=50,
            title="Coaching unavailable",
            summary="Strategic coaching could not be generated. The hand was reconstructed successfully.",
            key_mistakes=[],
            key_strengths=[],
        ),
    )


async def _run_coaching(
    hero_position: str,
    hero_cards: list[str],
    hero_stack_bb: float,
    villain_position: str | None,
    board: BoardCards,
    stakes: str | None,
    actions: list[ExtractedAction],
    hero_name: str,
    client: AsyncOpenAI,
    model: str,
) -> CoachingOutput:
    """Build coaching prompt with bb-normalized amounts and call AI."""
    action_lines: list[str] = []
    for a in actions:
        is_h = a.player_name == hero_name or "hero" in a.player_name.lower()
        marker = " ← HERO" if is_h else ""
        amount_str = f" {a.amount_bb:.1f}bb" if a.amount_bb is not None else ""
        line = (
            f"  [{a.sequence_idx}] {a.player_name} {a.action}"
            + amount_str
            + f" ({a.street}){marker}"
        )
        action_lines.append(line)

    board_desc = (
        f"flop={board.flop or []} turn={board.turn or []} river={board.river or []}"
    )

    user_content = f"""Validated poker hand for coaching:

Hero: {hero_position} | cards: {hero_cards} | stack: {hero_stack_bb:.1f}bb
Villain: {villain_position or 'unknown'}
Board: {board_desc}
Stakes: {stakes or 'unknown'} (all amounts below are in big blinds)

Actions (action_idx = number in brackets):
{chr(10).join(action_lines) if action_lines else '  (no actions recorded)'}

Provide coaching feedback for each HERO action using the action_idx in brackets."""

    try:
        resp = await client.chat.completions.create(
            model=model,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": _COACHING_SYSTEM},
                {"role": "user", "content": user_content},
            ],
            max_tokens=2000,
            temperature=0.3,
        )
        raw = resp.choices[0].message.content
        if not raw:
            raise ValueError("empty response")
        return CoachingOutput.model_validate(_parse_json(raw))
    except Exception as exc:
        logger.error("Coaching call failed: %s", exc)
        return _fallback_coaching()


# ── Public entry point 1: full pipeline ───────────────────────────────────

async def analyze_image(
    image_bytes: bytes,
    mime_type: str,
) -> tuple[ReplayAnalysis, ValidationInfo]:
    """
    Full pipeline: preprocess → OCR → AI extract → Python reconstruct → AI coach → replay.
    Used by /api/analyze-image (single-shot, no user confirmation).
    """
    settings = get_settings()
    if not settings.openai_api_key:
        raise ValueError("OpenAI API key not configured")

    client = AsyncOpenAI(api_key=settings.openai_api_key)
    model = settings.openai_vision_model

    processed = preprocess_screenshot(image_bytes, mime_type)
    logger.info("Preprocessing: %s", processed.applied)

    ocr = extract_text(processed.data)
    logger.info("OCR available=%s context_len=%d", ocr.available, len(ocr.context_snippet))

    raw: RawExtraction = await extract_raw(
        processed.data, processed.mime_type, ocr.context_snippet
    )

    # Parse stakes — all monetary normalization depends on this
    stakes = parse_stakes(raw.stakes_text)

    # Identify hero
    hero_idx, _ = identify_hero(raw.players)
    hero_p      = raw.players[hero_idx] if raw.players else None
    villain_p   = next((p for i, p in enumerate(raw.players) if i != hero_idx), None)

    # Build ExtractedAction list with stakes-aware bb amounts for the coaching prompt
    extracted_actions: list[ExtractedAction] = []
    for i, a in enumerate(raw.actions):
        pa = parse_amount(a.amount_text, stakes) if a.amount_text else None
        extracted_actions.append(ExtractedAction(
            player_name=a.player_label,
            action=a.action,
            amount_text=a.amount_text,
            amount_usd=pa.amount_usd if pa else None,
            amount_bb=pa.amount_bb if pa else None,
            street=a.street,
            sequence_idx=i,
        ))

    hero_stack_pa = (
        parse_amount(hero_p.stack_text, stakes)
        if hero_p and hero_p.stack_text else None
    )
    hero_stack_bb = hero_stack_pa.amount_bb if hero_stack_pa else 100.0

    coaching = await _run_coaching(
        hero_position=hero_p.position_label if hero_p else "?",
        hero_cards=hero_p.cards if hero_p else [],
        hero_stack_bb=hero_stack_bb,
        villain_position=villain_p.position_label if villain_p else None,
        board=BoardCards(flop=raw.flop, turn=raw.turn, river=raw.river),
        stakes=raw.stakes_text,
        actions=extracted_actions,
        hero_name=hero_p.label if hero_p else "",
        client=client,
        model=model,
    )

    # Reconstruct replay — pass stakes so pot tracking uses correct bb values
    return reconstruct_and_build(raw, coaching, stakes=stakes)


# ── Public entry point 2: coaching on confirmed state ─────────────────────

async def coach_confirmed(
    state: ConfirmedPokerState,
) -> tuple[ReplayAnalysis, ValidationInfo]:
    """
    Coaching + replay from user-confirmed poker state.
    Used by /api/confirm-hand — no extraction needed, data is already validated.
    ExtractedAction.amount_bb was already normalized correctly during extraction.
    """
    settings = get_settings()
    if not settings.openai_api_key:
        raise ValueError("OpenAI API key not configured")

    client = AsyncOpenAI(api_key=settings.openai_api_key)
    model = settings.openai_vision_model

    stakes = parse_stakes(state.stakes)

    logger.info(
        "Coaching confirmed state: hero=%s %s %s, villain=%s %s, stakes=%s",
        state.hero_name, state.hero_position, state.hero_cards,
        state.villain_name, state.villain_position,
        f"BB={stakes.big_blind}" if stakes else "unknown",
    )

    coaching = await _run_coaching(
        hero_position=state.hero_position,
        hero_cards=state.hero_cards,
        hero_stack_bb=state.hero_stack_bb,
        villain_position=state.villain_position,
        board=state.board,
        stakes=state.stakes,
        actions=state.actions,
        hero_name=state.hero_name,
        client=client,
        model=model,
    )

    # Build replay deterministically from confirmed state
    feedback_map = {fb.action_idx: fb for fb in coaching.action_feedback}

    pot = 0.0
    replay_actions: list[ReplayAction] = []

    for a in state.actions:
        # Use pre-normalized amount_bb (set correctly during extraction)
        if a.action in ("post", "blind", "call", "bet", "raise", "allin"):
            pot += a.amount_bb or 0.0

        if a.action in ("post", "blind"):
            continue

        is_hero = a.player_name == state.hero_name or "hero" in a.player_name.lower()

        feedback = None
        if is_hero and (fb_data := feedback_map.get(a.sequence_idx)):
            feedback = ReplayFeedback(
                rating=fb_data.rating,
                title=fb_data.title,
                explanation=fb_data.explanation,
                gto_note=fb_data.gto_note,
            )

        # Format display amount (use pre-computed display string when possible)
        if a.amount_text:
            pa = parse_amount(a.amount_text, stakes)
            display_amount = pa.display if pa else a.amount_text
        else:
            display_amount = None

        replay_actions.append(ReplayAction(
            id=len(replay_actions) + 1,
            street=a.street,
            player=a.player_name,
            action=a.action,
            amount=display_amount,
            pot_after=round(pot, 2),
            is_hero=is_hero,
            feedback=feedback,
        ))

    hand_summary = HandSummaryData(
        stakes=state.stakes or "NL?",
        hero_position=normalize_pos(state.hero_position),
        hero_cards=[normalize_card(c) or c for c in state.hero_cards],
        villain_position=(
            normalize_pos(state.villain_position) if state.villain_position else None
        ),
        villain_cards=[normalize_card(c) or c for c in state.villain_cards] or None,
        effective_stack_bb=state.hero_stack_bb,
        board=BoardCards(
            flop=[normalize_card(c) or c for c in state.board.flop],
            turn=[normalize_card(c) or c for c in state.board.turn],
            river=[normalize_card(c) or c for c in state.board.river],
        ),
        big_blind=stakes.big_blind if stakes else 1.0,
        currency=stakes.currency if stakes else "",
    )

    analysis = ReplayAnalysis(
        hand_summary=hand_summary,
        actions=replay_actions,
        overall_verdict=coaching.overall_verdict,
    )

    validation = ValidationInfo(
        confidence=1.0,
        hero_detected_by="user_confirmed",
        warnings=[],
        errors=[],
        is_valid=True,
    )

    return analysis, validation
