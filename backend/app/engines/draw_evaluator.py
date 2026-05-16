"""
Draw Evaluator — Mathematically correct draw classification for Texas Hold'em.

CLASSIFICATION RULES
====================

MADE HANDS (no draw needed):
  Uses hand_evaluator.py for exact category.

DIRECT DRAWS (one card away):
  flush_draw       — exactly 4 cards of the same suit (9 outs base)
  oesd             — 4 consecutive ranks, both ends open (8 outs)
                     e.g., 6-7-8-9 on flop (needs 5 or T)
  double_gutter    — two separate gutshots with different missing cards (8 outs)
                     e.g., 5-6-_-8-9 (needs 7) AND 7-8-9-_-J (needs T)
                     Also called "double belly buster" (DBB)
  gutshot          — 4-card sequence with exactly one internal gap (4 outs)
                     e.g., 5-6-_-8 (needs 7)
  straight_flush_draw — flush draw + straight draw combined (e.g., 4 hearts to a straight)

BACKDOOR DRAWS (two cards away, runner-runner):
  backdoor_flush    — exactly 3 cards of same suit (needs 2 more)
  backdoor_straight — 3 consecutive ranks needing two more specific cards

CRITICAL SAFETY RULES:
  1. Backdoor draws are NEVER promoted to direct draws.
  2. If the 4-card straight set is not present, there is NO OESD.
  3. Classification confidence drops when board pairing complicates outs.
  4. Unknown situations raise a warning rather than guessing.

PROVEN EXAMPLE (the bug that triggered this rewrite):
  9h8h on Ah7d2s → NO OESD
  - Only 3 consecutive ranks exist: 7-8-9
  - For OESD need: 6-7-8-9 or 7-8-9-T (4 consecutive) — NEITHER present
  - Correctly classified as: backdoor_straight + backdoor_flush
  - Confidence: HIGH (deterministic check)
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Sequence

from app.engines.hand_evaluator import (
    Card,
    HandRank,
    RANK_VALUES,
    evaluate_hole_and_board,
    parse_card,
    parse_cards,
    _rank_name,
)

logger = logging.getLogger(__name__)

# ── Data structures ────────────────────────────────────────────────────────────

@dataclass
class StraightDrawInfo:
    draw_type: str       # "oesd" | "double_gutter" | "gutshot" | "backdoor_straight"
    needed_ranks: list[int]   # ranks that complete the draw
    available_outs: int  # raw out count (before deduction for known cards)
    description: str     # human label, e.g. "OESD — 6-7-8-9 needs 5 or T"
    window: tuple[int, ...] | None = None  # the 5-rank window this draw lives in


@dataclass
class FlushDrawInfo:
    draw_type: str       # "flush_draw" | "backdoor_flush"
    suit: str            # c/d/h/s
    cards_to_suit: int   # how many of this suit we already have
    available_outs: int  # 9 for flush_draw, ~10 for backdoor (rough)
    description: str


@dataclass
class DrawAnalysis:
    """Complete draw analysis for hero's hole cards vs current board."""
    # Input context
    hole_cards: list[str]
    board_cards: list[str]
    street: str   # "flop" | "turn" | "river"

    # Made hand
    made_hand_category: str  # from hand_evaluator
    made_hand_description: str

    # Draw classifications
    straight_draws: list[StraightDrawInfo] = field(default_factory=list)
    flush_draws: list[FlushDrawInfo] = field(default_factory=list)
    has_pair_or_better: bool = False

    # Summary flags
    has_direct_straight_draw: bool = False   # OESD or double gutter or gutshot
    has_flush_draw: bool = False             # 4 to flush
    has_backdoor_straight: bool = False
    has_backdoor_flush: bool = False
    is_combo_draw: bool = False              # direct flush + direct straight together
    is_straight_flush_draw: bool = False

    # Confidence
    confidence: float = 1.0   # 0-1, lowered when board complexity reduces certainty
    warnings: list[str] = field(default_factory=list)
    diagnostics: list[str] = field(default_factory=list)

    # Primary label (the single most important draw description)
    primary_label: str = ""
    primary_outs: int = 0


# ── Public API ─────────────────────────────────────────────────────────────────

