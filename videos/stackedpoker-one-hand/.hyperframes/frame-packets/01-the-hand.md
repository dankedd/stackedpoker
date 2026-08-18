# Frame packet: 01-the-hand

## Project inputs

- Project: C:\Users\manue\.antigravity\poker site\videos\stackedpoker-one-hand
- Design tokens: C:\Users\manue\.antigravity\poker site\videos\stackedpoker-one-hand\frame.md
- RULES_DIR: C:\Users\manue\.claude\skills\hyperframes-animation\rules

## Assigned storyboard block

## Frame 1 — The Hand

- type: hook
- status: outline
- duration: 5s
- transition_in: cut
- poster: 4s
- scene: Darkness. A lesson card fades in — Suited Aces, and A♠5♠ beneath it. Nothing else, nothing moves.
- voiceover: "Every great decision starts with understanding."
- blueprint: compose
- persuasion: Stillness as confidence
- beat: the hand
- focal: the two cards
- roles: assets/logo-8f556ecf.svg = supporting (spade pip inside the ace card)
- sfx: one soft paper swipe as each card settles, two total, very quiet; a low ambient pad swell under the spotlight. Nothing else.
- asset_candidates: assets/logo-8f556ecf.svg — spade
- src: compositions/frames/01-the-hand.html
- handoff_out: card at x660 y280 w600 h420, opacity 1, no transform. Cards A♠5♠ at 818–1102 × 470–656, opacity 1, no transform. Eyebrow "LESSON" and title "Suited Aces" at full opacity. Spotlight at its settled intensity. Everything static from 4.0s.

Compose: no blueprint fits a state whose payload is stillness. The brief asks for
elegance and reading time, not a reveal shape.

Scene 1 (0.0–1.0s): pure `bg #0C101D`. The violet spotlight blooms very slowly from
zero behind where the card will be, plus a soft blue ambient glow low in the frame.
A blueprint grid sits at ~3% opacity. Nothing else. No VO.

Scene 2 (1.0–2.2s): the lesson card **fades in** — opacity and a 12px rise, nothing
more. It does not scale up, it does not slide in from an edge. The eyebrow **LESSON**
and the title **Suited Aces** fade with it, one beat apart.

Scene 3 (2.2–3.2s): the two cards **A♠** and **5♠** settle in beneath the title, one
then the other, each on a long-tail settle with a soft paper swipe. They barely
rotate — a degree at most. VO line 1 runs across this.

Scene 4 (3.2–5.0s): **held.** Nothing enters, nothing moves, no drift, no jitter.
Almost two full seconds of a still frame so the viewer can read it. This stillness is
the film's opening argument and must not be filled.
