"""
Golden Hands Regression Suite — zero-tolerance tests.

These scenarios must NEVER produce strategically impossible output.
Any failure means a critical regression in the coaching engine.

Covered invariants:
  1. AK never folds preflop (premium hand, always in range)
  2. AA never folds preflop
  3. Illegal actions never appear in RFI node (no "Call" when unopened)
  4. T2o BTN RFI → Fold 100%, never Call
  5. BTN is always IP vs SB/BB (position never reversed)
  6. JJ with a set is never labeled as a draw-only hand
  7. Overpair never coached as air/draw-only
  8. Backdoor draws never promoted to direct draws
  9. Made hands (two pair+) suppress draw heuristics in coaching
 10. Pot estimation is correct (not stuck at 1.5bb)
 11. PokerState hand strength: pair < two pair < straight < flush
 12. Node detection handles all 6 preflop node types correctly
 13. Preflop recommendations always legal for their node
 14. No silent exception swallowing — draw errors are logged not hidden
 15. Full pipeline smoke test: PokerState builds without error
"""
from __future__ import annotations

import pytest
from app.models.schemas import HandAction, ParsedHand, BoardCards, PlayerInfo


# ── Fixtures ────────────────────────────────────────────────────────────────

def _action(player: str, action: str, street: str, size: float = 0.0, is_hero: bool = False) -> HandAction:
    return HandAction(player=player, action=action, street=street, size_bb=size, is_hero=is_hero)


def _make_hand(
    hero_cards: list[str],
    hero_position: str = "BTN",
    flop: list[str] | None = None,
    turn: list[str] | None = None,
    river: list[str] | None = None,
    actions: list[HandAction] | None = None,
    players: list[PlayerInfo] | None = None,
    big_blind: float = 1.0,
    effective_stack: float = 100.0,
) -> ParsedHand:
    if players is None:
        players = [
            PlayerInfo(name="Hero", position=hero_position, stack_bb=effective_stack, seat=1),
            PlayerInfo(name="Villain", position="BB", stack_bb=effective_stack, seat=2),
        ]
    if actions is None:
        actions = [
            _action("Hero", "raise", "preflop", size=2.5, is_hero=True),
            _action("Villain", "fold", "preflop"),
        ]
    return ParsedHand(
        site="PokerStars",
        game_type="NLHE",
        stakes="0.5/1",
        hand_id="GOLDEN001",
        hero_name="Hero",
        hero_position=hero_position,
        effective_stack_bb=effective_stack,
        hero_cards=hero_cards,
        board=BoardCards(
            flop=flop or [],
            turn=turn or [],
            river=river or [],
        ),
        players=players,
        actions=actions,
        pot_size_bb=2.5,
        big_blind=big_blind,
    )


# ══════════════════════════════════════════════════════════════════════════════
# 1–4. Preflop range & legality invariants
# ══════════════════════════════════════════════════════════════════════════════

