# Frame packet: 02-the-spot

## Project inputs

- Project: C:\Users\manue\.antigravity\poker site\videos\stackedpoker-the-3bet
- Design tokens: C:\Users\manue\.antigravity\poker site\videos\stackedpoker-the-3bet\frame.md
- RULES_DIR: C:\Users\manue\.claude\skills\hyperframes-animation\rules

## Assigned storyboard block

## Frame 2 — The Spot

- type: feature_showcase
- status: outline
- duration: 5s
- transition_in: cut
- poster: 4s
- scene: The real StackedPoker table builds around the cards — positions, stacks, the action, the pot
- voiceover: none — the spot is read, not narrated
- blueprint: compose
- persuasion: This is the product, not an illustration of it
- focal: the table context
- roles: assets/logo-8f556ecf.svg = supporting (spade pip)
- sfx: u-glass at 0.55 (0.15); u-tick at 2.30 (0.09); u-tick at 2.62 (0.09); u-tick at 2.94 (0.10)
- asset_candidates: assets/logo-8f556ecf.svg — spade
- src: compositions/frames/02-the-spot.html
- handoff_in: opens on Frame 1's exact end state. **Nothing re-enters at t=0.**
- handoff_out: table glass at 360,170,1200,540, six seats, UTG/HJ folded, CO raiser at 2.3 BB, BTN hero, POT 3.8 BB, label row lit; cards unchanged. Static from 3.8s.

Scene 1 (0.0–0.4s): the inherited state, static. The seam.

Scene 2 (0.4–1.5s): both hook lines fade **in place** and the table glass expands into
existence behind the cards. **The cards do not move.**

Scene 3 (1.5–2.3s): the context resolves at low visual weight — `.label` row
**THE 3-BET · CASH 6-MAX · 100 BB EFFECTIVE** left, **PREFLOP** right; the six-seat
ellipse; every seat at **100 BB**; **BTN** marked hero.

Scene 4 (2.3–3.8s): the action plays in the lesson's own order — **UTG folds**,
**HJ folds** (both dim), then **CO raises to 2.3 BB**. **POT 3.8 BB** resolves last.
One tick per action, nothing louder.

Scene 5 (3.8–5.0s): **held.** The viewer reads the spot. Hierarchy: the hand first,
then position and action, then the pot.
