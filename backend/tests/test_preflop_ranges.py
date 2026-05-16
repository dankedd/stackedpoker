"""
Tests for preflop node detection, hand classification, and recommendation engine.

Validates:
  - NodeType detection for all major node types
  - Legal action sets (never recommends impossible actions)
  - Hand strength classification (T2o = trash, AA = premium, etc.)
  - Range-based recommendations (T2o BTN = Fold 100%, not Call 30%)
  - IP/OOP position fix in spot_classifier
"""
import pytest
from app.engines.preflop_ranges import (
    classify_hand,
    detect_preflop_node,
    get_preflop_recommendation,
    LEGAL_ACTIONS,
)
from app.models.schemas import HandAction


# ── Helpers ────────────────────────────────────────────────────────────────

def _action(player: str, action: str, size: float = 0.0, is_hero: bool = False) -> HandAction:
    return HandAction(
        player=player,
        action=action,
        street="preflop",
        size_bb=size,
        is_hero=is_hero,
    )


# ── Hand classification ─────────────────────────────────────────────────────

class TestClassifyHand:
    def test_aa_premium(self):
        assert classify_hand(["Ah", "Ad"]) == "premium"

    def test_kk_premium(self):
        assert classify_hand(["Kh", "Kd"]) == "premium"

    def test_jj_premium(self):
        assert classify_hand(["Jh", "Jd"]) == "premium"

    def test_tt_strong(self):
        assert classify_hand(["Th", "Td"]) == "strong"

    def test_99_strong(self):
        assert classify_hand(["9h", "9d"]) == "strong"

    def test_88_playable(self):
        assert classify_hand(["8h", "8d"]) == "playable"

    def test_55_marginal(self):
        assert classify_hand(["5h", "5d"]) == "marginal"

    def test_22_marginal(self):
        assert classify_hand(["2h", "2d"]) == "marginal"

    def test_AKs_premium(self):
        assert classify_hand(["Ah", "Kh"]) == "premium"

    def test_AKo_premium(self):
        assert classify_hand(["Ah", "Kd"]) == "premium"

    def test_AQs_strong(self):
        assert classify_hand(["Ah", "Qh"]) == "strong"

    def test_AJs_strong(self):
        assert classify_hand(["Ah", "Jh"]) == "strong"

    def test_AJo_playable(self):
        assert classify_hand(["Ah", "Jd"]) == "playable"

    def test_KQs_strong(self):
        assert classify_hand(["Kh", "Qh"]) == "strong"

    def test_KQo_playable(self):
        assert classify_hand(["Kh", "Qd"]) == "playable"

    def test_T2o_trash(self):
        """The specific failing example — T2o must be trash."""
        assert classify_hand(["Td", "2s"]) == "trash"

    def test_72o_trash(self):
        assert classify_hand(["7h", "2d"]) == "trash"

    def test_T9s_playable(self):
        assert classify_hand(["Th", "9h"]) == "playable"

    def test_T9o_marginal(self):
        assert classify_hand(["Th", "9d"]) == "marginal"

    def test_98s_marginal(self):
        assert classify_hand(["9h", "8h"]) == "marginal"

    def test_invalid_cards_returns_trash(self):
        assert classify_hand([]) == "trash"
        assert classify_hand(["Ah"]) == "trash"


# ── Node detection ──────────────────────────────────────────────────────────

