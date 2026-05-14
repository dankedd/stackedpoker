"""
Tournament analysis service.

Splits a tournament hand history into individual hands, scores each by ICM
importance (stack depth, all-in pressure, payout context), and returns the
top 5 spots with tournament-specific aggregate stats and ICM-aware coaching.

Reuses:
  - split_hands()         from session_service (hand boundary splitting)
  - detect_and_parse()    from parsers/detector (GGPoker + PokerStars)
"""
from __future__ import annotations
import io
import os
import re
import zipfile as _zipfile
import logging
from openai import AsyncOpenAI
from app.config import get_settings
from app.parsers.detector import detect_and_parse
from app.services.session_service import split_hands
from app.models.schemas import (
    TournamentAnalysisRequest,
    TournamentAnalysisResponse,
    TournamentStats,
    SessionHandCandidate,
)

logger = logging.getLogger(__name__)

# ── ZIP / file extraction ──────────────────────────────────────────────────

_BUY_IN_RE = re.compile(r"Buy-?In[:\s]*\$?([\d,]+(?:\.\d{2})?)", re.IGNORECASE)
_TOURNAMENT_TYPE_RE = re.compile(
    r"\b(Hyper\s*Turbo|Satellite|Bounty|SNG|Sit\s*&?\s*Go|MTT|Multi[-\s]Table)\b",
    re.IGNORECASE,
)
_TYPE_MAP = {
    "hyperturbo": "Hyper Turbo",
    "satellite": "Satellite",
    "bounty": "Bounty",
    "sng": "SNG",
    "sit&go": "SNG",
    "sitgo": "SNG",
    "mtt": "MTT",
    "multi-table": "MTT",
    "multitable": "MTT",
}


def extract_tournament_text(file_bytes: bytes, filename: str) -> str:
    """Return concatenated hand-history text from a ZIP or plain TXT upload."""
    if filename.lower().endswith(".zip"):
        texts: list[str] = []
        try:
            with _zipfile.ZipFile(io.BytesIO(file_bytes)) as zf:
                all_names = zf.namelist()
                logger.info("ZIP '%s': %d total entries", filename, len(all_names))
                for name in sorted(all_names):
                    base = os.path.basename(name)
                    if name.lower().endswith(".txt") and base and not base.startswith((".", "_")):
                        try:
                            with zf.open(name) as f:
                                content = f.read().decode("utf-8", errors="replace")
                                texts.append(content)
                                logger.info("  extracted: %s (%d chars)", name, len(content))
                        except Exception as exc:
                            logger.warning("  skipped %s: %s", name, exc)
        except _zipfile.BadZipFile:
            raise ValueError("Invalid ZIP archive — could not open file")
        if not texts:
            raise ValueError("No valid hand history files (.txt) found in ZIP")
        combined = "\n\n".join(texts)
        logger.info("ZIP extraction complete: %d files, %d total chars", len(texts), len(combined))
        return combined
    content = file_bytes.decode("utf-8", errors="replace")
    logger.info("TXT upload: %d chars", len(content))
    return content


def _detect_buy_in(text: str) -> str:
    m = _BUY_IN_RE.search(text)
    return f"${m.group(1)}" if m else ""


def _detect_tournament_type(text: str) -> str:
    m = _TOURNAMENT_TYPE_RE.search(text)
    if m:
        key = m.group(1).replace(" ", "").replace("-", "").lower()
        return _TYPE_MAP.get(key, "MTT")
    return "MTT"


async def analyze_tournament_from_upload(
    file_bytes: bytes,
    filename: str,
    tournament_type: str = "",
    buy_in: str = "",
) -> TournamentAnalysisResponse:
    """Wrapper: extract text from file then run the standard tournament pipeline."""
    text = extract_tournament_text(file_bytes, filename)
    request = TournamentAnalysisRequest(
        tournament_text=text,
        tournament_type=(tournament_type.strip() or _detect_tournament_type(text)),
        field_size="",
        buy_in=(buy_in.strip() or _detect_buy_in(text)),
    )
    return await analyze_tournament(request)


# ── Blind-level extraction ─────────────────────────────────────────────────

_BLIND_LEVEL_RE = re.compile(r"Level\s+(\w+)\s*\((\d+)/(\d+)", re.IGNORECASE)


