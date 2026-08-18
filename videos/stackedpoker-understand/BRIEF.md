---
workflow: product-launch-video
flow: automation
storyboard: no
message: "One poker hand becomes a complete learning experience"
destination: website
aspect: 1920x1080
language: en
audience: "Poker players deciding whether a platform actually teaches, or just tells them answers"
length: 30s
angle: Demo Loop
---

## Intent

A premium 30-second StackedPoker commercial that sells exactly one idea:
**StackedPoker teaches you to understand poker decisions.** One hand becomes a
complete learning experience along a single spine —
**theory → decision → range → understanding → AI coach.**

Not a feature montage. Not a product demo. The viewer should finish thinking
*"that isn't just another poker course — it's a different way to learn poker."*

The user's hard pacing rule governs everything: the previous ads felt too fast.
Fewer scenes, longer holds, slower movement, more negative space. Restraint is what
makes it read as expensive.

## Reference analysis — `Launch SaaS-Ai video for NeuroFlow.mp4`

Inspected directly. **20.06s · 848×464 · 30fps · 598 frames · AAC stereo.**

Scene-change detection found cuts at only **6.97s, 9.03s and 13.07s** — four scenes
across twenty seconds, and nothing at all above a 0.30 threshold. The piece is
almost entirely continuous movement.

Design principles extracted (the language, never the content):

| Principle | What the reference does |
| --- | --- |
| Light | One dominant source; a large soft glow from behind/below; everything else dark |
| Depth | The app window floats tilted in 3D, backlit, with satellite glass panels at other depths |
| Background layer | An enormous blurred wordmark sits *behind* the UI as a parallax plane |
| System moment | Concentric rings with icon nodes orbiting a two-word headline |
| Typography | Extremely sparse — one headline per scene, often two words, generous tracking |
| Rhythm | ~5s per scene, long holds, no fast cutting anywhere |
| Close | Mark + wordmark + one-line tagline over a horizon glow, enormous negative space |

**Not** carried over: NeuraFlow's branding, its cyan-dominant palette, its sparkle
glyph, its chat UI, its "New Updates" copy, its device mockups.

## Structure — seven states, one continuous world

Built the way the previous film proved out: **no injected transitions.** Every frame
boundary is a hard cut between two numerically identical frozen states, so all
morphing happens inside a frame and the film reads as one environment. The camera
moves slowly or holds; it never cuts to an unrelated view.

1. **0:00–5:00 The Question** — darkness, the blueprint grid resolves, one violet-blue
   spotlight opens from above, and A♠5♠ emerge as physical objects.
   Headline **WHAT WOULD YOU DO?** VO: *"Every poker decision starts with a question.
   What would you do?"*
2. **5:00–10:30 The Decision** — the cards do not disappear. The lesson interface
   builds *around* them: 6-max, hero, position, pot, board. FOLD / CALL / RAISE, with
   **nothing selected**, held long enough to actually decide.
   VO: *"Don't just learn the answer."*
3. **10:30–15:00 Start With Why** — the decision surface transforms into a compact
   glass theory card. Headline **START WITH WHY.** VO: *"Understand why."*
4. **15:00–20:30 Think In Ranges** — the theory card becomes a 13×13 range grid with
   A5s clearly lit. Headline **THINK IN RANGES.**, with RANGES in the brand gradient.
   VO: *"Think in ranges."*
5. **20:30–24:30 The Coach** — a compact AI Coach panel opens beside the grid with one
   concise explanation. Not a chat thread. VO: *"Build better decisions."*
6. **24:30–27:00 The Method** — the camera pulls back and the elements coexist:
   the hand, the theory, the decision, the range, the coach. Four restrained words.
   No VO.
7. **27:00–30:00 Brand** — the final frame: spade mark, wordmark, **Learn Poker. /
   By Playing.**, and **Start Free**. Held still.
   VO: *"StackedPoker. Learn poker by playing."*

## The hero hand

**A♠5♠ and nothing else, in every state.** No second hand, no other hero combo, no
board card that competes with it. It is the visual thread from the first second to
the last.

## Poker theory provenance

`CLAUDE.md` requires poker theory to be verified against `docs/Modern Poker Theory.pdf`.
It was, via `docs/mpt_fulltext.txt` — the preflop 3-bet/4-bet/5-bet chapter,
pp. ~231–234 including Hand Range 73:

- *"you can 4-bet a polarized range, opting to bluff with hands that have good
  blockers, such A5s"* (p. ~231)
- *"ATs and A5s are the highest equity bluff hands against very strong ranges"* (p. 233)
- *"…while retaining good post-flop playability"* (p. 233)
- *"your frequent bluffs are A5s-A3s, AQo-ATo, some suited Kx"* — A5s as a 3-bet bluff

**Classification: source reconstruction.** The on-screen sentences are plain-language
statements of what the book establishes. **No frequency, percentage, EV number or
solver output appears anywhere in the film**, and the 13×13 grid is a visual model of
a range, not a transcribed solution.

## Assets

- `capture/` — the stackedpokerai.com capture, reused for the Geist font files only.
- `frame.md` — **written fresh for this film** from the brief's mandated palette. It
  does NOT inherit the earlier films' `#8B5CF6`/`#0C101D` spec.
- `assets/logo-8f556ecf.svg` — the lucide spade. There is no bespoke logo file; the
  mark is that glyph in a gradient rounded square beside the wordmark.

## Customizations

- **No captions.** Consistent with the register and the two previous films.
- **Music:** minimal cinematic, near-silent opening, soft atmospheric pad, very subtle
  pulse, a slight lift at the range reveal, resolution under the coach, one minimal
  note at the CTA. **No drums, no EDM, no trailer music.** Dynamic range must be
  controlled — the previous film's raw track peaked at −0.3 dB against a −17.8 dB mean
  and its quiet passages vanished at −40 dB in the render.
- **Six SFX families only:** soft card movement, soft glass movement, quiet tactile
  click, subtle shimmer on the range, soft spatial slide for the coach, one very
  subtle tonal accent on the logo.
- **Voice:** calm, intelligent, understated, modern. Never salesy or excited.
- **VO_MODE: verbatim** — the brief's proposed script, 29 words.

## Notes — hard exclusions

Never shown: session analysis, replay, unfinished Analyze or Practice, AI study plans,
personal training plans, roadmap features, fake dashboards. **No XP, achievements,
leaderboard, bankroll, modules, progress bars, badges, notifications or gamification
of any kind** — the previous two films both leaned on a dashboard beat and it is
forbidden here.

No timer, no flashing buttons, no correct-answer reveal in the decision scene.

Camera: slow push, slow pull-back, subtle lateral drift and parallax only. No whip
pan, shake, rapid zoom, spin or glitch. Transitions: morph, crossfade within a frame,
depth and scale. No wipes, flashes, particle bursts or camera spins.
