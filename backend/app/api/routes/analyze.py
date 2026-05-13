import re
import logging
from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.schemas import (
    HandAnalysisRequest, AnalysisResponse,
    ReplayAnalysis, HandSummaryData, ReplayAction, ReplayFeedback, OverallVerdict,
    SeatedPlayer, ParsedHand,
)
from app.engines.scoring import score_all_hero_actions
from app.parsers.detector import detect_and_parse
from app.engines.analysis import analyse_hand
from app.services.openai_coach import generate_coaching
from app.services.hand_service import save_analysis
from app.services.supabase_persistence import save_hand_analysis as save_to_supabase
from app.services.usage_service import get_user_profile, assert_usage_allowed, increment_usage
from app.middleware.auth import get_current_user
from app.database import get_db

_bearer = HTTPBearer(auto_error=False)

logger = logging.getLogger(__name__)
router = APIRouter()

_SEVERITY_TO_RATING: dict[str, str] = {
    "mistake": "mistake",
    "suboptimal": "okay",
    "good": "good",
    "note": "okay",
}


def _build_seated_players(parsed: ParsedHand) -> list[SeatedPlayer]:
    """Build clockwise SeatedPlayer list with hero at seat_index=0."""
    hero_seat = next((p.seat for p in parsed.players if p.name == parsed.hero_name), None)
    if hero_seat is None:
        return []
    all_seats = list(range(1, parsed.table_max_seats + 1))
    try:
        hero_idx = all_seats.index(hero_seat)
    except ValueError:
        hero_idx = 0
    cw_from_hero = all_seats[hero_idx:] + all_seats[:hero_idx]
    player_by_seat = {p.seat: p for p in parsed.players}
    result = []
    for i, seat_num in enumerate(cw_from_hero):
        p = player_by_seat.get(seat_num)
        if p:
            result.append(SeatedPlayer(
                name=p.name,
                position=p.position,
                stack_bb=p.stack_bb,
                is_hero=(p.name == parsed.hero_name),
                seat_index=i,
            ))
    return result


def _build_replay(result: AnalysisResponse) -> ReplayAnalysis:
    """Convert AnalysisResponse → ReplayAnalysis for the animated replay UI.

    Derives the full replay structure from already-computed data — no extra AI call.
    Findings are matched to hero actions by (street, action verb); unmatched actions
    get no feedback dot, which is correct (heuristics only fire on notable plays).
    """
    parsed = result.parsed_hand

    # Deterministic per-action coaching (no LLM — same input → same output).
    coaching_by_idx = score_all_hero_actions(
        parsed, result.findings, result.spot_classification, result.board_texture
    )

    # Map findings to hero actions by (street, action verb) for the legacy feedback dot.
    finding_by_key: dict[tuple[str, str], object] = {}
    for f in result.findings:
        verb = f.action_taken.split()[0].lower() if f.action_taken else ""
        finding_by_key.setdefault((f.street.lower(), verb), f)

    # Build replay actions with a running pot.
    # ParsedHand.actions never includes blind posts (types: fold/check/call/bet/raise),
    # so we seed the pot with the 1.5bb already posted by SB + BB.
    pot = 1.5
    replay_actions: list[ReplayAction] = []

    for i, a in enumerate(parsed.actions):
        if a.action in ("call", "bet", "raise"):
            pot += a.size_bb or 0.0

        feedback = None
        if a.is_hero:
            f = finding_by_key.get((a.street, a.action))
            if f:
                feedback = ReplayFeedback(
                    rating=_SEVERITY_TO_RATING[f.severity],
                    title=f.recommendation,
                    explanation=f.explanation,
                    gto_note=f.freq_recommendation,
                )

        replay_actions.append(ReplayAction(
            id=len(replay_actions) + 1,
            street=a.street,
            player=a.player,
            action=a.action,
            amount=f"{a.size_bb:.1f}bb" if a.size_bb else None,
            pot_after=round(pot, 2),
            is_hero=a.is_hero,
            feedback=feedback,
            coaching=coaching_by_idx.get(i),
        ))

    villain = next((p for p in parsed.players if p.name != parsed.hero_name), None)
    hand_summary = HandSummaryData(
        stakes=parsed.stakes,
        hero_position=parsed.hero_position,
        hero_cards=parsed.hero_cards,
        villain_position=villain.position if villain else None,
        villain_cards=None,
        effective_stack_bb=parsed.effective_stack_bb,
        board=parsed.board,
        big_blind=parsed.big_blind,
        currency="",
        players=_build_seated_players(parsed),
        player_count=parsed.table_max_seats,
    )

    # Use the first two sentences of ai_coaching as the verdict summary.
    ai_text = (result.ai_coaching or "").strip()
    sentences = re.split(r"(?<=[.!?])\s+", ai_text)
    summary = " ".join(sentences[:2]) if sentences else ai_text[:280]

    score = result.overall_score
    title = (
        "Excellent play"             if score >= 85 else
        "Solid play"                 if score >= 70 else
        "Room for improvement"       if score >= 55 else
        "Significant errors detected" if score >= 40 else
        "Major strategic errors"
    )

    return ReplayAnalysis(
        hand_summary=hand_summary,
        actions=replay_actions,
        overall_verdict=OverallVerdict(
            score=score,
            title=title,
            summary=summary or f"Overall score: {score}/100",
            key_mistakes=[f.recommendation for f in result.findings if f.severity == "mistake"],
            key_strengths=[f.explanation for f in result.findings if f.severity == "good"],
        ),
    )


@router.post("/analyze", response_model=AnalysisResponse, tags=["analysis"])
async def analyze_hand(
    request: HandAnalysisRequest,
    current_user: dict = Depends(get_current_user),
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: AsyncSession = Depends(get_db),
) -> AnalysisResponse:
    """Full pipeline: auth → usage check → parse → classify → heuristics → AI coaching → replay → persist → increment."""
    user_id: str = current_user.get("sub", "")
    user_jwt: str | None = credentials.credentials if credentials else None

    # 1. Server-side usage check (raises 401/403 on failure)
    profile = await get_user_profile(user_id)
    assert_usage_allowed(profile)

    try:
        # 2. Parse
        parsed = detect_and_parse(request.hand_text)

        # 3. Structural analysis (no AI yet)
        result = analyse_hand(parsed)

        # 4. AI coaching
        coaching = await generate_coaching(
            hand=parsed,
            spot=result.spot_classification,
            texture=result.board_texture,
            findings=result.findings,
            overall_score=result.overall_score,
            game_type=request.game_type,
            player_count=request.player_count,
        )
        result.ai_coaching = coaching

        # 5. Build replay from already-computed data (no extra AI call)
        result.replay = _build_replay(result)

        # 6. Persist to Supabase hand_analyses (primary user-facing store)
        saved_id, save_error = await save_to_supabase(
            user_id, request.hand_text, result, user_jwt=user_jwt
        )
        result.saved_id = saved_id or None
        result.save_error = save_error or None
        if save_error:
            logger.warning("Supabase persist failed for user=%s: %s", user_id, save_error)

        # 7. Persist to local DB (best-effort — skipped if DB unavailable)
        if db is not None:
            try:
                await save_analysis(db, request.hand_text, result)
            except Exception:
                logger.warning("DB persist failed — returning result anyway")

        # 8. Increment usage only on success (not on parse/analysis errors)
        await increment_usage(user_id)

        return result

    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.exception("Analyze error")
        raise HTTPException(status_code=500, detail="Analysis failed. Please check your hand history format.")
