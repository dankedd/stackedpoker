# Frame packet: 02-the-decision

## Project inputs

- Project: C:\Users\manue\.antigravity\poker site\videos\stackedpoker-understand
- Design tokens: C:\Users\manue\.antigravity\poker site\videos\stackedpoker-understand\frame.md
- RULES_DIR: C:\Users\manue\.claude\skills\hyperframes-animation\rules

## Assigned storyboard block

## Frame 2 — The Decision

- type: feature_showcase
- status: outline
- duration: 5.5s
- transition_in: cut
- poster: 4.5s
- scene: The lesson interface builds around the cards — 6-max, position, pot, preflop — and three unselected actions
- voiceover: "Don't just learn the answer."
- blueprint: compose
- persuasion: The product asks before it tells
- focal: the three unpressed actions
- roles: assets/logo-8f556ecf.svg = supporting (spade pip)
- sfx: soft glass movement as the surface builds; three near-inaudible tactile ticks as the actions settle. No click — nothing is pressed.
- asset_candidates: assets/logo-8f556ecf.svg — spade
- src: compositions/frames/02-the-decision.html
- handoff_in: opens on Frame 1's exact end state — cards at 816–1104 × 470–656, headline lit, ground settled. **Nothing re-enters or re-fades at t=0.**
- handoff_out: glass surface at 460,250,1000,620. Cards unchanged at 816–1104 × 470–656. Context labels, seat ring, pot, hero label, question and three unpressed actions all at full opacity. Nothing selected. Static from 3.5s — a two-second hold.

**The cards must not move.** The interface assembles *around* them; that is the whole
point of this frame. If they shift, the film loses its spine.

Scene 1 (0.0–0.4s): the inherited state, completely static. This is the seam.

Scene 2 (0.4–1.6s): the headline **WHAT WOULD YOU DO?** fades out, and the glass
surface expands into existence behind the cards — from ~70% of its size to full,
centred on the cards, on one long ease. Soft glass movement. VO line 2 lands.

Scene 3 (1.6–2.6s): the lesson context resolves *around* the hand, quietly and all at
a low visual weight: a `.label` row reading **6-MAX · 100 BB EFFECTIVE** left and
**PREFLOP** right; a faint six-seat ellipse with the hero seat marked; **POT 6.5 BB**;
and **HERO · BB** beneath the cards. None of this competes with the hand.

Scene 4 (2.6–3.5s): the question **What would you do?** resolves below, then the three
actions — **FOLD · CALL · RAISE** — settle as one staggered set, each a glass pill.

Scene 5 (3.5–5.5s): **held for two full seconds.** Nothing is selected. No hover, no
highlight, no cursor, no timer, no hint, no correct answer. Nothing moves at all.
