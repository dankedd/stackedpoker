# Frame packet: 01-the-spot

## Project inputs

- Project: C:\Users\manue\.antigravity\poker site\videos\stackedpoker-the-3bet
- Design tokens: C:\Users\manue\.antigravity\poker site\videos\stackedpoker-the-3bet\frame.md
- RULES_DIR: C:\Users\manue\.claude\skills\hyperframes-animation\rules

## Assigned storyboard block

## Frame 1 — The Spot

- type: hook
- status: outline
- duration: 6.5s
- transition_in: cut
- poster: 5s
- scene: A real StackedPoker decision builds out of darkness — 6-max, Hero on the button with A♠5♠, the cutoff has raised
- voiceover: "This is a real hand from a real lesson."
- blueprint: compose
- persuasion: This is the product, not an illustration of it
- focal: the two hero cards
- roles: assets/logo-8f556ecf.svg = supporting (spade pip)
- sfx: u-swell-long at 0.0 (0.16); u-card at 1.45 (0.22); u-card at 2.15 (0.20); u-glass at 2.9 (0.14)
- asset_candidates: assets/logo-8f556ecf.svg — spade
- src: compositions/frames/01-the-spot.html
- handoff_out: table glass at 360,170,1200,540 with all six seats, CO marked as raiser at 2.3 BB, UTG and HJ folded, BTN marked hero; cards at 816–1104 × 700–886; the lesson label and the question fully lit. Static from 4.6s.

Scene 1 (0.0–1.2s): near darkness — ground, blueprint grid, the one spotlight opening
from above. Nothing else.

Scene 2 (1.2–2.4s): **A♠** then **5♠** settle at 816–1104 × 700–886, one after the
other, on a long-tail settle with at most 1° of rotation.

Scene 3 (2.4–3.6s): the table builds **around** them — the glass surface, then the six
seats on the ring, then the readouts. The cards do not move. A `.label` at the top
left reads **THE 3-BET · CASH 6-MAX · 100 BB EFFECTIVE**; at the top right, **PREFLOP**.

Scene 4 (3.6–4.6s): the action resolves, in the order the lesson authored it —
**UTG folds**, **HJ folds** (both seats dim to `.folded`), then **CO raises to 2.3 BB**
(the CO seat takes `.raiser` and its bet appears). The pot reads **POT 3.8 BB** —
the sum the canonical action forces: 2.3 + 1.0 + 0.5. Then the question,
`.display` 56px, low and centred: **WHAT WOULD YOU DO?**

Scene 5 (4.6–6.5s): **held.** Nothing moves. The viewer is meant to actually decide.
