"""
Interactive simulation engine — what-if analysis and scenario exploration.

Users can:
  1. Pause at any decision point in a hand
  2. Explore alternative actions and see predicted outcomes
  3. Compare EV paths between different lines
  4. Manipulate board cards to see how strategy changes
  5. Test exploit adjustments against population tendencies

Architecture:
  The simulation builds a SHALLOW decision tree (depth 2-3) from the
  current game state, using cached solver data and heuristics.
  Full tree generation is too slow for realtime — we branch only
  at the user's chosen decision point.
"""

from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass, field

from app.coaching.models import MistakeReport
from app.strategy.profiles import StrategyProfile

logger = logging.getLogger(__name__)


@dataclass
class SimulationNode:
    """A single node in the simulation tree."""
    node_id: str = field(default_factory=lambda: uuid.uuid4().hex[:8])
    action: str = ""                    # "bet 75%", "check", "fold"
    street: str = ""
    is_hero: bool = True

    # Strategy data
    solver_frequency: float = 0.0       # How often solver takes this action
    ev_estimate: float = 0.0            # Estimated EV of this line (relative)

    # State after this action
    pot_bb: float = 0.0
    hero_stack_bb: float = 0.0

    # Children (next actions)
    children: list[SimulationNode] = field(default_factory=list)

    # Coaching
    explanation: str = ""


@dataclass
class SimulationState:
    """Complete state of an interactive simulation."""
    sim_id: str = field(default_factory=lambda: uuid.uuid4().hex[:12])
    hand_id: str = ""
    board: list[str] = field(default_factory=list)
    street: str = "flop"
    pot_bb: float = 6.5
    hero_stack_bb: float = 96.75
    hero_position: str = "BTN"
    villain_position: str = "BB"
    spot_type: str = "SRP"
    hero_is_ip: bool = True

    # The decision tree
    root: SimulationNode | None = None

    # User's exploration path
    selected_path: list[str] = field(default_factory=list)  # node_ids


