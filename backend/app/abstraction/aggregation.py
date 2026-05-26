"""
Strategy aggregation — merging similar solves and frequency smoothing.

When multiple solves exist for a cluster (e.g., multiple representative boards
or different solver runs), this module combines them into a single coherent
strategy for retrieval.

Techniques:
  1. Weighted frequency averaging — weight by proximity to query board
  2. Frequency smoothing — prevent noisy 0% / 100% at cluster boundaries
  3. Confidence-weighted merging — higher-confidence solves dominate
  4. Action consolidation — group similar sizing into action categories

Design for ML compatibility:
  Aggregated strategies produce clean training targets for future neural
  network distillation. The output format is directly usable as policy labels.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field

from app.strategy_db.models import StrategyNode


@dataclass
class AggregatedStrategy:
    """
    Merged strategy from multiple similar solves.

    Suitable as a retrieval result or ML training target.
    """
    # Frequencies (sum to 1.0)
    bet_frequency: float = 0.0
    check_frequency: float = 0.0
    fold_frequency: float = 0.0
    call_frequency: float = 0.0
    raise_frequency: float = 0.0

    # Preferred action
    primary_action: str = "check"
    primary_sizing: str | None = None

    # Strategic signals
    range_advantage: float = 0.5
    nut_advantage: float = 0.5
    pressure_score: float = 0.5
    equity_realization: float = 0.5

    # Aggregation metadata
    sources: int = 0                  # Number of solves that contributed
    avg_similarity: float = 0.0       # Average similarity of contributing solves
    confidence: float = 0.0           # Overall confidence in this aggregation

    # Provenance
    source_ids: list[str] = field(default_factory=list)
    rationale: str = ""

    def action_distribution(self) -> dict[str, float]:
        """Clean action distribution for UI display."""
        dist = {}
        if self.bet_frequency > 0.01:
            dist["bet"] = round(self.bet_frequency, 3)
        if self.check_frequency > 0.01:
            dist["check"] = round(self.check_frequency, 3)
        if self.fold_frequency > 0.01:
            dist["fold"] = round(self.fold_frequency, 3)
        if self.call_frequency > 0.01:
            dist["call"] = round(self.call_frequency, 3)
        if self.raise_frequency > 0.01:
            dist["raise"] = round(self.raise_frequency, 3)
        return dist

    def to_feature_dict(self) -> dict[str, float]:
        """
        Export as flat feature dict for ML training.

        This is the format neural networks will consume.
        """
        return {
            "bet_freq": self.bet_frequency,
            "check_freq": self.check_frequency,
            "fold_freq": self.fold_frequency,
            "call_freq": self.call_frequency,
            "raise_freq": self.raise_frequency,
            "range_advantage": self.range_advantage,
            "nut_advantage": self.nut_advantage,
            "pressure_score": self.pressure_score,
            "equity_realization": self.equity_realization,
            "confidence": self.confidence,
        }


def aggregate_strategies(
    nodes: list[tuple[StrategyNode, float]],
    smoothing: float = 0.02,
) -> AggregatedStrategy:
    """
    Merge multiple strategy nodes into a single aggregated strategy.

    Args:
        nodes: List of (StrategyNode, similarity_weight) tuples.
               Higher weight = this solve is more relevant to the query.
        smoothing: Minimum frequency floor to prevent hard 0% actions.
                   0.02 = 2% floor on all actions.

    Returns:
        AggregatedStrategy with weighted-average frequencies.
    """
    if not nodes:
        return AggregatedStrategy(
            check_frequency=1.0,
            primary_action="check",
            confidence=0.0,
            rationale="No solves available",
        )

    # Normalize weights
    total_weight = sum(w for _, w in nodes)
    if total_weight < 1e-10:
        total_weight = 1.0

    # Weighted average of all strategy fields
    agg = AggregatedStrategy(sources=len(nodes))
    weight_sum_sim = 0.0

    for node, weight in nodes:
        w = weight / total_weight

        agg.bet_frequency += node.bet_frequency * w
        agg.check_frequency += node.check_frequency * w
        agg.range_advantage += node.range_advantage * w
        agg.nut_advantage += node.nut_advantage * w
        agg.pressure_score += node.pressure_score * w
        agg.equity_realization += node.equity_realization * w

        weight_sum_sim += weight
        agg.source_ids.append(node.extended_key)

    agg.avg_similarity = weight_sum_sim / len(nodes)

    # ── Frequency smoothing ───────────────────────────────────────────────
    # Apply minimum floor, then renormalize to 1.0
    bet = max(agg.bet_frequency, smoothing if agg.bet_frequency > 0.005 else 0.0)
    check = max(agg.check_frequency, smoothing if agg.check_frequency > 0.005 else 0.0)

    freq_total = bet + check
    if freq_total > 0:
        agg.bet_frequency = bet / freq_total
        agg.check_frequency = check / freq_total
    else:
        agg.check_frequency = 1.0

    # ── Primary action ────────────────────────────────────────────────────
    if agg.bet_frequency > agg.check_frequency:
        agg.primary_action = "bet"
        # Find most common sizing from contributing nodes
        sizing_votes: dict[str, float] = {}
        for node, weight in nodes:
            if node.primary_sizing:
                sizing_votes[node.primary_sizing] = (
                    sizing_votes.get(node.primary_sizing, 0) + weight
                )
        if sizing_votes:
            agg.primary_sizing = max(sizing_votes, key=sizing_votes.get)
    else:
        agg.primary_action = "check"

    # ── Confidence scoring ────────────────────────────────────────────────
    # Higher when: more sources, higher similarity, less variance
    source_factor = min(1.0, len(nodes) / 3.0)  # Saturates at 3 sources
    similarity_factor = agg.avg_similarity

    # Variance penalty: if sources disagree strongly, reduce confidence
    if len(nodes) > 1:
        bet_values = [n.bet_frequency for n, _ in nodes]
        variance = sum((v - agg.bet_frequency) ** 2 for v in bet_values) / len(bet_values)
        variance_penalty = max(0.0, 1.0 - math.sqrt(variance) * 3.0)
    else:
        variance_penalty = 1.0

    agg.confidence = min(1.0, source_factor * similarity_factor * variance_penalty)

    # Rationale
    sizing_str = f" | sizing {agg.primary_sizing}" if agg.primary_sizing else ""
    agg.rationale = (
        f"Aggregated from {len(nodes)} solves "
        f"(avg sim {agg.avg_similarity:.2f}, confidence {agg.confidence:.2f}) | "
        f"bet {agg.bet_frequency:.0%} check {agg.check_frequency:.0%}"
        f"{sizing_str}"
    )

    return agg


def merge_cluster_strategies(
    cluster_nodes: list[StrategyNode],
) -> AggregatedStrategy:
    """
    Merge all strategies within a cluster (equal weight).

    Used for precomputing cluster-level aggregate strategies.
    """
    pairs = [(node, 1.0) for node in cluster_nodes]
    return aggregate_strategies(pairs, smoothing=0.01)
