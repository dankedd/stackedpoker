"""
Tests for solver tree navigation — store + API endpoints.

Uses fakeredis for isolated Redis simulation (no real Redis needed).
"""

from __future__ import annotations

import json
import pytest
import pytest_asyncio

from app.solver_tree.models import SolverNode, make_node_id, encode_action, decode_action
from app.solver_tree.store import SolveTreeStore


# ── Fixtures ─────────────────────────────────────────────────────────────

def _make_node(
    solve_id: str = "job-1",
    board: list[str] | None = None,
    action_tokens: list[str] | None = None,
    parent_id: str | None = None,
    children_ids: list[str] | None = None,
    actor: str | None = "ip",
    strategy: dict | None = None,
    aggregate_freqs: dict | None = None,
    is_terminal: bool = False,
) -> SolverNode:
    """Build a test SolverNode with deterministic ID."""
    board = board or ["Jh", "9c", "4d"]
    action_tokens = action_tokens or []
    action_path = "-".join(action_tokens)
    board_str = " ".join(board)
    node_id = make_node_id(solve_id, board_str, action_path)

    return SolverNode(
        id=node_id,
        solve_id=solve_id,
        human_path=f"root:flop:{''.join(board)}:{action_path}" if action_path else f"root:flop:{''.join(board)}",
        parent_id=parent_id,
        children_ids=children_ids or [],
        action_history=list(action_tokens),
        action_path=action_path,
        depth=len(action_tokens),
        street="flop",
        board=list(board),
        pot_size=10.0,
        actor=actor,
        available_actions=["x", "b96"] if not is_terminal else [],
        is_terminal=is_terminal,
        strategy=strategy or {},
        aggregate_freqs=aggregate_freqs or {},
        combo_count=0,
        node_type="terminal" if is_terminal else "action",
        raw_player=0 if actor == "ip" else 1 if actor == "oop" else None,
    )


def _build_sample_tree(solve_id: str = "job-1") -> list[SolverNode]:
    """
    Build a small 5-node tree:

        root (ip: x or b96)
         ├─ x  (oop: x or b50)
         │   ├─ x-x  (terminal)
         │   └─ x-b50 (terminal)
         └─ b96 (oop: c or f)
    """
    board = ["Jh", "9c", "4d"]

    root = _make_node(solve_id=solve_id, board=board, action_tokens=[],
                      actor="ip",
                      aggregate_freqs={"x": 0.45, "b96": 0.55})
    root.available_actions = ["x", "b96"]

    check = _make_node(solve_id=solve_id, board=board, action_tokens=["x"],
                       parent_id=root.id, actor="oop",
                       aggregate_freqs={"x": 0.6, "b50": 0.4})
    check.available_actions = ["x", "b50"]

    check_check = _make_node(solve_id=solve_id, board=board, action_tokens=["x", "x"],
                             parent_id=check.id, is_terminal=True, actor=None)

    check_bet = _make_node(solve_id=solve_id, board=board, action_tokens=["x", "b50"],
                           parent_id=check.id, is_terminal=True, actor=None)

    bet96 = _make_node(solve_id=solve_id, board=board, action_tokens=["b96"],
                       parent_id=root.id, actor="oop",
                       aggregate_freqs={"c": 0.7, "f": 0.3})
    bet96.available_actions = ["c", "f"]

    # Wire children
    root.children_ids = [check.id, bet96.id]
    check.children_ids = [check_check.id, check_bet.id]

    return [root, check, check_check, check_bet, bet96]


@pytest_asyncio.fixture
async def redis():
    """Create a fakeredis instance for testing."""
    try:
        import fakeredis.aioredis
    except ImportError:
        pytest.skip("fakeredis not installed")

    r = fakeredis.aioredis.FakeRedis(decode_responses=True)
    yield r
    await r.aclose()


@pytest_asyncio.fixture
async def store(redis):
    """SolveTreeStore backed by fakeredis."""
    return SolveTreeStore(redis=redis)


@pytest_asyncio.fixture
async def populated_store(store):
    """Store with a sample 5-node tree already saved."""
    nodes = _build_sample_tree()
    await store.save_tree("job-1", nodes, nodes[0].id, meta={"streets": ["flop"]})
    return store, nodes


# ── Model tests ──────────────────────────────────────────────────────────

