"""
Regression tests for SolverSpotClassifier.

Covers the full abstraction pipeline:
    CanonicalHand → SolverSpot → BoardFeatures → NodeKey

Key regression scenarios:
    — BTN vs BB SRP flop 9h 8h 7c (connected dynamic low board)
    — Defaults: pot_start_bb=0 and stack_after_bb=0 must not corrupt output
    — Pot reconstruction from preflop action amounts
    — Effective stack fallback chain
    — Board classification routing (flop/turn/river)
    — Position matchup derivation
    — Spot type detection (SRP / 3BET / LIMPED / SQUEEZE)
"""

import pytest

from app.models.canonical import CanonicalHand
from app.solver.abstractions import SpotAbstraction
from app.solver.enums import BoardClassEnum, PositionMatchup, SolverStreet, SpotType
from app.solver.spot_classifier import SolverSpotClassifier

clf = SolverSpotClassifier()


# ── Hand-building helpers ──────────────────────────────────────────────────────

def _make_hand(
    *,
    hero_pos: str = "BTN",
    villain_pos: str = "BB",
    hero_stack: float = 100.0,
    villain_stack: float = 100.0,
    effective_stack_bb: float = 97.5,
    final_pot_bb: float = 8.5,
    preflop_actions: list | None = None,
    flop_cards: list[dict] | None = None,
    flop_pot_start_bb: float = 5.0,
    flop_actions: list | None = None,
    turn_card: dict | None = None,
    turn_pot_start_bb: float = 0.0,
) -> CanonicalHand:
    """
    Construct a CanonicalHand with sane defaults.

    Keeps tests readable — only supply what the test cares about.
    All stack/pot fields are fully set so no fallback chain is needed
    unless the test explicitly overrides them to test resilience.
    """
    if preflop_actions is None:
        preflop_actions = [
            _action(0, "preflop", "p2", "Villain", "post_bb", amount=1.0,
                    stack_before=villain_stack, stack_after=villain_stack - 1.0,
                    pot_before=0.0, pot_after=1.0),
            _action(1, "preflop", "p1", "Hero", "raise", amount=2.5, total=2.5,
                    stack_before=hero_stack, stack_after=hero_stack - 2.5,
                    pot_before=1.0, pot_after=3.5),
            _action(2, "preflop", "p2", "Villain", "call", amount=1.5, total=2.5,
                    stack_before=villain_stack - 1.0, stack_after=villain_stack - 2.5,
                    pot_before=3.5, pot_after=5.0),
        ]

    streets = [{"name": "preflop", "board_cards": [], "pot_start_bb": 0.0, "actions": preflop_actions}]

    if flop_cards is not None:
        _flop_actions = flop_actions or []
        streets.append({
            "name": "flop",
            "board_cards": flop_cards,
            "pot_start_bb": flop_pot_start_bb,
            "actions": _flop_actions,
        })

    if turn_card is not None:
        streets.append({
            "name": "turn",
            "board_cards": [turn_card],
            "pot_start_bb": turn_pot_start_bb,
            "actions": [],
        })

    return CanonicalHand(
        hand_id="test",
        site="GGPoker",
        game_type="NLHE",
        stakes={"big_blind": 1.0, "display": "usd"},
        players=[
            {"id": "p1", "name": "Hero", "seat": 1, "position": hero_pos,
             "stack_bb": hero_stack, "is_hero": True, "is_active": True},
            {"id": "p2", "name": "Villain", "seat": 2, "position": villain_pos,
             "stack_bb": villain_stack, "is_hero": False, "is_active": True},
        ],
        hero_id="p1",
        streets=streets,
        effective_stack_bb=effective_stack_bb,
        final_pot_bb=final_pot_bb,
    )


def _action(
    seq: int, street: str, pid: str, name: str, action: str,
    *,
    amount: float = 0.0,
    total: float = 0.0,
    stack_before: float = 0.0,
    stack_after: float = 0.0,
    pot_before: float = 0.0,
    pot_after: float = 0.0,
    is_hero: bool = False,
) -> dict:
    return {
        "sequence": seq, "street": street, "player_id": pid,
        "player_name": name, "action": action,
        "amount_bb": amount, "total_bet_bb": total,
        "is_hero": is_hero, "is_all_in": False,
        "stack_before_bb": stack_before, "stack_after_bb": stack_after,
        "pot_before_bb": pot_before, "pot_after_bb": pot_after,
    }


