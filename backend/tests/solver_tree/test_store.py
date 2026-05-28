"""Tests for SolveTreeStore filesystem persistence."""

import asyncio
import json

from app.solver_tree.models import SolverNode
from app.solver_tree.store import SolveTreeStore


def _make_nodes(solve_id: str = "test-solve") -> list[SolverNode]:
    """Create a small test tree: root → 2 children."""
    root = SolverNode(
        id="root000000000000",
        solve_id=solve_id,
        human_path="root:flop:Ah7d2c",
        parent_id=None,
        children_ids=["child10000000000", "child20000000000"],
        action_path="",
        depth=0,
        street="flop",
        board=["Ah", "7d", "2c"],
        pot_size=6.5,
        actor="oop",
        available_actions=["x", "b96"],
        strategy={"AhKs": [0.7, 0.3]},
        aggregate_freqs={"x": 0.7, "b96": 0.3},
        combo_count=1,
        node_type="action",
        raw_player=1,
    )
    child1 = SolverNode(
        id="child10000000000",
        solve_id=solve_id,
        human_path="root:flop:Ah7d2c:x",
        parent_id="root000000000000",
        action_history=["x"],
        action_path="x",
        depth=1,
        street="flop",
        board=["Ah", "7d", "2c"],
        pot_size=6.5,
        actor="ip",
        node_type="action",
        raw_player=0,
    )
    child2 = SolverNode(
        id="child20000000000",
        solve_id=solve_id,
        human_path="root:flop:Ah7d2c:b96",
        parent_id="root000000000000",
        action_history=["b96"],
        action_path="b96",
        depth=1,
        street="flop",
        board=["Ah", "7d", "2c"],
        pot_size=6.5,
        actor="ip",
        is_terminal=True,
        node_type="chance",
    )
    return [root, child1, child2]


def _run(coro):
    """Helper to run async tests without pytest-asyncio."""
    return asyncio.get_event_loop().run_until_complete(coro)


class TestFilesystemStore:
    def test_save_and_get_node(self, tmp_path):
        store = SolveTreeStore(base_dir=tmp_path)
        nodes = _make_nodes()
        count = _run(store.save_tree("solve-1", nodes, "root000000000000"))
        assert count == 3

        node = _run(store.get_node("solve-1", "root000000000000"))
        assert node is not None
        assert node.id == "root000000000000"
        assert node.actor == "oop"
        assert node.children_ids == ["child10000000000", "child20000000000"]

    def test_get_root(self, tmp_path):
        store = SolveTreeStore(base_dir=tmp_path)
        nodes = _make_nodes()
        _run(store.save_tree("solve-1", nodes, "root000000000000"))

        root = _run(store.get_root("solve-1"))
        assert root is not None
        assert root.parent_id is None

    def test_get_children(self, tmp_path):
        store = SolveTreeStore(base_dir=tmp_path)
        nodes = _make_nodes()
        _run(store.save_tree("solve-1", nodes, "root000000000000"))

        children = _run(store.get_children("solve-1", "root000000000000"))
        assert len(children) == 2
        child_ids = {c.id for c in children}
        assert "child10000000000" in child_ids
        assert "child20000000000" in child_ids

    def test_get_meta(self, tmp_path):
        store = SolveTreeStore(base_dir=tmp_path)
        nodes = _make_nodes()
        _run(store.save_tree("solve-1", nodes, "root000000000000", meta={"board": ["Ah", "7d", "2c"]}))

        meta = _run(store.get_meta("solve-1"))
        assert meta is not None
        assert meta["root_id"] == "root000000000000"
        assert meta["node_count"] == 3
        assert meta["board"] == ["Ah", "7d", "2c"]

    def test_tree_exists(self, tmp_path):
        store = SolveTreeStore(base_dir=tmp_path)
        assert not _run(store.tree_exists("nonexistent"))

        nodes = _make_nodes()
        _run(store.save_tree("solve-1", nodes, "root000000000000"))
        assert _run(store.tree_exists("solve-1"))

    def test_get_subtree(self, tmp_path):
        store = SolveTreeStore(base_dir=tmp_path)
        nodes = _make_nodes()
        _run(store.save_tree("solve-1", nodes, "root000000000000"))

        subtree = _run(store.get_subtree("solve-1", "root000000000000", max_depth=1))
        assert len(subtree) == 3  # root + 2 children

    def test_get_nonexistent_node(self, tmp_path):
        store = SolveTreeStore(base_dir=tmp_path)
        node = _run(store.get_node("nonexistent", "nope"))
        assert node is None

    def test_delete_tree(self, tmp_path):
        store = SolveTreeStore(base_dir=tmp_path)
        nodes = _make_nodes()
        _run(store.save_tree("solve-1", nodes, "root000000000000"))
        assert _run(store.tree_exists("solve-1"))

        deleted = _run(store.delete_tree("solve-1"))
        assert deleted > 0
        assert not _run(store.tree_exists("solve-1"))

    def test_individual_files_created(self, tmp_path):
        store = SolveTreeStore(base_dir=tmp_path)
        nodes = _make_nodes()
        _run(store.save_tree("solve-1", nodes, "root000000000000"))

        tree_dir = tmp_path / "solve-1"
        assert tree_dir.exists()
        # _meta.json + 3 node files
        files = list(tree_dir.iterdir())
        assert len(files) == 4

        for f in files:
            data = json.loads(f.read_text())
            assert isinstance(data, dict)

    def test_get_node_count(self, tmp_path):
        store = SolveTreeStore(base_dir=tmp_path)
        nodes = _make_nodes()
        _run(store.save_tree("solve-1", nodes, "root000000000000"))
        assert _run(store.get_node_count("solve-1")) == 3

    def test_get_node_count_nonexistent(self, tmp_path):
        store = SolveTreeStore(base_dir=tmp_path)
        assert _run(store.get_node_count("nope")) == 0

    def test_get_all_node_ids(self, tmp_path):
        store = SolveTreeStore(base_dir=tmp_path)
        nodes = _make_nodes()
        _run(store.save_tree("solve-1", nodes, "root000000000000"))
        ids = _run(store.get_all_node_ids("solve-1"))
        assert set(ids) == {"root000000000000", "child10000000000", "child20000000000"}

    def test_get_all_node_ids_empty(self, tmp_path):
        store = SolveTreeStore(base_dir=tmp_path)
        assert _run(store.get_all_node_ids("nope")) == []

    def test_node_exists(self, tmp_path):
        store = SolveTreeStore(base_dir=tmp_path)
        nodes = _make_nodes()
        _run(store.save_tree("solve-1", nodes, "root000000000000"))
        assert _run(store.node_exists("solve-1", "root000000000000"))
        assert not _run(store.node_exists("solve-1", "nonexistent"))

    def test_save_node_individual(self, tmp_path):
        store = SolveTreeStore(base_dir=tmp_path)
        node = _make_nodes()[0]
        written = _run(store.save_node("solve-2", node))
        assert written is True
        # Retrieve it
        fetched = _run(store.get_node("solve-2", node.id))
        assert fetched is not None
        assert fetched.id == node.id

    def test_save_node_duplicate_rejected(self, tmp_path):
        store = SolveTreeStore(base_dir=tmp_path)
        node = _make_nodes()[0]
        assert _run(store.save_node("solve-2", node)) is True
        assert _run(store.save_node("solve-2", node)) is False