class TestActionEncoding:
    def test_encode_check(self):
        assert encode_action("CHECK") == "x"

    def test_encode_call(self):
        assert encode_action("CALL") == "c"

    def test_encode_fold(self):
        assert encode_action("FOLD") == "f"

    def test_encode_bet(self):
        assert encode_action("BET 96.000000") == "b96"

    def test_encode_raise(self):
        assert encode_action("RAISE 192") == "r192"

    def test_encode_allin(self):
        assert encode_action("ALLIN") == "ai"

    def test_decode_roundtrip(self):
        for raw, expected_token in [
            ("CHECK", "x"), ("CALL", "c"), ("FOLD", "f"),
            ("BET 96.000000", "b96"), ("RAISE 192", "r192"),
        ]:
            token = encode_action(raw)
            assert token == expected_token
            label = decode_action(token)
            assert isinstance(label, str)
            assert len(label) > 0


class TestNodeId:
    def test_deterministic(self):
        a = make_node_id("solve1", "Jh 9c 4d", "x-b96")
        b = make_node_id("solve1", "Jh 9c 4d", "x-b96")
        assert a == b

    def test_different_path_different_id(self):
        a = make_node_id("solve1", "Jh 9c 4d", "x-b96")
        b = make_node_id("solve1", "Jh 9c 4d", "x-b50")
        assert a != b

    def test_different_solve_different_id(self):
        a = make_node_id("solve1", "Jh 9c 4d", "x")
        b = make_node_id("solve2", "Jh 9c 4d", "x")
        assert a != b

    def test_id_length(self):
        nid = make_node_id("s", "b", "p")
        assert len(nid) == 16


class TestSolverNode:
    def test_to_dict_roundtrip(self):
        node = _make_node()
        d = node.to_dict()
        restored = SolverNode.from_dict(d)
        assert restored.id == node.id
        assert restored.solve_id == node.solve_id
        assert restored.board == node.board
        assert restored.action_history == node.action_history

    def test_serializable(self):
        node = _make_node(
            strategy={"AhKs": [0.5, 0.5], "QdQc": [0.3, 0.7]},
            aggregate_freqs={"x": 0.4, "b96": 0.6},
        )
        raw = json.dumps(node.to_dict())
        assert isinstance(raw, str)
        restored = SolverNode.from_dict(json.loads(raw))
        assert restored.strategy == node.strategy


# ── Store tests ──────────────────────────────────────────────────────────

