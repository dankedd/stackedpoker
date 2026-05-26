"""
Drill generation — creates training exercises from the solve database.

Drill types:
  CBET_OR_CHECK:      "You're the PFR on [board]. Bet or check?"
  DEFEND_OR_FOLD:     "BB facing a c-bet on [board]. Continue or fold?"
  BET_SIZE_SELECT:    "You decide to bet. Choose the right sizing."
  BLUFF_OR_GIVE_UP:   "You have [air hand] on the river. Bluff or give up?"
  VALUE_BET_THIN:     "You have [medium hand] on river. Value bet or check?"
  RANGE_CONSTRUCTION: "Build a betting range for this flop."

Generation pipeline:
  1. Select spot dimensions (board class, positions, stack depth)
  2. Find solver strategy for the spot
  3. Classify difficulty from solver frequency distribution
  4. Generate question prompt and options
  5. Set correct answer from solver preferred action
  6. Write explanation grounded in poker theory

Difficulty scaling:
  BEGINNER:     solver prefers one action at 80%+ (clear-cut)
  INTERMEDIATE: solver mixes 40-60% (genuine mixed strategy)
  ADVANCED:     solver splits 30/30/40 (multi-way mix, thin margins)
"""

from __future__ import annotations

import hashlib
import logging
import random
from typing import Sequence

from app.strategy.profiles import StrategyProfile
from app.strategy_db.models import StrategyNode
from app.strategy_db.storage import StrategyStore

from .explainer import _card_display, _board_display
from .models import (
    DrillDifficulty,
    DrillOption,
    DrillSpec,
    DrillType,
)

logger = logging.getLogger(__name__)


# ── Drill spot library (boards tagged by training value) ──────────────────

_DRILL_BOARDS: dict[str, list[dict]] = {
    "cbet_high_freq": [
        {"board": ["Ah", "7d", "2c"], "class": "A_HIGH_DRY", "note": "PFR bets often"},
        {"board": ["Kc", "8h", "3d"], "class": "K_HIGH_DRY", "note": "PFR range advantage"},
        {"board": ["As", "Ks", "3h"], "class": "A_HIGH_WET", "note": "Strong range + nut advantage"},
    ],
    "cbet_low_freq": [
        {"board": ["8s", "7d", "6c"], "class": "LOW_CONNECTED", "note": "Caller connects more"},
        {"board": ["5h", "4d", "3c"], "class": "LOW_DYNAMIC", "note": "Bad cbet board"},
        {"board": ["7h", "7d", "3c"], "class": "PAIRED_LOW", "note": "Low paired = check often"},
    ],
    "bluff_candidate": [
        {"board": ["Ah", "7d", "2c", "Qs", "4h"], "class": "A_HIGH_DRY", "note": "River bluff spot"},
        {"board": ["Kh", "Qh", "3d", "8s", "2c"], "class": "K_HIGH_WET", "note": "Missed draw bluff"},
    ],
    "thin_value": [
        {"board": ["Qd", "8c", "4h", "3s", "6d"], "class": "NEUTRAL", "note": "Top pair thin value"},
        {"board": ["Kh", "9d", "5c", "2s", "Jh"], "class": "K_HIGH_DRY", "note": "Overpair river"},
    ],
}


def _generate_drill_id(drill_type: str, board: list[str], positions: str) -> str:
    """Deterministic drill ID for deduplication."""
    raw = f"{drill_type}|{'_'.join(board)}|{positions}"
    return hashlib.md5(raw.encode()).hexdigest()[:12]


def _classify_difficulty(distribution: dict[str, float]) -> DrillDifficulty:
    """Classify drill difficulty from solver frequency distribution."""
    if not distribution:
        return DrillDifficulty.INTERMEDIATE

    max_freq = max(distribution.values())
    nonzero_actions = sum(1 for f in distribution.values() if f > 0.05)

    if max_freq >= 0.80:
        return DrillDifficulty.BEGINNER
    if max_freq >= 0.50 or nonzero_actions <= 2:
        return DrillDifficulty.INTERMEDIATE
    return DrillDifficulty.ADVANCED


