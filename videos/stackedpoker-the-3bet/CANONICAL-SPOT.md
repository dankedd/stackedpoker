# Canonical source of truth — do not paraphrase, do not round, do not "clean up"

Every poker fact in this film is copied from the StackedPoker codebase. Nothing here
was invented, adapted or simplified for marketing. If a value is not in this file, it
does not go on screen.

Verified with the project's own audit — `frontend/scripts/validate-scenarios.ts`:

```
Lessons audited:                  100
PreflopTable scenarios validated: 274
Issues found:                     0
Every PreflopTable-rendering scenario matches its authored data. ✓
```

---

## 1. The lesson

`frontend/lib/learn/curriculum.ts` — lesson block at L4713

| field | value |
| --- | --- |
| `id` | `the-3-bet` |
| `module_id` | `preflop-aggression-module` |
| `slug` | `the-3-bet` |
| `title` | **The 3-Bet** |
| `subtitle` | Learn why reraising preflop is about far more than having a premium hand. |
| `lesson_type` | `micro` |
| `estimated_min` | 11 |
| `xp_reward` | 140 |
| `concept_ids` | `three_bet`, `three_bet_motives`, `range_vs_range`, `opener_range_strength`, `players_behind_aggression` |

## 2. The scenario — step `tb-s6a`

`frontend/lib/learn/curriculum.ts` L4848

| field | value |
| --- | --- |
| `id` | `tb-s6a` |
| `type` | `decision_spot` |
| `concept_ids` | `range_vs_range`, `opener_range_strength`, `players_behind_aggression` |
| `narrative` | Cash game, 100bb effective. CO opens to 2.3bb. Only the blinds are left to act behind Hero. |
| `table_size` | 6 |
| `hero_position` | BTN |
| `villain_position` | CO |
| `effective_stack_bb` | 100 |
| `players_behind` | 2 |
| `action_before_hero` | `['UTG folds', 'HJ folds', 'CO raises to 2.3bb']` |
| `hero_hand` | `['As', '5s']` → **A♠ 5♠** |
| `range_reveal_direction` | `3bet` |
| `xp` | 10 |

**There is no `board`.** `scenarioValidator.ts` states that a `board` means postflop
framing and a different visualization path; table-rendering steps
(`decision_spot` / `table_decision`) have none. This spot is preflop. **Do not deal a
flop** — it would contradict the product's own data model.

## 3. The decision — the real options, in the real order

| option id | label | quality |
| --- | --- | --- |
| `3bet` | **3-Bet** | `perfect` |
| `call` | Call | `acceptable` |
| `fold` | Fold | `mistake` |

**The correct answer is 3-Bet.** Not chosen for visual convenience — it is the option
the lesson marks `quality: 'perfect'`.

Its authored feedback, verbatim:

> A5s is a strong candidate here: Hero has position on a somewhat wide CO open, only
> two players (the blinds) can wake up behind, and the Ace blocker plus suitedness
> give this hand good bluff/semi-bluff properties as part of a 3-betting range.

## 4. The range — canonical, resolved the way the product resolves it

`threebetRangeReveal.ts` builds the reveal; it "only RESOLVES data — it decides
nothing about the UI and invents no frequencies."

- matchup = `${hero_position}_vs_${villain_position}` = **`BTN_vs_CO`**
- `stackBBToWorld(100)` → `>= 60` → **`deep`**
- entries = `THREEBET_DEEP['BTN_vs_CO']`

`threebetBaselines.ts` L65 — *"ported from
`backend/app/ranges/preflop/cash_100bb/threebet_ranges.py`"*:

```
AA, KK, QQ, JJ, TT:0.4
AKs, AKo, AQs, AQo:0.5
KQs:0.5
A5s, A4s
65s:0.4, 54s:0.3
```

**14 entries. A suffix is a frequency; no suffix means 1.0.**
(An earlier draft of this file said 13 — a counting error in the prose, not in the
data. The list above has always held all fourteen: 5 + 4 + 1 + 2 + 2. Nine hands are
full-frequency, of which **A5s** is the hero cell, and five are partial.) So five hands are
partial — TT at 0.4, AQo at 0.5, KQs at 0.5, 65s at 0.4, 54s at 0.3 — and they must
render at a visibly lower weight than the full-frequency hands. Flattening them to a
binary range would misrepresent the product.

**A5s is in this range at full frequency**, which is the entire point of the film:
the same range holds AA and A5s.

Label and subtitle, generated verbatim by the resolver:

