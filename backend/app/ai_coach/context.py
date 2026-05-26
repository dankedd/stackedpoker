"""
RAG context assembly — builds grounded prompts from solver + memory + user data.

The LLM must NEVER generate poker strategy from its training data alone.
Every strategic claim must be grounded in one of:
  1. Solver output (from strategy_db or abstraction system)
  2. Deterministic engine output (heuristics, board classification)
  3. User-specific data (skill model, leaks, memories)

This module assembles the context block that gets injected into every
coaching prompt, ensuring the LLM operates as an *interpreter* of
pre-computed data, not a *generator* of poker strategy.

Context budget: ~2000 tokens max to leave room for conversation history.
"""

from __future__ import annotations

import logging
from typing import Any

from .memory import CoachingMemory, MemoryType, get_memory_store

logger = logging.getLogger(__name__)

# Maximum characters per context section (prevents prompt bloat)
_MAX_SECTION_CHARS = 400


def _safe(value: Any, max_len: int = 200) -> str:
    """Sanitize a value for prompt injection safety."""
    s = str(value)[:max_len]
    # Strip control characters
    return "".join(c for c in s if c.isprintable() or c in ("\n", "\t"))


def _truncate(text: str, max_chars: int = _MAX_SECTION_CHARS) -> str:
    if len(text) <= max_chars:
        return text
    return text[:max_chars - 3] + "..."


class CoachingContext:
    """
    Assembled context for a single coaching interaction.

    Built once per request, injected into the prompt.
    """

    def __init__(self) -> None:
        self.sections: dict[str, str] = {}

    def add(self, key: str, content: str) -> None:
        self.sections[key] = _truncate(content)

    def render(self) -> str:
        """Render all sections as a structured text block."""
        if not self.sections:
            return ""

        lines = ["<coaching_context>"]
        for key, content in self.sections.items():
            lines.append(f"[{key}]")
            lines.append(content)
            lines.append("")
        lines.append("</coaching_context>")
        return "\n".join(lines)

    def token_estimate(self) -> int:
        """Rough token estimate (~4 chars per token)."""
        return len(self.render()) // 4


