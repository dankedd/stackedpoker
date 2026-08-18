---
workflow: product-launch-video
flow: automation
storyboard: yes
message: "This is what learning poker should look like — you decide first, then you understand why"
destination: website
aspect: 1920x1080
language: en
audience: "Poker players who already play but plateaued — they've watched the training videos and still freeze on real decisions"
length: 60s
angle: PAS
---

## Intent

A premium product film for **StackedPoker**, in the register of an Apple product
video crossed with the tension of a real poker decision. The product is the hero:
no stock footage, no casino table, no players in sunglasses. Nine scenes, 60
seconds, built on the PAS arc — the viewer is put in front of a decision in the
first second, feels the pain of how poker is normally taught, and then sees the
alternative.

The film does not sell "12 modules" or "68 exercises". It sells a feeling:
*this is how learning poker should look.* The viewer is never a passive
consumer — from second one he is the one who has to act.

Tone: calm, confident, cinematic. Restrained voice-over, lots of air, nothing
shouted.

## Scene plan (user's own script — the spine of the storyboard)

1. **0–4s The Question** — black; a soft violet spotlight; a decision card rises
   out of the dark. Flop Q♠ 7♦ 2♣, hero to act. Fold / Call / Raise appear.
   Nothing is clicked. Silence. VO: *"What would you do?"*
2. **4–9s Everyone Knows This Feeling** — quick cuts: a player clicks Call, the
   screen freezes, red outline. A second picks Raise — also wrong. A third folds.
   Doubt. VO: *"Every poker session is a series of decisions."*
3. **9–16s Traditional Learning** — a giant stack of videos, PDFs, charts, notes
   piling up until the screen is full. VO: *"Most players spend hours
   watching..."* Everything blurs out.
4. **16–20s Transition** — the stack implodes; a minimalist StackedPoker
   interface appears. Calm. White space. VO: *"We believe there's a better way."*
5. **20–32s Interactive Learning** — music builds. Decision spot → range grid →
   board builder → drag & drop → multiple choice → hand reading → EV tree →
   position trainer. Flowing, never chaotic. VO: *"Learn by making real
   decisions."*
6. **32–39s AI Coach** — the user picks an answer, analysis appears, then the AI
   Coach slides open — as a coach, not a chatbot. *"Your reasoning wasn't
   wrong..."* → *"But villain's range changes everything."* The explanation
   animates: ranges highlight, board highlights, stack highlights.
   VO: *"Understand why."*
7. **39–47s Progress** — camera pulls back to the dashboard. XP rises,
   achievement unlocked, new module, streak, leaderboard, bankroll — all flowing
   into one another. VO: *"Track every step of your journey."*
8. **47–55s Scale** — only now do you see how much is in it. The modules appear,
   and more behind them, as a roadmap. VO: *"From your first hand to advanced
   strategy."*
9. **55–60s Hero Shot** — slow camera. MacBook, iPad, phone, all three showing
   the same premium interface. Midnight blue, violet spotlight, logo. Headline:
   **Learn Poker** — pause — **By Playing.** CTA: **Start Free**.

## Assets

- `frontend/app/globals.css` — the real brand foundation; the file's own comment
  calls it a "Marketing homepage: midnight/frosted-glass system using
  StackedPoker's own violet/blue foundation". This is brand truth for `frame.md`.
- `frontend/tailwind.config.ts` — brand tokens (color scale, fonts).
- `frontend/app/icon.png`, `frontend/app/apple-icon.png` — logo marks for the
  hero shot.
- Live local Next.js app — the source of every captured screen. Real components
  behind the script's shots: `PokerRangeGrid`, `EVDecisionTree`, `PositionTable`,
  `BoardSortingPuzzle`, `LessonCoachDrawer`, `RangeXRay`, and the `/dashboard`,
  `/leaderboard`, `/bankroll`, `/learn/journey` routes.

## Customizations

- **UI source is a mix, confirmed by the user.** Capture the real running app for
  authenticity, but rebuild the moments that must move — decision card, range
  grid highlights, AI Coach drawer, XP counter — as live HTML layers so their
  elements can animate independently. Captured screens are the fidelity
  reference; the rebuilt layers carry the motion.
- **Scene 5 is one continuous camera move, not eight cuts.** The eight features
  lie side by side on a single spatial plane; the camera glides past them in one
  slow parallax move with no cut. This resolves the conflict between the script's
  eight 1.5s shots and the film's "everything floats, heavy easing" motion law.
  Confirmed by the user over both alternatives.
- **Full audio generated in-project:** TTS voice-over (calm, low, English), a
  music bed in the WWDC / Linear / Arc register — slow electronic pulses,
  subtle bass, lots of space — and a complete SFX layer: click tick, soft card
  swipe, hover synth, achievement shimmer. Explicitly **no casino sounds**, no
  EDM, no rock. The user hears a pass before anything renders.
- **Scene 4 implosion is a targeted GSAP implosion**, not a WebGL shader wipe.
  The stack collapses toward the centre and disappears through a light flash.
  The user declined the shader challenger on render-cost grounds.
- **Design spec comes from the app's real tokens**, not from a preset's own
  palette. The preset supplies layout bones only; `globals.css` and
  `tailwind.config.ts` supply colour and type.

## Notes

- Colour discipline: ~95% midnight blue, ~5% gradient. Never busy.
- Motion law: everything floats. No hard animations, heavy easing, everything
  rises softly, cards barely rotate, lots of parallax.
- Music references: Apple WWDC, Linear launch, Arc Browser. Not EDM, not rock.
- Sound design is treated as a first-class deliverable, not a garnish.
- Voice-over lines are used **verbatim** as written in the script above
  (`VO_MODE: verbatim`) — inferred, since the lines read as finished copy.
  Restructuring is available on request.
- Brand name is **StackedPoker**, confirmed against `app/layout.tsx` and the
  marketing copy across the site.
- A **9:16 version for Reels / TikTok is a follow-up deliverable**, laid out from
  scratch rather than cropped — the range grids, EV trees and dashboards in
  scenes 5, 7 and 8 become unreadable under a centre crop.
- Destination covers website hero, YouTube, and Meta Ads in 16:9; the vertical
  cut serves Reels and TikTok.
