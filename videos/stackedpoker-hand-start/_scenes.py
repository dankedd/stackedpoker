# -*- coding: utf-8 -*-
"""Scenes 1-6."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _build import (frame, surf, cards_inner, table_inner, range_stack,
                    W, H, TABLE_S, CARD_HOOK, CARD_DEC, CARD_CX, CARD_HOOK_CY,
                    CARD_TABLE_CY, CARD_DEC_CY, TABLE_X, TABLE_Y, TABLE_W, TABLE_H,
                    OPTS_X, OPTS_Y, OPTS_S, OPTS_W, STATUS_S, STATUS_W,
                    RANGE_CX, RANGE_CY, RANGE_S, MBUILD)
from _mproduct import mobile_status_html, mobile_options_html
from _product import card_html

TABLE_CX, TABLE_CY = W / 2, TABLE_Y + TABLE_H / 2
STATUS_CY = 1540.0
OPTS_CY = OPTS_Y + (3 * 56 + 2 * 12) * MBUILD * OPTS_S / 2

PANEL = f"""
    .m-panel {{ position:absolute; left:-476px; top:-360px; width:952px; height:720px; }}
    .m-inner {{ position:absolute; left:-416px; top:-360px; width:832px; height:720px;
               display:flex; flex-direction:column; justify-content:center; }}
    .m-kick    {{ font-size:28px; }}
    .m-insight {{ font-size:52px; line-height:1.24; margin-top:48px; }}
    .m-explain {{ font-size:30px; margin-top:46px; }}
    .m-coach {{ display:flex; align-items:center; gap:18px; height:44px; }}
    .m-coach .label {{ font-size:26px; color:rgba(186,205,247,0.66); }}
    .m-bot {{ width:44px; height:44px; display:block; color:#7C5CFF; flex:none; }}
    .m-q {{ font-family:"Geist"; font-size:44px; font-weight:600; letter-spacing:-0.01em;
           line-height:1.32; color:#FFFFFF; margin-top:52px; }}
    .m-a {{ font-size:30px; margin-top:38px; }}
    .m-a em {{ font-style:normal; font-weight:600; color:#FFFFFF; }}"""

BOTMARK = ('<svg class="m-bot" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
           'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
           '<path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/>'
           '<path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>')

# "Which Hands Call Well", curriculum.ts — the lesson's own words, trimmed to
# the clause that covers TT. Nothing added.
THEORY = ('<div class="m-inner" id="{p}-theory">'
          '<div class="label m-kick">WHY?</div>'
          '<div class="headline m-insight">Pocket pairs make natural calls against '
          'a 3-bet &mdash; they retain equity and playability.</div>'
          '<div class="body m-explain">Marginal offsuit broadways suffer instead, from '
          'domination and poor equity realization.</div></div>')

# the Call option's own authored feedback (trb-final-5)
COACH = ('<div class="m-inner" id="{p}-coachcol">'
         '<div class="m-coach" id="{p}-coach">' + BOTMARK +
         '<div class="label">AI Coach</div></div>'
         '<div class="m-q" id="{p}-q">Why not 4-bet with a pair this big?</div>'
         '<div class="body m-a" id="{p}-a">'
         '<span id="{p}-a1"><em>TT has real value</em> but isn&rsquo;t quite strong enough '
         'to prefer 4-betting over just calling. </span>'
         '<span id="{p}-a2">It plays well as a call: enough equity to continue, with '
         'implied odds if it flops a set.</span></div></div>')


def status_surf(idp, o=1.0, z=0.0):
    return surf(f"{idp}-status", mobile_status_html(), W / 2, STATUS_CY,
                s=STATUS_S, o=o, z=z, cls="st")


def opts_surf(idp, resolved, o=1.0, z=0.0, suffix=""):
    return surf(f"{idp}-opts{suffix}", mobile_options_html(resolved), W / 2, OPTS_CY,
                s=OPTS_S, o=o, z=z, cls="op")


# ══ 1 — THE HAND. 2.0s. ══════════════════════════════════════════════════
S1 = frame("01-hand", 2.0,
  f"""
    <div class="room">
      {surf("h-cards", cards_inner(), CARD_CX, CARD_HOOK_CY, s=CARD_HOOK, z=0)}
    </div>
    <div class="ctr headline" id="h-l1" style="top:1290px; font-size:44px">IT STARTS WITH TWO CARDS.</div>""",
  "",
  """
      var cards = q('#h-cards'), l1 = q('#h-l1');
      var cardEls = qa('#h-cards .sp-card');
      gsap.set(cards, { z: -520 });
      gsap.set(cardEls, { opacity: 0 });
      gsap.set(l1, { opacity: 0, y: 16 });

      var tl = gsap.timeline({ paused: true, defaults: { ease: EASE } });
      /* one card, then the other 110ms later — the reference's own beat */
      tl.fromTo(cardEls[0], { opacity: 0, y: -40 }, { opacity: 1, y: 0, duration: 0.50 }, 0.10);
      tl.fromTo(cardEls[1], { opacity: 0, y: -40 }, { opacity: 1, y: 0, duration: 0.50 }, 0.21);
      /* and the pair drifts toward camera through the whole shot */
      tl.to(cards, { z: 0, duration: 1.9, ease: 'none' }, 0.10);
      tl.fromTo(l1, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.45 }, 0.72);
      tl.to({}, { duration: 2.0 }, 0);""")

# ══ 2 — CONTEXT. 2.0s. The table builds around the pair. ═════════════════
S2 = frame("02-context", 2.0,
  f"""
    <div class="room">
      {surf("c-table", table_inner(), TABLE_CX, TABLE_CY, s=TABLE_S, o=0)}
      {surf("c-cards", cards_inner(), CARD_CX, CARD_HOOK_CY, s=CARD_HOOK, z=0)}
      {status_surf("c", o=0)}
    </div>
    <div class="ctr headline" id="c-l1" style="top:300px; font-size:44px">IT STARTS WITH TWO CARDS.</div>
    <div class="ctr headline" id="c-l2" style="top:300px; font-size:44px">BUT THE CARDS AREN&rsquo;T THE DECISION.</div>""",
  "",
  f"""
      var cards = q('#c-cards'), table = q('#c-table'), status = q('#c-status');
      var l1 = q('#c-l1'), l2 = q('#c-l2');
      var rail = q('.mt-rail'), felt = q('.mt-felt'), shadow = q('.mt-railshadow');
      var seats = qa('.mt-seat'), metas = qa('.mt-meta');
      var folded = seats.filter(function (e) {{ return e.classList.contains('mt-seat-folded'); }});
      var live   = seats.filter(function (e) {{ return !e.classList.contains('mt-seat-folded'); }});

      gsap.set(q('#c-table'), {{ opacity: 1 }});
      gsap.set([rail, felt, shadow], {{ opacity: 0 }});
      gsap.set(live.concat(metas), {{ opacity: 0 }});
      gsap.set(folded, {{ opacity: 0 }});
      gsap.set(qa('.mt-chips').concat([q('.mt-pot')]), {{ opacity: 0 }});
      gsap.set(l2, {{ opacity: 0, y: 16 }});

      var tl = gsap.timeline({{ paused: true, defaults: {{ ease: EASE }} }});
      /* the pair falls back into the table's own card zone */
      tl.to(cards, {{ scale: {TABLE_S:.6f}, y: {CARD_TABLE_CY - CARD_HOOK_CY:.2f},
                     z: -180, duration: 1.05 }}, 0.05);
      tl.fromTo([shadow, rail, felt], {{ opacity: 0 }}, {{ opacity: 1, duration: 0.62 }}, 0.30);
      tl.fromTo(live,   {{ opacity: 0 }}, {{ opacity: 1,    duration: 0.34, stagger: 0.05 }}, 0.62);
      tl.fromTo(folded, {{ opacity: 0 }}, {{ opacity: 0.35, duration: 0.34, stagger: 0.05 }}, 0.62);
      tl.fromTo(metas,  {{ opacity: 0 }}, {{ opacity: 1, duration: 0.34, stagger: 0.05 }}, 0.78);
      tl.fromTo(status, {{ opacity: 0 }}, {{ opacity: 1, duration: 0.36 }}, 1.16);
      tl.to(l1, {{ opacity: 0, duration: 0.28, ease: 'power2.inOut' }}, 0.62);
      tl.fromTo(l2, {{ opacity: 0, y: 16 }}, {{ opacity: 1, y: 0, duration: 0.45 }}, 0.88);
      tl.to({{}}, {{ duration: 2.0 }}, 0);""")

# ══ 3 — ACTION. 1.8s. HJ opens, CO 3-bets. ═══════════════════════════════
S3 = frame("03-action", 1.8,
  f"""
    <div class="room">
      {surf("a-table", table_inner(), TABLE_CX, TABLE_CY, s=TABLE_S)}
      {surf("a-cards", cards_inner(), CARD_CX, CARD_TABLE_CY, s=TABLE_S, z=-180)}
      {status_surf("a")}
    </div>
    <div class="ctr headline" id="a-l2" style="top:300px; font-size:44px">BUT THE CARDS AREN&rsquo;T THE DECISION.</div>""",
  "",
  """
      var chips = qa('.mt-chips'), pot = q('.mt-pot'), l2 = q('#a-l2');
      var table = q('#a-table'), cards = q('#a-cards'), status = q('#a-status');
      gsap.set(chips, { opacity: 0 });
      gsap.set(pot, { opacity: 0 });

      var tl = gsap.timeline({ paused: true, defaults: { ease: EASE } });
      /* the camera pushes toward the decision through the whole beat — chips at
         this scale are too small to carry the shot on their own */
      tl.to(table,  { z: 190, duration: 1.8, ease: 'none' }, 0);
      tl.to(cards,  { z: 10,  duration: 1.8, ease: 'none' }, 0);
      tl.to(status, { z: 190, duration: 1.8, ease: 'none' }, 0);
      /* blinds, then Hero's open, then the 3-bet that changes the question */
      tl.fromTo(chips[2], { opacity: 0 }, { opacity: 1, duration: 0.26 }, 0.10);
      tl.fromTo(chips[3], { opacity: 0 }, { opacity: 1, duration: 0.26 }, 0.19);
      /* the two raises travel seat -> pot, the way the real table plays them back */
      tl.fromTo(chips[0], { opacity: 0, x: 0, y: 369 },
                          { opacity: 1, x: 0, y: 0, duration: 0.46 }, 0.38);
      tl.fromTo(chips[1], { opacity: 0, x: -270, y: 341 },
                          { opacity: 1, x: 0, y: 0, duration: 0.54 }, 0.78);
      tl.fromTo(pot, { opacity: 0 }, { opacity: 1, duration: 0.36 }, 1.16);
      tl.to(l2, { opacity: 0, duration: 0.30, ease: 'power2.inOut' }, 1.42);
      tl.to({}, { duration: 1.8 }, 0);""")

# ══ 4 — DECISION. 2.0s. The table recedes, the choice comes forward. ═════
S4 = frame("04-decision", 2.0,
  f"""
    <div class="room">
      {surf("d-table", table_inner(), TABLE_CX, TABLE_CY, s=TABLE_S, z=190)}
      {surf("d-cards", cards_inner(), CARD_CX, CARD_TABLE_CY, s=TABLE_S, z=10)}
      {status_surf("d", z=190)}
      {opts_surf("d", False, o=0, z=-420)}
    </div>
    <div class="ctr headline" id="d-q" style="top:560px; font-size:56px">WHAT DO YOU DO?</div>""",
  "",
  f"""
      var table = q('#d-table'), status = q('#d-status'), cards = q('#d-cards');
      var opts = q('#d-opts'), qn = q('#d-q');
      gsap.set(qn, {{ opacity: 0, y: 14 }});

      var tl = gsap.timeline({{ paused: true, defaults: {{ ease: EASE }} }});
      /* the table tilts away into the room — it does not simply fade */
      tl.to(table,  {{ z: -560, rotationX: 11, opacity: 0.16, duration: 0.85 }}, 0.05);
      tl.to(status, {{ z: -560, rotationX: 11, opacity: 0, duration: 0.70 }}, 0.05);
      tl.to(cards,  {{ z: -60, y: {CARD_DEC_CY - CARD_TABLE_CY:.2f},
                      scale: {CARD_DEC:.6f}, duration: 0.85 }}, 0.05);
      /* and the decision arrives from behind the glass, toward camera */
      tl.fromTo(opts, {{ opacity: 0, z: -420 }}, {{ opacity: 1, z: 0, duration: 0.70 }}, 0.52);
      tl.fromTo(qn, {{ opacity: 0, y: 14 }}, {{ opacity: 1, y: 0, duration: 0.42 }}, 0.40);
      /* then it holds, so the viewer answers it themselves */
      tl.to({{}}, {{ duration: 2.0 }}, 0);""")

# ══ 5 — RANGE REVEAL. 2.4s. TT becomes its cell. ═════════════════════════
S5 = frame("05-range", 2.4,
  f"""
    <div class="room">
      {surf("r-table", table_inner(), TABLE_CX, TABLE_CY, s=TABLE_S, z=-560, rx=11, o=0.16)}
      {surf("r-cards", cards_inner(), CARD_CX, CARD_DEC_CY, s=CARD_DEC, z=-60)}
      {opts_surf("r", False)}
      {opts_surf("r", True, o=0, suffix="-res")}
{range_stack("r")}
    </div>
    <div class="ctr headline" id="r-q" style="top:560px; font-size:56px">WHAT DO YOU DO?</div>""",
  PANEL,
  """
      var table = q('#r-table'), cards = q('#r-cards'), qn = q('#r-q');
      var idle = q('#r-opts'), res = q('#r-opts-res');
      var wraps = qa('.rw');
      var acts = qa('#r-rw0 .sp-act'), ring = q('#r-rw0 .sp-ring');
      var legend = q('#r-r0-legend'), title = q('#r-r0-title'), illus = q('#r-r0-illus');

      wraps.forEach(function (el, i) { gsap.set(el, { opacity: 0 }); });
      gsap.set(acts, { opacity: 0 });
      gsap.set([ring, legend, illus], { opacity: 0 });

      var tl = gsap.timeline({ paused: true, defaults: { ease: EASE } });
      /* the answer resolves first — Call, the option the lesson marks perfect */
      tl.to(idle, { opacity: 0, duration: 0.36, ease: 'power2.inOut' }, 0.06);
      tl.to(res,  { opacity: 1, duration: 0.36, ease: 'power2.inOut' }, 0.06);
      tl.to(qn, { opacity: 0, duration: 0.30, ease: 'power2.inOut' }, 0.46);
      /* then the whole decision recedes and the grid comes through it */
      tl.to([res, cards], { z: -620, opacity: 0, duration: 0.68 }, 0.62);
      tl.to(table, { opacity: 0, duration: 0.50 }, 0.62);
      tl.fromTo(wraps[0], { opacity: 0, z: -300 }, { opacity: 1, z: 0, duration: 0.72 }, 0.86);
      tl.fromTo(title, { opacity: 0 }, { opacity: 1, duration: 0.34 }, 1.06);
      /* the strategy resolves across all 169 cells in ONE tween */
      tl.fromTo(acts, { opacity: 0 }, { opacity: 1, duration: 0.52, ease: 'power2.out' }, 1.26);
      /* only then is the hand under discussion ringed */
      tl.fromTo(ring, { opacity: 0 }, { opacity: 1, duration: 0.36 }, 1.72);
      tl.fromTo([legend, illus], { opacity: 0 }, { opacity: 1, duration: 0.34 }, 1.84);
      tl.to({}, { duration: 2.4 }, 0);""")

# ══ 6 — RANGE DEPTH. 2.4s. Four canonical ranges, one grid. ══════════════
S6 = frame("06-depth", 2.4,
  f"""
    <div class="room">
{range_stack("m")}
    </div>""",
  PANEL,
  """
      var wraps = qa('.rw');
      wraps.forEach(function (el, i) { gsap.set(el, { opacity: i === 0 ? 1 : 0 }); });
      var tl = gsap.timeline({ paused: true, defaults: { ease: 'power2.inOut' } });
      /* HJ response -> UTG 22 hands -> CO 48 -> BTN 78 -> BB defend 84.
         The grid never moves; the eye reads only the strategy changing. */
      var beats = [0.30, 0.78, 1.26, 1.74];
      for (var i = 0; i < beats.length; i++) {
        tl.to(wraps[i],     { opacity: 0, duration: 0.20 }, beats[i]);
        tl.to(wraps[i + 1], { opacity: 1, duration: 0.20 }, beats[i]);
      }
      tl.to({}, { duration: 2.4 }, 0);""")
