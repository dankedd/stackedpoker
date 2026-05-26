"""
ai_coach — AI-native conversational coaching system with long-term memory.

This package transforms the platform from static coaching into a deeply
personalized, memory-aware AI coaching experience.

Architecture:
  memory.py       — Long-term coaching memory (cross-session, summarized)
  context.py      — RAG context assembly (solver + user history + memory)
  orchestrator.py — Main AI coaching engine (model routing, streaming)
  prompts.py      — Prompt templates, system prompts, coaching personas
  user_model.py   — Deep user persona modeling and adaptation
  generator.py    — AI-generated lessons, drills, explanations
  safety.py       — Hallucination prevention, grounding checks
"""
