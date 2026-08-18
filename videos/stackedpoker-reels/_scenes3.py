# -*- coding: utf-8 -*-
"""Scenes 8-11 and the writer."""
import io, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _build import frame, cards_mount, OUT, W, CARD_HOOK_CY
from _scenes import S1, S2, S3, S4, PANEL, THEORY, COACH
from _scenes2 import S5, S6, S7
from _ranges import COUNTS

# real module titles, verbatim from LEARNING_MODULES
MODULES = ["PREFLOP AGGRESSION", "DEFENDING THE OPEN", "GAME THEORY FOUNDATIONS",
           "BLOCKERS &amp; CARD REMOVAL", "RANGE VS RANGE"]

MOD_HTML = "".join(
    f'<div class="ctr display mod" id="mod{i}" data-gy="0" style="top:860px; font-size:62px">{m}</div>'
    for i, m in enumerate(MODULES))

# ══ 8 — MODULE DEPTH. 1.8s. Real titles, real totals. ════════════════════
S8 = frame("08-depth", 1.8,
  f"""
    <div class="glass m-panel" id="d-panel"></div>
    {THEORY.format(p="d")}
    {MOD_HTML}
    <div class="ctr label" id="d-count" data-gy="0" style="top:1010px; font-size:30px">12 MODULES &middot; 100 LESSONS</div>""",
  PANEL + """
    .mod { line-height:1.1; }""",
  """
      var panel = q('#d-panel');
      var kick = q('#d-theory .m-kick'), ins = q('#d-theory .m-insight'),
          exp = q('#d-theory .m-explain');
      var mods = qa('.mod'), count = q('#d-count');

      gsap.set(mods, { opacity: 0 });
      gsap.set(count, { opacity: 0, y: 12 });

      var tl = gsap.timeline({ paused: true, defaults: { ease: EASE } });
      tl.to([panel, kick, ins, exp], { opacity: 0, duration: 0.35, ease: 'power2.inOut' }, 0.05);
      /* five real module titles, ~0.26s each — a snap, never a crossfade */
      for (var i = 0; i < mods.length; i++) {
        var t = 0.32 + i * 0.26;
        tl.fromTo(mods[i], { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.16 }, t);
        if (i < mods.length - 1) tl.to(mods[i], { opacity: 0, duration: 0.10 }, t + 0.20);
      }
      tl.fromTo(count, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.40 }, 1.30);
      tl.to({}, { duration: 1.8 }, 0);""")

# ══ 9 — AI COACH. 2.4s. The last layer of understanding. ════════════════
S9 = frame("09-coach", 2.0,
  f"""
    <div class="ctr display mod" id="c-lastmod" data-gy="0" style="top:860px; font-size:62px">{MODULES[-1]}</div>
    <div class="ctr label" id="c-count" data-gy="0" style="top:1010px; font-size:30px">12 MODULES &middot; 100 LESSONS</div>
    <div class="glass m-panel" id="c-panel"></div>
    {COACH.format(p="c")}""",
  PANEL + """
    .mod { line-height:1.1; }""",
  """
      var lastmod = q('#c-lastmod'), count = q('#c-count'), panel = q('#c-panel');
      var coach = q('#c-coach'), qn = q('#c-q'), ans = q('#c-a');
      var a1 = q('#c-a1'), a2 = q('#c-a2');

      gsap.set(panel, { opacity: 0 });
      gsap.set([coach, qn], { opacity: 0 });
      gsap.set([a1, a2], { opacity: 0 });

      var tl = gsap.timeline({ paused: true, defaults: { ease: EASE } });
      tl.to([lastmod, count], { opacity: 0, duration: 0.30, ease: 'power2.inOut' }, 0.04);
      tl.fromTo(panel, { opacity: 0 }, { opacity: 1, duration: 0.40 }, 0.24);
      tl.fromTo(coach, { opacity: 0 }, { opacity: 1, duration: 0.30 }, 0.44);
      tl.fromTo(qn, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.40 }, 0.64);
      /* the answer lands in two beats, so the panel is never simply still */
      tl.fromTo(a1, { opacity: 0 }, { opacity: 1, duration: 0.38 }, 1.02);
      tl.fromTo(a2, { opacity: 0 }, { opacity: 1, duration: 0.42 }, 1.38);
      tl.to({}, { duration: 2.0 }, 0);""")

# ══ 10 — THE PAYOFF. 1.6s. Everything resolves; this one breathes. ══════
S10 = frame("10-payoff", 1.6,
  f"""
    <div class="glass m-panel" id="p-panel"></div>
    {COACH.format(p="p")}
{cards_mount("p", 0.34, 620.0)}
    <div class="ctr headline" id="p-l1" data-gy="0" style="top:920px; font-size:58px">DON&rsquo;T JUST KNOW THE ANSWER.</div>
    <div class="ctr display grad" id="p-l2" data-gy="0" style="top:1010px; font-size:78px">UNDERSTAND WHY.</div>""",
  PANEL,
  """
      var panel = q('#p-panel'), coach = q('#p-coach'), qn = q('#p-q'), ans = q('#p-a');
      var cards = q('#p-cards'), l1 = q('#p-l1'), l2 = q('#p-l2');
      var cardEls = qa('#p-cards .sp-card');

      gsap.set(cards, { opacity: 0 });
      gsap.set([l1, l2], { opacity: 0, y: 16 });

      var tl = gsap.timeline({ paused: true, defaults: { ease: EASE } });
      tl.to([panel, coach, qn, ans], { opacity: 0, duration: 0.40, ease: 'power2.inOut' }, 0.05);
      /* back to the hand it all started from */
      tl.fromTo(cards, { opacity: 0 }, { opacity: 1, duration: 0.45 }, 0.30);
      tl.fromTo(l1, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.50 }, 0.55);
      tl.fromTo(l2, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.55 }, 0.80);
      tl.to({}, { duration: 1.6 }, 0);""")

# ══ 11 — CTA. 2.0s. Held. ═══════════════════════════════════════════════
S11 = frame("11-cta", 2.0,
  f"""
    <div class="c-scene" id="b-scene">
{cards_mount("b", 0.34, 620.0)}
      <div class="ctr headline" id="b-l1" data-gy="0" style="top:920px; font-size:58px">DON&rsquo;T JUST KNOW THE ANSWER.</div>
      <div class="ctr display grad" id="b-l2" data-gy="0" style="top:1010px; font-size:78px">UNDERSTAND WHY.</div>
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
      tl.fromTo(cta,  { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.45 }, 1.22);
      /* and it holds */
      tl.to({}, { duration: 2.0 }, 0);""")


SCENES = [("01-hook", S1, 0.0, 2.0), ("02-spot", S2, 2.0, 2.2),
          ("03-options", S3, 4.2, 1.6), ("04-answer", S4, 5.8, 1.4),
          ("05-range", S5, 7.2, 2.0), ("06-montage", S6, 9.2, 2.6),
          ("07-theory", S7, 11.8, 2.4), ("08-depth", S8, 14.2, 1.8),
          ("09-coach", S9, 16.0, 2.0), ("10-payoff", S10, 18.0, 1.6),
          ("11-cta", S11, 19.6, 2.0)]

if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    for name, html, start, dur in SCENES:
        io.open(f"{OUT}/{name}.html", "w", encoding="utf-8").write(html)
        print(f"  {name:12s} {start:5.1f}s +{dur:4.1f}s   {len(html):6d} bytes")
    print(f"\n  total {SCENES[-1][2] + SCENES[-1][3]:.1f}s")