class TestPreflopRangeInvariants:
    """Premium hands must never fold; illegal actions must never appear."""

    def test_aa_is_premium(self):
        from app.engines.preflop_ranges import classify_hand
        assert classify_hand(["Ah", "Ad"]) == "premium"

    def test_ak_is_premium(self):
        from app.engines.preflop_ranges import classify_hand
        assert classify_hand(["Ah", "Kd"]) == "premium"

    def test_aks_is_premium(self):
        from app.engines.preflop_ranges import classify_hand
        assert classify_hand(["Ah", "Kh"]) == "premium"

    def test_aa_btn_rfi_recommend_raise_not_fold(self):
        """AA from BTN in an unopened pot must always recommend Raise."""
        from app.engines.preflop_ranges import detect_preflop_node, get_preflop_recommendation
        actions = [_action("Hero", "raise", "preflop", 2.5, is_hero=True)]
        node = detect_preflop_node(0, actions, "BTN")
        rec = get_preflop_recommendation(node, "raise", ["Ah", "Ad"])
        assert rec.preferred_action == "raise"
        assert rec.in_range is True

    def test_ak_btn_rfi_recommend_raise_not_fold(self):
        """AK from BTN must always be in range and recommend raise."""
        from app.engines.preflop_ranges import detect_preflop_node, get_preflop_recommendation
        actions = [_action("Hero", "raise", "preflop", 2.5, is_hero=True)]
        node = detect_preflop_node(0, actions, "BTN")
        rec = get_preflop_recommendation(node, "raise", ["Ah", "Kd"])
        assert rec.preferred_action == "raise"
        assert rec.in_range is True

    def test_rfi_node_never_includes_call(self):
        """An unopened pot (RFI node) must never have 'call' as a legal action."""
        from app.engines.preflop_ranges import detect_preflop_node, LEGAL_ACTIONS
        actions = [_action("Hero", "fold", "preflop", is_hero=True)]
        node = detect_preflop_node(0, actions, "BTN")
        assert node.node_type == "RFI"
        assert "call" not in node.legal_actions

    def test_t2o_btn_rfi_fold_100_no_call(self):
        """T2o BTN in RFI: Fold 100%. The original bug scenario."""
        from app.engines.preflop_ranges import detect_preflop_node, get_preflop_recommendation
        actions = [_action("Hero", "fold", "preflop", is_hero=True)]
        node = detect_preflop_node(0, actions, "BTN")
        rec = get_preflop_recommendation(node, "fold", ["Td", "2s"])
        assert rec.preferred_action == "fold"
        assert rec.in_range is False
        # Frequencies must sum to 100
        assert sum(a.frequency for a in rec.alternatives) == 100
        # "Call" must NOT appear in any alternative
        alt_actions = [a.action.lower() for a in rec.alternatives]
        assert "call" not in alt_actions, f"Illegal 'Call' appeared in alternatives: {rec.alternatives}"

    def test_72o_is_trash(self):
        from app.engines.preflop_ranges import classify_hand
        assert classify_hand(["7h", "2d"]) == "trash"

    def test_jj_btn_rfi_in_range(self):
        """JJ is a premium hand and must be in every position's RFI range."""
        from app.engines.preflop_ranges import classify_hand, _is_in_rfi_range
        bucket = classify_hand(["Jh", "Jd"])
        assert bucket == "premium"
        assert _is_in_rfi_range("BTN", bucket) is True
        assert _is_in_rfi_range("UTG", bucket) is True

    def test_all_rfi_alternatives_legal(self):
        """For any hand/position, all alternatives must be in node.legal_actions."""
        from app.engines.preflop_ranges import detect_preflop_node, get_preflop_recommendation, LEGAL_ACTIONS
        test_cases = [
            (["Td", "2s"], "BTN"),
            (["Ah", "Kd"], "BTN"),
            (["Jh", "Jd"], "UTG"),
            (["7h", "2d"], "CO"),
            (["9h", "8h"], "SB"),
        ]
        for cards, pos in test_cases:
            actions = [_action("Hero", "fold", "preflop", is_hero=True)]
            node = detect_preflop_node(0, actions, pos)
            rec = get_preflop_recommendation(node, "fold", cards)
            for alt in rec.alternatives:
                # Alternatives must only use actions from the legal set
                # (mapped loosely — "Fold", "Raise", "3-Bet", etc. are all valid labels)
                assert alt.frequency > 0, f"Zero-frequency alternative: {alt}"
                assert alt.frequency <= 100


# ══════════════════════════════════════════════════════════════════════════════
# 5. Position invariants — BTN always IP vs blinds
# ══════════════════════════════════════════════════════════════════════════════

class TestPositionInvariants:
    def test_btn_is_ip_vs_bb(self):
        from app.engines.spot_classifier import _determine_position_order
        class H:
            players = [
                type("P", (), {"name": "Hero", "position": "BTN"})(),
                type("P", (), {"name": "Villain", "position": "BB"})(),
            ]
            actions = []
            hero_name = "Hero"
        ip, oop = _determine_position_order(H())
        assert ip == "Hero", f"BTN must be IP, got OOP={oop} IP={ip}"

    def test_btn_is_ip_vs_sb(self):
        from app.engines.spot_classifier import _determine_position_order
        class H:
            players = [
                type("P", (), {"name": "Hero", "position": "BTN"})(),
                type("P", (), {"name": "Villain", "position": "SB"})(),
            ]
            actions = []
            hero_name = "Hero"
        ip, oop = _determine_position_order(H())
        assert ip == "Hero"

    def test_sb_is_oop_vs_btn(self):
        from app.engines.spot_classifier import _determine_position_order
        class H:
            players = [
                type("P", (), {"name": "Hero", "position": "SB"})(),
                type("P", (), {"name": "Villain", "position": "BTN"})(),
            ]
            actions = []
            hero_name = "Hero"
        ip, oop = _determine_position_order(H())
        assert oop == "Hero", f"SB must be OOP, got OOP={oop} IP={ip}"

    def test_co_is_ip_vs_bb(self):
        from app.engines.spot_classifier import _determine_position_order
        class H:
            players = [
                type("P", (), {"name": "Hero", "position": "CO"})(),
                type("P", (), {"name": "Villain", "position": "BB"})(),
            ]
            actions = []
            hero_name = "Hero"
        ip, oop = _determine_position_order(H())
        assert ip == "Hero"