class TestSolveTreeStore:
    @pytest.mark.asyncio
    async def test_save_and_get_meta(self, store):
        nodes = _build_sample_tree()
        await store.save_tree("job-1", nodes, nodes[0].id, meta={"streets": ["flop"]})

        meta = await store.get_meta("job-1")
        assert meta is not None
        assert meta["root_id"] == nodes[0].id
        assert meta["node_count"] == 5

    @pytest.mark.asyncio
    async def test_get_meta_missing(self, store):
        meta = await store.get_meta("nonexistent")
        assert meta is None

    @pytest.mark.asyncio
    async def test_tree_exists(self, store):
        assert not await store.tree_exists("job-1")
        nodes = _build_sample_tree()
        await store.save_tree("job-1", nodes, nodes[0].id)
        assert await store.tree_exists("job-1")

    @pytest.mark.asyncio
    async def test_get_node(self, populated_store):
        store, nodes = populated_store
        root = nodes[0]
        fetched = await store.get_node("job-1", root.id)
        assert fetched is not None
        assert fetched.id == root.id
        assert fetched.actor == "ip"
        assert fetched.street == "flop"

    @pytest.mark.asyncio
    async def test_get_node_missing(self, populated_store):
        store, _ = populated_store
        assert await store.get_node("job-1", "nonexistent") is None

    @pytest.mark.asyncio
    async def test_get_root(self, populated_store):
        store, nodes = populated_store
        root = await store.get_root("job-1")
        assert root is not None
        assert root.id == nodes[0].id
        assert root.parent_id is None

    @pytest.mark.asyncio
    async def test_get_children(self, populated_store):
        store, nodes = populated_store
        root = nodes[0]
        children = await store.get_children("job-1", root.id)
        assert len(children) == 2
        child_ids = {c.id for c in children}
        assert nodes[1].id in child_ids  # check node
        assert nodes[4].id in child_ids  # bet96 node

    @pytest.mark.asyncio
    async def test_get_children_terminal(self, populated_store):
        store, nodes = populated_store
        # check_check is terminal, has no children
        terminal = nodes[2]
        children = await store.get_children("job-1", terminal.id)
        assert children == []

    @pytest.mark.asyncio
    async def test_get_children_missing_parent(self, populated_store):
        store, _ = populated_store
        children = await store.get_children("job-1", "nonexistent")
        assert children == []

    @pytest.mark.asyncio
    async def test_lazy_loading_single_node(self, populated_store):
        """Verify nodes are fetched individually, not as a blob."""
        store, nodes = populated_store
        # Fetch just one deep node
        check_bet = nodes[3]  # x-b50 terminal
        fetched = await store.get_node("job-1", check_bet.id)
        assert fetched is not None
        assert fetched.is_terminal is True
        assert fetched.action_path == "x-b50"
        assert fetched.depth == 2

    @pytest.mark.asyncio
    async def test_tree_traversal(self, populated_store):
        """Simulate full root→leaf traversal like the frontend would."""
        store, nodes = populated_store

        # Step 1: get root
        root = await store.get_root("job-1")
        assert root is not None
        assert root.depth == 0

        # Step 2: get children of root
        children = await store.get_children("job-1", root.id)
        assert len(children) == 2

        # Step 3: pick the check branch, get its children
        check_node = next(c for c in children if "x" in c.action_path)
        grandchildren = await store.get_children("job-1", check_node.id)
        assert len(grandchildren) == 2

        # Step 4: verify we reached terminal nodes
        for gc in grandchildren:
            assert gc.is_terminal is True

    @pytest.mark.asyncio
    async def test_delete_tree(self, populated_store):
        store, _ = populated_store
        assert await store.tree_exists("job-1")
        deleted = await store.delete_tree("job-1")
        assert deleted > 0
        assert not await store.tree_exists("job-1")


# ── API response format tests ───────────────────────────────────────────

class TestNodeResponseFormat:
    """Verify the API response helper produces the required format."""

    def test_response_shape(self):
        from app.api.routes.solver_tree import _node_to_response

        node = _make_node(
            action_tokens=["x", "b96"],
            actor="oop",
            aggregate_freqs={"x": 0.4, "b96": 0.6},
        )
        node.available_actions = ["c", "f"]
        node.aggregate_freqs = {"c": 0.7, "f": 0.3}

        resp = _node_to_response(node)

        # Required top-level fields
        assert resp.id == node.id
        assert resp.parent_id == node.parent_id
        assert resp.children_ids == node.children_ids
        assert resp.street == "flop"
        assert resp.board == ["Jh", "9c", "4d"]
        assert resp.action_path == "x-b96"
        assert resp.actor == "oop"
        assert resp.depth == 2

        # Action details
        assert len(resp.available_actions) == 2
        assert resp.available_actions[0].token == "c"
        assert resp.available_actions[0].label == "call"
        assert resp.available_actions[0].frequency == 0.7

        # EVs (aggregate freqs)
        assert resp.evs == {"c": 0.7, "f": 0.3}

        # Metadata
        assert "human_path" in resp.metadata
        assert "pot_size" in resp.metadata
        assert "combo_count" in resp.metadata
        assert "node_type" in resp.metadata
        assert "is_terminal" in resp.metadata

    def test_action_history_decoded(self):
        from app.api.routes.solver_tree import _node_to_response

        node = _make_node(action_tokens=["x", "b96", "c"])
        resp = _node_to_response(node)
        assert resp.action_history == ["check", "bet 96", "call"]

    def test_terminal_node_no_actions(self):
        from app.api.routes.solver_tree import _node_to_response

        node = _make_node(is_terminal=True, actor=None)
        resp = _node_to_response(node)
        assert resp.available_actions == []
        assert resp.actor is None

    def test_strategy_data_passthrough(self):
        from app.api.routes.solver_tree import _node_to_response

        strategy = {"AhKs": [0.5, 0.5], "QdQc": [0.3, 0.7]}
        node = _make_node(strategy=strategy)
        resp = _node_to_response(node)
        assert resp.strategy == strategy


# ── API endpoint tests (FastAPI TestClient) ──────────────────────────────

