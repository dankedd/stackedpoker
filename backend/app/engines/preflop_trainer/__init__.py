"""Server-side grading for the Preflop Trainer (frontend /preflop-trainer).

The trainer deals and grades in the browser for instant feedback, but XP is
only ever awarded on the SERVER's verdict: the client says which chart, which
hand and which action, and `grade_hand` re-grades it against this package's
own copy of the charts. A tampered client can therefore claim a hand, but not
a verdict.

`data/*.json` must stay byte-identical to `frontend/data/ranges/*.json` —
frontend/lib/ranges/__tests__/backendData.test.ts fails the build if they
drift. The grading rules mirror `frontend/lib/ranges/logic.ts`
(`frequencies` + `gradeFrequencies`); tests/test_preflop_trainer.py pins them.
"""

from .grading import ChartRef, GradeResult, InvalidHand, grade_hand

__all__ = ["ChartRef", "GradeResult", "InvalidHand", "grade_hand"]
