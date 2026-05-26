"""
FastAPI endpoints for the AI-native coaching system (Phase 6).

Endpoints:
  POST /api/ai/chat              — conversational coaching (main entry)
  POST /api/ai/review-hand       — AI hand review
  POST /api/ai/generate-lesson   — generate personalized micro-lesson
  GET  /api/ai/study-plan/{uid}  — personalized study plan
  GET  /api/ai/profile/{uid}     — deep user profile
  GET  /api/ai/memories/{uid}    — user's coaching memories
  POST /api/ai/memory            — manually store a coaching memory
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.ai_coach.orchestrator import CoachResponse, get_orchestrator
from app.ai_coach.memory import (
    CoachingMemory,
    MemoryType,
    get_memory_store,
)
from app.ai_coach.user_model import build_user_profile, UserProfile
from app.ai_coach.generator import generate_micro_lesson, generate_study_plan
from app.ai_coach.safety import confidence_disclaimer

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/ai", tags=["ai-coach"])


# ── Request/Response models ───────────────────────────────────────────────

class ChatRequest(BaseModel):
    user_id: str
    message: str
    session_id: str = ""
    messages: list[dict] = Field(default_factory=list)
    context: dict = Field(default_factory=dict)
    persona: str = "mentor"


class ChatResponse(BaseModel):
    reply: str
    model_used: str
    latency_ms: float
    persona: str
    confidence_note: str = ""


class HandReviewRequest(BaseModel):
    user_id: str
    hand_summary: str = ""
    actions: list[dict] = Field(default_factory=list)
    mistakes: list[dict] = Field(default_factory=list)
    board: list[str] = Field(default_factory=list)
    solver_data: dict | None = None
    persona: str = "mentor"


class StoreMemoryRequest(BaseModel):
    user_id: str
    memory_type: str = "preference"
    content: str
    concept_tags: list[str] = Field(default_factory=list)
    importance: float = 0.5


class LessonRequest(BaseModel):
    user_id: str
    concept_focus: str | None = None


# ── Routes ────────────────────────────────────────────────────────────────

@router.post("/chat", response_model=ChatResponse)
async def ai_chat(request: ChatRequest) -> ChatResponse:
    """
    Conversational coaching — the main AI coach entry point.

    Accepts user message + conversation history + context.
    Returns grounded, personalized coaching response.
    """
    orchestrator = get_orchestrator()
    result = await orchestrator.chat(
        user_id=request.user_id,
        message=request.message,
        messages=request.messages,
        session_context=request.context,
        session_id=request.session_id,
        persona=request.persona,
    )

    # Add confidence disclaimer if solver data is low-confidence
    solver_conf = request.context.get("solver_confidence", 0.8)
    note = confidence_disclaimer(solver_conf)

    return ChatResponse(
        reply=result.reply,
        model_used=result.model_used,
        latency_ms=result.latency_ms,
        persona=result.persona,
        confidence_note=note,
    )


@router.post("/review-hand", response_model=ChatResponse)
async def ai_review_hand(request: HandReviewRequest) -> ChatResponse:
    """
    AI-powered hand review — strategic narrative of a hand.

    Focuses on the biggest mistake first and provides actionable takeaways.
    """
    orchestrator = get_orchestrator()
    result = await orchestrator.review_hand(
        user_id=request.user_id,
        hand_summary=request.hand_summary,
        actions=request.actions,
        mistakes=request.mistakes,
        board=request.board,
        solver_data=request.solver_data,
        persona=request.persona,
    )

    return ChatResponse(
        reply=result.reply,
        model_used=result.model_used,
        latency_ms=result.latency_ms,
        persona=result.persona,
    )


@router.post("/generate-lesson")
async def ai_generate_lesson(request: LessonRequest) -> dict:
    """Generate a personalized micro-lesson targeting the user's weakest area."""
    lesson = await generate_micro_lesson(
        user_id=request.user_id,
        concept_focus=request.concept_focus,
    )
    return lesson


@router.get("/study-plan/{user_id}")
async def ai_study_plan(user_id: str, days: int = 7) -> dict:
    """Generate a personalized study plan for the next N days."""
    return await generate_study_plan(user_id, days=days)


@router.get("/profile/{user_id}")
async def ai_user_profile(user_id: str) -> dict:
    """Get the deep user profile used for coaching personalization."""
    profile = build_user_profile(user_id)
    return {
        "user_id": profile.user_id,
        "level": profile.level,
        "overall_rating": profile.overall_rating,
        "learning_style": profile.learning_style.value,
        "preferred_tone": profile.preferred_tone.value,
        "weakest_areas": profile.weakest_areas,
        "strongest_areas": profile.strongest_areas,
        "active_leaks": profile.active_leaks,
        "recurring_mistakes": profile.recurring_mistakes,
        "drill_accuracy": profile.drill_accuracy,
        "hands_analyzed": profile.hands_analyzed,
        "drills_completed": profile.drills_completed,
        "asks_for_detail": profile.asks_for_detail,
        "gets_frustrated": profile.gets_frustrated,
        "selected_persona": profile.select_persona(),
        "prompt_summary": profile.to_prompt_summary(),
    }


@router.get("/memories/{user_id}")
async def ai_memories(user_id: str, top_k: int = 20) -> dict:
    """Get user's coaching memories (for debugging and transparency)."""
    store = get_memory_store()
    memories = store.retrieve_all(user_id, top_k=top_k)
    return {
        "user_id": user_id,
        "total_memories": store.count(user_id),
        "memories": [
            {
                "memory_id": m.memory_id,
                "type": m.memory_type.value,
                "content": m.content,
                "importance": m.importance,
                "relevance": round(m.relevance_score(), 3),
                "concept_tags": m.concept_tags,
                "created_at": m.created_at.isoformat(),
                "access_count": m.access_count,
            }
            for m in memories
        ],
    }


@router.post("/memory")
async def store_memory(request: StoreMemoryRequest) -> dict:
    """Manually store a coaching memory (for debugging or user preferences)."""
    try:
        mem_type = MemoryType(request.memory_type)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid memory type: {request.memory_type}. "
                   f"Valid: {[t.value for t in MemoryType]}",
        )

    store = get_memory_store()
    memory = CoachingMemory(
        user_id=request.user_id,
        memory_type=mem_type,
        content=request.content,
        concept_tags=request.concept_tags,
        importance=request.importance,
    )
    memory_id = store.store(memory)

    return {"memory_id": memory_id, "stored": True}
