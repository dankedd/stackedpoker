# -*- coding: utf-8 -*-
"""Scenes 7-11 and the writer."""
import io, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _build import (frame, surf, cards_inner, range_stack, OUT, W, H,
                    CARD_CX, RANGE_CX, RANGE_CY, RANGE_S)
from _scenes import S1, S2, S3, S4, S5, S6, PANEL, THEORY, COACH

PANEL_CX, PANEL_CY = W / 2, 920.0

# LEARNING_MODULES, curriculum.ts — real, built, shipping modules only. The 17
# roadmap modules are deliberately absent: they are not live.
MODULES = ["PREFLOP AGGRESSION", "BLOCKERS &amp; CARD REMOVAL",
           "GAME THEORY FOUNDATIONS", "RANGE VS RANGE",
           "POLARIZATION &amp; RANGE CONSTRUCTION", "THE LANGUAGE OF BET SIZING"]
MOD_HTML = "".join(
    f'<div class="mod display" id="md{i}" style="top:{880 + 0}px">{m}</div>'
    for i, m in enumerate(MODULES))

MOD_CSS = """
    .mod { position:absolute; left:60px; width:960px; text-align:center;
           font-size:46px; line-height:1.15; will-change:transform; }
    /* the one proof point in the film — legible, not a whisper */
    .modcount { position:absolute; left:0; width:1080px; text-align:center;
                top:1120px; font-size:30px; color:rgba(186,205,247,0.72); }"""

# ══ 7 — THEORY. 2.2s. ════════════════════════════════════════════════════
S7 = frame("07-why", 2.2,
  f"""
    <div class="room">
{range_stack("w")}
      {surf("w-panel", '<div class="glass m-panel"></div>' + THEORY.format(p="w"),
            PANEL_CX, PANEL_CY, o=0, z=-380)}
    </div>""",
  PANEL,
  """
      var wraps = qa('.rw');
      wraps.forEach(function (el, i) { gsap.set(el, { opacity: i === 4 ? 1 : 0 }); });
      var panel = q('#w-panel');
      var kick = q('#w-theory .m-kick'), ins = q('#w-theory .m-insight'),
          exp = q('#w-theory .m-explain');
      gsap.set([kick, ins, exp], { opacity: 0 });

      var tl = gsap.timeline({ paused: true, defaults: { ease: EASE } });
      /* the grid tilts back into the room; the reason comes forward through it */
      tl.to(wraps[4], { z: -520, rotationX: 10, opacity: 0.14, duration: 0.80 }, 0.04);
      tl.fromTo(panel, { opacity: 0, z: -380 }, { opacity: 1, z: 0, duration: 0.72 }, 0.30);
      tl.fromTo(kick, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.32 }, 0.62);
      tl.fromTo(ins,  { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.48 }, 0.78);
      tl.fromTo(exp,  { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.48 }, 1.20);
      tl.to({}, { duration: 2.2 }, 0);""")

# ══ 8 — AI COACH. 2.4s. ══════════════════════════════════════════════════
S8 = frame("08-coach", 2.4,
  f"""
    <div class="room">
{range_stack("k")}
      {surf("k-panel", '<div class="glass m-panel"></div>' + THEORY.format(p="k")
            + COACH.format(p="k"), PANEL_CX, PANEL_CY)}
    </div>""",
  PANEL,
  """
      var wraps = qa('.rw');
      wraps.forEach(function (el, i) { gsap.set(el, { opacity: 0 }); });
      gsap.set(wraps[4], { opacity: 0.14, z: -520, rotationX: 10 });
      var kick = q('#k-theory .m-kick'), ins = q('#k-theory .m-insight'),
          exp = q('#k-theory .m-explain');
      var coach = q('#k-coach'), qn = q('#k-q'), a1 = q('#k-a1'), a2 = q('#k-a2');
      gsap.set([coach, qn, a1, a2], { opacity: 0 });

      var tl = gsap.timeline({ paused: true, defaults: { ease: EASE } });
      /* the same panel becomes the coach — one surface, not a second window */
      tl.to(kick, { opacity: 0, duration: 0.26, ease: 'power2.inOut' }, 0.05);
      tl.to([ins, exp], { opacity: 0, duration: 0.40, ease: 'power2.inOut' }, 0.08);
      tl.fromTo(coach, { opacity: 0 }, { opacity: 1, duration: 0.32 }, 0.42);
      tl.fromTo(qn, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.42 }, 0.64);
      tl.fromTo(a1, { opacity: 0 }, { opacity: 1, duration: 0.38 }, 1.06);
      tl.fromTo(a2, { opacity: 0 }, { opacity: 1, duration: 0.42 }, 1.46);
      tl.to({}, { duration: 2.4 }, 0);""")

