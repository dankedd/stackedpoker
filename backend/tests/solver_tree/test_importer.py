"""Tests for recursive DFS tree importer."""

import pytest
from app.solver_tree.importer import import_solve_tree


def _make_v020_tree():
    """Build a realistic TexasSolver v0.2.0 game tree for testing.

    Tree structure (flop: Jh 9c 4d):
      ROOT (OOP, player=1): CHECK / BET 96
        ├─ CHECK → IP (player=0): CHECK / BET 96
        │   ├─ CHECK → chance_node (x-x)         [end of street]
        │   └─ BET 96 → OOP (player=1): CALL / FOLD
        │       ├─ CALL → chance_node (x-ai-c)  [end of street]
        │       └─ FOLD → terminal (x-ai-f)
        └─ BET 96 → IP (player=0): CALL / FOLD
            ├─ CALL → chance_node (ai-c)         [end of street]
            └─ FOLD → terminal (ai-f)

    Total: 4 action + 3 chance + 2 terminal = 9 nodes
    """
    return {
        "actions": ["CHECK", "BET 96.000000"],
        "childrens": {
            "CHECK": {
                "actions": ["CHECK", "BET 96.000000"],
                "childrens": {
                    "CHECK": {"deal_number": 0, "node_type": "chance_node"},
                    "BET 96.000000": {
                        "actions": ["CALL", "FOLD"],
                        "childrens": {
                            "CALL": {"deal_number": 0, "node_type": "chance_node"},
                            "FOLD": {},  # terminal — no node_type
                        },
                        "node_type": "action_node",
                        "player": 1,
                        "strategy": {
                            "actions": ["CALL", "FOLD"],
                            "strategy": {"AhKs": [0.8, 0.2]},
                        },
                    },
                },
                "node_type": "action_node",
                "player": 0,
                "strategy": {
                    "actions": ["CHECK", "BET 96.000000"],
                    "strategy": {
                        "AhKs": [0.3, 0.7],
                        "QdQc": [0.9, 0.1],
                    },
                },
            },
            "BET 96.000000": {
                "actions": ["CALL", "FOLD"],
                "childrens": {
                    "CALL": {"deal_number": 0, "node_type": "chance_node"},
                    "FOLD": {},  # terminal
                },
                "node_type": "action_node",
                "player": 0,
                "strategy": {
                    "actions": ["CALL", "FOLD"],
                    "strategy": {
                        "AhKs": [0.5, 0.5],
                        "QdQc": [1.0, 0.0],
                        "7h6h": [0.0, 1.0],
                    },
                },
            },
        },
        "node_type": "action_node",
        "player": 1,
        "strategy": {
            "actions": ["CHECK", "BET 96.000000"],
            "strategy": {
                "AhKs": [0.8, 0.2],
                "QdQc": [0.95, 0.05],
                "7h6h": [0.99, 0.01],
            },
        },
    }


