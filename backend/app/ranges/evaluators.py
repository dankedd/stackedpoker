"""
Range Evaluators — Phase 4
============================
Bridges SolverSpot → PreflopRange lookup → RangeInteractionEngine → enriched profile.

This is the main Phase 4 entry point for strategic range analysis.

DESIGN RULES
------------
  - Deterministic: same SolverSpot → same output, always
  - No fake solver EVs, no exact equities, no invented frequencies
  - Qualitative strategic reasoning only
  - Falls back gracefully when no exact range exists for a spot
"""
from __future__ import annotations

from typing import Optional

from app.solver.models import SolverSpot
from app.solver.enums import SpotType

from app.ranges.models import PreflopRange
from app.ranges.interactions import RangeInteractionEngine, RangeInteractionProfile


# ── Range key resolution tables ────────────────────────────────────────────────
#
# Each entry maps a PositionMatchup value → (ip_range_key, oop_range_key)
# Keys must exist in preflop.cash_100bb.registry.

_SRP_KEYS: dict[str, tuple[str, str]] = {
    "BTN_vs_BB":  ("BTN_OPEN", "BB_VS_BTN_DEFEND"),
    "CO_vs_BB":   ("CO_OPEN",  "BB_VS_CO_DEFEND"),
    "HJ_vs_BB":   ("HJ_OPEN",  "BB_VS_UTG_DEFEND"),
    "LJ_vs_BB":   ("HJ_OPEN",  "BB_VS_UTG_DEFEND"),
    "UTG_vs_BB":  ("UTG_OPEN", "BB_VS_UTG_DEFEND"),
    "UTG1_vs_BB": ("UTG_OPEN", "BB_VS_UTG_DEFEND"),
    "UTG2_vs_BB": ("UTG_OPEN", "BB_VS_UTG_DEFEND"),
    "SB_vs_BB":   ("SB_OPEN",  "BB_VS_SB_DEFEND"),
    # Cold-call spots: use opener's range as proxy for IP caller
    "BTN_vs_CO":  ("BTN_OPEN", "CO_OPEN"),
    "BTN_vs_HJ":  ("BTN_OPEN", "HJ_OPEN"),
    "BTN_vs_SB":  ("BTN_OPEN", "SB_OPEN"),
    "CO_vs_HJ":   ("CO_OPEN",  "HJ_OPEN"),
    "CO_vs_SB":   ("CO_OPEN",  "SB_OPEN"),
    "HJ_vs_SB":   ("HJ_OPEN",  "SB_OPEN"),
    # BB_vs_SB: BB iso-raised the limper or 3bet SB
    "BB_vs_SB":   ("BB_VS_SB_DEFEND", "SB_OPEN"),
}

# 3BET pots — OOP player is typically the 3-bettor.
# ip_range = caller proxy (uses their open range; overestimates width)
# oop_range = the 3-bet range
_3BET_KEYS: dict[str, tuple[str, str]] = {
    "BTN_vs_BB":  ("BTN_OPEN", "BB_3BET_VS_BTN"),  # BB 3bet, BTN called
    "CO_vs_BB":   ("CO_OPEN",  "BB_3BET_VS_CO"),
    "BTN_vs_SB":  ("BTN_OPEN", "SB_3BET_VS_BTN"),  # SB 3bet, BTN called
    "CO_vs_BTN":  ("CO_OPEN",  "BTN_3BET_VS_CO"),  # BTN 3bet CO
    "SB_vs_BTN":  ("SB_OPEN",  "BTN_3BET_VS_SB"),
    "BTN_vs_CO":  ("BTN_OPEN", "BTN_3BET_VS_CO"),  # BTN 3bet CO (IP aggressor)
    "CO_vs_SB":   ("CO_OPEN",  "CO_3BET_VS_BTN"),  # approximate
    "HJ_vs_BB":   ("HJ_OPEN",  "BB_3BET_VS_CO"),   # approximate
}

_FALLBACK = ("BTN_OPEN", "BB_VS_BTN_DEFEND")

