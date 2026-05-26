"""
Long-term coaching memory — persistent, cross-session, summarized.

Problem:
  The existing system stores raw message history per session but has no
  cross-session continuity. A user who struggled with c-bets last week
  gets a fresh coach today with zero context.

Solution:
  Three-tier memory architecture:
    1. EPISODIC — individual coaching moments (recent, detailed)
    2. SEMANTIC — extracted facts and patterns (persistent, compressed)
    3. WORKING — assembled context for current conversation (ephemeral)

Memory lifecycle:
  Raw conversation → extract key facts → summarize → store semantic memory
  → retrieve relevant memories for new conversations → inject into prompt

Storage: PostgreSQL JSONB (Supabase-compatible). Each memory has:
  - importance score (0-1): how much this matters for future coaching
  - decay factor: recent memories weighted higher
  - concept tags: for targeted retrieval
"""

from __future__ import annotations

import hashlib
import logging
from datetime import datetime, timezone
from enum import Enum

from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


class MemoryType(str, Enum):
    """Categories of coaching memory."""
    MISTAKE_PATTERN = "mistake_pattern"     # Recurring error in a specific spot type
    CONCEPT_STRUGGLE = "concept_struggle"   # Difficulty understanding a concept
    BREAKTHROUGH = "breakthrough"           # Moment user demonstrated understanding
    PREFERENCE = "preference"               # Learning style or coaching preference
    STRENGTH = "strength"                   # Area where user excels
    EMOTIONAL = "emotional"                 # Tilt tendency, frustration pattern
    STUDY_HABIT = "study_habit"             # When/how user studies best
    MILESTONE = "milestone"                 # Level up, streak, achievement


class CoachingMemory(BaseModel):
    """A single memory entry in the long-term coaching store."""
    memory_id: str = ""
    user_id: str
    memory_type: MemoryType
    content: str                            # Human-readable memory text
    concept_tags: list[str] = Field(default_factory=list)
    importance: float = 0.5                 # 0-1, higher = more relevant
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_accessed: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    access_count: int = 0
    source_session_id: str | None = None    # Session that produced this memory
    metadata: dict = Field(default_factory=dict)

    def relevance_score(self, now: datetime | None = None) -> float:
        """
        Compute relevance combining importance and recency.

        Recent + important memories score highest.
        Old memories decay but high-importance ones persist.
        """
        now = now or datetime.now(timezone.utc)
        age_days = max(0.1, (now - self.created_at).total_seconds() / 86400)

        # Recency decay: half-life of 30 days
        recency = 0.5 ** (age_days / 30.0)

        # Importance persists: floor at 20% of importance score
        importance_floor = self.importance * 0.2
        decayed_importance = self.importance * recency + importance_floor

        # Access boost: frequently accessed memories are more relevant
        access_boost = min(0.1, self.access_count * 0.01)

        return min(1.0, decayed_importance + access_boost)


class UserMemoryStore:
    """
    Manages long-term coaching memories for a user.

    In production, backed by Supabase/PostgreSQL.
    For MVP, uses in-memory dict with optional persistence.
    """

    def __init__(self) -> None:
        self._memories: dict[str, list[CoachingMemory]] = {}  # user_id → memories

    def _user_memories(self, user_id: str) -> list[CoachingMemory]:
        if user_id not in self._memories:
            self._memories[user_id] = []
        return self._memories[user_id]

    def store(self, memory: CoachingMemory) -> str:
        """Store a new memory. Returns the memory_id."""
        if not memory.memory_id:
            raw = f"{memory.user_id}:{memory.content}:{memory.created_at.isoformat()}"
            memory.memory_id = hashlib.md5(raw.encode()).hexdigest()[:12]

        memories = self._user_memories(memory.user_id)

        # Deduplicate: if very similar memory exists, merge instead of adding
        for existing in memories:
            if (
                existing.memory_type == memory.memory_type
                and existing.concept_tags == memory.concept_tags
                and _text_similarity(existing.content, memory.content) > 0.8
            ):
                # Update existing with higher importance
                existing.importance = max(existing.importance, memory.importance)
                existing.access_count += 1
                existing.last_accessed = datetime.now(timezone.utc)
                existing.metadata.update(memory.metadata)
                return existing.memory_id

        memories.append(memory)

        # Prune: keep max 100 memories per user, drop lowest relevance
        if len(memories) > 100:
            memories.sort(key=lambda m: m.relevance_score(), reverse=True)
            self._memories[memory.user_id] = memories[:100]

        logger.debug(
            "[Memory] stored %s for user %s: %s",
            memory.memory_type.value, memory.user_id, memory.content[:60],
        )
        return memory.memory_id

    def retrieve(
        self,
        user_id: str,
        *,
        concept_tags: list[str] | None = None,
        memory_types: list[MemoryType] | None = None,
        top_k: int = 10,
        min_relevance: float = 0.05,
    ) -> list[CoachingMemory]:
        """
        Retrieve most relevant memories for coaching context.

        Filters by concept tags and/or memory types, then ranks by relevance.
        """
        memories = self._user_memories(user_id)
        now = datetime.now(timezone.utc)

        candidates = []
        for mem in memories:
            # Filter by type
            if memory_types and mem.memory_type not in memory_types:
                continue

            # Filter by concept tags (any overlap)
            if concept_tags:
                if not set(mem.concept_tags) & set(concept_tags):
                    continue

            relevance = mem.relevance_score(now)
            if relevance >= min_relevance:
                candidates.append((mem, relevance))

        # Sort by relevance descending
        candidates.sort(key=lambda x: x[1], reverse=True)

        # Mark accessed
        result = []
        for mem, _ in candidates[:top_k]:
            mem.access_count += 1
            mem.last_accessed = now
            result.append(mem)

        return result

    def retrieve_all(self, user_id: str, top_k: int = 20) -> list[CoachingMemory]:
        """Retrieve all memories ranked by relevance (no filters)."""
        return self.retrieve(user_id, top_k=top_k)

    def get_user_summary(self, user_id: str) -> str:
        """
        Generate a concise summary of what the coach knows about the user.

        This is injected into the system prompt for personalization.
        """
        memories = self.retrieve_all(user_id, top_k=15)
        if not memories:
            return "New student — no coaching history yet."

        lines = []

        # Group by type
        patterns = [m for m in memories if m.memory_type == MemoryType.MISTAKE_PATTERN]
        struggles = [m for m in memories if m.memory_type == MemoryType.CONCEPT_STRUGGLE]
        strengths = [m for m in memories if m.memory_type == MemoryType.STRENGTH]
        prefs = [m for m in memories if m.memory_type == MemoryType.PREFERENCE]
        breakthroughs = [m for m in memories if m.memory_type == MemoryType.BREAKTHROUGH]

        if patterns:
            lines.append("Recurring mistakes: " + "; ".join(m.content for m in patterns[:3]))
        if struggles:
            lines.append("Struggles with: " + "; ".join(m.content for m in struggles[:3]))
        if strengths:
            lines.append("Strong at: " + "; ".join(m.content for m in strengths[:2]))
        if prefs:
            lines.append("Preferences: " + "; ".join(m.content for m in prefs[:2]))
        if breakthroughs:
            lines.append("Recent breakthroughs: " + "; ".join(m.content for m in breakthroughs[:2]))

        return "\n".join(lines)

    def count(self, user_id: str) -> int:
        return len(self._user_memories(user_id))


