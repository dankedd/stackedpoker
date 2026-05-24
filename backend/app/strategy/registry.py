"""
Handcrafted strategy templates for known solver spot configurations.

Architecture
------------
1. Base profile  — keyed by (spot_type, is_ip)
2. Board modifier — delta adjustments keyed by board_class
3. SPR modifier   — delta adjustments keyed by spr_bucket
4. build_profile_dict() — combines all three, clamps values to [0.0, 1.0]

Rationale strings are assembled from theory-grounded spot descriptions.

This module contains NO AI logic and NO fabricated solver percentages.
All values are derived from established GTO principles:
  - PFR holds range advantage on A/K-high dry boards
  - Low/connected boards favour the caller's defending range
  - Monotone boards require more checking to protect range
  - Low SPR → higher pot commitment, higher pressure, less volatility
  - 3bet/squeeze → condensed caller range, strong range advantage for PFR
"""

from __future__ import annotations

from typing import NamedTuple


class _BaseTemplate(NamedTuple):
    bet_frequency: float
    check_frequency: float
    primary_sizing: str        # "33pct" | "50pct" | "75pct" | "pot"
    range_advantage: float
    nut_advantage: float
    pressure_score: float
    volatility_score: float
    equity_realization: float
    rationale: str


class _Modifier(NamedTuple):
    bet_delta: float = 0.0
    range_delta: float = 0.0
    nut_delta: float = 0.0
    pressure_delta: float = 0.0
    vol_delta: float = 0.0
    eq_real_delta: float = 0.0
    size_override: str | None = None  # overrides base sizing when set


# ── Base profiles by (spot_type, is_ip) ──────────────────────────────────────
# Calibrated for 8_PLUS SPR flop play on a neutral board.
# Board and SPR modifiers are applied on top.

_BASE: dict[tuple[str, bool], _BaseTemplate] = {
    ("SRP", True): _BaseTemplate(
        bet_frequency=0.62, check_frequency=0.38, primary_sizing="50pct",
        range_advantage=0.60, nut_advantage=0.58, pressure_score=0.50,
        volatility_score=0.50, equity_realization=0.68,
        rationale=(
            "SRP in position: range advantage allows frequent continuation "
            "on most textures"
        ),
    ),
    ("SRP", False): _BaseTemplate(
        bet_frequency=0.50, check_frequency=0.50, primary_sizing="33pct",
        range_advantage=0.55, nut_advantage=0.55, pressure_score=0.38,
        volatility_score=0.50, equity_realization=0.62,
        rationale=(
            "SRP out of position: range advantage present but positional "
            "disadvantage reduces optimal bet frequency"
        ),
    ),
    ("3BET", True): _BaseTemplate(
        bet_frequency=0.78, check_frequency=0.22, primary_sizing="33pct",
        range_advantage=0.75, nut_advantage=0.72, pressure_score=0.68,
        volatility_score=0.42, equity_realization=0.78,
        rationale=(
            "3bet pot IP: condensed calling range and strong equity advantage "
            "support high-frequency small bets"
        ),
    ),
    ("3BET", False): _BaseTemplate(
        bet_frequency=0.65, check_frequency=0.35, primary_sizing="33pct",
        range_advantage=0.70, nut_advantage=0.68, pressure_score=0.52,
        volatility_score=0.42, equity_realization=0.72,
        rationale=(
            "3bet pot OOP: strong range advantage but positional disadvantage "
            "requires more selectivity"
        ),
    ),
    ("4BET", True): _BaseTemplate(
        bet_frequency=0.90, check_frequency=0.10, primary_sizing="pot",
        range_advantage=0.85, nut_advantage=0.82, pressure_score=0.85,
        volatility_score=0.25, equity_realization=0.85,
        rationale=(
            "4bet pot IP: polarised ranges and very low SPR — near-mandatory "
            "commitment with value hands"
        ),
    ),
    ("4BET", False): _BaseTemplate(
        bet_frequency=0.85, check_frequency=0.15, primary_sizing="pot",
        range_advantage=0.80, nut_advantage=0.78, pressure_score=0.78,
        volatility_score=0.25, equity_realization=0.80,
        rationale=(
            "4bet pot OOP: extremely high commitment threshold — play for "
            "stacks with value, fold marginal holdings"
        ),
    ),
    ("LIMPED", True): _BaseTemplate(
        bet_frequency=0.58, check_frequency=0.42, primary_sizing="50pct",
        range_advantage=0.48, nut_advantage=0.45, pressure_score=0.42,
        volatility_score=0.55, equity_realization=0.62,
        rationale=(
            "Limped pot IP: no preflop range advantage — bet selectively "
            "based on board texture and hand strength"
        ),
    ),
    ("LIMPED", False): _BaseTemplate(
        bet_frequency=0.42, check_frequency=0.58, primary_sizing="50pct",
        range_advantage=0.42, nut_advantage=0.40, pressure_score=0.32,
        volatility_score=0.55, equity_realization=0.55,
        rationale=(
            "Limped pot OOP: no range advantage plus positional disadvantage — "
            "check-heavy approach is generally preferred"
        ),
    ),
    ("SQUEEZE", True): _BaseTemplate(
        bet_frequency=0.82, check_frequency=0.18, primary_sizing="33pct",
        range_advantage=0.78, nut_advantage=0.75, pressure_score=0.72,
        volatility_score=0.40, equity_realization=0.80,
        rationale=(
            "Squeeze pot IP: caller range is heavily capped — high-frequency "
            "small bets are well-supported"
        ),
    ),
    ("SQUEEZE", False): _BaseTemplate(
        bet_frequency=0.68, check_frequency=0.32, primary_sizing="33pct",
        range_advantage=0.72, nut_advantage=0.70, pressure_score=0.55,
        volatility_score=0.40, equity_realization=0.74,
        rationale=(
            "Squeeze pot OOP: strong range advantage but positional "
            "disadvantage warrants selective continuation"
        ),
    ),
    ("ISO_RAISE", True): _BaseTemplate(
        bet_frequency=0.65, check_frequency=0.35, primary_sizing="50pct",
        range_advantage=0.62, nut_advantage=0.58, pressure_score=0.52,
        volatility_score=0.48, equity_realization=0.68,
        rationale=(
            "Iso-raise pot IP: limper's range is capped — medium-frequency "
            "bets maintain pressure effectively"
        ),
    ),
    ("ISO_RAISE", False): _BaseTemplate(
        bet_frequency=0.52, check_frequency=0.48, primary_sizing="50pct",
        range_advantage=0.56, nut_advantage=0.52, pressure_score=0.40,
        volatility_score=0.48, equity_realization=0.62,
        rationale=(
            "Iso-raise pot OOP: range advantage present but acting first — "
            "balanced approach is generally appropriate"
        ),
    ),
    ("UNKNOWN", True): _BaseTemplate(
        bet_frequency=0.55, check_frequency=0.45, primary_sizing="50pct",
        range_advantage=0.50, nut_advantage=0.50, pressure_score=0.45,
        volatility_score=0.50, equity_realization=0.65,
        rationale="Unknown pot type IP: default balanced approach",
    ),
    ("UNKNOWN", False): _BaseTemplate(
        bet_frequency=0.48, check_frequency=0.52, primary_sizing="50pct",
        range_advantage=0.48, nut_advantage=0.48, pressure_score=0.38,
        volatility_score=0.50, equity_realization=0.60,
        rationale="Unknown pot type OOP: default conservative approach",
    ),
}