class TestIntegrationImporterToStore:
    """End-to-end: import tree → persist → retrieve."""

    def test_import_persist_retrieve(self, tmp_path):
        from app.solver_tree.importer import import_solve_tree

        tree_data = {
            "node_type": "action_node",
            "player": 1,
            "actions": ["CHECK", "BET 50.000000"],
            "strategy": {
                "actions": ["CHECK", "BET 50.000000"],
                "strategy": {"AhKs": [0.6, 0.4], "QdQc": [0.8, 0.2]},
            },
            "childrens": {
                "CHECK": {
                    "node_type": "action_node",
                    "player": 0,
                    "actions": ["CHECK"],
                    "strategy": {"actions": ["CHECK"], "strategy": {"AhKs": [1.0]}},
                    "childrens": {
                        "CHECK": {"node_type": "chance_node", "deal_number": 0},
                    },
                },
                "BET 50.000000": {
                    "node_type": "action_node",
                    "player": 0,
                    "actions": ["CALL", "FOLD"],
                    "strategy": {
                        "actions": ["CALL", "FOLD"],
                        "strategy": {"AhKs": [0.7, 0.3]},
                    },
                    "childrens": {
                        "CALL": {"node_type": "chance_node", "deal_number": 0},
                        "FOLD": {},
                    },
                },
            },
        }

        # Import
        result = import_solve_tree(
            tree_data, "e2e-solve", ["Ah", "7d", "2c"], pot_size=6.5,
        )
        assert result.total >= 6

        # Persist
        store = SolveTreeStore(base_dir=tmp_path)
        count = _run(store.save_tree(
            "e2e-solve", result.nodes, result.root_id,
            meta={"board": ["Ah", "7d", "2c"]},
        ))
        assert count == result.total

        # Retrieve root
        root = _run(store.get_root("e2e-solve"))
        assert root is not None
        assert root.actor == "oop"
        assert root.depth == 0

        # Retrieve children
        children = _run(store.get_children("e2e-solve", root.id))
        assert len(children) == 2

        # Verify parent/child consistency after persistence roundtrip
        for child in children:
            assert child.parent_id == root.id

        # Verify no duplicates in persisted tree
        all_ids = _run(store.get_all_node_ids("e2e-solve"))
        assert len(all_ids) == len(set(all_ids))
        assert len(all_ids) == result.total

    def test_duplicate_tree_import_idempotent(self, tmp_path):
        """Importing the same tree twice should produce identical results."""
        from app.solver_tree.importer import import_solve_tree

        data = {
            "node_type": "action_node",
            "player": 1,
            "actions": ["CHECK"],
            "strategy": {"actions": ["CHECK"], "strategy": {"AhKs": [1.0]}},
            "childrens": {"CHECK": {"node_type": "chance_node"}},
        }

        r1 = import_solve_tree(data, "idem-1", ["Ah", "7d", "2c"])
        r2 = import_solve_tree(data, "idem-1", ["Ah", "7d", "2c"])

        assert r1.total == r2.total
        assert [n.id for n in r1.nodes] == [n.id for n in r2.nodes]

        # Persist both — second save_node calls should return False
        store = SolveTreeStore(base_dir=tmp_path)
        _run(store.save_tree("idem-1", r1.nodes, r1.root_id))
        for node in r2.nodes:
            assert _run(store.save_node("idem-1", node)) is False
