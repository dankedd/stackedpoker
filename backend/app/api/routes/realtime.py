"""
FastAPI endpoints for the realtime intelligence layer.

Includes both HTTP REST endpoints and a WebSocket endpoint.

HTTP Routes:
  POST /api/rt/session/start          — start a live coaching session
  POST /api/rt/session/{id}/action    — process a single action
  POST /api/rt/session/{id}/end-hand  — end current hand
  POST /api/rt/session/{id}/end       — end session, get recap
  GET  /api/rt/session/{id}/stats     — session statistics

  POST /api/rt/simulate               — create interactive simulation
  POST /api/rt/simulate/{id}/explore  — explore a branch
  POST /api/rt/simulate/{id}/board    — change board (what-if)

  GET  /api/rt/compliance/check       — check compliance status
  POST /api/rt/compliance/mode        — set compliance mode

WebSocket:
  WS /api/rt/ws?user_id={uid}        — realtime event stream
"""

from __future__ import annotations

import asyncio
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException, Query
from pydantic import BaseModel, Field

from app.realtime.engine import AnalysisMode
from app.realtime.session import LiveSessionCopilot
from app.realtime.simulation import SimulationEngine, SimulationState
from app.realtime.compliance import ComplianceMode, get_compliance_gate
from app.realtime.ws import get_ws_manager
from app.realtime.events import get_event_bus, EventBus

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/rt", tags=["realtime"])

# ── State stores ──────────────────────────────────────────────────────────

_sessions: dict[str, LiveSessionCopilot] = {}
_simulations: dict[str, SimulationState] = {}
_sim_engine = SimulationEngine()


# ── Request Models ────────────────────────────────────────────────────────

class StartSessionRequest(BaseModel):
    user_id: str
    session_id: str = ""
    mode: str = "training"      # training, observation, post_session


class ProcessActionRequest(BaseModel):
    street: str
    player: str = "hero"
    action: str                 # bet, check, fold, call, raise
    size_bb: float = 0
    board: list[str] = Field(default_factory=list)
    is_hero: bool = False


class StartHandRequest(BaseModel):
    hand_id: str = ""
    hero_position: str = "BTN"
    villain_position: str = "BB"
    hero_stack_bb: float = 100
    villain_stack_bb: float = 100
    hero_is_ip: bool = True
    hero_is_pfr: bool = True
    spot_type: str = "SRP"


class CreateSimRequest(BaseModel):
    board: list[str] = Field(min_length=3, max_length=5)
    pot_bb: float = 6.5
    hero_stack_bb: float = 96.75
    hero_position: str = "BTN"
    villain_position: str = "BB"
    spot_type: str = "SRP"
    hero_is_ip: bool = True


class ExploreRequest(BaseModel):
    node_id: str


class WhatIfBoardRequest(BaseModel):
    new_board: list[str] = Field(min_length=3, max_length=5)


class SetModeRequest(BaseModel):
    mode: str           # training, observation, post_session, locked


# ── Session Routes ────────────────────────────────────────────────────────

@router.post("/session/start")
async def start_session(req: StartSessionRequest) -> dict:
    """Start a new live coaching session."""
    gate = get_compliance_gate()
    mode_map = {
        "training": AnalysisMode.INSTANT,
        "observation": AnalysisMode.DELAYED,
        "post_session": AnalysisMode.POST_SESSION,
    }
    analysis_mode = mode_map.get(req.mode, AnalysisMode.INSTANT)

    # Compliance check
    compliance_mode_map = {
        "training": ComplianceMode.TRAINING,
        "observation": ComplianceMode.OBSERVATION,
        "post_session": ComplianceMode.POST_SESSION,
    }
    gate.update_mode(compliance_mode_map.get(req.mode, ComplianceMode.TRAINING))

    check = gate.check_realtime_allowed()
    if not check.allowed:
        raise HTTPException(403, check.reason)

    session_id = req.session_id or f"rt-{req.user_id}-{len(_sessions)}"
    copilot = LiveSessionCopilot(
        user_id=req.user_id,
        mode=analysis_mode,
        session_id=session_id,
    )
    copilot.start_session()
    _sessions[session_id] = copilot

    return {"session_id": session_id, "mode": req.mode, "delay_seconds": check.delay_seconds}


@router.post("/session/{session_id}/start-hand")
async def start_hand(session_id: str, req: StartHandRequest) -> dict:
    copilot = _sessions.get(session_id)
    if not copilot:
        raise HTTPException(404, "Session not found")

    copilot.start_hand(
        hand_id=req.hand_id,
        hero_position=req.hero_position,
        villain_position=req.villain_position,
        hero_stack_bb=req.hero_stack_bb,
        villain_stack_bb=req.villain_stack_bb,
        hero_is_ip=req.hero_is_ip,
        hero_is_pfr=req.hero_is_pfr,
        spot_type=req.spot_type,
    )
    return {"hand_started": True, "hand_id": req.hand_id}


