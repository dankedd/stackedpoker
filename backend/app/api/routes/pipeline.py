"""
Pipeline API routes.

POST /api/pipeline/prepare
  Accepts raw hand text.
  Returns PipelineResult (CanonicalHand + PipelineValidationResult).
  Does NOT run analysis.
  Use this to show the repair/confirmation UI before committing to analysis.

POST /api/pipeline/analyze
  Accepts a PipelineResult whose validation.can_analyze=True.
  Runs the full analysis engine and returns AnalysisResponse.
  Returns 422 if can_analyze=False.

These routes require authentication.
"""
import logging
from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.canonical import PipelineResult, CanonicalHand, PipelineValidationResult
from app.engines.pipeline import run_text_pipeline
from app.middleware.auth import get_current_user
from app.database import get_db

_bearer = HTTPBearer(auto_error=False)
logger = logging.getLogger(__name__)
router = APIRouter()


class PrepareRequest(BaseModel):
    hand_text: str = Field(..., min_length=20, max_length=102_400)
    debug: bool = Field(False, description="Include parse diagnostics in response")


class AnalyzeFromCanonicalRequest(BaseModel):
    canonical: CanonicalHand
    validation: PipelineValidationResult
    game_type: str | None = None
    player_count: int | None = Field(None, ge=1, le=9)


@router.post(
    "/pipeline/prepare",
    response_model=PipelineResult,
    tags=["pipeline"],
    summary="Parse + normalize + validate — no analysis",
)
async def prepare_hand(
    request: PrepareRequest,
    current_user: dict = Depends(get_current_user),
) -> PipelineResult:
    """
    Step 1 of the 2-step pipeline.

    Parses the hand text, normalizes it into canonical form, and validates it.
    Returns the PipelineResult so the frontend can:
      - Auto-proceed to analyze if valid + high-confidence
      - Show the repair UI if invalid or low-confidence

    Does NOT run AI coaching or GTO analysis.
    Does NOT decrement usage quota.
    """
    try:
        result = run_text_pipeline(request.hand_text, debug=request.debug)
        return result
    except Exception as e:
        logger.exception("pipeline/prepare error")
        raise HTTPException(status_code=500, detail=f"Pipeline preparation failed: {e}")