def build_coaching_context(
    user_id: str,
    *,
    board: list[str] | None = None,
    spot_type: str = "",
    positions: str = "",
    street: str = "",
    stack_depth: int = 0,
    pot_bb: float = 0,
    hero_is_ip: bool = True,
    hero_is_pfr: bool = True,
    concept_tags: list[str] | None = None,
    solver_strategy: dict | None = None,
    mistake_report: dict | None = None,
    skill_snapshot: dict | None = None,
    extra_context: dict | None = None,
) -> CoachingContext:
    """
    Assemble full coaching context from all available data sources.

    Called before every LLM interaction to ground the response.
    """
    ctx = CoachingContext()

    # ── 1. Spot description ───────────────────────────────────────────────
    if board or spot_type:
        spot_parts = []
        if spot_type:
            spot_parts.append(f"Pot type: {_safe(spot_type)}")
        if positions:
            spot_parts.append(f"Positions: {_safe(positions)}")
        if stack_depth:
            spot_parts.append(f"Stack: {stack_depth}bb")
        if pot_bb:
            spot_parts.append(f"Pot: {pot_bb:.1f}bb")
        if street:
            spot_parts.append(f"Street: {street}")
        if board:
            spot_parts.append(f"Board: {' '.join(board)}")
        ip_label = "IP" if hero_is_ip else "OOP"
        pfr_label = "PFR" if hero_is_pfr else "caller"
        spot_parts.append(f"Hero is {ip_label}/{pfr_label}")
        ctx.add("spot", " | ".join(spot_parts))

    # ── 2. Solver strategy (grounding) ────────────────────────────────────
    if solver_strategy:
        strat_lines = []
        dist = solver_strategy.get("action_distribution", {})
        if dist:
            actions = ", ".join(f"{a}: {f:.0%}" for a, f in sorted(dist.items(), key=lambda x: -x[1]))
            strat_lines.append(f"Strategy: {actions}")
        if solver_strategy.get("range_advantage"):
            ra = solver_strategy["range_advantage"]
            label = "strong" if ra > 0.65 else "moderate" if ra > 0.45 else "weak"
            strat_lines.append(f"Range advantage: {label} ({ra:.2f})")
        if solver_strategy.get("primary_sizing"):
            strat_lines.append(f"Preferred sizing: {solver_strategy['primary_sizing']}")
        source = solver_strategy.get("source", "unknown")
        strat_lines.append(f"Source: {source}")
        ctx.add("solver_strategy", "\n".join(strat_lines))

    # ── 3. Mistake report ─────────────────────────────────────────────────
    if mistake_report:
        mr_lines = []
        mr_lines.append(f"Action: {_safe(mistake_report.get('action_taken', ''))}")
        mr_lines.append(f"Severity: {mistake_report.get('severity', 'unknown')}")
        mr_lines.append(f"EV loss: {mistake_report.get('ev_loss_bb', 0):.2f}bb")
        preferred = mistake_report.get("solver_preferred_action", "")
        if preferred:
            mr_lines.append(f"Solver prefers: {preferred}")
        mr_lines.append(f"Difficulty: {mistake_report.get('difficulty', 0):.2f}")
        ctx.add("mistake_analysis", "\n".join(mr_lines))

    # ── 4. User skill profile ─────────────────────────────────────────────
    if skill_snapshot:
        skill_lines = []
        overall = skill_snapshot.get("overall_rating", 50)
        skill_lines.append(f"Rating: {overall:.0f}/100 (level {skill_snapshot.get('level', 1)})")
        weak = skill_snapshot.get("weakest_dimensions", [])
        if weak:
            skill_lines.append(f"Weak areas: {', '.join(weak[:3])}")
        strong = skill_snapshot.get("strongest_dimensions", [])
        if strong:
            skill_lines.append(f"Strong areas: {', '.join(strong[:3])}")
        trend = skill_snapshot.get("rating_trend", "stable")
        skill_lines.append(f"Trend: {trend}")
        ctx.add("user_skill", "\n".join(skill_lines))

    # ── 5. Long-term memory ───────────────────────────────────────────────
    memory_store = get_memory_store()
    memories = memory_store.retrieve(
        user_id,
        concept_tags=concept_tags,
        top_k=5,
    )
    if memories:
        mem_lines = []
        for mem in memories:
            type_label = mem.memory_type.value.replace("_", " ")
            mem_lines.append(f"- [{type_label}] {mem.content}")
        ctx.add("coaching_memory", "\n".join(mem_lines))
    else:
        # Still include user summary if available
        summary = memory_store.get_user_summary(user_id)
        if summary and summary != "New student — no coaching history yet.":
            ctx.add("coaching_memory", summary)

    # ── 6. Extra context (from caller) ────────────────────────────────────
    if extra_context:
        extra_lines = [f"{k}: {_safe(v)}" for k, v in extra_context.items()]
        ctx.add("additional", "\n".join(extra_lines[:5]))

    return ctx


def build_hand_review_context(
    user_id: str,
    *,
    hand_summary: str = "",
    actions: list[dict] | None = None,
    mistakes: list[dict] | None = None,
    solver_data: dict | None = None,
    board: list[str] | None = None,
    skill_snapshot: dict | None = None,
) -> CoachingContext:
    """
    Specialized context assembly for AI hand review.

    Includes full hand narrative + per-street mistake data.
    """
    ctx = CoachingContext()

    if hand_summary:
        ctx.add("hand_summary", _truncate(hand_summary, 600))

    if board:
        ctx.add("board", " ".join(board))

    if actions:
        action_lines = []
        for a in actions[:12]:  # Max 12 actions
            hero = "HERO" if a.get("is_hero") else a.get("player", "villain")
            action_lines.append(
                f"{a.get('street', '?')}: {hero} {a.get('action', '?')} "
                f"{a.get('size_bb', '')}bb"
            )
        ctx.add("action_sequence", "\n".join(action_lines))

    if mistakes:
        mistake_lines = []
        for m in mistakes[:4]:
            mistake_lines.append(
                f"{m.get('street', '?')}: {m.get('action_taken', '?')} — "
                f"{m.get('severity', '?')} (EV loss: {m.get('ev_loss_bb', 0):.1f}bb)"
            )
        ctx.add("mistakes_found", "\n".join(mistake_lines))

    if solver_data:
        ctx.add("solver_strategy", str(solver_data)[:_MAX_SECTION_CHARS])

    # User memory
    memory_store = get_memory_store()
    summary = memory_store.get_user_summary(user_id)
    if summary and "no coaching history" not in summary:
        ctx.add("user_profile", _truncate(summary, 300))

    if skill_snapshot:
        overall = skill_snapshot.get("overall_rating", 50)
        level = skill_snapshot.get("level", 1)
        ctx.add("skill_level", f"Rating {overall:.0f}/100, Level {level}")

    return ctx