_FLOP_987 = [
    {"rank": "9", "suit": "h", "notation": "9h"},
    {"rank": "8", "suit": "h", "notation": "8h"},
    {"rank": "7", "suit": "c", "notation": "7c"},
]

_FLOP_AK3 = [
    {"rank": "A", "suit": "h", "notation": "Ah"},
    {"rank": "K", "suit": "d", "notation": "Kd"},
    {"rank": "3", "suit": "c", "notation": "3c"},
]

_FLOP_MONOTONE = [
    {"rank": "K", "suit": "h", "notation": "Kh"},
    {"rank": "8", "suit": "h", "notation": "8h"},
    {"rank": "3", "suit": "h", "notation": "3h"},
]

_FLOP_PAIRED = [
    {"rank": "Q", "suit": "h", "notation": "Qh"},
    {"rank": "Q", "suit": "d", "notation": "Qd"},
    {"rank": "5", "suit": "c", "notation": "5c"},
]

_FLOP_TRIPLE_BW = [
    {"rank": "Q", "suit": "s", "notation": "Qs"},
    {"rank": "J", "suit": "h", "notation": "Jh"},
    {"rank": "T", "suit": "c", "notation": "Tc"},
]

_FLOP_KQ4 = [
    {"rank": "K", "suit": "d", "notation": "Kd"},
    {"rank": "Q", "suit": "h", "notation": "Qh"},
    {"rank": "4", "suit": "s", "notation": "4s"},
]


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 1: Primary regression — BTN vs BB SRP on 9h 8h 7c
# ══════════════════════════════════════════════════════════════════════════════


class TestBTNvsBBSRPLowDynamic:
    """
    Regression: BTN opens, BB calls, flop 9h 8h 7c.

    This is the hand from the bug report that produced:
        LIMPED / pot=0 / spr=0 / NEUTRAL / board_features=null

    Expected:
        SRP / BTN_vs_BB / LOW_DYNAMIC / pot=5.0 / populated board_features
    """

    def setup_method(self):
        hand = _make_hand(flop_cards=_FLOP_987)
        self.spot = SpotAbstraction.from_canonical_hand(hand).solver_spot
        self.key = SpotAbstraction.from_canonical_hand(hand).node_key

    def test_spot_type_srp(self):
        assert self.spot.spot_type == SpotType.SRP

    def test_position_matchup(self):
        assert self.spot.position_matchup == PositionMatchup.BTN_vs_BB

    def test_hero_ip(self):
        assert self.spot.is_ip is True

    def test_board_class_low_dynamic(self):
        assert self.spot.board_class == BoardClassEnum.LOW_DYNAMIC

    def test_pot_nonzero(self):
        assert self.spot.pot_bb == 5.0

    def test_spr_realistic(self):
        assert self.spot.spr > 10.0

    def test_effective_stack_nonzero(self):
        assert self.spot.effective_stack_bb > 0

    def test_board_features_populated(self):
        assert self.spot.board_texture is not None

    def test_dynamic(self):
        assert self.spot.board_texture.dynamic is True

    def test_flush_draw(self):
        assert self.spot.board_texture.flush_draw_possible is True

    def test_straight_draw(self):
        assert self.spot.board_texture.straight_draw_possible is True

    def test_connectivity_high(self):
        assert self.spot.board_texture.connectedness_score >= 8

    def test_street_flop(self):
        assert self.spot.street == SolverStreet.FLOP

    def test_node_key_string(self):
        assert "SRP" in self.key.to_string()
        assert "BTN_vs_BB" in self.key.to_string()
        assert "LOW_DYNAMIC" in self.key.to_string()
        assert "flop" in self.key.to_string()


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 2: Default-field resilience (the core bug regression)
# ══════════════════════════════════════════════════════════════════════════════


