---
workflow: product-launch-video
flow: automation
storyboard: no
message: "One hand becomes a complete learning journey"
destination: website
aspect: 1920x1080
language: en
audience: "Poker players evaluating how a platform actually teaches — not what features it has"
length: 30s
angle: Demo Loop
---

## Intent

A premium 30-second commercial. **Not** a feature showcase, **not** a product demo,
**not** a montage. The register is an Apple launch film or a Linear product
commercial.

The objective is one sentence: **show how one poker hand becomes a complete
learning journey.** The viewer should finish thinking *"I finally understand how
this platform teaches poker"* — never *"this app has a lot of features."*

Core message: **Learn Poker By Playing.** Every decision becomes a learning
experience.

## The structural consequence of the brief

Two of the user's mandatory rules decide the build:

> *"The camera should almost never leave the lesson. The lesson itself transforms."*
> *"Every transition should be a smooth morph."*

So this film is **one continuous lesson surface that changes state six times** —
not six scenes joined by transitions. There are no crossfades, no wipes, no cuts
that the viewer can perceive.

It is authored as six frame files for the pipeline's sake (voice-over and SFX are
keyed per frame), but every boundary is a **hard cut between two numerically
identical frozen states**, declared as explicit handoffs. A cut between two
identical frames is invisible. All morphing happens *inside* a frame.

This is a deliberate departure from the two previous films, which used injected
crossfades between independent frames. Crossfading here would break rule 5.

## The six states — one idea each, never combined

Everything revolves around **one hand: A♠5♠.** No second hand is ever introduced.

1. **0:00–0:05 · The hand.** Darkness. A lesson card fades in. No movement.
   Title **Suited Aces**, and beneath it A♠5♠. Nothing else. The viewer reads.
   VO: *"Every great decision starts with understanding."*
2. **0:05–0:10 · Theory.** Without cutting, the same card **grows**. A theory block
   expands beneath the cards. As the sentence appears, the Ace pips inside the cards
   receive a subtle glow. Nothing else animates. Pause.
   VO: *"First, understand the concept."*
3. **0:10–0:16 · Decision.** The theory collapses upward and the card becomes a
   decision exercise: BTN opens, hero A♠5♠, *What would you do?*, Fold / Call /
   3-Bet. **No answer is selected**, and the state holds at least four seconds.
   VO: *"Then make the decision."*
4. **0:16–0:22 · Range.** The buttons fade and a 13×13 range grid resolves in the
   same card. **A5s glows first, alone. Pause.** Then the surrounding bluff
   combinations softly illuminate.
   VO: *"Learn the range, not just the hand."*
5. **0:22–0:27 · Explanation.** The range slides slightly left; a compact AI Coach
   panel opens on the right with **one** explanation — never a chat thread.
   Emphasis falls on *blocks*, *strong Ax*, *playability*.
   VO: *"Finally, understand why."*
6. **0:27–0:30 · Close.** Everything fades but A♠5♠. Then the mark, **Learn Poker /
   By Playing.**, and **Start Free**. Perfectly still. No final animation.
   VO: *"StackedPoker. Learn poker by playing."*

## Poker theory provenance

`CLAUDE.md` requires poker theory to be checked against `docs/Modern Poker Theory.pdf`
before implementation. It was, via the extracted `docs/mpt_fulltext.txt`.

**Consulted:** the preflop 3-bet / 4-bet / 5-bet range chapter, around pages 231–234,
including Hand Range 73 (SB vs CO 4-bet).

- *"you can 4-bet a polarized range, opting to bluff with hands that have good
  blockers, such A5s"* (p. ~231)
- *"we see a 5-betting range include some non-premium hands as bluffs such as ATs and
  A5s… ATs and A5s are the highest equity bluff hands against very strong ranges"*
  (p. 233)
- *"…while retaining good post-flop playability"* (p. 233) — nearly the user's own
  wording
- *"your frequent bluffs are A5s-A3s, AQo-ATo, some suited Kx"* — supports A5s as a
  3-bet bluff, which is the Scene 3 spot

**Classification: source reconstruction, not exact transcription.** The on-screen
sentences are the user's own copy; the book independently supports every claim in
them. No frequency, EV figure or solver output is stated as fact anywhere in the
film, and the range grid is a **visual model**, not a transcribed solver range.

## Assets

- `capture/` and `frame.md` — copied from `videos/stackedpoker-launch`. The design
  spec's colour roles were corrected by hand after `build-frame.mjs` inverted the
  polarity; do not regenerate it.
- `assets/logo-8f556ecf.svg` — the lucide spade. **There is no bespoke logo file**;
  the mark is that glyph beside "StackedPoker" in Geist.

## Customizations

- **No captions.** Established on the previous film and correct for this register.
- **Music: one calm piece, no rhythm section at all.** Soft piano, deep synth pad,
  very subtle pulse. Unlike the previous film there is **no build and no drums** —
  the brief says the music supports and never dominates. It must run ≥30s without a
  perceptible loop.
- **BGM level 0.30, not the 0.12 default.** At 0.12 the bed measured ~-34 dB in the
  previous render and was inaudible under a film that is mostly silence.
- **Six named SFX cues only:** paper swipe (card movement), synth tick (hover),
  tactile click (selection), airy whoosh (transition), soft shimmer (range reveal),
  glass slide (coach panel). Nothing that sounds like gambling.
- **Voice:** William Prescott (HeyGen), carried across all three films. Direction
  this time is slower and quieter still — near-whispered, Apple-narrator.
- **VO_MODE: verbatim.** 30 words total.

## Notes — the absolute exclusions

The brief lists these as forbidden and they are treated as hard constraints:
dashboard, XP, achievements, leaderboard, bankroll, modules, pricing, settings,
statistics, progress bars, notifications, popups, badges, confetti, fireworks,
particles, complex camera moves, feature lists, marketing buzzwords.

Also excluded: casino aesthetics, chips, money, players, casino tables, any gambling
imagery. Only product UI.

Two of the previous films' own habits are forbidden here as a result — **no dashboard
frame and no achievement beat.** Neither may reappear.