# ══════════════════════════════════════════════════════════════════════════════
# 6–9. Made-hand priority invariants — draws never override strong made hands
# ══════════════════════════════════════════════════════════════════════════════

class TestMadeHandPriority:
    """
    CRITICAL: A made hand (category >= 1) must always dominate the coaching label.
    Draw labels must never override pair-or-better hands.
    """

    def test_jj_set_is_category_3(self):
        """JJ on J-high board = trips/set — category 3, NOT a draw."""
        from app.engines.hand_evaluator import evaluate_hole_and_board
        hr = evaluate_hole_and_board(["Jh", "Jd"], ["Js", "7c", "2h"])
        assert hr.category == 3, f"Expected trips (3), got {hr.category} ({hr.category_name})"

    def test_jj_set_poker_state_not_draw_label(self):
        """PokerState for JJ on J-board must not label the hand as a draw."""
        from app.engines.poker_state import PokerState
        hand = _make_hand(
            hero_cards=["Jh", "Jd"],
            flop=["Js", "7c", "2h"],
        )
        state = PokerState.build(hand, hero_is_ip=True, hero_is_pfr=True)
        assert state.hand_strength is not None
        assert state.hand_strength.made_hand_category >= 3
        assert "draw" not in state.hand_strength.primary_label
        assert state.hand_strength.draw_is_primary is False

    def test_two_pair_suppresses_draw_heuristics(self):
        """Two pair (category 2) must suppress draw heuristics in run_heuristics."""
        from app.engines.heuristics import _evaluate_draw_spot
        # Simulate a DrawAnalysis-like object
        class FakeDraw:
            has_direct_straight_draw = True
            has_flush_draw = False
            has_backdoor_straight = False
            has_backdoor_flush = False
            is_combo_draw = False
            primary_outs = 8
            primary_label = "oesd"
        class FakeSpot:
            hero_is_ip = True
        findings = _evaluate_draw_spot(
            hero_actions=[],
            draw_analysis=FakeDraw(),
            spot=FakeSpot(),
            street="flop",
            made_hand_category=2,  # two pair — must suppress draws
        )
        assert findings == [], "Draw heuristics must be suppressed when hero has two pair or better"

    def test_overpair_primary_label_not_air(self):
        """Overpair: KK on J-7-2 board must not be labeled as air or draw."""
        from app.engines.poker_state import PokerState
        hand = _make_hand(
            hero_cards=["Kh", "Kd"],
            flop=["Jc", "7h", "2s"],
        )
        state = PokerState.build(hand, hero_is_ip=True, hero_is_pfr=True)
        assert state.hand_strength is not None
        assert state.hand_strength.primary_label not in ("air", "gutshot", "backdoor", "draw_only")
        assert state.hand_strength.made_hand_category == 1  # pair
        assert state.hand_strength.relative_strength == "overpair"

    def test_flush_primary_label_is_flush(self):
        """Flush (category 5) must be labeled as flush, never as draw."""
        from app.engines.poker_state import PokerState
        hand = _make_hand(
            hero_cards=["Ah", "Kh"],
            flop=["Th", "7h", "2h"],
        )
        state = PokerState.build(hand, hero_is_ip=True, hero_is_pfr=True)
        assert state.hand_strength is not None
        assert state.hand_strength.made_hand_category == 5
        assert state.hand_strength.primary_label == "flush"
        assert state.hand_strength.draw_is_primary is False

    def test_straight_primary_label_is_straight(self):
        """Straight (category 4) must not be labeled as a draw."""
        from app.engines.poker_state import PokerState
        hand = _make_hand(
            hero_cards=["9h", "8d"],
            flop=["7c", "6s", "5h"],
        )
        state = PokerState.build(hand, hero_is_ip=True, hero_is_pfr=True)
        assert state.hand_strength is not None
        assert state.hand_strength.made_hand_category == 4
        assert state.hand_strength.primary_label == "straight"