# Position strings on each side of the matchup (ip_pos, oop_pos)
_MATCHUP_POSITIONS: dict[str, tuple[str, str]] = {
    "BTN_vs_BB": ("BTN", "BB"),
    "BTN_vs_SB": ("BTN", "SB"),
    "BTN_vs_CO": ("BTN", "CO"),
    "BTN_vs_HJ": ("BTN", "HJ"),
    "BTN_vs_LJ": ("BTN", "LJ"),
    "BTN_vs_UTG": ("BTN", "UTG"),
    "BTN_vs_UTG1": ("BTN", "UTG1"),
    "BTN_vs_UTG2": ("BTN", "UTG2"),
    "CO_vs_BB":  ("CO",  "BB"),
    "CO_vs_SB":  ("CO",  "SB"),
    "CO_vs_HJ":  ("CO",  "HJ"),
    "CO_vs_LJ":  ("CO",  "LJ"),
    "CO_vs_UTG": ("CO",  "UTG"),
    "HJ_vs_BB":  ("HJ",  "BB"),
    "HJ_vs_SB":  ("HJ",  "SB"),
    "HJ_vs_LJ":  ("HJ",  "LJ"),
    "HJ_vs_UTG": ("HJ",  "UTG"),
    "LJ_vs_BB":  ("LJ",  "BB"),
    "LJ_vs_SB":  ("LJ",  "SB"),
    "LJ_vs_UTG": ("LJ",  "UTG"),
    "UTG_vs_BB": ("UTG", "BB"),
    "UTG_vs_SB": ("UTG", "SB"),
    "UTG1_vs_BB": ("UTG1", "BB"),
    "UTG2_vs_BB": ("UTG2", "BB"),
    "SB_vs_BB":  ("SB",  "BB"),
    "BB_vs_SB":  ("BB",  "SB"),
}


# ── Public API ─────────────────────────────────────────────────────────────────

def resolve_ranges(
    solver_spot: SolverSpot,
) -> tuple[PreflopRange, PreflopRange]:
    """
    Resolve the best-match (ip_range, oop_range) for a SolverSpot.

    Uses the preflop range registry for 100bb cash game.
    Falls back to BTN_OPEN / BB_VS_BTN_DEFEND when no exact match exists.

    Returns:
        (ip_range, oop_range) — in-position and out-of-position PreflopRange objects.
    """
    from app.ranges.preflop.cash_100bb.registry import get_range

    matchup = solver_spot.position_matchup.value
    spot_type = solver_spot.spot_type

    if spot_type in (SpotType.SRP, SpotType.ISO_RAISE, SpotType.LIMPED):
        keys = _SRP_KEYS.get(matchup, _FALLBACK)
    elif spot_type == SpotType.THREE_BET:
        keys = _3BET_KEYS.get(matchup) or _SRP_KEYS.get(matchup, _FALLBACK)
    elif spot_type in (SpotType.FOUR_BET, SpotType.SQUEEZE):
        # Use SRP proxy — 4bet/squeeze ranges not yet in registry
        keys = _SRP_KEYS.get(matchup, _FALLBACK)
    else:
        keys = _FALLBACK

    ip_key, oop_key = keys
    try:
        return get_range(ip_key), get_range(oop_key)
    except KeyError:
        return get_range(_FALLBACK[0]), get_range(_FALLBACK[1])


