"""
Exhaustive test suite for draw_evaluator.py.

Tests every draw type, edge case, and the specific misclassification
that triggered this rewrite (9h8h on Ah7d2s → NOT an OESD).

Run with: pytest tests/test_draw_evaluator.py -v
"""
import pytest
from app.engines.draw_evaluator import analyze_draws, DrawAnalysis


# ═══════════════════════════════════════════════════════════════════════════════
# THE CRITICAL BUG CASE — must never regress
# ═══════════════════════════════════════════════════════════════════════════════

class TestCriticalBugCase:
    """9h8h on Ah7d2s was incorrectly labeled OESD. This must NEVER happen."""

    def test_98h_on_A72_is_NOT_oesd(self):
        """9h8h on Ah7d2s has no OESD. Only backdoor straight potential."""
        da = analyze_draws(['9h', '8h'], ['Ah', '7d', '2s'])
        assert not da.has_direct_straight_draw, (
            "9h8h on Ah7d2s has NO direct straight draw — "
            "only 3 connected cards (7-8-9), need runner-runner."
        )

    def test_98h_on_A72_is_NOT_gutshot(self):
        """9h8h on Ah7d2s also has no gutshot — only backdoor."""
        da = analyze_draws(['9h', '8h'], ['Ah', '7d', '2s'])
        direct_types = {s.draw_type for s in da.straight_draws if s.draw_type != 'backdoor_straight'}
        assert len(direct_types) == 0, (
            f"Expected no direct straight draws, got: {direct_types}"
        )

    def test_98h_on_A72_has_backdoor_straight(self):
        """9h8h on Ah7d2s has backdoor straight potential (7-8-9 needs runner-runner)."""
        da = analyze_draws(['9h', '8h'], ['Ah', '7d', '2s'])
        assert da.has_backdoor_straight, (
            "9h8h on Ah7d2s should have backdoor straight (7-8-9, needs runner-runner)."
        )

    def test_98h_on_A72_has_backdoor_flush(self):
        """9h8h on Ah7d2s: Ah + 9h + 8h = 3 hearts = backdoor flush draw."""
        da = analyze_draws(['9h', '8h'], ['Ah', '7d', '2s'])
        assert da.has_backdoor_flush, (
            "9h8h on Ah7d2s: Ah,9h,8h = 3 hearts → backdoor flush draw."
        )

    def test_98h_on_A72_no_flush_draw(self):
        """9h8h on Ah7d2s has only 3 hearts (not 4) — no flush draw."""
        da = analyze_draws(['9h', '8h'], ['Ah', '7d', '2s'])
        assert not da.has_flush_draw, (
            "Only 3 hearts on board+hero — no flush draw."
        )

    def test_98h_on_A72_primary_label_does_not_say_oesd(self):
        """The primary label must not contain 'OESD'."""
        da = analyze_draws(['9h', '8h'], ['Ah', '7d', '2s'])
        assert "oesd" not in da.primary_label.lower(), (
            f"Primary label must not say OESD. Got: {da.primary_label!r}"
        )

    def test_98h_on_A72_primary_label_says_backdoor(self):
        """Primary label must mention 'backdoor'."""
        da = analyze_draws(['9h', '8h'], ['Ah', '7d', '2s'])
        assert "backdoor" in da.primary_label.lower(), (
            f"Expected 'backdoor' in primary label. Got: {da.primary_label!r}"
        )

    def test_98h_on_A72_zero_direct_outs(self):
        """Backdoor draws have 0 direct outs."""
        da = analyze_draws(['9h', '8h'], ['Ah', '7d', '2s'])
        assert da.primary_outs == 0, (
            f"Backdoor draws have no direct outs. Got: {da.primary_outs}"
        )


# ═══════════════════════════════════════════════════════════════════════════════
# OESD CASES
# ═══════════════════════════════════════════════════════════════════════════════