class TestDefaultFieldResilience:
    """
    Regression for the root-cause bugs:

    Bug 1 — _effective_stack_at_flop:
        CanonicalAction.stack_after_bb defaults to 0.0.
        The old guard (is not None) is always True, so 0.0 overwrote
        the correct initial stack for every player → min([0,0]) = 0.

    Bug 2 — _flop_pot:
        CanonicalStreet.pot_start_bb defaults to 0.0.
        The old code returned it directly → pot_bb=0 → spr=0.

    Both bugs together produce the exact symptom report:
        pot=0 / spr=0 / effective_stack=0
    """

    def _make_minimal(self, *, set_stack_after: bool, set_pot_start: bool) -> CanonicalHand:
        """Build a hand with or without the optional fields populated."""
        preflop_actions = [
            {"sequence": 0, "street": "preflop", "player_id": "p2", "player_name": "V",
             "action": "post_bb", "amount_bb": 1.0},
            {"sequence": 1, "street": "preflop", "player_id": "p1", "player_name": "Hero",
             "action": "raise", "amount_bb": 2.5, "total_bet_bb": 2.5},
            {"sequence": 2, "street": "preflop", "player_id": "p2", "player_name": "V",
             "action": "call", "amount_bb": 1.5},
        ]
        if set_stack_after:
            preflop_actions[1]["stack_after_bb"] = 97.5
            preflop_actions[2]["stack_after_bb"] = 97.5

        return _make_hand(
            preflop_actions=preflop_actions,
            flop_cards=_FLOP_987,
            flop_pot_start_bb=5.0 if set_pot_start else 0.0,
            effective_stack_bb=97.5,
            final_pot_bb=8.5,
        )

    def test_all_defaults_pot_nonzero(self):
        """Both stack_after_bb and pot_start_bb left at default 0 → pot must still be correct."""
        hand = self._make_minimal(set_stack_after=False, set_pot_start=False)
        spot = clf.classify(hand)
        assert spot.pot_bb > 0, "pot_bb must not be 0 when flop exists"

    def test_all_defaults_spr_nonzero(self):
        hand = self._make_minimal(set_stack_after=False, set_pot_start=False)
        spot = clf.classify(hand)
        assert spot.spr > 0, "spr must not be 0 when pot is non-zero"

    def test_all_defaults_eff_stack_nonzero(self):
        hand = self._make_minimal(set_stack_after=False, set_pot_start=False)
        spot = clf.classify(hand)
        assert spot.effective_stack_bb > 0, "effective_stack_bb must not be 0"

    def test_all_defaults_board_class_correct(self):
        hand = self._make_minimal(set_stack_after=False, set_pot_start=False)
        spot = clf.classify(hand)
        assert spot.board_class == BoardClassEnum.LOW_DYNAMIC

    def test_all_defaults_board_features_populated(self):
        hand = self._make_minimal(set_stack_after=False, set_pot_start=False)
        spot = clf.classify(hand)
        assert spot.board_texture is not None

    def test_pot_start_set_no_stack_after(self):
        """pot_start_bb set, stack_after_bb at default."""
        hand = self._make_minimal(set_stack_after=False, set_pot_start=True)
        spot = clf.classify(hand)
        assert spot.pot_bb == 5.0
        assert spot.effective_stack_bb > 0

    def test_stack_after_set_no_pot_start(self):
        """stack_after_bb set, pot_start_bb at default."""
        hand = self._make_minimal(set_stack_after=True, set_pot_start=False)
        spot = clf.classify(hand)
        assert spot.pot_bb > 0
        assert spot.effective_stack_bb == pytest.approx(97.5)

    def test_both_set_reference(self):
        """Fully populated — reference baseline."""
        hand = self._make_minimal(set_stack_after=True, set_pot_start=True)
        spot = clf.classify(hand)
        assert spot.pot_bb == 5.0
        assert spot.spr == pytest.approx(97.5 / 5.0)
        assert spot.effective_stack_bb == pytest.approx(97.5)


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 3: Pot reconstruction from preflop action amounts
# ══════════════════════════════════════════════════════════════════════════════