def _build_options(
    distribution: dict[str, float],
    drill_type: DrillType,
) -> list[DrillOption]:
    """Build drill options from solver action distribution."""
    options = []
    preferred = max(distribution, key=distribution.get) if distribution else "check"

    for action, freq in sorted(distribution.items(), key=lambda x: -x[1]):
        label_map = {
            "bet": "Bet",
            "check": "Check",
            "fold": "Fold",
            "call": "Call",
            "raise": "Raise",
        }
        label = label_map.get(action, action.capitalize())

        options.append(DrillOption(
            action=action,
            label=label,
            is_correct=(action == preferred),
            is_acceptable=(freq >= 0.05),
            solver_frequency=round(freq, 3),
            feedback=_action_feedback(action, freq, preferred),
        ))

    return options


def _action_feedback(action: str, freq: float, preferred: str) -> str:
    """Generate post-answer feedback for a drill option."""
    if action == preferred:
        if freq >= 0.80:
            return "Correct! This is clearly the solver's preferred action."
        return f"Correct! The solver uses this action most frequently."

    if freq >= 0.20:
        return f"Acceptable — the solver also uses this action, but {preferred}ing is preferred."
    if freq >= 0.05:
        return f"Not ideal — the solver uses this action infrequently. {preferred.capitalize()}ing is preferred."
    return f"Incorrect — the solver strongly prefers {preferred}ing in this spot."


def generate_cbet_drill(
    strategy: StrategyProfile,
    board: list[str],
    board_class: str,
    positions: str = "BTN_vs_BB",
    stack_depth: int = 100,
) -> DrillSpec:
    """Generate a c-bet or check drill from a solver strategy."""
    distribution = {}
    if strategy.action_frequencies:
        for af in strategy.action_frequencies:
            distribution[af.action] = af.frequency
    else:
        distribution = {"bet": strategy.bet_frequency, "check": strategy.check_frequency}

    difficulty = _classify_difficulty(distribution)
    options = _build_options(distribution, DrillType.CBET_OR_CHECK)
    preferred = max(distribution, key=distribution.get) if distribution else "check"

    pos_parts = positions.split("_vs_")
    hero_pos = pos_parts[0]
    villain_pos = pos_parts[1] if len(pos_parts) > 1 else "BB"
    board_str = _board_display(board)

    prompt = (
        f"You are {hero_pos} in a single-raised pot vs {villain_pos}. "
        f"Stack depth: {stack_depth}bb. Board: {board_str}. "
        f"You were the preflop raiser. What do you do?"
    )

    # Explanation
    if preferred == "bet":
        explanation = (
            f"Betting is preferred because you have range advantage on this "
            f"{board_class.replace('_', ' ').lower()} board. As the PFR, your range "
            f"contains more strong hands that connect with this texture."
        )
    else:
        explanation = (
            f"Checking is preferred because this {board_class.replace('_', ' ').lower()} "
            f"board connects well with the caller's range. Betting frequently would "
            f"allow the defender to exploit you with raises and check-raises."
        )

    return DrillSpec(
        drill_id=_generate_drill_id("cbet", board, positions),
        drill_type=DrillType.CBET_OR_CHECK,
        difficulty=difficulty,
        board=board,
        spot_type="SRP",
        positions=positions,
        stack_depth=stack_depth,
        street="flop",
        hero_is_ip=True,
        prompt=prompt,
        options=options,
        correct_action=preferred,
        explanation=explanation,
        solver_distribution=distribution,
        concept_tags=["cbet_theory", "range_advantage"],
        board_class=board_class,
    )


