# Frame packet: 04-the-theory

## Project inputs

- Project: C:\Users\manue\.antigravity\poker site\videos\stackedpoker-the-3bet
- Design tokens: C:\Users\manue\.antigravity\poker site\videos\stackedpoker-the-3bet\frame.md
- RULES_DIR: C:\Users\manue\.claude\skills\hyperframes-animation\rules

## Assigned storyboard block

## Frame 4 — The Theory

- type: feature_showcase
- status: outline
- duration: 5.5s
- transition_in: cut
- poster: 4.5s
- scene: The range slides left and the lesson's own concept opens beside it — three questions, in order
- voiceover: "Understand the decision."
- blueprint: compose
- persuasion: The reasoning is the product
- focal: the three questions
- roles: assets/svg-8b90c9e1.svg = supporting (grid3x3)
- sfx: u-glass at 1.35 (0.15); u-tick at 2.6 (0.09); u-tick at 3.1 (0.09); u-tick at 3.6 (0.09)
- asset_candidates: assets/svg-8b90c9e1.svg — grid3x3
- src: compositions/frames/04-the-theory.html
- handoff_in: opens on Frame 3's exact end state. **Nothing re-enters at t=0.**
- handoff_out: cards+range translated −380px in x; the side panel open at 1000,300,580,460 with its title and all three questions lit. Static from 4.7s.

Scene 1 (0.0–0.3s): the inherited state, static. The seam.

Scene 2 (0.3–1.3s): the cards-and-grid group **slides left by 380px** as one object.
The frame does not pan; the surface moves.

Scene 3 (1.3–2.3s): the side panel opens at **1000,300,580,460**. A `.label` header
reads **CONCEPT**, and beneath it the lesson's own concept title, `.headline` 34px:
**The 3-Bet Mental Model**.

Scene 4 (2.3–4.7s): the three questions appear **one at a time**, in the lesson's
order, as `.body` 20px with a `.label` numeral before each:

> **1** What does the opener represent?
> **2** How does my hand perform against that range?
> **3** Does raising outperform calling or folding?

These are the lesson's own three questions, shortened only by dropping each one's
trailing dash-clause so they fit as three lines. **The questions and their order are
fixed and no fourth may be added.**

Scene 5 (4.7–5.5s): **held.**
