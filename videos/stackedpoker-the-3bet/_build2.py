# -*- coding: utf-8 -*-
"""Frames 5-7 plus the writer. Imported by _build.py's __main__."""
import io, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _build import (frame, range_html, FILM_BG, RANGE_CX, RANGE_CY, RANGE_DISP,
                    OUT, F1, F2, F3, F4)

RANGE_SLID_X = 500.0
RANGE_SCALE_END = RANGE_DISP * 1.03

PANEL_CSS = """
    .r4-mkt { position:absolute; left:0; top:944px; width:1920px; text-align:center;
              font-size:26px; line-height:1.2; }
    .pn-why      { position:absolute; left:1000px; top:300px; width:580px; height:460px; }
    .pn-body     { position:absolute; left:1044px; top:300px; width:492px; height:460px;
                   display:flex; flex-direction:column; justify-content:center; }
    .pn-insight  { font-size:30px; line-height:1.26; margin-top:40px; }
    .pn-explain  { font-size:19px; margin-top:44px; }
    .pn-coach { display:flex; align-items:center; gap:11px; height:22px; }
    .pn-coach .label { color:rgba(186,205,247,0.62); }
    .botmark { width:22px; height:22px; display:block; color:#7C5CFF; flex:none; }
    .pn-q { font-family:"Geist"; font-size:22px; font-weight:600; letter-spacing:-0.01em;
            line-height:1.35; color:#FFFFFF; margin-top:38px; }
    .pn-a { font-size:19px; margin-top:26px; }
    .pn-a em { font-style:normal; font-weight:600; color:#FFFFFF; }"""

BOTMARK = ('<svg class="botmark" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
           'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
           '<path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/>'
           '<path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>')

THEORY_COL = ('<div class="pn-body" id="{p}-theory">'
              '<div class="label pn-why-k">WHY?</div>'
              '<div class="headline pn-insight">The opener&rsquo;s position is evidence '
              'about their range strength.</div>'
              '<div class="body pn-explain">A5s gains far more attacking a wide CO open '
              'than a tight, premium-heavy one.</div></div>')

COACH_COL = ('<div class="pn-body" id="{p}-coachcol">'
             '<div class="pn-coach" id="{p}-coach">' + BOTMARK +
             '<div class="label">AI Coach</div></div>'
             '<div class="pn-q" id="{p}-q">Why from the Button?</div>'
             '<div class="body pn-a" id="{p}-a"><em>Only the SB and BB</em> are left to act. '
             'Fewer players behind is part of why the Button is such a strong 3-betting seat.'
             '</div></div>')

MKT = ('<div class="{p}-mkt r4-mkt headline" data-x="{dx}">DON&rsquo;T MEMORISE THE HAND. '
       'UNDERSTAND THE RANGE.</div>')


def slid_range(idp):
    return f"""
    <div class="mount-c {idp}-range" id="{idp}-range"
         data-scale="{RANGE_SCALE_END:.6f}" style="left:{RANGE_SLID_X}px; top:{RANGE_CY}px">
      <div class="sp-range">{range_html(FILM_BG)}</div>
    </div>
    """ + MKT.format(p=idp, dx=RANGE_SLID_X - RANGE_CX)


F5 = frame("05-the-theory", 3.5,
  f"""
    <div class="mount-c t5-range" id="t5-range"
         data-scale="{RANGE_SCALE_END:.6f}" style="left:{RANGE_CX}px; top:{RANGE_CY}px">
      <div class="sp-range">{range_html(FILM_BG)}</div>
    </div>
    <div class="t5-mkt r4-mkt headline" id="t5-mkt">DON&rsquo;T MEMORISE THE HAND. UNDERSTAND THE RANGE.</div>
    <div class="glass pn-why" id="t5-why"></div>
    {THEORY_COL.format(p="t5")}""",
  PANEL_CSS,
  f"""
      var range = q('#t5-range'), mkt = q('#t5-mkt'), why = q('#t5-why');
      var whyK = q('#t5-theory .pn-why-k'), ins = q('#t5-theory .pn-insight'),
          exp = q('#t5-theory .pn-explain');

      gsap.set(why,  {{ opacity: 0, height: 380 }});
      gsap.set(whyK, {{ opacity: 0, y: 10 }});
      gsap.set(ins,  {{ opacity: 0, y: 14 }});
      gsap.set(exp,  {{ opacity: 0, y: 12 }});

      var tl = gsap.timeline({{ paused: true }});
      /* the range moves aside as ONE object — the frame itself never pans */
      tl.to(range, {{ x: {RANGE_SLID_X - RANGE_CX:g}, duration: 0.9, ease: 'power3.inOut' }}, 0.3);
      tl.to(mkt,   {{ x: {RANGE_SLID_X - RANGE_CX:g}, duration: 0.9, ease: 'power3.inOut' }}, 0.3);
      tl.to(why, {{ opacity: 1, height: 460, duration: 0.75, ease: 'power3.out' }}, 1.20);
      tl.fromTo(whyK, {{ opacity: 0, y: 10 }}, {{ opacity: 1, y: 0, duration: 0.45, ease: 'power3.out' }}, 1.45);
      tl.fromTo(ins,  {{ opacity: 0, y: 14 }}, {{ opacity: 1, y: 0, duration: 0.60, ease: 'power3.out' }}, 1.70);
      tl.fromTo(exp,  {{ opacity: 0, y: 12 }}, {{ opacity: 1, y: 0, duration: 0.60, ease: 'power3.out' }}, 2.25);
      tl.to({{}}, {{ duration: 3.5 }}, 0);""")


