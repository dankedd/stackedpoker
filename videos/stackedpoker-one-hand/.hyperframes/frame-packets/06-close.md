# Frame packet: 06-close

## Project inputs

- Project: C:\Users\manue\.antigravity\poker site\videos\stackedpoker-one-hand
- Design tokens: C:\Users\manue\.antigravity\poker site\videos\stackedpoker-one-hand\frame.md
- RULES_DIR: C:\Users\manue\.claude\skills\hyperframes-animation\rules

## Assigned storyboard block

## Frame 6 — Close

- type: cta
- status: outline
- duration: 3s
- transition_in: cut
- poster: 2.4s
- scene: Everything fades but A♠5♠; the mark, the headline and Start Free resolve, and the film stops
- voiceover: "StackedPoker. Learn poker by playing."
- blueprint: logo-assemble-lockup (Adapt)
- persuasion: The ask, made quietly
- beat: close
- focal: the two cards, then the lockup
- roles: assets/logo-8f556ecf.svg = cutout (the brand mark) · assets/favicon.ico = supporting
- sfx: one long gentle airy whoosh as everything clears; a single warm low resolve under the lockup. Nothing on the CTA.
- asset_candidates: assets/logo-8f556ecf.svg — spade, the brand mark; assets/favicon.ico — favicon
- src: compositions/frames/06-close.html
- handoff_in: opens on Frame 5's exact end state — lesson card at x300 y230 w860 h660 with the grid lit, coach panel open at x1210 y330 w470 h460. **Nothing re-enters at t=0.**

Adapt: keep the signature — the stage clears and the mark resolves into a centred
lockup extended to a CTA. Changed: nothing assembles from parts. The mark is a single
glyph plus a wordmark and faking a build would misrepresent the brand.

**There is no bespoke logo file.** `assets/logo-8f556ecf.svg` is the lucide spade in
`currentColor`; the mark is that glyph beside **StackedPoker** in Geist.

**This frame owns the film's only exit.**

Scene 1 (0.0–1.0s): everything fades — the lesson card, the grid, the coach panel,
the spotlight's edge — **except the two poker cards**, which simultaneously return to
132×186 and travel back to 818–1102, landing at y=250–436. They end the film at the
size and position they began it. One continuous move, no cut.

Scene 2 (1.0–1.7s): the **mark** fades in below them — spade glyph plus
**StackedPoker** in Geist, one object, centred. VO line 6 begins on the name.

Scene 3 (1.7–2.4s): the headline resolves in two lines — **Learn Poker** then
**By Playing.** — the second a beat after the first. No scale, no slide; opacity and
a few pixels of rise.

Scene 4 (2.4–2.8s): the **Start Free** pill fades up, solid `primary` — the only
solid element in the entire film — with *Free to start · No credit card* beneath it
in `text-muted`.

Scene 5 (2.8–3.0s): **completely still.** No jitter, no drift, no final flourish. The
brief's last words are "just confidence."
