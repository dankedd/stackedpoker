# -*- coding: utf-8 -*-
"""Scenes 4-7 and the writer."""
import io, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _mbuild import (frame, cards_mount, range_html, OUT, W, MBUILD, FILM_BG,
                     CARD_DEC, CARD_DEC_CY, RANGE_S, CARD_CX)
from _mbuild2 import F1, F2, F3, OPTS_X, OPTS_Y, OPTS_S, mobile_options_html

RANGE_CX, RANGE_CY = W / 2, 960.0
BOT = ('<div class="ctr headline" id="{p}-mkt" data-gy="0" style="top:1520px; font-size:40px">'
       'DON&rsquo;T MEMORIZE THE HAND.</div>')

BOTMARK = ('<svg class="m-bot" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
           'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
           '<path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/>'
           '<path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>')

PANEL_CSS = """
    .m-panel { position:absolute; left:64px; top:520px; width:952px; height:760px; }
    .m-inner { position:absolute; left:124px; top:520px; width:832px; height:760px;
               display:flex; flex-direction:column; justify-content:center; }
    .m-kick    { font-size:28px; }
    .m-insight { font-size:56px; line-height:1.22; margin-top:52px; }
    .m-explain { font-size:31px; margin-top:56px; }
    .m-coach { display:flex; align-items:center; gap:18px; height:44px; }
    .m-coach .label { font-size:26px; color:rgba(186,205,247,0.66); }
    .m-bot { width:44px; height:44px; display:block; color:#7C5CFF; flex:none; }
    .m-q { font-family:"Geist"; font-size:46px; font-weight:600; letter-spacing:-0.01em;
           line-height:1.3; color:#FFFFFF; margin-top:54px; }
    .m-a { font-size:31px; margin-top:40px; }
    .m-a em { font-style:normal; font-weight:600; color:#FFFFFF; }"""

THEORY = ('<div class="m-inner" id="{p}-theory">'
          '<div class="label m-kick">WHY?</div>'
          '<div class="headline m-insight">The opener&rsquo;s position is evidence about '
          'their range strength.</div>'
          '<div class="body m-explain">A5s gains far more attacking a wide CO open than a '
          'tight, premium-heavy one.</div></div>')

COACH = ('<div class="m-inner" id="{p}-coachcol">'
         '<div class="m-coach" id="{p}-coach">' + BOTMARK +
         '<div class="label">AI Coach</div></div>'
         '<div class="m-q" id="{p}-q">Why from the Button?</div>'
         '<div class="body m-a" id="{p}-a"><em>Only the SB and BB</em> are left to act. '
         'Fewer players behind is part of why the Button is such a strong 3-betting seat.'
         '</div></div>')


def range_mount(idp, scale=RANGE_S, cy=RANGE_CY):
    return f"""
    <div class="mount-c {idp}-range" id="{idp}-range" data-scale="{scale:.6f}"
         style="left:{RANGE_CX}px; top:{cy}px">
      <div class="sp-range">{range_html(FILM_BG)}</div>
    </div>"""


# ══════════════════════════════════════════════════════════════════════════
# 4 — THE RANGE.  The grid arrives whole; the strategy then resolves across
#     every cell at once. No cascade, no per-cell brightness, no glow.
# ══════════════════════════════════════════════════════════════════════════
F4 = frame("04-range", 6.0,
  f"""
{cards_mount("r", CARD_DEC, CARD_DEC_CY)}
    <div class="mount d-opts-res" id="r-opts-res"
         style="left:{OPTS_X:.2f}px; top:{OPTS_Y}px; transform:scale({OPTS_S:.6f})">
      {mobile_options_html(True)}
    </div>
    <div class="ctr headline" id="r-q" data-gy="0" style="top:660px; font-size:60px">WHAT WOULD YOU DO?</div>
    <div class="ctr headline" id="r-top" data-gy="0" style="top:336px; font-size:54px">THINK IN RANGES.</div>
{range_mount("r")}
""" + BOT.format(p="r"),
  PANEL_CSS,
  """
      var cards = q('#r-cards'), opts = q('#r-opts-res'), qn = q('#r-q');
      var top = q('#r-top'), range = q('#r-range'), mkt = q('#r-mkt');
      var strat = qa('#r-range .sp-3bet'), ring = q('#r-range .sp-ring');
      var legend = q('#r-range #sp-range-legend');

      gsap.set(range, { opacity: 0 });
      gsap.set(strat, { opacity: 0 });
      gsap.set(ring, { opacity: 0 });
      gsap.set(legend, { opacity: 0 });
      gsap.set([top, mkt], { opacity: 0, y: 16 });

      var tl = gsap.timeline({ paused: true });
      /* the decision hands over */
      tl.to([cards, opts, qn], { opacity: 0, duration: 0.75, ease: 'power3.inOut' }, 0.30);
      tl.fromTo(top, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.75, ease: 'power3.out' }, 0.95);
      /* 1 — the grid appears AS A WHOLE, every cell already carrying the real
             "Other action" colour */
      tl.fromTo(range, { opacity: 0 }, { opacity: 1, duration: 0.90, ease: 'power3.out' }, 1.45);
      /* 2 — the strategy resolves across the entire grid in ONE tween, so two
             hands at the same frequency can never differ */
      tl.fromTo(strat, { opacity: 0 }, { opacity: 1, duration: 0.95, ease: 'power2.out' }, 2.60);
      /* 3 — and only then the hand under discussion is ringed */
      tl.fromTo(ring, { opacity: 0 }, { opacity: 1, duration: 0.60, ease: 'power3.out' }, 3.80);
      tl.fromTo(legend, { opacity: 0 }, { opacity: 1, duration: 0.65, ease: 'power3.out' }, 4.20);
      tl.fromTo(mkt, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.80, ease: 'power3.out' }, 4.55);
      tl.to({}, { duration: 6.0 }, 0);""")