F6 = frame("06-the-coach", 3,
  f"""{slid_range("tc")}
    <div class="glass pn-why"></div>
    {THEORY_COL.format(p="tc")}
    {COACH_COL.format(p="tc")}""",
  PANEL_CSS,
  """
      var whyK = q('#tc-theory .pn-why-k'), ins = q('#tc-theory .pn-insight'),
          exp = q('#tc-theory .pn-explain');
      var coach = q('#tc-coach'), quest = q('#tc-q'), ans = q('#tc-a');

      gsap.set([coach, quest, ans], { opacity: 0 });

      var tl = gsap.timeline({ paused: true, defaults: { ease: 'power3.out' } });
      tl.to(whyK, { opacity: 0, duration: 0.30, ease: 'power3.inOut' }, 0.20);
      tl.to([ins, exp], { opacity: 0, duration: 0.44, ease: 'power3.inOut' }, 0.22);
      tl.fromTo(coach, { opacity: 0 }, { opacity: 1, duration: 0.36 }, 0.50);
      tl.fromTo(quest, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.55 }, 0.90);
      tl.fromTo(ans,   { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.78 }, 1.52);
      tl.to({}, { duration: 3 }, 0);""")


F7 = frame("07-brand", 3,
  f"""
    <div class="br-scene" id="br-scene">
{slid_range("br")}
      <div class="glass pn-why"></div>
      {COACH_COL.format(p="br")}
    </div>
    <div class="br-mark" id="br-mark">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 9c-1.5 1.5-3 3.2-3 5.5A5.5 5.5 0 0 0 7.5 20c1.8 0 3-.5 4.5-2 1.5 1.5 2.7 2 4.5 2a5.5 5.5 0 0 0 5.5-5.5c0-2.3-1.5-4-3-5.5l-7-7-7 7Z" fill="currentColor"/>
        <path d="M12 17.4v4.6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>
      </svg>
    </div>
    <div class="br-wordmark" id="br-wordmark">Stacked<span class="grad">Poker</span></div>
    <div class="br-line br-line-1 display" id="br-l1">LEARN POKER.</div>
    <div class="br-line br-line-2 display" id="br-l2"><span class="grad">BY PLAYING.</span></div>
    <div class="br-cta" id="br-cta">START LEARNING FREE</div>""",
  PANEL_CSS + """
    .br-scene { position:absolute; left:0; top:0; width:1920px; height:1080px; }
    .br-mark { position:absolute; left:916px; top:300px; width:88px; height:88px;
               border-radius:22px; background:linear-gradient(135deg,#7C5CFF 0%,#5EA8FF 100%);
               display:flex; align-items:center; justify-content:center;
               box-shadow:0 26px 72px rgba(124,92,255,0.26); }
    .br-mark svg { width:46px; height:46px; display:block; color:#FFFFFF; }
    .br-wordmark { position:absolute; left:0; top:424px; width:1920px; text-align:center;
                   font-family:"Geist"; font-size:48px; font-weight:800; letter-spacing:-0.025em;
                   line-height:58px; color:#FFFFFF; }
    .br-line   { position:absolute; left:0; width:1920px; text-align:center;
                 font-size:72px; line-height:84px; }
    .br-line-1 { top:546px; }
    .br-line-2 { top:630px; }
    .br-cta { position:absolute; left:810px; top:770px; width:300px; height:60px;
              border-radius:100px; background:linear-gradient(135deg,#7C5CFF 0%,#5EA8FF 100%);
              display:flex; align-items:center; justify-content:center;
              font-family:"Geist"; font-size:17px; font-weight:600; letter-spacing:0.01em;
              color:#FFFFFF; box-shadow:0 22px 58px rgba(124,92,255,0.22); }""",
  """
      var scene = q('#br-scene'), mark = q('#br-mark'), wm = q('#br-wordmark');
      var l1 = q('#br-l1'), l2 = q('#br-l2'), cta = q('#br-cta');

      gsap.set([mark, wm, l1, l2, cta], { opacity: 0 });

      var tl = gsap.timeline({ paused: true, defaults: { ease: 'power3.out' } });
      tl.to(scene, { opacity: 0, duration: 0.72, ease: 'power3.inOut' }, 0.02);
      tl.fromTo(mark, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.50 }, 0.80);
      tl.fromTo(wm,   { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.42 }, 1.30);
      tl.fromTo(l1,   { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.46 }, 1.70);
      tl.fromTo(l2,   { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.46 }, 1.94);
      tl.fromTo(cta,  { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.42 }, 2.20);
      tl.to({}, { duration: 3 }, 0);""")


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    for name, html in [("01-the-hook", F1), ("02-the-spot", F2), ("03-the-decision", F3),
                       ("04-the-range", F4), ("05-the-theory", F5), ("06-the-coach", F6),
                       ("07-brand", F7)]:
        io.open(f"{OUT}/{name}.html", "w", encoding="utf-8").write(html)
        print(f"  wrote {name}.html  ({len(html)} bytes)")