class TestPotReconstruction:
    """
    When pot_start_bb=0 on the flop, the classifier must reconstruct
    the pot from preflop action data.

    Reconstruction priority:
      1. flop.pot_start_bb (if > 0)
      2. last preflop action's pot_after_bb (if > 0)
      3. sum of all preflop amount_bb values
    """

    def test_reconstruct_from_pot_after_bb(self):
        """Last preflop action has pot_after_bb set → use it."""
        preflop_actions = [
            {"sequence": 0, "street": "preflop", "player_id": "p2", "player_name": "V",
             "action": "post_bb", "amount_bb": 1.0, "pot_after_bb": 1.0},
            {"sequence": 1, "street": "preflop", "player_id": "p1", "player_name": "Hero",
             "action": "raise", "amount_bb": 2.5, "total_bet_bb": 2.5, "pot_after_bb": 3.5},
            {"sequence": 2, "street": "preflop", "player_id": "p2", "player_name": "V",
             "action": "call", "amount_bb": 1.5, "pot_after_bb": 5.0},
        ]
        hand = _make_hand(preflop_actions=preflop_actions, flop_cards=_FLOP_987, flop_pot_start_bb=0.0)
        spot = clf.classify(hand)
        assert spot.pot_bb == pytest.approx(5.0)

    def test_reconstruct_from_sum_of_amounts(self):
        """No pot_after_bb on any action → sum amount_bb values."""
        preflop_actions = [
            {"sequence": 0, "street": "preflop", "player_id": "p2", "player_name": "V",
             "action": "post_bb", "amount_bb": 1.0},
            {"sequence": 1, "street": "preflop", "player_id": "p1", "player_name": "Hero",
             "action": "raise", "amount_bb": 2.5, "total_bet_bb": 2.5},
            {"sequence": 2, "street": "preflop", "player_id": "p2", "player_name": "V",
             "action": "call", "amount_bb": 1.5},
        ]
        hand = _make_hand(preflop_actions=preflop_actions, flop_cards=_FLOP_987, flop_pot_start_bb=0.0)
        spot = clf.classify(hand)
        # 1.0 + 2.5 + 1.5 = 5.0
        assert spot.pot_bb == pytest.approx(5.0)

    def test_explicit_pot_start_wins(self):
        """pot_start_bb explicitly set → no reconstruction needed."""
        hand = _make_hand(flop_cards=_FLOP_987, flop_pot_start_bb=6.0)
        spot = clf.classify(hand)
        assert spot.pot_bb == pytest.approx(6.0)


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 4: Effective stack fallback chain
# ══════════════════════════════════════════════════════════════════════════════


class TestEffectiveStackFallback:
    """
    Effective stack reconstruction must not be corrupted by default 0.0
    values in CanonicalAction.stack_after_bb.
    """

    def test_uses_player_stack_when_no_stack_after(self):
        """No stack_after_bb set → uses player.stack_bb as seed."""
        preflop_actions = [
            {"sequence": 0, "street": "preflop", "player_id": "p2", "player_name": "V",
             "action": "post_bb", "amount_bb": 1.0},
            {"sequence": 1, "street": "preflop", "player_id": "p1", "player_name": "Hero",
             "action": "raise", "amount_bb": 2.5, "total_bet_bb": 2.5},
            {"sequence": 2, "street": "preflop", "player_id": "p2", "player_name": "V",
             "action": "call", "amount_bb": 1.5},
        ]
        hand = _make_hand(preflop_actions=preflop_actions, flop_cards=_FLOP_987,
                          hero_stack=100.0, villain_stack=100.0, effective_stack_bb=97.5)
        spot = clf.classify(hand)
        # stack_after_bb=0 for all → falls back via hand.effective_stack_bb=97.5
        assert spot.effective_stack_bb > 0

    def test_uses_stack_after_when_set(self):
        """stack_after_bb populated → uses those values."""
        hand = _make_hand(flop_cards=_FLOP_987, effective_stack_bb=97.5)
        spot = clf.classify(hand)
        assert spot.effective_stack_bb == pytest.approx(97.5)

    def test_asymmetric_stacks_uses_min(self):
        """Deep vs short stack → effective stack = min."""
        preflop_actions = [
            {"sequence": 0, "street": "preflop", "player_id": "p2", "player_name": "V",
             "action": "post_bb", "amount_bb": 1.0, "stack_after_bb": 49.0},
            {"sequence": 1, "street": "preflop", "player_id": "p1", "player_name": "Hero",
             "action": "raise", "amount_bb": 2.5, "total_bet_bb": 2.5, "stack_after_bb": 197.5},
            {"sequence": 2, "street": "preflop", "player_id": "p2", "player_name": "V",
             "action": "call", "amount_bb": 1.5, "stack_after_bb": 47.5},
        ]
        hand = _make_hand(preflop_actions=preflop_actions, flop_cards=_FLOP_987,
                          hero_stack=200.0, villain_stack=50.0, effective_stack_bb=47.5)
        spot = clf.classify(hand)
        assert spot.effective_stack_bb == pytest.approx(47.5)


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 5: Spot type detection
# ══════════════════════════════════════════════════════════════════════════════