class TestImportSolveTree:
    def test_imports_all_nodes(self):
        data = _make_v020_tree()
        result = import_solve_tree(data, "test-1", ["Jh", "9c", "4d"], pot_size=6.5, effective_stack=96.8)
        # 4 action + 3 chance + 2 terminal = 9 nodes
        assert result.total == 9
        assert result.action_nodes == 4
        assert result.chance_nodes == 3
        assert result.terminal_nodes == 2

    def test_root_has_no_parent(self):
        data = _make_v020_tree()
        result = import_solve_tree(data, "test-1", ["Jh", "9c", "4d"], pot_size=6.5, effective_stack=96.8)
        root = result.nodes[0]
        assert root.parent_id is None
        assert root.depth == 0
        assert root.action_path == ""

    def test_root_is_oop(self):
        data = _make_v020_tree()
        result = import_solve_tree(data, "test-1", ["Jh", "9c", "4d"], pot_size=6.5, effective_stack=96.8)
        root = result.nodes[0]
        assert root.actor == "oop"
        assert root.raw_player == 1

    def test_children_wired(self):
        data = _make_v020_tree()
        result = import_solve_tree(data, "test-1", ["Jh", "9c", "4d"], pot_size=6.5, effective_stack=96.8)
        root = result.nodes[0]
        # Root should have 2 children (CHECK and BET)
        assert len(root.children_ids) == 2

    def test_parent_child_consistency(self):
        """Every child references its parent and vice versa."""
        data = _make_v020_tree()
        result = import_solve_tree(data, "test-1", ["Jh", "9c", "4d"], pot_size=6.5, effective_stack=96.8)
        id_map = {n.id: n for n in result.nodes}
        for node in result.nodes:
            if node.parent_id:
                parent = id_map[node.parent_id]
                assert node.id in parent.children_ids, (
                    f"node {node.human_path} not in parent's children_ids"
                )
            for cid in node.children_ids:
                child = id_map[cid]
                assert child.parent_id == node.id, (
                    f"child {child.human_path} parent_id mismatch"
                )

    def test_deterministic_ids(self):
        data = _make_v020_tree()
        r1 = import_solve_tree(data, "test-1", ["Jh", "9c", "4d"], pot_size=6.5, effective_stack=96.8)
        r2 = import_solve_tree(data, "test-1", ["Jh", "9c", "4d"], pot_size=6.5, effective_stack=96.8)
        ids1 = [n.id for n in r1.nodes]
        ids2 = [n.id for n in r2.nodes]
        assert ids1 == ids2

    def test_different_solve_ids_produce_different_node_ids(self):
        data = _make_v020_tree()
        r1 = import_solve_tree(data, "solve-a", ["Jh", "9c", "4d"])
        r2 = import_solve_tree(data, "solve-b", ["Jh", "9c", "4d"])
        ids1 = set(n.id for n in r1.nodes)
        ids2 = set(n.id for n in r2.nodes)
        assert ids1.isdisjoint(ids2)

    def test_no_duplicate_ids(self):
        data = _make_v020_tree()
        result = import_solve_tree(data, "test-1", ["Jh", "9c", "4d"], pot_size=6.5, effective_stack=96.8)
        ids = [n.id for n in result.nodes]
        assert len(ids) == len(set(ids))

    def test_action_paths_correct(self):
        data = _make_v020_tree()
        result = import_solve_tree(data, "test-1", ["Jh", "9c", "4d"], pot_size=6.5, effective_stack=96.8)
        paths = {n.action_path for n in result.nodes}
        assert "" in paths       # root
        assert "x" in paths      # CHECK
        assert "ai" in paths    # BET 96
        assert "x-x" in paths   # CHECK→CHECK (chance)
        assert "x-ai" in paths  # CHECK→BET
        assert "x-ai-c" in paths  # CHECK→BET→CALL (chance)
        assert "x-ai-f" in paths  # CHECK→BET→FOLD (terminal)
        assert "ai-c" in paths  # BET→CALL (chance)
        assert "ai-f" in paths  # BET→FOLD (terminal)

    def test_action_history_matches_path(self):
        data = _make_v020_tree()
        result = import_solve_tree(data, "test-1", ["Jh", "9c", "4d"], pot_size=6.5, effective_stack=96.8)
        for node in result.nodes:
            expected_path = "-".join(node.action_history) if node.action_history else ""
            assert node.action_path == expected_path

    def test_depth_correct(self):
        data = _make_v020_tree()
        result = import_solve_tree(data, "test-1", ["Jh", "9c", "4d"], pot_size=6.5, effective_stack=96.8)
        for node in result.nodes:
            assert node.depth == len(node.action_history)

    def test_chance_nodes_not_terminal(self):
        """Chance nodes are NOT terminal — they deal the next card."""
        data = _make_v020_tree()
        result = import_solve_tree(data, "test-1", ["Jh", "9c", "4d"], pot_size=6.5, effective_stack=96.8)
        chance = [n for n in result.nodes if n.node_type == "chance"]
        assert len(chance) == 3
        for c in chance:
            assert c.actor is None
            assert not c.is_terminal, f"chance node {c.human_path} should not be terminal"

    def test_terminal_nodes_identified(self):
        """Nodes without node_type (FOLD endpoints) are terminal."""
        data = _make_v020_tree()
        result = import_solve_tree(data, "test-1", ["Jh", "9c", "4d"], pot_size=6.5, effective_stack=96.8)
        terminals = [n for n in result.nodes if n.is_terminal]
        assert len(terminals) == 2
        terminal_paths = {n.action_path for n in terminals}
        assert "x-ai-f" in terminal_paths
        assert "ai-f" in terminal_paths

    def test_strategy_data_preserved(self):
        data = _make_v020_tree()
        result = import_solve_tree(data, "test-1", ["Jh", "9c", "4d"], pot_size=6.5, effective_stack=96.8)
        root = result.nodes[0]
        assert root.combo_count == 3
        assert "AhKs" in root.strategy
        assert root.strategy["AhKs"] == [0.8, 0.2]

    def test_aggregate_freqs_computed(self):
        data = _make_v020_tree()
        result = import_solve_tree(data, "test-1", ["Jh", "9c", "4d"], pot_size=6.5, effective_stack=96.8)
        root = result.nodes[0]
        assert "x" in root.aggregate_freqs
        assert "ai" in root.aggregate_freqs
        total = sum(root.aggregate_freqs.values())
        assert abs(total - 1.0) < 0.01

    def test_board_on_all_flop_nodes(self):
        data = _make_v020_tree()
        result = import_solve_tree(data, "test-1", ["Jh", "9c", "4d"], pot_size=6.5, effective_stack=96.8)
        for node in result.nodes:
            assert node.board[:3] == ["Jh", "9c", "4d"]
            assert node.street == "flop"

    def test_human_paths_readable(self):
        data = _make_v020_tree()
        result = import_solve_tree(data, "test-1", ["Jh", "9c", "4d"], pot_size=6.5, effective_stack=96.8)
        root = result.nodes[0]
        assert root.human_path == "root:flop:Jh9c4d"
        paths = {n.human_path for n in result.nodes}
        assert "root:flop:Jh9c4d:x" in paths
        assert "root:flop:Jh9c4d:ai" in paths

    def test_pot_size_propagated(self):
        data = _make_v020_tree()
        result = import_solve_tree(data, "test-1", ["Jh", "9c", "4d"], pot_size=6.5, effective_stack=96.8)
        for node in result.nodes:
            assert node.pot_size == 6.5

    def test_summary_string(self):
        data = _make_v020_tree()
        result = import_solve_tree(data, "test-1", ["Jh", "9c", "4d"], pot_size=6.5, effective_stack=96.8)
        s = result.summary()
        assert "9 nodes" in s
        assert "action=4" in s
        assert "chance=3" in s
        assert "terminal=2" in s

    def test_solve_id_on_all_nodes(self):
        data = _make_v020_tree()
        result = import_solve_tree(data, "my-solve-42", ["Jh", "9c", "4d"])
        for node in result.nodes:
            assert node.solve_id == "my-solve-42"


