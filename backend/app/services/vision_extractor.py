"""
Phase 1: AI raw extraction from poker screenshots.

Asks GPT-4o Vision ONLY to describe what it literally sees on screen —
no strategy, no interpretation, no hero/villain assignment.
Returns RawExtraction for downstream Python reconstruction.
"""
from __future__ import annotations

import base64
import json
import logging
import re

from openai import AsyncOpenAI

from app.config import get_settings
from app.models.schemas import RawExtraction

logger = logging.getLogger(__name__)

_SYSTEM = """\
You are a poker screenshot parser. Describe ONLY what you literally see on screen.
Do NOT interpret positions, assign hero/villain, or evaluate strategy.

Output ONLY a valid JSON object — no markdown, no extra text:

{
  "players": [
    {
      "label": "exact player name label",
      "position_label": "exact position badge (BTN/BB/SB/CO/HJ/LJ/UTG/DEALER/D…)",
      "cards": ["Ah","Kd"],
      "hero_signal": true,
      "stack_text": "100.50"
    }
  ],
  "actions": [
    {
      "player_label": "exact label",
      "action": "raise",
      "amount_text": "3bb",
      "street": "preflop"
    }
  ],
  "flop": ["Ks","7d","2c"],
  "turn": ["8h"],
  "river": [],
  "pot_text": "8.5bb",
  "stakes_text": "$0.50/$1.00 NL",
  "extraction_confidence": 0.88,
  "extraction_notes": "turn card slightly obscured"
}

EXTRACTION RULES:
• label          — exact visible player name / username text
• position_label — exact badge text on screen. Common values: BB SB BTN CO HJ LJ UTG DEALER D
• cards          — ONLY clearly readable face-up cards.
                   Format: rank + lowercase suit. T = Ten, not 10.
                   Valid examples: Ah Kd Qs Jc Ts 9h 8s 7c 6d 5h 4s 3c 2d
• hero_signal    — true if player has: highlight glow, "Hero" badge, "YOU" label,
                   highlighted seat border, or any perspective cue
• actions        — STRICT chronological order. Blind posts before voluntary actions.
                   Values: fold / check / call / raise / bet / allin / post / blind
• amount_text    — raw amount text as displayed ("3bb", "$1.50", "100")
• Do NOT include face-down or unclear cards
• extraction_confidence — your confidence in completeness/accuracy (0.0–1.0)
• JSON only — no markdown fences, no commentary
"""

_USER_TEMPLATE = """\
Extract all visible poker data from this screenshot.

{ocr_hint}

List every player with exact position badge, every clearly readable card, \
and every action in strict chronological order."""


def _parse_json(raw: str) -> dict:
    raw = raw.strip()
    m = re.search(r"```(?:json)?\s*([\s\S]+?)\s*```", raw)
    return json.loads(m.group(1) if m else raw)


async def extract_raw(
    image_bytes: bytes,
    mime_type: str,
    ocr_context: str = "",
) -> RawExtraction:
    """
    AI Phase 1: extract raw visible data from poker screenshot.

    ocr_context: optional high-confidence OCR text to reduce hallucination.
    """
    settings = get_settings()
    if not settings.openai_api_key:
        raise ValueError("OpenAI API key not configured")

    b64 = base64.standard_b64encode(image_bytes).decode()
    client = AsyncOpenAI(api_key=settings.openai_api_key)

    ocr_hint = ""
    if ocr_context:
        ocr_hint = (
            f"OCR pre-scan detected this text on screen: {ocr_context}\n"
            "Use this to help verify player names and amounts."
        )

    logger.info("Phase 1 AI extraction (ocr_available=%s)", bool(ocr_context))

    resp = await client.chat.completions.create(
        model=settings.openai_vision_model,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": _SYSTEM},
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:{mime_type};base64,{b64}",
                            "detail": "high",
                        },
                    },
                    {"type": "text", "text": _USER_TEMPLATE.format(ocr_hint=ocr_hint)},
                ],
            },
        ],
        max_tokens=2000,
        temperature=0.05,
    )

    raw = resp.choices[0].message.content
    if not raw:
        raise ValueError("AI returned empty extraction response")

    try:
        data = _parse_json(raw)
        result = RawExtraction.model_validate(data)
    except Exception as exc:
        logger.error("Extraction parse failed: %s | raw=%.400s", exc, raw)
        raise ValueError(f"Screenshot extraction failed: {exc}") from exc

    logger.info(
        "Phase 1 complete: %d players, %d actions, confidence=%.2f",
        len(result.players), len(result.actions), result.extraction_confidence,
    )
    return result