def analyze_draws(
    hole_cards: Sequence[str],
    board_cards: Sequence[str],
) -> DrawAnalysis:
    """
    Full draw analysis for hero's hole cards vs current board.

    Parameters
    ----------
    hole_cards : e.g. ['9h', '8h']
    board_cards : e.g. ['Ah', '7d', '2s']

    Returns
    -------
    DrawAnalysis with complete, validated classifications.
    """
    street = _infer_street(len(board_cards))
    hole = parse_cards(list(hole_cards))
    board = parse_cards(list(board_cards))

    analysis = DrawAnalysis(
        hole_cards=list(hole_cards),
        board_cards=list(board_cards),
        street=street,
        made_hand_category="",
        made_hand_description="",
    )

    # ── Validate inputs ───────────────────────────────────────────────────────
    _validate_inputs(hole, board, analysis)
    if analysis.confidence == 0.0:
        return analysis

    # ── Made hand ─────────────────────────────────────────────────────────────
    if board:
        try:
            made = evaluate_hole_and_board([str(c) for c in hole], [str(c) for c in board])
            analysis.made_hand_category = made.category_name
            analysis.made_hand_description = made.description
            analysis.has_pair_or_better = made.category >= 1
        except Exception as e:
            analysis.warnings.append(f"Hand evaluation error: {e}")
            analysis.made_hand_category = "high_card"
            analysis.made_hand_description = "Unknown"
    else:
        analysis.made_hand_category = "high_card"
        analysis.made_hand_description = "Preflop — no board yet"

    # ── Flush draws ───────────────────────────────────────────────────────────
    analysis.flush_draws = _detect_flush_draws(hole, board)
    analysis.has_flush_draw = any(
        fd.draw_type == "flush_draw" for fd in analysis.flush_draws
    )
    analysis.has_backdoor_flush = any(
        fd.draw_type == "backdoor_flush" for fd in analysis.flush_draws
    )

    # ── Straight draws ────────────────────────────────────────────────────────
    all_ranks = _build_rank_set(hole + board)
    hole_ranks = _build_rank_set(hole)
    analysis.straight_draws = _detect_straight_draws(all_ranks, hole_ranks)

    for sd in analysis.straight_draws:
        if sd.draw_type in ("oesd", "double_gutter", "gutshot"):
            analysis.has_direct_straight_draw = True
        if sd.draw_type == "backdoor_straight":
            analysis.has_backdoor_straight = True

    # ── Combo draw ───────────────────────────────────────────────────────────
    analysis.is_combo_draw = analysis.has_flush_draw and analysis.has_direct_straight_draw
    analysis.is_straight_flush_draw = _check_straight_flush_draw(hole, board)

    # ── Primary label & outs ─────────────────────────────────────────────────
    _assign_primary_label(analysis)

    # ── Confidence adjustment ─────────────────────────────────────────────────
    _adjust_confidence(analysis, board)

    # ── Diagnostics ─────────────────────────────────────────────────────────
    analysis.diagnostics.append(
        f"Evaluated {len(hole)} hole + {len(board)} board cards on {street}."
    )
    analysis.diagnostics.append(
        f"Made hand: {analysis.made_hand_category}."
    )
    if analysis.straight_draws:
        labels = [sd.description for sd in analysis.straight_draws]
        analysis.diagnostics.append(f"Straight draws: {'; '.join(labels)}")
    if analysis.flush_draws:
        labels = [fd.description for fd in analysis.flush_draws]
        analysis.diagnostics.append(f"Flush draws: {'; '.join(labels)}")

    return analysis


# ── Flush draw detection ───────────────────────────────────────────────────────

def _detect_flush_draws(hole: list[Card], board: list[Card]) -> list[FlushDrawInfo]:
    """Find flush draws (4 to flush) and backdoor flush draws (3 to flush)."""
    all_cards = hole + board
    suit_counts: dict[str, list[Card]] = {}
    for card in all_cards:
        suit_counts.setdefault(card.suit, []).append(card)

    draws: list[FlushDrawInfo] = []
    for suit, cards in suit_counts.items():
        n = len(cards)
        hole_of_suit = [c for c in hole if c.suit == suit]
        if not hole_of_suit:
            continue  # hero not contributing to this suit

        if n == 5:
            # Already made flush — not a "draw"
            continue
        elif n == 4:
            draws.append(FlushDrawInfo(
                draw_type="flush_draw",
                suit=suit,
                cards_to_suit=4,
                available_outs=9,
                description=f"Flush draw ({suit.upper()} suit, {n} to flush, 9 outs)",
            ))
        elif n == 3:
            draws.append(FlushDrawInfo(
                draw_type="backdoor_flush",
                suit=suit,
                cards_to_suit=3,
                available_outs=0,  # runner-runner, not counted as direct outs
                description=f"Backdoor flush draw ({suit.upper()} suit, {n} to flush, runner-runner)",
            ))

    return draws


