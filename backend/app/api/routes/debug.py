"""
Debug routes for solver pipeline inspection.

POST /api/debug/spot
  Accepts a CanonicalHand and returns the full solver abstraction output
  (SolverSpot, BoardFeatures, NodeKey). No auth required.

POST /api/debug/full-analysis
  Runs the complete pipeline — abstraction + strategy retrieval + findings.
  Protected by DEBUG_STRATEGY_ENABLED env flag and optional X-Debug-Token.
  Returns partial data on any failure (never crashes).

GET /api/debug/strategy-store/stats
  Returns store/cache/metrics stats. Same protection as full-analysis.
"""

from __future__ import annotations

import logging
import time
from typing import Any, Optional

from fastapi import APIRouter, Body, Header, HTTPException
from pydantic import BaseModel

from app.api.examples.spot_examples import SPOT_OPENAPI_EXAMPLES
from app.config import get_settings
from app.models.canonical import CanonicalHand
from app.solver.abstractions import NodeKey, SpotAbstraction
from app.solver.board_features import BoardFeatures
from app.solver.models import SolverSpot

logger = logging.getLogger(__name__)
router = APIRouter()
settings = get_settings()


# ── Auth guard ────────────────────────────────────────────────────────────────

def _check_debug_access(x_debug_token: str | None) -> None:
    """
    Raise 403 if debug strategy endpoints are disabled or token is wrong.

    Rules:
      - If DEBUG_STRATEGY_ENABLED is False → always 403
      - If DEBUG_ADMIN_TOKEN is set → X-Debug-Token header must match
      - Otherwise (dev mode, no token configured) → allow
    """
    if not settings.debug_strategy_enabled:
        raise HTTPException(
            status_code=403,
            detail=(
                "Strategy debug endpoints are disabled. "
                "Set DEBUG_STRATEGY_ENABLED=true to enable."
            ),
        )
    if settings.debug_admin_token:
        if x_debug_token != settings.debug_admin_token:
            raise HTTPException(
                status_code=403,
                detail="Invalid or missing X-Debug-Token header.",
            )


# ── Response schemas ──────────────────────────────────────────────────────────


class NodeKeyResponse(BaseModel):
    """All NodeKey fields plus the derived string representations."""

    string: str
    """Full node key: 'SRP::BTN_vs_BB::100bb::8_PLUS::A_HIGH_DRY::flop::2p'"""

    positional_prefix: str
    """Prefix scoped to spot_type + matchup: 'SRP::BTN_vs_BB'"""

    street_prefix: str
    """Prefix scoped to spot_type + matchup + stack + street: 'SRP::BTN_vs_BB::100bb::flop'"""

    spot_type: str
    position_matchup: str
    stack_depth_bucket: str
    spr_bucket: str
    board_class: str
    street: str
    player_count: int


class SpotDebugResponse(BaseModel):
    """Full solver abstraction output for a single CanonicalHand."""

    spot: SolverSpot
    """SolverSpot with all strategic dimensions — spot_type, matchup, SPR, board_class, etc."""

    board_features: Optional[BoardFeatures]
    """Full board texture profile (20 fields), or null for preflop-only hands."""

    node_key: NodeKeyResponse
    """NodeKey with string representations and prefix helpers."""

    summary: dict[str, str]
    """Human-readable one-liner per dimension — for quick eyeballing."""


# ── Route ─────────────────────────────────────────────────────────────────────


