"""
OpenAI coaching service — structured, template-based poker coaching.

ARCHITECTURE RULE:
  The AI is ONLY a coaching voice on top of deterministic engine output.
  It NEVER infers positions, stacks, board state, pot sizes, or action sequences.
  All game facts are computed by the parser/engine pipeline and injected verbatim.

Prompt design:
  - System message: explicit prohibition on inference; output format enforced.
  - User message: fully-structured context block — no raw hand history text.
  - Temperature 0.4: consistent coaching tone, not creative.
  - max_tokens 700: forces concise, actionable output.
"""
from __future__ import annotations

import logging
from openai import AsyncOpenAI

from app.config import get_settings
from app.models.schemas import (
    BoardTexture,
    HeuristicFinding,
    ParsedHand,
    SpotClassification,
)

logger = logging.getLogger(__name__)

# ── System prompt (never changes) ──────────────────────────────────────────

_SYSTEM_PROMPT = """\
You are an expert GTO poker coach generating structured coaching feedback.

HARD RULES — never break these:
1. Do NOT infer, guess, or assume any game fact.
   Positions, stacks, pot size, board cards, and action history are all provided below.
2. Do NOT mention or reference any information not given in the structured context.
3. Do NOT restate the hand facts — coach on the decisions.
4. Use precise poker terminology: range advantage, pot odds, SPR, blocker, equity, polarity.
5. Be direct and actionable. No padding. No "Great job on…" filler.

OUTPUT FORMAT — use these exact section headers, each followed by 1-3 sentences:
**Overall Assessment**
**Key Concept**
**Adjustment**
**Takeaway**
"""


# ── Public API ─────────────────────────────────────────────────────────────

async def generate_coaching(
    hand: ParsedHand,
    spot: SpotClassification,
    texture: BoardTexture,
    findings: list[HeuristicFinding],
    overall_score: int,
    game_type: str | None = None,
    player_count: int | None = None,
) -> str:
    settings = get_settings()
    if not settings.openai_api_key:
        return _fallback_coaching(spot, texture, findings)

    client = AsyncOpenAI(api_key=settings.openai_api_key)
    prompt = _build_prompt(hand, spot, texture, findings, overall_score, game_type, player_count)

    try:
        response = await client.chat.completions.create(
            model=settings.openai_model,
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            temperature=0.4,
            max_tokens=700,
        )
        text = response.choices[0].message.content or ""
        return text.strip() or _fallback_coaching(spot, texture, findings)
    except Exception as e:
        logger.warning("OpenAI coaching failed: %s", e)
        return _fallback_coaching(spot, texture, findings)


# ── Prompt builder ─────────────────────────────────────────────────────────

def _build_prompt(
    hand: ParsedHand,
    spot: SpotClassification,
    texture: BoardTexture,
    findings: list[HeuristicFinding],
    score: int,
    game_type: str | None = None,
    player_count: int | None = None,
) -> str:
    # ── Board string ───────────────────────────────────────────────────────
    board_parts = list(hand.board.flop)
    if hand.board.turn:
        board_parts += ["|"] + list(hand.board.turn)
    if hand.board.river:
        board_parts += ["|"] + list(hand.board.river)
    board_str = " ".join(board_parts) if board_parts else "none (preflop)"

    hero_cards = " ".join(hand.hero_cards) if hand.hero_cards else "unknown"

    # ── Hero action summary (deterministic — engine computed) ──────────────
    hero_lines: list[str] = []
    for a in hand.actions:
        if not a.is_hero:
            continue
        size = f" {a.size_bb:.1f}BB" if a.size_bb else ""
        hero_lines.append(f"  [{a.street}] {a.action}{size}")

    # ── Findings (engine output — AI must not re-derive these) ────────────
    finding_lines: list[str] = []
    for f in findings:
        tag = f.severity.upper()
        finding_lines.append(f"  [{tag}] {f.street} / {f.action_taken}: {f.recommendation}")

    # ── Spot template selector ─────────────────────────────────────────────
    spot_context = _spot_template(spot, texture)

    # ── Game format notes ──────────────────────────────────────────────────
    format_lines: list[str] = []
    if game_type:
        format_lines.append(f"Format: {game_type}")
        _FORMAT_NOTES: dict[str, str] = {
            "Spin & Gold":          "Push/fold ICM dynamics; short-stack shove ranges apply.",
            "All-In or Fold":       "Every decision is push/fold; apply tight shove/call ranges.",
            "Rush & Cash":          "Fast-fold pool; assume tight population tendencies.",
            "Mystery Battle Royale": "Lottery-style ICM; chip preservation priority.",
            "PLO":                  "4-card hand values; equity runs close; nut advantage critical.",
            "Short Deck":           "Flush beats full house; straights more common.",
        }
        if game_type in _FORMAT_NOTES:
            format_lines.append(f"Format note: {_FORMAT_NOTES[game_type]}")

    if player_count:
        desc = f"{player_count}-handed" if player_count > 2 else "heads-up"
        format_lines.append(f"Table size: {desc}")
        if player_count <= 3:
            format_lines.append("Range adjustment: Widen significantly for short-handed play.")
        elif player_count >= 8:
            format_lines.append("Range adjustment: Tighten for full ring.")

    format_block = "\n".join(format_lines) if format_lines else "Standard cash game."

    return f"""
=== STRUCTURED HAND CONTEXT (engine-computed — do not re-derive) ===

SITE & GAME
  Site:              {hand.site}
  Stakes:            {hand.stakes}
  {format_block}

POSITIONS (from seat topology — clockwise derivation)
  Hero position:     {hand.hero_position}
  Hero is IP:        {spot.hero_is_ip}
  Hero is PFR:       {spot.hero_is_pfr}
  Position matchup:  {spot.position_matchup}

STACKS (parser-computed — do not adjust)
  Effective stack:   {hand.effective_stack_bb:.1f}BB
  Stack depth class: {spot.stack_depth}

CARDS (parser-extracted — do not infer)
  Hero hole cards:   {hero_cards}
  Board:             {board_str}

BOARD ANALYSIS (engine-computed)
  Texture:           {texture.description}
  Bucket:            {texture.bucket}
  Wetness:           {texture.wetness}
  Suitedness:        {texture.suitedness}
  Paired:            {texture.is_paired}
  Range advantage:   {texture.range_advantage}

POT TYPE
  Classification:    {spot.pot_type}
  Spot ID:           {spot.spot_id}

HERO ACTIONS (chronological)
{chr(10).join(hero_lines) if hero_lines else "  None recorded"}

ENGINE FINDINGS (deterministic heuristics)
{chr(10).join(finding_lines) if finding_lines else "  No significant deviations detected"}

OVERALL SCORE: {score}/100

COACHING CONTEXT
{spot_context}

=== COACHING INSTRUCTIONS ===
Using ONLY the above structured context, write coaching under the four required headers.
Do not restate game facts. Focus on: why the decision was correct/incorrect, the key
strategic concept, a concrete adjustment for next time, and one transferable takeaway.
""".strip()


