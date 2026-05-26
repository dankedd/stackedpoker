"""
Creator ecosystem — content publishing, marketplace, revenue sharing.

Architecture:
  Creators publish content (lessons, drill packs, courses, guides).
  Content goes through moderation → approved → discoverable.
  Premium content generates revenue shared 70/30 (creator/platform).

Content lifecycle:
  Draft → Submit → Moderation → Approved → Published → Analytics
"""

from __future__ import annotations

import logging
from collections import defaultdict
from datetime import datetime, timezone

from .models import (
    ContentType,
    ContentVisibility,
    CreatorContent,
    CreatorProfile,
)

logger = logging.getLogger(__name__)


class CreatorService:
    """Manages creator profiles, content publishing, and marketplace."""

    def __init__(self) -> None:
        self._creators: dict[str, CreatorProfile] = {}
        self._content: dict[str, CreatorContent] = {}  # content_id → content
        self._by_creator: dict[str, list[str]] = defaultdict(list)
        self._by_tag: dict[str, list[str]] = defaultdict(list)

    def register_creator(
        self,
        user_id: str,
        display_name: str,
        bio: str = "",
        specialties: list[str] | None = None,
    ) -> CreatorProfile:
        """Register a user as a content creator."""
        profile = CreatorProfile(
            user_id=user_id,
            display_name=display_name,
            bio=bio,
            specialties=specialties or [],
        )
        self._creators[user_id] = profile
        return profile

    def get_creator(self, user_id: str) -> CreatorProfile | None:
        return self._creators.get(user_id)

    def publish_content(
        self,
        creator_id: str,
        content_type: ContentType,
        title: str,
        description: str = "",
        payload: dict | None = None,
        tags: list[str] | None = None,
        visibility: ContentVisibility = ContentVisibility.PUBLIC,
        difficulty: str = "intermediate",
        price_cents: int = 0,
    ) -> CreatorContent | None:
        """Publish new content. Goes to moderation queue if premium."""
        creator = self._creators.get(creator_id)
        if creator is None:
            return None

        content = CreatorContent(
            creator_id=creator_id,
            content_type=content_type,
            visibility=visibility,
            title=title,
            description=description,
            tags=tags or [],
            difficulty=difficulty,
            payload=payload or {},
            price_cents=price_cents,
            # Auto-approve free public content; premium needs review
            is_approved=price_cents == 0 and visibility == ContentVisibility.PUBLIC,
            moderation_status="approved" if price_cents == 0 else "pending",
        )

        self._content[content.content_id] = content
        self._by_creator[creator_id].append(content.content_id)
        for tag in content.tags:
            self._by_tag[tag].append(content.content_id)

        creator.content_count += 1
        return content

    def get_content(self, content_id: str) -> CreatorContent | None:
        return self._content.get(content_id)

    def browse_marketplace(
        self,
        *,
        content_type: ContentType | None = None,
        tag: str | None = None,
        difficulty: str | None = None,
        sort_by: str = "rating",  # rating, recent, popular
        limit: int = 20,
    ) -> list[CreatorContent]:
        """Browse approved public content in the marketplace."""
        items = [
            c for c in self._content.values()
            if c.is_approved and c.visibility in (
                ContentVisibility.PUBLIC, ContentVisibility.PREMIUM,
            )
        ]

        if content_type:
            items = [c for c in items if c.content_type == content_type]
        if tag:
            items = [c for c in items if tag in c.tags]
        if difficulty:
            items = [c for c in items if c.difficulty == difficulty]

        if sort_by == "rating":
            items.sort(key=lambda c: -c.avg_rating)
        elif sort_by == "popular":
            items.sort(key=lambda c: -c.view_count)
        else:
            items.sort(key=lambda c: c.created_at, reverse=True)

        return items[:limit]

    def record_view(self, content_id: str) -> None:
        content = self._content.get(content_id)
        if content:
            content.view_count += 1
            creator = self._creators.get(content.creator_id)
            if creator:
                creator.total_views += 1

    def rate_content(self, content_id: str, rating: float) -> None:
        content = self._content.get(content_id)
        if content and 0 <= rating <= 5:
            total = content.avg_rating * content.rating_count + rating
            content.rating_count += 1
            content.avg_rating = round(total / content.rating_count, 2)

    def get_creator_content(self, creator_id: str) -> list[CreatorContent]:
        ids = self._by_creator.get(creator_id, [])
        return [self._content[cid] for cid in ids if cid in self._content]

    def get_creator_analytics(self, creator_id: str) -> dict:
        creator = self._creators.get(creator_id)
        if not creator:
            return {}

        content = self.get_creator_content(creator_id)
        return {
            "total_content": len(content),
            "total_views": sum(c.view_count for c in content),
            "total_completions": sum(c.completion_count for c in content),
            "avg_rating": round(
                sum(c.avg_rating for c in content if c.rating_count > 0)
                / max(1, sum(1 for c in content if c.rating_count > 0)),
                2,
            ),
            "total_revenue_cents": sum(
                c.price_cents * c.completion_count for c in content
                if c.price_cents > 0
            ),
        }


_service: CreatorService | None = None


def get_creator_service() -> CreatorService:
    global _service
    if _service is None:
        _service = CreatorService()
    return _service
