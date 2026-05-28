"""
FastAPI routes for solver tree navigation — lazy-loading, node-by-node.

Endpoints:
  GET /api/solver/jobs/{job_id}/tree          — tree metadata (root, total nodes, streets)
  GET /api/solver/jobs/{job_id}/node/{node_id} — single node with strategy data
  GET /api/solver/jobs/{job_id}/node/{node_id}/children — child nodes (one level)

All responses are sized for lazy loading — no endpoint returns the full tree.
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

import redis.asyncio as aioredis

from app.solver_tree.models import SolverNode, decode_action
from app.solver_tree.store import SolveTreeStore
from app.solver_worker.settings import WorkerSettings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/solver", tags=["solver-tree"])

# ── Dependency wiring ────────────────────────────────────────────────────

_store: SolveTreeStore | None = None
_redis: aioredis.Redis | None = None
_redis_available = True


async def _get_store() -> SolveTreeStore | None:
    """Lazy-init tree store backed by Redis."""
    global _store, _redis, _redis_available
    if not _redis_available:
        return None
    if _store is None:
        try:
            settings = WorkerSettings.from_env()
            _redis = aioredis.from_url(
                settings.redis_url, decode_responses=True, max_connections=10,
            )
            await _redis.ping()
            _store = SolveTreeStore(redis=_redis)
        except Exception as exc:
            _redis_available = False
            logger.warning("[SolverTree] Redis unavailable: %s", exc)
            return None
    return _store


async def _require_store() -> SolveTreeStore:
    """FastAPI dependency: get store or 503."""
    store = await _get_store()
    if store is None:
        raise HTTPException(503, "Redis unavailable — solver tree API offline")
    return store


# ── Response schemas ─────────────────────────────────────────────────────

class TreeResponse(BaseModel):
    """Tree-level metadata — returned by the /tree endpoint."""
    root_node_id: str
    total_nodes: int
    streets: list[str]
    created_at: str


class ActionDetail(BaseModel):
    """A single available action with its decoded human-readable label."""
    token: str       # compact: "x", "b96", "r192"
    label: str       # human: "check", "bet 96", "raise 192"
    frequency: float | None = None  # aggregate frequency across all combos


class NodeResponse(BaseModel):
    """Single node — the primary lazy-loading payload."""
    id: str
    parent_id: str | None
    children_ids: list[str]

    street: str
    board: list[str]

    action_history: list[str]
    action_path: str
    depth: int

    actor: str | None          # "ip" | "oop" | None (terminal/chance)

    available_actions: list[ActionDetail]

    strategy: dict[str, list[float]] = Field(default_factory=dict)
    evs: dict[str, float] = Field(default_factory=dict)   # aggregate freqs

    metadata: dict[str, Any] = Field(default_factory=dict)


class ChildrenResponse(BaseModel):
    """Batch of child nodes for a parent."""
    parent_id: str
    children: list[NodeResponse]


# ── Helpers ──────────────────────────────────────────────────────────────

def _node_to_response(node: SolverNode) -> NodeResponse:
    """Convert internal SolverNode to API response."""
    actions = []
    for token in node.available_actions:
        actions.append(ActionDetail(
            token=token,
            label=decode_action(token),
            frequency=node.aggregate_freqs.get(token),
        ))

    return NodeResponse(
        id=node.id,
        parent_id=node.parent_id,
        children_ids=node.children_ids,
        street=node.street,
        board=node.board,
        action_history=[decode_action(t) for t in node.action_history],
        action_path=node.action_path,
        depth=node.depth,
        actor=node.actor,
        available_actions=actions,
        strategy=node.strategy,
        evs=node.aggregate_freqs,
        metadata={
            "human_path": node.human_path,
            "pot_size": node.pot_size,
            "combo_count": node.combo_count,
            "node_type": node.node_type,
            "is_terminal": node.is_terminal,
            "solve_id": node.solve_id,
        },
    )


# ── Routes ───────────────────────────────────────────────────────────────

@router.get("/jobs/{job_id}/tree", response_model=TreeResponse)
async def get_tree(job_id: str):
    """
    Get tree metadata for a completed solve.

    Returns root node ID, total node count, streets covered, and creation
    timestamp. Use root_node_id to fetch the first node.
    """
    store = await _require_store()
    meta = await store.get_meta(job_id)
    if meta is None:
        raise HTTPException(
            404,
            f"No solver tree found for job {job_id}. "
            "The job may not be completed, or the tree may have expired.",
        )

    return TreeResponse(
        root_node_id=meta.get("root_id", meta.get("root_node_id", "")),
        total_nodes=meta.get("node_count", meta.get("total_nodes", 0)),
        streets=meta.get("streets", []),
        created_at=meta.get("created_at", ""),
    )


@router.get("/jobs/{job_id}/node/{node_id}", response_model=NodeResponse)
async def get_node(job_id: str, node_id: str):
    """
    Fetch a single solver tree node.

    Returns full strategy data, available actions with frequencies, and
    child IDs for on-demand traversal.
    """
    store = await _require_store()

    # Verify tree exists
    if not await store.tree_exists(job_id):
        raise HTTPException(404, f"No solver tree found for job {job_id}")

    node = await store.get_node(job_id, node_id)
    if node is None:
        raise HTTPException(404, f"Node {node_id} not found in tree {job_id}")

    return _node_to_response(node)


@router.get(
    "/jobs/{job_id}/node/{node_id}/children",
    response_model=ChildrenResponse,
)
async def get_children(job_id: str, node_id: str):
    """
    Fetch all direct children of a node in a single call.

    Returns child nodes fully hydrated so the frontend can render the
    next action level without additional round trips.
    """
    store = await _require_store()

    if not await store.tree_exists(job_id):
        raise HTTPException(404, f"No solver tree found for job {job_id}")

    # Verify parent exists before fetching children
    parent = await store.get_node(job_id, node_id)
    if parent is None:
        raise HTTPException(404, f"Node {node_id} not found in tree {job_id}")

    children = await store.get_children(job_id, node_id)

    return ChildrenResponse(
        parent_id=node_id,
        children=[_node_to_response(c) for c in children],
    )