# ── Board class modifiers ─────────────────────────────────────────────────────
# All values are delta adjustments to the base profile.
# size_override: when set, replaces the base primary_sizing.

_BOARD_MODIFIERS: dict[str, _Modifier] = {
    "A_HIGH_DRY": _Modifier(
        bet_delta=+0.18, range_delta=+0.18, nut_delta=+0.12,
        pressure_delta=+0.10, vol_delta=-0.30, eq_real_delta=+0.08,
        size_override="33pct",
    ),
    "A_HIGH_WET": _Modifier(
        bet_delta=-0.08, range_delta=-0.02, nut_delta=+0.04,
        pressure_delta=-0.05, vol_delta=+0.15, eq_real_delta=-0.05,
        size_override="50pct",
    ),
    "K_HIGH_DRY": _Modifier(
        bet_delta=+0.16, range_delta=+0.12, nut_delta=+0.10,
        pressure_delta=+0.08, vol_delta=-0.28, eq_real_delta=+0.07,
        size_override="33pct",
    ),
    "K_HIGH_WET": _Modifier(
        bet_delta=-0.10, range_delta=-0.05, nut_delta=+0.00,
        pressure_delta=-0.08, vol_delta=+0.12, eq_real_delta=-0.05,
        size_override="50pct",
    ),
    "LOW_CONNECTED": _Modifier(
        bet_delta=-0.27, range_delta=-0.22, nut_delta=-0.16,
        pressure_delta=-0.20, vol_delta=+0.22, eq_real_delta=-0.12,
        size_override="50pct",
    ),
    "LOW_DYNAMIC": _Modifier(
        bet_delta=-0.32, range_delta=-0.28, nut_delta=-0.20,
        pressure_delta=-0.22, vol_delta=+0.30, eq_real_delta=-0.15,
        size_override="50pct",
    ),
    "MIDDLE_CONNECTED": _Modifier(
        bet_delta=-0.07, range_delta=-0.10, nut_delta=-0.06,
        pressure_delta=-0.10, vol_delta=+0.08, eq_real_delta=-0.05,
        size_override="50pct",
    ),
    "DOUBLE_BROADWAY": _Modifier(
        bet_delta=+0.08, range_delta=+0.08, nut_delta=+0.07,
        pressure_delta=+0.05, vol_delta=-0.15, eq_real_delta=+0.05,
        size_override="33pct",
    ),
    "TRIPLE_BROADWAY": _Modifier(
        bet_delta=+0.03, range_delta=+0.05, nut_delta=+0.04,
        pressure_delta=+0.02, vol_delta=-0.12, eq_real_delta=+0.03,
        size_override="33pct",
    ),
    "PAIRED_HIGH": _Modifier(
        bet_delta=+0.10, range_delta=+0.08, nut_delta=+0.07,
        pressure_delta=+0.05, vol_delta=-0.20, eq_real_delta=+0.05,
        size_override="33pct",
    ),
    "PAIRED_LOW": _Modifier(
        bet_delta=+0.06, range_delta=+0.00, nut_delta=-0.02,
        pressure_delta=+0.00, vol_delta=-0.18, eq_real_delta=+0.04,
        size_override="33pct",
    ),
    "MONOTONE": _Modifier(
        bet_delta=-0.22, range_delta=-0.02, nut_delta=+0.05,
        pressure_delta=-0.15, vol_delta=+0.25, eq_real_delta=-0.08,
        size_override="33pct",
    ),
    "RAINBOW_STATIC": _Modifier(
        bet_delta=+0.13, range_delta=+0.10, nut_delta=+0.07,
        pressure_delta=+0.08, vol_delta=-0.25, eq_real_delta=+0.08,
        size_override="33pct",
    ),
    "RAINBOW_DYNAMIC": _Modifier(
        bet_delta=-0.05, range_delta=+0.00, nut_delta=+0.00,
        pressure_delta=-0.02, vol_delta=+0.05, eq_real_delta=-0.02,
        size_override="50pct",
    ),
    "FLUSH_COMPLETING": _Modifier(
        bet_delta=-0.15, range_delta=-0.02, nut_delta=+0.02,
        pressure_delta=-0.10, vol_delta=+0.20, eq_real_delta=-0.07,
        size_override="50pct",
    ),
    "STRAIGHT_COMPLETING": _Modifier(
        bet_delta=-0.18, range_delta=-0.05, nut_delta=-0.02,
        pressure_delta=-0.12, vol_delta=+0.18, eq_real_delta=-0.08,
        size_override="50pct",
    ),
    "NEUTRAL": _Modifier(),  # all zeros, no size override
}


