"""
Pure utility functions for board classification and spot abstraction.

All functions are deterministic, stateless, and free of solver outputs,
EV calculations, or UI concerns.
"""

from __future__ import annotations

from collections import Counter
from typing import Optional

# ── Rank / suit constants ──────────────────────────────────────────────────────

RANK_TO_INT: dict[str, int] = {
    "2": 2,
    "3": 3,
    "4": 4,
    "5": 5,
    "6": 6,
    "7": 7,
    "8": 8,
    "9": 9,
    "T": 10,
    "J": 11,
    "Q": 12,
    "K": 13,
    "A": 14,
}

INT_TO_RANK: dict[int, str] = {v: k for k, v in RANK_TO_INT.items()}

BROADWAY_MIN = 10  # T, J, Q, K, A

VALID_SUITS = frozenset({"h", "d", "c", "s"})

# ── Card parsing ───────────────────────────────────────────────────────────────


def parse_card(card: str) -> tuple[str, str]:
    """
    Parse a card string such as 'Ah', 'Kd', '10h', 'Tc' into (rank, suit).

    Rank is normalised to upper-case; suit to lower-case.
    Raises ValueError for unrecognised ranks or suits.
    """
    card = card.strip()
    if len(card) < 2:
        raise ValueError(f"Card string too short: {card!r}")

    suit = card[-1].lower()
    rank = card[:-1].upper()

    # Normalise '10' → 'T'
    if rank == "10":
        rank = "T"

    if rank not in RANK_TO_INT:
        raise ValueError(f"Unknown rank {rank!r} in card {card!r}")
    if suit not in VALID_SUITS:
        raise ValueError(f"Unknown suit {suit!r} in card {card!r}")

    return rank, suit


def parse_board(cards: list[str]) -> tuple[list[str], list[str]]:
    """
    Parse a list of card strings into parallel (ranks, suits) lists.

    Returns:
        ranks: list of rank strings, e.g. ['A', 'K', '3']
        suits: list of suit chars,  e.g. ['h', 'd', 'c']
    """
    ranks: list[str] = []
    suits: list[str] = []
    for card in cards:
        r, s = parse_card(card)
        ranks.append(r)
        suits.append(s)
    return ranks, suits


# ── Rank helpers ───────────────────────────────────────────────────────────────


def rank_to_int(rank: str) -> int:
    """Convert a rank string to its integer value (A=14)."""
    return RANK_TO_INT[rank.upper()]


def get_rank_ints(ranks: list[str]) -> list[int]:
    return [rank_to_int(r) for r in ranks]


def count_broadways(ranks: list[str]) -> int:
    """Count how many cards are broadway (T, J, Q, K, A)."""
    return sum(1 for r in ranks if rank_to_int(r) >= BROADWAY_MIN)


def high_card_rank(ranks: list[str]) -> Optional[str]:
    """Return the rank string of the highest card, or None if ranks is empty."""
    if not ranks:
        return None
    return max(ranks, key=rank_to_int)


# ── Pairedness ─────────────────────────────────────────────────────────────────


def detect_pairing(ranks: list[str]) -> tuple[bool, bool]:
    """
    Returns (paired, trips).

    paired: any rank appears ≥2 times
    trips:  any rank appears ≥3 times
    """
    counts = Counter(ranks)
    max_count = max(counts.values(), default=0)
    return max_count >= 2, max_count >= 3


def get_pair_rank(ranks: list[str]) -> Optional[str]:
    """
    Return the rank string of the first paired rank (highest count wins ties),
    or None if the board is unpaired.
    """
    counts = Counter(ranks)
    paired = [(r, c) for r, c in counts.items() if c >= 2]
    if not paired:
        return None
    # Return highest-ranked pair
    return max(paired, key=lambda rc: rank_to_int(rc[0]))[0]


# ── Suit texture ───────────────────────────────────────────────────────────────


def detect_monotone(suits: list[str]) -> bool:
    return len(set(suits)) == 1


def detect_two_tone(suits: list[str]) -> bool:
    return len(set(suits)) == 2


def detect_rainbow(suits: list[str]) -> bool:
    """All suits distinct (no suit repeated)."""
    return len(suits) == len(set(suits))


# ── Flush analysis ─────────────────────────────────────────────────────────────


def detect_flush_draw(suits: list[str]) -> tuple[bool, bool]:
    """
    Returns (flush_draw_possible, flush_completed).

    flush_draw_possible: ≥2 board cards share a suit.
      A player holding 2 cards of that suit has a flush draw.

    flush_completed: ≥3 board cards share a suit.
      A player holding 1 card of that suit has a made flush.
    """
    if not suits:
        return False, False
    max_suited = max(Counter(suits).values())
    return max_suited >= 2, max_suited >= 3


def dominant_suit(suits: list[str]) -> Optional[str]:
    """Return the suit with the most cards, or None if suits is empty."""
    if not suits:
        return None
    return Counter(suits).most_common(1)[0][0]


def suit_count_for(suits: list[str], suit: str) -> int:
    return suits.count(suit)


# ── Straight / connectivity analysis ──────────────────────────────────────────


