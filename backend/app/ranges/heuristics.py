"""
Strategic Heuristics — Phase 4
================================
Generates qualitative strategic flags and board pressure assessments
from a RangeInteractionProfile + SolverSpot.

This module is the strategic reasoning layer.  It converts the numeric
combo metrics produced by the engine into coach-legible tags and
qualitative explanations — without inventing frequencies or EVs.

DESIGN RULES
------------
  - All outputs are structural and deterministic
  - No solver math, no equity calculations
  - No hardcoded board strings — all reasoning flows from enum values
  - Readable, theory-grounded language

GOOD OUTPUT
-----------
  "BTN likely retains strong range advantage due to higher Ax and overpair density."

BAD OUTPUT (never produced here)
---------------------------------
  "BTN has 62.4% equity."
"""
from __future__ import annotations

from typing import Optional

from app.solver.models import SolverSpot
from app.solver.board_features import BoardFeatures
from app.solver.enums import BoardClassEnum, SpotType

from app.ranges.interactions import RangeInteractionProfile, DensityLabel


# ── Board pressure evaluation ──────────────────────────────────────────────────

def evaluate_board_pressure(
    board: Optional[BoardFeatures],
    board_class: BoardClassEnum,
) -> str:
    """
    Return a board pressure profile label.

    The pressure profile describes who benefits from continuation betting
    and what sizing strategies are favoured on this texture.
    """
    if board is None:
        return "preflop"

    bc = board_class.value

    # Ace / King high dry boards → aggressor has range advantage and can bet often
    if bc == "A_HIGH_DRY":
        return "aggressor_dry_high_card"
    if bc == "K_HIGH_DRY":
        return "aggressor_dry_high_card"
    if bc == "A_HIGH_WET":
        return "aggressor_high_card_with_draws"
    if bc == "K_HIGH_WET":
        return "aggressor_high_card_with_draws"

    # Low connected / dynamic → caller has range advantage, check-raising pressure
    if bc == "LOW_CONNECTED":
        return "dynamic_low_connected"
    if bc == "LOW_DYNAMIC":
        return "dynamic_low_connected"

    # Middle connected → semi-dynamic, balanced pressure
    if bc == "MIDDLE_CONNECTED":
        return "semi_dynamic_middle_connected"

    # Broadway-heavy → aggressor dominates, can bet wide
    if bc == "TRIPLE_BROADWAY":
        return "broadway_heavy_aggressor"
    if bc == "DOUBLE_BROADWAY":
        return "broadway_moderate_aggressor"

    # Paired boards → static with trips sensitivity
    if bc in ("PAIRED_HIGH", "PAIRED_LOW"):
        return "paired_board_trips_sensitive"

    # Monotone → nut flush dominates, both players tread carefully
    if bc == "MONOTONE":
        return "nut_sensitivity_monotone"

    # Turn / river completion events → nut shift
    if bc == "FLUSH_COMPLETING":
        return "draw_completed_flush_shift"
    if bc == "STRAIGHT_COMPLETING":
        return "draw_completed_straight_shift"

    # Rainbow textures
    if bc == "RAINBOW_STATIC":
        return "static_rainbow_aggressor"
    if bc == "RAINBOW_DYNAMIC":
        return "dynamic_rainbow_balanced"

    return "neutral_balanced"


# ── Strategic flag generation ──────────────────────────────────────────────────