# ── SPR bucket modifiers ──────────────────────────────────────────────────────
# Low SPR  → higher commitment, higher pressure, less volatility.
# High SPR → more maneuverability, higher volatility, better equity realization.

_SPR_MODIFIERS: dict[str, _Modifier] = {
    "0_2": _Modifier(
        bet_delta=+0.20, pressure_delta=+0.35,
        vol_delta=-0.15, eq_real_delta=-0.05,
    ),
    "2_4": _Modifier(
        bet_delta=+0.10, pressure_delta=+0.15,
        vol_delta=-0.05,
    ),
    "4_8": _Modifier(),    # baseline, no adjustment
    "8_PLUS": _Modifier(
        bet_delta=-0.05, pressure_delta=-0.05,
        vol_delta=+0.05, eq_real_delta=+0.05,
    ),
}

_DEFAULT_MOD = _Modifier()  # neutral fallback for unknown keys


def get_base_profile(spot_type: str, is_ip: bool) -> _BaseTemplate:
    key = (spot_type, is_ip)
    if key in _BASE:
        return _BASE[key]
    # Same-side fallback
    return _BASE[("UNKNOWN", is_ip)]


def get_board_modifier(board_class: str) -> _Modifier:
    return _BOARD_MODIFIERS.get(board_class, _DEFAULT_MOD)


def get_spr_modifier(spr_bucket: str) -> _Modifier:
    return _SPR_MODIFIERS.get(spr_bucket, _DEFAULT_MOD)


def _clamp(v: float) -> float:
    return max(0.0, min(1.0, v))


def build_profile_dict(
    spot_type: str,
    is_ip: bool,
    spr_bucket: str,
    board_class: str,
) -> dict:
    """
    Combine base + board modifier + SPR modifier into a raw profile dict.

    All output values are clamped to [0.0, 1.0].
    bet_frequency + check_frequency always sum to 1.0.
    """
    base = get_base_profile(spot_type, is_ip)
    bmod = get_board_modifier(board_class)
    smod = get_spr_modifier(spr_bucket)

    bet_freq = _clamp(base.bet_frequency + bmod.bet_delta + smod.bet_delta)
    check_freq = _clamp(1.0 - bet_freq)  # ensure sum = 1.0

    sizing = bmod.size_override or base.primary_sizing

    return {
        "bet_frequency": round(bet_freq, 3),
        "check_frequency": round(check_freq, 3),
        "primary_sizing": sizing,
        "range_advantage": round(_clamp(base.range_advantage + bmod.range_delta), 3),
        "nut_advantage": round(_clamp(base.nut_advantage + bmod.nut_delta), 3),
        "pressure_score": round(
            _clamp(base.pressure_score + bmod.pressure_delta + smod.pressure_delta), 3
        ),
        "volatility_score": round(
            _clamp(base.volatility_score + bmod.vol_delta + smod.vol_delta), 3
        ),
        "equity_realization": round(
            _clamp(base.equity_realization + bmod.eq_real_delta + smod.eq_real_delta), 3
        ),
        "rationale": base.rationale,
    }