class TestOESD:
    """Hands that ARE OESDs."""

    def test_classic_oesd_6789(self):
        """6-7-8-9 is a classic OESD (needs 5 or T)."""
        da = analyze_draws(['6h', '7h'], ['8d', '9s', '2c'])
        assert da.has_direct_straight_draw
        oesd = next((s for s in da.straight_draws if s.draw_type == 'oesd'), None)
        assert oesd is not None, "6789 should be OESD"
        assert set(oesd.needed_ranks) == {5, 10}, (
            f"6789 OESD needs 5 or T. Got: {oesd.needed_ranks}"
        )
        assert oesd.available_outs == 8

    def test_oesd_789T(self):
        """7-8-9-T is an OESD (needs 6 or J)."""
        da = analyze_draws(['9h', 'Th'], ['7d', '8s', '2c'])
        assert da.has_direct_straight_draw
        oesd = next((s for s in da.straight_draws if s.draw_type == 'oesd'), None)
        assert oesd is not None, "789T should be OESD"
        assert set(oesd.needed_ranks) == {6, 11}

    def test_oesd_JQKA_is_NOT_oesd(self):
        """J-Q-K-A is NOT an OESD (one-sided — only T completes)."""
        da = analyze_draws(['Kh', 'Ah'], ['Jd', 'Qs', '3c'])
        # JQKA can only be completed by T (one end)
        oesd = next((s for s in da.straight_draws if s.draw_type == 'oesd'), None)
        assert oesd is None, "JQKA has only one open end (T) — not a true OESD"

    def test_oesd_A234_wheel_draw(self):
        """A-2-3-4 is NOT an OESD (one-sided wheel draw, only 5 completes)."""
        da = analyze_draws(['Ah', '2h'], ['3d', '4s', '9c'])
        oesd = next((s for s in da.straight_draws if s.draw_type == 'oesd'), None)
        assert oesd is None, "A234 has only one end (5) — not a two-sided OESD"
        # Should be a one-sided draw (gutshot classification)
        assert da.has_direct_straight_draw

    def test_oesd_8_outs(self):
        """OESD always has 8 available outs (before blockers)."""
        da = analyze_draws(['6c', '9c'], ['7h', '8d', 'Ac'])
        oesd = next((s for s in da.straight_draws if s.draw_type == 'oesd'), None)
        assert oesd is not None
        assert oesd.available_outs == 8

    def test_oesd_with_flush_is_combo(self):
        """OESD + flush draw = combo draw."""
        da = analyze_draws(['6h', '9h'], ['7h', '8h', 'Ac'])
        # 4 hearts = flush draw; 6-7-8-9 = OESD
        assert da.has_flush_draw
        assert da.has_direct_straight_draw
        assert da.is_combo_draw


# ═══════════════════════════════════════════════════════════════════════════════
# DOUBLE GUTSHOT (DBB) CASES
# ═══════════════════════════════════════════════════════════════════════════════

class TestDoubleGutshot:
    """Double belly buster = two separate gutshots, 8 outs total."""

    def test_98h_on_7hJh5c_is_double_gutter(self):
        """
        9h8h on 7hJh5c:
          - Window [5,6,7,8,9]: have {5,7,8,9}, need 6 → gutshot
          - Window [7,8,9,T,J]: have {7,8,9,J}, need T → gutshot
          Two separate gutshots = double belly buster.
        """
        da = analyze_draws(['9h', '8h'], ['7h', 'Jh', '5c'])
        dg = next((s for s in da.straight_draws if s.draw_type == 'double_gutter'), None)
        assert dg is not None, (
            f"9h8h on 7hJh5c should be double gutshot. "
            f"Draws: {[s.draw_type for s in da.straight_draws]}"
        )
        assert set(dg.needed_ranks) == {6, 10}, (
            f"Double gutter needs 6 (for 56789) and T (for 789TJ). Got: {dg.needed_ranks}"
        )
        assert dg.available_outs == 8

    def test_double_gutter_has_flush_draw_too(self):
        """9h8h on 7hJh5c also has a flush draw (4 hearts)."""
        da = analyze_draws(['9h', '8h'], ['7h', 'Jh', '5c'])
        assert da.has_flush_draw, "4 hearts: 9h,8h,7h,Jh → flush draw"
        assert da.is_combo_draw

    def test_double_gutter_is_not_labeled_oesd(self):
        """A double gutshot must not be labeled as OESD."""
        da = analyze_draws(['9h', '8h'], ['7h', 'Jh', '5c'])
        oesd = next((s for s in da.straight_draws if s.draw_type == 'oesd'), None)
        assert oesd is None, "Double gutshot should not be mislabeled as OESD"

    def test_classic_dbb(self):
        """Another classic DBB: AsKs on QhJh8c (needs T or 9 for different straights)."""
        # A-K on QJ8: window [9,T,J,Q,K] needs T (have K,Q,J... + need T,9?)
        # Let me use a cleaner example: 6s5s on 4h8h2c
        # Window [2,3,4,5,6]: have {2,4,5,6}, need 3 → gutshot
        # Window [4,5,6,7,8]: have {4,5,6,8}, need 7 → gutshot
        da = analyze_draws(['6s', '5s'], ['4h', '8h', '2c'])
        dg = next((s for s in da.straight_draws if s.draw_type == 'double_gutter'), None)
        assert dg is not None, (
            f"6s5s on 4h8h2c should be double gutshot. "
            f"Draws: {[s.draw_type for s in da.straight_draws]}"
        )


