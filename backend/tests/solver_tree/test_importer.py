"""Tests for recursive DFS tree importer."""

import pytest
from app.solver_tree.importer import import_solve_tree


def _make_v020_tree():
    """Build a realistic TexasSolver v0.2.0 game tree for testing."""
    return {
        "actions": ["CHECK", "BET 96.000000"],
        "childrens": {
            "BET 96.000000": {
                "actions": ["CALL", "FOLD"],
                "childrens": {
                    "CALL": {"deal_number": 0, "node_type": "chance_node"},
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
            "CHECK": {
                "actions": ["CHECK", "BET 96.000000"],
                "childrens": {
                    "BET 96.000000": {
                        "actions": ["CALL", "FOLD"],
                        "childrens": {
                            "CALL": {"deal_number": 0, "node_type": "chance_node"},
                        },
                        "node_type": "action_node",
                        "player": 1,
                        "strategy": {
                            "actions": ["CALL", "FOLD"],
                            "strategy": {"AhKs": [0.8, 0.2]},
                        },
                    },
                    "CHECK": {"deal_number": 0, "node_type": "chance_node"},
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
        result = import_solve_tree(data, "test-1", ["Jh", "9c", "4d"], pot_size=6.5)
        # 4 action + 3 chance = 7 nodes
        assert result.total == 7
        assert result.action_nodes == 4
        assert result.chance_nodes == 3

    def test_root_has_no_parent(self):
        data = _make_v020_tree()
        result = import_solve_tree(data, "test-1", ["Jh", "9c", "4d"])
        root = result.nodes[0]
        assert root.parent_id is None
        assert root.depth == 0
        assert root.action_path == ""

    def test_root_is_oop(self):
        data = _make_v020_tree()
        result = import_solve_tree(data, "test-1", ["Jh", "9c", "4d"])
        root = result.nodes[0]
        assert root.actor == "oop"
        assert root.raw_player == 1

    def test_children_wired(self):
        data = _make_v020_tree()
        result = import_solve_tree(data, "test-1", ["Jh", "9c", "4d"])
        root = result.nodes[0]
        # Root should have 2 children (CHECK and BET)
        assert len(root.children_ids) == 2

    def test_parent_child_consistency(self):
        data = _make_v020_tree()
        result = import_solve_tree(data, "test-1", ["Jh", "9c", "4d"])
        id_map = {n.id: n for n in result.nodes}
        for node in result.nodes:
            if node.parent_id:
                parent = id_map[node.parent_id]
                assert node.id in parent.children_ids
            for cid in node.children_ids:
                child = id_map[cid]
                assert child.parent_id == node.id

    def test_deterministic_ids(self):
        data = _make_v020_tree()
        r1 = import_solve_tree(data, "test-1", ["Jh", "9c", "4d"])
        r2 = import_solve_tree(data, "test-1", ["Jh", "9c", "4d"])
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
        result = import_solve_tree(data, "test-1", ["Jh", "9c", "4d"])
        ids = [n.id for n in result.nodes]
        assert len(ids) == len(set(ids))

    def test_action_paths_correct(self):
        data = _make_v020_tree()
        result = import_solve_tree(data, "test-1", ["Jh", "9c", "4d"])
        paths = {n.action_path for n in result.nodes}
        # Root has "" path
        assert "" in paths
        # CHECK path
        assert "x" in paths
        # BET path
        assert "b96" in paths
        # CHECK→CHECK (chance node)
        assert "x-x" in paths
        # CHECK→BET→CALL (chance node)
        assert "x-b96-c" in paths

    def test_action_history_matches_path(self):
        data = _make_v020_tree()
        result = import_solve_tree(data, "test-1", ["Jh", "9c", "4d"])
        for node in result.nodes:
            expected_path = "-".join(node.action_history) if node.action_history else ""
            assert node.action_path == expected_path

    def test_depth_correct(self):
        data = _make_v020_tree()
        result = import_solve_tree(data, "test-1", ["Jh", "9c", "4d"])
        for node in result.nodes:
            assert node.depth == len(node.action_history)

    def test_chance_nodes_identified(self):
        data = _make_v020_tree()
        result = import_solve_tree(data, "test-1", ["Jh", "9c", "4d"])
        chance = [n for n in result.nodes if n.node_type == "chance"]
        assert len(chance) == 3  # 3 chance nodes
        for c in chance:
            assert c.actor is None

    def test_strategy_data_preserved(self):
        data = _make_v020_tree()
        result = import_solve_tree(data, "test-1", ["Jh", "9c", "4d"])
        root = result.nodes[0]
        assert root.combo_count == 3
        assert "AhKs" in root.strategy
        assert root.strategy["AhKs"] == [0.8, 0.2]

    def test_aggregate_freqs_computed(self):
        data = _make_v020_tree()
        result = import_solve_tree(data, "test-1", ["Jh", "9c", "4d"])
        root = result.nodes[0]
        assert "x" in root.aggregate_freqs
        assert "b96" in root.aggregate_freqs
        total = sum(root.aggregate_freqs.values())
        assert abs(total - 1.0) < 0.01

    def test_board_on_all_nodes(self):
        data = _make_v020_tree()
        result = import_solve_tree(data, "test-1", ["Jh", "9c", "4d"])
        for node in result.nodes:
            assert node.board == ["Jh", "9c", "4d"]
            assert node.street == "flop"

    def test_human_paths_readable(self):
        data = _make_v020_tree()
        result = import_solve_tree(data, "test-1", ["Jh", "9c", "4d"])
        root = result.nodes[0]
        assert root.human_path == "root:flop:Jh9c4d"
        paths = {n.human_path for n in result.nodes}
        assert "root:flop:Jh9c4d:x" in paths
        assert "root:flop:Jh9c4d:b96" in paths

    def test_pot_size_propagated(self):
        data = _make_v020_tree()
        result = import_solve_tree(data, "test-1", ["Jh", "9c", "4d"], pot_size=6.5)
        for node in result.nodes:
            assert node.pot_size == 6.5

    def test_summary_string(self):
        data = _make_v020_tree()
        result = import_solve_tree(data, "test-1", ["Jh", "9c", "4d"])
        s = result.summary()
        assert "7 nodes" in s
        assert "action=4" in s
        assert "chance=3" in s


class TestImportEdgeCases:
    def test_empty_dict(self):
        result = import_solve_tree({}, "test-empty", ["Ah", "7d", "2c"])
        # Empty dict is treated as a terminal node
        assert result.total == 1

    def test_single_chance_node(self):
        data = {"node_type": "chance_node", "deal_number": 0}
        result = import_solve_tree(data, "test-chance", ["Ah", "7d", "2c"])
        assert result.total == 1
        assert result.chance_nodes == 1
        assert result.nodes[0].node_type == "chance"
        assert result.nodes[0].actor is None

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
        """Deeply nested tree should be truncated at configurable max_depth."""
        # Build a chain: root → child → ... (25 deep)
        node = {"node_type": "chance_node"}
        for i in range(25):
            node = {
                "node_type": "action_node",
                "player": i % 2,
                "actions": ["CHECK"],
                "strategy": {"actions": ["CHECK"], "strategy": {"AhKs": [1.0]}},
                "childrens": {"CHECK": node},
            }
        # Use explicit max_depth=10 to test the guard
        result = import_solve_tree(node, "test-deep", ["Ah", "7d", "2c"], max_depth=10)
        assert result.max_depth <= 10
        assert result.total <= 12  # 11 action + 1 chance at most


class TestImportWithRealOutput:
    """Test with actual TexasSolver output file if available."""

    @pytest.fixture
    def real_output(self):
        import json
        from pathlib import Path
        # Try to find a real solve output
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
        # Verify no duplicates
        ids = [n.id for n in result.nodes]
        assert len(ids) == len(set(ids))
        # Verify parent/child consistency
        id_map = {n.id: n for n in result.nodes}
        for node in result.nodes:
            for cid in node.children_ids:
                assert cid in id_map
                assert id_map[cid].parent_id == node.id