def generate_strategic_flags(
    profile: RangeInteractionProfile,
    solver_spot: SolverSpot,
) -> list[str]:
    """
    Derive qualitative strategic tags from a RangeInteractionProfile.

    Returns a deduplicated list of flag strings in generation order.

    Example flags:
        strong_range_advantage, nut_advantage_shift, capped_defender,
        dynamic_board, draw_heavy, high_bluff_pressure,
        low_fold_equity_environment, overpair_advantage, set_mining_environment
    """
    flags: list[str] = []
    board = solver_spot.board_texture
    bc    = solver_spot.board_class.value

    # ── Range advantage ───────────────────────────────────────────────────────
    adv = profile.range_advantage
    if adv == "IP":
        flags.append("ip_range_advantage")
        # Strong if IP has both high top-pair AND high overpair density
        if (profile.top_pair_density.get("IP") == "high" and
                profile.overpair_density.get("IP") in ("high", "medium")):
            flags.append("strong_range_advantage")
    elif adv == "OOP":
        flags.append("oop_range_advantage")
        if (profile.top_pair_density.get("OOP") == "high" and
                profile.overpair_density.get("OOP") in ("high", "medium")):
            flags.append("strong_range_advantage")
    else:
        flags.append("balanced_range_advantage")

    # ── Nut advantage ─────────────────────────────────────────────────────────
    nut = profile.nut_advantage
    if nut != "NEUTRAL":
        flags.append("nut_advantage_shift")
        if nut == "IP":
            flags.append("ip_nut_advantage")
        else:
            flags.append("oop_nut_advantage")
        # Split advantage: range adv on one side, nut adv on the other
        if adv != "NEUTRAL" and adv != nut:
            flags.append("split_advantage_spot")

    # ── Capped ranges ─────────────────────────────────────────────────────────
    if profile.ip_capped:
        flags.append("ip_capped")
    if profile.oop_capped:
        flags.append("oop_capped")
        flags.append("capped_defender")   # canonical tag for coaching

    # ── Board texture flags ───────────────────────────────────────────────────
    if board is None:
        flags.append("preflop_spot")
    else:
        if board.dynamic:
            flags.append("dynamic_board")
        elif board.static:
            flags.append("static_board")

        # Draw-heavy: either player has high draw density
        ip_draw  = profile.draw_density.get("IP", "minimal")
        oop_draw = profile.draw_density.get("OOP", "minimal")
        if ip_draw == "high" or oop_draw == "high":
            flags.append("draw_heavy")

        # Monotone sensitivity
        if board.monotone:
            flags.append("monotone_board")
            flags.append("nut_flush_sensitivity")

        # Paired board
        if board.paired:
            flags.append("paired_board")

        # Scare card
        if board.scare_card:
            flags.append("scare_card_present")

        # Completion events
        if board.flush_completed and not board.monotone:
            flags.append("flush_completing")
        if board.straight_completed:
            flags.append("straight_completing")

        # Wheel interaction
        if board.wheel_possible:
            flags.append("wheel_interaction")

    # ── Board class specific ──────────────────────────────────────────────────
    if bc in ("LOW_CONNECTED", "LOW_DYNAMIC"):
        flags.append("low_connected_board")
        if bc == "LOW_DYNAMIC":
            flags.append("highly_dynamic_texture")

    if bc in ("TRIPLE_BROADWAY", "DOUBLE_BROADWAY"):
        flags.append("broadway_heavy_board")

    if bc in ("A_HIGH_DRY", "K_HIGH_DRY"):
        flags.append("high_card_dry_board")

    # ── Pressure-derived flags ────────────────────────────────────────────────
    pressure = profile.board_pressure_profile

    if "aggressor" in pressure:
        flags.append("high_bluff_pressure")    # IP can c-bet wide and profitably

    if "nut_sensitivity" in pressure or bc == "MONOTONE":
        flags.append("high_nut_sensitivity")

    if "draw_completed" in pressure:
        flags.append("nutted_range_shift")

    # ── Fold equity environment ───────────────────────────────────────────────
    # Low fold equity: villain has strong holdings AND we are capped
    if (profile.nut_density.get("OOP") == "high" and profile.ip_capped):
        flags.append("low_fold_equity_environment")
    if (profile.nut_density.get("IP") == "high" and profile.oop_capped):
        flags.append("low_fold_equity_environment")

    # High bluff pressure when villain is capped and we have range advantage
    if profile.oop_capped and adv == "IP":
        _add_unique(flags, "high_bluff_pressure")
    if profile.ip_capped and adv == "OOP":
        _add_unique(flags, "high_bluff_pressure")

    # ── Overpair advantage ────────────────────────────────────────────────────
    ip_op  = profile.overpair_density.get("IP",  "minimal")
    oop_op = profile.overpair_density.get("OOP", "minimal")
    if ip_op in ("high", "medium") and oop_op in ("low", "minimal"):
        flags.append("ip_overpair_advantage")
        flags.append("overpair_advantage")
    elif oop_op in ("high", "medium") and ip_op in ("low", "minimal"):
        flags.append("oop_overpair_advantage")
        flags.append("overpair_advantage")

    # ── Set mining environment ────────────────────────────────────────────────
    if (profile.set_density.get("OOP") in ("high", "medium") and
            bc in ("LOW_CONNECTED", "LOW_DYNAMIC", "PAIRED_LOW")):
        flags.append("set_mining_environment")

    # ── 3BET / 4BET pot specific ──────────────────────────────────────────────
    if solver_spot.spot_type == SpotType.THREE_BET:
        flags.append("three_bet_pot")
        # In 3bet pots, ranges are tighter → range advantages are amplified
        if adv != "NEUTRAL":
            _add_unique(flags, "strong_range_advantage")

    if solver_spot.spot_type == SpotType.FOUR_BET:
        flags.append("four_bet_pot")
        flags.append("spr_commitment_likely")

    # ── Deduplicate (preserve order) ──────────────────────────────────────────
    seen: set[str] = set()
    unique: list[str] = []
    for f in flags:
        if f not in seen:
            seen.add(f)
            unique.append(f)

    return unique


