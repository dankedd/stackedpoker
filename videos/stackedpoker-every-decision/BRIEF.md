---
workflow: product-launch-video
flow: automation
storyboard: no
message: "Every decision becomes a lesson — the answer isn't the point, understanding is"
destination: website
aspect: 1920x1080
language: en
audience: "Poker players who already play but plateaued — they want to understand, not memorise"
length: 30s
angle: Demo Loop
---

## Intent

**"Every Decision"** — a 30-second product film for StackedPoker in the register of
Apple, Linear, Nothing and Arc. Calm, spacious, no fast cutting. The film sells a
way of learning, not a feature list: it never says "12 modules", "68 exercises" or
even "AI Coach" out loud.

The governing discipline is the user's own: **show, don't tell.** Voice-over is
capped at **34 words across the whole film** — counted, not estimated — so the
interface carries the story and the silences do the selling.

This is the second film in the same brand system. It reuses the corrected
`frame.md`, the site capture, the Geist fonts and the staged icons from
`videos/stackedpoker-launch`, so nothing is re-derived and the hand-fixed
midnight/violet polarity cannot regress.

## Structure — five frames, not six

The brief lists six beats. Beats 1 and 2 are merged into **one 7-second frame**:
the script says the camera zooms out *from* the three cards *to* the full decision
card, which is a single continuous move. Cutting at 0:03 would break the move in
half — the exact failure the previous film's Frame 5 was rebuilt to avoid. Both
voice-over lines live inside that one frame.

1. **0:00–0:07 The Question** — black, a soft spotlight, then Q♠ · 7♦ · 2♣ arriving
   one at a time. No explanation. One continuous decelerating pull-back reveals the
   whole decision card: hero to act, Fold / Call / Raise.
   VO: *"Every poker player faces the same question."* → *"What would you do?"*
2. **0:07–0:12 Because the Answer Isn't Enough** — a click. No "Correct!", no green
   check. Instead, quietly: **Let's understand why.** The Coach slides open — not a
   chat, an explanation — and a range lights up.
   VO: *"Because the answer isn't enough."*
3. **0:12–0:18 Understanding** — range trainer → board builder → decision spot →
   lesson → achievement → dashboard. Each handoff reads as the UI morphing into the
   UI, never as a cut.
   VO: *"Understanding is what makes you better."*
4. **0:18–0:24 One Place** — the camera pulls further out and the whole environment
   floats in one spatial composition: modules, progress, XP, coach, bankroll.
   VO: *"One place to learn, train and improve."*
5. **0:24–0:30 Learn Poker. By Playing.** — everything fades but the MacBook.
   Midnight ground, a subtle glow, the mark. **Learn Poker** — pause — **By Playing.**
   CTA: **Start Free**.
   VO: *"StackedPoker."* → *"Learn poker by playing."*

The widening is a deliberate motif: the film pulls back at 0:03 and again at 0:18.
Two zoom-outs is not repetition here — it is the structure of the argument, moving
from one card to one decision to one environment.

## Assets

- `capture/` — copied from `videos/stackedpoker-launch`; the live stackedpokerai.com
  capture, still current. Not re-captured.
- `frame.md` — copied from the same project. Its colour roles were corrected by hand
  after `build-frame.mjs` inverted the polarity; do not regenerate it.
- `assets/logo-8f556ecf.svg` — the lucide spade. **There is no bespoke logo file**;
  the real mark is that glyph beside "StackedPoker" in Geist.
- Real figures available from the capture if a surface needs them: Level 12 ·
  8.420 XP · 14 day streak · 11 badges · 12 of 29 modules live.

## Customizations

- **No burned-in captions.** Confirmed by the user: Apple, Linear, Nothing and Arc
  never caption their product films, and 34 words of narration do not need a text
  track. The caption keep-out band is still respected so a vertical cut can add them
  later without re-layout.
- **The music is an arrangement, not a loop.** Two retrieved parts: a restrained
  piano + deep synth pad bed for 0:00–0:20, then a second part carrying rhythm for
  0:20–0:30, joined by a subtle riser. **No drums before 0:20.** This directly
  answers the previous film's weakness, where a 10-second library track looped six
  times across 60 seconds.
- **Voice:** William Prescott (HeyGen), the voice confirmed on the previous film —
  calm, low, unhurried. Keynote register, never a sales voice.
- **VO_MODE: verbatim.** The seven lines are used exactly as written.
- **No green check, no "Correct!"** anywhere in frame 2. That absence is the idea.

## Notes

- Style references: Apple, Linear, Nothing, Arc Browser. Landscape product films.
- Pace: calm, lots of air, no fast social-cut editing anywhere.
- Colour discipline carries over: ~95% midnight `#0C101D`, violet as scarce voltage.
- Motion law carries over: long-tail `power3`, smooth over bouncy, everything floats.
- Never: casino imagery, stock footage, shadows, drifting decoration, green success
  states, exclamation marks.
- The previous film's 9:16 vertical cut is still an open deliverable and is not part
  of this brief.
