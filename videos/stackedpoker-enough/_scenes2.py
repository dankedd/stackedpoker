# -*- coding: utf-8 -*-
"""Scenes 7-12 and the writer."""
import io, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _build import (frame, cards_mount, opts_mount, range_stack, OUT, W,
                    CARD_DEC, CARD_DEC_CY, OPTS_X, OPTS_Y, OPTS_S)
from _scenes import S1, S2, S3, S4, S5, S6, PANEL, THEORY, COACH

# ══ 7 — HAND -> RANGE. 1.8s. ═════════════════════════════════════════════
S7 = frame("07-range", 1.8,
  f"""{cards_mount("g", CARD_DEC, CARD_DEC_CY)}
{opts_mount("g", False)}
{opts_mount("g", True, "-res")}
    <div class="ctr headline" id="g-l1" style="top:1180px; font-size:54px">YOU MIGHT KNOW THE ANSWER.</div>
    <div class="ctr display grad" id="g-l2" style="top:1268px; font-size:72px">BUT DO YOU KNOW WHY?</div>
{range_stack("g")}""",
  PANEL,
  """
      var cards = q('#g-cards'), l1 = q('#g-l1'), l2 = q('#g-l2');
      var optsIdle = q('#g-opts'), opts = q('#g-opts-res');
      gsap.set(optsIdle, { opacity: 0 });
      gsap.set(opts, { opacity: 1 });
      var wraps = qa('.g-rw');
      var acts = qa('#g-rw0 .sp-act'), ring = q('#g-rw0 .sp-ring');
      var legend = q('#g-r0-legend'), title = q('#g-r0-title');

      wraps.forEach(function (el, i) { gsap.set(el, { opacity: i === 0 ? 1 : 0 }); });
      gsap.set(wraps[0], { opacity: 0 });
      gsap.set(acts, { opacity: 0 });
      gsap.set([ring, legend, title], { opacity: 0 });

      var tl = gsap.timeline({ paused: true, defaults: { ease: EASE } });
      tl.to([cards, opts, optsIdle, l1, l2], { opacity: 0, duration: 0.40, ease: 'power2.inOut' }, 0.04);
      tl.fromTo(wraps[0], { opacity: 0 }, { opacity: 1, duration: 0.45 }, 0.30);
      tl.fromTo(title, { opacity: 0 }, { opacity: 1, duration: 0.34 }, 0.46);
      /* the strategy resolves across every cell in ONE tween */
      tl.fromTo(acts, { opacity: 0 }, { opacity: 1, duration: 0.50, ease: 'power2.out' }, 0.64);
      /* and only then is the hand under discussion ringed */
      tl.fromTo(ring, { opacity: 0 }, { opacity: 1, duration: 0.36 }, 1.06);
      tl.fromTo(legend, { opacity: 0 }, { opacity: 1, duration: 0.34 }, 1.16);
      tl.to({}, { duration: 1.8 }, 0);""")

# ══ 8 — RANGE DEPTH. 1.8s. Four canonical ranges, one grid. ══════════════
S8 = frame("08-depth", 1.8,
  f"""{range_stack("m")}""",
  PANEL,
  """
      var wraps = qa('.m-rw');
      wraps.forEach(function (el, i) { gsap.set(el, { opacity: i === 0 ? 1 : 0 }); });
      var tl = gsap.timeline({ paused: true, defaults: { ease: 'power2.inOut' } });
      /* UTG 22 hands -> CO 48 -> BTN 78 -> BB defend 84. The grid never moves,
         so the eye reads the widening, which is the lesson's own claim. */
      var beats = [0.18, 0.56, 0.94, 1.32];
      for (var i = 0; i < beats.length; i++) {
        tl.to(wraps[i],     { opacity: 0, duration: 0.18 }, beats[i]);
        tl.to(wraps[i + 1], { opacity: 1, duration: 0.18 }, beats[i]);
      }
      tl.to({}, { duration: 1.8 }, 0);""")

# ══ 9 — WHY. 1.6s. ═══════════════════════════════════════════════════════
S9 = frame("09-why", 1.6,
  f"""{range_stack("w")}
    <div class="glass m-panel" id="w-panel"></div>
    {THEORY.format(p="w")}""",
  PANEL,
  """
      var wraps = qa('.w-rw');
      wraps.forEach(function (el, i) { gsap.set(el, { opacity: i === 4 ? 1 : 0 }); });
      var panel = q('#w-panel');
      var kick = q('#w-theory .m-kick'), ins = q('#w-theory .m-insight'),
          exp = q('#w-theory .m-explain');

      gsap.set(panel, { opacity: 0 });
      gsap.set([kick, ins, exp], { opacity: 0 });

      var tl = gsap.timeline({ paused: true, defaults: { ease: EASE } });
      tl.to(wraps[4], { opacity: 0, duration: 0.36, ease: 'power2.inOut' }, 0.04);
      tl.fromTo(panel, { opacity: 0 }, { opacity: 1, duration: 0.40 }, 0.24);
      tl.fromTo(kick, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.32 }, 0.42);
      tl.fromTo(ins,  { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.45 }, 0.58);
      tl.fromTo(exp,  { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.45 }, 0.92);
      tl.to({}, { duration: 1.6 }, 0);""")