@router.post(
    "/pipeline/analyze",
    tags=["pipeline"],
    summary="Run analysis on a pre-validated canonical hand",
)
async def analyze_canonical(
    request: AnalyzeFromCanonicalRequest,
    current_user: dict = Depends(get_current_user),
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: AsyncSession = Depends(get_db),
):
    """
    Step 2 of the 2-step pipeline.

    Accepts a CanonicalHand that has already passed validation.
    Runs the full analysis engine (spot classification, board texture,
    heuristics, AI coaching, replay construction).

    Returns 422 if can_analyze=False.
    """
    # ── Server-side repair: infer missing players from actions ────────────
    # The frontend may send a CanonicalHand with empty players if the
    # original parse couldn't extract seat definitions (OCR, partial paste).
    # Re-run normalization to reconstruct players from action history.
    canonical = request.canonical
    if not canonical.players and any(
        a for s in canonical.streets for a in s.actions
    ):
        logger.info(
            "Empty players with actions present — re-normalizing hand %s",
            canonical.hand_id,
        )
        from app.engines.pipeline import _canonical_to_parsed_hand
        from app.engines.normalizer import normalize_hand
        from app.engines.canonical_validator import validate_canonical

        parsed = _canonical_to_parsed_hand(canonical)
        canonical = normalize_hand(parsed, raw_text=canonical.raw_text)
        request.canonical = canonical
        # Re-validate with repaired canonical
        server_validation = validate_canonical(canonical)
        request.validation = server_validation

    if not request.validation.can_analyze:
        error_summary = "; ".join(
            e.message for e in request.validation.errors[:3]
        )
        raise HTTPException(
            status_code=422,
            detail=(
                f"Analysis blocked: hand failed validation. "
                f"Errors: {error_summary}"
            ),
        )

    user_id: str = current_user.get("sub", "")
    user_jwt: str | None = credentials.credentials if credentials else None

    from app.services.usage_service import get_user_profile, assert_usage_allowed, increment_usage
    profile = await get_user_profile(user_id)
    assert_usage_allowed(profile)

    try:
        # ── Action count tracing (for deployment debugging) ──────────────
        canonical_action_count = sum(
            len(s.actions) for s in request.canonical.streets
        )
        canonical_river_actions = []
        for s in request.canonical.streets:
            if s.name.value == "river":
                for a in s.actions:
                    canonical_river_actions.append(
                        f"{a.player_name}:{a.action.value}:{a.amount_bb}"
                    )

        # Convert canonical → ParsedHand for existing analysis engine
        from app.engines.pipeline import _canonical_to_parsed_hand
        parsed = _canonical_to_parsed_hand(request.canonical)
        parsed_action_count = len(parsed.actions)
        parsed_river_actions = [
            f"{a.player}:{a.action}:{a.size_bb}"
            for a in parsed.actions if a.street == "river"
        ]

        from app.engines.analysis import analyse_hand
        result = analyse_hand(parsed)

        # ── Phase 5: strategy DB retrieval layer ──────────────────────────
        # Uses 4-tier retrieval (cache → exact DB → similar → fallback).
        # Never blocks analysis — all errors are logged and swallowed.
        # Gated by ENABLE_SOLVER_ENGINE feature flag.
        from app.config import get_settings as _get_settings
        _solver_enabled = _get_settings().enable_solver_engine
        if _solver_enabled:
            try:
                from app.solver.abstractions import SpotAbstraction
                from app.strategy_db.retrieval import retrieve_strategy
                from app.strategy.recommendations import strategy_findings_for_hand
                from app.models.schemas import ActionFrequencyResponse, StrategyProfileResponse

                abstraction = SpotAbstraction.from_canonical_hand(request.canonical)
                retrieval = retrieve_strategy(abstraction.node_key, abstraction.solver_spot)
                profile = retrieval.profile

                result.strategy_profile = StrategyProfileResponse(
                    node_key=profile.node_key,
                    bet_frequency=profile.bet_frequency,
                    check_frequency=profile.check_frequency,
                    primary_sizing=profile.primary_sizing,
                    range_advantage=profile.range_advantage,
                    nut_advantage=profile.nut_advantage,
                    pressure_score=profile.pressure_score,
                    volatility_score=profile.volatility_score,
                    equity_realization=profile.equity_realization,
                    action_frequencies=[
                        ActionFrequencyResponse(
                            action=af.action, frequency=af.frequency, sizing=af.sizing
                        )
                        for af in profile.action_frequencies
                    ],
                    rationale=profile.rationale,
                    caveats=profile.caveats,
                    source=retrieval.retrieval_type,  # "exact"|"similar"|"fallback"|"default"
                )

                strategy_findings = strategy_findings_for_hand(
                    profile, parsed, result.spot_classification
                )
                if strategy_findings:
                    result.findings = list(result.findings) + strategy_findings

                logger.info(
                    "Strategy retrieved: key=%s type=%s source=%s cache=%s similarity=%.3f findings=%d",
                    retrieval.matched_node_key,
                    retrieval.retrieval_type,
                    retrieval.debug.get("store_source", "unknown"),
                    retrieval.cache_hit,
                    retrieval.similarity_score,
                    len(strategy_findings),
                )
            except Exception:
                logger.warning(
                    "Strategy layer failed — analysis returned without strategy profile",
                    exc_info=True,
                )
        else:
            logger.info("Solver engine disabled (ENABLE_SOLVER_ENGINE=false) — skipping strategy retrieval")

        from app.services.openai_coach import generate_coaching
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

        from app.api.routes.analyze import _build_replay
        result.replay = _build_replay(result)

        # ── Phase 6: Live solver (async, non-blocking) ───────────────────
        # Attempts a real TexasSolver solve for the river decision node.
        # Falls back to synthetic solver if TexasSolver is not installed.
        # Never blocks analysis — timeout after 15s, graceful fallback.
        if _solver_enabled:
            try:
                from app.solver.live_solver import solve_river_async, solve_river_synthetic
                from app.solver.abstractions import SpotAbstraction as _SA

                _abs = _SA.from_canonical_hand(request.canonical)
                # Determine hero's river action for EV loss computation
                _hero_river_action = None
                for _s in request.canonical.streets:
                    if _s.name.value == "river":
                        for _a in _s.actions:
                            if _a.player_id == request.canonical.hero_id:
                                _hero_river_action = _a.action.value
                                break

                try:
                    solver_result = await solve_river_async(
                        request.canonical, _abs.solver_spot, _hero_river_action,
                    )
                except Exception:
                    # TexasSolver not available — use synthetic fallback
                    solver_result = solve_river_synthetic(
                        request.canonical, _abs.solver_spot, _hero_river_action,
                    )

                if solver_result.status in ("ready", "cached"):
                    result.solver = solver_result.to_dict()
                    logger.info(
                        "Live solver: status=%s preferred=%s freqs=%s time=%.0fms",
                        solver_result.status, solver_result.preferred_action,
                        solver_result.frequencies, solver_result.solve_time_ms,
                    )
                else:
                    # Solver failed — try synthetic as fallback
                    solver_result = solve_river_synthetic(
                        request.canonical, _abs.solver_spot, _hero_river_action,
                    )
                    result.solver = solver_result.to_dict()
                    logger.info("Live solver fallback to synthetic: %s", solver_result.preferred_action)
            except Exception:
                logger.warning("Live solver layer failed entirely", exc_info=True)

        # ── Inject action trace into corrections_applied for debugging ───
        replay_action_count = len(result.replay.actions) if result.replay else 0
        replay_river = [
            f"{a.player}:{a.action}:{a.amount}:{a.is_all_in}"
            for a in (result.replay.actions if result.replay else [])
            if a.street == "river"
        ]
        result.corrections_applied = list(result.corrections_applied or []) + [
            f"trace:canonical={canonical_action_count}",
            f"trace:parsed={parsed_action_count}",
            f"trace:analysed={len(result.parsed_hand.actions)}",
            f"trace:replay={replay_action_count}",
            f"trace:canonical_river={canonical_river_actions}",
            f"trace:parsed_river={parsed_river_actions}",
            f"trace:replay_river={replay_river}",
        ]
        logger.info(
            "Action trace: canonical=%d parsed=%d analysed=%d replay=%d | river: %s",
            canonical_action_count, parsed_action_count,
            len(result.parsed_hand.actions), replay_action_count,
            replay_river,
        )

        from app.services.supabase_persistence import save_hand_analysis as save_to_supabase
        raw_text = request.canonical.raw_text or ""
        saved_id, save_error = await save_to_supabase(
            user_id, raw_text, result, user_jwt=user_jwt
        )
        result.saved_id = saved_id or None
        result.save_error = save_error or None

        if db is not None:
            try:
                from app.services.hand_service import save_analysis
                await save_analysis(db, raw_text, result)
            except Exception:
                logger.warning("DB persist failed — returning result anyway")

        from app.services.learning_integration import process_analysis_for_learning
        await process_analysis_for_learning(
            user_id=user_id,
            findings=result.findings or [],
            analysis_id=saved_id,
        )

        await increment_usage(user_id)
        return result

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.exception("pipeline/analyze error")
        raise HTTPException(status_code=500, detail="Analysis failed after validation.")
