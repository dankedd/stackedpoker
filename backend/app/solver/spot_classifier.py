"""
SolverSpotClassifier — deterministic CanonicalHand → SolverSpot conversion.

This is the Phase 1 solver abstraction entry point.  It takes a fully
validated CanonicalHand and extracts every strategic dimension needed for
solver node retrieval:

    CanonicalHand
        → pot type detection
        → positional matchup derivation
        → IP/OOP classification
        → effective stack at flop
        → SPR calculation
        → stack depth bucketing
        → board classification
        → SolverSpot assembly

NO solver outputs (EV, frequencies, ranges) are produced here.
NO GPT / AI reasoning is used.
NO hardcoded board matchups.

All logic is deterministic and derived from the CanonicalHand fields.
"""

from __future__ import annotations

import logging
from typing import Optional

from app.models.canonical import ActionType, CanonicalHand, CanonicalPlayer, Street

logger = logging.getLogger(__name__)

from .board_classifier import BoardClassifier
from .board_features import BoardFeatures
from .enums import (
    BoardClassEnum,
    PositionMatchup,
    SPRBucket,
    SolverStreet,
    SpotType,
    StackDepthBucket,
)
from .models import SolverSpot
from .utils import (
    bucket_spr,
    bucket_stack_depth,
    calculate_spr,
    normalize_position_for_matchup,
    postflop_position_rank,
)

# Reusable board classifier instance (stateless — safe to share)
_board_classifier = BoardClassifier()

# Actions that represent a voluntary preflop raise (excludes blind posts / antes)
_RAISE_ACTIONS = frozenset({ActionType.RAISE})
_CALL_ACTIONS = frozenset({ActionType.CALL})
_POST_ACTIONS = frozenset({
    ActionType.POST_SB,
    ActionType.POST_BB,
    ActionType.POST_ANTE,
    ActionType.POST_STRADDLE,
})