class SimulationEngine:
    """
    Generates shallow decision trees for interactive what-if analysis.

    Usage:
        engine = SimulationEngine()
        sim = engine.create_simulation(
            board=["Ah", "7d", "2c"],
            pot_bb=6.5,
            hero_stack_bb=96.75,
        )
        # sim.root contains the branching options
    """

    def create_simulation(
        self,
        *,
        board: list[str],
        pot_bb: float = 6.5,
        hero_stack_bb: float = 96.75,
        hero_position: str = "BTN",
        villain_position: str = "BB",
        spot_type: str = "SRP",
        hero_is_ip: bool = True,
        hand_id: str = "",
    ) -> SimulationState:
        """Create a new simulation at a decision point."""
        sim = SimulationState(
            hand_id=hand_id,
            board=board,
            street=self._street_from_board(board),
            pot_bb=pot_bb,
            hero_stack_bb=hero_stack_bb,
            hero_position=hero_position,
            villain_position=villain_position,
            spot_type=spot_type,
            hero_is_ip=hero_is_ip,
        )

        # Build shallow tree
        strategy = self._get_strategy(sim)
        sim.root = self._build_tree(sim, strategy, depth=0, max_depth=2)

        return sim

    def explore_action(
        self,
        sim: SimulationState,
        node_id: str,
    ) -> SimulationNode | None:
        """Select a branch to explore deeper."""
        node = self._find_node(sim.root, node_id)
        if node is None:
            return None
        sim.selected_path.append(node_id)

        # Expand children if not already expanded
        if not node.children and len(sim.selected_path) < 4:
            node.children = self._generate_responses(sim, node)

        return node

    def what_if_board(
        self,
        sim: SimulationState,
        new_board: list[str],
    ) -> SimulationState:
        """Re-run simulation with a different board."""
        return self.create_simulation(
            board=new_board,
            pot_bb=sim.pot_bb,
            hero_stack_bb=sim.hero_stack_bb,
            hero_position=sim.hero_position,
            villain_position=sim.villain_position,
            spot_type=sim.spot_type,
            hero_is_ip=sim.hero_is_ip,
            hand_id=sim.hand_id,
        )

    # ── Tree construction ─────────────────────────────────────────────────

    def _build_tree(
        self,
        sim: SimulationState,
        strategy: StrategyProfile | None,
        depth: int,
        max_depth: int,
    ) -> SimulationNode:
        """Build a shallow decision tree from solver strategy."""
        root = SimulationNode(
            action="decision",
            street=sim.street,
            is_hero=True,
            pot_bb=sim.pot_bb,
            hero_stack_bb=sim.hero_stack_bb,
        )

        if strategy is None or depth >= max_depth:
            return root

        # Generate hero action branches
        distribution = {}
        if strategy.action_frequencies:
            for af in strategy.action_frequencies:
                if af.frequency > 0.01:
                    distribution[af.action] = af.frequency
        else:
            if strategy.bet_frequency > 0.01:
                distribution["bet"] = strategy.bet_frequency
            if strategy.check_frequency > 0.01:
                distribution["check"] = strategy.check_frequency

        for action, freq in sorted(distribution.items(), key=lambda x: -x[1]):
            sizing = strategy.primary_sizing or "75pct" if action == "bet" else ""
            label = f"{action} {sizing}".strip() if sizing else action

            # Estimate EV (relative: preferred = 0, non-preferred = negative)
            ev_est = 0.0 if freq == max(distribution.values()) else -(1.0 - freq) * 2.0

            child = SimulationNode(
                action=label,
                street=sim.street,
                is_hero=True,
                solver_frequency=freq,
                ev_estimate=round(ev_est, 2),
                pot_bb=sim.pot_bb + (sim.pot_bb * 0.75 if action == "bet" else 0),
                hero_stack_bb=sim.hero_stack_bb - (sim.pot_bb * 0.75 if action == "bet" else 0),
                explanation=self._action_explanation(action, freq, strategy),
            )
            root.children.append(child)

        return root

    def _generate_responses(
        self,
        sim: SimulationState,
        parent: SimulationNode,
    ) -> list[SimulationNode]:
        """Generate opponent responses to a hero action."""
        responses = []

        if "bet" in parent.action or "raise" in parent.action:
            # Opponent can fold, call, or raise
            responses.append(SimulationNode(
                action="fold",
                street=parent.street,
                is_hero=False,
                solver_frequency=0.30,
                pot_bb=parent.pot_bb,
                explanation="Opponent folds — you win the pot.",
            ))
            responses.append(SimulationNode(
                action="call",
                street=parent.street,
                is_hero=False,
                solver_frequency=0.55,
                pot_bb=parent.pot_bb * 2,
                explanation="Opponent calls — pot grows, play continues.",
            ))
            responses.append(SimulationNode(
                action="raise",
                street=parent.street,
                is_hero=False,
                solver_frequency=0.15,
                pot_bb=parent.pot_bb * 3,
                explanation="Opponent raises — you face a tough decision.",
            ))
        elif parent.action == "check":
            responses.append(SimulationNode(
                action="check",
                street=parent.street,
                is_hero=False,
                solver_frequency=0.55,
                pot_bb=parent.pot_bb,
                explanation="Both check — move to next street.",
            ))
            responses.append(SimulationNode(
                action="bet",
                street=parent.street,
                is_hero=False,
                solver_frequency=0.45,
                pot_bb=parent.pot_bb * 1.5,
                explanation="Opponent bets — you must decide to call, raise, or fold.",
            ))

        return responses

    def _action_explanation(
        self, action: str, freq: float, strategy: StrategyProfile,
    ) -> str:
        """Generate a brief explanation for why the solver takes this action."""
        if action == "bet" and freq > 0.6:
            if strategy.range_advantage > 0.6:
                return "Solver bets frequently — you have strong range advantage here."
            return "Solver prefers betting in this spot."
        if action == "check" and freq > 0.6:
            return "Solver prefers checking — opponent's range connects well with this board."
        if freq > 0.3:
            return f"Part of the solver's mixed strategy ({freq:.0%} of the time)."
        return f"Solver uses this action infrequently ({freq:.0%})."

    def _get_strategy(self, sim: SimulationState) -> StrategyProfile | None:
        """Retrieve solver strategy for simulation state."""
        try:
            from app.strategy_db.storage import StrategyStore
            from app.solver.utils import bucket_spr, bucket_stack_depth
            from app.solver.board_classifier import BoardClassifier

            if len(sim.board) < 3:
                return None

            classifier = BoardClassifier()
            bf = classifier.classify_flop(sim.board[:3])
            bc = bf.board_class.value if hasattr(bf.board_class, "value") else str(bf.board_class)

            spr = sim.hero_stack_bb / max(sim.pot_bb, 0.1)
            positions = f"{sim.hero_position}_vs_{sim.villain_position}"
            node_key = (
                f"{sim.spot_type}::{positions}::{bucket_stack_depth(sim.hero_stack_bb)}::"
                f"{bucket_spr(spr)}::{bc}::{sim.street}::2p"
            )

            store = StrategyStore(seed_on_init=True)
            node = store.get_by_node_key(node_key, sim.hero_is_ip)
            if node is None:
                results = store.search_similar(node_key, sim.hero_is_ip, top_k=1, min_score=0.45)
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
        except Exception:
            pass
        return None

    def _find_node(self, root: SimulationNode | None, node_id: str) -> SimulationNode | None:
        if root is None:
            return None
        if root.node_id == node_id:
            return root
        for child in root.children:
            found = self._find_node(child, node_id)
            if found:
                return found
        return None

    def _street_from_board(self, board: list[str]) -> str:
        n = len(board)
        if n <= 0:
            return "preflop"
        if n <= 3:
            return "flop"
        if n == 4:
            return "turn"
        return "river"
