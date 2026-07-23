# Learn Question QA Standard

The quality bar every interactive `LessonStep` in the Poker Journey curriculum
must clear before it ships. Written after the Module 3 ("Building Your
Preflop Foundation") full audit, which found and fixed three real
answer-leakage bugs and one theory-consistency bug in already-shipped
content — this document exists so the next module doesn't reintroduce the
same classes of bug.

Apply this to every new `LessonStep` you write, and re-apply it whenever you
edit an existing one. It is not specific to Module 3 — every future module
(4–28) should be held to the same standard.

## The checklist

```
[ ] Question has one clear task
[ ] Visible question heading matches the actual cognitive task (QUESTION–INTERACTION ALIGNMENT — see below)
[ ] Necessary context is present
[ ] No unnecessary context
[ ] Answer is not visible
[ ] Answer is not embedded in question wording
[ ] Interaction is not pre-solved
[ ] Correct option has no visual clue
[ ] Concept was taught before testing
[ ] Poker assumptions are explicit
[ ] Correct answer verified
[ ] Mixed/ambiguous spots handled appropriately
[ ] Distractors represent plausible misconceptions
[ ] Feedback explains why
[ ] Wrong-answer feedback teaches
[ ] No internal metadata leaks answer
[ ] Calculation is correct
[ ] Visualization helps rather than solves
[ ] Works on desktop
[ ] Works on mobile
[ ] Works without hover
[ ] Works without relying solely on color
[ ] Review mode behaves differently from active attempt
[ ] Progress persists correctly
```

## The two failure modes that matter most

Every other item on the checklist exists to prevent one of these two:

1. **"The answer is already on the screen."** — in the concept tag, in a
   previous step's reveal, in a component's default state, in the question's
   own wording, or in the option ordering.
2. **"I cannot answer this because context is missing."** — position, stack
   depth, players behind, ante/rake, or whatever else the specific question
   type requires.

If you can say either sentence while looking at a step, it fails QA
regardless of whether it evaluates correctly.

## Concrete bug classes found in the Module 3 audit (don't reintroduce these)

### 1. Concept tag names the answer

A step tagged `concept_ids: ['first_in']` that asks the learner to classify a
situation as `first_in` vs. `facing_open` renders a `first_in` chip via
`ConceptTagRow` *before* the learner answers — literally printing the correct
option's name on screen. `LessonPlayer.tsx` guards a hardcoded
`SPOILER_CONCEPT_TAGS` set for exactly this pattern (see `range_morphology`'s
original fix, then `positive_ev`/`zero_ev`/`negative_ev`, then `first_in`).

**Rule**: before shipping a step, check whether any `concept_id` on it is
*also* one of that step's `options[].id`. If so, add it to
`SPOILER_CONCEPT_TAGS` — and add a test asserting the pairing (see
`module3Audit.test.ts`'s "Answer leakage — concept tags" block for the
pattern; it fails the build if a new collision ships unguarded).

### 2. One step reveals the exact answer to the next step's exercise

Module 3's Lesson 1 showed the complete, labeled BTN opening range as a
"here's what a range looks like" illustration, then immediately asked the
learner to build that exact BTN range from memory. The fix: use a
*different* position (CO) for the illustrative reveal, so the graded
exercise stays unspoiled.

**Rule**: when a lesson has both an illustrative reveal and a graded
exercise on the same underlying data (a range, a hand class, a number), make
sure the reveal never shows the literal target of the graded exercise that
follows it in the same lesson — not even a few steps later.

### 3. A later lesson's quiz answers are pre-shown in an earlier lesson

Module 3's Lesson 6 (limping) displayed the exact limp/raise split that
Lesson 7 (Small Blind) later quizzed the learner on hand-by-hand. Same bug
as #2, just spread across lessons instead of within one. The fix: Lesson 6
built its own illustrative example from lesson-local data instead of
borrowing Lesson 7's answer key.

**Rule**: before reusing a data structure (a range, a baseline, a split)
across lessons, check whether a *later* lesson quizzes on that exact data.
If so, either don't reuse it, or make sure the quiz comes first and the
full reveal comes after (see #4).

### 4. Reveal-before-quiz ordering within one lesson

Even without crossing lessons, showing the complete answer key (e.g. a full
raise/limp/fold action-map grid covering every hand) immediately before
asking "what does Hero do with this specific hand?" turns the quiz into a
memory-lookup exercise. The fix: reorder so the quiz comes first (learner
reasons from taught principles, unaided) and the full reveal comes
afterward, framed as "compare your reasoning to the complete picture."

**Rule**: `EXPLAIN → DEMONSTRATE/QUIZ → full reveal`, not
`EXPLAIN → full reveal → QUIZ`, whenever the reveal and the quiz share the
same underlying answer key.

### 5. Correct option always in the same position

Nearly every `decision_spot`/`hand_dna`/`range_compare`/etc. step in Module 3
had its `perfect`-quality option listed *first* in the authored `options`
array — an artifact of how it's natural to write the correct answer first
while drafting. None of the option-rendering components shuffled order, so
a learner could score well by always picking the first button, with zero
reasoning. Fixed by wiring every option-rendering component (`DecisionSpot`,
`ClassifyStep`, `HandDNA`, `StrategyComplexityMeter`, `RangeCompare`,
`DeadMoneyRangeVisualizer`, `RangeDiffOverlay`, and Module 2's own
components) through `shuffleBySeed(options, step.id)` from
`lib/learn/interactionSafety.ts` — deterministic per step (stable across
reloads, reproducible in tests), but not tied to authoring order.

**Rule**: never render `step.options` directly. Always pass them through
`shuffleBySeed(rawOptions, step.id)` first. This is now the house style —
grep for `step.options ?? []` in any new component and make sure the very
next line shuffles it, not just aliases it.

### 6. A live-updating number that IS the answer

Any component with an exploratory slider that computes and displays a
number live (e.g. "Break-even fold %" as a bet-size slider moves, or
"Resistance risk %" as a players-behind slider moves) must not also use
that same live number as the target of a numeric-challenge question on the
same screen — the exploratory display hands the learner the answer for
whatever position they happen to leave the slider at. Fixed in
`PlayersBehindVisualizer` and `PreflopOpenSizeExplorer` (and, for Module 2,
`EVDecisionTree`) by gating the numeric readout behind
`!isChallenge || submitted` (or `reviewMode`), matching the
`getNeutralSliderStart` pattern already used for numeric-answer slider
defaults.

**Rule**: if a component has both a "live exploration" number and a
"guess the number" question, the exploration number must hide (or the
question must ask about something the exploration view doesn't compute)
until after submission. Use `getNeutralSliderStart(correctAnswer, min, max)`
from `interactionSafety.ts` for the answer slider's starting position too —
never a fixed default that might coincide with the real answer.

### 7. Theory inconsistency across a module's own baseline data

`RFI_SHALLOW.UTG` (hand-authored, ~15bb) included `88`, but `RFI_MEDIUM.UTG`
(mechanically derived from the deep baseline's "always-in" hands) excluded
it — meaning a learner dragging the stack-depth slider back and forth would
see `88` present at 15bb, absent at 25-40bb, and present again (as a 50%
mix) at 100bb. Non-monotonic and poker-theoretically backwards. Fixed by
removing it from the shallow tier so shallow ⊆ medium ⊆ deep holds for every
authored position.

**Rule**: whenever you hand-author a "narrower" tier on top of a derived
"wider" tier, verify the narrow tier is an actual subset. Add a test like
`module3Audit.test.ts`'s "stack-depth tiers narrow monotonically" block.

### 8. A generic renderer heading overrides the authored question

`DecisionSpot.tsx` used to hardcode `"What is your action?"` beneath every
`decision_spot` step's narrative, regardless of what the step actually asked
— e.g. *"Hero looks at A♣T♦. Is this an opening hand?"* followed by a button
row of **Yes, always / No, never / Not enough information**, with the
misleading action heading glued on underneath. The bug wasn't in any one
curriculum entry; it was that the shared component assumed every
`decision_spot` represents a poker-action choice.

**QUESTION–INTERACTION ALIGNMENT (permanent rule)**

> The primary visible question must exactly match the cognitive task being
> tested. Never display a generic action-oriented heading unless the learner
> is actually selecting a poker action (Fold/Check/Call/Bet/Raise/All-in).

Fails QA:
```
"What is your action?"  →  Yes / No
"What is your action?"  →  IP / OOP
"What is your action?"  →  Linear / Polarized
```
Passes QA:
```
"What should Hero do?"  →  Fold / Call / Raise
```

**How `DecisionSpot.tsx` enforces this today** (see
`isPokerActionSet` in `interactionSafety.ts`):
1. An explicit `step.decision_spot_question` always wins — set this whenever
   the question isn't already embedded in `narrative` and the options aren't
   themselves poker actions.
2. Otherwise, if `narrative` already ends in `...?`, it IS the question —
   render nothing extra underneath (no duplicate/mismatched heading).
3. Otherwise, only fall back to `"What is your action?"` when *every* option
   label is a real poker action (via `isPokerActionSet`).
4. Otherwise render no generic heading at all — a missing label is a smaller
   bug than a wrong one, and it's caught by the audit test below.

**Rule**: when authoring a new `decision_spot` step whose options are
Yes/No, a classification, a comparison, or anything else that isn't a poker
action, either end `narrative` with the actual question, or set
`decision_spot_question` explicitly. Never rely on the component's fallback
to paper over a missing question.

**Automated guard**: `questionHeadingAlignment.test.ts` walks every
`decision_spot` step in `LESSONS` and fails the build if a step has no
resolvable question (no `decision_spot_question`, no `narrative` ending in
`?`, and options that aren't a poker-action set), or if a
`decision_spot_question`/generic action phrase is used over non-action
options. Extend that test's checks first if you find a new shape of this
bug, rather than patching curriculum entries ad hoc.

## Data-authenticity rules (poker-specific)

- Prefer porting real existing app data (`backend/app/ranges/...`,
  `frontend/lib/learn/ranges.ts`) over inventing new ranges from scratch.
- When you must approximate (a stack-depth tier, a resistance-risk curve),
  say so on-screen, in plain language, near the interaction — not just in a
  code comment. Module 3's convention: a small `text-[9px]` caption like
  *"Deep is ported from the app's baseline RFI data; medium/shallow are
  simplified, clearly pedagogical reductions — not solver output."*
- Never claim a frequency/probability that wasn't actually computed from a
  stated model. If you need a plausible-looking number for something you
  can't solve exactly (e.g. "how much resistance risk"), define the
  simplified model explicitly (`WAKE_UP_HAND_FRACTION = 0.08` and the
  formula that uses it) and label it as a model, not a fact.
- Centralize range/frequency data in one file per concern
  (`preflopBaselines.ts`, `threebetBaselines.ts`, ...), never scattered
  literal arrays inside individual `LessonStep`s, except for genuinely
  one-off inline examples (`range_combos` on a single step) that no other
  step needs to reference.

## Process for auditing a shipped module

1. Read every lesson's full step array in one pass, lesson by lesson, in
   presentation order — not file-search for keywords. Leaks are almost
   always about *sequence* (what the learner already saw), which a keyword
   search can't detect.
2. For every step with `options`, ask: is the `perfect` option always in
   the same array position across many steps? If yes, that's a shuffle bug
   even if each individual question looks fine in isolation.
3. For every step with a live-computed display value, ask: could this same
   number be the target of a challenge question on this screen or a
   following one?
4. For every hand-authored data table with a "wider/narrower" or
   "before/after" relationship to another table, check subset/monotonicity
   by hand or with a quick script — don't assume authoring got it right.
5. Write the regression test *as you fix the bug*, not after — it's the
   only way the fix stays fixed once someone edits that lesson again.
