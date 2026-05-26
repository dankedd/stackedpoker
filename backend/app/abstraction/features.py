"""
Board feature vector extraction — numeric representation for similarity.

Converts any poker board into a fixed-length numeric vector that captures
all strategically relevant properties. Two boards with similar feature
vectors will have similar GTO strategies.

Feature dimensions (14 total):
  0. high_card       — normalized highest rank (0.0 = 2, 1.0 = A)
  1. mid_card        — normalized middle rank (flop) or second-highest
  2. low_card        — normalized lowest rank
  3. rank_span       — gap between highest and lowest rank, normalized
  4. connectedness   — how close cards are (0.0 = disconnected, 1.0 = gutshot-free)
  5. broadway_count  — fraction of cards that are T+ (0.0 to 1.0)
  6. paired          — 1.0 if board is paired, 0.0 otherwise
  7. trips           — 1.0 if board has trips, 0.0 otherwise
  8. monotone        — 1.0 if all same suit
  9. two_tone        — 1.0 if exactly two suits present
  10. flush_draw     — 1.0 if flush draw possible (≥2 of one suit)
  11. straight_draw  — 1.0 if straight draw exists
  12. dynamic_score  — composite dynamism score (0.0-1.0)
  13. scare_potential — how likely future cards change the board dramatically

Design notes:
  - All features normalized to [0.0, 1.0] for distance computation
  - Vector is suitable for cosine similarity, Euclidean distance, or learned metrics
  - ML-friendly: can be used directly as input to neural networks
  - Deterministic: same board always produces same vector
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field

from app.solver.utils import (
    parse_card,
    rank_to_int,
    count_broadways,
    detect_pairing,
    detect_monotone,
    detect_two_tone,
    detect_rainbow,
    detect_flush_draw,
    detect_straight_draws,
    calculate_connectivity,
    detect_wheel_possible,
)

# Normalization constants
_RANK_MIN = 2
_RANK_MAX = 14
_RANK_RANGE = _RANK_MAX - _RANK_MIN  # 12
_MAX_SPAN = 12  # A to 2
_VECTOR_DIM = 14

# Feature weights for similarity computation (sum to 1.0)
# These reflect how much each feature matters for GTO strategy similarity.
# Derived from poker theory: texture > rank structure > suit structure.
FEATURE_WEIGHTS = (
    0.10,   # 0. high_card — matters for range vs range equity
    0.06,   # 1. mid_card
    0.05,   # 2. low_card
    0.08,   # 3. rank_span — connected vs gapped
    0.14,   # 4. connectedness — critical for draw density
    0.09,   # 5. broadway_count — range interaction density
    0.10,   # 6. paired — fundamentally changes strategy
    0.03,   # 7. trips — rare, but extreme strategy change
    0.10,   # 8. monotone — dominates texture
    0.05,   # 9. two_tone
    0.07,   # 10. flush_draw — draw equity distribution
    0.06,   # 11. straight_draw
    0.05,   # 12. dynamic_score
    0.02,   # 13. scare_potential
)


def _normalize_rank(rank_int: int) -> float:
    """Normalize rank integer to [0.0, 1.0]."""
    return (rank_int - _RANK_MIN) / _RANK_RANGE


@dataclass(frozen=True)
class BoardFeatureVector:
    """
    Fixed-length numeric representation of a poker board.

    Immutable and hashable for use as cache keys.
    """
    values: tuple[float, ...]
    board_key: str = ""  # canonical board key for tracing

    def __post_init__(self) -> None:
        if len(self.values) != _VECTOR_DIM:
            raise ValueError(
                f"Feature vector must have {_VECTOR_DIM} dimensions, "
                f"got {len(self.values)}"
            )

    def __len__(self) -> int:
        return _VECTOR_DIM

    def __getitem__(self, idx: int) -> float:
        return self.values[idx]

    def to_list(self) -> list[float]:
        return list(self.values)

    @property
    def high_card(self) -> float:
        return self.values[0]

    @property
    def connectedness(self) -> float:
        return self.values[4]

    @property
    def paired(self) -> float:
        return self.values[6]

    @property
    def monotone(self) -> float:
        return self.values[8]


def extract_features(board: list[str]) -> BoardFeatureVector:
    """
    Extract a 14-dimensional feature vector from a board.

    Works for flop (3 cards), turn (4 cards), or river (5 cards).
    """
    if not board or len(board) < 3:
        return BoardFeatureVector(values=tuple([0.0] * _VECTOR_DIM))

    ranks = []
    suits = []
    for card in board:
        r, s = parse_card(card)
        ranks.append(r)
        suits.append(s)

    rank_ints = sorted([rank_to_int(r) for r in ranks], reverse=True)

    # ── Rank features ─────────────────────────────────────────────────────
    high_card = _normalize_rank(rank_ints[0])
    mid_card = _normalize_rank(rank_ints[1]) if len(rank_ints) > 1 else 0.0
    low_card = _normalize_rank(rank_ints[-1])
    rank_span = (rank_ints[0] - rank_ints[-1]) / _MAX_SPAN

    # Connectivity
    conn_score, _ = calculate_connectivity(rank_ints)
    connectedness = conn_score / 10.0

    # Broadway density
    bc = count_broadways(ranks)
    broadway_count = bc / len(board)

    # ── Pairing features ──────────────────────────────────────────────────
    is_paired, is_trips = detect_pairing(ranks)
    paired = 1.0 if is_paired else 0.0
    trips = 1.0 if is_trips else 0.0

    # ── Suit features ─────────────────────────────────────────────────────
    is_monotone = detect_monotone(suits)
    is_two_tone = detect_two_tone(suits)
    monotone_f = 1.0 if is_monotone else 0.0
    two_tone_f = 1.0 if is_two_tone else 0.0

    flush_draw_possible, flush_completed = detect_flush_draw(suits)
    flush_draw = 1.0 if (flush_draw_possible or flush_completed) else 0.0

    # ── Draw features ─────────────────────────────────────────────────────
    straight_draw_possible, _ = detect_straight_draws(rank_ints)
    straight_draw = 1.0 if straight_draw_possible else 0.0

    # ── Composite scores ──────────────────────────────────────────────────
    # Dynamic score: how much do draws and connections interact?
    draw_count = sum([
        flush_draw_possible,
        straight_draw_possible,
        detect_wheel_possible(rank_ints),
    ])
    dynamic_score = min(1.0, (
        connectedness * 0.35
        + (draw_count / 3.0) * 0.35
        + (1.0 - paired) * 0.15  # Unpaired boards are more dynamic
        + broadway_count * 0.15
    ))

    # Scare potential: how likely are future cards to be scary?
    # High when board is already connected/flushy — more completions possible
    scare_potential = min(1.0, (
        flush_draw * 0.3
        + straight_draw * 0.3
        + connectedness * 0.2
        + (1.0 - rank_span) * 0.2  # Tighter boards → more scary cards
    ))

    vector = (
        high_card,
        mid_card,
        low_card,
        rank_span,
        connectedness,
        broadway_count,
        paired,
        trips,
        monotone_f,
        two_tone_f,
        flush_draw,
        straight_draw,
        dynamic_score,
        scare_potential,
    )

    from .canonical import fast_canonical_key
    board_key = fast_canonical_key(board)

    return BoardFeatureVector(values=vector, board_key=board_key)


def weighted_euclidean_distance(
    a: BoardFeatureVector,
    b: BoardFeatureVector,
    weights: tuple[float, ...] = FEATURE_WEIGHTS,
) -> float:
    """
    Weighted Euclidean distance between two feature vectors.

    Lower = more similar. Returns 0.0 for identical vectors.
    Maximum theoretical distance is 1.0 (all features at opposite extremes).
    """
    total = 0.0
    for i in range(_VECTOR_DIM):
        diff = a.values[i] - b.values[i]
        total += weights[i] * diff * diff
    return math.sqrt(total)


def feature_similarity(
    a: BoardFeatureVector,
    b: BoardFeatureVector,
    weights: tuple[float, ...] = FEATURE_WEIGHTS,
) -> float:
    """
    Similarity score between two boards based on feature vectors.

    Returns [0.0, 1.0] where 1.0 = identical features.
    Uses exponential decay of weighted distance for smooth falloff.
    """
    dist = weighted_euclidean_distance(a, b, weights)
    # Exponential decay: similarity = e^(-k * distance)
    # k=6 gives ~0.55 at distance=0.1, ~0.30 at distance=0.2
    return math.exp(-6.0 * dist)


def cosine_similarity(
    a: BoardFeatureVector,
    b: BoardFeatureVector,
) -> float:
    """
    Cosine similarity between two feature vectors.

    Returns [-1.0, 1.0] where 1.0 = identical direction.
    Useful for ML embeddings where magnitude doesn't matter.
    """
    dot = sum(a.values[i] * b.values[i] for i in range(_VECTOR_DIM))
    mag_a = math.sqrt(sum(v * v for v in a.values))
    mag_b = math.sqrt(sum(v * v for v in b.values))
    if mag_a < 1e-10 or mag_b < 1e-10:
        return 0.0
    return dot / (mag_a * mag_b)
