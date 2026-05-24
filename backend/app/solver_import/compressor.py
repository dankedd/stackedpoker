"""
Compressor — converts a normalized RawSolverNode into a StrategyNode.

compress_solver_node(node, node_key_str, is_ip) → StrategyNode

Responsibilities:
  1. Extract bet_frequency and check_frequency from action distribution.
  2. Derive primary_sizing from the dominant bet/raise action.
  3. Estimate GTO signals (range_advantage, nut_advantage, pressure_score,
     volatility_score, equity_realization) from combo-level data when
     available, or infer from node-level frequencies.
  4. Build a short rationale string for observability.

Signal derivation:
  - range_advantage:     estimated from bet_frequency (higher bet → IP range advantage)
                         If combo equity data is available, computed as mean equity.
  - nut_advantage:       if combo data exists, fraction of nuts (top 20% equity combos)
                         that bet; else proxied from range_advantage + 0.05.
  - pressure_score:      how often villain is denied equity — proxy: bet_frequency.
  - volatility_score:    how connected/dynamic the board is — not derivable from actions
                         alone; left at neutral (0.50) unless combo data shows variance.
  - equity_realization:  fraction of equity that can be realized — proxy from
                         mean equity of checking combos when available.

All signals are clamped to [0.0, 1.0]. Frequencies always sum to 1.0.
"""

from __future__ import annotations

from .models import RawSolverNode, RawAction, RawComboEntry
from app.strategy_db.models import StrategyNode

_GTO_PLUS_SOURCE  = "gto_plus"
_DEFAULT_VERSION  = "2.0"   # solver imports get a higher version than handcrafted seeds


# ── Action helpers ────────────────────────────────────────────────────────────

def _bet_frequency(actions: list[RawAction]) -> float:
    """Sum of frequencies for all bet/raise actions."""
    return sum(
        a.frequency for a in actions
        if a.action_name.startswith("bet_") or a.action_name.startswith("raise_")
    )


def _check_frequency(actions: list[RawAction]) -> float:
    """Sum of frequencies for check/call actions."""
    return sum(
        a.frequency for a in actions
        if a.action_name in {"check", "call"}
    )


def _primary_sizing(actions: list[RawAction]) -> str | None:
    """Return the action_name of the highest-frequency bet/raise action."""
    bet_actions = [
        a for a in actions
        if a.action_name.startswith("bet_") or a.action_name.startswith("raise_")
    ]
    if not bet_actions:
        return None
    return max(bet_actions, key=lambda a: a.frequency).action_name


def _clamp(v: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, v))


# ── Signal estimation from combo data ────────────────────────────────────────

def _mean_equity(combos: list[RawComboEntry]) -> float | None:
    """Average equity across all combos that have equity data."""
    equities = [c.equity for c in combos if c.equity is not None]
    if not equities:
        return None
    return sum(equities) / len(equities)