class TestSpotTypeDetection:

    def _spot_type_for(self, preflop_actions: list) -> SpotType:
        hand = _make_hand(preflop_actions=preflop_actions, flop_cards=_FLOP_AK3)
        return clf.classify(hand).spot_type

    def test_srp_open_and_call(self):
        actions = [
            _action(0, "preflop", "p2", "V", "post_bb", amount=1.0, stack_after=99.0, pot_after=1.0),
            _action(1, "preflop", "p1", "Hero", "raise", amount=2.5, total=2.5, stack_after=97.5, pot_after=3.5),
            _action(2, "preflop", "p2", "V", "call", amount=1.5, total=2.5, stack_after=97.5, pot_after=5.0),
        ]
        assert self._spot_type_for(actions) == SpotType.SRP

    def test_limped_no_raise(self):
        actions = [
            _action(0, "preflop", "p2", "V", "post_bb", amount=1.0, stack_after=99.0, pot_after=1.0),
            _action(1, "preflop", "p1", "Hero", "call", amount=1.0, stack_after=99.0, pot_after=2.0),
        ]
        assert self._spot_type_for(actions) == SpotType.LIMPED

    def test_three_bet_two_raises(self):
        actions = [
            _action(0, "preflop", "p2", "V", "post_bb", amount=1.0, stack_after=99.0, pot_after=1.0),
            _action(1, "preflop", "p1", "Hero", "raise", amount=2.5, total=2.5, stack_after=97.5, pot_after=3.5),
            _action(2, "preflop", "p2", "V", "raise", amount=7.5, total=7.5, stack_after=91.5, pot_after=11.0),
            _action(3, "preflop", "p1", "Hero", "call", amount=5.0, total=7.5, stack_after=90.0, pot_after=15.5),
        ]
        assert self._spot_type_for(actions) == SpotType.THREE_BET


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 6: Position matchup derivation
# ══════════════════════════════════════════════════════════════════════════════


class TestPositionMatchup:

    def _matchup_for(self, hero_pos: str, villain_pos: str) -> PositionMatchup:
        hand = _make_hand(hero_pos=hero_pos, villain_pos=villain_pos, flop_cards=_FLOP_AK3)
        return clf.classify(hand).position_matchup

    def test_btn_vs_bb(self):
        assert self._matchup_for("BTN", "BB") == PositionMatchup.BTN_vs_BB

    def test_co_vs_bb(self):
        assert self._matchup_for("CO", "BB") == PositionMatchup.CO_vs_BB

    def test_hj_vs_bb(self):
        assert self._matchup_for("HJ", "BB") == PositionMatchup.HJ_vs_BB

    def test_btn_is_ip(self):
        hand = _make_hand(hero_pos="BTN", villain_pos="BB", flop_cards=_FLOP_AK3)
        spot = clf.classify(hand)
        assert spot.is_ip is True

    def test_bb_is_oop(self):
        hand = _make_hand(hero_pos="BB", villain_pos="BTN", flop_cards=_FLOP_AK3)
        spot = clf.classify(hand)
        assert spot.is_ip is False


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 7: Board classification routing
# ══════════════════════════════════════════════════════════════════════════════


class TestBoardClassificationRouting:

    def test_no_board_returns_neutral(self):
        hand = _make_hand()  # no flop_cards
        spot = clf.classify(hand)
        assert spot.board_class == BoardClassEnum.NEUTRAL
        assert spot.board_texture is None

    def test_flop_board_classified(self):
        hand = _make_hand(flop_cards=_FLOP_AK3)
        spot = clf.classify(hand)
        assert spot.board_class == BoardClassEnum.A_HIGH_DRY
        assert spot.board_texture is not None

    def test_turn_board_classified(self):
        hand = _make_hand(
            flop_cards=_FLOP_987,
            turn_card={"rank": "A", "suit": "s", "notation": "As"},
            turn_pot_start_bb=10.0,
        )
        spot = clf.classify(hand)
        # Turn street should be the classified street
        assert spot.street == SolverStreet.TURN
        assert spot.board_texture is not None

    def test_flop_low_connected_is_dynamic(self):
        hand = _make_hand(flop_cards=_FLOP_987)
        spot = clf.classify(hand)
        assert spot.board_texture is not None
        assert spot.board_texture.dynamic is True

    def test_flop_ak3_is_static(self):
        hand = _make_hand(flop_cards=_FLOP_AK3)
        spot = clf.classify(hand)
        assert spot.board_texture is not None
        assert spot.board_texture.static is True


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 8: SPR bucketing correctness
# ══════════════════════════════════════════════════════════════════════════════