# ══ 9 — THE SYSTEM. 2.2s. Real module names, nothing unbuilt. ════════════
S9 = frame("09-system", 2.2,
  f"""
    <div class="room">
{range_stack("s")}
      {surf("s-panel", '<div class="glass m-panel"></div>' + COACH.format(p="s"),
            PANEL_CX, PANEL_CY)}
    </div>
    {MOD_HTML}
    <div class="label modcount" id="s-count">12 MODULES &middot; 94 LESSONS</div>""",
  PANEL + MOD_CSS,
  """
      var panel = q('#s-panel'), wraps = qa('.rw'), mods = qa('.mod'), cnt = q('#s-count');
      wraps.forEach(function (el, i) { gsap.set(el, { opacity: 0 }); });
      gsap.set(wraps[4], { opacity: 0.14, z: -520, rotationX: 10 });
      gsap.set(mods, { opacity: 0 });
      gsap.set(cnt, { opacity: 0 });

      var tl = gsap.timeline({ paused: true, defaults: { ease: EASE } });
      tl.to(panel, { z: -560, rotationX: 10, opacity: 0, duration: 0.50 }, 0.04);
      tl.to(wraps[4], { opacity: 0, duration: 0.40 }, 0.04);
      /* six real module names, each arriving from depth and leaving */
      for (var i = 0; i < mods.length; i++) {
        var t = 0.34 + i * 0.24;
        tl.fromTo(mods[i], { opacity: 0, z: -260 },
                           { opacity: 1, z: 0, duration: 0.26 }, t);
        tl.to(mods[i], { opacity: 0, z: 120, duration: 0.22 }, t + 0.24);
      }
      tl.fromTo(cnt, { opacity: 0 }, { opacity: 1, duration: 0.34 }, 1.62);
      tl.to({}, { duration: 2.2 }, 0);""")

# ══ 10 — THE PAYOFF. 2.2s. Back to the two cards. ════════════════════════
S10 = frame("10-payoff", 2.2,
  f"""
    <div class="room">
      {surf("p-cards", cards_inner(), CARD_CX, 700.0, s=0.40, o=0, z=-260)}
    </div>
    <div class="label modcount" id="p-count">12 MODULES &middot; 94 LESSONS</div>
    <div class="ctr headline" id="p-l1" style="top:1010px; font-size:52px">THE HAND IS ONLY THE START.</div>
    <div class="ctr display grad" id="p-l2" style="top:1104px; font-size:76px">UNDERSTAND THE DECISION.</div>""",
  PANEL + MOD_CSS,
  """
      var cards = q('#p-cards'), cnt = q('#p-count'), l1 = q('#p-l1'), l2 = q('#p-l2');
      gsap.set([l1, l2], { opacity: 0, y: 16 });

      var tl = gsap.timeline({ paused: true, defaults: { ease: EASE } });
      tl.to(cnt, { opacity: 0, duration: 0.30, ease: 'power2.inOut' }, 0.04);
      /* the pair it all started from, returning out of the room */
      tl.fromTo(cards, { opacity: 0, z: -260 }, { opacity: 1, z: 0, duration: 0.70 }, 0.22);
      tl.fromTo(l1, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.48 }, 0.62);
      /* the pause between the two lines is the argument */
      tl.fromTo(l2, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.55 }, 1.16);
      tl.to({}, { duration: 2.2 }, 0);""")