@router.post(
    "/debug/spot",
    response_model=SpotDebugResponse,
    summary="Classify a CanonicalHand into a SolverSpot abstraction",
    description=(
        "Accepts a **CanonicalHand** JSON body and runs the full deterministic "
        "abstraction pipeline:\n\n"
        "```\n"
        "CanonicalHand → SolverSpot → BoardFeatures → NodeKey\n"
        "```\n\n"
        "**Required top-level fields**\n\n"
        "| Field | Type | Notes |\n"
        "|---|---|---|\n"
        "| `hand_id` | string | Any unique ID |\n"
        "| `site` | string | e.g. `GGPoker`, `PokerStars` |\n"
        "| `game_type` | string | e.g. `NLHE`, `PLO` |\n"
        "| `stakes` | object | Must include `big_blind` and `display` |\n"
        "| `players` | array | At least 2; one must have `is_hero: true` |\n"
        "| `hero_id` | string | Must match a player `id` |\n"
        "| `streets` | array | At least `preflop`; include `flop` for board classification |\n"
        "| `effective_stack_bb` | float | Starting effective stack in BB |\n"
        "| `final_pot_bb` | float | Total pot at hand end |\n\n"
        "**No solver outputs** (EV, frequencies, ranges) are produced — "
        "this is the pure abstraction layer."
    ),
    tags=["debug"],
    # NOTE: Do NOT use openapi_extra for request body examples here.
    # FastAPI deep-merges openapi_extra with the auto-generated spec, which
    # CONCATENATES list fields (players, streets, actions) instead of replacing
    # them — producing duplicated players (4 instead of 2) and streets (4 instead
    # of 2) in the serialised OpenAPI JSON.  Body(openapi_examples=...) is the
    # correct mechanism and does not suffer from this bug.
)
async def debug_spot(
    hand: CanonicalHand = Body(
        ...,
        # openapi_examples provides the named dropdown entries in Swagger UI.
        # The first example is also used as the pre-fill when clicking "Try it out".
        # 20 examples covering all major abstraction categories — imported from
        # app.api.examples.spot_examples to keep this file focused on routing.
        openapi_examples=SPOT_OPENAPI_EXAMPLES,
    ),
) -> SpotDebugResponse:
    """
    POST /api/debug/spot

    Run the full CanonicalHand → SpotAbstraction pipeline and return every
    derived dimension as structured JSON.

    **Validation errors (422)** indicate the request body does not match the
    CanonicalHand schema.  Common causes:
    - Missing required fields: `hand_id`, `site`, `game_type`, `stakes`,
      `players`, `hero_id`, `streets`, `effective_stack_bb`, `final_pot_bb`
    - `hero_id` does not match any player `id`
    - `stakes` missing `big_blind` or `display`
    - Player missing `id`, `name`, `seat`, `position`, or `stack_bb`
    - Action missing `sequence`, `street`, `player_id`, `player_name`, or `action`
    - Card missing `rank`, `suit`, or `notation`
    """
    try:
        abstraction = SpotAbstraction.from_canonical_hand(hand)
    except Exception as exc:
        logger.exception("Solver spot classification failed for hand %s", hand.hand_id)
        raise HTTPException(
            status_code=422,
            detail=f"Spot classification failed: {exc}",
        ) from exc

    spot = abstraction.solver_spot
    key = abstraction.node_key

    # ── NodeKey ──────────────────────────────────────────────────────────────
    node_key_response = NodeKeyResponse(
        string=key.to_string(),
        positional_prefix=key.positional_prefix(),
        street_prefix=key.street_prefix(),
        spot_type=key.spot_type,
        position_matchup=key.position_matchup,
        stack_depth_bucket=key.stack_depth_bucket,
        spr_bucket=key.spr_bucket,
        board_class=key.board_class,
        street=key.street,
        player_count=key.player_count,
    )

    # ── Summary ───────────────────────────────────────────────────────────────
    summary = _build_summary(spot, key)

    return SpotDebugResponse(
        spot=spot,
        board_features=spot.board_texture,
        node_key=node_key_response,
        summary=summary,
    )


# ── Internal helpers ──────────────────────────────────────────────────────────


def _build_summary(spot, key: NodeKey) -> dict[str, str]:
    """One-liner per abstraction dimension — for quick human inspection."""
    ip_label = "IP (acts last postflop)" if spot.is_ip else "OOP (acts first postflop)"
    players = (
        f"heads-up ({spot.hero_position} vs {spot.villain_position})"
        if spot.player_count == 2 and spot.villain_position
        else f"{spot.player_count}-way ({spot.position_matchup.replace('MULTIWAY_', '')})"
    )

    board_desc = "no board (preflop only)"
    if spot.board_texture is not None:
        bt = spot.board_texture
        suit_label = (
            "monotone" if bt.monotone
            else "two-tone" if bt.two_tone
            else "rainbow"
        )
        dyn_label = "dynamic" if bt.dynamic else "static"
        board_desc = (
            f"{key.board_class} — {suit_label}, {bt.connectedness_label}, {dyn_label}"
        )

    spr_label = {
        "0_2": "commit territory (SPR < 2)",
        "2_4": "low SPR (2–4)",
        "4_8": "medium SPR (4–8)",
        "8_PLUS": "deep (SPR 8+)",
    }.get(key.spr_bucket, key.spr_bucket)

    return {
        "pot_type": key.spot_type,
        "position": f"{spot.hero_position} — {ip_label}",
        "matchup": players,
        "stack_depth": f"{spot.effective_stack_bb:.1f} BB effective → {key.stack_depth_bucket} bucket",
        "spr": f"{spot.spr:.2f} → {spr_label}",
        "board": board_desc,
        "street": key.street,
        "node_key": key.to_string(),
    }