class TestSPRBucketing:

    def test_deep_spr_bucket(self):
        """100bb stacks, 5bb pot → SPR ~20 → 8_PLUS bucket."""
        hand = _make_hand(flop_cards=_FLOP_AK3)
        spot = clf.classify(hand)
        assert spot.spr_bucket.value == "8_PLUS"

    def test_spr_calculated_from_pot_and_stack(self):
        hand = _make_hand(flop_cards=_FLOP_AK3)
        spot = clf.classify(hand)
        expected_spr = spot.effective_stack_bb / spot.pot_bb
        assert spot.spr == pytest.approx(expected_spr, rel=0.01)

    def test_no_divide_by_zero_when_pot_reconstructed(self):
        """Even with all defaults, spr should never raise ZeroDivisionError."""
        preflop_actions = [
            {"sequence": 0, "street": "preflop", "player_id": "p2", "player_name": "V",
             "action": "post_bb", "amount_bb": 1.0},
            {"sequence": 1, "street": "preflop", "player_id": "p1", "player_name": "Hero",
             "action": "raise", "amount_bb": 2.5, "total_bet_bb": 2.5},
            {"sequence": 2, "street": "preflop", "player_id": "p2", "player_name": "V",
             "action": "call", "amount_bb": 1.5},
        ]
        hand = _make_hand(preflop_actions=preflop_actions, flop_cards=_FLOP_987, flop_pot_start_bb=0.0)
        spot = clf.classify(hand)  # must not raise
        assert spot.spr >= 0


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 9: SpotAbstraction output completeness
# ══════════════════════════════════════════════════════════════════════════════


class TestSpotAbstractionOutput:
    """End-to-end: SpotAbstraction.from_canonical_hand returns complete output."""

    def setup_method(self):
        hand = _make_hand(flop_cards=_FLOP_987)
        self.abstraction = SpotAbstraction.from_canonical_hand(hand)

    def test_node_key_string_populated(self):
        assert self.abstraction.node_key_string != ""
        assert "::" in self.abstraction.node_key_string

    def test_node_key_contains_all_segments(self):
        parts = self.abstraction.node_key_string.split("::")
        assert len(parts) == 7  # spot::matchup::stack::spr::board::street::Np

    def test_solver_spot_not_empty(self):
        d = self.abstraction.solver_spot.model_dump()
        assert d["spot_type"] == "SRP"
        assert d["board_class"] == "LOW_DYNAMIC"

    def test_board_features_serialisable(self):
        bt = self.abstraction.solver_spot.board_texture
        assert bt is not None
        d = bt.model_dump()
        assert d["dynamic"] is True
        assert d["connectedness_score"] >= 8

    def test_positional_prefix(self):
        prefix = self.abstraction.node_key.positional_prefix()
        assert prefix == "SRP::BTN_vs_BB"

    def test_street_prefix(self):
        prefix = self.abstraction.node_key.street_prefix()
        assert "flop" in prefix


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 10: Full board-type regression suite
#
# Every common flop texture must produce the correct board_class through the
# full CanonicalHand → SolverSpot pipeline (not just the BoardClassifier).
# ══════════════════════════════════════════════════════════════════════════════