def generate_defense_drill(
    strategy: StrategyProfile,
    board: list[str],
    board_class: str,
    positions: str = "BTN_vs_BB",
    stack_depth: int = 100,
) -> DrillSpec:
    """Generate a defend-or-fold drill (BB perspective)."""
    # For defense drills, the strategy should be for OOP/defender
    distribution = {}
    if strategy.action_frequencies:
        for af in strategy.action_frequencies:
            distribution[af.action] = af.frequency
    else:
        # Rough estimate: defender calls ~60%, folds ~30%, raises ~10%
        distribution = {"call": 0.60, "fold": 0.30, "raise": 0.10}

    difficulty = _classify_difficulty(distribution)
    options = _build_options(distribution, DrillType.DEFEND_OR_FOLD)
    preferred = max(distribution, key=distribution.get)

    pos_parts = positions.split("_vs_")
    aggressor = pos_parts[0]
    board_str = _board_display(board)

    prompt = (
        f"You are BB facing a c-bet from {aggressor} in a single-raised pot. "
        f"Stack depth: {stack_depth}bb. Board: {board_str}. "
        f"What is your action?"
    )

    explanation = (
        f"In this spot, the solver recommends {preferred}ing most often. "
        f"Your calling range should include enough hands to prevent the "
        f"aggressor from profiting with any two cards."
    )

    return DrillSpec(
        drill_id=_generate_drill_id("defense", board, positions),
        drill_type=DrillType.DEFEND_OR_FOLD,
        difficulty=difficulty,
        board=board,
        spot_type="SRP",
        positions=positions,
        stack_depth=stack_depth,
        street="flop",
        hero_is_ip=False,
        prompt=prompt,
        options=options,
        correct_action=preferred,
        explanation=explanation,
        solver_distribution=distribution,
        concept_tags=["mdf", "defense_theory"],
        board_class=board_class,
    )


def generate_drill_set(
    store: StrategyStore,
    drill_type: DrillType,
    count: int = 5,
    difficulty: DrillDifficulty | None = None,
    concept_focus: str | None = None,
    seed: int | None = None,
) -> list[DrillSpec]:
    """
    Generate a set of drills from the solve database.

    Selects spots with solver data available, matching the requested
    difficulty and concept focus.
    """
    if seed is not None:
        random.seed(seed)

    drills: list[DrillSpec] = []

    # Select board pool based on drill type
    if drill_type == DrillType.CBET_OR_CHECK:
        pools = ["cbet_high_freq", "cbet_low_freq"]
    elif drill_type == DrillType.DEFEND_OR_FOLD:
        pools = ["cbet_high_freq", "cbet_low_freq"]
    elif drill_type in (DrillType.BLUFF_OR_GIVE_UP, DrillType.VALUE_BET_THIN):
        pools = ["bluff_candidate", "thin_value"]
    else:
        pools = list(_DRILL_BOARDS.keys())

    candidates = []
    for pool in pools:
        candidates.extend(_DRILL_BOARDS.get(pool, []))

    random.shuffle(candidates)

    for spot in candidates:
        if len(drills) >= count:
            break

        board = spot["board"]
        board_class = spot["class"]

        # Try to find solver strategy for this spot
        node_key = f"SRP::BTN_vs_BB::100bb::4_8::{board_class}::flop::2p"
        is_ip = drill_type != DrillType.DEFEND_OR_FOLD
        node = store.get_by_node_key(node_key, is_ip)

        if node is None:
            # Try similar
            results = store.search_similar(node_key, is_ip, top_k=1, min_score=0.50)
            if results:
                node = results[0][0]

        if node is None:
            continue

        # Build StrategyProfile from node
        from app.strategy.profiles import StrategyProfile, ActionFrequency
        strategy = StrategyProfile(
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

        if drill_type == DrillType.CBET_OR_CHECK:
            drill = generate_cbet_drill(strategy, board, board_class)
        elif drill_type == DrillType.DEFEND_OR_FOLD:
            drill = generate_defense_drill(strategy, board, board_class)
        else:
            drill = generate_cbet_drill(strategy, board, board_class)

        # Filter by difficulty
        if difficulty is not None and drill.difficulty != difficulty:
            continue

        drills.append(drill)

    return drills
