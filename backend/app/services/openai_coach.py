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
from app.engines.preflop_ranges import (
    detect_preflop_node, classify_hand, get_preflop_recommendation,
)
from app.engines.poker_state import PokerState

logger = logging.getLogger(__name__)

# ── System prompt (never changes) ──────────────────────────────────────────

_SYSTEM_PROMPT = """\
You are a solver-grade GTO poker coach.  Your ONLY job is to explain decisions
using the structured data you are given.

ABSOLUTE RULES:
1. NEVER infer, guess, or reconstruct ANY game fact.
   Every position, stack size, pot size, board card, and action is already
   computed by the engine and injected below.  Trust those values exactly.
2. NEVER reference information not present in the structured context block.
3. NEVER restate the hand facts — coach the decision-making only.
4. Use precise poker terminology: SPR, range advantage, equity, blocker,
   polarity, pot odds, EV, ICM (when relevant).
5. Be terse and actionable.  No filler.  No praise sentences.

VALIDATION GATE:
If the structured context shows validation errors, write ONLY:
"Hand could not be fully validated — coaching unavailable."

OUTPUT FORMAT — use exactly these four headers, each with 1-3 sentences:

**Spot**
<one sentence describing pot type, position matchup, stack depth>

**Evaluation**
<verdict: good / suboptimal / mistake, and why>

**Preferred Line**
<what the solver-optimal line is and why>

**Takeaway**
<one transferable concept for this spot type>
"""


# ── Prompt sanitization ────────────────────────────────────────────────────

def _safe(value: object, max_len: int = 200) -> str:
    """Strip control characters and length-cap any value before it enters a prompt.

    This is a defence-in-depth measure against prompt injection that could
    arrive via a maliciously crafted hand history that tricks the parser into
    producing unexpected action strings.
    """
    text = str(value)
    # Remove ASCII control characters (except ordinary tab/newline used in formatting)
    text = "".join(ch for ch in text if ch == "\n" or ch == "\t" or (ord(ch) >= 32 and ord(ch) != 127))
    # Truncate to a safe length — no legitimate poker value is longer than this
    return text[:max_len]


# ── Public API ─────────────────────────────────────────────────────────────

async def generate_coaching(
    hand: ParsedHand,
    spot: SpotClassification,
    texture: BoardTexture,
    findings: list[HeuristicFinding],
    overall_score: int,
    game_type: str | None = None,
    player_count: int | None = None,
    poker_state: PokerState | None = None,
) -> str:
    settings = get_settings()
    if not settings.openai_api_key:
        return _fallback_coaching(spot, texture, findings)

    client = AsyncOpenAI(api_key=settings.openai_api_key)
    prompt = _build_prompt(hand, spot, texture, findings, overall_score, game_type, player_count, poker_state)

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
    poker_state: PokerState | None = None,
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
    # _safe() strips control characters so a malformed parser output cannot
    # inject instructions into the prompt.
    hero_lines: list[str] = []
    for a in hand.actions:
        if not a.is_hero:
            continue
        size = f" {a.size_bb:.1f}BB" if a.size_bb else ""
        hero_lines.append(f"  [{_safe(a.street, 20)}] {_safe(a.action, 20)}{_safe(size, 20)}")

    # ── Findings (engine output — AI must not re-derive these) ────────────
    finding_lines: list[str] = []
    for f in findings:
        tag = _safe(f.severity, 20).upper()
        finding_lines.append(
            f"  [{tag}] {_safe(f.street, 20)} / {_safe(f.action_taken, 60)}: {_safe(f.recommendation, 200)}"
        )

    # ── Canonical PokerState block (replaces manually assembled state) ────────
    # When PokerState is available it provides: node, legal actions, hand strength,
    # made-hand priority, draw classification, and validation status — all in one
    # authoritative block.  Falls back to per-field assembly when unavailable.
    if poker_state is not None:
        canonical_block = poker_state.to_prompt_block()
    else:
        canonical_block = _build_preflop_node_block(hand)

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
  Site:              {_safe(hand.site, 40)}
  Stakes:            {_safe(hand.stakes, 40)}
  {_safe(format_block, 400)}

POSITIONS (from seat topology — clockwise derivation)
  Hero position:     {_safe(hand.hero_position, 20)}
  Hero is IP:        {spot.hero_is_ip}
  Hero is PFR:       {spot.hero_is_pfr}
  Position matchup:  {_safe(spot.position_matchup, 40)}

STACKS (parser-computed — do not adjust)
  Effective stack:   {hand.effective_stack_bb:.1f}BB
  Stack depth class: {_safe(spot.stack_depth, 20)}

CARDS (parser-extracted — do not infer)
  Hero hole cards:   {_safe(hero_cards, 20)}
  Board:             {_safe(board_str, 40)}

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

{canonical_block}
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


def _build_preflop_node_block(hand: ParsedHand) -> str:
    """
    Compute preflop node context for the first hero preflop action.
    Returns an empty string if no preflop action found.
    """
    first_hero_preflop = next(
        ((i, a) for i, a in enumerate(hand.actions)
         if a.is_hero and a.street == "preflop"),
        None,
    )
    if first_hero_preflop is None:
        return ""

    idx, action = first_hero_preflop
    node = detect_preflop_node(idx, hand.actions, hand.hero_position)
    hand_bucket = classify_hand(hand.hero_cards)
    rec = get_preflop_recommendation(node, action.action, hand.hero_cards)

    legal_str = ", ".join(sorted(node.legal_actions))
    return (
        f"PREFLOP NODE ANALYSIS (engine-computed)\n"
        f"  Node type:       {node.node_type}\n"
        f"  Legal actions:   {legal_str}\n"
        f"  Hand strength:   {hand_bucket}\n"
        f"  In range:        {rec.in_range}\n"
        f"  Confidence:      {rec.confidence}\n"
        f"  Reasoning:       {rec.reasoning}\n\n"
    )


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
    mistakes = [f for f in findings if f.severity in ("mistake", "suboptimal")]
    good_plays = [f for f in findings if f.severity == "good"]

    spot_line = (
        f"{spot.pot_type} pot — {spot.position_matchup} — "
        f"{spot.stack_depth} stack ({spot.stack_depth}BB depth class)."
    )

    if texture.range_advantage == "pfr" and spot.hero_is_pfr:
        eval_line = (
            "Range advantage favours the PFR (hero) on this board. "
            "High-frequency small bets are correct to exploit the capped caller range."
        )
    elif texture.range_advantage == "caller" and not spot.hero_is_pfr:
        eval_line = (
            "Caller's range connects well here. "
            "Check-raises and leading bets gain EV when the PFR's range is wide."
        )
    else:
        eval_line = (
            "Equity is roughly neutral. "
            "Position and SPR are the dominant factors — lead with your strongest hands."
        )

    if mistakes:
        preferred_line = mistakes[0].recommendation
    elif good_plays:
        preferred_line = good_plays[0].explanation
    else:
        preferred_line = (
            "No major deviations detected. "
            "Maintain balanced ranges across bet and check on this texture."
        )

    takeaway = (
        "Consistency in sizing and bet frequency across similar textures "
        "prevents range exploitation over large samples."
    )

    return (
        f"**Spot**\n{spot_line}\n\n"
        f"**Evaluation**\n{eval_line}\n\n"
        f"**Preferred Line**\n{preferred_line}\n\n"
        f"**Takeaway**\n{takeaway}\n\n"
        "*Add your OpenAI API key to receive personalised AI coaching.*"
    )
