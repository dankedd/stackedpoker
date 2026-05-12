"""
Session analysis service.

Splits a multi-hand session text into individual hands, scores each for
strategic interest, and returns the top 3 spots worth reviewing.
"""
from __future__ import annotations
import re
import logging
from openai import AsyncOpenAI
from app.config import get_settings
from app.parsers.detector import detect_and_parse
from app.models.schemas import (
    SessionAnalysisRequest,
    SessionAnalysisResponse,
    SessionHandCandidate,
    SessionStats,
)

logger = logging.getLogger(__name__)

# ── Hand splitting ─────────────────────────────────────────────────────────

_HAND_START = re.compile(
    r"(?:Poker Hand #|PokerStars Hand #|Hand #|NL Hold'em \$)",
    re.IGNORECASE,
)


def split_hands(session_text: str) -> list[str]:
    """Split a session dump into a list of individual hand strings."""
    boundaries = [m.start() for m in _HAND_START.finditer(session_text)]
    if not boundaries:
        return [session_text.strip()] if session_text.strip() else []
    hands: list[str] = []
    for i, start in enumerate(boundaries):
        end = boundaries[i + 1] if i + 1 < len(boundaries) else len(session_text)
        hand = session_text[start:end].strip()
        if hand:
            hands.append(hand)
    return hands


# ── Interest scoring ───────────────────────────────────────────────────────

def _score_hand(parsed) -> tuple[float, list[str]]:
    """Return (interest_score, reason_parts) for a parsed hand."""
    score = 0.0
    reasons: list[str] = []

    pot = parsed.pot_size_bb
    if pot >= 60:
        score += 30
        reasons.append(f"massive {pot:.0f}bb pot")
    elif pot >= 30:
        score += 18
        reasons.append(f"large {pot:.0f}bb pot")
    elif pot >= 15:
        score += 8
        reasons.append(f"{pot:.0f}bb pot")

    # Street depth
    if parsed.board.river:
        score += 20
    elif parsed.board.turn:
        score += 10

    # Hero actions on river
    hero_river = [a for a in parsed.actions if a.is_hero and a.street == "river"]
    if hero_river:
        score += 15
        if any(a.action in ("bet", "raise") for a in hero_river):
            reasons.append("hero applied river pressure")
        else:
            reasons.append("hero faced river decision")

    # 3-bet+ pot
    pf_raises = sum(1 for a in parsed.actions if a.street == "preflop" and a.action == "raise")
    if pf_raises >= 2:
        score += 12
        reasons.append("3-bet+ pot")

    # Large individual bet/raise
    big = [a for a in parsed.actions if a.size_bb and a.size_bb >= 20]
    if big:
        biggest = max(a.size_bb for a in big)
        score += 8
        reasons.append(f"{biggest:.0f}bb bet")

    # Multiple hero aggressive actions
    hero_agg = [a for a in parsed.actions if a.is_hero and a.action in ("bet", "raise")]
    if len(hero_agg) >= 2:
        score += 6

    # Short stack pressure
    if parsed.effective_stack_bb < 25:
        score += 5
        reasons.append("short-stack pressure")

    return score, reasons


def _street_depth(parsed) -> str:
    if parsed.board.river:
        return "river"
    if parsed.board.turn:
        return "turn"
    if parsed.board.flop:
        return "flop"
    return "preflop"


def _severity(parsed, score: float) -> str:
    pot = parsed.pot_size_bb
    if score >= 40 or pot >= 50:
        return "high"
    if score >= 20 or pot >= 20:
        return "medium"
    return "low"


def _build_reason(reasons: list[str]) -> str:
    if not reasons:
        return "Strategically notable spot"
    if len(reasons) == 1:
        return reasons[0].capitalize()
    return f"{reasons[0].capitalize()} — {reasons[1]}"


def _positions_str(parsed) -> str:
    villain = next((p for p in parsed.players if p.name != parsed.hero_name), None)
    hero = parsed.hero_position or "?"
    vill = villain.position if villain else "?"
    return f"{hero} vs {vill}"


# ── Session stats ──────────────────────────────────────────────────────────

