# -*- coding: utf-8 -*-
"""Scenes 5-11 and the writer."""
import io, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _build import (frame, cards_mount, opts_mount, range_mount, OUT, W, MBUILD,
                    CARD_DEC, CARD_DEC_CY, CARD_HOOK_CY, RANGE_S, RANGE_CX, RANGE_CY)
from _scenes import S1, S2, S3, S4, PANEL, THEORY, COACH
from _ranges import HERO, MONTAGE, grid_html, COUNTS

# every grid the montage cycles through, stacked at one position: the grid never
# moves, only the strategy on it changes
ALL = [HERO] + MONTAGE


def stack(idp, visible_idx):
    out = []
    for i, r in enumerate(ALL):
        out.append(f"""
    <div class="mount-c {idp}-rw" id="{idp}-rw{i}" data-scale="{RANGE_S:.6f}"
         data-layout-allow-overlap
         style="left:{RANGE_CX}px; top:{RANGE_CY}px">
      {grid_html(r, f"{idp}-r{i}", MBUILD)}
    </div>""")
    return "".join(out)


HIDE_OTHERS = """
      /* only one grid is ever visible; the rest wait at opacity 0 */
      qa('.{p}-rw').forEach(function (el, i) {{ gsap.set(el, {{ opacity: i === {v} ? 1 : 0 }}); }});"""

# ══ 5 — HAND -> RANGE. 2.0s. The first payoff. ═══════════════════════════
S5 = frame("05-range", 2.0,
  f"""{cards_mount("g", CARD_DEC, CARD_DEC_CY)}
{opts_mount("g", True)}
{stack("g", 0)}
    <div class="ctr headline" id="g-top" data-gy="0" style="top:336px; font-size:52px">UNDERSTAND THE RANGE.</div>""",
  PANEL,
  """
      var cards = q('#g-cards'), opts = q('#g-opts'), top = q('#g-top');
      var wrap = q('#g-rw0');
      var acts = qa('#g-rw0 .sp-act'), ring = q('#g-rw0 .sp-ring');
      var legend = q('#g-r0-legend'), title = q('#g-r0-title');

      qa('.g-rw').forEach(function (el, i) { gsap.set(el, { opacity: i === 0 ? 1 : 0 }); });
      gsap.set(wrap, { opacity: 0 });
      gsap.set(acts, { opacity: 0 });
      gsap.set([ring, legend, title], { opacity: 0 });
      gsap.set(top, { opacity: 0, y: 14 });

      var tl = gsap.timeline({ paused: true, defaults: { ease: EASE } });
      /* the decision hands over to the grid it belongs to */
      tl.to([cards, opts], { opacity: 0, duration: 0.45, ease: 'power2.inOut' }, 0.05);
      tl.fromTo(wrap, { opacity: 0 }, { opacity: 1, duration: 0.50 }, 0.35);
      tl.fromTo(title, { opacity: 0 }, { opacity: 1, duration: 0.40 }, 0.55);
      /* the whole strategy resolves in ONE tween — two hands at the same
         frequency can never come out looking different */
      tl.fromTo(acts, { opacity: 0 }, { opacity: 1, duration: 0.55, ease: 'power2.out' }, 0.80);
      /* and only then is the hand under discussion ringed */
      tl.fromTo(ring, { opacity: 0 }, { opacity: 1, duration: 0.40 }, 1.25);
      tl.fromTo(legend, { opacity: 0 }, { opacity: 1, duration: 0.40 }, 1.35);
      tl.fromTo(top, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.45 }, 1.10);
      tl.to({}, { duration: 2.0 }, 0);""")

# ══ 6 — RANGE MONTAGE. 2.6s. UTG -> CO -> BTN -> BB. ════════════════════
# Not a slideshow: 22 hands, then 48, then 78, on a grid that never moves. It is
# the lesson's own claim — the opener's position is evidence about their range
# strength — shown rather than stated.
S6 = frame("06-montage", 2.6,
  f"""{stack("m", 0)}
    <div class="ctr headline" id="m-top" data-gy="0" style="top:336px; font-size:52px">UNDERSTAND THE RANGE.</div>""",
  PANEL,
  """
      var top = q('#m-top');
      var wraps = qa('.m-rw');
      wraps.forEach(function (el, i) { gsap.set(el, { opacity: i === 0 ? 1 : 0 }); });

      var tl = gsap.timeline({ paused: true, defaults: { ease: 'power2.inOut' } });
      tl.to(top, { opacity: 0, duration: 0.30 }, 0.05);
      /* four beats, 0.55s apart. Each is a real canonical range; the grid, the
         cell size and the colour system stay put, so the eye reads the CHANGE. */
      var beats = [0.25, 0.80, 1.35, 1.90];
      for (var i = 0; i < beats.length; i++) {
        tl.to(wraps[i],     { opacity: 0, duration: 0.22 }, beats[i]);
        tl.to(wraps[i + 1], { opacity: 1, duration: 0.22 }, beats[i]);
      }
      tl.to({}, { duration: 2.6 }, 0);""")

# ══ 7 — THEORY. 2.4s. The montage stops and the reason arrives. ═════════
S7 = frame("07-theory", 2.4,
  f"""{stack("t", 4)}
    <div class="glass m-panel" id="t-panel"></div>
    {THEORY.format(p="t")}""",
  PANEL,
  """
      var wraps = qa('.t-rw');
      wraps.forEach(function (el, i) { gsap.set(el, { opacity: i === 4 ? 1 : 0 }); });
      var panel = q('#t-panel');
      var kick = q('#t-theory .m-kick'), ins = q('#t-theory .m-insight'),
          exp = q('#t-theory .m-explain');

      gsap.set(panel, { opacity: 0 });
      gsap.set(kick, { opacity: 0, y: 12 });
      gsap.set(ins,  { opacity: 0, y: 16 });
      gsap.set(exp,  { opacity: 0, y: 14 });

      var tl = gsap.timeline({ paused: true, defaults: { ease: EASE } });
      tl.to(wraps[4], { opacity: 0, duration: 0.45, ease: 'power2.inOut' }, 0.10);
      tl.fromTo(panel, { opacity: 0 }, { opacity: 1, duration: 0.50 }, 0.40);
      tl.fromTo(kick, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.40 }, 0.62);
      tl.fromTo(ins,  { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.55 }, 0.80);
      tl.fromTo(exp,  { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.55 }, 1.25);
      tl.to({}, { duration: 2.4 }, 0);""")