@router.post("/session/{session_id}/action")
async def process_action(session_id: str, req: ProcessActionRequest) -> dict:
    """Process a single action in the live session."""
    copilot = _sessions.get(session_id)
    if not copilot:
        raise HTTPException(404, "Session not found")

    result = copilot.process_action(
        street=req.street,
        player=req.player,
        action=req.action,
        size_bb=req.size_bb,
        board=req.board,
        is_hero=req.is_hero,
    )

    response: dict = {
        "action_index": result.action_index,
        "processing_ms": round(result.processing_ms, 1),
    }

    # Include coaching if available
    if result.coaching_event:
        # Enforce compliance delay
        gate = get_compliance_gate()
        check = gate.check_realtime_allowed()
        delay = gate.enforce_delay(check)

        if delay > 0:
            await asyncio.sleep(min(delay, 5.0))  # Cap at 5s for API response

        response["coaching"] = result.coaching_event

        # Broadcast via event bus
        try:
            bus = await get_event_bus()
            channel = EventBus.session_channel(session_id)
            await bus.publish(channel, "coaching", result.coaching_event)
        except Exception:
            pass  # Non-critical

    return response


@router.post("/session/{session_id}/end-hand")
async def end_hand(session_id: str) -> dict:
    copilot = _sessions.get(session_id)
    if not copilot:
        raise HTTPException(404, "Session not found")
    return copilot.end_hand()


@router.post("/session/{session_id}/end")
async def end_session(session_id: str) -> dict:
    """End session and get full recap."""
    copilot = _sessions.pop(session_id, None)
    if not copilot:
        raise HTTPException(404, "Session not found")
    return copilot.end_session()


@router.get("/session/{session_id}/stats")
async def session_stats(session_id: str) -> dict:
    copilot = _sessions.get(session_id)
    if not copilot:
        raise HTTPException(404, "Session not found")
    stats = copilot.stats
    return {
        "hands_played": stats.hands_played,
        "total_mistakes": stats.total_mistakes,
        "total_ev_loss_bb": round(stats.total_ev_loss_bb, 2),
        "vpip_pct": round(stats.vpip_pct, 1),
        "top_leaks": [{"concept": t, "count": c} for t, c in stats.top_leaks],
    }


# ── Simulation Routes ─────────────────────────────────────────────────────

@router.post("/simulate")
async def create_simulation(req: CreateSimRequest) -> dict:
    sim = _sim_engine.create_simulation(
        board=req.board,
        pot_bb=req.pot_bb,
        hero_stack_bb=req.hero_stack_bb,
        hero_position=req.hero_position,
        villain_position=req.villain_position,
        spot_type=req.spot_type,
        hero_is_ip=req.hero_is_ip,
    )
    _simulations[sim.sim_id] = sim

    return {
        "sim_id": sim.sim_id,
        "board": sim.board,
        "street": sim.street,
        "root": _serialize_node(sim.root) if sim.root else None,
    }


@router.post("/simulate/{sim_id}/explore")
async def explore_simulation(sim_id: str, req: ExploreRequest) -> dict:
    sim = _simulations.get(sim_id)
    if not sim:
        raise HTTPException(404, "Simulation not found")

    node = _sim_engine.explore_action(sim, req.node_id)
    if not node:
        raise HTTPException(404, "Node not found")

    return {"node": _serialize_node(node)}


@router.post("/simulate/{sim_id}/board")
async def what_if_board(sim_id: str, req: WhatIfBoardRequest) -> dict:
    sim = _simulations.get(sim_id)
    if not sim:
        raise HTTPException(404, "Simulation not found")

    new_sim = _sim_engine.what_if_board(sim, req.new_board)
    _simulations[new_sim.sim_id] = new_sim

    return {
        "sim_id": new_sim.sim_id,
        "board": new_sim.board,
        "root": _serialize_node(new_sim.root) if new_sim.root else None,
    }


# ── Compliance Routes ─────────────────────────────────────────────────────

@router.get("/compliance/check")
async def check_compliance(site: str = "", is_live: bool = False) -> dict:
    gate = get_compliance_gate()
    check = gate.check_realtime_allowed(site=site, is_live_play=is_live)
    return {
        "allowed": check.allowed,
        "reason": check.reason,
        "delay_seconds": check.delay_seconds,
        "mode": check.mode.value,
    }


@router.post("/compliance/mode")
async def set_compliance_mode(req: SetModeRequest) -> dict:
    gate = get_compliance_gate()
    try:
        mode = ComplianceMode(req.mode)
    except ValueError:
        raise HTTPException(400, f"Invalid mode: {req.mode}")
    gate.update_mode(mode)
    return {"mode": mode.value}


# ── WebSocket Route ───────────────────────────────────────────────────────

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, user_id: str = Query("")):
    """
    WebSocket connection for realtime event streaming.

    Client connects with ?user_id=xxx, then sends JSON messages:
      {"action": "subscribe", "channel": "rt:session:abc"}
      {"action": "ping"}
      {"action": "message", "channel": "...", "payload": {...}}
    """
    if not user_id:
        await websocket.close(code=4001, reason="user_id required")
        return

    manager = get_ws_manager()
    conn = await manager.connect(websocket, user_id)

    try:
        while True:
            raw = await websocket.receive_text()
            await manager.handle_message(conn, raw)
    except WebSocketDisconnect:
        await manager.disconnect(user_id)
    except Exception as exc:
        logger.error("[WS] error for %s: %s", user_id, exc)
        await manager.disconnect(user_id)


# ── Helpers ───────────────────────────────────────────────────────────────

def _serialize_node(node) -> dict:
    """Serialize a SimulationNode for JSON response."""
    if node is None:
        return {}
    return {
        "node_id": node.node_id,
        "action": node.action,
        "street": node.street,
        "is_hero": node.is_hero,
        "solver_frequency": node.solver_frequency,
        "ev_estimate": node.ev_estimate,
        "pot_bb": node.pot_bb,
        "explanation": node.explanation,
        "children": [_serialize_node(c) for c in node.children],
    }
