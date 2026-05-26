"""
Population analysis — detects pool-level leaks for exploitative coaching.

Separates three distinct coaching modes:
  1. PURE GTO — what the solver says (always available)
  2. EXPLOITATIVE — adjustments based on population tendencies
  3. CONFIDENCE-GATED — exploits only recommended when sample size is sufficient

Population model:
  Tracks aggregate tendencies from all analyzed hands:
  - Average c-bet frequency by position and board texture
  - Fold-to-cbet frequency
  - 3-bet frequency
  - Check-raise frequency
  - River bluff frequency

Exploit recommendations:
  Only generated when:
  - Population deviation from GTO exceeds a threshold (>10% off equilibrium)
  - Sample size exceeds minimum (>50 observations for that spot)
  - Exploit EV is positive with >90% confidence

Safety principle:
  Bad exploitative advice is WORSE than no advice. When in doubt,
  recommend GTO. Never recommend exploits without evidence.
"""

from __future__ import annotations

import logging
import math
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)

# Minimum observations before recommending exploits
_MIN_SAMPLE_SIZE = 50
_MIN_CONFIDENCE = 0.90

# Deviation thresholds (absolute % difference from GTO)
_EXPLOIT_THRESHOLD = 0.10   # 10% deviation from equilibrium


@dataclass
class PopulationTendency:
    """Aggregate tendency for a specific spot type."""
    spot_key: str                       # "SRP_flop_cbet_BTN_vs_BB"
    action: str                         # "bet", "fold", "raise"
    population_frequency: float         # Observed frequency [0,1]
    gto_frequency: float                # Solver equilibrium frequency [0,1]
    deviation: float = 0.0             # population - gto (positive = over-uses)
    sample_size: int = 0
    confidence: float = 0.0


@dataclass
class ExploitRecommendation:
    """A recommended adjustment based on population deviation."""
    description: str                    # Human-readable recommendation
    adjustment: str                     # "bet_more", "fold_more", "raise_more", etc.
    target_tendency: PopulationTendency
    expected_ev_gain_bb: float = 0.0   # Estimated EV gain from the exploit
    confidence: float = 0.0            # How confident we are in this exploit
    risk_level: str = "low"            # "low", "medium", "high"
    concept_tags: list[str] = field(default_factory=list)


class PopulationModel:
    """
    Tracks aggregate population tendencies.

    In production, this would be backed by PostgreSQL aggregates.
    For MVP, uses in-memory accumulators.
    """

    def __init__(self) -> None:
        # Accumulators: spot_key → {action → (total_freq_sum, count)}
        self._accumulators: dict[str, dict[str, tuple[float, int]]] = {}

    def record_observation(
        self,
        spot_key: str,
        action: str,
        was_taken: bool,
    ) -> None:
        """Record a single observation from a hand analysis."""
        if spot_key not in self._accumulators:
            self._accumulators[spot_key] = {}
        if action not in self._accumulators[spot_key]:
            self._accumulators[spot_key][action] = (0.0, 0)

        freq_sum, count = self._accumulators[spot_key][action]
        self._accumulators[spot_key][action] = (
            freq_sum + (1.0 if was_taken else 0.0),
            count + 1,
        )

    def get_tendency(
        self,
        spot_key: str,
        action: str,
        gto_frequency: float,
    ) -> PopulationTendency:
        """Get the population tendency for a specific spot and action."""
        acc = self._accumulators.get(spot_key, {}).get(action, (0.0, 0))
        freq_sum, count = acc
        pop_freq = freq_sum / count if count > 0 else gto_frequency
        deviation = pop_freq - gto_frequency

        # Confidence: binomial confidence interval
        confidence = _binomial_confidence(count, pop_freq)

        return PopulationTendency(
            spot_key=spot_key,
            action=action,
            population_frequency=round(pop_freq, 3),
            gto_frequency=round(gto_frequency, 3),
            deviation=round(deviation, 3),
            sample_size=count,
            confidence=round(confidence, 3),
        )

    def recommend_exploits(
        self,
        spot_key: str,
        gto_distribution: dict[str, float],
    ) -> list[ExploitRecommendation]:
        """
        Generate exploit recommendations for a spot based on population deviations.

        Only recommends exploits that meet confidence and deviation thresholds.
        """
        recommendations = []

        for action, gto_freq in gto_distribution.items():
            tendency = self.get_tendency(spot_key, action, gto_freq)

            if tendency.sample_size < _MIN_SAMPLE_SIZE:
                continue
            if tendency.confidence < _MIN_CONFIDENCE:
                continue
            if abs(tendency.deviation) < _EXPLOIT_THRESHOLD:
                continue

            exploit = _generate_exploit(tendency)
            if exploit:
                recommendations.append(exploit)

        recommendations.sort(key=lambda r: -r.expected_ev_gain_bb)
        return recommendations