# ── Full-analysis endpoint ────────────────────────────────────────────────────


class FullAnalysisResponse(BaseModel):
    """
    Complete solver-backed analysis output for a CanonicalHand.

    Returns all pipeline stages in a single response for end-to-end validation.
    Never crashes — partial data is returned on any internal failure.
    """
    node_key: str
    solver_spot: dict[str, Any]
    retrieval: dict[str, Any]
    strategy_profile: dict[str, Any]
    findings: list[dict[str, Any]]
    latency_ms: float
    error: str | None = None


@router.post(
    "/debug/full-analysis",
    response_model=FullAnalysisResponse,
    summary="Run full solver pipeline on a CanonicalHand (debug only)",
    description=(
        "Runs the complete pipeline:\n\n"
        "```\nCanonicalHand → SpotAbstraction → NodeKey → retrieve_strategy"
        " → StrategyProfile → findings\n```\n\n"
        "**Protected by** `DEBUG_STRATEGY_ENABLED` env var. "
        "Set `X-Debug-Token` header if `DEBUG_ADMIN_TOKEN` is configured.\n\n"
        "Returns partial data on failure — never returns 500."
    ),
    tags=["debug"],
)
async def full_analysis(
    hand: CanonicalHand = Body(..., openapi_examples=SPOT_OPENAPI_EXAMPLES),
    x_debug_token: str | None = Header(default=None),
) -> FullAnalysisResponse:
    """
    POST /api/debug/full-analysis

    End-to-end pipeline inspection endpoint. Returns all intermediate
    outputs for manual validation and regression testing.
    """
    _check_debug_access(x_debug_token)

    t0 = time.perf_counter()
    node_key_str = ""
    solver_spot_dict: dict[str, Any] = {}
    retrieval_dict: dict[str, Any] = {}
    profile_dict: dict[str, Any] = {}
    findings_list: list[dict[str, Any]] = []
    error: str | None = None

    try:
        # Stage 1: SpotAbstraction
        abstraction = SpotAbstraction.from_canonical_hand(hand)
        key = abstraction.node_key
        spot = abstraction.solver_spot
        node_key_str = key.to_string()

        solver_spot_dict = {
            "spot_type":        spot.spot_type,
            "hero_position":    spot.hero_position,
            "villain_position": spot.villain_position,
            "position_matchup": str(spot.position_matchup),
            "is_ip":            spot.is_ip,
            "spr":              round(spot.spr, 3),
            "spr_bucket":       str(spot.spr_bucket),
            "stack_depth_bucket": str(spot.stack_depth_bucket),
            "street":           str(spot.street),
            "player_count":     spot.player_count,
            "board_class":      key.board_class,
        }

        # Stage 2: Strategy retrieval
        from app.strategy_db.retrieval import retrieve_strategy
        retrieval = retrieve_strategy(key, spot)

        strategy_source = retrieval.debug.get("store_source", "unknown")
        retrieval_dict = {
            "retrieval_type":    retrieval.retrieval_type,
            "strategy_source":   strategy_source,
            "solver_engine":     strategy_source if strategy_source in ("texassolver", "gto_plus", "pio", "gto_wizard") else None,
            "similarity_score":  retrieval.similarity_score,
            "cache_hit":         retrieval.cache_hit,
            "matched_node_key":  retrieval.matched_node_key,
            **{k: v for k, v in retrieval.debug.items() if k != "store_source"},
        }

        # Stage 3: Profile
        p = retrieval.profile
        profile_dict = {
            "bet_frequency":      round(p.bet_frequency, 4),
            "check_frequency":    round(p.check_frequency, 4),
            "primary_sizing":     p.primary_sizing,
            "range_advantage":    round(p.range_advantage, 4),
            "nut_advantage":      round(p.nut_advantage, 4),
            "pressure_score":     round(p.pressure_score, 4),
            "volatility_score":   round(p.volatility_score, 4),
            "equity_realization": round(p.equity_realization, 4),
            "rationale":          p.rationale,
            "caveats":            p.caveats,
            "source":             p.source,
        }

        # Stage 4: Findings
        try:
            from app.strategy.recommendations import strategy_findings_for_hand
            from app.engines.pipeline import _canonical_to_parsed_hand
            parsed = _canonical_to_parsed_hand(hand)
            strat_findings = strategy_findings_for_hand(p, parsed, spot)
            findings_list = [
                {
                    "severity": f.severity,
                    "category": f.category,
                    "message":  f.message,
                    "detail":   getattr(f, "detail", None),
                }
                for f in strat_findings
            ]
        except Exception:
            logger.warning("Findings generation failed", exc_info=True)

    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("full-analysis failed for hand %s", hand.hand_id)
        error = str(exc)

    latency_ms = round((time.perf_counter() - t0) * 1000, 2)

    logger.info(
        "[full-analysis] hand=%s node_key=%s retrieval=%s latency=%.1fms",
        hand.hand_id,
        node_key_str or "—",
        retrieval_dict.get("retrieval_type", "—"),
        latency_ms,
    )

    return FullAnalysisResponse(
        node_key=node_key_str,
        solver_spot=solver_spot_dict,
        retrieval=retrieval_dict,
        strategy_profile=profile_dict,
        findings=findings_list,
        latency_ms=latency_ms,
        error=error,
    )