# ══ 10 — AI COACH. 2.2s. ═════════════════════════════════════════════════
S10 = frame("10-coach", 2.2,
  f"""
    <div class="glass m-panel"></div>
    {THEORY.format(p="c")}
    {COACH.format(p="c")}""",
  PANEL,
  """
      var kick = q('#c-theory .m-kick'), ins = q('#c-theory .m-insight'),
          exp = q('#c-theory .m-explain');
      var coach = q('#c-coach'), qn = q('#c-q');
      var a1 = q('#c-a1'), a2 = q('#c-a2');

      gsap.set([coach, qn, a1, a2], { opacity: 0 });

      var tl = gsap.timeline({ paused: true, defaults: { ease: EASE } });
      tl.to(kick, { opacity: 0, duration: 0.28, ease: 'power2.inOut' }, 0.05);
      tl.to([ins, exp], { opacity: 0, duration: 0.40, ease: 'power2.inOut' }, 0.08);
      tl.fromTo(coach, { opacity: 0 }, { opacity: 1, duration: 0.32 }, 0.40);
      tl.fromTo(qn, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.40 }, 0.62);
      /* the answer lands in two beats — the panel is never simply still */
      tl.fromTo(a1, { opacity: 0 }, { opacity: 1, duration: 0.36 }, 1.02);
      tl.fromTo(a2, { opacity: 0 }, { opacity: 1, duration: 0.40 }, 1.40);
      tl.to({}, { duration: 2.2 }, 0);""")

# ══ 11 — THE PAYOFF. 2.2s. This one breathes. ════════════════════════════
S11 = frame("11-payoff", 2.0,
  f"""
    <div class="glass m-panel" id="y-panel"></div>
    {COACH.format(p="y")}
{cards_mount("y", 0.34, 620.0)}
    <div class="ctr headline" id="y-l1" data-gy="0" style="top:920px; font-size:58px">DON&rsquo;T JUST KNOW THE ANSWER.</div>
    <div class="ctr display grad" id="y-l2" data-gy="0" style="top:1012px; font-size:80px">UNDERSTAND WHY.</div>""",
  PANEL,
  """
      var panel = q('#y-panel'), coach = q('#y-coach'), qn = q('#y-q'), ans = q('#y-a');
      var cards = q('#y-cards'), l1 = q('#y-l1'), l2 = q('#y-l2');

      gsap.set(cards, { opacity: 0 });
      gsap.set([l1, l2], { opacity: 0, y: 16 });

      var tl = gsap.timeline({ paused: true, defaults: { ease: EASE } });
      tl.to([panel, coach, qn, ans], { opacity: 0, duration: 0.40, ease: 'power2.inOut' }, 0.05);
      /* back to the hand it all started from */
      tl.fromTo(cards, { opacity: 0 }, { opacity: 1, duration: 0.45 }, 0.32);
      tl.fromTo(l1, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.48 }, 0.62);
      /* the pause between the two lines is the point */
      tl.fromTo(l2, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.55 }, 1.05);
      tl.to({}, { duration: 2.0 }, 0);""")

# ══ 12 — CTA. 2.4s. Held. ════════════════════════════════════════════════
S12 = frame("12-cta", 2.4,
  f"""
    <div class="c-scene" id="b-scene">
{cards_mount("b", 0.34, 620.0)}
      <div class="ctr headline" id="b-l1" data-gy="0" style="top:920px; font-size:58px">DON&rsquo;T JUST KNOW THE ANSWER.</div>
      <div class="ctr display grad" id="b-l2" data-gy="0" style="top:1012px; font-size:80px">UNDERSTAND WHY.</div>
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
      /* and it holds */
      tl.to({}, { duration: 2.4 }, 0);""")


SCENES = [("01-more", S1, 0.0, 2.3), ("02-enough", S2, 2.3, 0.9),
          ("03-table", S3, 3.2, 2.0), ("04-decision", S4, 5.2, 2.0),
          ("05-answer", S5, 7.2, 1.1), ("06-pivot", S6, 8.3, 1.6),
          ("07-range", S7, 9.9, 1.8), ("08-depth", S8, 11.7, 1.8),
          ("09-why", S9, 13.5, 1.6), ("10-coach", S10, 15.1, 2.2),
          ("11-payoff", S11, 17.3, 2.0), ("12-cta", S12, 19.3, 2.4)]

if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    for name, html, start, dur in SCENES:
        io.open(f"{OUT}/{name}.html", "w", encoding="utf-8").write(html)
        print(f"  {name:12s} {start:5.1f}s +{dur:4.1f}s   {len(html):7d} bytes")
    print(f"\n  total {SCENES[-1][2] + SCENES[-1][3]:.1f}s")