class SolverSpotClassifier:
    """
    Converts a CanonicalHand into a SolverSpot abstraction.

    Usage::

        classifier = SolverSpotClassifier()
        spot = classifier.classify(canonical_hand)

    The classifier is stateless; a single instance may be reused freely.
    """

    def classify(self, hand: CanonicalHand) -> SolverSpot:
        """
        Main entry point.  Returns a fully-populated SolverSpot.

        Args:
            hand: A validated CanonicalHand (from the normalisation pipeline).

        Returns:
            SolverSpot with all abstraction dimensions populated.
        """
        # ── 1. Preflop action parsing ────────────────────────────────────
        preflop_actions = self._preflop_actions(hand)
        spot_type = self._detect_spot_type(preflop_actions)

        voluntary = [a for a in preflop_actions if a.action not in _POST_ACTIONS]
        raises = [a for a in voluntary if a.action in _RAISE_ACTIONS]
        logger.debug(
            "[classify] hand=%s | preflop_actions=%d voluntary=%d raises=%d -> %s",
            hand.hand_id, len(preflop_actions), len(voluntary), len(raises),
            spot_type.value,
        )
        for a in preflop_actions:
            logger.debug(
                "  action seq=%d player=%s type=%s amount=%.1f stack_after=%.1f pot_after=%.1f",
                a.sequence, a.player_id, a.action.value,
                a.amount_bb, a.stack_after_bb, a.pot_after_bb,
            )

        # ── 2. Player / position analysis ────────────────────────────────
        active_players = self._active_players_at_flop(hand)
        player_count = max(len(active_players), 2)  # at least 2 for any contested pot

        hero = self._hero(hand)
        hero_position = hero.position if hero else "UNKNOWN"

        is_ip = self._is_hero_ip(hand, active_players)

        villain_position: Optional[str] = None
        if player_count == 2:
            villain = next(
                (p for p in active_players if p.id != hand.hero_id), None
            )
            villain_position = villain.position if villain else None

        position_matchup = self._detect_position_matchup(active_players, player_count)

        logger.debug(
            "[classify] hero=%s villain=%s matchup=%s is_ip=%s players=%d",
            hero_position, villain_position, position_matchup.value,
            is_ip, player_count,
        )

        # ── 3. Pot / stack / SPR reconstruction ──────────────────────────
        flop_pot = self._flop_pot(hand)
        eff_stack = self._effective_stack_at_flop(hand, active_players)
        spr = calculate_spr(eff_stack, flop_pot)

        logger.debug(
            "[classify] flop_pot=%.2f eff_stack=%.2f spr=%.2f",
            flop_pot, eff_stack, spr,
        )

        # ── 4. Board extraction and classification ───────────────────────
        street = self._current_street(hand)
        board_cards = self._board_cards(hand)
        board_class, board_texture = self._classify_board(board_cards)

        logger.debug(
            "[classify] street=%s board_cards=%s board_class=%s board_features=%s",
            street.value, board_cards, board_class.value,
            "populated" if board_texture else "null",
        )
        if board_texture:
            logger.debug(
                "[classify] dynamic=%s connected=%s/%d flush_draw=%s straight_draw=%s",
                board_texture.dynamic, board_texture.connectedness_label,
                board_texture.connectedness_score, board_texture.flush_draw_possible,
                board_texture.straight_draw_possible,
            )

        return SolverSpot(
            spot_type=spot_type,
            hero_position=hero_position,
            villain_position=villain_position,
            position_matchup=position_matchup,
            is_ip=is_ip,
            player_count=player_count,
            effective_stack_bb=round(eff_stack, 2),
            pot_bb=round(flop_pot, 2),
            spr=spr,
            stack_depth_bucket=StackDepthBucket(bucket_stack_depth(eff_stack)),
            spr_bucket=SPRBucket(bucket_spr(spr)),
            board_class=board_class,
            board_texture=board_texture,
            street=street,
            metadata={
                "hand_id": hand.hand_id,
                "site": hand.site,
                "game_type": hand.game_type,
                "is_tournament": hand.is_tournament,
                "table_max_seats": hand.table_max_seats,
            },
        )

    # ── Spot type detection ───────────────────────────────────────────────────

    def _detect_spot_type(self, preflop_actions: list) -> SpotType:
        """
        Derive the pot construction type from the preflop action sequence.

        Rules (in evaluation order):
          1. No raises at all               → LIMPED
          2. Exactly one raise, with limps  → ISO_RAISE
          3. Exactly one raise, clean       → SRP
          4. Two raises, callers between    → SQUEEZE
          5. Two raises, no callers between → THREE_BET
          6. Three or more raises           → FOUR_BET
        """
        # Strip blind posts / antes — only voluntary actions matter
        voluntary = [a for a in preflop_actions if a.action not in _POST_ACTIONS]

        raises = [a for a in voluntary if a.action in _RAISE_ACTIONS]

        if not raises:
            return SpotType.LIMPED

        if len(raises) == 1:
            # Any voluntary CALL before the raise = limper(s) present
            raise_idx = voluntary.index(raises[0])
            pre_raise = voluntary[:raise_idx]
            has_limps = any(a.action in _CALL_ACTIONS for a in pre_raise)
            return SpotType.ISO_RAISE if has_limps else SpotType.SRP

        if len(raises) == 2:
            # Callers between the two raises = squeeze scenario
            idx1 = voluntary.index(raises[0])
            idx2 = voluntary.index(raises[1])
            between = voluntary[idx1 + 1:idx2]
            has_callers = any(a.action in _CALL_ACTIONS for a in between)
            return SpotType.SQUEEZE if has_callers else SpotType.THREE_BET

        return SpotType.FOUR_BET

    # ── Positional matchup ────────────────────────────────────────────────────

    def _detect_position_matchup(
        self,
        active_players: list[CanonicalPlayer],
        player_count: int,
    ) -> PositionMatchup:
        """
        Build the PositionMatchup enum value from active survivors.

        For heads-up pots: derives IP_vs_OOP string and maps to enum.
        For multiway pots: returns the appropriate MULTIWAY_NxWAY bucket.
        Falls back to UNKNOWN if the matchup string is not in the enum.
        """
        if player_count >= 3:
            if player_count == 3:
                return PositionMatchup.MULTIWAY_3WAY
            if player_count == 4:
                return PositionMatchup.MULTIWAY_4WAY
            if player_count == 5:
                return PositionMatchup.MULTIWAY_5WAY
            return PositionMatchup.MULTIWAY_6WAY_PLUS

        if len(active_players) < 2:
            return PositionMatchup.UNKNOWN

        sorted_players = sorted(
            active_players, key=lambda p: postflop_position_rank(p.position)
        )
        oop = sorted_players[0]
        ip = sorted_players[-1]

        ip_key = normalize_position_for_matchup(ip.position)
        oop_key = normalize_position_for_matchup(oop.position)
        matchup_str = f"{ip_key}_vs_{oop_key}"

        try:
            return PositionMatchup(matchup_str)
        except ValueError:
            return PositionMatchup.UNKNOWN

    # ── IP / OOP detection ────────────────────────────────────────────────────

    def _is_hero_ip(
        self,
        hand: CanonicalHand,
        active_players: list[CanonicalPlayer],
    ) -> bool:
        """
        Return True when the hero is the in-position player postflop.

        IP = acts last postflop = highest postflop_position_rank among
        active survivors.  Ties broken in hero's favour (conservative).
        """
        if not active_players:
            return False

        hero = self._hero(hand)
        if not hero:
            return False

        hero_rank = postflop_position_rank(hero.position)
        max_rank = max(postflop_position_rank(p.position) for p in active_players)
        return hero_rank == max_rank

    # ── Stack / SPR helpers ───────────────────────────────────────────────────

    def _flop_pot(self, hand: CanonicalHand) -> float:
        """
        Pot size (in BB) at the start of the flop.

        Multi-level fallback so the correct value is recovered even when
        CanonicalStreet.pot_start_bb was not explicitly set (default 0.0):

          1. flop.pot_start_bb         — when explicitly populated
          2. last preflop action's pot_after_bb — reflects pot built during action
          3. sum of preflop amount_bb values    — reconstruct from raw action amounts
          4. hand.final_pot_bb                  — last-resort proxy for preflop-only hands
        """
        preflop = next(
            (s for s in hand.streets if s.name == Street.PREFLOP), None
        )
        flop = next(
            (s for s in hand.streets if s.name == Street.FLOP), None
        )

        if flop is not None:
            # Level 1: explicitly set pot
            if flop.pot_start_bb > 0:
                return flop.pot_start_bb

            # Level 2: last preflop action's pot_after_bb
            if preflop and preflop.actions:
                last = preflop.actions[-1]
                if last.pot_after_bb > 0:
                    return last.pot_after_bb

            # Level 3: sum all preflop action amounts
            if preflop and preflop.actions:
                total = sum(a.amount_bb for a in preflop.actions)
                if total > 0:
                    return total

            # No preflop data at all — pot is genuinely unknown
            return 0.0

        # Hand ended preflop — use final_pot_bb as a proxy
        return hand.final_pot_bb

    def _effective_stack_at_flop(
        self,
        hand: CanonicalHand,
        active_players: list[CanonicalPlayer],
    ) -> float:
        """
        Effective stack (in BB) at the start of the flop.

        Reconstructs per-player stacks from preflop action tracking.

        Bug fix: CanonicalAction.stack_after_bb defaults to 0.0 (not None),
        so the old `is not None` guard always fired and overwrote the correct
        initial stack (e.g. 100 BB) with 0.0 for every un-populated action.

        The fix: only apply a stack_after_bb update when the value is strictly
        positive — zero is never a valid post-action stack unless the player
        is all-in, and all-in players are excluded from the effective-stack
        minimum by the is_all_in flag on the action.

        Fallback chain:
          1. min of per-player stacks after preflop replay (if any > 0)
          2. hand.effective_stack_bb (if > 0)
          3. min of raw player.stack_bb values
        """
        # Seed with initial stacks from the player records
        stacks: dict[str, float] = {p.id: p.stack_bb for p in hand.players}

        preflop = next(
            (s for s in hand.streets if s.name == Street.PREFLOP), None
        )
        if preflop:
            for action in preflop.actions:
                # Only update when stack_after_bb was explicitly populated (> 0).
                # A default 0.0 would corrupt the per-player stack map and cause
                # min([0, 0]) = 0 to be returned as the effective stack.
                if action.stack_after_bb > 0:
                    stacks[action.player_id] = action.stack_after_bb

        active_ids = {p.id for p in active_players}
        active_stacks = [v for pid, v in stacks.items() if pid in active_ids]

        if not active_stacks:
            return hand.effective_stack_bb

        result = min(active_stacks)

        # Level-2 fallback: if replay produced 0 but we have a canonical field, use it
        if result <= 0 and hand.effective_stack_bb > 0:
            return hand.effective_stack_bb

        return result

    # ── Board classification ──────────────────────────────────────────────────

    def _board_cards(self, hand: CanonicalHand) -> list[str]:
        """
        Collect all board cards in order (flop → turn → river).

        Each CanonicalStreet.board_cards contains only the new cards for
        that street.  We skip the preflop street (no board cards).
        """
        cards: list[str] = []
        for street in hand.streets:
            if street.name != Street.PREFLOP:
                cards.extend(c.notation for c in street.board_cards)
        return cards

    def _classify_board(
        self, board_cards: list[str]
    ) -> tuple[BoardClassEnum, Optional[BoardFeatures]]:
        """
        Classify the board into a BoardClassEnum and BoardFeatures profile.

        Routes to the correct BoardClassifier method based on board length:
          3 cards → classify_flop
          4 cards → classify_turn
          5 cards → classify_river

        Returns (UNKNOWN, None) for preflop-only hands.
        """
        n = len(board_cards)

        if n == 0:
            return BoardClassEnum.NEUTRAL, None

        if n == 3:
            features = _board_classifier.classify_flop(board_cards)
        elif n == 4:
            features = _board_classifier.classify_turn(board_cards[:3], board_cards[3])
        elif n >= 5:
            features = _board_classifier.classify_river(board_cards[:4], board_cards[4])
        else:
            # 1 or 2 cards — incomplete / malformed board; return safe defaults
            return BoardClassEnum.NEUTRAL, None

        return features.board_class, features

    # ── Street derivation ─────────────────────────────────────────────────────

    def _current_street(self, hand: CanonicalHand) -> SolverStreet:
        """
        Return the deepest street present in the hand.

        Relies on the ordering guarantee of CanonicalHand.streets
        (preflop → flop → turn → river).
        """
        if hand.streets:
            return SolverStreet(hand.streets[-1].name.value)
        return SolverStreet.PREFLOP

    # ── Low-level helpers ─────────────────────────────────────────────────────

    def _preflop_actions(self, hand: CanonicalHand) -> list:
        preflop = next(
            (s for s in hand.streets if s.name == Street.PREFLOP), None
        )
        return preflop.actions if preflop else []

    def _active_players_at_flop(self, hand: CanonicalHand) -> list[CanonicalPlayer]:
        """
        Players who survived to the flop (did not fold preflop).

        Supports multiway pots: all non-folding players are returned,
        not just hero + one villain.
        """
        preflop = next(
            (s for s in hand.streets if s.name == Street.PREFLOP), None
        )
        if not preflop:
            return list(hand.players)

        folded_preflop = {
            a.player_id
            for a in preflop.actions
            if a.action == ActionType.FOLD
        }
        return [p for p in hand.players if p.id not in folded_preflop]

    def _hero(self, hand: CanonicalHand) -> Optional[CanonicalPlayer]:
        return next((p for p in hand.players if p.id == hand.hero_id), None)