class TestBoardTypeRegression:
    """
    Regression fixtures for each strategically distinct flop type.
    Guards against board extraction or classifier invocation regressions.
    """

    def test_low_connected_987(self):
        spot = clf.classify(_make_hand(flop_cards=_FLOP_987))
        assert spot.board_class == BoardClassEnum.LOW_DYNAMIC
        assert spot.board_texture is not None
        assert spot.board_texture.dynamic is True
        assert spot.board_texture.connectedness_score >= 8

    def test_a_high_dry_ak3(self):
        spot = clf.classify(_make_hand(flop_cards=_FLOP_AK3))
        assert spot.board_class == BoardClassEnum.A_HIGH_DRY
        assert spot.board_texture.static is True
        assert spot.board_texture.broadway_count == 2

    def test_monotone_k83_hearts(self):
        spot = clf.classify(_make_hand(flop_cards=_FLOP_MONOTONE))
        assert spot.board_class == BoardClassEnum.MONOTONE
        assert spot.board_texture.monotone is True
        assert spot.board_texture.flush_completed is True

    def test_paired_high_qq5(self):
        spot = clf.classify(_make_hand(flop_cards=_FLOP_PAIRED))
        assert spot.board_class == BoardClassEnum.PAIRED_HIGH
        assert spot.board_texture.paired is True
        assert spot.board_texture.trips is False

    def test_triple_broadway_qjt(self):
        spot = clf.classify(_make_hand(flop_cards=_FLOP_TRIPLE_BW))
        assert spot.board_class == BoardClassEnum.TRIPLE_BROADWAY
        assert spot.board_texture.broadway_count == 3
        assert spot.board_texture.connectedness_score == 10

    def test_double_broadway_kq4(self):
        spot = clf.classify(_make_hand(flop_cards=_FLOP_KQ4))
        assert spot.board_class == BoardClassEnum.DOUBLE_BROADWAY
        assert spot.board_texture.broadway_count == 2

    def test_board_features_always_populated_on_flop(self):
        """board_texture must never be null when a flop board exists."""
        for cards in [_FLOP_987, _FLOP_AK3, _FLOP_MONOTONE, _FLOP_PAIRED,
                      _FLOP_TRIPLE_BW, _FLOP_KQ4]:
            spot = clf.classify(_make_hand(flop_cards=cards))
            assert spot.board_texture is not None, (
                f"board_texture is null for {[c['notation'] for c in cards]}"
            )


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 11: Turn evolution through pipeline
# ══════════════════════════════════════════════════════════════════════════════


class TestTurnEvolutionPipeline:
    """Verify that turn cards are extracted and classified correctly."""

    def test_flush_completing_turn(self):
        """9h 8h 2c → Th completes the flush draw."""
        flop = [
            {"rank": "9", "suit": "h", "notation": "9h"},
            {"rank": "8", "suit": "h", "notation": "8h"},
            {"rank": "2", "suit": "c", "notation": "2c"},
        ]
        turn = {"rank": "T", "suit": "h", "notation": "Th"}
        spot = clf.classify(_make_hand(
            flop_cards=flop,
            turn_card=turn,
            turn_pot_start_bb=10.0,
        ))
        assert spot.street == SolverStreet.TURN
        assert spot.board_class == BoardClassEnum.FLUSH_COMPLETING
        assert spot.board_texture.flush_completed is True
        assert spot.board_texture.scare_card is True

    def test_overcard_turn(self):
        """6h 5d 2c → Ah is an overcard scare."""
        flop = [
            {"rank": "6", "suit": "h", "notation": "6h"},
            {"rank": "5", "suit": "d", "notation": "5d"},
            {"rank": "2", "suit": "c", "notation": "2c"},
        ]
        turn = {"rank": "A", "suit": "h", "notation": "Ah"}
        spot = clf.classify(_make_hand(
            flop_cards=flop,
            turn_card=turn,
            turn_pot_start_bb=10.0,
        ))
        assert spot.board_texture.scare_card is True
        assert spot.board_texture.high_card_rank == "A"


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 12: 3bet and multiway pot scenarios
# ══════════════════════════════════════════════════════════════════════════════