# ── Qualitative reasoning builders ────────────────────────────────────────────

def build_range_advantage_reason(
    profile: RangeInteractionProfile,
    solver_spot: SolverSpot,
) -> str:
    """
    Build a qualitative, theory-grounded explanation for the range advantage verdict.

    Never states exact equities or percentages.
    """
    adv  = profile.range_advantage
    bc   = solver_spot.board_class.value
    ip   = profile.ip_position or "IP"
    oop  = profile.oop_position or "OOP"

    if adv == "NEUTRAL":
        return (
            f"Range advantage is approximately balanced between {ip} and {oop} "
            f"on this {_readable(bc)} board. Neither range structurally dominates."
        )

    adv_pos  = ip  if adv == "IP"  else oop
    weak_pos = oop if adv == "IP"  else ip
    adv_role = "opening" if adv == "IP" else "defending"

    # Board-specific reasoning
    if bc in ("A_HIGH_DRY", "A_HIGH_WET"):
        return (
            f"{adv_pos} ({adv_role} range) likely retains strong range advantage "
            f"on this ace-high board due to higher Ax and overpair density — "
            f"opening ranges contain many AK, AQ, AJ, AT combos plus pocket pairs "
            f"KK–QQ that all interact well with an ace-high texture. "
            f"{weak_pos}'s range has fewer top-pair combinations and fewer overpairs."
        )

    if bc in ("K_HIGH_DRY", "K_HIGH_WET"):
        return (
            f"{adv_pos} ({adv_role} range) retains range advantage on this king-high board. "
            f"Opening ranges contain more KQ, KJ, KT type top pairs plus AA/QQ/JJ overpairs. "
            f"Defending ranges have fewer strong Kx combos and significantly fewer overpairs."
        )

    if bc in ("LOW_CONNECTED", "LOW_DYNAMIC"):
        return (
            f"{adv_pos} ({adv_role} range) benefits from improved range interaction "
            f"on this low connected board. Defending ranges contain significantly more "
            f"suited connectors (76s, 87s, 98s, 65s) and low pairs that connect well. "
            f"{weak_pos}'s opening range has fewer such holdings — range advantage shifts."
        )

    if bc == "TRIPLE_BROADWAY":
        return (
            f"{adv_pos} ({adv_role} range) holds strong range advantage on this "
            f"triple broadway board. Opening ranges are dense with KQ, KJ, QJ, AK, AQ "
            f"type holdings that make top pair or better. Defending ranges, while having "
            f"some broadway combos, are structurally lighter in the strongest top-pair combinations."
        )

    if bc in ("PAIRED_HIGH",):
        return (
            f"{adv_pos} ({adv_role} range) holds range advantage on this high paired board. "
            f"Opening ranges contain more high pocket pairs (KK, QQ, JJ) that make trips, "
            f"plus overpairs. Defending ranges are more often capped relative to trips/overpairs."
        )

    if bc in ("MIDDLE_CONNECTED",):
        return (
            f"{adv_pos} ({adv_role} range) benefits from denser suited connector holdings "
            f"on this middle-connected board — hands like JTs, T9s, 98s that make "
            f"straights, two pair, and sets. {weak_pos}'s range hits this texture less frequently."
        )

    return (
        f"{adv_pos} ({adv_role} range) holds range advantage on this {_readable(bc)} board "
        f"based on structural range composition analysis."
    )


