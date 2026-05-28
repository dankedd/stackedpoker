"""
solver_tree — recursive game tree import, normalization, and persistence.

This package converts raw TexasSolver game tree JSON into a normalized,
individually-persisted node structure suitable for lazy-loading, API
traversal, and solver-agnostic consumption.

Modules:
  models    — SolverNode dataclass + NodeID generation
  importer  — recursive DFS tree walker
  store     — SolveTreeStore persistence layer
"""