def _extract_blind_level(hand_text: str) -> str:
    m = _BLIND_LEVEL_RE.search(hand_text)
    if m:
        return f"Level {m.group(1)} ({m.group(2)}/{m.group(3)})"
    return ""


# ── Stage classification ───────────────────────────────────────────────────

def _tournament_stage(stack_bb: float) -> str:
    if stack_bb >= 50:
        return "deep"
    if stack_bb >= 25:
        return "middle"
    if stack_bb >= 15:
        return "short"
    return "push_fold"


# ── Tournament-specific hand scoring ──────────────────────────────────────

def _score_tournament_hand(parsed) -> tuple[float, list[str]]:
    """Score a tournament hand by ICM and strategic importance.

    Short-stack and push-fold spots rank highest: they represent the
    highest EV decisions in tournaments.
    """
    score = 0.0
    reasons: list[str] = []

    stack_bb = parsed.effective_stack_bb
    pot = parsed.pot_size_bb

    # Stack depth pressure — most critical tournament dimension
    if stack_bb <= 10:
        score += 48
        reasons.append(f"critical push-fold zone ({stack_bb:.0f}bb)")
    elif stack_bb <= 15:
        score += 38
        reasons.append(f"push-fold zone ({stack_bb:.0f}bb)")
    elif stack_bb <= 20:
        score += 26
        reasons.append(f"short stack ({stack_bb:.0f}bb)")
    elif stack_bb <= 30:
        score += 16
        reasons.append(f"medium-short stack ({stack_bb:.0f}bb)")

    # Pot as % of hero's stack (all-in or commit-or-fold pressure)
    if stack_bb > 0:
        pot_pct = pot / stack_bb * 100
        if pot_pct >= 80:
            score += 25
            if not reasons or "push-fold" not in reasons[0]:
                reasons.append(f"pot is {pot_pct:.0f}% of stack")
        elif pot_pct >= 50:
            score += 14

    # Hero commits large chunk of stack (jam / reshove indicator)
    hero_large = [
        a for a in parsed.actions
        if a.is_hero and a.size_bb and a.size_bb >= max(stack_bb * 0.4, 5)
    ]
    if hero_large:
        score += 20
        reasons.append("all-in or large jam")

    # Street depth (deeper = more complex)
    if parsed.board.river:
        score += 14
    elif parsed.board.turn:
        score += 7

    # 3-bet+ pot (preflop squeeze spots)
    pf_raises = sum(
        1 for a in parsed.actions if a.street == "preflop" and a.action == "raise"
    )
    if pf_raises >= 2:
        score += 12
        reasons.append("3-bet+ pot")

    # Hero acted on river
    hero_river = [a for a in parsed.actions if a.is_hero and a.street == "river"]
    if hero_river:
        score += 10
        if any(a.action in ("bet", "raise") for a in hero_river):
            reasons.append("hero river pressure")
        else:
            reasons.append("hero faced river decision")

    return score, reasons


def _is_all_in(parsed) -> bool:
    stack_bb = parsed.effective_stack_bb
    if stack_bb <= 0:
        return False
    return any(a.size_bb and a.size_bb >= stack_bb * 0.75 for a in parsed.actions)


def _build_reason(reasons: list[str]) -> str:
    if not reasons:
        return "Strategically notable tournament spot"
    if len(reasons) == 1:
        return reasons[0].capitalize()
    return f"{reasons[0].capitalize()} — {reasons[1]}"


def _severity(parsed, score: float) -> str:
    stack_bb = parsed.effective_stack_bb
    if stack_bb <= 15 or score >= 45:
        return "high"
    if stack_bb <= 30 or score >= 25:
        return "medium"
    return "low"


def _street_depth(parsed) -> str:
    if parsed.board.river:
        return "river"
    if parsed.board.turn:
        return "turn"
    if parsed.board.flop:
        return "flop"
    return "preflop"


def _positions_str(parsed) -> str:
    villain = next((p for p in parsed.players if p.name != parsed.hero_name), None)
    hero = parsed.hero_position or "?"
    vill = villain.position if villain else "?"
    return f"{hero} vs {vill}"


# ── Tournament stats ───────────────────────────────────────────────────────

