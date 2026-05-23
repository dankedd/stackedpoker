"""
BoardClassifier — deterministic board texture classification engine.

This module is the Phase 2 strategic intelligence layer.  It classifies
any poker board (flop / turn / river) into a structured BoardFeatures
profile that downstream solver retrieval, reasoning, and coaching systems
can rely on.

NO solver outputs (EV, frequencies), NO GPT reasoning, NO UI logic.
Pure deterministic rank/suit analysis only.
"""

from __future__ import annotations

from .board_features import BoardFeatures
from .enums import BoardClassEnum
from .utils import (
    calculate_connectivity,
    count_broadways,
    detect_flush_draw,
    detect_monotone,
    detect_pairing,
    detect_rainbow,
    detect_scare_card,
    detect_straight_draws,
    detect_two_tone,
    detect_wheel_possible,
    get_pair_rank,
    get_rank_ints,
    high_card_rank,
    is_dynamic,
    parse_board,
    rank_to_int,
)


class BoardClassifier:
    """
    Classifies poker boards deterministically.

    Public API
    ----------
    classify_flop(board)               → BoardFeatures
    classify_turn(flop, turn_card)     → BoardFeatures
    classify_river(prev_board, river_card) → BoardFeatures

    Feature extraction (reusable building blocks)
    -----------------------------------------------
    extract_flop_features(board)               → BoardFeatures
    extract_turn_features(flop, turn_card)     → BoardFeatures
    extract_river_features(prev_board, card)   → BoardFeatures
    """

    # ── Public classification entry-points ────────────────────────────────────

    def classify_flop(self, board: list[str]) -> BoardFeatures:
        """
        Classify a 3-card flop.

        Args:
            board: list of 3 card strings, e.g. ['Ah', 'Kd', '3c']

        Returns:
            BoardFeatures with all texture fields populated.
        """
        if len(board) != 3:
            raise ValueError(f"Flop must have exactly 3 cards, got {len(board)}")
        return self.extract_flop_features(board)

    def classify_turn(
        self, flop: list[str], turn_card: str
    ) -> BoardFeatures:
        """
        Classify the turn board (flop + turn card).

        Args:
            flop:      the 3 flop card strings
            turn_card: the new turn card string

        Returns:
            BoardFeatures representing the 4-card board with evolution flags set.
        """
        if len(flop) != 3:
            raise ValueError(f"Flop must have exactly 3 cards, got {len(flop)}")
        return self.extract_turn_features(flop, turn_card)

    def classify_river(
        self, previous_board: list[str], river_card: str
    ) -> BoardFeatures:
        """
        Classify the river board (turn_board + river card).

        Args:
            previous_board: the 4-card turn board
            river_card:     the new river card string

        Returns:
            BoardFeatures representing the 5-card board with evolution flags set.
        """
        if len(previous_board) != 4:
            raise ValueError(
                f"previous_board must have exactly 4 cards, got {len(previous_board)}"
            )
        return self.extract_river_features(previous_board, river_card)

    # ── Feature extraction ────────────────────────────────────────────────────

    def extract_flop_features(self, board: list[str]) -> BoardFeatures:
        """Build a BoardFeatures profile for a 3-card flop."""
        ranks, suits = parse_board(board)
        return self._build_features(
            ranks=ranks,
            suits=suits,
            paired_turn=False,
            paired_river=False,
            scare_card=False,
            straight_completed_override=False,
        )

    def extract_turn_features(
        self, flop: list[str], turn_card: str
    ) -> BoardFeatures:
        """
        Build a BoardFeatures profile for the 4-card turn board.

        Detects straight/flush completion and scare-card status relative
        to the flop.
        """
        flop_ranks, flop_suits = parse_board(flop)
        turn_rank, turn_suit = self._parse_single(turn_card)

        all_ranks = flop_ranks + [turn_rank]
        all_suits = flop_suits + [turn_suit]

        # Evolution: board pairing on the turn
        paired_turn = turn_rank in flop_ranks

        # Straight completion: window count jumped from ≤2 to ≥3
        straight_completed = self._straight_completed_on_new_card(
            prev_rank_ints=get_rank_ints(flop_ranks),
            new_rank_int=rank_to_int(turn_rank),
        )

        scare = detect_scare_card(flop_ranks, flop_suits, turn_rank, turn_suit)

        return self._build_features(
            ranks=all_ranks,
            suits=all_suits,
            paired_turn=paired_turn,
            paired_river=False,
            scare_card=scare,
            straight_completed_override=straight_completed,
        )

    def extract_river_features(
        self, turn_board: list[str], river_card: str
    ) -> BoardFeatures:
        """
        Build a BoardFeatures profile for the 5-card river board.

        Detects straight/flush completion and scare-card status relative
        to the turn board.
        """
        prev_ranks, prev_suits = parse_board(turn_board)
        river_rank, river_suit = self._parse_single(river_card)

        all_ranks = prev_ranks + [river_rank]
        all_suits = prev_suits + [river_suit]

        # River pairing: new card matches any previous board card
        paired_river = river_rank in prev_ranks

        # Reconstruct paired_turn from the turn board: if the 4th card (index 3)
        # matched any of the first 3, the turn was paired.
        if len(prev_ranks) == 4:
            paired_turn = prev_ranks[3] in prev_ranks[:3]
        else:
            paired_turn = False

        straight_completed = self._straight_completed_on_new_card(
            prev_rank_ints=get_rank_ints(prev_ranks),
            new_rank_int=rank_to_int(river_rank),
        )

        scare = detect_scare_card(prev_ranks, prev_suits, river_rank, river_suit)

        return self._build_features(
            ranks=all_ranks,
            suits=all_suits,
            paired_turn=paired_turn,
            paired_river=paired_river,
            scare_card=scare,
            straight_completed_override=straight_completed,
        )

    # ── Core feature builder ──────────────────────────────────────────────────

    def _build_features(
        self,
        ranks: list[str],
        suits: list[str],
        paired_turn: bool,
        paired_river: bool,
        scare_card: bool,
        straight_completed_override: bool,
    ) -> BoardFeatures:
        rank_ints = get_rank_ints(ranks)

        # Pairedness
        paired, trips = detect_pairing(ranks)

        # Suit texture
        monotone = detect_monotone(suits)
        two_tone = detect_two_tone(suits)
        rainbow = detect_rainbow(suits)

        # Connectedness
        conn_score, conn_label = calculate_connectivity(rank_ints)

        # Broadway
        bw_count = count_broadways(ranks)
        hi_rank = high_card_rank(ranks)

        # Flush
        flush_draw, flush_completed = detect_flush_draw(suits)

        # Straight
        straight_draw, straight_completed_base = detect_straight_draws(rank_ints)
        straight_completed = straight_completed_override or straight_completed_base

        # Wheel
        wheel = detect_wheel_possible(rank_ints)

        # Dynamic / static
        hi_rank_int = rank_to_int(hi_rank) if hi_rank else 0
        dynamic = is_dynamic(conn_score, flush_draw, straight_draw, bw_count, hi_rank_int)
        static = not dynamic

        # Board class (considers all computed features)
        board_class = self._assign_board_class(
            paired=paired,
            trips=trips,
            monotone=monotone,
            broadway_count=bw_count,
            high_rank=hi_rank,
            dynamic=dynamic,
            connectedness_score=conn_score,
            flush_completed=flush_completed,
            straight_completed=straight_completed,
            straight_completed_override=straight_completed_override,
            ranks=ranks,
        )

        return BoardFeatures(
            paired=paired,
            trips=trips,
            monotone=monotone,
            two_tone=two_tone,
            rainbow=rainbow,
            connectedness_score=conn_score,
            connectedness_label=conn_label,
            broadway_count=bw_count,
            high_card_rank=hi_rank,
            dynamic=dynamic,
            static=static,
            flush_draw_possible=flush_draw,
            flush_completed=flush_completed,
            straight_draw_possible=straight_draw,
            straight_completed=straight_completed,
            wheel_possible=wheel,
            paired_turn=paired_turn,
            paired_river=paired_river,
            scare_card=scare_card,
            board_class=board_class,
        )

    # ── Board class assignment ────────────────────────────────────────────────

    def _assign_board_class(
        self,
        paired: bool,
        trips: bool,
        monotone: bool,
        broadway_count: int,
        high_rank: str | None,
        dynamic: bool,
        connectedness_score: int,
        flush_completed: bool,
        straight_completed: bool,
        straight_completed_override: bool,
        ranks: list[str],
    ) -> BoardClassEnum:
        """
        Priority-ordered classification.  Highest-specificity rules win.

        Priority order:
            1. Monotone (suit dominates everything)
            2. Turn/river completion events
            3. Trips
            4. Paired
            5. Triple broadway
            6. Double broadway
            7. Ace-high
            8. King-high
            9. Low dynamic / low connected
            10. Middle connected
            11. Rainbow static / dynamic
            12. Neutral
        """

        # ── 1. Monotone ──────────────────────────────────────────────
        if monotone:
            return BoardClassEnum.MONOTONE

        # ── 2. Turn/river completions ────────────────────────────────
        # Flush completing wins over straight completing when both occur on
        # the same card (e.g. Th completes both flush draw and straight window
        # on 9h 8h 2c — the flush event is the dominant texture change).
        if flush_completed and not monotone:
            return BoardClassEnum.FLUSH_COMPLETING

        # Straight completing: new card brought ≥4 board cards into a 5-wide
        # window where previously only ≤3 were (explicit draw-completion event).
        if straight_completed_override:
            return BoardClassEnum.STRAIGHT_COMPLETING

        # ── 3. Trips ─────────────────────────────────────────────────
        if trips:
            pair_rank = get_pair_rank(ranks)
            if pair_rank and rank_to_int(pair_rank) >= rank_to_int("Q"):
                return BoardClassEnum.PAIRED_HIGH
            return BoardClassEnum.PAIRED_LOW

        # ── 4. Paired ────────────────────────────────────────────────
        if paired:
            pair_rank = get_pair_rank(ranks)
            if pair_rank and rank_to_int(pair_rank) >= rank_to_int("Q"):
                return BoardClassEnum.PAIRED_HIGH
            return BoardClassEnum.PAIRED_LOW

        # ── 5. Triple broadway ───────────────────────────────────────
        if broadway_count >= 3:
            return BoardClassEnum.TRIPLE_BROADWAY

        # ── 6. Ace-high (checked before DOUBLE_BROADWAY so that AKx boards
        #      classify as A_HIGH rather than DOUBLE_BROADWAY) ───────────────
        if high_rank == "A":
            return BoardClassEnum.A_HIGH_WET if dynamic else BoardClassEnum.A_HIGH_DRY

        # ── 7. Double broadway (no ace: e.g. KQ4, QJ3) ──────────────
        if broadway_count == 2:
            return BoardClassEnum.DOUBLE_BROADWAY

        # ── 8. King-high ─────────────────────────────────────────────
        if high_rank == "K":
            return BoardClassEnum.K_HIGH_WET if dynamic else BoardClassEnum.K_HIGH_DRY

        # ── 9. Low connected / dynamic ───────────────────────────────
        hi_int = rank_to_int(high_rank) if high_rank else 0
        if hi_int <= 9:  # all cards are 9 or below → low board
            if dynamic:
                return BoardClassEnum.LOW_DYNAMIC
            return BoardClassEnum.LOW_CONNECTED

        # ── 10. Middle connected ─────────────────────────────────────
        if connectedness_score >= 6:
            return BoardClassEnum.MIDDLE_CONNECTED

        # ── 11. Rainbow static / dynamic ─────────────────────────────
        if dynamic:
            return BoardClassEnum.RAINBOW_DYNAMIC

        return BoardClassEnum.RAINBOW_STATIC

    # ── Internal helpers ─────────────────────────────────────────────────────

    @staticmethod
    def _parse_single(card: str) -> tuple[str, str]:
        """Parse a single card string into (rank, suit)."""
        from .utils import parse_card
        return parse_card(card)

    @staticmethod
    def _straight_completed_on_new_card(
        prev_rank_ints: list[int],
        new_rank_int: int,
    ) -> bool:
        """
        Returns True when the new card brought ≥4 ranks into the same 5-wide window
        where previously only <4 were present.

        4-in-a-window means any holder of the missing rank has a made straight,
        which is the practical definition of "a straight draw got there."
        """
        from .utils import _best_window_count, _extended_rank_ints

        prev_window = _best_window_count(_extended_rank_ints(prev_rank_ints), 5)
        all_ints = prev_rank_ints + [new_rank_int]
        new_window = _best_window_count(_extended_rank_ints(all_ints), 5)
        return new_window >= 4 and prev_window < 4