def analyze_solver_spot(
    solver_spot: SolverSpot,
    board_cards: Optional[list[str]] = None,
) -> RangeInteractionProfile:
    """
    Full Phase 4 analysis for a SolverSpot.

    Steps:
      1. Resolve IP and OOP ranges from the registry
      2. Run RangeInteractionEngine for combo-level metrics
      3. Extend profile with nut/air/two-pair densities
      4. Add board pressure profile
      5. Generate strategic flags
      6. Generate qualitative reasoning

    Args:
        solver_spot:  Fully classified spot (from SolverSpotClassifier).
        board_cards:  Explicit board card list (e.g. ["Ah","Kd","3c"]).
                      Falls back to solver_spot.board_texture metadata if absent.

    Returns:
        RangeInteractionProfile with all Phase 4 fields populated.

    This function never fabricates solver frequencies or exact equities.
    """
    from app.ranges.density import extend_density_profile
    from app.ranges.heuristics import (
        generate_strategic_flags,
        evaluate_board_pressure,
        build_range_advantage_reason,
        build_nut_advantage_reason,
    )

    # ── Extract board cards ───────────────────────────────────────────────────
    board = board_cards or _extract_board_cards(solver_spot)
    if not board:
        # Preflop spot — return a minimal profile
        return _preflop_profile(solver_spot)

    # ── Resolve ranges ────────────────────────────────────────────────────────
    ip_range, oop_range = resolve_ranges(solver_spot)

    # ── Run base engine ───────────────────────────────────────────────────────
    engine = RangeInteractionEngine()
    profile = engine.analyze(ip_range, oop_range, board)

    # ── Annotate position labels ──────────────────────────────────────────────
    matchup = solver_spot.position_matchup.value
    ip_pos, oop_pos = _MATCHUP_POSITIONS.get(matchup, ("IP", "OOP"))
    profile.ip_position = ip_pos
    profile.oop_position = oop_pos

    # ── Extend density profile ────────────────────────────────────────────────
    board_features = solver_spot.board_texture
    ext = extend_density_profile(profile.ip_metrics, profile.oop_metrics, board_features)
    profile.nut_density = ext["nut"]
    profile.two_pair_density = ext["two_pair"]
    profile.air_density = ext["air"]

    # ── Board pressure profile ────────────────────────────────────────────────
    profile.board_pressure_profile = evaluate_board_pressure(
        board_features, solver_spot.board_class
    )

    # ── Strategic flags ───────────────────────────────────────────────────────
    profile.strategic_flags = generate_strategic_flags(profile, solver_spot)

    # ── Qualitative reasoning ─────────────────────────────────────────────────
    profile.range_advantage_reason = build_range_advantage_reason(profile, solver_spot)
    profile.nut_advantage_reason = build_nut_advantage_reason(profile, solver_spot)

    return profile


def advantage_from_hero_perspective(
    profile: RangeInteractionProfile,
    hero_is_ip: bool,
) -> dict[str, str]:
    """
    Re-express the IP/OOP advantage labels as hero/villain from hero's POV.

    Returns a dict with keys:
        range_advantage, nut_advantage, hero_capped, villain_capped
    where values use 'hero' / 'villain' / 'neutral' / True / False.
    """
    def _map(label: str) -> str:
        if label == "IP":
            return "hero" if hero_is_ip else "villain"
        if label == "OOP":
            return "villain" if hero_is_ip else "hero"
        return "neutral"

    hero_cap = profile.ip_capped if hero_is_ip else profile.oop_capped
    villain_cap = profile.oop_capped if hero_is_ip else profile.ip_capped

    return {
        "range_advantage": _map(profile.range_advantage),
        "nut_advantage": _map(profile.nut_advantage),
        "hero_capped": hero_cap,
        "villain_capped": villain_cap,
    }


# ── Internal helpers ───────────────────────────────────────────────────────────

def _extract_board_cards(solver_spot: SolverSpot) -> list[str]:
    """Try to extract board cards from SolverSpot metadata."""
    meta = solver_spot.metadata or {}
    board = meta.get("board_cards") or meta.get("board") or []
    if isinstance(board, list):
        return [str(c) for c in board]
    return []


def _preflop_profile(solver_spot: SolverSpot) -> RangeInteractionProfile:
    """Return a minimal profile for preflop spots with no board."""
    matchup = solver_spot.position_matchup.value
    ip_pos, oop_pos = _MATCHUP_POSITIONS.get(matchup, ("IP", "OOP"))

    ip_range, oop_range = resolve_ranges(solver_spot)

    from app.ranges.abstractions import is_capped
    ip_cap = is_capped(ip_range)
    oop_cap = is_capped(oop_range)

    from app.ranges.interactions import RangeMetrics
    empty = RangeMetrics(0, 0, 0, 0, 0, 0, 0, 0, 0)

    return RangeInteractionProfile(
        range_advantage="NEUTRAL",
        nut_advantage="NEUTRAL",
        ip_capped=ip_cap,
        oop_capped=oop_cap,
        board_dynamic=False,
        top_pair_density={},
        overpair_density={},
        set_density={},
        draw_density={},
        broadway_density={},
        ip_metrics=empty,
        oop_metrics=empty,
        summary=f"Preflop spot — no board yet. {ip_pos} vs {oop_pos}.",
        board_pressure_profile="preflop",
        strategic_flags=["preflop_spot"],
        ip_position=ip_pos,
        oop_position=oop_pos,
    )
