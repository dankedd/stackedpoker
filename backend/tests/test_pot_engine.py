"""
Pot engine tests — verifies deterministic, accurate pot tracking.

Tests cover: SRP, 3bet, blind raises (the edge case that broke legacy code),
all-ins, multiway, multistreet, antes.
"""
import pytest
from app.models.schemas import HandAction, PlayerInfo
from app.engines.pot_engine import (
    compute_pot_states,
    compute_final_pot,
    find_blind_players,
)


def make_action(street, player, action, size_bb=None, is_hero=False, is_all_in=False):
    return HandAction(
        street=street,
        player=player,
        action=action,
        size_bb=size_bb,
        is_hero=is_hero,
        is_all_in=is_all_in,
    )


def make_player(name, stack_bb, position="BTN"):
    return PlayerInfo(name=name, seat=1, stack_bb=stack_bb, position=position)


# ─────────────────────────────────────────────────────────────────────────────
# compute_pot_states
# ─────────────────────────────────────────────────────────────────────────────

class TestComputePotStates:

    def test_preflop_only_folds(self):
        """Everyone folds — pot should be SB + BB after all folds."""
        players = [
            make_player("SB", 100, "SB"),
            make_player("BB", 100, "BB"),
            make_player("BTN", 100, "BTN"),
        ]
        actions = [
            make_action("preflop", "BTN", "fold"),
            make_action("preflop", "SB", "fold"),
        ]
        states = compute_pot_states(actions, players, sb_bb=0.5, sb_player="SB", bb_player="BB")
        # Pot never grows from initial 1.5
        for s in states:
            assert s.pot_after == pytest.approx(1.5, rel=0.01)

    def test_srp_basic(self):
        """BTN raises to 3bb, BB calls 2bb (additional)."""
        players = [
            make_player("SB", 100, "SB"),
            make_player("BB", 100, "BB"),
            make_player("BTN", 100, "BTN"),
        ]
        actions = [
            make_action("preflop", "SB", "fold"),
            make_action("preflop", "BTN", "raise", size_bb=3.0),
            make_action("preflop", "BB", "call", size_bb=2.0),  # 2 additional
        ]
        states = compute_pot_states(actions, players, sb_bb=0.5, sb_player="SB", bb_player="BB")
        final_pot = states[-1].pot_after
        # SB 0.5 forfeited + BTN 3.0 + BB 1.0 initial + 2.0 call = 6.5
        assert final_pot == pytest.approx(6.5, rel=0.01)

    def test_3bet_pot(self):
        """BTN raises to 3, BB 3bets to 10, BTN calls 7 more."""
        players = [
            make_player("SB", 100, "SB"),
            make_player("BB", 100, "BB"),
            make_player("BTN", 100, "BTN"),
        ]
        actions = [
            make_action("preflop", "SB", "fold"),
            make_action("preflop", "BTN", "raise", size_bb=3.0),
            make_action("preflop", "BB", "raise", size_bb=10.0),  # 3bet "to 10"
            make_action("preflop", "BTN", "call", size_bb=7.0),   # calls 7 more
        ]
        states = compute_pot_states(actions, players, sb_bb=0.5, sb_player="SB", bb_player="BB")
        final_pot = states[-1].pot_after
        # SB 0.5 + BTN 10.0 + BB 10.0 = 20.5
        assert final_pot == pytest.approx(20.5, rel=0.01)

    def test_bb_raises_no_double_count(self):
        """BB open-raises: should NOT double-count BB's initial $1 post."""
        players = [
            make_player("SB", 100, "SB"),
            make_player("BB", 100, "BB"),
        ]
        actions = [
            make_action("preflop", "SB", "call", size_bb=0.5),  # SB completes (adds 0.5)
            make_action("preflop", "BB", "raise", size_bb=4.0), # BB raises to 4bb total
            make_action("preflop", "SB", "fold"),
        ]
        states = compute_pot_states(actions, players, sb_bb=0.5, sb_player="SB", bb_player="BB")
        final_pot = states[-1].pot_after
        # SB posts 0.5, completes for 0.5 more = 1.0 total.
        # BB posts 1.0, raises to 4.0 = 3.0 additional.
        # SB folds.
        # Pot = SB 1.0 + BB 4.0 = 5.0
        assert final_pot == pytest.approx(5.0, rel=0.01)

    def test_multistreet_pot(self):
        """Preflop raise + call, then flop bet + call."""
        players = [
            make_player("BTN", 100, "BTN"),
            make_player("BB", 100, "BB"),
        ]
        actions = [
            make_action("preflop", "BTN", "raise", size_bb=3.0),
            make_action("preflop", "BB", "call", size_bb=2.0),
            make_action("flop", "BB", "check"),
            make_action("flop", "BTN", "bet", size_bb=4.0),
            make_action("flop", "BB", "call", size_bb=4.0),
        ]
        states = compute_pot_states(actions, players, sb_bb=0.5, sb_player="", bb_player="BB")
        # After preflop: 0.5 (SB) + BB 1.0 + BTN 3.0 + BB 2.0 call = 6.5
        # But sb_player="" so no SB deducted. Let's recount:
        # No SB deduction (sb_player=""), BB posts 1.0, pot=1.0
        # BTN raises to 3.0: additional = 3.0, pot = 1.0 + 3.0 = 4.0
        # BB calls 2.0 (already in 1.0): pot = 4.0 + 2.0 = 6.0
        # Flop: BB checks (0), BTN bets 4.0: pot = 10.0, BB calls 4.0: pot = 14.0
        preflop_final = states[1].pot_after  # after BB call
        assert preflop_final == pytest.approx(6.0, rel=0.01)
        flop_final = states[-1].pot_after
        assert flop_final == pytest.approx(14.0, rel=0.01)

    def test_pot_before_is_correct(self):
        """pot_before should equal pot_after of the previous state."""
        players = [make_player("BTN", 100), make_player("BB", 100, "BB")]
        actions = [
            make_action("preflop", "BTN", "raise", size_bb=3.0),
            make_action("preflop", "BB", "call", size_bb=2.0),
        ]
        states = compute_pot_states(actions, players, sb_bb=0.5, sb_player="", bb_player="BB")
        assert states[1].pot_before == pytest.approx(states[0].pot_after, rel=0.01)

    def test_all_in_capped_at_stack(self):
        """Player going all-in can't commit more than their stack."""
        players = [
            make_player("SB", 20, "SB"),
            make_player("BB", 100, "BB"),
        ]
        actions = [
            # SB shoves 20bb (but only has 20 — after posting 0.5, has 19.5)
            make_action("preflop", "SB", "raise", size_bb=20.0, is_all_in=True),
            make_action("preflop", "BB", "call", size_bb=19.0),
        ]
        states = compute_pot_states(
            actions, players, sb_bb=0.5, sb_player="SB", bb_player="BB"
        )
        # SB stack was 20, posted 0.5 → remaining 19.5. Raise "to 20" means 19.5 additional.
        # BB posts 1.0. Calls 19.0 additional.
        # Pot = 0.5 + 19.5 + 1.0 + 19.0 = 40.0
        assert states[-1].player_stacks.get("SB", 0.0) >= 0.0
        assert states[-1].player_stacks.get("BB", 0.0) >= 0.0

    def test_state_count_equals_action_count(self):
        players = [make_player("BTN", 100), make_player("BB", 100, "BB")]
        actions = [
            make_action("preflop", "BTN", "fold"),
        ]
        states = compute_pot_states(actions, players, sb_bb=0.5, sb_player="", bb_player="BB")
        assert len(states) == len(actions)