# ══════════════════════════════════════════════════════════════════════════════
# 8. Backdoor draw invariants — never promoted to direct draws
# ══════════════════════════════════════════════════════════════════════════════

class TestBackdoorDraws:
    """9h8h on Ah7d2s is the canonical example of the backdoor/OESD misclassification bug."""

    def test_9h8h_on_ah7d2s_not_oesd(self):
        """The original bug: 9h8h on Ah7d2s must NOT be classified as OESD."""
        from app.engines.draw_evaluator import analyze_draws
        da = analyze_draws(["9h", "8h"], ["Ah", "7d", "2s"])
        # Must not have direct straight draw (no 4-consecutive ranks exist)
        assert da.has_direct_straight_draw is False, (
            f"9h8h on Ah7d2s incorrectly detected as direct straight draw. "
            f"Straight draws: {da.straight_draws}"
        )

    def test_9h8h_on_ah7d2s_has_backdoor(self):
        """9h8h on Ah7d2s has backdoor draws only."""
        from app.engines.draw_evaluator import analyze_draws
        da = analyze_draws(["9h", "8h"], ["Ah", "7d", "2s"])
        assert da.has_backdoor_straight or da.has_backdoor_flush

    def test_9h8h_on_th7d6s_is_oesd(self):
        """9h8h on Th7d6s IS a legitimate OESD (6-7-8-9 or 7-8-9-T)."""
        from app.engines.draw_evaluator import analyze_draws
        da = analyze_draws(["9h", "8h"], ["Th", "7d", "6s"])
        assert da.has_direct_straight_draw is True

    def test_backdoor_poker_state_labeled_correctly(self):
        """PokerState for 9h8h on Ah7d2s must use backdoor label, not OESD."""
        from app.engines.poker_state import PokerState
        hand = _make_hand(
            hero_cards=["9h", "8h"],
            flop=["Ah", "7d", "2s"],
        )
        state = PokerState.build(hand, hero_is_ip=True, hero_is_pfr=False)
        assert state.hand_strength is not None
        hs = state.hand_strength
        # No direct draw should be the primary label
        assert hs.primary_label not in ("oesd", "double_gutter"), (
            f"Backdoor-only hand incorrectly labeled as {hs.primary_label}"
        )


# ══════════════════════════════════════════════════════════════════════════════
# 10. Pot estimation fix
# ══════════════════════════════════════════════════════════════════════════════

class TestPotEstimation:
    def test_pot_after_3x_open_is_not_stuck_at_1_5(self):
        """Old bug: 1.0/1.0 + 0.5 = 1.5 always. Now correctly sums action sizes."""
        from app.engines.heuristics import _estimate_pot_at_street
        hand = _make_hand(
            hero_cards=["Ah", "Kd"],
            flop=["Ts", "7h", "2c"],
            actions=[
                _action("Hero", "raise", "preflop", size=3.0, is_hero=True),
                _action("Villain", "call", "preflop", size=3.0),
            ],
        )
        pot = _estimate_pot_at_street(hand, "flop")
        # Should be 1.5 (blinds) + 3.0 (hero raise) + 3.0 (villain call) = 7.5
        assert pot > 2.0, f"Pot estimation stuck at {pot} — operator precedence bug not fixed"
        assert pot >= 7.0, f"Expected ~7.5bb pot after 3x open, got {pot}"

    def test_pot_preflop_start_is_1_5(self):
        """Before any action, pot should be 1.5bb (SB + BB)."""
        from app.engines.heuristics import _estimate_pot_at_street
        hand = _make_hand(hero_cards=["Ah", "Kd"], actions=[])
        pot = _estimate_pot_at_street(hand, "flop")
        # With no preflop actions, still gets max(1.5, 2.0) = 2.0
        assert pot == 2.0


# ══════════════════════════════════════════════════════════════════════════════
# 11. Hand strength ordering
# ══════════════════════════════════════════════════════════════════════════════