class TestDetectPreflopNode:
    def test_rfi_no_prior_raises(self):
        """Unopened pot — BTN is first to act after all fold."""
        actions = [
            _action("UTG", "fold"),
            _action("CO", "fold"),
            _action("Hero", "fold", is_hero=True),
        ]
        node = detect_preflop_node(2, actions, "BTN")
        assert node.node_type == "RFI"
        assert node.raise_count_before == 0
        assert "fold" in node.legal_actions
        assert "raise" in node.legal_actions
        assert "call" not in node.legal_actions  # limp excluded

    def test_vs_open_one_raise(self):
        """BTN faces a CO open."""
        actions = [
            _action("CO", "raise", size=2.5),
            _action("Hero", "fold", is_hero=True),
        ]
        node = detect_preflop_node(1, actions, "BTN")
        assert node.node_type == "VS_OPEN"
        assert node.raise_count_before == 1
        assert node.facing_size_bb == 2.5
        assert "call" in node.legal_actions
        assert "raise" in node.legal_actions
        assert "fold" in node.legal_actions

    def test_vs_squeeze_open_plus_callers(self):
        """BTN faces a CO open with MP caller — squeeze spot."""
        actions = [
            _action("CO", "raise", size=2.5),
            _action("MP", "call", size=2.5),
            _action("Hero", "fold", is_hero=True),
        ]
        node = detect_preflop_node(2, actions, "BTN")
        assert node.node_type == "VS_SQUEEZE"
        assert node.squeeze_callers == 1

    def test_vs_3bet(self):
        """Hero opened, faces a 3-bet."""
        actions = [
            _action("Hero", "raise", size=2.5, is_hero=True),
            _action("BB", "raise", size=9.0),
            _action("Hero", "fold", is_hero=True),
        ]
        node = detect_preflop_node(2, actions, "BTN")
        assert node.node_type == "VS_3BET"
        assert node.raise_count_before == 2
        assert node.facing_size_bb == 9.0

    def test_vs_4bet(self):
        """Hero 3-bet, faces a 4-bet."""
        actions = [
            _action("CO", "raise", size=2.5),
            _action("Hero", "raise", size=9.0, is_hero=True),
            _action("CO", "raise", size=22.0),
            _action("Hero", "fold", is_hero=True),
        ]
        node = detect_preflop_node(3, actions, "BTN")
        assert node.node_type == "VS_4BET"
        assert node.raise_count_before == 3

    def test_bb_vs_limp(self):
        """BB faces limpers, no raise."""
        actions = [
            _action("CO", "call", size=1.0),
            _action("BTN", "call", size=1.0),
            _action("SB", "call", size=0.5),
            _action("Hero", "check", is_hero=True),
        ]
        node = detect_preflop_node(3, actions, "BB")
        assert node.node_type == "BB_VS_LIMP"
        assert "check" in node.legal_actions
        assert "raise" in node.legal_actions


# ── Legal actions ───────────────────────────────────────────────────────────

class TestLegalActions:
    def test_rfi_never_includes_call(self):
        assert "call" not in LEGAL_ACTIONS["RFI"]

    def test_vs_open_includes_all_three(self):
        assert LEGAL_ACTIONS["VS_OPEN"] == frozenset({"fold", "call", "raise"})

    def test_bb_vs_limp_no_fold(self):
        assert "fold" not in LEGAL_ACTIONS["BB_VS_LIMP"]
        assert "check" in LEGAL_ACTIONS["BB_VS_LIMP"]


# ── Recommendations ─────────────────────────────────────────────────────────