def _nut_advantage_from_combos(combos: list[RawComboEntry], bet_action_prefix: str = "bet_") -> float | None:
    """
    Fraction of nut combos (top-20% by equity) that bet.

    Returns None if insufficient combo data.
    """
    combos_with_eq = [c for c in combos if c.equity is not None]
    if len(combos_with_eq) < 5:
        return None

    combos_sorted = sorted(combos_with_eq, key=lambda c: c.equity, reverse=True)  # type: ignore[arg-type]
    top_n = max(1, len(combos_sorted) // 5)
    nut_combos = combos_sorted[:top_n]

    if not nut_combos:
        return None

    bet_rates = []
    for combo in nut_combos:
        bet_freq = sum(
            a.frequency for a in combo.actions
            if a.action_name.startswith(bet_action_prefix)
        )
        bet_rates.append(bet_freq)

    return sum(bet_rates) / len(bet_rates)


def _equity_realization_from_combos(combos: list[RawComboEntry]) -> float | None:
    """
    Estimate equity realization as mean equity of check-preferred combos.

    This approximates how well the OOP / passive player can realize equity.
    """
    check_dominant = [
        c for c in combos
        if any(
            a.action_name == "check" and a.frequency >= 0.5
            for a in c.actions
        ) and c.equity is not None
    ]
    if not check_dominant:
        return None
    return sum(c.equity for c in check_dominant) / len(check_dominant)  # type: ignore[misc]


# ── Inference from node-level data only ──────────────────────────────────────

def _infer_signals_from_freq(bet_freq: float) -> dict[str, float]:
    """
    Infer strategy signals from bet frequency alone (no combo data).

    These are rough proxies — less accurate than combo-derived values.
    """
    # Higher bet freq → stronger range advantage assumed
    range_adv = _clamp(0.40 + bet_freq * 0.45)
    nut_adv   = _clamp(range_adv + 0.05)
    pressure  = _clamp(bet_freq * 0.85 + 0.10)
    return {
        "range_advantage":    range_adv,
        "nut_advantage":      nut_adv,
        "pressure_score":     pressure,
        "volatility_score":   0.50,   # unknown without board features
        "equity_realization": 0.65,   # neutral fallback
    }


# ── Public API ────────────────────────────────────────────────────────────────

def compress_solver_node(
    node: RawSolverNode,
    node_key_str: str,
    is_ip: bool,
) -> StrategyNode:
    """
    Compress a normalized RawSolverNode into a StrategyNode for the strategy DB.

    Args:
        node:         A validated, normalized RawSolverNode.
        node_key_str: The canonical node key string (from mapper).
        is_ip:        Whether this node represents the IP player's strategy.

    Returns:
        A StrategyNode ready for StrategyStore.register_strategy().
    """
    actions = node.actions
    combos  = node.combos

    # ── Frequencies ──────────────────────────────────────────────────────────
    raw_bet   = _bet_frequency(actions)
    raw_check = _check_frequency(actions)

    # Normalize to ensure exact sum of 1.0
    total = raw_bet + raw_check
    if total > 0:
        bet_freq   = _clamp(raw_bet / total)
        check_freq = _clamp(1.0 - bet_freq)
    else:
        bet_freq   = 0.50
        check_freq = 0.50

    # ── Primary sizing ────────────────────────────────────────────────────────
    sizing = _primary_sizing(actions)

    # ── Strategy signals ──────────────────────────────────────────────────────
    if combos:
        mean_eq    = _mean_equity(combos)
        nut_adv    = _nut_advantage_from_combos(combos)
        eq_real    = _equity_realization_from_combos(combos)
        range_adv  = _clamp(mean_eq if mean_eq is not None else 0.40 + bet_freq * 0.35)
        nut_adv    = _clamp(nut_adv if nut_adv is not None else range_adv + 0.05)
        pressure   = _clamp(bet_freq * 0.90 + 0.08)
        eq_real    = _clamp(eq_real if eq_real is not None else 0.65)
        volatility = 0.50   # board volatility not derivable from action data alone
    else:
        signals    = _infer_signals_from_freq(bet_freq)
        range_adv  = signals["range_advantage"]
        nut_adv    = signals["nut_advantage"]
        pressure   = signals["pressure_score"]
        volatility = signals["volatility_score"]
        eq_real    = signals["equity_realization"]

    # ── Rationale ─────────────────────────────────────────────────────────────
    sizing_label = sizing or "mixed"
    source_desc  = "combo-level" if combos else "node-level"
    rationale = (
        f"GTO+ solve ({source_desc}): bet {bet_freq:.0%} | "
        f"primary sizing {sizing_label} | "
        f"range adv {range_adv:.2f}"
    )

    # ── Parse identity fields from node_key_str ───────────────────────────────
    # Format: spot_type::matchup::stack_depth::spr_bucket::board_class::street::Np
    parts = node_key_str.split("::")
    spot_type         = parts[0] if len(parts) > 0 else node.spot_type
    position_matchup  = parts[1] if len(parts) > 1 else "BTN_vs_BB"
    stack_depth       = parts[2] if len(parts) > 2 else "100bb"
    spr_bucket        = parts[3] if len(parts) > 3 else "8_PLUS"
    board_class       = parts[4] if len(parts) > 4 else "NEUTRAL"
    street            = parts[5] if len(parts) > 5 else node.street
    player_count_str  = parts[6].rstrip("p") if len(parts) > 6 else "2"

    return StrategyNode(
        node_key=node_key_str,
        spot_type=spot_type,
        board_class=board_class,
        spr_bucket=spr_bucket,
        stack_depth_bucket=stack_depth,
        position_matchup=position_matchup,
        street=street,
        player_count=int(player_count_str),
        is_ip=is_ip,
        bet_frequency=bet_freq,
        check_frequency=check_freq,
        primary_sizing=sizing,
        range_advantage=range_adv,
        nut_advantage=nut_adv,
        pressure_score=pressure,
        volatility_score=volatility,
        equity_realization=eq_real,
        rationale=rationale,
        source=_GTO_PLUS_SOURCE,
        version=_DEFAULT_VERSION,
    )