# ══════════════════════════════════════════════════════════════════════════
# 5 — THE THEORY.  6 — THE COACH.  7 — THE CLOSE.
# ══════════════════════════════════════════════════════════════════════════
F5 = frame("05-theory", 3.5,
  f"""
{range_mount("t")}
""" + BOT.format(p="t") + f"""
    <div class="ctr headline" id="t-top" data-gy="0" style="top:336px; font-size:54px">THINK IN RANGES.</div>
    <div class="glass m-panel" id="t-panel"></div>
    {THEORY.format(p="t")}""",
  PANEL_CSS,
  """
      var range = q('#t-range'), top = q('#t-top'), mkt = q('#t-mkt'), panel = q('#t-panel');
      var kick = q('#t-theory .m-kick'), ins = q('#t-theory .m-insight'),
          exp = q('#t-theory .m-explain');

      gsap.set(panel, { opacity: 0 });
      gsap.set(kick, { opacity: 0, y: 14 });
      gsap.set(ins,  { opacity: 0, y: 18 });
      gsap.set(exp,  { opacity: 0, y: 16 });

      var tl = gsap.timeline({ paused: true, defaults: { ease: 'power3.out' } });
      /* the range recedes and the lesson's own explanation takes the frame */
      tl.to([range, top, mkt], { opacity: 0, duration: 0.80, ease: 'power3.inOut' }, 0.25);
      tl.fromTo(panel, { opacity: 0 }, { opacity: 1, duration: 0.80 }, 0.85);
      tl.fromTo(kick, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.55 }, 1.15);
      tl.fromTo(ins,  { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.75 }, 1.45);
      tl.fromTo(exp,  { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.75 }, 2.15);
      tl.to({}, { duration: 3.5 }, 0);""")

F6 = frame("06-coach", 3.5,
  f"""
    <div class="glass m-panel"></div>
    {THEORY.format(p="c")}
    {COACH.format(p="c")}""",
  PANEL_CSS,
  """
      var kick = q('#c-theory .m-kick'), ins = q('#c-theory .m-insight'),
          exp = q('#c-theory .m-explain');
      var coach = q('#c-coach'), qn = q('#c-q'), ans = q('#c-a');

      gsap.set([coach, qn, ans], { opacity: 0 });

      var tl = gsap.timeline({ paused: true, defaults: { ease: 'power3.out' } });
      tl.to(kick, { opacity: 0, duration: 0.35, ease: 'power3.inOut' }, 0.25);
      tl.to([ins, exp], { opacity: 0, duration: 0.50, ease: 'power3.inOut' }, 0.28);
      tl.fromTo(coach, { opacity: 0 }, { opacity: 1, duration: 0.45 }, 0.65);
      tl.fromTo(qn,  { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.65 }, 1.05);
      tl.fromTo(ans, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.85 }, 1.75);
      tl.to({}, { duration: 3.5 }, 0);""")

F7 = frame("07-cta", 4.0,
  f"""
    <div class="c-scene" id="b-scene">
      <div class="glass m-panel"></div>
      {COACH.format(p="b")}
    </div>
    <div class="b-mark" id="b-mark">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 9c-1.5 1.5-3 3.2-3 5.5A5.5 5.5 0 0 0 7.5 20c1.8 0 3-.5 4.5-2 1.5 1.5 2.7 2 4.5 2a5.5 5.5 0 0 0 5.5-5.5c0-2.3-1.5-4-3-5.5l-7-7-7 7Z" fill="currentColor"/>
        <path d="M12 17.4v4.6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>
      </svg>
    </div>
    <div class="ctr b-wordmark" id="b-wordmark" style="top:800px">Stacked<span class="grad">Poker</span></div>
    <div class="ctr display" id="b-l1" style="top:930px; font-size:104px; line-height:1.08">LEARN POKER.</div>
    <div class="ctr display" id="b-l2" style="top:1046px; font-size:104px; line-height:1.08"><span class="grad">BY PLAYING.</span></div>
    <div class="b-cta" id="b-cta">START LEARNING FREE</div>""",
  PANEL_CSS + """
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
      var l1 = q('#b-l1'), l2 = q('#b-l2'), cta = q('#b-cta');

      gsap.set([mark, wm, l1, l2, cta], { opacity: 0 });

      var tl = gsap.timeline({ paused: true, defaults: { ease: 'power3.out' } });
      tl.to(scene, { opacity: 0, duration: 0.80, ease: 'power3.inOut' }, 0.02);
      tl.fromTo(mark, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.60 }, 0.85);
      tl.fromTo(wm,   { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.50 }, 1.35);
      tl.fromTo(l1,   { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.55 }, 1.75);
      tl.fromTo(l2,   { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.55 }, 2.05);
      tl.fromTo(cta,  { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.55 }, 2.45);
      tl.to({}, { duration: 4.0 }, 0);""")


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    for name, html in [("01-hook", F1), ("02-spot", F2), ("03-decision", F3),
                       ("04-range", F4), ("05-theory", F5), ("06-coach", F6),
                       ("07-cta", F7)]:
        io.open(f"{OUT}/{name}.html", "w", encoding="utf-8").write(html)
        print(f"  wrote {name}.html ({len(html)} bytes)")
