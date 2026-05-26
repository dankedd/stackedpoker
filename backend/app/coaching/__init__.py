"""
coaching — solver-backed coaching intelligence and adaptive training.

This package bridges the gap between raw solver output and actionable
poker coaching. It transforms GTO frequencies into human-readable advice,
detects mistakes with calibrated severity, and generates personalized
training drills.

Modules:
  models.py             — MistakeReport, CoachingAdvice, DrillSpec, SkillSnapshot
  mistake_detector.py   — EV loss estimation, frequency deviation, severity scoring
  explainer.py          — solver output → human coaching explanations
  action_scorer.py      — solver-backed action quality scoring
  drill_generator.py    — automatic drill generation from solve database
  skill_model.py        — user skill tracking across strategic dimensions
  population.py         — population-level leak analysis
"""
