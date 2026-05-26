"""
Live solver service — on-demand TexasSolver execution for real-time analysis.

Provides:
  solve_river_node(hand, spot) → SolverResult
  get_solve_status(solve_id) → SolverStatus

Design:
  - Extracts game state from CanonicalHand into a minimal SolverConfig
  - River-only MVP: fold/call/jam frequencies + EVs
  - Async execution with timeout and cancellation
  - In-memory cache keyed by board + stacks + pot + positions
  - Graceful fallback: returns None on timeout/error (heuristics remain)
  - Never blocks the analysis pipeline
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import tempfile
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

from app.models.canonical import CanonicalHand, CanonicalAction, Street
from app.solver.models import SolverSpot
from app.texassolver.config import SolverConfig
from app.texassolver.runner import run_texassolver, SolveResult
from app.texassolver.parser import parse_texassolver_output

_log = logging.getLogger(__name__)

# ── Solver result model ──────────────────────────────────────────────────────

@dataclass
class ActionFrequency:
    """A single action with its solver-computed frequency and EV."""
    action: str          # "fold", "call", "raise", "bet_75pct", etc.
    frequency: float     # 0.0–1.0
    ev: float | None = None  # expected value in bb (None if not computed)


@dataclass
class SolverResult:
    """Output of a live TexasSolver solve for a single decision node."""

    status: str  # "ready", "solving", "timeout", "error", "cached"

    # Solver output (populated when status == "ready" or "cached")
    frequencies: dict[str, float] = field(default_factory=dict)  # action → freq
    ev: dict[str, float] = field(default_factory=dict)           # action → EV
    preferred_action: str = ""
    hero_action_ev_loss: float = 0.0

    # Metadata
    source: str = "texassolver"
    iterations: int = 0
    exploitability: float = 0.0  # % of pot
    solve_time_ms: float = 0.0
    cache_hit: bool = False
    node_key: str = ""
    error: str | None = None
    fallback_reason: str | None = None  # populated when synthetic/failed

    # Solved node context
    node_description: str = ""  # e.g. "BTN vs BB | River | Pot 30.5bb | Facing 91bb"

    @property
    def mode(self) -> str:
        """Solver mode: live, cached, synthetic, or failed."""
        if self.cache_hit and self.status == "ready":
            return "cached"
        if "synthetic" in self.source:
            return "synthetic"
        if self.status in ("timeout", "error"):
            return "failed"
        if self.status == "ready":
            return "live"
        return "failed"

    def to_dict(self) -> dict:
        return {
            "status": self.status,
            "mode": self.mode,
            "source": self.source,
            "frequencies": self.frequencies,
            "ev": self.ev,
            "preferred_action": self.preferred_action,
            "hero_action_ev_loss": round(self.hero_action_ev_loss, 3),
            "iterations": self.iterations,
            "exploitability": round(self.exploitability, 4),
            "solve_time_ms": round(self.solve_time_ms, 1),
            "cache_hit": self.cache_hit,
            "node_key": self.node_key,
            "node_description": self.node_description,
            "error": self.error,
            "fallback_reason": self.fallback_reason,
        }


# ── Node extraction ──────────────────────────────────────────────────────────

def _extract_river_node(
    hand: CanonicalHand,
    spot: SolverSpot,
) -> SolverConfig | None:
    """
    Extract a river decision node from a CanonicalHand into a SolverConfig.

    Returns None if the hand doesn't have a river street or isn't heads-up.
    """
    # Must be heads-up
    if len(hand.players) != 2:
        return None

    # Must have a river
    river_street = next(
        (s for s in hand.streets if s.name == Street.RIVER), None
    )
    if river_street is None or len(river_street.board_cards) == 0:
        return None

    # Build full board
    board_cards: list[str] = []
    for s in hand.streets:
        for c in s.board_cards:
            board_cards.append(c.notation)

    if len(board_cards) != 5:
        return None  # need exactly 5 cards for river solve

    # Compute pot and stacks from the last action before river
    # (or the start of the river street)
    pot_bb = river_street.pot_start_bb
    if pot_bb <= 0:
        # Fallback: use last action's pot_after from turn
        for s in reversed(hand.streets):
            if s.name.value in ("turn", "flop", "preflop") and s.actions:
                pot_bb = s.actions[-1].pot_after_bb
                break

    # Effective stack at river start
    hero = next((p for p in hand.players if p.id == hand.hero_id), None)
    villain = next((p for p in hand.players if p.id != hand.hero_id), None)
    if not hero or not villain:
        return None

    # Get stacks at river start from the last pre-river action
    hero_stack = hero.stack_bb
    villain_stack = villain.stack_bb
    for s in hand.streets:
        if s.name == Street.RIVER:
            break
        for a in s.actions:
            if a.player_name == hero.name:
                hero_stack = a.stack_after_bb
            elif a.player_name == villain.name:
                villain_stack = a.stack_after_bb

    eff_stack = min(hero_stack, villain_stack)
    if eff_stack <= 0:
        return None

    # Positions
    ip_pos = spot.hero_position if spot.is_ip else (villain.position or "BB")
    oop_pos = (villain.position or "BB") if spot.is_ip else spot.hero_position
    positions = f"{ip_pos}_vs_{oop_pos}"

    # River-only bet sizes: check, 75% pot, jam
    # Keep tree small for performance
    river_bet_sizes = [0.75]
    river_raise_sizes = [1.0]  # pot-sized raise

    return SolverConfig(
        spot_type=str(spot.spot_type) if hasattr(spot.spot_type, 'value') else spot.spot_type,
        positions=positions,
        stack_depth=int(round(eff_stack + pot_bb / 2)),  # approximate starting stack
        board=board_cards,
        bet_sizes=river_bet_sizes,
        raise_sizes=river_raise_sizes,
        rake=None,
        iterations=200,        # fast solve for live use
        accuracy_target=1.0,   # 1% exploitability target
        solver_path=None,      # auto-detect
    )


def _river_node_cache_key(config: SolverConfig) -> str:
    """Deterministic cache key for a river solve config."""
    key_parts = [
        config.board_string(),
        config.positions,
        f"pot_{config.pot_size_bb():.0f}",
        f"stack_{config.effective_stack_chips():.0f}",
        f"sizes_{'_'.join(str(s) for s in config.bet_sizes)}",
    ]
    raw = "|".join(key_parts)
    return hashlib.md5(raw.encode()).hexdigest()[:16]


# ── Solver cache ─────────────────────────────────────────────────────────────

_cache: dict[str, SolverResult] = {}
_MAX_CACHE_SIZE = 256


def _cache_get(key: str) -> SolverResult | None:
    result = _cache.get(key)
    if result:
        result.cache_hit = True
    return result


def _cache_put(key: str, result: SolverResult) -> None:
    if len(_cache) >= _MAX_CACHE_SIZE:
        # Evict oldest entry (FIFO — simple for MVP)
        oldest_key = next(iter(_cache))
        del _cache[oldest_key]
    _cache[key] = result


# ── Solve execution ──────────────────────────────────────────────────────────

_LIVE_SOLVE_TIMEOUT = 15  # seconds — aggressive for UX


def _parse_solver_result(
    solve_result: SolveResult,
    config: SolverConfig,
    is_ip: bool,
    hero_action: str | None = None,
) -> SolverResult:
    """Parse a completed TexasSolver result into a SolverResult."""
    if not solve_result.success or not solve_result.output_path:
        return SolverResult(
            status="error",
            error=solve_result.error or "Solve failed",
        )

    try:
        nodes = parse_texassolver_output(solve_result.output_path, config)
    except Exception as exc:
        return SolverResult(status="error", error=f"Parse failed: {exc}")

    # Find the node matching hero's position
    hero_position = config.ip_position() if is_ip else config.oop_position()
    hero_node = next(
        (n for n in nodes if n.position == hero_position), None
    )
    if not hero_node:
        # Try the other node
        hero_node = nodes[0] if nodes else None

    if not hero_node or not hero_node.actions:
        return SolverResult(status="error", error="No actions in solver output")

    # Extract frequencies
    frequencies: dict[str, float] = {}
    for a in hero_node.actions:
        name = a.action_name
        # Normalize to simple verbs
        if name.startswith("bet_") or name.startswith("raise_"):
            simple = "raise"
        elif name == "check":
            simple = "check"
        elif name == "call":
            simple = "call"
        elif name == "fold":
            simple = "fold"
        elif name == "bet_allin":
            simple = "raise"
        else:
            simple = name
        frequencies[simple] = frequencies.get(simple, 0.0) + a.frequency

    # Find preferred action (highest frequency)
    preferred = max(frequencies, key=frequencies.get) if frequencies else ""

    # Compute EV loss for hero's actual action
    ev_loss = 0.0
    if hero_action and hero_action in frequencies and preferred != hero_action:
        # Simple EV loss proxy: frequency difference * pot
        ev_loss = -(frequencies.get(preferred, 0) - frequencies.get(hero_action, 0)) * config.pot_size_bb()

    return SolverResult(
        status="ready",
        frequencies=frequencies,
        ev={},  # EVs require deeper parsing — frequencies-only MVP
        preferred_action=preferred,
        hero_action_ev_loss=ev_loss,
        source="texassolver",
        iterations=config.iterations,
        exploitability=config.accuracy_target,
    )


def _build_node_description(
    hand: CanonicalHand,
    spot: SolverSpot,
    config: SolverConfig | None = None,
) -> str:
    """Build a human-readable description of the solved node."""
    hero = next((p for p in hand.players if p.id == hand.hero_id), None)
    villain = next((p for p in hand.players if p.id != hand.hero_id), None)
    hero_pos = hero.position if hero else "?"
    villain_pos = villain.position if villain else "?"
    pot = config.pot_size_bb() if config else 0.0

    # Check if facing a bet on river
    facing_amt = ""
    for s in hand.streets:
        if s.name == Street.RIVER:
            for a in s.actions:
                if a.player_id != hand.hero_id and a.action.value in ("bet", "raise"):
                    facing_amt = f" | Facing {a.amount_bb:.0f}bb"
                    break

    board_str = " ".join(
        c.notation for s in hand.streets for c in s.board_cards
    )
    return f"{hero_pos} vs {villain_pos} | River [{board_str}] | Pot {pot:.0f}bb{facing_amt}"


def solve_river_sync(
    hand: CanonicalHand,
    spot: SolverSpot,
    hero_action: str | None = None,
) -> SolverResult:
    """
    Synchronous river solve — for use in background tasks.

    Returns a SolverResult with frequencies and preferred action.
    Falls back gracefully on any error.
    """
    t0 = time.perf_counter()

    config = _extract_river_node(hand, spot)
    if config is None:
        return SolverResult(status="error", error="Cannot extract river node")

    cache_key = _river_node_cache_key(config)
    cached = _cache_get(cache_key)
    if cached:
        _log.info("Live solver cache hit: %s", cache_key)
        return cached

    _log.info(
        "Live solver: board=%s pot=%.1f stack=%.1f iter=%d",
        config.board_string(), config.pot_size_bb(),
        config.effective_stack_chips(), config.iterations,
    )

    solve_result = run_texassolver(
        config,
        timeout=_LIVE_SOLVE_TIMEOUT,
        cleanup=True,
    )

    elapsed_ms = (time.perf_counter() - t0) * 1000

    if not solve_result.success:
        _log.warning("Live solve failed (%.0fms): %s", elapsed_ms, solve_result.error)
        return SolverResult(
            status="timeout" if "timed out" in (solve_result.error or "") else "error",
            error=solve_result.error,
            solve_time_ms=elapsed_ms,
            node_key=cache_key,
        )

    result = _parse_solver_result(
        solve_result, config,
        is_ip=spot.is_ip,
        hero_action=hero_action,
    )
    result.solve_time_ms = elapsed_ms
    result.node_key = cache_key

    result.node_description = _build_node_description(hand, spot, config)

    if result.status == "ready":
        _cache_put(cache_key, result)
        _log.info(
            "[TEXASSOLVER] mode=%s node=%s preferred=%s freqs=%s time=%.0fms iter=%d expl=%.1f%% cache=miss",
            result.mode, cache_key, result.preferred_action,
            result.frequencies, elapsed_ms, result.iterations, result.exploitability,
        )

    return result


async def solve_river_async(
    hand: CanonicalHand,
    spot: SolverSpot,
    hero_action: str | None = None,
) -> SolverResult:
    """
    Async wrapper for river solving — runs solver in thread pool
    to avoid blocking the event loop.
    """
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(
        None, solve_river_sync, hand, spot, hero_action,
    )


# ── Synthetic solver for development ─────────────────────────────────────────

def solve_river_synthetic(
    hand: CanonicalHand,
    spot: SolverSpot,
    hero_action: str | None = None,
) -> SolverResult:
    """
    Generate realistic synthetic solver output without running TexasSolver.

    Uses board texture and position heuristics to produce reasonable
    frequency distributions. For development and testing only.
    """
    from app.solver.board_classifier import BoardClassifier
    from app.texassolver.exporter import _synthetic_frequencies

    # Get board cards
    board_cards: list[str] = []
    for s in hand.streets:
        for c in s.board_cards:
            board_cards.append(c.notation)

    # Classify board
    classifier = BoardClassifier()
    try:
        if len(board_cards) >= 3:
            features = classifier.classify_flop(board_cards[:3])
            board_class = features.board_class.value
        else:
            board_class = "NEUTRAL"
    except Exception:
        board_class = "NEUTRAL"

    # Get synthetic IP/OOP frequencies
    bet_freq, check_freq = _synthetic_frequencies(board_class, is_ip=spot.is_ip)

    # For river: convert bet/check into fold/call/raise distribution
    # River decisions facing a bet: fold, call, raise
    # Not facing a bet: check, bet
    river_street = next(
        (s for s in hand.streets if s.name == Street.RIVER), None
    )
    facing_bet = False
    if river_street:
        hero_id = hand.hero_id
        for a in river_street.actions:
            if a.player_id == hero_id:
                break
            if a.action.value in ("bet", "raise"):
                facing_bet = True

    if facing_bet:
        # Facing aggression: fold/call/raise
        fold_freq = max(0.0, 1.0 - bet_freq * 1.2)  # more folding on scary boards
        call_freq = bet_freq * 0.7
        raise_freq = max(0.0, bet_freq * 0.3)
        total = fold_freq + call_freq + raise_freq
        frequencies = {
            "fold": round(fold_freq / total, 3),
            "call": round(call_freq / total, 3),
            "raise": round(raise_freq / total, 3),
        }
    else:
        # No aggression: check/bet
        frequencies = {
            "check": round(check_freq, 3),
            "bet": round(bet_freq, 3),
        }

    preferred = max(frequencies, key=frequencies.get)

    # Compute EV proxy
    ev: dict[str, float] = {}
    pot_bb = river_street.pot_start_bb if river_street else 10.0
    for action, freq in frequencies.items():
        if action == "fold":
            ev[action] = 0.0
        elif action == preferred:
            ev[action] = round(freq * pot_bb * 0.1, 2)  # small positive EV
        else:
            ev[action] = round(-(1.0 - freq) * pot_bb * 0.05, 2)  # small negative EV

    ev_loss = 0.0
    if hero_action and hero_action in ev and preferred in ev:
        ev_loss = round(ev[hero_action] - ev[preferred], 3)

    _log.info(
        "[TEXASSOLVER FALLBACK] reason=solver_unavailable mode=synthetic board=%s preferred=%s",
        board_class, preferred,
    )

    return SolverResult(
        status="ready",
        frequencies=frequencies,
        ev=ev,
        preferred_action=preferred,
        hero_action_ev_loss=ev_loss,
        source="texassolver_synthetic",
        iterations=0,
        exploitability=0.0,
        solve_time_ms=0.5,
        cache_hit=False,
        node_key=f"synthetic_{board_class}_{spot.is_ip}",
        fallback_reason="TexasSolver binary not available — using heuristic approximation",
        node_description=_build_node_description(hand, spot),
    )
