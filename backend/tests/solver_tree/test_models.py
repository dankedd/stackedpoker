"""Tests for SolverNode model and ID generation."""

from app.solver_tree.models import (
    SolverNode,
    encode_action,
    decode_action,
    make_node_id,
    make_human_path,
)


class TestEncodeAction:
    def test_check(self):
        assert encode_action("CHECK") == "x"

    def test_call(self):
        assert encode_action("CALL") == "c"

    def test_fold(self):
        assert encode_action("FOLD") == "f"

    def test_bet_integer(self):
        assert encode_action("BET 96.000000") == "b96"

    def test_bet_small(self):
        assert encode_action("BET 3.250000") == "b3"

    def test_raise(self):
        assert encode_action("RAISE 192.000000") == "r192"

    def test_allin(self):
        assert encode_action("ALLIN") == "ai"

    def test_bet_with_pot_context(self):
        """With pot context, BET 2.0 into 6.5 pot = 31% pot → b31."""
        assert encode_action("BET 2.000000", pot_size=6.5, effective_stack=96.8) == "b31"

    def test_bet_allin_with_context(self):
        """BET 96 with 96.8 effective stack = 99% of stack → ai."""
        assert encode_action("BET 96.000000", pot_size=6.5, effective_stack=96.8) == "ai"

    def test_case_insensitive(self):
        assert encode_action("check") == "x"
        assert encode_action("Check") == "x"

    def test_whitespace(self):
        assert encode_action("  BET 50  ") == "b50"


class TestDecodeAction:
    def test_check(self):
        assert decode_action("x") == "check"

    def test_call(self):
        assert decode_action("c") == "call"

    def test_fold(self):
        assert decode_action("f") == "fold"

    def test_bet(self):
        assert decode_action("b96") == "bet 96"

    def test_raise(self):
        assert decode_action("r192") == "raise 192"

    def test_allin(self):
        assert decode_action("ai") == "all-in"


class TestMakeNodeId:
    def test_deterministic(self):
        id1 = make_node_id("solve1", "Ah 7d 2c", "")
        id2 = make_node_id("solve1", "Ah 7d 2c", "")
        assert id1 == id2

    def test_different_paths_different_ids(self):
        id1 = make_node_id("solve1", "Ah 7d 2c", "")
        id2 = make_node_id("solve1", "Ah 7d 2c", "x-b96")
        assert id1 != id2

    def test_different_solves_different_ids(self):
        id1 = make_node_id("solve1", "Ah 7d 2c", "x")
        id2 = make_node_id("solve2", "Ah 7d 2c", "x")
        assert id1 != id2

    def test_length(self):
        nid = make_node_id("solve1", "Ah 7d 2c", "x-b96-c")
        assert len(nid) == 16

    def test_hex_only(self):
        nid = make_node_id("solve1", "Ah 7d 2c", "x-b96-c")
        assert all(c in "0123456789abcdef" for c in nid)


class TestMakeHumanPath:
    def test_root(self):
        path = make_human_path("Ah 7d 2c", [])
        assert path == "root:flop:Ah7d2c"

    def test_single_action(self):
        path = make_human_path("Ah 7d 2c", ["x"])
        assert path == "root:flop:Ah7d2c:x"

    def test_multi_action(self):
        path = make_human_path("Ah 7d 2c", ["x", "b96", "c"])
        assert path == "root:flop:Ah7d2c:x-b96-c"

    def test_turn(self):
        path = make_human_path("Ah 7d 2c 5s", [])
        assert path == "root:turn:Ah7d2c5s"

    def test_river(self):
        path = make_human_path("Ah 7d 2c 5s Kh", [])
        assert path == "root:river:Ah7d2c5sKh"


class TestSolverNodeSerialization:
    def test_roundtrip(self):
        node = SolverNode(
            id="abc123def4567890",
            solve_id="job-1",
            human_path="root:flop:Ah7d2c",
            parent_id=None,
            children_ids=["child1", "child2"],
            action_history=[],
            action_path="",
            depth=0,
            street="flop",
            board=["Ah", "7d", "2c"],
            pot_size=6.5,
            actor="oop",
            available_actions=["x", "b96"],
            is_terminal=False,
            strategy={"AhKs": [0.5, 0.5], "QdQc": [0.9, 0.1]},
            aggregate_freqs={"x": 0.7, "b96": 0.3},
            combo_count=2,
            node_type="action",
            raw_player=1,
        )
        d = node.to_dict()
        restored = SolverNode.from_dict(d)

        assert restored.id == node.id
        assert restored.solve_id == node.solve_id
        assert restored.parent_id is None
        assert restored.children_ids == ["child1", "child2"]
        assert restored.strategy == {"AhKs": [0.5, 0.5], "QdQc": [0.9, 0.1]}
        assert restored.aggregate_freqs == {"x": 0.7, "b96": 0.3}
        assert restored.actor == "oop"
        assert restored.board == ["Ah", "7d", "2c"]