class TestSolverTreeEndpoints:
    """Integration tests using FastAPI TestClient + fakeredis."""

    @pytest_asyncio.fixture
    async def client(self, redis):
        """Create a TestClient with tree store wired to fakeredis."""
        from fastapi.testclient import TestClient
        from fastapi import FastAPI

        app = FastAPI()

        from app.api.routes import solver_tree as tree_mod
        app.include_router(tree_mod.router, prefix="/api")

        # Inject fakeredis store
        fake_store = SolveTreeStore(redis=redis)
        tree_mod._store = fake_store
        tree_mod._redis_available = True

        # Save sample tree
        nodes = _build_sample_tree()
        await fake_store.save_tree("job-1", nodes, nodes[0].id, meta={"streets": ["flop"]})

        yield TestClient(app), nodes

        # Reset module-level state
        tree_mod._store = None
        tree_mod._redis_available = True

    @pytest.mark.asyncio
    async def test_get_tree(self, client):
        tc, nodes = client
        resp = tc.get("/api/solver/jobs/job-1/tree")
        assert resp.status_code == 200
        data = resp.json()
        assert data["root_node_id"] == nodes[0].id
        assert data["total_nodes"] == 5
        assert "flop" in data["streets"]
        assert "created_at" in data

    @pytest.mark.asyncio
    async def test_get_tree_404(self, client):
        tc, _ = client
        resp = tc.get("/api/solver/jobs/nonexistent/tree")
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_get_node(self, client):
        tc, nodes = client
        root = nodes[0]
        resp = tc.get(f"/api/solver/jobs/job-1/node/{root.id}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == root.id
        assert data["parent_id"] is None
        assert len(data["children_ids"]) == 2
        assert data["street"] == "flop"
        assert data["board"] == ["Jh", "9c", "4d"]
        assert data["actor"] == "ip"
        assert len(data["available_actions"]) >= 1

    @pytest.mark.asyncio
    async def test_get_node_404(self, client):
        tc, _ = client
        resp = tc.get("/api/solver/jobs/job-1/node/nonexistent")
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_get_node_tree_404(self, client):
        tc, _ = client
        resp = tc.get("/api/solver/jobs/bad-job/node/anything")
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_get_children(self, client):
        tc, nodes = client
        root = nodes[0]
        resp = tc.get(f"/api/solver/jobs/job-1/node/{root.id}/children")
        assert resp.status_code == 200
        data = resp.json()
        assert data["parent_id"] == root.id
        assert len(data["children"]) == 2

        # Each child has full node response shape
        for child in data["children"]:
            assert "id" in child
            assert "street" in child
            assert "board" in child
            assert "available_actions" in child

    @pytest.mark.asyncio
    async def test_get_children_404(self, client):
        tc, _ = client
        resp = tc.get("/api/solver/jobs/job-1/node/nonexistent/children")
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_full_lazy_traversal(self, client):
        """Simulate the exact frontend flow: tree → root → children → deeper."""
        tc, nodes = client

        # 1. Get tree metadata
        tree_resp = tc.get("/api/solver/jobs/job-1/tree")
        assert tree_resp.status_code == 200
        root_id = tree_resp.json()["root_node_id"]

        # 2. Fetch root node
        root_resp = tc.get(f"/api/solver/jobs/job-1/node/{root_id}")
        assert root_resp.status_code == 200
        root_data = root_resp.json()
        assert root_data["depth"] == 0

        # 3. Fetch children
        children_resp = tc.get(f"/api/solver/jobs/job-1/node/{root_id}/children")
        assert children_resp.status_code == 200
        children = children_resp.json()["children"]
        assert len(children) == 2

        # 4. Pick first child, go deeper
        child_id = children[0]["id"]
        child_resp = tc.get(f"/api/solver/jobs/job-1/node/{child_id}")
        assert child_resp.status_code == 200
        assert child_resp.json()["depth"] == 1

    @pytest.mark.asyncio
    async def test_no_giant_json(self, client):
        """Verify single-node responses don't contain the entire tree."""
        tc, nodes = client
        resp = tc.get(f"/api/solver/jobs/job-1/node/{nodes[0].id}")
        data = resp.json()
        # The response should NOT have nested node objects — only IDs for children
        for cid in data["children_ids"]:
            assert isinstance(cid, str)
