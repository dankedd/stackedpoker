"""
OpenAI coaching service — generates human-readable poker coaching.
"""
from __future__ import annotations
import logging
from openai import AsyncOpenAI
from app.config import get_settings
from app.models.schemas import ParsedHand, SpotClassification, BoardTexture, HeuristicFinding

logger = logging.getLogger(__name__)


async def generate_coaching(
    hand: ParsedHand,
    spot: SpotClassification,
    texture: BoardTexture,
    findings: list[HeuristicFinding],
    overall_score: int,
) -> str:
    settings = get_settings()
    if not settings.openai_api_key:
        return _fallback_coaching(spot, texture, findings)

    client = AsyncOpenAI(api_key=settings.openai_api_key)
    prompt = _build_prompt(hand, spot, texture, findings, overall_score)

    try:
        response = await client.chat.completions.create(
            model=settings.openai_model,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are an expert poker coach with deep knowledge of GTO (Game Theory Optimal) strategy. "
                        "Provide clear, educational, and actionable poker coaching. "
                        "Use poker terminology but explain key concepts. "
                        "Focus on range theory, board texture, position, and sizing principles. "
                        "Keep your response concise (3-5 paragraphs) and structured."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
            temperature=0.7,
            max_tokens=800,
        )
        return response.choices[0].message.content or _fallback_coaching(spot, texture, findings)
    except Exception as e:
        logger.warning("OpenAI coaching failed: %s", e)
        return _fallback_coaching(spot, texture, findings)


def _build_prompt(
    hand: ParsedHand,
    spot: SpotClassification,
    texture: BoardTexture,
    findings: list[HeuristicFinding],
    score: int,
) -> str:
    board_str = " ".join(hand.board.flop)
    if hand.board.turn:
        board_str += " | " + hand.board.turn[0]
    if hand.board.river:
        board_str += " | " + hand.board.river[0]

    hero_cards = " ".join(hand.hero_cards) if hand.hero_cards else "unknown"

    actions_summary = []
    for a in hand.actions:
        if a.is_hero:
            size = f" {a.size_bb:.1f}BB" if a.size_bb else ""
            actions_summary.append(f"  Hero [{a.street}]: {a.action}{size}")

    findings_summary = []
    for f in findings:
        findings_summary.append(f"  [{f.severity.upper()}] {f.street}: {f.action_taken} — {f.recommendation}")

    return f"""Analyze this poker hand and provide coaching:

HAND DETAILS:
- Site: {hand.site} | Stakes: ${hand.stakes}
- Hero Position: {hand.hero_position} | Pot Type: {spot.pot_type}
- Effective Stack: {hand.effective_stack_bb:.0f}BB
- Hero Cards: {hero_cards}
- Board: {board_str}
- Board Texture: {texture.description}
- Board Bucket: {texture.bucket}
- Range Advantage: {texture.range_advantage}

HERO'S ACTIONS:
{chr(10).join(actions_summary) if actions_summary else '  No hero actions recorded'}

HEURISTIC FINDINGS:
{chr(10).join(findings_summary) if findings_summary else '  No specific issues found'}

OVERALL SCORE: {score}/100

Please provide:
1. A brief overall assessment of how Hero played this hand
2. The key strategic concept(s) relevant to this spot (range advantage, board texture, etc.)
3. Specific adjustments Hero should make in similar spots
4. An educational takeaway about the poker fundamentals demonstrated here

Be specific, educational, and encouraging. Reference the actual board texture and position."""


def _fallback_coaching(
    spot: SpotClassification,
    texture: BoardTexture,
    findings: list[HeuristicFinding],
) -> str:
    lines = [
        f"**Spot Analysis: {spot.position_matchup} — {spot.pot_type}**\n",
        f"This is a **{spot.pot_type}** pot with you playing {spot.position_matchup}. "
        f"The board is a **{texture.description}**.\n",
    ]

    if texture.range_advantage == "pfr":
        lines.append(
            "On this board type, the preflop raiser typically has a significant range advantage. "
            "This means you can apply pressure at a high frequency with smaller sizings."
        )
    elif texture.range_advantage == "caller":
        lines.append(
            "The caller's range tends to connect well with this board texture. "
            "Be more selective about continuation betting and prefer checking your marginal hands."
        )
    else:
        lines.append(
            "This is a relatively neutral board where both ranges have reasonable equity. "
            "Position and pot odds become the key decision drivers."
        )

    if findings:
        mistakes = [f for f in findings if f.severity in ("mistake", "suboptimal")]
        if mistakes:
            lines.append(
                f"\n**Key Adjustment:** {mistakes[0].explanation}"
            )
        good_plays = [f for f in findings if f.severity == "good"]
        if good_plays:
            lines.append(
                f"\n**Well Played:** {good_plays[0].explanation}"
            )

    lines.append(
        "\n*Add your OpenAI API key to receive personalised AI coaching for this hand.*"
    )
    return "\n".join(lines)
