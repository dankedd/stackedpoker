# Poker Hand Analyzer

Public, free, no account: `/tools/poker-hand-analyzer`.

## The one rule

Three tiers, never mixed, and the types enforce the separation:

| Tier | Where it comes from | Can it be wrong? |
| --- | --- | --- |
| **Facts** | Restated from the input | Only if the user mistyped |
| **Calculations** | `lib/theory/math.ts`, `lib/tools/equity.ts`, `lib/tools/handEvaluator.ts`, `lib/learn/flopClassifier.ts` | No — each records the formula in `basis` |
| **Concepts** | Quoted verbatim from `lib/theory/concepts.json` | No — detection picks *which*, never writes the words |

Nothing else is produced. No ranges, no frequencies, no EV figures, no solver
output. A verdict is emitted **only** where arithmetic settles the question,
which in practice means both hands are known and a price exists. Everywhere
else the verdict is `needs-review`, and `unknowns` says exactly what could not
be determined and why.

## The theory boundary

**Can calculate** — exact equity against a known hand; exact equity against a
**reviewed** range; the pot price; required equity; MDF; alpha; which of a
range's combos are still legal after card removal; every remaining runout.

**Cannot infer** — villain's actual range; a GTO range; an optimal frequency;
solver output; EV (no EV model is implemented, so the words are never used).

**A selected range is an assumption, not a fact.** Everything computed from one
is conditional on it, and says so in the verdict value itself
(`profitable-against-the-range`), in the prose, in the clipboard copy, in the
saved row and in the AI Coach payload.

## Ranges

Three states, and they never blur (§9):

| | villain's hand | result |
| --- | --- | --- |
| **A** | known | exact, unconditional |
| **B** | unknown + reviewed range selected | exact, **conditional** on that range |
| **C** | unknown, no reviewed range fits | `needs-review` |

A always beats B: a range is never offered for a hand we can see.

### What makes a range executable

`rangeSource.ts` maps the existing `ChartProvenance.derivation` vocabulary onto
one gate. `exact_transcription`, `exact_derived` and `reconstructed` are
**reviewed** and may drive a calculation. `pedagogical_model` is
**illustrative** and never can.

That is why most of the repo's range data is *not* here. `THREEBET_RESPONSE_CHARTS`
and `DEFEND_RESPONSE_CHARTS` are built by spreading a book aggregate across hands
the book never names — their own headers say so. `RFI_DEEP`, `THREEBET_*`,
`DEFEND_*` and `ranges.ts` come from backend files documented as "simplified
practical ranges, not solver-exact". All excellent teaching material; none of it
a measurement.

`MTT_RFI_CHARTS` **is** reviewed and is still excluded — on context, not
provenance: 9-max MTT with a 12.5% ante is a different game from the 6-max cash
spot the analyser models. Context filtering (`matchPreset`) is a separate gate
from source status, and both must pass.

### The 12 presets

Sliced from two datasets, both read out of the book's own chart images and
cross-validated against the aggregate printed beneath them:

- **BB defence, 100bb** (`BB_DEFENSE_COMPLETE_100BB`) — MPT Ch.5 pp.237–249,
  Hand Ranges 76–84. Five matchups × called / 3-bet.
- **BTN vs CO open** (`CASH_100BB_OPEN_RESPONSE_CHARTS`) — MPT Ch.5 Hand Range
  66, p.228. Called / 3-bet.

Each preset is one action's column from a complete strategy, hands weighted by
the frequency the source records. A build gate re-derives each slice's
combo-weighted total and fails if it drifts more than 1.5pp from the aggregate
its own source prints.

### Why preflop range equity is refused

Cost is (boards for the street) × (legal combos). On a flop that is 990 × a few
hundred — measured at 68–183 ms. Turn and river are trivial. Preflop it is
1,712,304 boards per combo, which runs to minutes. Monte Carlo would make it
fast by making it inexact, so it is declined and the reason is shown, rather
than approximated silently.

## The files

| File | Job |
| --- | --- |
| `types.ts` | The data model, including the three input states and the key-decision shape |
| `validate.ts` | Impossible vs unfinished — `classifyInput` is the source of the UI's whole state distinction |
| `completeness.ts` | What is missing, what it unlocks, and which unknowns a field would close |
| `analyze.ts` | The engine. `analyseHand` for the UI (returns a state), `analyzeHand` for callers that know the input is valid (throws) |
| `parse.ts` | PokerStars / GGPoker / generic text histories. Returns `partial` + `parsed` + `undetermined` — never all-or-nothing |
| `rangeSource.ts` | The one gate: which provenance counts as reviewed |
| `rangePresets.ts` | The 12 presets, sliced from existing charts, plus context filtering |
| `rangeEquity.ts` | Exact hero-vs-range equity over legal combos |
| `coachContext.ts` | The AI Coach handoff and the URL round trip |
| `recommendations.ts` | Concept → lesson/wiki/glossary/tool, ranked, resolved on the server |
| `savedHands.ts` | Reuses the existing `hand_analyses` table. No migration |

## What it can determine

- Everything about what happened, restated from the input.
- The price: required equity, MDF, alpha — whenever a bet and a pot are both entered.
- The made hand and the flop texture, once there is a board.
- Stack-to-pot ratio, when the effective stack is entered.
- **Exact** equity, when both hands are known — every remaining runout counted, not sampled.
- **Exact** equity against a reviewed range, postflop — every legal combo, every remaining runout.
- A decisive verdict, when exact equity and a price are both available; a clearly-labelled conditional one when the equity came from a range.
- Which reviewed concepts the spot exercises, and the lesson that drills each.

## What it deliberately cannot

- Villain's ACTUAL range. Selecting a published chart is not inferring what this opponent does; the analyser says so every time one is used.
- Equity against a range for a spot no reviewed chart covers, or preflop.
- Optimal frequencies, GTO ranges, EV figures.
- Multiway pots as multiway: the equity maths is heads-up, and a multiway hand is analysed hero-vs-field.
- Table sizes other than 6-max in a pasted history — the seat map would mislabel every position, so positions come back undetermined instead.

## Future opportunity: screenshot / image input

**Not built, and deliberately out of scope for now.** Recording the assessment
so the next person does not have to redo it.

The architecture would support it cleanly, because nothing above depends on
where a `HandInput` came from:

- `parse.ts` is already the only text-shaped seam. An image path would be a
  sibling module producing the same `ParseResult` — `partial` + `parsed` +
  `undetermined` — and every downstream surface would work unchanged.
- The partial-parse UX built for §6 is exactly what OCR needs: vision models
  misread suits and stack sizes far more often than they miss a whole board, so
  "here is what was read, here is what you should check" is the right shape
  already.
- Confidence would need one addition. A parsed card from text is certain; a
  card read off a screenshot is not, and the `Calculation.confidence` field
  does not currently propagate from input certainty. Shipping image input
  without that would let an OCR mistake produce a `high` confidence verdict —
  the one failure mode this tool is built to avoid.

What it would need that does not exist yet: a vision call (so a backend route
and a cost per analysis, which changes the anonymous-free promise), site-specific
table layout handling, and the confidence propagation above. The first of those
is a product decision, not an engineering one.