def _compute_stats(parsed_hands: list) -> dict:
    if not parsed_hands:
        return {}

    n = len(parsed_hands)
    stacks = [h.effective_stack_bb for h in parsed_hands]
    pots = [h.pot_size_bb for h in parsed_hands]

    vpip_count = 0
    total_hero_actions = 0
    total_hero_agg = 0
    three_bet_count = 0
    all_in_count = 0

    for h in parsed_hands:
        hero_pf = [a for a in h.actions if a.is_hero and a.street == "preflop"]
        if any(a.action in ("call", "raise", "bet") for a in hero_pf):
            vpip_count += 1

        for a in h.actions:
            if a.is_hero:
                total_hero_actions += 1
                if a.action in ("bet", "raise"):
                    total_hero_agg += 1

        pf_raises = [a for a in h.actions if a.street == "preflop" and a.action == "raise"]
        if len(pf_raises) >= 2:
            three_bet_count += 1

        if _is_all_in(h):
            all_in_count += 1

    deep_count   = sum(1 for s in stacks if s > 50)
    middle_count = sum(1 for s in stacks if 25 < s <= 50)
    short_count  = sum(1 for s in stacks if 15 < s <= 25)
    pf_count     = sum(1 for s in stacks if s <= 15)

    return {
        "avg_stack_bb":       round(sum(stacks) / n, 1),
        "peak_stack_bb":      round(max(stacks), 1),
        "starting_stack_bb":  round(stacks[0], 1),
        "ending_stack_bb":    round(stacks[-1], 1),
        "avg_pot_bb":         round(sum(pots) / n, 1),
        "biggest_pot_bb":     round(max(pots), 1),
        "hero_vpip_pct":      round(vpip_count / n * 100, 1),
        "hero_aggression_pct": round(
            total_hero_agg / total_hero_actions * 100, 1
        ) if total_hero_actions else 0.0,
        "three_bet_count":    three_bet_count,
        "all_in_spots":       all_in_count,
        "deep_handed_pct":    round(deep_count / n * 100),
        "middle_pct":         round(middle_count / n * 100),
        "short_stack_pct":    round(short_count / n * 100),
        "push_fold_pct":      round(pf_count / n * 100),
    }


# ── AI tournament coaching ─────────────────────────────────────────────────

async def _tournament_ai_summary(stats: dict, n_hands: int, setup: dict) -> str:
    settings = get_settings()
    if not settings.openai_api_key:
        return _fallback_summary(stats, n_hands)

    try:
        client = AsyncOpenAI(api_key=settings.openai_api_key)
        t_type       = setup.get("tournament_type", "MTT")
        push_fold    = stats.get("push_fold_pct", 0)
        short        = stats.get("short_stack_pct", 0)
        all_ins      = stats.get("all_in_spots", 0)
        three_bets   = stats.get("three_bet_count", 0)
        vpip         = stats.get("hero_vpip_pct", 0)
        agg          = stats.get("hero_aggression_pct", 0)
        avg_stack    = stats.get("avg_stack_bb", 0)

        prompt = (
            f"Tournament hand history: {n_hands} hands, {t_type}. "
            f"Average effective stack: {avg_stack:.0f}bb. "
            f"Stack depth profile: {push_fold}% push-fold (<15bb), "
            f"{short}% short stack (15-25bb). "
            f"VPIP {vpip}%, aggression rate {agg}%, "
            f"{all_ins} all-in spots, {three_bets} 3-bet pots. "
            "Write exactly 3 sentences of tournament-specific coaching. "
            "Focus on push-fold ranges, ICM pressure, stack-size adjustments, "
            "and the most impactful leaks in this tournament profile. "
            "Be concrete and actionable — no generic advice."
        )
        resp = await client.chat.completions.create(
            model=settings.openai_model,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a professional MTT poker coach specializing in ICM, "
                        "push-fold theory, and late-stage tournament strategy. Be concise."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
            max_tokens=160,
            temperature=0.6,
        )
        return resp.choices[0].message.content.strip()
    except Exception:
        return _fallback_summary(stats, n_hands)