- `BTN 3-BET RANGE vs CO OPEN`
- `See where A5s sits in Hero's 3-betting frequency — calls and true folds aren't broken out separately here.`

`THREEBET_SEMANTICS = { kind: 'action_slice', action: '3bet' }` — this chart is Hero's
**3-bet frequency only**. Calls and true folds live in a separate, unmerged chart.
Never label it "strategy" or imply it is a complete defence range.

## 5. The theory — step `tb-s7`

`frontend/lib/learn/curriculum.ts` L4939 · `type: concept_reveal` ·
`concept_ids: three_bet, three_bet_motives, opener_range_strength`

**Concept title:** The 3-Bet Mental Model

**Concept content, verbatim:**

> A 3-bet asks three questions, in order:
> 1. WHAT DOES THE OPENER REPRESENT? — their position tells you the strength and width of their range.
> 2. HOW DOES MY HAND PERFORM AGAINST THAT RANGE? — not "is this hand strong," but "how does it do here."
> 3. DOES RAISING OUTPERFORM CALLING OR FOLDING? — a 3-bet has to win a three-way comparison, not just look reasonable on its own.

The film may shorten each question's dash-clause for the screen, but **the three
questions themselves and their order are fixed**, and no fourth may be added.

## 6. The AI Coach

Must reinforce this same decision and introduce no new topic. Its text is drawn from
the `3bet` option's own authored feedback (§3) — the product's words, not new prose.

## What may never appear

- Any hand other than A♠ and 5♠ as hero cards.
- A board / flop / turn / river.
- Any percentage, EV figure or range-width number — the frequencies above are rendered
  as **relative cell weight**, never printed as text.
- A different correct answer.
- A range not equal to the **14** entries above.
- Theory not drawn from this lesson. Revision 1 used `tb-s7`; revision 2 uses
  `tb-s3` (§7) and `tb-s5` (§8) instead — both are steps of the *same* lesson, so
  the rule is unchanged: nothing on screen comes from outside `the-3-bet`.

---

# Revision 2 — additional canonical sources

The revision brief asks for **one strong insight** rather than three generic bullets,
and for an AI Coach question tied to this scenario. Both are taken from other steps of
the **same lesson**, so nothing new is introduced.

## 7. Theory — step `tb-s3` (same lesson, same hand)

`curriculum.ts` L4789 · narrative: *"Hero holds A♠5♠. Scenario A: UTG opens. Scenario B:
BTN opens. Same Hero seat, same stack, same hand in both."*

Authored feedback, L4802 — the film's headline insight, **verbatim**:

> The opener's position is evidence about their range strength.

Its own continuation, which the film condenses for the explanation line:

> A5s (a blocker-heavy, speculative hand) gains far more value attacking a wide,
> marginal BTN open than a tight, premium-heavy UTG open.

This replaces the three questions of `tb-s7`. Both are real; this one is **specific to
A5s and to the opener's position**, which is exactly what `tb-s6a` turns on.

## 8. AI Coach — step `tb-s5` (same lesson)

`curriculum.ts` L4831 · narrative: *"HJ opens. Scenario A: Hero is in the CO. Scenario
B: Hero is on the BTN. Same HJ open in both."*

Authored feedback, L4843:

> It's the reverse — BTN only has the two blinds left to act, while CO still has BTN,
> SB and BB all live behind it. **Fewer players behind is part of why the Button is
> such a strong 3-betting seat.**

The coach answers **"Why from the Button?"** with that sentence, condensed. It
reinforces `tb-s6a`'s own reasoning — the scenario's narrative already says *"Only the
blinds are left to act behind Hero"* — and introduces no new topic.

## 9. Copy changes that are marketing, not poker

These are **framing**, and contain no poker claim, so they are free of the source rule:

- `DON'T MEMORISE THE HAND. UNDERSTAND THE RANGE.` — replaces the resolver's
  `See where A5s sits in Hero's 3-betting frequency.` on the range scene.
- `YOU HAVE A♠5♠.` / `WHAT DO YOU DO?` — the hook.
- `LEARN POKER.` / `BY PLAYING.` / `START LEARNING FREE` — the close.

The range **legend** names the two weights shown. It must say only what the data says:
the chart is Hero's 3-bet frequency (`THREEBET_SEMANTICS = action_slice / 3bet`), so
the legend reads **ALWAYS** and **PART OF THE TIME** — never a percentage, and never
"strategy", which would imply calls and folds are broken out. They are not.