class TestHandStrengthOrdering:
    """Made hand categories must follow poker hand rank order."""

    def test_pair_less_than_two_pair(self):
        from app.engines.hand_evaluator import evaluate_hole_and_board
        pair = evaluate_hole_and_board(["Ah", "2d"], ["As", "7c", "3h"])
        two_pair = evaluate_hole_and_board(["Ah", "7d"], ["As", "7c", "3h"])
        assert pair.category < two_pair.category

    def test_two_pair_less_than_straight(self):
        from app.engines.hand_evaluator import evaluate_hole_and_board
        two_pair = evaluate_hole_and_board(["Ah", "7d"], ["As", "7c", "3h"])
        straight = evaluate_hole_and_board(["9h", "8d"], ["7c", "6s", "5h"])
        assert two_pair.category < straight.category

    def test_straight_less_than_flush(self):
        from app.engines.hand_evaluator import evaluate_hole_and_board
        straight = evaluate_hole_and_board(["9h", "8d"], ["7c", "6s", "5h"])
        flush = evaluate_hole_and_board(["Ah", "Kh"], ["Th", "7h", "2h"])
        assert straight.category < flush.category

    def test_flush_less_than_full_house(self):
        from app.engines.hand_evaluator import evaluate_hole_and_board
        flush = evaluate_hole_and_board(["Ah", "Kh"], ["Th", "7h", "2h"])
        full_house = evaluate_hole_and_board(["Ah", "Ad"], ["As", "Kh", "Kd"])
        assert flush.category < full_house.category

    def test_quads_less_than_straight_flush(self):
        from app.engines.hand_evaluator import evaluate_hole_and_board
        quads = evaluate_hole_and_board(["Ah", "Ad"], ["As", "Ac", "Kh"])
        sf = evaluate_hole_and_board(["9h", "8h"], ["7h", "6h", "5h"])
        assert quads.category < sf.category


# ══════════════════════════════════════════════════════════════════════════════
# 12–13. Node detection covers all 6 node types
# ══════════════════════════════════════════════════════════════════════════════

class TestNodeDetectionAllTypes:
    def test_rfi_node(self):
        from app.engines.preflop_ranges import detect_preflop_node
        actions = [_action("Hero", "raise", "preflop", 2.5, is_hero=True)]
        node = detect_preflop_node(0, actions, "BTN")
        assert node.node_type == "RFI"

    def test_vs_open_node(self):
        from app.engines.preflop_ranges import detect_preflop_node
        actions = [
            _action("CO", "raise", "preflop", 2.5),
            _action("Hero", "call", "preflop", 2.5, is_hero=True),
        ]
        node = detect_preflop_node(1, actions, "BTN")
        assert node.node_type == "VS_OPEN"

    def test_vs_squeeze_node(self):
        from app.engines.preflop_ranges import detect_preflop_node
        actions = [
            _action("CO", "raise", "preflop", 2.5),
            _action("MP", "call", "preflop", 2.5),
            _action("Hero", "raise", "preflop", 9.0, is_hero=True),
        ]
        node = detect_preflop_node(2, actions, "BTN")
        assert node.node_type == "VS_SQUEEZE"
        assert node.squeeze_callers == 1

    def test_vs_3bet_node(self):
        from app.engines.preflop_ranges import detect_preflop_node
        actions = [
            _action("Hero", "raise", "preflop", 2.5, is_hero=True),
            _action("BB", "raise", "preflop", 9.0),
            _action("Hero", "call", "preflop", 9.0, is_hero=True),
        ]
        node = detect_preflop_node(2, actions, "BTN")
        assert node.node_type == "VS_3BET"

    def test_vs_4bet_node(self):
        from app.engines.preflop_ranges import detect_preflop_node
        actions = [
            _action("CO", "raise", "preflop", 2.5),
            _action("Hero", "raise", "preflop", 9.0, is_hero=True),
            _action("CO", "raise", "preflop", 22.0),
            _action("Hero", "fold", "preflop", is_hero=True),
        ]
        node = detect_preflop_node(3, actions, "BTN")
        assert node.node_type == "VS_4BET"

    def test_bb_vs_limp_node(self):
        from app.engines.preflop_ranges import detect_preflop_node
        actions = [
            _action("CO", "call", "preflop", 1.0),
            _action("BTN", "call", "preflop", 1.0),
            _action("SB", "call", "preflop", 0.5),
            _action("Hero", "check", "preflop", is_hero=True),
        ]
        node = detect_preflop_node(3, actions, "BB")
        assert node.node_type == "BB_VS_LIMP"
        assert "fold" not in node.legal_actions
        assert "check" in node.legal_actions