def _ranks_in_window(rank_set: frozenset[int], start: int, width: int) -> int:
    """Count how many rank_set members fall within [start, start+width)."""
    return sum(1 for r in range(start, start + width) if r in rank_set)


def _best_window_count(rank_ints: list[int], window: int = 5) -> int:
    """Maximum number of board ranks that fit in any contiguous window of `window`."""
    if not rank_ints:
        return 0
    rank_set = frozenset(rank_ints)
    low = min(rank_ints)
    high = max(rank_ints)
    return max(
        _ranks_in_window(rank_set, start, window)
        for start in range(low, high + 1)
    )


def _extended_rank_ints(rank_ints: list[int]) -> list[int]:
    """Add A-low (1) when ace (14) is present, for wheel detection."""
    extended = list(rank_ints)
    if 14 in rank_ints:
        extended = [1] + extended
    return extended


def detect_straight_draws(rank_ints: list[int]) -> tuple[bool, bool]:
    """
    Returns (straight_draw_possible, straight_completed).

    straight_draw_possible: ≥2 board ranks in any 5-wide window
      (a hand can form a straight draw using those board cards).

    straight_completed: ≥5 board ranks form a complete straight
      (5 consecutive ranks present on the board itself).
      Practically only reachable on the river.
    """
    extended = _extended_rank_ints(rank_ints)
    draw = _best_window_count(extended, 5) >= 2
    completed = _best_window_count(extended, 5) >= 5
    return draw, completed


def detect_wheel_possible(rank_ints: list[int]) -> bool:
    """
    Returns True if ≥2 board cards belong to the wheel set {A, 2, 3, 4, 5},
    indicating wheel-draw interaction is present.
    """
    wheel_ints = {14, 2, 3, 4, 5}
    return len(set(rank_ints) & wheel_ints) >= 2


# ── Connectedness scoring ──────────────────────────────────────────────────────


def _min_span(rank_ints: list[int]) -> int:
    """
    Minimum rank span, considering A can be played low (rank 1) or high (14).
    Smaller span = more connected.
    """
    unique = sorted(set(rank_ints))
    if len(unique) <= 1:
        return 0

    span_high = unique[-1] - unique[0]

    # Try A as low
    if 14 in unique:
        a_low = sorted(1 if r == 14 else r for r in unique)
        span_low = a_low[-1] - a_low[0]
        return min(span_high, span_low)

    return span_high


def calculate_connectivity(rank_ints: list[int]) -> tuple[int, str]:
    """
    Compute a connectedness score (0–10) and a human-readable label.

    The score is based on the minimum rank span (A can be high or low)
    and the best 5-wide window count, so it captures both gap tightness
    and straight-draw density.

    Returns:
        (score: int, label: str)

    Score thresholds:
        10  extremely_connected   span ≤ 2   (QJT, 987)
         8  highly_connected      span ≤ 4   (T86, J97)
         6  connected             span ≤ 6   (T72 has span 8 so ≤6 is for real draws)
         4  semi_connected        span ≤ 8
         2  weakly_connected      span ≤ 11
         0  disconnected          span > 11
    """
    if not rank_ints or len(set(rank_ints)) <= 1:
        return 0, "disconnected"

    span = _min_span(rank_ints)

    # Bonus: if best window count is high, bump score
    window_count = _best_window_count(_extended_rank_ints(rank_ints), 5)

    if span <= 2:
        score, label = 10, "extremely_connected"
    elif span <= 4:
        score, label = 8, "highly_connected"
    elif span <= 6:
        score, label = 6, "connected"
    elif span <= 8:
        score, label = 4, "semi_connected"
    elif span <= 9:
        score, label = 2, "weakly_connected"
    else:                                   # span > 9 → isolated cards
        score, label = 0, "disconnected"

    # If all 3 (or more) cards fall in the same 5-wide window, bump one tier
    if window_count >= len(rank_ints) and score < 10:
        score = min(10, score + 2)

    return score, label


# ── Dynamic / static heuristics ───────────────────────────────────────────────


def is_dynamic(
    connectedness_score: int,
    flush_draw_possible: bool,
    straight_draw_possible: bool,
    broadway_count: int,
    high_rank_int: int,
) -> bool:
    """
    A board is dynamic when it has many changing runouts:
    — connected ranks create multiple straight-draw combinations
    — flush draws put many cards in play
    — low-to-middle boards have more relevant run-out variability

    A board is static when it is dry: disconnected, rainbow, no draws.
    """
    if connectedness_score >= 8:
        return True
    # Both draw types active simultaneously = genuine dynamism (e.g. 9h8h2c)
    if flush_draw_possible and straight_draw_possible:
        return True
    # Flush draw on a reasonably connected board (e.g. Kh9h8d)
    if flush_draw_possible and connectedness_score >= 6:
        return True

    return False


# ── Scare card detection ───────────────────────────────────────────────────────