# ─────────────────────────────────────────────────────────────────────────────
# compute_final_pot
# ─────────────────────────────────────────────────────────────────────────────

class TestComputeFinalPot:

    def test_simple_srp(self):
        actions = [
            make_action("preflop", "BTN", "raise", size_bb=3.0),
            make_action("preflop", "BB", "call", size_bb=2.0),
        ]
        # pot = SB(0.5) + BB(1.0) + BTN raise(3.0) + BB call additional(2.0) = 6.5
        result = compute_final_pot(actions, sb_bb=0.5, bb_bb=1.0, antes_bb=0.0)
        assert result == pytest.approx(6.5, rel=0.01)

    def test_antes(self):
        actions = [
            make_action("preflop", "BTN", "raise", size_bb=3.0),
            make_action("preflop", "BB", "call", size_bb=2.0),
        ]
        result = compute_final_pot(actions, sb_bb=0.5, bb_bb=1.0, antes_bb=0.9)
        assert result == pytest.approx(7.4, rel=0.01)

    def test_3bet_pot_no_double_count(self):
        """3bet pot — BB re-raises; BB's blind post must not be double-counted."""
        actions = [
            make_action("preflop", "BTN", "raise", size_bb=3.0),
            make_action("preflop", "BB", "raise", size_bb=10.0),   # 3bet "to 10"
            make_action("preflop", "BTN", "call", size_bb=7.0),    # calls 7 more
        ]
        # Passing bb_player so the function knows BB already posted 1.0
        result = compute_final_pot(
            actions, sb_bb=0.5, bb_bb=1.0, antes_bb=0.0, bb_player="BB"
        )
        # SB 0.5 + BB 10.0 total + BTN 10.0 total = 20.5
        assert result == pytest.approx(20.5, rel=0.01)

    def test_multistreet(self):
        actions = [
            make_action("preflop", "BTN", "raise", size_bb=3.0),
            make_action("preflop", "BB", "call", size_bb=2.0),
            make_action("flop", "BB", "check"),
            make_action("flop", "BTN", "bet", size_bb=4.0),
            make_action("flop", "BB", "call", size_bb=4.0),
        ]
        result = compute_final_pot(actions, sb_bb=0.5, bb_bb=1.0, antes_bb=0.0)
        # Preflop: 0.5+1.0+3.0+2.0=6.5. Flop: +4.0+4.0=8.0. Total=14.5
        assert result == pytest.approx(14.5, rel=0.01)


# ─────────────────────────────────────────────────────────────────────────────
# find_blind_players
# ─────────────────────────────────────────────────────────────────────────────

class TestFindBlindPlayers:
    def test_finds_sb_and_bb_from_positions(self):
        players = [
            make_player("Alice", 100, "SB"),
            make_player("Bob", 100, "BB"),
            make_player("Carol", 100, "BTN"),
        ]
        sb, bb = find_blind_players(players, [])
        assert sb == "Alice"
        assert bb == "Bob"

    def test_returns_empty_strings_if_not_found(self):
        players = [make_player("BTN", 100, "BTN")]
        sb, bb = find_blind_players(players, [])
        assert sb == ""
        assert bb == ""