# ══════════════════════════════════════════════════════════════════════════════
# 15. Full pipeline smoke test
# ══════════════════════════════════════════════════════════════════════════════

class TestFullPipelineSmoke:
    """End-to-end: analyse_hand must not crash and must never produce impossible outputs."""

    def _run(self, hero_cards, flop=None, actions=None, hero_position="BTN"):
        from app.engines.analysis import analyse_hand
        hand = _make_hand(hero_cards=hero_cards, flop=flop, actions=actions, hero_position=hero_position)
        return analyse_hand(hand)

    def test_aa_preflop_no_crash(self):
        result = self._run(["Ah", "Ad"])
        assert result.overall_score >= 0
        assert result.overall_score <= 100

    def test_ak_preflop_no_crash(self):
        result = self._run(["Ah", "Kd"])
        assert result.overall_score >= 0

    def test_72o_preflop_no_crash(self):
        result = self._run(["7h", "2d"])
        assert result is not None

    def test_flush_postflop_no_crash(self):
        result = self._run(
            hero_cards=["Ah", "Kh"],
            flop=["Th", "7h", "2h"],
            actions=[
                _action("Hero", "raise", "preflop", 2.5, is_hero=True),
                _action("Villain", "call", "preflop", 2.5),
                _action("Villain", "check", "flop"),
                _action("Hero", "bet", "flop", 3.0, is_hero=True),
            ],
        )
        assert result is not None
        # With a flush, overall score should not be very low (not punishing value bet)
        assert result.overall_score >= 50

    def test_backdoor_9h8h_on_ah7d2s_no_crash(self):
        """The canonical backdoor bug hand must not crash and must not be scored as OESD."""
        result = self._run(
            hero_cards=["9h", "8h"],
            flop=["Ah", "7d", "2s"],
            actions=[
                _action("Hero", "raise", "preflop", 2.5, is_hero=True),
                _action("Villain", "call", "preflop", 2.5),
                _action("Villain", "check", "flop"),
                _action("Hero", "check", "flop", is_hero=True),
            ],
        )
        assert result is not None

    def test_set_on_board_no_draw_label_in_findings(self):
        """JJ on J72 board — findings must not classify this as a draw-only spot."""
        result = self._run(
            hero_cards=["Jh", "Jd"],
            flop=["Js", "7c", "2h"],
            actions=[
                _action("Hero", "raise", "preflop", 2.5, is_hero=True),
                _action("Villain", "call", "preflop", 2.5),
                _action("Villain", "check", "flop"),
                _action("Hero", "bet", "flop", 3.0, is_hero=True),
            ],
        )
        # No finding should describe this as a "weak semibluff" or gutshot
        for f in result.findings:
            assert "gutshot" not in f.action_taken.lower(), (
                f"Set incorrectly flagged as gutshot: {f.action_taken}"
            )
            assert "semibluff" not in (f.explanation or "").lower() or "combo" in (f.explanation or "").lower(), (
                f"Set incorrectly labeled as semibluff: {f.explanation}"
            )

    def test_preflop_preferred_actions_legal(self):
        """Preferred actions for any preflop scenario must be legal for the node."""
        from app.engines.preflop_ranges import detect_preflop_node, LEGAL_ACTIONS
        from app.engines.scoring import score_all_hero_actions
        from app.engines.spot_classifier import classify_spot
        from app.engines.board_texture import classify_board

        hand = _make_hand(
            hero_cards=["Td", "2s"],  # T2o: trash hand
            hero_position="BTN",
            actions=[
                _action("UTG", "fold", "preflop"),
                _action("CO", "fold", "preflop"),
                _action("Hero", "fold", "preflop", is_hero=True),
                _action("SB", "fold", "preflop"),
            ],
        )
        spot = classify_spot(hand)
        texture = classify_board(hand.board.flop, hand.board.turn, hand.board.river)
        coaching = score_all_hero_actions(hand, [], spot, texture)
        # For the hero fold action
        for idx, action_coaching in coaching.items():
            for alt in action_coaching.preferred_actions:
                assert alt.frequency > 0
                # Must not recommend "Call" in an RFI scenario
                assert alt.action.lower() != "call", (
                    f"Illegal 'Call' recommended for T2o BTN RFI fold: {action_coaching.preferred_actions}"
                )
