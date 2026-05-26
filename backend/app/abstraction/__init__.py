"""
abstraction — board clustering, canonical encoding, and nearest-neighbor retrieval.

This package transforms the raw solve database into a scalable abstraction-driven
strategy engine. Instead of storing exact solves for every possible board, we:

  1. Canonicalize boards (suit normalization, isomorphic grouping)
  2. Extract numeric feature vectors for similarity computation
  3. Cluster boards into abstraction buckets (~150-200 total)
  4. Map each bucket to representative solves
  5. Retrieve nearest strategies via vector similarity

Architecture:
  canonical.py   — suit normalization, isomorphic board encoding
  features.py    — numeric feature vector extraction (14-dimensional)
  clusters.py    — board clustering engine with hierarchical buckets
  retrieval.py   — nearest-neighbor solve retrieval with confidence scoring
  aggregation.py — strategy merging and frequency smoothing
  models.py      — Pydantic models for abstractions and feature vectors
  storage.py     — PostgreSQL models + vector indexing
"""
