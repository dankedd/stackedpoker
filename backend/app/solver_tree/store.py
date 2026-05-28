"""
SolveTreeStore — per-node persistence for solver game trees.

Each node is stored individually (not as one giant blob) to enable:
  - Lazy loading (fetch single node by ID)
  - Partial tree fetching (children of a node)
  - Scalable traversal (don't load entire tree into memory)
  - Independent cache eviction

Storage backends:
  - Redis (primary, for cross-container access on Railway)
  - Filesystem (fallback, for local development)

Key schema in Redis:
  solve_tree:{solve_id}:meta     → tree metadata (root_id, node_count, board, etc.)
  solve_tree:{solve_id}:node:{id} → individual node JSON
  solve_tree:{solve_id}:root     → root node ID (shortcut)
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import TYPE_CHECKING

from .models import SolverNode

if TYPE_CHECKING:
    import redis.asyncio as aioredis

logger = logging.getLogger(__name__)

# Redis key prefix
_PREFIX = "solve_tree"
_NODE_TTL = 86400 * 7  # 7 days


class SolveTreeStore:
    """
    Persists solver tree nodes individually — supports both Redis and filesystem.

    Usage (Redis — production):
        store = SolveTreeStore(redis=redis_client)
        await store.save_tree(solve_id, nodes, root_id, meta)
        node = await store.get_node(solve_id, node_id)
        children = await store.get_children(solve_id, node_id)

    Usage (filesystem — local dev):
        store = SolveTreeStore(base_dir=Path("/data/solver_trees"))
        await store.save_tree(solve_id, nodes, root_id, meta)
    """

    def __init__(
        self,
        redis: aioredis.Redis | None = None,
        base_dir: Path | None = None,
    ) -> None:
        self._redis = redis
        self._base_dir = base_dir
        if not redis and not base_dir:
            # Default to filesystem in /data/solver_trees
            self._base_dir = Path("/data/solver_trees")

    # ── Write ────────────────────────────────────────────────────────────

    async def save_tree(
        self,
        solve_id: str,
        nodes: list[SolverNode],
        root_id: str,
        meta: dict | None = None,
    ) -> int:
        """
        Persist all nodes of a solve tree.

        Returns the number of nodes stored.
        """
        if self._redis:
            return await self._save_redis(solve_id, nodes, root_id, meta)
        return self._save_filesystem(solve_id, nodes, root_id, meta)

    async def _save_redis(
        self,
        solve_id: str,
        nodes: list[SolverNode],
        root_id: str,
        meta: dict | None,
    ) -> int:
        """Store each node as a separate Redis key."""
        pipe = self._redis.pipeline()

        # Meta key
        meta_key = f"{_PREFIX}:{solve_id}:meta"
        meta_data = {
            "solve_id": solve_id,
            "root_id": root_id,
            "node_count": len(nodes),
            **(meta or {}),
        }
        pipe.set(meta_key, json.dumps(meta_data), ex=_NODE_TTL)

        # Root shortcut
        pipe.set(f"{_PREFIX}:{solve_id}:root", root_id, ex=_NODE_TTL)

        # Individual nodes
        for node in nodes:
            node_key = f"{_PREFIX}:{solve_id}:node:{node.id}"
            pipe.set(node_key, json.dumps(node.to_dict()), ex=_NODE_TTL)

        await pipe.execute()
        logger.info("[TreeStore/Redis] saved %d nodes for solve %s", len(nodes), solve_id)
        return len(nodes)

    def _save_filesystem(
        self,
        solve_id: str,
        nodes: list[SolverNode],
        root_id: str,
        meta: dict | None,
    ) -> int:
        """Store each node as a separate JSON file."""
        tree_dir = self._base_dir / solve_id
        tree_dir.mkdir(parents=True, exist_ok=True)

        # Meta file
        meta_data = {
            "solve_id": solve_id,
            "root_id": root_id,
            "node_count": len(nodes),
            **(meta or {}),
        }
        (tree_dir / "_meta.json").write_text(
            json.dumps(meta_data, indent=2), encoding="utf-8",
        )

        # Individual node files
        for node in nodes:
            node_path = tree_dir / f"{node.id}.json"
            node_path.write_text(
                json.dumps(node.to_dict(), indent=2), encoding="utf-8",
            )

        logger.info("[TreeStore/FS] saved %d nodes for solve %s → %s", len(nodes), solve_id, tree_dir)
        return len(nodes)

    # ── Read ─────────────────────────────────────────────────────────────

    async def get_meta(self, solve_id: str) -> dict | None:
        """Get tree metadata (root_id, node_count, etc.)."""
        if self._redis:
            raw = await self._redis.get(f"{_PREFIX}:{solve_id}:meta")
            return json.loads(raw) if raw else None
        meta_path = self._base_dir / solve_id / "_meta.json"
        if meta_path.exists():
            return json.loads(meta_path.read_text(encoding="utf-8"))
        return None

    async def get_root_id(self, solve_id: str) -> str | None:
        """Get the root node ID for a solve."""
        if self._redis:
            val = await self._redis.get(f"{_PREFIX}:{solve_id}:root")
            return val.decode() if isinstance(val, bytes) else val
        meta = await self.get_meta(solve_id)
        return meta.get("root_id") if meta else None

    async def get_node(self, solve_id: str, node_id: str) -> SolverNode | None:
        """Fetch a single node by ID (lazy loading)."""
        if self._redis:
            raw = await self._redis.get(f"{_PREFIX}:{solve_id}:node:{node_id}")
            if raw:
                return SolverNode.from_dict(json.loads(raw))
            return None

        node_path = self._base_dir / solve_id / f"{node_id}.json"
        if node_path.exists():
            return SolverNode.from_dict(
                json.loads(node_path.read_text(encoding="utf-8"))
            )
        return None

    async def get_root(self, solve_id: str) -> SolverNode | None:
        """Fetch the root node of a solve tree."""
        root_id = await self.get_root_id(solve_id)
        if not root_id:
            return None
        return await self.get_node(solve_id, root_id)

    async def get_children(
        self, solve_id: str, node_id: str,
    ) -> list[SolverNode]:
        """Fetch all direct children of a node via pipeline (single round trip)."""
        parent = await self.get_node(solve_id, node_id)
        if not parent or not parent.children_ids:
            return []

        if self._redis:
            pipe = self._redis.pipeline(transaction=False)
            for child_id in parent.children_ids:
                pipe.get(f"{_PREFIX}:{solve_id}:node:{child_id}")
            results = await pipe.execute()
            children = []
            for raw in results:
                if raw is not None:
                    children.append(SolverNode.from_dict(json.loads(raw)))
            return children

        # Filesystem fallback
        children = []
        for child_id in parent.children_ids:
            child = await self.get_node(solve_id, child_id)
            if child:
                children.append(child)
        return children

    async def get_subtree(
        self, solve_id: str, node_id: str, max_depth: int = 3,
    ) -> list[SolverNode]:
        """
        Fetch a subtree rooted at node_id, up to max_depth levels deep.

        Returns nodes in BFS order. Useful for partial tree loading.
        """
        root = await self.get_node(solve_id, node_id)
        if not root:
            return []

        result = [root]
        queue = [(root, 0)]

        while queue:
            node, depth = queue.pop(0)
            if depth >= max_depth:
                continue
            for child_id in node.children_ids:
                child = await self.get_node(solve_id, child_id)
                if child:
                    result.append(child)
                    queue.append((child, depth + 1))

        return result

    async def get_node_count(self, solve_id: str) -> int:
        """Return the number of stored nodes for a solve (from metadata)."""
        meta = await self.get_meta(solve_id)
        return meta.get("node_count", 0) if meta else 0

    async def get_all_node_ids(self, solve_id: str) -> list[str]:
        """Return all node IDs for a solve tree."""
        if self._redis:
            pattern = f"{_PREFIX}:{solve_id}:node:*"
            ids = []
            async for key in self._redis.scan_iter(match=pattern, count=100):
                k = key.decode() if isinstance(key, bytes) else key
                ids.append(k.rsplit(":", 1)[-1])
            return ids

        tree_dir = self._base_dir / solve_id
        if not tree_dir.exists():
            return []
        return [
            p.stem for p in tree_dir.glob("*.json")
            if p.stem != "_meta"
        ]

    async def node_exists(self, solve_id: str, node_id: str) -> bool:
        """Check if a specific node already exists (for duplicate protection)."""
        if self._redis:
            return bool(await self._redis.exists(f"{_PREFIX}:{solve_id}:node:{node_id}"))
        return (self._base_dir / solve_id / f"{node_id}.json").exists()

    async def save_node(self, solve_id: str, node: SolverNode) -> bool:
        """
        Persist a single node. Returns True if written, False if duplicate.

        For incremental imports where you don't want to hold
        the entire tree in memory.
        """
        if self._redis:
            node_key = f"{_PREFIX}:{solve_id}:node:{node.id}"
            if await self._redis.exists(node_key):
                return False
            await self._redis.set(node_key, json.dumps(node.to_dict()), ex=_NODE_TTL)
            return True

        node_path = self._base_dir / solve_id / f"{node.id}.json"
        if node_path.exists():
            return False
        node_path.parent.mkdir(parents=True, exist_ok=True)
        node_path.write_text(json.dumps(node.to_dict(), indent=2), encoding="utf-8")
        return True

    async def tree_exists(self, solve_id: str) -> bool:
        """Check if a tree has been stored for this solve."""
        if self._redis:
            return bool(await self._redis.exists(f"{_PREFIX}:{solve_id}:meta"))
        meta_path = self._base_dir / solve_id / "_meta.json"
        return meta_path.exists()

    # ── Delete ───────────────────────────────────────────────────────────

    async def delete_tree(self, solve_id: str) -> int:
        """Remove all nodes for a solve tree. Returns count deleted."""
        if self._redis:
            pattern = f"{_PREFIX}:{solve_id}:*"
            keys = []
            async for key in self._redis.scan_iter(match=pattern, count=100):
                keys.append(key)
            if keys:
                await self._redis.delete(*keys)
            return len(keys)

        tree_dir = self._base_dir / solve_id
        if tree_dir.exists():
            import shutil
            count = sum(1 for _ in tree_dir.iterdir())
            shutil.rmtree(tree_dir)
            return count
        return 0