# ── Store stats endpoint ──────────────────────────────────────────────────────


@router.get(
    "/debug/strategy-store/stats",
    summary="Strategy store + retrieval metrics (debug only)",
    tags=["debug"],
)
async def strategy_store_stats(
    x_debug_token: str | None = Header(default=None),
) -> dict[str, Any]:
    """
    GET /api/debug/strategy-store/stats

    Returns store node count, cache stats, and retrieval metrics.
    Protected by DEBUG_STRATEGY_ENABLED.
    """
    _check_debug_access(x_debug_token)
    from app.strategy_db.retrieval import store_stats
    return store_stats()


# ── Compare endpoint ─────────────────────────────────────────────────────────


class CompareRequest(BaseModel):
    """Two CanonicalHands to compare side-by-side."""
    hand_a: CanonicalHand
    hand_b: CanonicalHand


@router.post(
    "/debug/compare",
    summary="Compare strategy profiles for two hands (debug only)",
    tags=["debug"],
)
async def compare_strategies(
    request: CompareRequest = Body(...),
    x_debug_token: str | None = Header(default=None),
) -> dict[str, Any]:
    """
    POST /api/debug/compare

    Runs the full pipeline on two hands and returns both results
    side-by-side for comparison. Useful for validating that board
    texture / position changes produce expected strategy shifts.

    Protected by DEBUG_STRATEGY_ENABLED.
    """
    _check_debug_access(x_debug_token)

    results: dict[str, Any] = {}

    for label, hand in [("a", request.hand_a), ("b", request.hand_b)]:
        entry: dict[str, Any] = {
            "node_key": "",
            "solver_spot": {},
            "retrieval": {},
            "strategy_profile": {},
            "error": None,
        }
        try:
            abstraction = SpotAbstraction.from_canonical_hand(hand)
            key = abstraction.node_key
            spot = abstraction.solver_spot
            entry["node_key"] = key.to_string()

            entry["solver_spot"] = {
                "spot_type":         spot.spot_type,
                "position_matchup":  str(spot.position_matchup),
                "is_ip":             spot.is_ip,
                "spr_bucket":        str(spot.spr_bucket),
                "board_class":       key.board_class,
                "street":            str(spot.street),
            }

            from app.strategy_db.retrieval import retrieve_strategy
            retrieval = retrieve_strategy(key, spot)
            strategy_source = retrieval.debug.get("store_source", "unknown")
            entry["retrieval"] = {
                "retrieval_type":  retrieval.retrieval_type,
                "strategy_source": strategy_source,
                "solver_engine":   strategy_source if strategy_source in ("texassolver", "gto_plus", "pio", "gto_wizard") else None,
                "similarity_score": retrieval.similarity_score,
                "cache_hit":       retrieval.cache_hit,
                "matched_node_key": retrieval.matched_node_key,
            }

            p = retrieval.profile
            entry["strategy_profile"] = {
                "bet_frequency":      round(p.bet_frequency, 4),
                "check_frequency":    round(p.check_frequency, 4),
                "primary_sizing":     p.primary_sizing,
                "range_advantage":    round(p.range_advantage, 4),
                "nut_advantage":      round(p.nut_advantage, 4),
                "pressure_score":     round(p.pressure_score, 4),
                "volatility_score":   round(p.volatility_score, 4),
                "equity_realization": round(p.equity_realization, 4),
                "rationale":          p.rationale,
                "source":             p.source,
            }
        except Exception as exc:
            logger.warning("compare: hand_%s failed: %s", label, exc, exc_info=True)
            entry["error"] = str(exc)

        results[label] = entry

    # Compute deltas between the two profiles
    deltas: dict[str, float] = {}
    pa = results.get("a", {}).get("strategy_profile", {})
    pb = results.get("b", {}).get("strategy_profile", {})
    for signal in ("bet_frequency", "range_advantage", "nut_advantage",
                    "pressure_score", "volatility_score", "equity_realization"):
        va = pa.get(signal)
        vb = pb.get(signal)
        if isinstance(va, (int, float)) and isinstance(vb, (int, float)):
            deltas[signal] = round(vb - va, 4)

    return {
        "a": results.get("a"),
        "b": results.get("b"),
        "deltas": deltas,
    }


