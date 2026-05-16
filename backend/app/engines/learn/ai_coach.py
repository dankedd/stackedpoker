"""Adaptive AI poker coach powered by GPT-4o."""

import logging
from openai import AsyncOpenAI
from app.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)

COACH_SYSTEM = """You are an elite, concise Socratic poker coach inside an interactive learning app.

RULES:
1. Keep responses under 80 words unless the user explicitly asks for more.
2. Never lecture. Ask one focused question that guides the user to discover the answer.
3. Reference the specific spot or decision in the current context.
4. If the user is wrong, give ONE hint — not the answer.
5. If the user is right, confirm in one sentence and connect to the broader concept.
6. Adapt to skill level: beginner = simple language, advanced = GTO terminology.
7. If the user asks "why", explain briefly and ask a follow-up question.
8. Never be discouraging. Mistakes are learning opportunities.

You are talking to a player trying to improve their poker game through interactive lessons."""


async def generate_coach_reply(
    messages: list[dict],
    context: dict,
    user_level: int = 1,
) -> str:
    """
    Generate a coaching response.

    Args:
        messages: conversation history [{role, content}]
        context: {board, hero_position, villain_position, street, pot_bb,
                  effective_stack_bb, user_action, quality, concept_ids,
                  active_leaks, lesson_title, step_type}
        user_level: 1-30
    """
    client = AsyncOpenAI(api_key=settings.openai_api_key)

    # Build context string
    ctx_parts = []
    if context.get("lesson_title"):
        ctx_parts.append(f"Lesson: {context['lesson_title']}")
    if context.get("board"):
        board_str = " ".join(context["board"]) if isinstance(context["board"], list) else context["board"]
        ctx_parts.append(f"Board: {board_str}")
    if context.get("hero_position"):
        ctx_parts.append(f"Position: {context['hero_position']} vs {context.get('villain_position', '?')}")
    if context.get("street"):
        ctx_parts.append(f"Street: {context['street']}")
    if context.get("pot_bb"):
        ctx_parts.append(f"Pot: {context['pot_bb']}bb, Stack: {context.get('effective_stack_bb', '?')}bb")
    if context.get("user_action"):
        ctx_parts.append(f"User chose: {context['user_action']} (quality: {context.get('quality', '?')})")
    if context.get("active_leaks"):
        leaks = context["active_leaks"][:2]
        ctx_parts.append(f"Known leaks: {', '.join(leaks)}")
    if context.get("concept_ids"):
        ctx_parts.append(f"Concepts in focus: {', '.join(context['concept_ids'])}")

    # Skill level hint
    if user_level <= 5:
        level_hint = "Skill: beginner. Use simple language, no jargon."
    elif user_level <= 15:
        level_hint = "Skill: intermediate. Use standard poker terminology."
    else:
        level_hint = "Skill: advanced. Use GTO concepts freely."

    context_str = "\n".join(ctx_parts) if ctx_parts else "General coaching session."

    system_with_context = f"""{COACH_SYSTEM}

CURRENT SESSION CONTEXT:
{context_str}
{level_hint}"""

    openai_messages = [{"role": "system", "content": system_with_context}]
    for m in messages[-10:]:  # last 10 messages only
        role = "user" if m.get("role") == "user" else "assistant"
        openai_messages.append({"role": role, "content": m.get("content", "")})

    try:
        response = await client.chat.completions.create(
            model="gpt-4o",
            messages=openai_messages,
            max_tokens=200,
            temperature=0.7,
        )
        return response.choices[0].message.content or "Let me think about how to help you with this spot."
    except Exception as e:
        logger.error("Coach generation failed: %s", e)
        return "What do you think the key factor is in this spot?"