def _text_similarity(a: str, b: str) -> float:
    """Quick text overlap check for deduplication."""
    if not a or not b:
        return 0.0
    words_a = set(a.lower().split())
    words_b = set(b.lower().split())
    if not words_a or not words_b:
        return 0.0
    overlap = len(words_a & words_b)
    return overlap / max(len(words_a), len(words_b))


# ── Memory extraction from conversations ──────────────────────────────────


def extract_memories_from_session(
    user_id: str,
    messages: list[dict],
    context: dict,
    session_id: str,
) -> list[CoachingMemory]:
    """
    Extract coaching memories from a completed conversation.

    Scans for:
    - Mistakes the user made
    - Concepts the user struggled with
    - Moments of understanding
    - Expressed preferences
    """
    memories: list[CoachingMemory] = []

    # Extract from context (leaks, quality)
    active_leaks = context.get("active_leaks", [])
    quality = context.get("quality", "")
    concept_ids = context.get("concept_ids", [])
    user_action = context.get("user_action", "")

    if active_leaks:
        for leak in active_leaks[:2]:
            memories.append(CoachingMemory(
                user_id=user_id,
                memory_type=MemoryType.MISTAKE_PATTERN,
                content=f"Leaked in {leak} during coaching session",
                concept_tags=[leak] if isinstance(leak, str) else [],
                importance=0.7,
                source_session_id=session_id,
            ))

    if quality in ("mistake", "punt", "blunder"):
        memories.append(CoachingMemory(
            user_id=user_id,
            memory_type=MemoryType.MISTAKE_PATTERN,
            content=f"Made a {quality} ({user_action}) in {context.get('street', 'unknown')} spot",
            concept_tags=concept_ids,
            importance=0.6 if quality == "mistake" else 0.8,
            source_session_id=session_id,
        ))

    if quality in ("perfect", "good"):
        memories.append(CoachingMemory(
            user_id=user_id,
            memory_type=MemoryType.BREAKTHROUGH,
            content=f"Correctly identified {user_action} in {context.get('street', 'unknown')} spot",
            concept_tags=concept_ids,
            importance=0.4,
            source_session_id=session_id,
        ))

    # Scan messages for preference signals
    for msg in messages:
        if msg.get("role") != "user":
            continue
        content_lower = (msg.get("content") or "").lower()

        if any(phrase in content_lower for phrase in [
            "too much", "overwhelming", "confused", "don't understand",
            "simpler", "explain like", "what does",
        ]):
            memories.append(CoachingMemory(
                user_id=user_id,
                memory_type=MemoryType.PREFERENCE,
                content="Prefers simpler explanations — expressed confusion",
                importance=0.6,
                source_session_id=session_id,
            ))
            break

        if any(phrase in content_lower for phrase in [
            "more detail", "deeper", "advanced", "why exactly", "solver",
        ]):
            memories.append(CoachingMemory(
                user_id=user_id,
                memory_type=MemoryType.PREFERENCE,
                content="Wants deeper, more technical explanations",
                importance=0.6,
                source_session_id=session_id,
            ))
            break

    return memories


# Module-level singleton
_store: UserMemoryStore | None = None


def get_memory_store() -> UserMemoryStore:
    global _store
    if _store is None:
        _store = UserMemoryStore()
    return _store
