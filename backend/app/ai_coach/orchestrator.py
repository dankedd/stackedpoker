"""
AI coaching orchestrator — the main engine for conversational coaching.

Request lifecycle:
  1. Receive user message + session context
  2. Retrieve user model (skill, leaks, preferences)
  3. Retrieve relevant memories
  4. Retrieve solver data if applicable (RAG)
  5. Assemble grounded context block
  6. Select prompt template + persona
  7. Route to appropriate model (fast vs deep)
  8. Generate response
  9. Extract memories from conversation
  10. Return response + update session

Model routing:
  - Quick replies (drills, confirmations): gpt-4o-mini (fast, cheap)
  - Deep analysis (hand review, strategic discussion): gpt-4o (quality)
  - Lesson generation: gpt-4o (creative + accurate)
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from datetime import datetime, timezone

from app.config import get_settings

from .context import build_coaching_context, build_hand_review_context, CoachingContext
from .memory import (
    CoachingMemory,
    MemoryType,
    extract_memories_from_session,
    get_memory_store,
)
from .prompts import (
    COACHING_SYSTEM,
    DRILL_FEEDBACK_SYSTEM,
    HAND_REVIEW_SYSTEM,
    LESSON_GENERATOR_SYSTEM,
    build_system_prompt,
)

logger = logging.getLogger(__name__)

# Model routing
_FAST_MODEL = "gpt-4o-mini"
_DEEP_MODEL = "gpt-4o"
_MAX_CONVERSATION_MESSAGES = 20  # Keep last N messages in context


@dataclass
class CoachResponse:
    """Complete response from the coaching orchestrator."""
    reply: str
    model_used: str
    latency_ms: float
    context_tokens: int
    memories_retrieved: int
    memories_created: int
    persona: str


class CoachingOrchestrator:
    """
    Main AI coaching engine.

    Usage:
        orchestrator = CoachingOrchestrator()
        response = await orchestrator.chat(
            user_id="user-123",
            message="Should I c-bet this flop?",
            session_context={...},
            messages=[...],
        )
    """

    def __init__(self) -> None:
        self._settings = get_settings()
        self._memory = get_memory_store()

    async def chat(
        self,
        user_id: str,
        message: str,
        *,
        messages: list[dict] | None = None,
        session_context: dict | None = None,
        session_id: str = "",
        persona: str = "mentor",
    ) -> CoachResponse:
        """
        Generate a coaching response for a user message.

        This is the primary entry point for all coaching interactions.
        """
        t0 = time.monotonic()
        ctx = session_context or {}
        msgs = messages or []

        # ── 1. Determine coaching mode ────────────────────────────────────
        mode = self._classify_intent(message, ctx)

        # ── 2. Get user skill level ───────────────────────────────────────
        level = await self._get_user_level(user_id)

        # ── 3. Build grounded context ─────────────────────────────────────
        concept_tags = ctx.get("concept_ids", []) or ctx.get("active_leaks", [])
        solver_strategy = ctx.get("solver_strategy")
        mistake_report = ctx.get("mistake_report")

        coaching_ctx = build_coaching_context(
            user_id,
            board=ctx.get("board"),
            spot_type=ctx.get("spot_type", ""),
            positions=ctx.get("positions", ""),
            street=ctx.get("street", ""),
            stack_depth=ctx.get("stack_depth", 0),
            pot_bb=ctx.get("pot_bb", 0),
            hero_is_ip=ctx.get("hero_is_ip", True),
            hero_is_pfr=ctx.get("hero_is_pfr", True),
            concept_tags=concept_tags,
            solver_strategy=solver_strategy,
            mistake_report=mistake_report,
            extra_context=ctx.get("extra"),
        )

        # ── 4. Select template and model ──────────────────────────────────
        if mode == "hand_review":
            template = HAND_REVIEW_SYSTEM
            model = _DEEP_MODEL
            max_words = 150
        elif mode == "drill_feedback":
            template = DRILL_FEEDBACK_SYSTEM
            model = _FAST_MODEL
            max_words = 60
        elif mode == "lesson":
            template = LESSON_GENERATOR_SYSTEM
            model = _DEEP_MODEL
            max_words = 200
        else:
            template = COACHING_SYSTEM
            model = _FAST_MODEL if level <= 10 else _DEEP_MODEL
            max_words = 80

        # ── 5. Build system prompt ────────────────────────────────────────
        system_prompt = build_system_prompt(
            template,
            persona=persona,
            level=level,
            max_words=max_words,
            context_text=coaching_ctx.render(),
        )

        # ── 6. Build message array ────────────────────────────────────────
        recent_msgs = msgs[-_MAX_CONVERSATION_MESSAGES:]
        openai_messages = [{"role": "system", "content": system_prompt}]
        for m in recent_msgs:
            openai_messages.append({
                "role": m.get("role", "user"),
                "content": m.get("content", ""),
            })
        openai_messages.append({"role": "user", "content": message})

        # ── 7. Call LLM ──────────────────────────────────────────────────
        reply = await self._call_llm(openai_messages, model, max_words)

        # ── 8. Extract and store memories ─────────────────────────────────
        updated_msgs = recent_msgs + [
            {"role": "user", "content": message},
            {"role": "assistant", "content": reply},
        ]
        new_memories = extract_memories_from_session(
            user_id, updated_msgs, ctx, session_id,
        )
        for mem in new_memories:
            self._memory.store(mem)

        latency = (time.monotonic() - t0) * 1000

        return CoachResponse(
            reply=reply,
            model_used=model,
            latency_ms=round(latency, 1),
            context_tokens=coaching_ctx.token_estimate(),
            memories_retrieved=len(coaching_ctx.sections.get("coaching_memory", "").split("\n")),
            memories_created=len(new_memories),
            persona=persona,
        )

    async def review_hand(
        self,
        user_id: str,
        *,
        hand_summary: str = "",
        actions: list[dict] | None = None,
        mistakes: list[dict] | None = None,
        board: list[str] | None = None,
        solver_data: dict | None = None,
        persona: str = "mentor",
    ) -> CoachResponse:
        """
        Generate an AI hand review — a strategic narrative of the hand.

        Returns a structured review focusing on the biggest mistake first.
        """
        t0 = time.monotonic()
        level = await self._get_user_level(user_id)

        ctx = build_hand_review_context(
            user_id,
            hand_summary=hand_summary,
            actions=actions,
            mistakes=mistakes,
            board=board,
            solver_data=solver_data,
        )

        system_prompt = build_system_prompt(
            HAND_REVIEW_SYSTEM,
            persona=persona,
            level=level,
            max_words=200,
            context_text=ctx.render(),
        )

        openai_messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": "Please review this hand and focus on the key decision points."},
        ]

        reply = await self._call_llm(openai_messages, _DEEP_MODEL, 200)
        latency = (time.monotonic() - t0) * 1000

        return CoachResponse(
            reply=reply,
            model_used=_DEEP_MODEL,
            latency_ms=round(latency, 1),
            context_tokens=ctx.token_estimate(),
            memories_retrieved=0,
            memories_created=0,
            persona=persona,
        )

    # ── Internal helpers ──────────────────────────────────────────────────

    def _classify_intent(self, message: str, context: dict) -> str:
        """Classify the coaching interaction type from message + context."""
        msg_lower = message.lower()

        if context.get("mode") == "hand_review":
            return "hand_review"
        if context.get("mode") == "drill":
            return "drill_feedback"
        if context.get("mode") == "lesson":
            return "lesson"

        # Heuristic intent detection
        if any(kw in msg_lower for kw in ["review", "hand history", "what did i do wrong"]):
            return "hand_review"
        if any(kw in msg_lower for kw in ["drill", "quiz", "test me"]):
            return "drill_feedback"
        if any(kw in msg_lower for kw in ["teach", "explain", "lesson", "learn about"]):
            return "lesson"

        return "chat"

    async def _get_user_level(self, user_id: str) -> int:
        """Fetch user skill level. Returns 1 if unavailable."""
        try:
            from app.coaching.skill_model import UserSkillModel
            model = UserSkillModel(user_id)
            return model.snapshot.level
        except Exception:
            return 1

    async def _call_llm(
        self,
        messages: list[dict],
        model: str,
        max_words: int,
    ) -> str:
        """Call the OpenAI API with fallback handling."""
        try:
            import openai

            client = openai.AsyncOpenAI(api_key=self._settings.openai_api_key)

            # Estimate max tokens from max_words (~1.3 tokens per word)
            max_tokens = min(1000, int(max_words * 1.5))

            # Temperature: slightly creative for coaching, lower for analysis
            temperature = 0.6 if model == _DEEP_MODEL else 0.7

            response = await client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
            )

            reply = response.choices[0].message.content or ""
            return reply.strip()

        except Exception as exc:
            logger.error("[Orchestrator] LLM call failed: %s", exc)
            return self._fallback_reply()

    def _fallback_reply(self) -> str:
        """Deterministic fallback when LLM is unavailable."""
        return (
            "I'm having trouble connecting to my analysis engine right now. "
            "What specific aspect of this spot would you like to think through? "
            "Consider: who has the range advantage, and what does that mean for sizing?"
        )


# Module-level singleton
_orchestrator: CoachingOrchestrator | None = None


def get_orchestrator() -> CoachingOrchestrator:
    global _orchestrator
    if _orchestrator is None:
        _orchestrator = CoachingOrchestrator()
    return _orchestrator
