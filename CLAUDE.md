# CLAUDE.md

## Primary Theory Source

The canonical source for all poker theory in this project is:

`docs/Modern Poker Theory.pdf`

(Not yet present in the repo — the user will add it.)

This document is the primary source of truth for:

- preflop strategy
- postflop strategy
- ranges
- frequencies
- GTO concepts
- exploitative concepts
- blockers
- MDF
- EV explanations
- lesson content
- quizzes
- AI Coach theory
- range visualizations
- strategy feedback

## Required workflow

Whenever a task involves poker theory:

1. Read the relevant section(s) of `docs/Modern Poker Theory.pdf` before writing code.
2. Base the implementation on the book whenever the information exists there.
3. Do not invent ranges, frequencies, or solver outputs.
4. If the requested information is not present in the book, explicitly state that before implementing.
5. Distinguish clearly between:
   - direct information from the book;
   - implementation decisions;
   - pedagogical simplifications.

## Reporting

Every poker-related implementation report must include:

- which chapter(s) were consulted;
- which page(s) or figure(s) were used when identifiable;
- whether the implementation is:
  - exact transcription,
  - exact derivation,
  - source reconstruction,
  - or a pedagogical model.

Never fabricate theory to fill gaps.