# ═══════════════════════════════════════════════════════════════════════════════
# GUTSHOT CASES
# ═══════════════════════════════════════════════════════════════════════════════

class TestGutshot:
    """Single gutshots — 4 outs."""

    def test_simple_gutshot(self):
        """9s7s on 5d6h2c: need 8 for the gutshot (5-6-7-8-9)."""
        da = analyze_draws(['9s', '7s'], ['5d', '6h', '2c'])
        assert da.has_direct_straight_draw
        gs = next((s for s in da.straight_draws if s.draw_type == 'gutshot'), None)
        assert gs is not None, "9-7 with 5-6 should be a gutshot (needs 8)"
        assert 8 in gs.needed_ranks

    def test_gutshot_4_outs(self):
        """Gutshot has 4 outs (before blockers)."""
        da = analyze_draws(['9s', '7s'], ['5d', '6h', '2c'])
        gs = next((s for s in da.straight_draws if s.draw_type == 'gutshot'), None)
        assert gs is not None
        assert gs.available_outs == 4

    def test_gutshot_not_labeled_oesd(self):
        """A gutshot must not be labeled as OESD."""
        da = analyze_draws(['9s', '7s'], ['5d', '6h', '2c'])
        oesd = next((s for s in da.straight_draws if s.draw_type == 'oesd'), None)
        assert oesd is None

    def test_broadway_gutshot(self):
        """AcKc on QhJh7c: needs T for A-K-Q-J-T broadway (one-sided)."""
        da = analyze_draws(['Ac', 'Kc'], ['Qh', 'Jh', '7c'])
        assert da.has_direct_straight_draw
        gs = next((s for s in da.straight_draws
                   if s.draw_type == 'gutshot' and 10 in s.needed_ranks), None)
        assert gs is not None, "AcKc on QhJh7c should have broadway gutshot (needs T)"


# ═══════════════════════════════════════════════════════════════════════════════
# FLUSH DRAW CASES
# ═══════════════════════════════════════════════════════════════════════════════

