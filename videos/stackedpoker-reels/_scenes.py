# -*- coding: utf-8 -*-
"""The eleven scenes. 22.0s total, rhythm rather than uniform speed."""
import io, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _build import (frame, cards_mount, table_mount, opts_mount, range_mount,
                    OUT, W, MBUILD, FILM_BG, CARD_HOOK, CARD_DEC, CARD_HOOK_CY,
                    CARD_TABLE_CY, CARD_DEC_CY, TABLE_S, RANGE_S, RANGE_CX, RANGE_CY)
from _ranges import HERO, MONTAGE, grid_html, COUNTS

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

HOOK_TXT = ('<div class="ctr headline" id="{p}-l1" data-gy="0" style="top:1210px; font-size:62px">'
            'YOU HAVE A DECISION.</div>'
            '<div class="ctr headline grad" id="{p}-l2" data-gy="0" style="top:1292px; font-size:62px">'
            'WHAT DO YOU DO?</div>')

# ══ 1 — HOOK. 2.0s. The hand, nothing else. ═══════════════════════════════
S1 = frame("01-hook", 2.0,
  f"""{table_mount("h")}
{cards_mount("h", CARD_HOOK, CARD_HOOK_CY)}
""" + HOOK_TXT.format(p="h"),
  "",
  """
      var l1 = q('#h-l1'), l2 = q('#h-l2');
      var cardEls = qa('#h-cards .sp-card');
      /* the table is present but unseen — it exists so the hook and the spot
         share one layer tree and the cards rasterise identically across the cut */
      gsap.set(qa('#h-table .mt-rail, #h-table .mt-felt, #h-table .mt-railshadow, '
              + '#h-table .mt-seat, #h-table .mt-meta, #h-table .mt-chips, #h-table .mt-pot'),
              { opacity: 0 });
      gsap.set(q('#h-status'), { opacity: 0 });
      gsap.set([l1, l2], { opacity: 0, y: 14 });
      gsap.set(cardEls, { opacity: 0 });

      var tl = gsap.timeline({ paused: true, defaults: { ease: EASE } });
      /* card one snaps, card two follows ~110ms later */
      tl.fromTo(cardEls[0], { opacity: 0, y: -60, rotation: -1.5, scale: 1.06 },
                            { opacity: 1, y: 0, rotation: 0, scale: 1, duration: 0.55 }, 0.10);
      tl.fromTo(cardEls[1], { opacity: 0, y: -60, rotation: 1.5, scale: 1.06 },
                            { opacity: 1, y: 0, rotation: 0, scale: 1, duration: 0.55 }, 0.21);
      tl.fromTo(l1, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.45 }, 0.72);
      tl.fromTo(l2, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.45 }, 0.90);
      tl.to({}, { duration: 2.0 }, 0);""")