# ── Straight draw detection ────────────────────────────────────────────────────

def _build_rank_set(cards: list[Card]) -> frozenset[int]:
    """Build set of rank values. Ace is included both as 14 and 1 (for wheel)."""
    ranks = frozenset(c.rank_value for c in cards)
    if 14 in ranks:
        ranks = ranks | frozenset([1])
    return ranks


def _detect_straight_draws(
    all_ranks: frozenset[int],
    hole_ranks: frozenset[int],
) -> list[StraightDrawInfo]:
    """
    Enumerate all straight windows [w, w+1, w+2, w+3, w+4] for w in 1..10.

    For each window:
      present = ranks in window that we already have
      needed  = ranks in window that we're missing

    len(present) == 4, len(needed) == 1 → direct draw
    len(present) == 3, len(needed) == 2 → backdoor draw

    OESD detection:
      - If 4 consecutive ranks appear in TWO windows (different needed rank each):
        the hand is an OESD (both ends open).
      - If 4 consecutive ranks appear in ONLY ONE window: one-sided OESD (edge case).
      - If 4 non-consecutive ranks appear in a window: gutshot.

    Double gutter detection:
      - Two SEPARATE gutshots with different needed ranks (different "have" sets).
    """
    # Collect window data: frozenset(have) → list of needed ranks
    window_map: dict[frozenset[int], list[int]] = {}
    # Also track which windows each "have" set appeared in
    window_details: dict[frozenset[int], list[tuple[int, ...]]] = {}

    for low in range(1, 11):
        window = frozenset(range(low, low + 5))
        present = window & all_ranks
        needed = window - all_ranks

        if len(present) < 3:
            continue

        # Hero must contribute at least one rank to this draw
        if not (hole_ranks & present):
            continue

        if len(present) == 4 and len(needed) == 1:
            needed_rank = next(iter(needed))
            window_map.setdefault(present, []).append(needed_rank)
            window_details.setdefault(present, []).append(tuple(range(low, low + 5)))

        elif len(present) == 3 and len(needed) == 2:
            window_map.setdefault(present, []).append(tuple(needed))  # type: ignore[arg-type]
            window_details.setdefault(present, []).append(tuple(range(low, low + 5)))

    draws: list[StraightDrawInfo] = []

    # ── Separate direct draws (4 present) from backdoors (3 present) ─────────
    direct_entries = [
        (have, needed_list)
        for have, needed_list in window_map.items()
        if len(have) == 4 and isinstance(needed_list[0], int)
    ]
    backdoor_entries = [
        (have, needed_list)
        for have, needed_list in window_map.items()
        if len(have) == 3
    ]

    # ── Classify direct draws ─────────────────────────────────────────────────
    processed_oesd_sets: set[frozenset[int]] = set()
    gutshot_draws: list[tuple[frozenset[int], int]] = []  # (have_set, needed_rank)

    for have, needed_list in direct_entries:
        sorted_have = sorted(have)
        is_consecutive = all(
            sorted_have[i] + 1 == sorted_have[i + 1] for i in range(3)
        )

        if is_consecutive and len(needed_list) == 2:
            # OESD: 4 consecutive ranks, both ends open
            if have not in processed_oesd_sets:
                processed_oesd_sets.add(have)
                low_needed = min(needed_list)
                high_needed = max(needed_list)
                seq_str = "-".join(_rank_name(r) for r in sorted_have)
                draws.append(StraightDrawInfo(
                    draw_type="oesd",
                    needed_ranks=sorted(needed_list),
                    available_outs=8,
                    description=(
                        f"OESD — {seq_str} needs {_rank_name(low_needed)} "
                        f"or {_rank_name(high_needed)} ({8} outs)"
                    ),
                    window=tuple(sorted_have),
                ))

        elif is_consecutive and len(needed_list) == 1:
            # One-sided: e.g., A-K-Q-J needs T (broadway draw) or A-2-3-4 needs 5 (wheel draw)
            needed_rank = needed_list[0]
            seq_str = "-".join(_rank_name(r) for r in sorted_have)
            draws.append(StraightDrawInfo(
                draw_type="gutshot",  # functionally: 4 outs (one end only)
                needed_ranks=[needed_rank],
                available_outs=4,
                description=(
                    f"One-sided straight draw — {seq_str} needs {_rank_name(needed_rank)} (4 outs)"
                ),
                window=tuple(sorted_have),
            ))

        else:
            # Non-consecutive 4 = gutshot
            for nr in needed_list:
                gutshot_draws.append((have, nr))

    # ── Double gutter check ───────────────────────────────────────────────────
    # A double gutter = two SEPARATE gutshots (different have-sets, each with 1 needed)
    unique_needed = {nr for _, nr in gutshot_draws}
    unique_have_sets = {have for have, _ in gutshot_draws}

    if len(unique_needed) >= 2 and len(unique_have_sets) >= 2:
        # Multiple gutshots with different needed ranks = double belly buster
        all_needed = sorted(unique_needed)
        draws.append(StraightDrawInfo(
            draw_type="double_gutter",
            needed_ranks=all_needed,
            available_outs=4 * len(unique_needed),  # 4 per out-rank
            description=(
                f"Double gutshot (DBB) — needs "
                + " or ".join(_rank_name(r) for r in all_needed)
                + f" ({4 * len(unique_needed)} outs)"
            ),
        ))
    elif gutshot_draws:
        # Single gutshot(s) sharing the same needed rank
        for have, needed_rank in {(have, nr) for have, nr in gutshot_draws}:
            sorted_have = sorted(have)
            seq_str = "-".join(_rank_name(r) for r in sorted_have)
            draws.append(StraightDrawInfo(
                draw_type="gutshot",
                needed_ranks=[needed_rank],
                available_outs=4,
                description=(
                    f"Gutshot — {seq_str} needs {_rank_name(needed_rank)} (4 outs)"
                ),
                window=tuple(sorted_have),
            ))

    # ── Backdoor draws ────────────────────────────────────────────────────────
    if not draws:  # Only report backdoors if no direct draws
        seen_windows: set[tuple[int, ...]] = set()
        for have, needed_list in backdoor_entries:
            sorted_have = sorted(have)
            is_consecutive = all(
                sorted_have[i] + 1 == sorted_have[i + 1] for i in range(2)
            )
            if not is_consecutive:
                continue  # skip disconnected 3-card combos

            win_key = tuple(sorted_have)
            if win_key in seen_windows:
                continue
            seen_windows.add(win_key)

            seq_str = "-".join(_rank_name(r) for r in sorted_have)
            all_needed: list[int] = []
            for n in needed_list:
                if isinstance(n, int):
                    all_needed.append(n)
                else:
                    all_needed.extend(n)
            unique_needed_sorted = sorted(set(all_needed))
            draws.append(StraightDrawInfo(
                draw_type="backdoor_straight",
                needed_ranks=unique_needed_sorted,
                available_outs=0,  # runner-runner equity only
                description=(
                    f"Backdoor straight draw — {seq_str} (runner-runner only, "
                    f"needs {' and '.join(_rank_name(r) for r in unique_needed_sorted[:2])})"
                ),
                window=tuple(sorted_have),
            ))

    return draws


