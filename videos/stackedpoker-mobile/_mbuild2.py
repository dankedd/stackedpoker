# -*- coding: utf-8 -*-
"""The seven portrait scenes."""
import io, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _mbuild import (frame, cards_mount, table_mount, range_html, mobile_options_html,
                     mobile_status_html, OUT, W, MBUILD, FILM_BG,
                     CARD_HOOK, TABLE_S, CARD_TABLE, CARD_DEC, OPTS_S, RANGE_S,
                     TABLE_X, TABLE_Y, TABLE_W, TABLE_H,
                     CARD_CX, CARD_HOOK_CY, CARD_TABLE_CY, CARD_DEC_CY)

OPTS_W = 358 * MBUILD * OPTS_S
OPTS_X = (W - OPTS_W) / 2
OPTS_Y = 820.0
STATUS_S = 0.38
STATUS_W = 358 * MBUILD * STATUS_S

# ══════════════════════════════════════════════════════════════════════════
# 1 — THE HOOK.  The real hand, large. Nothing else on screen.
# ══════════════════════════════════════════════════════════════════════════
F1 = frame("01-hook", 4.0,
  f"""
    <div class="ctr label" id="h-kicker" style="top:452px; font-size:34px; color:rgba(186,205,247,0.78)">YOU HAVE</div>
{table_mount("h")}
{cards_mount("h", CARD_HOOK, CARD_HOOK_CY)}
    <div class="ctr headline" id="h-q" style="top:1250px; font-size:74px">WHAT DO YOU DO?</div>""",
  "",
  """
      var kick = q('#h-kicker'), cards = q('#h-cards'), qn = q('#h-q');
      var cardEls = qa('#h-cards .sp-card');
      /* The table is present but unseen. It is hidden the SAME way frame 2 hides
         it — child by child, never by fading the container — because an opacity
         on the container makes its own layer and re-rasterises everything above. */
      gsap.set(qa('#h-table .mt-rail, #h-table .mt-felt, #h-table .mt-railshadow, '
                + '#h-table .mt-seat, #h-table .mt-meta, #h-table .mt-chips, #h-table .mt-pot'),
               { opacity: 0 });
      gsap.set(kick, { opacity: 0, y: 12 });
      gsap.set(qn,   { opacity: 0, y: 16 });
      gsap.set(cardEls, { opacity: 0 });

      var tl = gsap.timeline({ paused: true, defaults: { ease: 'power3.out' } });
      tl.fromTo(kick, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.70 }, 0.35);
      tl.fromTo(cardEls[0], { opacity: 0, y: -90, rotation: -1.5 },
                            { opacity: 1, y: 0, rotation: 0, duration: 1.00 }, 0.95);
      tl.fromTo(cardEls[1], { opacity: 0, y: -90, rotation: 1.5 },
                            { opacity: 1, y: 0, rotation: 0, duration: 0.95 }, 1.45);
      tl.fromTo(qn, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.80 }, 2.35);
      tl.to({}, { duration: 4.0 }, 0);""")