# ── Full pipeline trace endpoint ─────────────────────────────────────────────


@router.post(
    "/debug/full-trace",
    summary="Full forensic pipeline trace for a raw hand history (debug only)",
    tags=["debug"],
)
async def full_trace(
    hand_text: str = Body(..., media_type="text/plain"),
    x_debug_token: str | None = Header(default=None),
) -> dict[str, Any]:
    """
    POST /api/debug/full-trace

    Runs the complete pipeline on raw hand text and returns EVERY
    intermediate state for forensic debugging:

    1. Raw parsed actions
    2. Canonical actions (with auto-corrections noted)
    3. Per-action betting state (pot, facing_bet, legality)
    4. Heuristic findings
    5. Per-action scoring (quality, strategic_options, deviation)
    6. Solver abstraction + retrieval
    7. Overall score + verdict

    Protected by DEBUG_STRATEGY_ENABLED.
    """
    _check_debug_access(x_debug_token)

    trace: dict[str, Any] = {}

    try:
        # Stage 1: Parse
        from app.parsers.detector import detect_and_parse
        parsed = detect_and_parse(hand_text)
        trace["1_parsed"] = {
            "site": parsed.site,
            "hero": parsed.hero_name,
            "hero_position": parsed.hero_position,
            "hero_cards": parsed.hero_cards,
            "players": [
                {"name": p.name, "position": p.position, "stack_bb": p.stack_bb}
                for p in parsed.players
            ],
            "actions": [
                {
                    "index": i,
                    "street": a.street,
                    "player": a.player,
                    "action": a.action,
                    "size_bb": a.size_bb,
                    "is_hero": a.is_hero,
                }
                for i, a in enumerate(parsed.actions)
            ],
            "board": {
                "flop": parsed.board.flop,
                "turn": parsed.board.turn,
                "river": parsed.board.river,
            },
        }

        # Stage 2: Normalize
        from app.engines.normalizer import normalize_hand
        canonical = normalize_hand(parsed, raw_text=hand_text)

        corrections: list[dict] = []
        # Detect corrections by comparing parsed actions vs canonical
        parsed_idx = 0
        for s in canonical.streets:
            for a in s.actions:
                if parsed_idx < len(parsed.actions):
                    pa = parsed.actions[parsed_idx]
                    if pa.action != a.action.value:
                        corrections.append({
                            "sequence": a.sequence,
                            "street": s.name.value,
                            "player": a.player_name,
                            "original_action": pa.action,
                            "corrected_action": a.action.value,
                            "reason": "fold_facing_no_bet" if pa.action == "fold" else "unknown",
                        })
                parsed_idx += 1

        trace["2_canonical"] = {
            "players": [
                {"id": p.id, "name": p.name, "position": p.position, "is_hero": p.is_hero}
                for p in canonical.players
            ],
            "hero_id": canonical.hero_id,
            "corrections": corrections,
            "streets": [
                {
                    "name": s.name.value,
                    "board": [c.notation for c in s.board_cards],
                    "pot_start": s.pot_start_bb,
                    "actions": [
                        {
                            "seq": a.sequence,
                            "player": a.player_name,
                            "action": a.action.value,
                            "amount_bb": round(a.amount_bb, 2),
                            "pot_before": round(a.pot_before_bb, 2),
                            "pot_after": round(a.pot_after_bb, 2),
                            "stack_before": round(a.stack_before_bb, 2),
                            "stack_after": round(a.stack_after_bb, 2),
                        }
                        for a in s.actions
                    ],
                }
                for s in canonical.streets
            ],
        }

        # Stage 3: Validate
        from app.engines.canonical_validator import validate_canonical
        validation = validate_canonical(canonical)
        trace["3_validation"] = {
            "valid": validation.valid,
            "can_analyze": validation.can_analyze,
            "confidence": validation.confidence,
            "errors": [{"code": e.code, "message": e.message} for e in validation.errors],
            "warnings": [{"code": w.code, "message": w.message} for w in validation.warnings],
        }

        # Stage 4: Per-action betting state
        from app.engines.scoring import _is_facing_bet
        betting_state: list[dict] = []
        for a in parsed.actions:
            facing = _is_facing_bet(parsed, a)
            legal = ["check", "bet", "raise", "fold", "call"]
            if a.street != "preflop" and not facing:
                legal = ["check", "bet"]  # cannot fold/call if no bet
            is_illegal = a.action == "fold" and not facing and a.street != "preflop"

            betting_state.append({
                "index": parsed.actions.index(a),
                "street": a.street,
                "player": a.player,
                "action": a.action,
                "facing_bet": facing,
                "legal_actions": legal,
                "is_illegal": is_illegal,
            })
        trace["4_betting_state"] = betting_state

        # Stage 5: Heuristics + Scoring
        from app.engines.spot_classifier import classify_spot
        from app.engines.board_texture import classify_board
        from app.engines.heuristics import run_heuristics
        from app.engines.scoring import score_all_hero_actions, _compute_deviation

        spot = classify_spot(parsed)
        texture = classify_board(parsed.board.flop, parsed.board.turn, parsed.board.river)

        try:
            from app.engines.draw_evaluator import analyze_draws
            from app.engines.poker_state import PokerState
            draw_analysis = analyze_draws(parsed.hero_cards, parsed.board.flop)
            poker_state = PokerState.build(parsed, spot.hero_is_ip, spot.hero_is_pfr)
        except Exception:
            draw_analysis = None
            poker_state = None

        findings = run_heuristics(parsed, spot, texture, draw_analysis=draw_analysis, poker_state=poker_state)
        trace["5_findings"] = [
            {
                "severity": f.severity,
                "street": f.street,
                "action_taken": f.action_taken,
                "recommendation": f.recommendation[:200],
            }
            for f in findings
        ]

        coaching = score_all_hero_actions(parsed, findings, spot, texture)
        trace["6_scoring"] = {}
        for idx, c in sorted(coaching.items()):
            action = parsed.actions[idx]
            dev = _compute_deviation(action, c.strategic_options)
            trace["6_scoring"][str(idx)] = {
                "street": action.street,
                "action": action.action,
                "score": c.score,
                "quality": c.quality,
                "mistake_level": c.mistake_level,
                "facing_bet": _is_facing_bet(parsed, action),
                "deviation": {
                    "is_deviation": dev.is_deviation,
                    "penalty": dev.penalty,
                },
                "primary_recommendation": (
                    c.strategic_options[0].action if c.strategic_options else None
                ),
                "strategic_options": [
                    {"priority": o.priority, "action": o.action, "confidence": o.confidence}
                    for o in c.strategic_options
                ],
            }

        # Stage 7: Solver context
        try:
            abstraction = SpotAbstraction.from_canonical_hand(canonical)
            from app.strategy_db.retrieval import retrieve_strategy as _retrieve
            retrieval = _retrieve(abstraction.node_key, abstraction.solver_spot)
            trace["7_solver"] = {
                "node_key": abstraction.node_key.to_string(),
                "retrieval_type": retrieval.retrieval_type,
                "strategy_source": retrieval.debug.get("store_source", "unknown"),
                "similarity_score": retrieval.similarity_score,
            }
        except Exception as exc:
            trace["7_solver"] = {"error": str(exc)}

        # Stage 8: Overall verdict
        from app.engines.analysis import _calculate_score
        overall_score = _calculate_score(findings)
        trace["8_verdict"] = {
            "overall_score": overall_score,
            "title": (
                "Excellent play" if overall_score >= 85 else
                "Solid play" if overall_score >= 70 else
                "Room for improvement" if overall_score >= 55 else
                "Significant errors detected" if overall_score >= 40 else
                "Major strategic errors"
            ),
            "findings_count": len(findings),
            "mistakes_count": sum(1 for f in findings if f.severity == "mistake"),
        }

    except Exception as exc:
        logger.exception("full-trace failed")
        trace["error"] = str(exc)

    return trace