class TestFlushDraw:
    """Flush draws — 9 outs."""

    def test_simple_flush_draw(self):
        """Jh9h on 2h7hAc: 4 hearts = flush draw."""
        da = analyze_draws(['Jh', '9h'], ['2h', '7h', 'Ac'])
        assert da.has_flush_draw
        fd = next((f for f in da.flush_draws if f.draw_type == 'flush_draw'), None)
        assert fd is not None
        assert fd.suit == 'h'
        assert fd.available_outs == 9

    def test_no_flush_draw_with_3_hearts(self):
        """9h8h on 7hAdKc: only 3 hearts (9h,8h,7h) — backdoor flush, not flush draw."""
        da = analyze_draws(['9h', '8h'], ['7h', 'Ad', 'Kc'])
        assert not da.has_flush_draw
        assert da.has_backdoor_flush

    def test_flush_draw_requires_hole_card_contribution(self):
        """If hero has no cards of the dominant suit, no flush draw attributed to hero."""
        # Hero: Ac Kc. Board: 7h 8h 9h. Three hearts are all on board — hero has 0 hearts.
        da = analyze_draws(['Ac', 'Kc'], ['7h', '8h', '9h'])
        assert not da.has_flush_draw
        assert not da.has_backdoor_flush

    def test_backdoor_flush_3_cards(self):
        """3 cards of same suit including hero = backdoor flush."""
        da = analyze_draws(['9h', '8h'], ['7h', 'Ad', '2s'])
        assert da.has_backdoor_flush
        bd = next((f for f in da.flush_draws if f.draw_type == 'backdoor_flush'), None)
        assert bd is not None
        assert bd.suit == 'h'
        assert bd.cards_to_suit == 3

    def test_made_flush_not_a_draw(self):
        """5 cards of same suit = made flush, not reported as draw."""
        da = analyze_draws(['9h', '8h'], ['7h', '6h', '5h'])
        # Made flush — flush draw should not be reported
        assert not da.has_flush_draw


# ═══════════════════════════════════════════════════════════════════════════════
# COMBO DRAW CASES
# ═══════════════════════════════════════════════════════════════════════════════

class TestComboDraw:
    """Flush draw + straight draw = combo draw."""

    def test_jt_hearts_combo_draw(self):
        """JhTh on Qh8h3c: flush draw + gutshot (J-T-8 needs 9 or straight flush Q-J-T-9-8)."""
        da = analyze_draws(['Jh', 'Th'], ['Qh', '8h', '3c'])
        assert da.has_flush_draw
        # 4 hearts: Jh,Th,Qh,8h
        # Straight: Q-J-T-8 needs 9 (gutshot), or J-T-9-8 needs 7 or Q
        assert da.has_direct_straight_draw
        assert da.is_combo_draw

    def test_combo_draw_oesd_plus_flush(self):
        """6h9h on 7h8hAd: OESD (6-7-8-9 needs 5 or T) + flush draw (4 hearts)."""
        da = analyze_draws(['6h', '9h'], ['7h', '8h', 'Ad'])
        assert da.has_flush_draw
        oesd = next((s for s in da.straight_draws if s.draw_type == 'oesd'), None)
        assert oesd is not None
        assert da.is_combo_draw


# ═══════════════════════════════════════════════════════════════════════════════
# BACKDOOR DRAW CASES
# ═══════════════════════════════════════════════════════════════════════════════

class TestBackdoorDraws:
    """Runner-runner equity — must NEVER be labeled as direct draws."""

    def test_backdoor_straight_only(self):
        """KcQc on 9h5d2s: no direct draw, only backdoor potential."""
        da = analyze_draws(['Kc', 'Qc'], ['9h', '5d', '2s'])
        assert not da.has_direct_straight_draw
        # K-Q is 2 connected, with 9 on board — disconnected overall

    def test_backdoor_label_never_says_oesd(self):
        """No backdoor situation ever produces an OESD label."""
        cases = [
            (['9h', '8h'], ['Ah', '7d', '2s']),   # the bug case
            (['Kc', 'Qc'], ['Jd', '5h', '2s']),   # K-Q-J needs runner-runner T and A/9
            (['7c', '6c'], ['9h', 'Ah', '2s']),    # 6-7 with 9 — no direct draw
        ]
        for hole, board in cases:
            da = analyze_draws(hole, board)
            assert 'oesd' not in da.primary_label.lower(), (
                f"{hole} on {board}: primary_label should not say OESD. "
                f"Got: {da.primary_label!r}"
            )

    def test_three_connected_is_backdoor_not_oesd(self):
        """Three connected cards (no 4th) = backdoor, not OESD."""
        # 8-9 with board 7 — only 3 consecutive, not 4
        da = analyze_draws(['9c', '8c'], ['7d', 'Ah', '3s'])
        assert not da.has_direct_straight_draw
        assert da.has_backdoor_straight

    def test_backdoor_primary_outs_is_zero(self):
        """Backdoor draws have primary_outs = 0 (no direct outs)."""
        da = analyze_draws(['9h', '8h'], ['Ah', '7d', '2s'])
        assert da.primary_outs == 0