def detect_scare_card(
    prev_ranks: list[str],
    prev_suits: list[str],
    new_rank: str,
    new_suit: str,
) -> bool:
    """
    Determine whether `new_rank`/`new_suit` is a scare card relative to
    the board that existed before it arrived.

    A card qualifies as a scare card when it:
      1. Is an overcard to every previous board card (shifts nut hand status).
      2. Completes a flush: the new card brings a suit to 3+ copies on the combined board.
      3. Completes or dramatically upgrades a straight: the new card raises the
         best 5-wide window count from ≤2 to ≥3.
      4. Is a high broadway (Q, K, A) arriving on a board with no prior broadway.
      5. Pairs a previous high card (Q+), creating unexpected sets / boat potentials.
    """
    new_rank_int = rank_to_int(new_rank)
    prev_rank_ints = get_rank_ints(prev_ranks)
    all_suits = prev_suits + [new_suit]

    # 1. Overcard to every previous card (and it's high enough to matter)
    if prev_rank_ints and new_rank_int > max(prev_rank_ints) and new_rank_int >= 10:
        return True

    # 2. Flush completion: new card brings a suit to 3+ copies
    new_suit_total = all_suits.count(new_suit)
    if new_suit_total >= 3 and prev_suits.count(new_suit) < 3:
        return True

    # 3. Straight upgrade: new card raises draw count (≤2 → ≥3 in a 5-wide window)
    prev_window = _best_window_count(_extended_rank_ints(prev_rank_ints), 5)
    all_rank_ints = prev_rank_ints + [new_rank_int]
    new_window = _best_window_count(_extended_rank_ints(all_rank_ints), 5)
    if prev_window <= 2 and new_window >= 3:
        return True

    # 6. Near-straight completion: board goes to 4+ cards in a 5-wide window
    #    (any single out now makes a straight — strong scare even if not an overcard)
    if new_window >= 4 and prev_window < 4:
        return True

    # 4. High broadway arriving on a non-broadway board
    if new_rank_int >= rank_to_int("Q") and count_broadways(prev_ranks) == 0:
        return True

    # 5. Pairs a previous high card (Q+) creating set / boat territory
    if new_rank in prev_ranks and new_rank_int >= rank_to_int("Q"):
        return True

    return False


# ── SPR and stack depth helpers ────────────────────────────────────────────────


def calculate_spr(effective_stack_bb: float, pot_bb: float) -> float:
    """
    Stack-to-pot ratio at the start of a postflop street.

    Returns 0.0 when pot_bb ≤ 0 to avoid division by zero.
    Result is rounded to 2 decimal places for stable bucketing.
    """
    if pot_bb <= 0:
        return 0.0
    return round(effective_stack_bb / pot_bb, 2)


def bucket_spr(spr: float) -> str:
    """
    Map a numeric SPR to a SPRBucket string value.

    Buckets:
        0_2    → commit territory  (SPR < 2)
        2_4    → low SPR           (2 ≤ SPR < 4)
        4_8    → medium SPR        (4 ≤ SPR < 8)
        8_PLUS → deep / high SPR   (SPR ≥ 8)

    Returns the SPRBucket string value rather than the enum instance
    to keep this module free of circular imports.
    """
    if spr < 2.0:
        return "0_2"
    if spr < 4.0:
        return "2_4"
    if spr < 8.0:
        return "4_8"
    return "8_PLUS"


def bucket_stack_depth(effective_stack_bb: float) -> str:
    """
    Map an effective stack (in BB) to a StackDepthBucket string value.

    Boundaries are intentionally wide to avoid spurious bucket changes
    from small rounding differences.

    Buckets:
        10bb       → ≤ 12 BB   (push/fold territory)
        20bb       → ≤ 25 BB   (shallow, limited post-flop)
        40bb       → ≤ 50 BB   (mid-stack)
        60bb       → ≤ 70 BB   (approaching standard depth)
        100bb      → ≤ 125 BB  (standard cash-game depth)
        150bb      → ≤ 175 BB  (deep)
        200bb_plus → > 175 BB  (very deep)

    Returns the StackDepthBucket string value to avoid circular imports.
    """
    if effective_stack_bb <= 12:
        return "10bb"
    if effective_stack_bb <= 25:
        return "20bb"
    if effective_stack_bb <= 50:
        return "40bb"
    if effective_stack_bb <= 70:
        return "60bb"
    if effective_stack_bb <= 125:
        return "100bb"
    if effective_stack_bb <= 175:
        return "150bb"
    return "200bb_plus"


# ── Position helpers ───────────────────────────────────────────────────────────

# Postflop position order: leftmost = most out-of-position, rightmost = most IP.
POSTFLOP_POSITION_ORDER: list[str] = [
    "SB", "BB", "UTG", "UTG+1", "UTG+2", "LJ", "HJ", "CO", "BTN",
]


def postflop_position_rank(position: str) -> int:
    """
    Return the postflop position rank (0 = most OOP, higher = more IP).
    Unknown positions return -1 so they sort before everything else.
    """
    try:
        return POSTFLOP_POSITION_ORDER.index(position)
    except ValueError:
        return -1


def normalize_position_for_matchup(position: str) -> str:
    """
    Sanitise a canonical position string for use inside a PositionMatchup key.

    'UTG+1' → 'UTG1', 'UTG+2' → 'UTG2', others pass through unchanged.
    """
    return position.replace("+", "")