def _fallback_summary(stats: dict, n_hands: int) -> str:
    push_fold = stats.get("push_fold_pct", 0)
    short     = stats.get("short_stack_pct", 0)
    vpip      = stats.get("hero_vpip_pct", 0)
    avg_stack = stats.get("avg_stack_bb", 0)
    all_ins   = stats.get("all_in_spots", 0)
    late_pct  = push_fold + short

    if push_fold > 30:
        return (
            f"You spent {push_fold}% of this tournament in push-fold territory (<15bb). "
            f"With {all_ins} all-in confrontations across {n_hands} hands, "
            "reviewing your jam/fold ranges in these spots will have the highest EV impact. "
            "Focus on the highlighted push-fold spots below."
        )
    if late_pct > 40:
        return (
            f"You played {late_pct}% of your hands short-stacked (<25bb). "
            f"Your {vpip}% VPIP suggests "
            f"{'tight' if vpip < 22 else 'active'} play overall — "
            "ICM pressure likely suppressed your aggression; look for more steal spots. "
            "The highlighted hands below represent your highest-leverage decisions."
        )
    return (
        f"You played {n_hands} hands averaging {avg_stack:.0f}bb effective. "
        f"VPIP of {vpip}% with {all_ins} all-in confrontations. "
        "The selected spots below are ranked by tournament importance — "
        "all-in decisions and short-stack spots first."
    )


# ── Main entry point ───────────────────────────────────────────────────────

async def analyze_tournament(request: TournamentAnalysisRequest) -> TournamentAnalysisResponse:
    raw_hands = split_hands(request.tournament_text)
    total_found = len(raw_hands)

    setup = {
        "tournament_type": request.tournament_type,
        "field_size":      request.field_size,
        "buy_in":          request.buy_in,
    }

    logger.info("Tournament split: %d hands found in %d chars", total_found, len(request.tournament_text))

    # (score, reasons, parsed_hand, raw_text, original_index, blind_level)
    scored: list[tuple[float, list[str], object, str, int, str]] = []
    failed = 0
    last_exc: Exception | None = None

    for idx, raw in enumerate(raw_hands):
        try:
            parsed = detect_and_parse(raw)
            score, reasons = _score_tournament_hand(parsed)
            blind_level = _extract_blind_level(raw)
            scored.append((score, reasons, parsed, raw, idx, blind_level))
        except Exception as exc:
            failed += 1
            last_exc = exc

    hands_parsed = total_found - failed
    logger.info(
        "Tournament parse: %d/%d succeeded, %d failed",
        hands_parsed, total_found, failed,
    )

    if hands_parsed == 0 and total_found > 0:
        sample = raw_hands[0][:300] if raw_hands else "(none)"
        logger.warning(
            "All %d hands failed to parse. Last error: %s. First hand preview:\n%s",
            total_found, last_exc, sample,
        )
        raise ValueError(
            f"Could not parse any of the {total_found} hands found in your export. "
            "Make sure you are uploading a GGPoker PokerCraft tournament hand history."
        )
    scored.sort(key=lambda x: x[0], reverse=True)
    top5 = scored[:5]

    def _to_candidate(
        score: float,
        reasons: list[str],
        parsed,
        raw: str,
        idx: int,
        blind_level: str,
    ) -> SessionHandCandidate:
        stage = _tournament_stage(parsed.effective_stack_bb)
        return SessionHandCandidate(
            hand_text=raw,
            hand_index=idx + 1,
            stakes=parsed.stakes,
            hero_position=parsed.hero_position or "?",
            positions=_positions_str(parsed),
            pot_bb=round(parsed.pot_size_bb, 1),
            street_depth=_street_depth(parsed),
            reason=_build_reason(reasons),
            severity=_severity(parsed, score),
            effective_stack_bb=round(parsed.effective_stack_bb, 1),
            blind_level=blind_level,
            tournament_stage=stage,
            is_all_in=_is_all_in(parsed),
        )

    selected = [_to_candidate(*args) for args in top5]
    all_hands = [_to_candidate(*args) for args in scored]

    all_parsed = [s[2] for s in scored]
    stats = _compute_stats(all_parsed)
    ai_summary = await _tournament_ai_summary(stats, hands_parsed, setup)

    return TournamentAnalysisResponse(
        total_hands_found=total_found,
        hands_parsed=hands_parsed,
        selected_hands=selected,
        all_hands=all_hands,
        tournament_stats=TournamentStats(
            total_hands_found=total_found,
            hands_parsed=hands_parsed,
            tournament_type=request.tournament_type,
            field_size=request.field_size,
            buy_in=request.buy_in,
            ai_summary=ai_summary,
            **stats,
        ),
    )