def build_nut_advantage_reason(
    profile: RangeInteractionProfile,
    solver_spot: SolverSpot,
) -> str:
    """
    Build a qualitative explanation for the nut advantage verdict.

    Nut advantage = who owns more sets, straights, flushes, strong two pair.
    """
    nut = profile.nut_advantage
    bc  = solver_spot.board_class.value
    ip  = profile.ip_position or "IP"
    oop = profile.oop_position or "OOP"

    if nut == "NEUTRAL":
        return (
            f"Nut advantage is approximately balanced between {ip} and {oop} "
            f"on this board — neither player has a structural nut-hand advantage."
        )

    adv_pos  = ip  if nut == "IP"  else oop
    adv_role = "opening" if nut == "IP" else "defending"

    if bc in ("LOW_CONNECTED", "LOW_DYNAMIC"):
        return (
            f"{adv_pos} ({adv_role} range) likely holds nut advantage on this "
            f"low connected board. Defending ranges contain 76s, 87s, 98s, 65s "
            f"suited connectors that make straights and two pair, plus low pocket "
            f"pairs (55–88) that make sets. Opening ranges are structurally lighter "
            f"in these medium-low holdings."
        )

    if bc in ("A_HIGH_DRY",):
        return (
            f"{adv_pos} ({adv_role} range) holds nut advantage: AA makes top set, "
            f"AK/AQ make top pair with strong kicker, and KK/QQ function as powerful "
            f"overpairs. Opening ranges have significantly more of these combinations."
        )

    if bc in ("FLUSH_COMPLETING", "STRAIGHT_COMPLETING"):
        return (
            f"{adv_pos} ({adv_role} range) likely gained nut advantage after this "
            f"completing card. Defending/calling ranges typically contain more draw "
            f"combinations (suited connectors, suited aces) that improved to "
            f"made flushes or straights on this runout."
        )

    if bc == "MONOTONE":
        return (
            f"Nut advantage on a monotone board is heavily suit-dependent. "
            f"{adv_pos} ({adv_role} range) is estimated to hold a structural advantage "
            f"based on flush-draw density — the range with more suited holdings "
            f"of the board suit captures more nut-flush combinations."
        )

    return (
        f"{adv_pos} ({adv_role} range) holds nut advantage on this "
        f"{_readable(bc)} board based on structural range composition analysis."
    )


# ── Internal helpers ───────────────────────────────────────────────────────────

def _readable(board_class: str) -> str:
    """Convert board class enum value to a human-readable string."""
    return board_class.lower().replace("_", " ")


def _add_unique(lst: list[str], item: str) -> None:
    """Append item to list only if not already present."""
    if item not in lst:
        lst.append(item)