class TestChanceNodeStreetTransitions:
    """Chance nodes should advance the street and update the board."""

    def _make_tree_with_turn_transition(self):
        """Flop tree where chance node has children on the turn."""
        return {
            "node_type": "action_node",
            "player": 1,
            "actions": ["CHECK"],
            "strategy": {"actions": ["CHECK"], "strategy": {"AhKs": [1.0]}},
            "childrens": {
                "CHECK": {
                    "node_type": "action_node",
                    "player": 0,
                    "actions": ["CHECK"],
                    "strategy": {"actions": ["CHECK"], "strategy": {"AhKs": [1.0]}},
                    "childrens": {
                        "CHECK": {
                            "node_type": "chance_node",
                            "deal_number": 0,
                            "childrens": {
                                "5s": {
                                    "node_type": "action_node",
                                    "player": 1,
                                    "actions": ["CHECK", "BET 50.000000"],
                                    "strategy": {
                                        "actions": ["CHECK", "BET 50.000000"],
                                        "strategy": {"AhKs": [0.6, 0.4]},
                                    },
                                    "childrens": {},
                                },
                                "Kh": {
                                    "node_type": "action_node",
                                    "player": 1,
                                    "actions": ["CHECK"],
                                    "strategy": {
                                        "actions": ["CHECK"],
                                        "strategy": {"AhKs": [1.0]},
                                    },
                                    "childrens": {},
                                },
                            },
                        },
                    },
                },
            },
        }

    def test_turn_nodes_have_correct_street(self):
        data = self._make_tree_with_turn_transition()
        result = import_solve_tree(data, "test-turn", ["Jh", "9c", "4d"])

        by_path = {n.action_path: n for n in result.nodes}

        # Flop nodes
        assert by_path[""].street == "flop"
        assert by_path["x"].street == "flop"
        assert by_path["x-x"].street == "flop"  # chance node is still flop

        # Turn nodes — children of chance node
        turn_5s = by_path["x-x-5s"]
        assert turn_5s.street == "turn"
        assert turn_5s.board == ["Jh", "9c", "4d", "5s"]

        turn_kh = by_path["x-x-kh"]
        assert turn_kh.street == "turn"
        assert turn_kh.board == ["Jh", "9c", "4d", "Kh"]

    def test_chance_node_lists_dealt_cards(self):
        data = self._make_tree_with_turn_transition()
        result = import_solve_tree(data, "test-turn", ["Jh", "9c", "4d"])

        chance = [n for n in result.nodes if n.node_type == "chance"]
        assert len(chance) == 1
        assert set(chance[0].available_actions) == {"5s", "Kh"}

    def test_turn_children_wired_to_chance_parent(self):
        data = self._make_tree_with_turn_transition()
        result = import_solve_tree(data, "test-turn", ["Jh", "9c", "4d"])

        by_path = {n.action_path: n for n in result.nodes}
        chance = by_path["x-x"]
        assert len(chance.children_ids) == 2

        turn_5s = by_path["x-x-5s"]
        assert turn_5s.parent_id == chance.id

    def test_total_node_count_with_turn(self):
        data = self._make_tree_with_turn_transition()
        result = import_solve_tree(data, "test-turn", ["Jh", "9c", "4d"])
        # root(OOP) + check(IP) + chance + 5s(OOP) + Kh(OOP) = 5
        assert result.total == 5
        assert result.action_nodes == 4
        assert result.chance_nodes == 1