# ══════════════════════════════════════════════════════════════════════════
# 2 — THE SPOT.  The product's OWN portrait table builds around the hand.
# ══════════════════════════════════════════════════════════════════════════
F2 = frame("02-spot", 4.5,
  f"""
    <div class="ctr label" id="s-kicker" style="top:452px; font-size:34px; color:rgba(186,205,247,0.78)">YOU HAVE</div>
    <div class="ctr headline" id="s-q" style="top:1250px; font-size:74px">WHAT DO YOU DO?</div>
{table_mount("s")}
    <div class="mount s-status" id="s-status"
         style="left:{(W - STATUS_W) / 2:.2f}px; top:1500px; transform:scale({STATUS_S:.6f})">
      {mobile_status_html()}
    </div>
{cards_mount("s", CARD_HOOK, CARD_HOOK_CY)}""",
  "",
  f"""
      var kick = q('#s-kicker'), qn = q('#s-q');
      var table = q('#s-table'), status = q('#s-status'), cards = q('#s-cards');
      var rail = q('.mt-rail'), felt = q('.mt-felt'), shadow = q('.mt-railshadow');
      var seats = qa('.mt-seat'), metas = qa('.mt-meta'), chips = qa('.mt-chips');
      var pot = q('.mt-pot');
      var foldedSeats = seats.filter(function (e) {{ return e.classList.contains('mt-seat-folded'); }});
      var liveSeats   = seats.filter(function (e) {{ return !e.classList.contains('mt-seat-folded'); }});

      gsap.set([rail, felt, shadow], {{ opacity: 0 }});
      gsap.set(liveSeats.concat(metas), {{ opacity: 0, y: 10 }});
      gsap.set(foldedSeats, {{ opacity: 0, y: 10 }});
      gsap.set(chips, {{ opacity: 0 }});
      gsap.set([pot, status], {{ opacity: 0 }});

      var tl = gsap.timeline({{ paused: true, defaults: {{ ease: 'power3.out' }} }});
      /* the question has been asked; it clears so the table can be read */
      tl.to([kick, qn], {{ opacity: 0, duration: 0.60, ease: 'power3.inOut' }}, 0.15);
      /* the real table forms and the hand settles into its seat */
      tl.fromTo([shadow, rail, felt], {{ opacity: 0 }}, {{ opacity: 1, duration: 1.10 }}, 0.55);
      tl.to(cards, {{ scale: {CARD_TABLE:.6f}, y: {CARD_TABLE_CY - CARD_HOOK_CY:.2f},
                      duration: 1.10, ease: 'power3.inOut' }}, 0.55);
      /* seats, then the action in the lesson's own order */
      tl.fromTo(liveSeats,   {{ opacity: 0, y: 10 }}, {{ opacity: 1,    y: 0, duration: 0.55, stagger: 0.05 }}, 1.55);
      tl.fromTo(foldedSeats, {{ opacity: 0, y: 10 }}, {{ opacity: 0.35, y: 0, duration: 0.55, stagger: 0.05 }}, 1.55);
      tl.fromTo(metas, {{ opacity: 0, y: 10 }}, {{ opacity: 1, y: 0, duration: 0.55, stagger: 0.05 }}, 1.80);
      tl.fromTo(chips[0], {{ opacity: 0 }}, {{ opacity: 1, duration: 0.45 }}, 2.20);
      tl.fromTo(chips[1], {{ opacity: 0 }}, {{ opacity: 1, duration: 0.45 }}, 2.40);
      tl.fromTo(chips[2], {{ opacity: 0 }}, {{ opacity: 1, duration: 0.50 }}, 2.75);
      tl.fromTo(pot, {{ opacity: 0 }}, {{ opacity: 1, duration: 0.55 }}, 3.15);
      tl.fromTo(status, {{ opacity: 0 }}, {{ opacity: 1, duration: 0.55 }}, 3.45);
      tl.to({{}}, {{ duration: 4.5 }}, 0);""")

# ══════════════════════════════════════════════════════════════════════════
# 3 — THE DECISION.  One thing at a time: the hand, the question, the options.
# ══════════════════════════════════════════════════════════════════════════
F3 = frame("03-decision", 4.5,
  f"""
{table_mount("d")}
    <div class="mount d-status" id="d-status"
         style="left:{(W - STATUS_W) / 2:.2f}px; top:1500px; transform:scale({STATUS_S:.6f})">
      {mobile_status_html()}
    </div>
{cards_mount("d", CARD_TABLE, CARD_TABLE_CY)}
    <div class="ctr headline" id="d-q" style="top:660px; font-size:60px">WHAT WOULD YOU DO?</div>
    <div class="mount d-opts-idle" id="d-opts-idle"
         style="left:{OPTS_X:.2f}px; top:{OPTS_Y}px; transform:scale({OPTS_S:.6f})">
      {mobile_options_html(False)}
    </div>
    <div class="mount d-opts-res" id="d-opts-res"
         style="left:{OPTS_X:.2f}px; top:{OPTS_Y}px; transform:scale({OPTS_S:.6f})">
      {mobile_options_html(True)}
    </div>""",
  "",
  f"""
      var table = q('#d-table'), status = q('#d-status'), cards = q('#d-cards');
      var qn = q('#d-q'), idle = q('#d-opts-idle'), res = q('#d-opts-res');
      var idleBtns = qa('#d-opts-idle .mt-opt');

      gsap.set(qn, {{ opacity: 0, y: 16 }});
      gsap.set(idleBtns, {{ opacity: 0, y: 22 }});
      gsap.set(res, {{ opacity: 0 }});

      var tl = gsap.timeline({{ paused: true, defaults: {{ ease: 'power3.out' }} }});
      /* the table steps back — it has been read. The hand stays as the anchor. */
      tl.to([table, status], {{ opacity: 0, duration: 0.75, ease: 'power3.inOut' }}, 0.25);
      tl.to(cards, {{ scale: {CARD_DEC:.6f}, y: {CARD_DEC_CY - CARD_HOOK_CY:.2f},
                      duration: 0.95, ease: 'power3.inOut' }}, 0.25);
      tl.fromTo(qn, {{ opacity: 0, y: 16 }}, {{ opacity: 1, y: 0, duration: 0.70 }}, 0.95);
      tl.fromTo(idleBtns, {{ opacity: 0, y: 22 }}, {{ opacity: 1, y: 0, duration: 0.65, stagger: 0.16 }}, 1.35);
      /* a real beat to answer, then the lesson's own answer resolves */
      tl.to(idle, {{ opacity: 0, duration: 0.70, ease: 'power3.inOut' }}, 3.05);
      tl.to(res,  {{ opacity: 1, duration: 0.70, ease: 'power3.inOut' }}, 3.05);
      tl.to({{}}, {{ duration: 4.5 }}, 0);""")