# ── Straight-flush draw ────────────────────────────────────────────────────────

def _check_straight_flush_draw(hole: list[Card], board: list[Card]) -> bool:
    """True if hero has 4 cards to a straight flush (suited connector combos)."""
    all_cards = hole + board
    for suit in "cdhs":
        suited = [c for c in all_cards if c.suit == suit]
        if len(suited) < 4:
            continue
        suited_ranks = frozenset(c.rank_value for c in suited)
        if 14 in suited_ranks:
            suited_ranks = suited_ranks | frozenset([1])
        hole_suited_ranks = frozenset(c.rank_value for c in hole if c.suit == suit)
        for low in range(1, 11):
            window = frozenset(range(low, low + 5))
            present = window & suited_ranks
            if len(present) >= 4 and (hole_suited_ranks & present):
                return True
    return False


# ── Primary label assignment ───────────────────────────────────────────────────

def _assign_primary_label(analysis: DrawAnalysis) -> None:
    """Set the single best summary label and out count."""

    # Priority: made hand > combo > flush > OESD/DBB > gutshot > backdoor
    if analysis.made_hand_category in (
        "straight_flush", "quads", "full_house", "flush", "straight"
    ):
        analysis.primary_label = analysis.made_hand_description
        analysis.primary_outs = 0
        return

    # Straight flush draw
    if analysis.is_straight_flush_draw:
        analysis.primary_label = "Straight flush draw"
        analysis.primary_outs = _count_total_outs(analysis)
        return

    # Combo draw
    if analysis.is_combo_draw:
        fd = next(f for f in analysis.flush_draws if f.draw_type == "flush_draw")
        sd = next(
            s for s in analysis.straight_draws
            if s.draw_type in ("oesd", "double_gutter", "gutshot")
        )
        total_outs = _count_total_outs(analysis)
        analysis.primary_label = (
            f"Combo draw — {fd.suit.upper()}-suit flush draw + "
            f"{sd.draw_type.replace('_', ' ')} ({total_outs} outs)"
        )
        analysis.primary_outs = total_outs
        return

    # Flush draw only
    if analysis.has_flush_draw:
        fd = next(f for f in analysis.flush_draws if f.draw_type == "flush_draw")
        analysis.primary_label = fd.description
        analysis.primary_outs = 9
        return

    # Direct straight draws
    direct = [
        s for s in analysis.straight_draws
        if s.draw_type in ("oesd", "double_gutter")
    ]
    if direct:
        best = max(direct, key=lambda s: s.available_outs)
        analysis.primary_label = best.description
        analysis.primary_outs = best.available_outs
        return

    gutshots = [s for s in analysis.straight_draws if s.draw_type == "gutshot"]
    if gutshots:
        best = gutshots[0]
        analysis.primary_label = best.description
        analysis.primary_outs = 4
        return

    # Backdoor draws
    bd_parts = []
    if analysis.has_backdoor_flush:
        fd = next(f for f in analysis.flush_draws if f.draw_type == "backdoor_flush")
        bd_parts.append(f"backdoor flush ({fd.suit.upper()})")
    if analysis.has_backdoor_straight:
        sd = next(
            s for s in analysis.straight_draws
            if s.draw_type == "backdoor_straight"
        )
        bd_parts.append("backdoor straight")
    if bd_parts:
        analysis.primary_label = " + ".join(bd_parts).capitalize()
        analysis.primary_outs = 0
        return

    # Made hand or air
    if analysis.made_hand_category not in ("high_card",):
        analysis.primary_label = analysis.made_hand_description
    else:
        analysis.primary_label = "No draw — high card only"
    analysis.primary_outs = 0