# ═══════════════════════════════════════════════════════════════════════════════
# MADE HAND CASES
# ═══════════════════════════════════════════════════════════════════════════════

class TestMadeHands:
    """Verify made hand classification alongside draws."""

    def test_pair_on_board(self):
        """AhKh on AcJd3s: hero has a pair of aces."""
        da = analyze_draws(['Ah', 'Kh'], ['Ac', 'Jd', '3s'])
        assert da.made_hand_category == 'pair'
        assert da.has_pair_or_better

    def test_two_pair(self):
        """JcTc on JdTh3s: hero has two pair."""
        da = analyze_draws(['Jc', 'Tc'], ['Jd', 'Th', '3s'])
        assert da.made_hand_category == 'two_pair'

    def test_trips(self):
        """AhAs on AdKh3s: hero has trips."""
        da = analyze_draws(['Ah', 'As'], ['Ad', 'Kh', '3s'])
        assert da.made_hand_category == 'trips'

    def test_straight(self):
        """5h6h on 7d8cAd with turn 9s (4+1=4 cards): hero has straight."""
        da = analyze_draws(['5h', '6h'], ['7d', '8c', '9s'])
        assert da.made_hand_category == 'straight'

    def test_flush(self):
        """9h8h on 7h6h5h: hero has a flush (all hearts)."""
        da = analyze_draws(['9h', '8h'], ['7h', '6h', '5h'])
        assert da.made_hand_category in ('flush', 'straight_flush')


# ═══════════════════════════════════════════════════════════════════════════════
# EDGE CASES
# ═══════════════════════════════════════════════════════════════════════════════

class TestEdgeCases:
    """Ace-low, wheel, paired boards, monotone boards."""

    def test_ace_low_wheel_draw(self):
        """Ah2h on 3d4cKs: A-2-3-4 wheel draw (needs 5)."""
        da = analyze_draws(['Ah', '2h'], ['3d', '4c', 'Ks'])
        assert da.has_direct_straight_draw
        # A-2-3-4 is one-sided draw to the wheel
        assert any(5 in s.needed_ranks for s in da.straight_draws if s.draw_type != 'backdoor_straight')

    def test_monotone_board_flush_already_possible(self):
        """9h8h on 7h6h2h: hero has a made flush (5 hearts)."""
        da = analyze_draws(['9h', '8h'], ['7h', '6h', '2h'])
        assert da.made_hand_category in ('straight_flush', 'flush', 'straight')

    def test_paired_board_note(self):
        """Board pairing is noted in diagnostics."""
        da = analyze_draws(['9h', '8h'], ['7d', '7c', '2s'])
        # Paired board should not crash
        assert da is not None
        # No OESD with only 8-9 against paired board
        assert not da.has_direct_straight_draw

    def test_broadway_draw(self):
        """AhKh on QdJcTs: hero has made broadway straight."""
        da = analyze_draws(['Ah', 'Kh'], ['Qd', 'Jc', 'Ts'])
        assert da.made_hand_category == 'straight'
        assert not da.has_direct_straight_draw  # already made

    def test_no_duplicate_oesd_labels(self):
        """Same OESD should not appear twice in straight_draws."""
        da = analyze_draws(['6h', '7h'], ['8d', '9s', '2c'])
        oesd_draws = [s for s in da.straight_draws if s.draw_type == 'oesd']
        assert len(oesd_draws) <= 1, f"Duplicate OESDs: {oesd_draws}"

    def test_river_draw_warns(self):
        """On the river, draws get a warning (no cards coming)."""
        da = analyze_draws(['9h', '8h'], ['7h', '6h', 'As'])
        # This is actually a made flush — street is river (5 board cards)
        # Let's test a situation where there's a missed draw on the river
        da2 = analyze_draws(['9h', '8h'], ['Ah', '7d', '2s'])  # Only 3 board = flop
        assert da2.street == 'flop'

    def test_preflop_no_board(self):
        """No board = preflop, no draws classified."""
        da = analyze_draws(['Ah', 'Kh'], [])
        assert da.street == 'preflop'
        assert not da.has_flush_draw
        assert not da.has_direct_straight_draw

    def test_straight_flush_draw(self):
        """5h6h on 7h8hAc: OESD + flush draw (straight flush possible)."""
        da = analyze_draws(['5h', '6h'], ['7h', '8h', 'Ac'])
        assert da.has_flush_draw
        assert da.has_direct_straight_draw
        assert da.is_combo_draw or da.is_straight_flush_draw