# ══ 2 — THE SPOT. 2.2s. The real table builds around the hand. ════════════
S2 = frame("02-spot", 2.2,
  f"""{table_mount("s")}
{cards_mount("s", CARD_HOOK, CARD_HOOK_CY)}
""" + HOOK_TXT.format(p="s"),
  "",
  f"""
      var l1 = q('#s-l1'), l2 = q('#s-l2'), cards = q('#s-cards'), status = q('#s-status');
      var rail = q('.mt-rail'), felt = q('.mt-felt'), shadow = q('.mt-railshadow');
      var seats = qa('.mt-seat'), metas = qa('.mt-meta'), chips = qa('.mt-chips'), pot = q('.mt-pot');
      var folded = seats.filter(function (e) {{ return e.classList.contains('mt-seat-folded'); }});
      var live   = seats.filter(function (e) {{ return !e.classList.contains('mt-seat-folded'); }});

      gsap.set([rail, felt, shadow], {{ opacity: 0 }});
      gsap.set(live.concat(metas), {{ opacity: 0, y: 10 }});
      gsap.set(folded, {{ opacity: 0, y: 10 }});
      gsap.set(chips, {{ opacity: 0 }});
      gsap.set([pot, status], {{ opacity: 0 }});

      var tl = gsap.timeline({{ paused: true, defaults: {{ ease: EASE }} }});
      tl.to([l1, l2], {{ opacity: 0, duration: 0.35, ease: 'power2.inOut' }}, 0.05);
      tl.fromTo([shadow, rail, felt], {{ opacity: 0 }}, {{ opacity: 1, duration: 0.70 }}, 0.25);
      tl.to(cards, {{ scale: {TABLE_S:.6f}, y: {CARD_TABLE_CY - CARD_HOOK_CY:.2f},
                      duration: 0.75 }}, 0.25);
      tl.fromTo(live,   {{ opacity: 0, y: 10 }}, {{ opacity: 1,    y: 0, duration: 0.38, stagger: 0.045 }}, 0.72);
      tl.fromTo(folded, {{ opacity: 0, y: 10 }}, {{ opacity: 0.35, y: 0, duration: 0.38, stagger: 0.045 }}, 0.72);
      tl.fromTo(metas,  {{ opacity: 0, y: 10 }}, {{ opacity: 1, y: 0, duration: 0.38, stagger: 0.045 }}, 0.88);
      tl.fromTo(chips[0], {{ opacity: 0 }}, {{ opacity: 1, duration: 0.30 }}, 1.10);
      tl.fromTo(chips[1], {{ opacity: 0 }}, {{ opacity: 1, duration: 0.30 }}, 1.20);
      tl.fromTo(chips[2], {{ opacity: 0 }}, {{ opacity: 1, duration: 0.34 }}, 1.38);
      tl.fromTo(pot,    {{ opacity: 0 }}, {{ opacity: 1, duration: 0.36 }}, 1.55);
      tl.fromTo(status, {{ opacity: 0 }}, {{ opacity: 1, duration: 0.36 }}, 1.72);
      tl.to({{}}, {{ duration: 2.2 }}, 0);""")

# ══ 3 — THE OPTIONS. 1.6s. This is the deliberate pause. ══════════════════
S3 = frame("03-options", 1.6,
  f"""{table_mount("o")}
{cards_mount("o", TABLE_S, CARD_TABLE_CY)}
    <div class="ctr headline" id="o-q" data-gy="0" style="top:660px; font-size:60px">WHAT WOULD YOU DO?</div>
{opts_mount("o", False)}""",
  "",
  f"""
      var table = q('#o-table'), status = q('#o-status'), cards = q('#o-cards');
      var qn = q('#o-q'), btns = qa('#o-opts .mt-opt');

      gsap.set(qn, {{ opacity: 0, y: 14 }});
      gsap.set(btns, {{ opacity: 0, y: 18 }});

      var tl = gsap.timeline({{ paused: true, defaults: {{ ease: EASE }} }});
      tl.to([table, status], {{ opacity: 0, duration: 0.45, ease: 'power2.inOut' }}, 0.05);
      tl.to(cards, {{ scale: {CARD_DEC:.6f}, y: {CARD_DEC_CY - CARD_HOOK_CY:.2f}, duration: 0.60 }}, 0.05);
      tl.fromTo(qn, {{ opacity: 0, y: 14 }}, {{ opacity: 1, y: 0, duration: 0.42 }}, 0.42);
      /* 100ms stagger — responsive, never nervous */
      tl.fromTo(btns, {{ opacity: 0, y: 18 }}, {{ opacity: 1, y: 0, duration: 0.42, stagger: 0.10 }}, 0.62);
      /* and then it simply holds. The viewer answers. */
      tl.to({{}}, {{ duration: 1.6 }}, 0);""")

# ══ 4 — THE ANSWER. 1.4s. ════════════════════════════════════════════════
S4 = frame("04-answer", 1.4,
  f"""{cards_mount("a", CARD_DEC, CARD_DEC_CY)}
    <div class="ctr headline" id="a-q" data-gy="0" style="top:660px; font-size:60px">WHAT WOULD YOU DO?</div>
{opts_mount("a", False)}
{opts_mount("a", True, "-res")}""",
  "",
  """
      var idle = q('#a-opts'), res = q('#a-opts-res');
      gsap.set(res, { opacity: 0 });
      var tl = gsap.timeline({ paused: true, defaults: { ease: EASE } });
      tl.to(idle, { opacity: 0, duration: 0.45, ease: 'power2.inOut' }, 0.20);
      tl.to(res,  { opacity: 1, duration: 0.45, ease: 'power2.inOut' }, 0.20);
      tl.to({}, { duration: 1.4 }, 0);""")