def _count_total_outs(analysis: DrawAnalysis) -> int:
    """
    Count total outs, avoiding double-counting between flush and straight draws.
    Straight flush draw outs counted once.
    """
    flush_outs = 9 if analysis.has_flush_draw else 0

    straight_outs = 0
    direct = [
        s for s in analysis.straight_draws
        if s.draw_type in ("oesd", "double_gutter", "gutshot")
    ]
    if direct:
        best = max(direct, key=lambda s: s.available_outs)
        straight_outs = best.available_outs

    # Overlap: some straight outs may also be flush outs (straight flush)
    # Conservative: subtract ~1-2 for straight flush cards
    if analysis.has_flush_draw and straight_outs > 0:
        overlap = 1 if straight_outs <= 4 else 2  # rough deduction
        return flush_outs + straight_outs - overlap

    return flush_outs + straight_outs


# ── Helpers ────────────────────────────────────────────────────────────────────

def _infer_street(n_board: int) -> str:
    return {0: "preflop", 3: "flop", 4: "turn", 5: "river"}.get(n_board, "flop")


def _validate_inputs(
    hole: list[Card],
    board: list[Card],
    analysis: DrawAnalysis,
) -> None:
    if len(hole) != 2:
        analysis.warnings.append(f"Expected 2 hole cards, got {len(hole)}")
        analysis.confidence = 0.0
        return

    if len(board) not in (0, 3, 4, 5):
        analysis.warnings.append(
            f"Unusual board size: {len(board)} cards (expected 0/3/4/5)"
        )
        analysis.confidence = 0.5

    all_seen = hole + board
    ranks_suits = [(c.rank, c.suit) for c in all_seen]
    seen: set[tuple[str, str]] = set()
    for rs in ranks_suits:
        if rs in seen:
            analysis.warnings.append(f"Duplicate card detected: {rs[0]}{rs[1]}")
            analysis.confidence = 0.2
        seen.add(rs)


def _adjust_confidence(analysis: DrawAnalysis, board: list[Card]) -> None:
    """Lower confidence when board texture complicates the draw picture."""
    # Paired board: outs may be partially counterfeited
    board_ranks = [c.rank_value for c in board]
    if len(board_ranks) != len(set(board_ranks)):
        analysis.diagnostics.append(
            "Paired board detected — some outs may be counterfeited (full house blockers)."
        )
        if analysis.has_direct_straight_draw or analysis.has_flush_draw:
            analysis.confidence = min(analysis.confidence, 0.85)

    # River: no more cards coming — no "draws" are meaningful
    if analysis.street == "river":
        if analysis.has_direct_straight_draw or analysis.has_flush_draw:
            analysis.warnings.append(
                "Draws on the river have no realisation — hand is complete."
            )
            analysis.confidence = min(analysis.confidence, 0.90)
