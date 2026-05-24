"""
TexasSolver integration — offline solve-generation pipeline.

Pipeline:
  SolverConfig
    → TexasSolver CLI (subprocess)
    → parse output → list[RawSolverNode]
    → existing import pipeline (normalize → map → compress → store)
    → StrategyNode DB

This is NOT live solving. All solves are pre-generated and stored.
"""
