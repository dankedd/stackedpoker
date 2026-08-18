# -*- coding: utf-8 -*-
"""The twelve scenes."""
import io, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _build import (frame, cards_mount, table_mount, opts_mount, range_stack,
                    OUT, W, H, MBUILD, FILM_BG, TABLE_S, CARD_DEC, CARD_HOOK_CY,
                    CARD_TABLE_CY, CARD_DEC_CY, OPTS_X, OPTS_Y, OPTS_S)

BOTMARK = ('<svg class="m-bot" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
           'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
           '<path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/>'
           '<path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>')

PANEL = """
    .m-panel { position:absolute; left:64px; top:560px; width:952px; height:720px; }
    .m-inner { position:absolute; left:124px; top:560px; width:832px; height:720px;
               display:flex; flex-direction:column; justify-content:center; }
    .m-kick    { font-size:28px; }
    .m-insight { font-size:56px; line-height:1.22; margin-top:52px; }
    .m-explain { font-size:31px; margin-top:52px; }
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
         '<div class="body m-a" id="{p}-a">'
         '<span id="{p}-a1"><em>Only the SB and BB</em> are left to act. </span>'
         '<span id="{p}-a2">Fewer players behind is part of why the Button is such a '
         'strong 3-betting seat.</span></div></div>')

# Eight terms the curriculum actually teaches, set as an editorial two-column
# block around a centre gutter — never a word cloud.
TERM_ROWS = [("RANGES", "GTO"), ("SOLVERS", "BLOCKERS"),
             ("MDF", "EQUITY"), ("BET SIZING", "POSITION")]
TERM_HTML = "".join(
    f'<div class="term term-l" id="tm{i*2}" style="top:{690 + i*104}px">{a}</div>'
    f'<div class="term term-r" id="tm{i*2+1}" style="top:{690 + i*104}px">{b}</div>'
    for i, (a, b) in enumerate(TERM_ROWS))

MORE_CSS = """
    .term { position:absolute; font-family:"Geist Mono"; font-size:52px; font-weight:500;
            letter-spacing:0.13em; text-transform:uppercase; color:rgba(186,205,247,0.62);
            white-space:nowrap; will-change:transform; }
    .term-l { left:70px;  width:450px; text-align:right; }
    .term-r { left:560px; width:450px; text-align:left; }
    .more { position:absolute; left:0; width:1080px; text-align:center; top:470px;
            font-size:150px; line-height:1; }"""

# ══ 1 — MORE. 2.0s. The noise. ═══════════════════════════════════════════
S1 = frame("01-more", 2.3,
  f"""
    <div class="more display" id="more">MORE.</div>
    {TERM_HTML}""",
  MORE_CSS,
  """
      var more = q('#more'), terms = qa('.term');
      gsap.set(more, { opacity: 0, y: 18 });
      gsap.set(terms, { opacity: 0, y: 12 });

      var tl = gsap.timeline({ paused: true, defaults: { ease: EASE } });
      tl.fromTo(more, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.42 }, 0.06);
      /* eight terms, 170ms apart — they accumulate rather than fly */
      for (var i = 0; i < terms.length; i++) {
        tl.fromTo(terms[i], { opacity: 0, y: 12 },
                            { opacity: 1, y: 0, duration: 0.30 }, 0.50 + i * 0.165);
      }
      tl.to({}, { duration: 2.3 }, 0);""")

# ══ 2 — ENOUGH. 1.0s. Everything stops. ══════════════════════════════════
S2 = frame("02-enough", 0.9,
  f"""
    <div class="more display" id="more">MORE.</div>
    {TERM_HTML}
    <div class="ctr display" id="enough" style="top:880px; font-size:170px; line-height:1">ENOUGH.</div>""",
  MORE_CSS,
  """
      var more = q('#more'), terms = qa('.term'), enough = q('#enough');
      gsap.set(enough, { opacity: 0 });

      var tl = gsap.timeline({ paused: true, defaults: { ease: EASE } });
      /* the noise does not fade out politely — it is cut */
      tl.to(terms.concat([more]), { opacity: 0, duration: 0.14, ease: 'power2.in' }, 0.10);
      tl.fromTo(enough, { opacity: 0 }, { opacity: 1, duration: 0.34 }, 0.30);
      tl.to({}, { duration: 0.9 }, 0);""")

# ══ 3 — THE REAL TABLE. 2.0s. ════════════════════════════════════════════
S3 = frame("03-table", 2.0,
  f"""
    <div class="ctr display" id="enough" style="top:880px; font-size:170px; line-height:1">ENOUGH.</div>
{table_mount("t")}
{cards_mount("t", TABLE_S, CARD_TABLE_CY)}""",
  "",
  """
      var enough = q('#enough'), status = q('#t-status'), cards = q('#t-cards');
      var rail = q('.mt-rail'), felt = q('.mt-felt'), shadow = q('.mt-railshadow');
      var seats = qa('.mt-seat'), metas = qa('.mt-meta'), chips = qa('.mt-chips'), pot = q('.mt-pot');
      var folded = seats.filter(function (e) { return e.classList.contains('mt-seat-folded'); });
      var live   = seats.filter(function (e) { return !e.classList.contains('mt-seat-folded'); });
      var cardEls = qa('#t-cards .sp-card');

      gsap.set([rail, felt, shadow], { opacity: 0 });
      gsap.set(live.concat(metas), { opacity: 0 });
      gsap.set(folded, { opacity: 0 });
      gsap.set([pot, status].concat(chips), { opacity: 0 });
      gsap.set(cardEls, { opacity: 0 });

      var tl = gsap.timeline({ paused: true, defaults: { ease: EASE } });
      tl.to(enough, { opacity: 0, duration: 0.30, ease: 'power2.inOut' }, 0.05);
      tl.fromTo([shadow, rail, felt], { opacity: 0 }, { opacity: 1, duration: 0.62 }, 0.22);
      tl.fromTo(cardEls, { opacity: 0, y: -30 }, { opacity: 1, y: 0, duration: 0.45, stagger: 0.10 }, 0.55);
      tl.fromTo(live,   { opacity: 0 }, { opacity: 1,    duration: 0.34, stagger: 0.04 }, 0.70);
      tl.fromTo(folded, { opacity: 0 }, { opacity: 0.35, duration: 0.34, stagger: 0.04 }, 0.70);
      tl.fromTo(metas,  { opacity: 0 }, { opacity: 1, duration: 0.34, stagger: 0.04 }, 0.84);
      tl.fromTo(chips[0], { opacity: 0 }, { opacity: 1, duration: 0.28 }, 1.02);
      tl.fromTo(chips[1], { opacity: 0 }, { opacity: 1, duration: 0.28 }, 1.10);
      tl.fromTo(chips[2], { opacity: 0 }, { opacity: 1, duration: 0.32 }, 1.24);
      tl.fromTo(pot,    { opacity: 0 }, { opacity: 1, duration: 0.34 }, 1.40);
      tl.fromTo(status, { opacity: 0 }, { opacity: 1, duration: 0.34 }, 1.56);
      tl.to({}, { duration: 2.0 }, 0);""")

# ══ 4 — WHAT DO YOU DO? 2.0s. The think pause. ═══════════════════════════
S4 = frame("04-decision", 2.0,
  f"""{table_mount("d")}
{cards_mount("d", TABLE_S, CARD_TABLE_CY)}
    <div class="ctr headline" id="d-q" data-gy="0" style="top:660px; font-size:64px">WHAT DO YOU DO?</div>
{opts_mount("d", False)}""",
  "",
  f"""
      var table = q('#d-table'), status = q('#d-status'), cards = q('#d-cards');
      var qn = q('#d-q'), btns = qa('#d-opts .mt-opt');

      gsap.set(qn, {{ opacity: 0, y: 14 }});
      gsap.set(btns, {{ opacity: 0, y: 18 }});

      var tl = gsap.timeline({{ paused: true, defaults: {{ ease: EASE }} }});
      tl.to([table, status], {{ opacity: 0, duration: 0.42, ease: 'power2.inOut' }}, 0.05);
      tl.to(cards, {{ scale: {CARD_DEC:.6f}, y: {CARD_DEC_CY - CARD_HOOK_CY:.2f}, duration: 0.58 }}, 0.05);
      tl.fromTo(qn, {{ opacity: 0, y: 14 }}, {{ opacity: 1, y: 0, duration: 0.40 }}, 0.38);
      tl.fromTo(btns, {{ opacity: 0, y: 18 }}, {{ opacity: 1, y: 0, duration: 0.40, stagger: 0.10 }}, 0.56);
      /* and then it holds, for a real second. The viewer answers. */
      tl.to({{}}, {{ duration: 2.0 }}, 0);""")

# ══ 5 — THE ANSWER. 1.1s. ════════════════════════════════════════════════
S5 = frame("05-answer", 1.1,
  f"""{cards_mount("a", CARD_DEC, CARD_DEC_CY)}
    <div class="ctr headline" id="a-q" data-gy="0" style="top:660px; font-size:64px">WHAT DO YOU DO?</div>
{opts_mount("a", False)}
{opts_mount("a", True, "-res")}
    <div class="ctr headline" id="a-l1" style="top:1180px; font-size:54px">YOU MIGHT KNOW THE ANSWER.</div>
    <div class="ctr display grad" id="a-l2" style="top:1268px; font-size:72px">BUT DO YOU KNOW WHY?</div>""",
  "",
  """
      var idle = q('#a-opts'), res = q('#a-opts-res');
      gsap.set(res, { opacity: 0 });
      /* present but unseen: scene 6's lines exist here only so the two frames
         either side of the cut are rasterised by the same layer tree */
      gsap.set([q('#a-l1'), q('#a-l2')], { opacity: 0 });
      var tl = gsap.timeline({ paused: true, defaults: { ease: EASE } });
      tl.to(idle, { opacity: 0, duration: 0.42, ease: 'power2.inOut' }, 0.12);
      tl.to(res,  { opacity: 1, duration: 0.42, ease: 'power2.inOut' }, 0.12);
      tl.to({}, { duration: 1.1 }, 0);""")

# ══ 6 — THE PIVOT. 1.6s. The whole ad turns here. ════════════════════════
S6 = frame("06-pivot", 1.6,
  f"""{cards_mount("p", CARD_DEC, CARD_DEC_CY)}
    <div class="ctr headline" id="p-q" data-gy="0" style="top:660px; font-size:64px">WHAT DO YOU DO?</div>
{opts_mount("p", False)}
{opts_mount("p", True, "-res")}
    <div class="ctr headline" id="p-l1" style="top:1180px; font-size:54px">YOU MIGHT KNOW THE ANSWER.</div>
    <div class="ctr display grad" id="p-l2" style="top:1268px; font-size:72px">BUT DO YOU KNOW WHY?</div>""",
  "",
  """
      var qn = q('#p-q'), l1 = q('#p-l1'), l2 = q('#p-l2');
      /* the option stack is inherited exactly as scene 5 leaves it — both layers
         present, written through GSAP, so the cut cannot re-rasterise them */
      gsap.set(q('#p-opts'), { opacity: 0 });
      gsap.set(q('#p-opts-res'), { opacity: 1 });
      gsap.set([l1, l2], { opacity: 0, y: 16 });
      var tl = gsap.timeline({ paused: true, defaults: { ease: EASE } });
      tl.to(qn, { opacity: 0, duration: 0.32, ease: 'power2.inOut' }, 0.05);
      tl.fromTo(l1, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.45 }, 0.30);
      /* a beat between the two lines — the pause IS the argument */
      tl.fromTo(l2, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.50 }, 0.85);
      tl.to({}, { duration: 1.6 }, 0);""")
