# Frame packet: 06-the-coach

## Project inputs

- Project: C:\Users\manue\.antigravity\poker site\videos\stackedpoker-the-3bet
- Design tokens: C:\Users\manue\.antigravity\poker site\videos\stackedpoker-the-3bet\frame.md
- RULES_DIR: C:\Users\manue\.claude\skills\hyperframes-animation\rules

## Assigned storyboard block

## Frame 6 — The AI Coach

- type: feature_showcase
- status: outline
- duration: 3s
- transition_in: cut
- poster: 2.4s
- scene: The same panel becomes the AI Coach — one question, one answer, the same decision
- voiceover: "Still wondering? Ask your coach."
- blueprint: compose
- persuasion: You do not just get the answer — you can ask why
- focal: the question and its answer
- roles: assets/svg-a146683f.svg = supporting (bot, coach identity)
- sfx: u-glass at 0.20 (0.14); u-tick at 1.35 (0.09)
- asset_candidates: assets/svg-a146683f.svg — bot
- src: compositions/frames/06-the-coach.html
- handoff_in: opens on Frame 5's exact end state. **Nothing re-enters at t=0.**
- handoff_out: range unchanged; the panel showing the coach header, the question and its answer. Static from 2.5s.

Scene 1 (0.0–0.2s): the inherited state, static. The seam.

Scene 2 (0.2–0.9s): **the same panel becomes the coach** — `WHY?` crossfades to a small
bot mark plus **AI COACH**; the insight and explanation fade out in place. The panel
does not move, resize or re-enter. **Not a chat:** no thread, no bubbles, no input box,
no send button, no typing dots.

Scene 3 (0.9–1.5s): the question resolves, `.body` 19px in white, as a learner would ask
it: **Why from the Button?**

Scene 4 (1.5–2.5s): the answer resolves beneath it, `.body` 19px, condensed from the
lesson's own step `tb-s5`:

> Only the SB and BB are left to act. Fewer players behind is part of why the Button is
> such a strong 3-betting seat.

**only the SB and BB** lifts to white weight 600.

Scene 5 (2.5–3.0s): held.
