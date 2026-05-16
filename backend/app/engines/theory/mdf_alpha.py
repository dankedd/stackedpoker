"""
MDF / Alpha / Bluff-Value Mathematics
======================================
These are original implementations of standard poker mathematics that are
facts of game theory — not copyrightable content.

Key formulas:
  Alpha (break-even fold frequency)  = b / (b + p)
  MDF  (minimum defense frequency)   = 1 - alpha = p / (b + p)
  Bluff-to-value ratio (river)       = alpha : (1 - alpha)  →  1 bluff per (1/alpha - 1) value

All derivations trace back to basic EV equations taught in game theory,
first formalized in poker contexts by researchers studying Nash equilibrium
in betting games.
"""

from __future__ import annotations


def alpha(bet_size: float, pot_size: float) -> float:
    """
    Alpha — the fraction of the time a pure bluff (0% equity) needs to succeed
    to break even.

    Formula: alpha = b / (b + p)

    Args:
        bet_size: Amount of the bet (in any unit, e.g. BB)
        pot_size: Size of the pot BEFORE the bet

    Returns:
        float in [0, 1] — required fold frequency for bluff to break even

    Examples:
        >>> alpha(50, 100)   # half-pot bet
        0.333...             # bluff needs to work 33% to break even
        >>> alpha(100, 100)  # pot-size bet
        0.5                  # bluff needs to work 50% to break even
        >>> alpha(200, 100)  # 2x pot overbet
        0.666...             # bluff needs to work 67% to break even
    """
    if pot_size <= 0 or bet_size < 0:
        raise ValueError("pot_size must be positive; bet_size must be non-negative")
    return bet_size / (bet_size + pot_size)


def mdf(bet_size: float, pot_size: float) -> float:
    """
    MDF — Minimum Defense Frequency.
    The fraction of a defending range that must continue (call or raise)
    to prevent the bettor from profiting with a pure bluff (0% equity).

    Formula: MDF = 1 - alpha = p / (b + p)

    This is the complement of alpha. If the defender folds more than alpha,
    the bettor can profitably bluff with any two cards.

    Args:
        bet_size: Amount of the bet
        pot_size: Size of the pot BEFORE the bet

    Returns:
        float in [0, 1] — minimum fraction of range that must continue
    """
    return 1.0 - alpha(bet_size, pot_size)


def bluff_value_ratio(bet_size: float, pot_size: float) -> tuple[float, float]:
    """
    River bluff-to-value ratio for a balanced betting range.

    At equilibrium on the river, a balanced bettor uses alpha bluffs
    for every (1 - alpha) value hands. Expressed as a ratio:
        bluffs : value = alpha : (1 - alpha)

    This makes the caller indifferent between calling and folding.

    Args:
        bet_size: Amount of the bet
        pot_size: Size of the pot BEFORE the bet

    Returns:
        (bluff_fraction, value_fraction) — fractions summing to 1.0
        e.g. (0.333, 0.667) means 1 bluff per 2 value bets (pot-size bet)

    Examples:
        Half-pot bet (alpha=0.333): 1 bluff per 2 value combos
        Pot-size bet (alpha=0.500): 1 bluff per 1 value combo
        2x overbet  (alpha=0.667): 2 bluffs per 1 value combo
    """
    a = alpha(bet_size, pot_size)
    return (a, 1.0 - a)


def required_fold_equity(
    bet_size: float,
    pot_size: float,
    hand_equity: float = 0.0,
    amount_at_risk: float | None = None,
) -> float:
    """
    Required fold equity for a semi-bluff to be break-even.

    For a pure bluff (hand_equity=0) this equals alpha exactly.
    For a semi-bluff, the hand's equity reduces the required fold equity
    because even when called, the hand wins some fraction of the time.

    General formula:
        FE_required = (alpha - hand_equity) / (1 - hand_equity)

    Args:
        bet_size:      Size of the bet/raise
        pot_size:      Pot size before the bet
        hand_equity:   Hero's equity when called (0.0 for pure bluff)
        amount_at_risk: For raises, total new money hero puts in (defaults to bet_size)

    Returns:
        Minimum fold frequency needed for the play to break even (0–1).
        Negative values mean the play is profitable regardless of fold equity.
    """
    if amount_at_risk is None:
        amount_at_risk = bet_size

    a = alpha(amount_at_risk, pot_size)
    if hand_equity >= 1.0:
        return 0.0
    required = (a - hand_equity) / (1.0 - hand_equity)
    return max(0.0, required)


def multiway_alpha(bet_size: float, pot_size: float, opponents: int) -> float:
    """
    Alpha adjusted for multiway pots.

    In multiway pots, each opponent must fold individually.
    The combined fold frequency needed = alpha, so each player must fold:
        alpha_per_player = alpha ^ (1/opponents)

    Args:
        bet_size:   Size of the bet
        pot_size:   Pot before the bet
        opponents:  Number of players who still need to fold

    Returns:
        Required individual fold frequency per opponent
    """
    if opponents <= 0:
        raise ValueError("opponents must be >= 1")
    if opponents == 1:
        return alpha(bet_size, pot_size)
    return alpha(bet_size, pot_size) ** (1.0 / opponents)


def ev_of_call(
    pot_size: float,
    call_amount: float,
    win_equity: float,
    lose_equity: float | None = None,
) -> float:
    """
    EV of calling a bet.

    EV_call = (win_equity × pot_after_call) - (lose_equity × call_amount)

    Args:
        pot_size:     Pot before call
        call_amount:  Amount hero must call
        win_equity:   Hero's probability of winning
        lose_equity:  Hero's probability of losing (defaults to 1 - win_equity)

    Returns:
        EV of calling in the same unit as pot_size/call_amount
    """
    if lose_equity is None:
        lose_equity = 1.0 - win_equity
    pot_after = pot_size + call_amount
    return (win_equity * pot_after) - (lose_equity * call_amount)


def pot_odds_percent(pot_size: float, call_amount: float) -> float:
    """
    Pot odds expressed as a percentage — minimum equity needed to call profitably.

    Formula: call / (pot + call)

    Args:
        pot_size:    Pot before call
        call_amount: Amount to call

    Returns:
        float in [0, 1] — minimum win equity to break even on call
    """
    total = pot_size + call_amount
    return call_amount / total if total > 0 else 0.0


def outs_to_equity_turn(outs: int) -> float:
    """Approximate equity from outs on the turn (one card to come)."""
    return outs * 2.0 / 100.0  # ~2% per out


def outs_to_equity_flop(outs: int) -> float:
    """Approximate equity from outs on the flop (two cards to come)."""
    return outs * 4.0 / 100.0  # ~4% per out (rule of 4)


BACKDOOR_FLUSH_EQUITY = 0.0426   # ~4.26% per backdoor flush draw
BACKDOOR_STRAIGHT_EQUITY = 0.0426  # ~4.26% per backdoor straight draw (3-card rundown)

# Commonly used alpha values for reference
ALPHA_TABLE = {
    "1/4_pot":  round(alpha(25, 100), 4),   # 0.2
    "1/3_pot":  round(alpha(33, 100), 4),   # 0.248
    "1/2_pot":  round(alpha(50, 100), 4),   # 0.333
    "2/3_pot":  round(alpha(67, 100), 4),   # 0.401
    "3/4_pot":  round(alpha(75, 100), 4),   # 0.429
    "pot":      round(alpha(100, 100), 4),  # 0.5
    "1.5x_pot": round(alpha(150, 100), 4),  # 0.6
    "2x_pot":   round(alpha(200, 100), 4),  # 0.667
}