class TestImportEdgeCases:
    def test_empty_dict(self):
        result = import_solve_tree({}, "test-empty", ["Ah", "7d", "2c"])
        assert result.total == 1
        assert result.terminal_nodes == 1

    def test_single_chance_node(self):
        data = {"node_type": "chance_node", "deal_number": 0}
        result = import_solve_tree(data, "test-chance", ["Ah", "7d", "2c"])
        assert result.total == 1
        assert result.chance_nodes == 1
        assert result.nodes[0].node_type == "chance"
        assert result.nodes[0].actor is None
        assert not result.nodes[0].is_terminal

    def test_action_node_no_children(self):
        data = {
            "node_type": "action_node",
            "player": 0,
            "actions": ["CHECK"],
            "strategy": {"actions": ["CHECK"], "strategy": {"AhKs": [1.0]}},
            "childrens": {},
        }
        result = import_solve_tree(data, "test-leaf", ["Ah", "7d", "2c"])
        assert result.total == 1
        assert result.action_nodes == 1

    def test_max_depth_guard(self):
        """Deeply nested tree should be truncated at max_depth."""
        node = {"node_type": "chance_node"}
        for i in range(30):
            node = {
                "node_type": "action_node",
                "player": i % 2,
                "actions": ["CHECK"],
                "strategy": {"actions": ["CHECK"], "strategy": {"AhKs": [1.0]}},
                "childrens": {"CHECK": node},
            }
        result = import_solve_tree(
            node, "test-deep", ["Ah", "7d", "2c"], max_depth=15,
        )
        assert result.max_depth <= 15
        assert result.total <= 16

    def test_max_nodes_guard(self):
        """Wide tree should stop at max_nodes."""
        childrens = {}
        for i in range(50):
            childrens[f"BET {i}.000000"] = {}
        data = {
            "node_type": "action_node",
            "player": 1,
            "actions": list(childrens.keys()),
            "strategy": {
                "actions": list(childrens.keys()),
                "strategy": {"AhKs": [1.0 / 50] * 50},
            },
            "childrens": childrens,
        }
        result = import_solve_tree(
            data, "test-wide", ["Ah", "7d", "2c"], max_nodes=10,
        )
        assert result.total <= 10

    def test_non_dict_children_skipped(self):
        """Non-dict entries in childrens should be safely skipped."""
        data = {
            "node_type": "action_node",
            "player": 1,
            "actions": ["CHECK"],
            "strategy": {"actions": ["CHECK"], "strategy": {"AhKs": [1.0]}},
            "childrens": {
                "CHECK": "invalid_string",
            },
        }
        result = import_solve_tree(data, "test-bad", ["Ah", "7d", "2c"])
        assert result.total == 1


