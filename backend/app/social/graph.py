"""
Social graph — friends, follows, blocks, and relationship queries.

Design:
  Asymmetric by default (follows). Friendships require mutual acceptance.
  Blocks override all other relationships.

Storage: In-memory for MVP, Supabase for production.
"""

from __future__ import annotations

import logging
from collections import defaultdict
from datetime import datetime, timezone

from .models import (
    FriendshipStatus,
    Relationship,
    RelationType,
    UserPublicProfile,
)

logger = logging.getLogger(__name__)


class SocialGraph:
    """
    Manages user relationships and social queries.

    Thread-safe for single-process async apps.
    """

    def __init__(self) -> None:
        self._relationships: dict[str, Relationship] = {}  # rel_id → Relationship
        self._outgoing: dict[str, list[str]] = defaultdict(list)  # user → [rel_ids]
        self._incoming: dict[str, list[str]] = defaultdict(list)  # user → [rel_ids]
        self._profiles: dict[str, UserPublicProfile] = {}

    def register_profile(self, profile: UserPublicProfile) -> None:
        self._profiles[profile.user_id] = profile

    def get_profile(self, user_id: str) -> UserPublicProfile | None:
        return self._profiles.get(user_id)

    # ── Relationship operations ───────────────────────────────────────────

    def send_friend_request(self, from_id: str, to_id: str) -> Relationship | None:
        """Send a friend request. Returns None if blocked or duplicate."""
        if self._is_blocked(from_id, to_id):
            return None

        # Check for existing pending/accepted relationship
        existing = self._find_relationship(from_id, to_id, RelationType.FRIEND)
        if existing:
            return existing

        rel = Relationship(
            from_user_id=from_id,
            to_user_id=to_id,
            relation_type=RelationType.FRIEND,
            status=FriendshipStatus.PENDING,
        )
        self._store_relationship(rel)
        return rel

    def accept_friend_request(self, rel_id: str, user_id: str) -> bool:
        """Accept a friend request. Only the recipient can accept."""
        rel = self._relationships.get(rel_id)
        if not rel or rel.to_user_id != user_id:
            return False
        if rel.status != FriendshipStatus.PENDING:
            return False
        rel.status = FriendshipStatus.ACCEPTED
        return True

    def decline_friend_request(self, rel_id: str, user_id: str) -> bool:
        rel = self._relationships.get(rel_id)
        if not rel or rel.to_user_id != user_id:
            return False
        rel.status = FriendshipStatus.DECLINED
        return True

    def follow(self, from_id: str, to_id: str) -> Relationship | None:
        """Follow a user (one-directional, no approval needed)."""
        if self._is_blocked(from_id, to_id):
            return None

        existing = self._find_relationship(from_id, to_id, RelationType.FOLLOW)
        if existing:
            return existing

        rel = Relationship(
            from_user_id=from_id,
            to_user_id=to_id,
            relation_type=RelationType.FOLLOW,
            status=FriendshipStatus.ACCEPTED,
        )
        self._store_relationship(rel)
        return rel

    def unfollow(self, from_id: str, to_id: str) -> bool:
        rel = self._find_relationship(from_id, to_id, RelationType.FOLLOW)
        if rel:
            self._remove_relationship(rel.id)
            return True
        return False

    def block(self, from_id: str, to_id: str) -> Relationship:
        """Block a user. Removes all existing relationships between them."""
        # Remove any existing relationships in both directions
        for rel_id in list(self._outgoing.get(from_id, [])):
            rel = self._relationships.get(rel_id)
            if rel and rel.to_user_id == to_id:
                self._remove_relationship(rel_id)
        for rel_id in list(self._incoming.get(from_id, [])):
            rel = self._relationships.get(rel_id)
            if rel and rel.from_user_id == to_id:
                self._remove_relationship(rel_id)

        rel = Relationship(
            from_user_id=from_id,
            to_user_id=to_id,
            relation_type=RelationType.BLOCK,
            status=FriendshipStatus.ACCEPTED,
        )
        self._store_relationship(rel)
        return rel

    # ── Queries ───────────────────────────────────────────────────────────

    def get_friends(self, user_id: str) -> list[str]:
        """Get all accepted friends (bidirectional)."""
        friends = set()
        for rel_id in self._outgoing.get(user_id, []):
            rel = self._relationships.get(rel_id)
            if rel and rel.relation_type == RelationType.FRIEND and rel.status == FriendshipStatus.ACCEPTED:
                friends.add(rel.to_user_id)
        for rel_id in self._incoming.get(user_id, []):
            rel = self._relationships.get(rel_id)
            if rel and rel.relation_type == RelationType.FRIEND and rel.status == FriendshipStatus.ACCEPTED:
                friends.add(rel.from_user_id)
        return list(friends)

    def get_followers(self, user_id: str) -> list[str]:
        """Get users who follow this user."""
        followers = []
        for rel_id in self._incoming.get(user_id, []):
            rel = self._relationships.get(rel_id)
            if rel and rel.relation_type == RelationType.FOLLOW and rel.status == FriendshipStatus.ACCEPTED:
                followers.append(rel.from_user_id)
        return followers

    def get_following(self, user_id: str) -> list[str]:
        """Get users this user follows."""
        following = []
        for rel_id in self._outgoing.get(user_id, []):
            rel = self._relationships.get(rel_id)
            if rel and rel.relation_type == RelationType.FOLLOW and rel.status == FriendshipStatus.ACCEPTED:
                following.append(rel.to_user_id)
        return following

    def get_pending_requests(self, user_id: str) -> list[Relationship]:
        """Get pending friend requests FOR this user."""
        pending = []
        for rel_id in self._incoming.get(user_id, []):
            rel = self._relationships.get(rel_id)
            if rel and rel.relation_type == RelationType.FRIEND and rel.status == FriendshipStatus.PENDING:
                pending.append(rel)
        return pending

    def are_friends(self, user_a: str, user_b: str) -> bool:
        return user_b in self.get_friends(user_a)

    def friend_count(self, user_id: str) -> int:
        return len(self.get_friends(user_id))

    def follower_count(self, user_id: str) -> int:
        return len(self.get_followers(user_id))

    # ── Internal helpers ──────────────────────────────────────────────────

    def _store_relationship(self, rel: Relationship) -> None:
        self._relationships[rel.id] = rel
        self._outgoing[rel.from_user_id].append(rel.id)
        self._incoming[rel.to_user_id].append(rel.id)

    def _remove_relationship(self, rel_id: str) -> None:
        rel = self._relationships.pop(rel_id, None)
        if rel:
            self._outgoing[rel.from_user_id] = [
                r for r in self._outgoing[rel.from_user_id] if r != rel_id
            ]
            self._incoming[rel.to_user_id] = [
                r for r in self._incoming[rel.to_user_id] if r != rel_id
            ]

    def _find_relationship(
        self, from_id: str, to_id: str, rel_type: RelationType,
    ) -> Relationship | None:
        for rel_id in self._outgoing.get(from_id, []):
            rel = self._relationships.get(rel_id)
            if rel and rel.to_user_id == to_id and rel.relation_type == rel_type:
                return rel
        return None

    def _is_blocked(self, user_a: str, user_b: str) -> bool:
        return (
            self._find_relationship(user_a, user_b, RelationType.BLOCK) is not None
            or self._find_relationship(user_b, user_a, RelationType.BLOCK) is not None
        )


# Module singleton
_graph: SocialGraph | None = None


def get_social_graph() -> SocialGraph:
    global _graph
    if _graph is None:
        _graph = SocialGraph()
    return _graph