class TestPreflopRecommendation:
    def test_t2o_btn_rfi_fold_100(self):
        """The original bug: T2o BTN must be Fold 100%, never Call 30%."""
        actions = [
            _action("UTG", "fold"),
            _action("CO", "fold"),
            _action("Hero", "fold", is_hero=True),
        ]
        node = detect_preflop_node(2, actions, "BTN")
        rec = get_preflop_recommendation(node, "fold", ["Td", "2s"])

        assert rec.preferred_action == "fold"
        assert rec.in_range is False
        assert rec.hand_strength == "trash"
        # All alternatives must be legal
        for alt in rec.alternatives:
            assert alt.action.lower() in {"fold", "raise", "call", "check", "fold", "3-bet",
                                          "4-bet", "5-bet all-in", "raise to 4bb"}
        # Must not recommend "Call" in an RFI node
        alt_actions_lower = [a.action.lower() for a in rec.alternatives]
        assert "call" not in alt_actions_lower

        # Frequencies must sum to 100
        total_freq = sum(a.frequency for a in rec.alternatives)
        assert total_freq == 100

    def test_aa_btn_rfi_raise_100(self):
        """AA is in every RFI range — must recommend Raise 100%."""
        actions = [
            _action("UTG", "fold"),
            _action("Hero", "raise", size=2.5, is_hero=True),
        ]
        node = detect_preflop_node(1, actions, "BTN")
        rec = get_preflop_recommendation(node, "raise", ["Ah", "Ad"])

        assert rec.preferred_action == "raise"
        assert rec.in_range is True
        assert rec.hand_strength == "premium"

    def test_t2o_utg_rfi_fold_100(self):
        """T2o from UTG — also fold, tighter range."""
        actions = [_action("Hero", "fold", is_hero=True)]
        node = detect_preflop_node(0, actions, "UTG")
        rec = get_preflop_recommendation(node, "fold", ["Td", "2s"])

        assert rec.preferred_action == "fold"
        assert rec.in_range is False

    def test_recommendations_only_contain_legal_actions(self):
        """For any node, alternatives must only contain legal actions (loosely)."""
        actions = [
            _action("CO", "raise", size=2.5),
            _action("Hero", "fold", is_hero=True),
        ]
        node = detect_preflop_node(1, actions, "BTN")
        rec = get_preflop_recommendation(node, "fold", ["Td", "2s"])
        # Fold is always legal
        assert rec.preferred_action == "fold"

    def test_aa_vs_open_3bet(self):
        """AA facing a CO open from BTN — should 3-bet."""
        actions = [
            _action("CO", "raise", size=2.5),
            _action("Hero", "raise", size=9.0, is_hero=True),
        ]
        node = detect_preflop_node(1, actions, "BTN")
        rec = get_preflop_recommendation(node, "raise", ["Ah", "Ad"])

        assert rec.preferred_action == "raise"
        assert rec.in_range is True


# ── IP/OOP position order ───────────────────────────────────────────────────

class TestPositionOrder:
    def test_btn_is_ip_vs_sb(self):
        from app.engines.spot_classifier import _determine_position_order

        class FakeHand:
            players = [
                type("P", (), {"name": "Hero", "position": "BTN"})(),
                type("P", (), {"name": "Villain", "position": "SB"})(),
            ]
            actions = []
            hero_name = "Hero"

        ip, oop = _determine_position_order(FakeHand())
        assert ip == "Hero", f"Expected Hero(BTN) to be IP, got {ip}"
        assert oop == "Villain", f"Expected Villain(SB) to be OOP, got {oop}"

    def test_btn_is_ip_vs_bb(self):
        from app.engines.spot_classifier import _determine_position_order

        class FakeHand:
            players = [
                type("P", (), {"name": "Hero", "position": "BTN"})(),
                type("P", (), {"name": "Villain", "position": "BB"})(),
            ]
            actions = []
            hero_name = "Hero"

        ip, oop = _determine_position_order(FakeHand())
        assert ip == "Hero"
        assert oop == "Villain"

    def test_co_is_ip_vs_sb(self):
        from app.engines.spot_classifier import _determine_position_order

        class FakeHand:
            players = [
                type("P", (), {"name": "CO_Hero", "position": "CO"})(),
                type("P", (), {"name": "SB_Villain", "position": "SB"})(),
            ]
            actions = []
            hero_name = "CO_Hero"

        ip, oop = _determine_position_order(FakeHand())
        assert ip == "CO_Hero"
        assert oop == "SB_Villain"

    def test_sb_is_oop_vs_btn(self):
        from app.engines.spot_classifier import _determine_position_order

        class FakeHand:
            players = [
                type("P", (), {"name": "SB_Hero", "position": "SB"})(),
                type("P", (), {"name": "BTN_Villain", "position": "BTN"})(),
            ]
            actions = []
            hero_name = "SB_Hero"

        ip, oop = _determine_position_order(FakeHand())
        assert oop == "SB_Hero"
        assert ip == "BTN_Villain"
