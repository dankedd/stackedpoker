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
