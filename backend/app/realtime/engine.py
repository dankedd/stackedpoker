"""
Realtime analysis engine — processes poker actions incrementally.

Unlike batch analysis (upload entire hand → analyze), this engine processes
actions ONE AT A TIME as they happen, maintaining running state and emitting
coaching events after each decision point.

Pipeline per action:
  1. Update running game state (pot, stacks, board, street)
  2. If hero action: retrieve solver strategy for current spot
  3. If hero action: detect mistake severity and EV loss
  4. Emit coaching event with explanation
  5. Update session statistics

Latency target: < 200ms from action ingestion to coaching event emission.
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum

from app.coaching.mistake_detector import detect_mistake
from app.coaching.explainer import generate_coaching
from app.coaching.models import MistakeReport, CoachingAdvice
from app.strategy.profiles import StrategyProfile

logger = logging.getLogger(__name__)


class AnalysisMode(str, Enum):
    """Controls when coaching feedback is delivered."""
    INSTANT = "instant"       # Feedback after every hero action (training mode)
    DELAYED = "delayed"       # Feedback only after hand completes (ethical mode)
    POST_SESSION = "post"     # Feedback only in post-session review


@dataclass
class RunningState:
    """Incrementally updated game state for a single hand."""
    hand_id: str = ""
    street: str = "preflop"
    board: list[str] = field(default_factory=list)
    pot_bb: float = 1.5           # SB + BB
    hero_stack_bb: float = 100.0
    villain_stack_bb: float = 100.0
    hero_position: str = ""
    villain_position: str = ""
    hero_is_ip: bool = True
    hero_is_pfr: bool = True
    spot_type: str = "SRP"

    # Action history
    actions: list[dict] = field(default_factory=list)
    hero_action_count: int = 0
    action_sequence: int = 0

    # Running analysis
    mistakes: list[MistakeReport] = field(default_factory=list)
    total_ev_loss_bb: float = 0.0

    # Timestamps
    started_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    last_action_at: datetime | None = None


@dataclass
class ActionResult:
    """Result of processing a single action."""
    action_index: int
    street: str
    is_hero: bool
    action: str

    # Analysis (only for hero actions)
    mistake: MistakeReport | None = None
    advice: CoachingAdvice | None = None
    coaching_event: dict | None = None  # Ready to emit via EventBus

    # Timing
    processing_ms: float = 0.0


class RealtimeAnalysisEngine:
    """
    Processes poker actions incrementally with per-action coaching.

    Usage:
        engine = RealtimeAnalysisEngine(mode=AnalysisMode.INSTANT)
        engine.start_hand(hand_id="h1", hero_position="BTN", ...)

        result = engine.process_action(
            street="flop", player="hero", action="bet",
            size_bb=4.5, board=["Ah", "7d", "2c"],
        )
        if result.coaching_event:
            await event_bus.publish(channel, "coaching", result.coaching_event)

        summary = engine.end_hand()
    """

    def __init__(
        self,
        mode: AnalysisMode = AnalysisMode.INSTANT,
        solver_confidence: float = 0.8,
    ) -> None:
        self._mode = mode
        self._solver_confidence = solver_confidence
        self._state: RunningState | None = None

    @property
    def mode(self) -> AnalysisMode:
        return self._mode

    @property
    def state(self) -> RunningState | None:
        return self._state

    def start_hand(
        self,
        hand_id: str,
        hero_position: str = "BTN",
        villain_position: str = "BB",
        hero_stack_bb: float = 100.0,
        villain_stack_bb: float = 100.0,
        hero_is_ip: bool = True,
        hero_is_pfr: bool = True,
        spot_type: str = "SRP",
    ) -> None:
        """Initialize state for a new hand."""
        self._state = RunningState(
            hand_id=hand_id,
            hero_position=hero_position,
            villain_position=villain_position,
            hero_stack_bb=hero_stack_bb,
            villain_stack_bb=villain_stack_bb,
            hero_is_ip=hero_is_ip,
            hero_is_pfr=hero_is_pfr,
            spot_type=spot_type,
        )

    def process_action(
        self,
        *,
        street: str,
        player: str,         # "hero" or player name
        action: str,          # "bet", "check", "fold", "call", "raise"
        size_bb: float = 0,
        board: list[str] | None = None,
        is_hero: bool = False,
    ) -> ActionResult:
        """
        Process a single action and return analysis results.

        For hero actions in INSTANT mode, retrieves solver strategy and
        produces coaching feedback. In DELAYED mode, stores for later.
        """
        t0 = time.monotonic()

        if self._state is None:
            raise RuntimeError("Call start_hand() before processing actions")

        state = self._state

        # Update state
        if board and len(board) > len(state.board):
            state.board = board
            state.street = self._street_from_board(board)

        state.street = street
        state.action_sequence += 1
        state.last_action_at = datetime.now(timezone.utc)

        action_record = {
            "street": street,
            "player": player,
            "action": action,
            "size_bb": size_bb,
            "is_hero": is_hero,
            "sequence": state.action_sequence,
        }
        state.actions.append(action_record)

        # Update pot
        if action in ("bet", "raise", "call") and size_bb > 0:
            state.pot_bb += size_bb

        result = ActionResult(
            action_index=state.action_sequence,
            street=street,
            is_hero=is_hero,
            action=action,
        )

        # Only analyze hero actions
        if is_hero and self._mode == AnalysisMode.INSTANT:
            result.mistake, result.advice = self._analyze_hero_action(
                state, action, street,
            )
            if result.mistake:
                state.mistakes.append(result.mistake)
                state.total_ev_loss_bb += result.mistake.ev_loss_bb
                state.hero_action_count += 1

                result.coaching_event = self._build_coaching_event(
                    state, result.mistake, result.advice,
                )

        elif is_hero and self._mode == AnalysisMode.DELAYED:
            state.hero_action_count += 1
            # Store for post-hand analysis

        result.processing_ms = (time.monotonic() - t0) * 1000
        return result

    def end_hand(self) -> dict:
        """
        Finalize hand and return summary.

        In DELAYED mode, runs analysis on all stored hero actions now.
        """
        if self._state is None:
            return {"error": "No hand in progress"}

        state = self._state

        # Delayed mode: analyze all hero actions now
        if self._mode == AnalysisMode.DELAYED:
            for action_rec in state.actions:
                if action_rec.get("is_hero"):
                    mistake, advice = self._analyze_hero_action(
                        state,
                        action_rec["action"],
                        action_rec["street"],
                    )
                    if mistake:
                        state.mistakes.append(mistake)
                        state.total_ev_loss_bb += mistake.ev_loss_bb

        summary = {
            "hand_id": state.hand_id,
            "actions_total": len(state.actions),
            "hero_actions": state.hero_action_count,
            "mistakes": len([m for m in state.mistakes if m.is_mistake()]),
            "total_ev_loss_bb": round(state.total_ev_loss_bb, 2),
            "worst_severity": (
                max((m.severity.value for m in state.mistakes), default="none")
                if state.mistakes else "none"
            ),
            "duration_seconds": (
                (datetime.now(timezone.utc) - state.started_at).total_seconds()
            ),
            "mode": self._mode.value,
        }

        self._state = None
        return summary

    # ── Internal analysis ─────────────────────────────────────────────────

    def _analyze_hero_action(
        self,
        state: RunningState,
        action: str,
        street: str,
    ) -> tuple[MistakeReport | None, CoachingAdvice | None]:
        """Retrieve solver strategy and analyze the hero's action."""
        strategy = self._retrieve_strategy(state, street)
        if strategy is None:
            return None, None

        mistake = detect_mistake(
            action_taken=action,
            street=street,
            strategy=strategy,
            pot_bb=state.pot_bb,
            solver_confidence=self._solver_confidence,
        )

        advice = None
        if mistake.is_mistake():
            advice = generate_coaching(
                mistake=mistake,
                strategy=strategy,
                board=state.board,
                spot_type=state.spot_type,
                positions=f"{state.hero_position}_vs_{state.villain_position}",
                is_ip=state.hero_is_ip,
                is_pfr=state.hero_is_pfr,
                stack_depth=int(state.hero_stack_bb),
            )

        return mistake, advice

    def _retrieve_strategy(
        self,
        state: RunningState,
        street: str,
    ) -> StrategyProfile | None:
        """
        Retrieve solver strategy for the current spot.

        Tries the full abstraction pipeline first, falls back to heuristic.
        """
        try:
            from app.strategy_db.storage import StrategyStore
            from app.solver.utils import bucket_spr, bucket_stack_depth
            from app.solver.board_classifier import BoardClassifier

            if not state.board or len(state.board) < 3:
                return None

            classifier = BoardClassifier()
            bf = classifier.classify_flop(state.board[:3])
            bc = bf.board_class.value if hasattr(bf.board_class, "value") else str(bf.board_class)

            spr = state.hero_stack_bb / max(state.pot_bb, 0.1)
            stack_bucket = bucket_stack_depth(state.hero_stack_bb)
            spr_bucket = bucket_spr(spr)
            positions = f"{state.hero_position}_vs_{state.villain_position}"

            node_key = f"{state.spot_type}::{positions}::{stack_bucket}::{spr_bucket}::{bc}::{street}::2p"

            store = StrategyStore(seed_on_init=True)
            node = store.get_by_node_key(node_key, state.hero_is_ip)
            if node is None:
                results = store.search_similar(node_key, state.hero_is_ip, top_k=1, min_score=0.50)
                if results:
                    node = results[0][0]

            if node:
                from app.strategy.profiles import ActionFrequency
                return StrategyProfile(
                    node_key=node.node_key,
                    bet_frequency=node.bet_frequency,
                    check_frequency=node.check_frequency,
                    primary_sizing=node.primary_sizing,
                    range_advantage=node.range_advantage,
                    nut_advantage=node.nut_advantage,
                    pressure_score=node.pressure_score,
                    volatility_score=node.volatility_score,
                    equity_realization=node.equity_realization,
                    action_frequencies=[
                        ActionFrequency("bet", node.bet_frequency, node.primary_sizing),
                        ActionFrequency("check", node.check_frequency, None),
                    ],
                    rationale=node.rationale,
                    source="registry",
                )
        except Exception as exc:
            logger.debug("[RealtimeEngine] strategy retrieval failed: %s", exc)

        return None

    def _build_coaching_event(
        self,
        state: RunningState,
        mistake: MistakeReport,
        advice: CoachingAdvice | None,
    ) -> dict:
        """Build a coaching event payload for emission via EventBus."""
        return {
            "hand_id": state.hand_id,
            "action_index": state.action_sequence,
            "street": state.street,
            "severity": mistake.severity.value,
            "quality": mistake.quality.value,
            "ev_loss_bb": mistake.ev_loss_bb,
            "solver_preferred": mistake.solver_preferred_action,
            "headline": advice.headline if advice else "",
            "explanation": advice.what_to_do_instead if advice else "",
            "concept": advice.transferable_concept if advice else "",
            "confidence": mistake.solver_confidence,
        }

    def _street_from_board(self, board: list[str]) -> str:
        n = len(board)
        if n <= 0:
            return "preflop"
        if n <= 3:
            return "flop"
        if n == 4:
            return "turn"
        return "river"