class TestThreeBetPotPipeline:
    """3bet pot must still produce correct board and stack data."""

    def setup_method(self):
        actions = [
            _action(0, "preflop", "p2", "V", "post_bb", amount=1.0,
                    stack_after=99.0, pot_after=1.0),
            _action(1, "preflop", "p1", "Hero", "raise", amount=3.0, total=3.0,
                    stack_after=97.0, pot_after=4.0),
            _action(2, "preflop", "p2", "V", "raise", amount=9.0, total=9.0,
                    stack_after=90.0, pot_after=13.0),
            _action(3, "preflop", "p1", "Hero", "call", amount=6.0, total=9.0,
                    stack_after=91.0, pot_after=19.0),
        ]
        hand = _make_hand(
            preflop_actions=actions,
            flop_cards=_FLOP_987,
            flop_pot_start_bb=19.0,
            effective_stack_bb=90.0,
            final_pot_bb=19.0,
        )
        self.spot = clf.classify(hand)

    def test_spot_type_three_bet(self):
        assert self.spot.spot_type == SpotType.THREE_BET

    def test_pot_is_large(self):
        assert self.spot.pot_bb == pytest.approx(19.0)

    def test_spr_lower_than_srp(self):
        # 90/19 ≈ 4.7 — much lower than SRP's ~19.5
        assert 3.0 < self.spot.spr < 8.0

    def test_board_still_classified(self):
        assert self.spot.board_class == BoardClassEnum.LOW_DYNAMIC
        assert self.spot.board_texture is not None


class TestMultiwayPot:
    """Three-way pot must report correct player count and matchup."""

    def setup_method(self):
        hand = CanonicalHand(
            hand_id="mw-test",
            site="GGPoker",
            game_type="NLHE",
            stakes={"big_blind": 1.0, "display": "x"},
            players=[
                {"id": "p1", "name": "Hero", "seat": 1, "position": "BTN",
                 "stack_bb": 100.0, "is_hero": True},
                {"id": "p2", "name": "V1", "seat": 2, "position": "BB",
                 "stack_bb": 100.0, "is_hero": False},
                {"id": "p3", "name": "V2", "seat": 3, "position": "CO",
                 "stack_bb": 100.0, "is_hero": False},
            ],
            hero_id="p1",
            streets=[
                {"name": "preflop", "actions": [
                    {"sequence": 0, "street": "preflop", "player_id": "p2",
                     "player_name": "V1", "action": "post_bb", "amount_bb": 1.0},
                    {"sequence": 1, "street": "preflop", "player_id": "p3",
                     "player_name": "V2", "action": "call", "amount_bb": 1.0},
                    {"sequence": 2, "street": "preflop", "player_id": "p1",
                     "player_name": "Hero", "action": "raise", "amount_bb": 4.0,
                     "total_bet_bb": 4.0},
                    {"sequence": 3, "street": "preflop", "player_id": "p2",
                     "player_name": "V1", "action": "call", "amount_bb": 3.0},
                    {"sequence": 4, "street": "preflop", "player_id": "p3",
                     "player_name": "V2", "action": "call", "amount_bb": 3.0},
                ]},
                {"name": "flop",
                 "board_cards": [
                     {"rank": "9", "suit": "h", "notation": "9h"},
                     {"rank": "8", "suit": "h", "notation": "8h"},
                     {"rank": "7", "suit": "c", "notation": "7c"},
                 ],
                 "pot_start_bb": 12.0,
                 "actions": []},
            ],
            effective_stack_bb=96.0,
            final_pot_bb=12.0,
        )
        self.spot = clf.classify(hand)

    def test_player_count_three(self):
        assert self.spot.player_count == 3

    def test_matchup_multiway(self):
        assert self.spot.position_matchup == PositionMatchup.MULTIWAY_3WAY

    def test_board_still_classified(self):
        assert self.spot.board_class == BoardClassEnum.LOW_DYNAMIC
        assert self.spot.board_texture is not None
        assert self.spot.board_texture.dynamic is True

    def test_pot_nonzero(self):
        assert self.spot.pot_bb == 12.0


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 13: Determinism — same hand always same output
# ══════════════════════════════════════════════════════════════════════════════


class TestDeterminism:
    """Running the pipeline 10 times on the same hand must produce identical results."""

    def test_repeated_classify_same_output(self):
        hand = _make_hand(flop_cards=_FLOP_987)
        results = [SpotAbstraction.from_canonical_hand(hand) for _ in range(10)]
        keys = [r.node_key_string for r in results]
        assert len(set(keys)) == 1, f"Non-deterministic: {set(keys)}"

    def test_repeated_classify_same_board_features(self):
        hand = _make_hand(flop_cards=_FLOP_987)
        results = [clf.classify(hand) for _ in range(10)]
        dicts = [r.board_texture.model_dump() for r in results]
        assert all(d == dicts[0] for d in dicts)