def _binomial_confidence(n: int, p: float) -> float:
    """
    Confidence level for a binomial proportion estimate.

    Uses Wilson score interval width as a proxy for confidence.
    Higher n and extreme p → higher confidence.
    """
    if n < 10:
        return 0.0
    if n < 30:
        return 0.5

    z = 1.96  # 95% CI
    denominator = 1 + z * z / n
    centre = (p + z * z / (2 * n)) / denominator
    margin = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / denominator

    # Confidence inversely proportional to margin width
    confidence = max(0.0, min(1.0, 1.0 - margin * 4))
    return confidence


def _generate_exploit(tendency: PopulationTendency) -> ExploitRecommendation | None:
    """Generate a specific exploit recommendation from a population deviation."""
    dev = tendency.deviation
    action = tendency.action

    if action == "fold" and dev > _EXPLOIT_THRESHOLD:
        # Population folds too much → bluff more
        ev_gain = dev * 2.0  # Rough estimate: each 10% over-fold = 0.2bb EV
        return ExploitRecommendation(
            description=(
                f"Population folds {tendency.population_frequency:.0%} vs GTO "
                f"{tendency.gto_frequency:.0%}. Increase bluff frequency."
            ),
            adjustment="bluff_more",
            target_tendency=tendency,
            expected_ev_gain_bb=round(ev_gain, 2),
            confidence=tendency.confidence,
            risk_level="low",
            concept_tags=["alpha", "exploit_overfold"],
        )

    if action == "fold" and dev < -_EXPLOIT_THRESHOLD:
        # Population doesn't fold enough → value bet thinner
        ev_gain = abs(dev) * 1.5
        return ExploitRecommendation(
            description=(
                f"Population folds only {tendency.population_frequency:.0%} vs GTO "
                f"{tendency.gto_frequency:.0%}. Value bet thinner, bluff less."
            ),
            adjustment="value_bet_thin",
            target_tendency=tendency,
            expected_ev_gain_bb=round(ev_gain, 2),
            confidence=tendency.confidence,
            risk_level="low",
            concept_tags=["exploit_underfold"],
        )

    if action == "bet" and dev > _EXPLOIT_THRESHOLD:
        # Population bets too much → call/raise more
        ev_gain = dev * 1.5
        return ExploitRecommendation(
            description=(
                f"Population bets {tendency.population_frequency:.0%} vs GTO "
                f"{tendency.gto_frequency:.0%}. Call wider and raise more for value."
            ),
            adjustment="defend_wider",
            target_tendency=tendency,
            expected_ev_gain_bb=round(ev_gain, 2),
            confidence=tendency.confidence,
            risk_level="medium",
            concept_tags=["mdf", "exploit_overbet"],
        )

    if action == "bet" and dev < -_EXPLOIT_THRESHOLD:
        # Population doesn't bet enough → steal more pots
        ev_gain = abs(dev) * 1.0
        return ExploitRecommendation(
            description=(
                f"Population bets only {tendency.population_frequency:.0%} vs GTO "
                f"{tendency.gto_frequency:.0%}. Probe bet and steal more pots."
            ),
            adjustment="probe_bet",
            target_tendency=tendency,
            expected_ev_gain_bb=round(ev_gain, 2),
            confidence=tendency.confidence,
            risk_level="medium",
            concept_tags=["exploit_passive"],
        )

    return None