# ══ 11 — CTA. 2.4s. Held. ════════════════════════════════════════════════
S11 = frame("11-cta", 2.4,
  f"""
    <div class="c-scene" id="b-scene">
      <div class="room">
        {surf("b-cards", cards_inner(), CARD_CX, 700.0, s=0.40)}
      </div>
      <div class="ctr headline" id="b-l1" style="top:1010px; font-size:52px">THE HAND IS ONLY THE START.</div>
      <div class="ctr display grad" id="b-l2" style="top:1104px; font-size:76px">UNDERSTAND THE DECISION.</div>
    </div>
    <div class="b-mark" id="b-mark">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 9c-1.5 1.5-3 3.2-3 5.5A5.5 5.5 0 0 0 7.5 20c1.8 0 3-.5 4.5-2 1.5 1.5 2.7 2 4.5 2a5.5 5.5 0 0 0 5.5-5.5c0-2.3-1.5-4-3-5.5l-7-7-7 7Z" fill="currentColor"/>
        <path d="M12 17.4v4.6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>
      </svg>
    </div>
    <div class="ctr b-wordmark" id="b-wordmark" style="top:800px">Stacked<span class="grad">Poker</span></div>
    <div class="ctr display" id="b-h1" style="top:930px; font-size:104px; line-height:1.08">LEARN POKER.</div>
    <div class="ctr display" id="b-h2" style="top:1046px; font-size:104px; line-height:1.08"><span class="grad">BY PLAYING.</span></div>
    <div class="b-cta" id="b-cta">START LEARNING FREE</div>""",
  PANEL + """
    .c-scene { position:absolute; left:0; top:0; width:1080px; height:1920px; }
    .b-mark { position:absolute; left:460px; top:600px; width:160px; height:160px;
              border-radius:40px; background:linear-gradient(135deg,#7C5CFF 0%,#5EA8FF 100%);
              display:flex; align-items:center; justify-content:center;
              box-shadow:0 40px 110px rgba(124,92,255,0.28); }
    .b-mark svg { width:84px; height:84px; display:block; color:#FFFFFF; }
    .b-wordmark { font-family:"Geist"; font-size:66px; font-weight:800;
                  letter-spacing:-0.025em; color:#FFFFFF; }
    .b-cta { position:absolute; left:260px; top:1290px; width:560px; height:118px;
             border-radius:100px; background:linear-gradient(135deg,#7C5CFF 0%,#5EA8FF 100%);
             display:flex; align-items:center; justify-content:center;
             font-family:"Geist"; font-size:32px; font-weight:600; letter-spacing:0.01em;
             color:#FFFFFF; box-shadow:0 34px 90px rgba(124,92,255,0.24); }""",
  """
      var scene = q('#b-scene'), mark = q('#b-mark'), wm = q('#b-wordmark');
      var h1 = q('#b-h1'), h2 = q('#b-h2'), cta = q('#b-cta');
      gsap.set([mark, wm, h1, h2, cta], { opacity: 0 });

      var tl = gsap.timeline({ paused: true, defaults: { ease: EASE } });
      tl.to(scene, { opacity: 0, duration: 0.45, ease: 'power2.inOut' }, 0.02);
      tl.fromTo(mark, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.45 }, 0.40);
      tl.fromTo(wm,   { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.40 }, 0.62);
      tl.fromTo(h1,   { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.45 }, 0.84);
      tl.fromTo(h2,   { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.45 }, 1.00);
      tl.fromTo(cta,  { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.45 }, 1.24);
      tl.to({}, { duration: 2.4 }, 0);""")


SCENES = [("01-hand", S1, 0.0, 2.0), ("02-context", S2, 2.0, 2.0),
          ("03-action", S3, 4.0, 1.8), ("04-decision", S4, 5.8, 2.0),
          ("05-range", S5, 7.8, 2.4), ("06-depth", S6, 10.2, 2.4),
          ("07-why", S7, 12.6, 2.2), ("08-coach", S8, 14.8, 2.4),
          ("09-system", S9, 17.2, 2.2), ("10-payoff", S10, 19.4, 2.2),
          ("11-cta", S11, 21.6, 2.4)]

if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    for name, html, start, dur in SCENES:
        io.open(f"{OUT}/{name}.html", "w", encoding="utf-8").write(html)
        print(f"  {name:12s} {start:5.1f}s +{dur:4.1f}s   {len(html):7d} bytes")
    print(f"\n  total {SCENES[-1][2] + SCENES[-1][3]:.1f}s")