class TestLargeTree:
    """Verify the importer handles trees with 1000+ nodes."""

    @staticmethod
    def _build_binary_tree(depth: int) -> dict:
        """Build a complete binary action tree to the given depth."""
        if depth <= 0:
            return {}  # terminal
        return {
            "node_type": "action_node",
            "player": depth % 2,
            "actions": ["CHECK", "BET 50.000000"],
            "strategy": {
                "actions": ["CHECK", "BET 50.000000"],
                "strategy": {"AhKs": [0.5, 0.5], "QdQc": [0.6, 0.4]},
            },
            "childrens": {
                "CHECK": TestLargeTree._build_binary_tree(depth - 1),
                "BET 50.000000": TestLargeTree._build_binary_tree(depth - 1),
            },
        }

    def test_1000_plus_nodes(self):
        # depth=10 binary tree: 2^10 - 1 = 1023 action + 1024 terminal = 2047
        tree = self._build_binary_tree(10)
        result = import_solve_tree(tree, "large-1", ["Ah", "Kd", "7c"])
        assert result.total >= 1000
        assert result.duplicates_skipped == 0

        # Verify structural integrity
        id_map = {n.id: n for n in result.nodes}
        for node in result.nodes:
            if node.parent_id:
                assert node.parent_id in id_map
                assert node.id in id_map[node.parent_id].children_ids
            for cid in node.children_ids:
                assert cid in id_map
                assert id_map[cid].parent_id == node.id

    def test_large_tree_no_duplicate_ids(self):
        tree = self._build_binary_tree(8)
        result = import_solve_tree(tree, "large-2", ["Ah", "Kd", "7c"])
        ids = [n.id for n in result.nodes]
        assert len(ids) == len(set(ids))

    def test_large_tree_deterministic(self):
        tree = self._build_binary_tree(6)
        r1 = import_solve_tree(tree, "det-1", ["Ah", "Kd", "7c"])
        r2 = import_solve_tree(tree, "det-1", ["Ah", "Kd", "7c"])
        assert [n.id for n in r1.nodes] == [n.id for n in r2.nodes]


class TestImportWithRealOutput:
    """Test with actual TexasSolver output file if available."""

    @pytest.fixture
    def real_output(self):
        import json
        from pathlib import Path
        output_dir = Path("C:/data/solves/output")
        if not output_dir.exists():
            pytest.skip("No solve output directory")
        for job_dir in output_dir.iterdir():
            output_file = job_dir / "solve_output.json"
            if output_file.exists():
                with open(output_file) as f:
                    return json.load(f), str(job_dir.name)
        pytest.skip("No solve output files found")

    def test_real_tree_imports(self, real_output):
        data, job_id = real_output
        result = import_solve_tree(data, job_id, ["Jh", "9c", "4d"], pot_size=6.5)
        assert result.total > 0
        assert result.action_nodes > 0
        ids = [n.id for n in result.nodes]
        assert len(ids) == len(set(ids))
        id_map = {n.id: n for n in result.nodes}
        for node in result.nodes:
            for cid in node.children_ids:
                assert cid in id_map
                assert id_map[cid].parent_id == node.id