def _spot_template(spot: SpotClassification, texture: BoardTexture) -> str:
    """Select the right coaching frame based on pot type + texture range advantage."""
    pot = spot.pot_type
    adv = texture.range_advantage
    is_pfr = spot.hero_is_pfr
    is_ip = spot.hero_is_ip
    depth = spot.stack_depth

    lines: list[str] = []

    # Pot type context
    if pot == "SRP":
        lines.append("Single-raised pot: typical opening range vs BB defend / late-position call.")
    elif pot == "3bet":
        lines.append("3-bet pot: polarised ranges, higher SPR constraints, squeeze dynamics apply.")
    else:
        lines.append("4-bet pot: near-commit depth in most stack configurations; range very polar.")

    # Range advantage coaching frame
    if adv == "pfr":
        if is_pfr:
            lines.append("Hero (PFR) holds the range advantage: high-frequency small bets are correct.")
        else:
            lines.append("Opponent (PFR) holds the range advantage: be selective, prefer check/call over donk.")
    elif adv == "caller":
        if not is_pfr:
            lines.append("Hero (caller) holds range advantage on this board: consider leading or check-raising.")
        else:
            lines.append("Opponent (caller) connected well: reduce bet frequency, check marginal hands.")
    else:
        lines.append("Neutral board: both ranges have reasonable equity; position and SPR dominate.")

    # Stack depth note
    if depth == "short":
        lines.append(
            f"Stack is short ({spot.stack_depth}): keep lines simple, avoid multi-street bluffs, "
            "get all-in efficiently with strong hands."
        )
    elif depth == "deep":
        lines.append(
            "Deep stack: implied odds matter, complex multi-street planning is correct to consider."
        )

    # Position note
    if not is_ip:
        lines.append("Hero is OOP: check-raise and leading lines gain importance to deny free turns/rivers.")

    return "\n".join(f"  {l}" for l in lines)


# ── Fallback (no API key / error) ─────────────────────────────────────────

def _fallback_coaching(
    spot: SpotClassification,
    texture: BoardTexture,
    findings: list[HeuristicFinding],
) -> str:
    lines = [
        f"**Overall Assessment**\n"
        f"This is a **{spot.pot_type}** pot with hero playing **{spot.position_matchup}**. "
        f"The board is a **{texture.description}**.\n",
    ]

    if texture.range_advantage == "pfr" and spot.hero_is_pfr:
        lines.append(
            "**Key Concept**\nYou hold the range advantage as the PFR. "
            "This justifies high-frequency small bets to extract value and deny equity cheaply.\n"
        )
    elif texture.range_advantage == "caller" and not spot.hero_is_pfr:
        lines.append(
            "**Key Concept**\nYour calling range connects strongly here. "
            "Donk-leading or check-raising becomes attractive when villain's c-bet range is wide.\n"
        )
    else:
        lines.append(
            "**Key Concept**\nNeutral equity distribution: position and SPR are the key variables. "
            "Prefer checking your marginal hands and building the pot with value hands.\n"
        )

    mistakes = [f for f in findings if f.severity in ("mistake", "suboptimal")]
    good_plays = [f for f in findings if f.severity == "good"]

    if mistakes:
        lines.append(f"**Adjustment**\n{mistakes[0].recommendation}\n")
    else:
        lines.append(
            "**Adjustment**\nNo significant errors detected. "
            "Continue maintaining balanced ranges across bet and check.\n"
        )

    if good_plays:
        lines.append(f"**Takeaway**\n{good_plays[0].explanation}")
    else:
        lines.append(
            "**Takeaway**\nConsistency in range construction across streets "
            "prevents exploitation even without a specific mistake this hand."
        )

    lines.append("\n*Add your OpenAI API key to receive personalised AI coaching.*")
    return "\n".join(lines)