def _compute_stats(parsed_hands: list) -> dict:
    if not parsed_hands:
        return {"avg_pot_bb": 0.0, "biggest_pot_bb": 0.0,
                "hero_vpip_pct": 0.0, "hero_aggression_pct": 0.0}

    pots = [h.pot_size_bb for h in parsed_hands]
    avg_pot = sum(pots) / len(pots)
    biggest_pot = max(pots)

    vpip_count = 0
    total_hero_actions = 0
    total_hero_agg = 0

    for h in parsed_hands:
        hero_pf = [a for a in h.actions if a.is_hero and a.street == "preflop"]
        if any(a.action in ("call", "raise", "bet") for a in hero_pf):
            vpip_count += 1
        for a in h.actions:
            if a.is_hero:
                total_hero_actions += 1
                if a.action in ("bet", "raise"):
                    total_hero_agg += 1

    vpip_pct = round(vpip_count / len(parsed_hands) * 100, 1)
    agg_pct = round(total_hero_agg / total_hero_actions * 100, 1) if total_hero_actions else 0.0

    return {
        "avg_pot_bb": round(avg_pot, 1),
        "biggest_pot_bb": round(biggest_pot, 1),
        "hero_vpip_pct": vpip_pct,
        "hero_aggression_pct": agg_pct,
    }


async def _session_ai_summary(stats: dict, n_hands: int) -> str:
    settings = get_settings()
    if not settings.openai_api_key:
        return _fallback_summary(stats, n_hands)
    try:
        client = AsyncOpenAI(api_key=settings.openai_api_key)
        prompt = (
            f"{n_hands} hands played. Avg pot {stats['avg_pot_bb']}bb, "
            f"biggest pot {stats['biggest_pot_bb']}bb, VPIP {stats['hero_vpip_pct']}%, "
            f"aggression rate {stats['hero_aggression_pct']}%. "
            "In exactly 2 sentences, give a coaching insight about this session. "
            "Be specific and actionable."
        )
        resp = await client.chat.completions.create(
            model=settings.openai_model,
            messages=[
                {"role": "system", "content": "You are a professional poker coach. Be concise."},
                {"role": "user", "content": prompt},
            ],
            max_tokens=100,
            temperature=0.6,
        )
        return resp.choices[0].message.content.strip()
    except Exception:
        return _fallback_summary(stats, n_hands)


def _fallback_summary(stats: dict, n_hands: int) -> str:
    vpip = stats["hero_vpip_pct"]
    agg = stats["hero_aggression_pct"]
    if vpip > 40:
        return (
            f"You played {n_hands} hands with a {vpip}% VPIP — that's on the loose side. "
            "Consider tightening your pre-flop ranges to reduce difficult post-flop spots."
        )
    if agg < 30:
        return (
            f"Your {agg}% aggression rate suggests a passive post-flop approach. "
            "Look for more spots to bet for value and protection on earlier streets."
        )
    return (
        f"You played {n_hands} hands with a {vpip}% VPIP and {agg}% aggression rate. "
        "The selected spots below represent your most important decisions this session."
    )


# ── Main entry point ───────────────────────────────────────────────────────

async def analyze_session(request: SessionAnalysisRequest) -> SessionAnalysisResponse:
    raw_hands = split_hands(request.session_text)
    total_found = len(raw_hands)

    # Parse all hands, skipping failures
    scored: list[tuple[float, list[str], object, str, int]] = []
    failed = 0
    for idx, raw in enumerate(raw_hands):
        try:
            parsed = detect_and_parse(raw)
            score, reasons = _score_hand(parsed)
            scored.append((score, reasons, parsed, raw, idx))
        except Exception:
            failed += 1

    hands_parsed = total_found - failed

    # Pick top 3 by score (distinct hands)
    scored.sort(key=lambda x: x[0], reverse=True)
    top3 = scored[:3]

    selected: list[SessionHandCandidate] = []
    for score, reasons, parsed, raw, idx in top3:
        villain = next((p for p in parsed.players if p.name != parsed.hero_name), None)
        selected.append(SessionHandCandidate(
            hand_text=raw,
            hand_index=idx + 1,
            stakes=parsed.stakes,
            hero_position=parsed.hero_position or "?",
            positions=_positions_str(parsed),
            pot_bb=round(parsed.pot_size_bb, 1),
            street_depth=_street_depth(parsed),
            reason=_build_reason(reasons),
            severity=_severity(parsed, score),
        ))

    # Session stats from all parsed hands
    all_parsed = [s[2] for s in scored]
    stats = _compute_stats(all_parsed)
    ai_summary = await _session_ai_summary(stats, hands_parsed)

    return SessionAnalysisResponse(
        total_hands_found=total_found,
        hands_parsed=hands_parsed,
        selected_hands=selected,
        session_stats=SessionStats(
            total_hands_found=total_found,
            hands_parsed=hands_parsed,
            ai_summary=ai_summary,
            **stats,
        ),
    )