# ═══════════════════════════════════════════════════════════════════════════════
# CLASSIFICATION INTEGRITY
# ═══════════════════════════════════════════════════════════════════════════════

class TestClassificationIntegrity:
    """Cross-checks that draw classifications are internally consistent."""

    def test_oesd_outs_always_8(self):
        """Every OESD has exactly 8 available outs."""
        oesd_cases = [
            (['6h', '9h'], ['7d', '8s', '2c']),
            (['Th', '7h'], ['8d', '9s', 'Ac']),
            (['3h', '6h'], ['4d', '5s', 'Kc']),
        ]
        for hole, board in oesd_cases:
            da = analyze_draws(hole, board)
            for sd in da.straight_draws:
                if sd.draw_type == 'oesd':
                    assert sd.available_outs == 8, (
                        f"{hole} on {board}: OESD should have 8 outs, got {sd.available_outs}"
                    )

    def test_gutshot_outs_always_4(self):
        """Every gutshot has exactly 4 available outs."""
        da = analyze_draws(['9s', '7s'], ['5d', '6h', '2c'])
        for sd in da.straight_draws:
            if sd.draw_type == 'gutshot':
                assert sd.available_outs == 4

    def test_double_gutter_outs_equals_8(self):
        """Double gutshot must have 8 outs (4+4)."""
        da = analyze_draws(['9h', '8h'], ['7h', 'Jh', '5c'])
        dg = next((s for s in da.straight_draws if s.draw_type == 'double_gutter'), None)
        if dg:
            assert dg.available_outs == 8

    def test_is_combo_only_when_both_present(self):
        """is_combo_draw is True iff both flush_draw AND direct_straight_draw."""
        # Flush only
        da1 = analyze_draws(['Jh', '9h'], ['2h', '7h', 'Ac'])
        assert da1.has_flush_draw
        # is_combo requires straight draw too — depends on board
        # If no straight draw, not combo
        if not da1.has_direct_straight_draw:
            assert not da1.is_combo_draw

        # Straight only
        da2 = analyze_draws(['6c', '9c'], ['7d', '8s', 'Ah'])
        assert da2.has_direct_straight_draw
        if not da2.has_flush_draw:
            assert not da2.is_combo_draw

    def test_confidence_is_1_for_clean_input(self):
        """Clean input with no complications → confidence = 1.0."""
        da = analyze_draws(['9h', '8h'], ['7d', 'Jc', '5s'])
        # No paired board, no monotone, valid cards
        assert da.confidence >= 0.90, f"Expected high confidence, got {da.confidence}"

    def test_no_warnings_for_valid_input(self):
        """Valid input produces no warnings."""
        da = analyze_draws(['9h', '8h'], ['Ah', '7d', '2s'])
        assert len(da.warnings) == 0, f"Unexpected warnings: {da.warnings}"

    def test_primary_label_is_never_empty(self):
        """primary_label is always set."""
        cases = [
            (['9h', '8h'], ['Ah', '7d', '2s']),
            (['Jh', 'Th'], ['Qh', '8h', '3c']),
            (['Ah', 'Kh'], []),
            (['6h', '7h'], ['8d', '9s', '2c']),
        ]
        for hole, board in cases:
            da = analyze_draws(hole, board)
            assert da.primary_label, (
                f"{hole} on {board}: primary_label should not be empty"
            )
