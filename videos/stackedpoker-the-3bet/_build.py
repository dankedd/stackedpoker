# -*- coding: utf-8 -*-
"""Rebuild all seven frames on the REAL StackedPoker product surfaces."""
import io, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _product import (product_css, table_html, status_html, options_html,
                      range_html, card_html, ring_css, BUILD)

OUT = "compositions/frames"

# ── display geometry (1920x1080) ────────────────────────────────────────────
TABLE_DISP = 1.6 / BUILD           # product renders at 1.6x, built at BUILD -> downscaled
RANGE_DISP = 1.51 / BUILD
TABLE_W, TABLE_H = 672 * 1.6, 441 * 1.6            # 1075.2 x 705.6
TABLE_X, TABLE_Y = (1920 - TABLE_W) / 2, 87.0
STATUS_Y = TABLE_Y + TABLE_H + 8 * 1.6             # 805.4
OPTS_Y = 907.0
CARD_CX, CARD_CY = 960.0, TABLE_Y + 0.5696 * TABLE_H   # 960, 488.9
RANGE_CX, RANGE_CY = 960.0, 482.0
FILM_BG = "#0D1526"

ENV = f"""
    @font-face {{ font-family:"Geist"; src:url("capture/assets/fonts/Geist-Regular.woff2") format("woff2");
                 font-weight:100 900; font-style:normal; font-display:block; }}
    @font-face {{ font-family:"Geist Mono"; src:url("capture/assets/fonts/GeistMono-Regular.woff2") format("woff2");
                 font-weight:100 900; font-style:normal; font-display:block; }}
    #root {{ position:absolute; left:0; top:0; width:1920px; height:1080px; overflow:hidden; }}

    .bg      {{ position:absolute; inset:0; background:{FILM_BG}; }}
    .deep    {{ position:absolute; inset:0;
               background: radial-gradient(1600px 900px at 50% 118%, #080D1A 0%, rgba(8,13,26,0) 70%); }}
    .grid    {{ position:absolute; inset:0;
               background-image:
                 linear-gradient(rgba(186,205,247,0.03) 1px, transparent 1px),
                 linear-gradient(90deg, rgba(186,205,247,0.03) 1px, transparent 1px);
               background-size:80px 80px; }}
    .spot    {{ position:absolute; inset:0;
               background: radial-gradient(1200px 820px at 50% 8%,
                 rgba(124,92,255,0.20) 0%, rgba(94,168,255,0.09) 40%, rgba(94,168,255,0) 70%); }}
    .ambient {{ position:absolute; inset:0;
               background: radial-gradient(1500px 700px at 50% 104%,
                 rgba(94,168,255,0.10) 0%, rgba(94,168,255,0) 72%); }}

    .glass {{ background: rgba(14,24,44,0.62);
             border: 1px solid rgba(186,205,247,0.10);
             border-radius: 20px;
             box-shadow: inset 0 1px 0 rgba(186,205,247,0.14), 0 40px 120px rgba(0,0,0,0.45);
             backdrop-filter: blur(18px); }}

    .display  {{ font-family:"Geist"; font-weight:900; letter-spacing:-0.03em; color:#FFFFFF; }}
    .headline {{ font-family:"Geist"; font-weight:800; letter-spacing:-0.025em; color:#FFFFFF; }}
    .body     {{ font-family:"Geist"; font-weight:400; line-height:1.65; color:rgba(186,205,247,0.62); }}
    .label    {{ font-family:"Geist Mono"; font-weight:500; letter-spacing:0.18em;
                text-transform:uppercase; color:rgba(186,205,247,0.38); font-size:12px; }}
    .grad     {{ background:linear-gradient(135deg,#7C5CFF 0%,#5EA8FF 100%);
                -webkit-background-clip:text; background-clip:text; color:transparent; }}

    /* ── product-surface mounts: each surface is built at {BUILD}x and shown
          DOWNSCALED, so it is always sharper than a native-size render. ── */
    .mount {{ position:absolute; transform-origin:0 0; }}
    .mount-c {{ position:absolute; transform-origin:50% 50%; will-change:transform; }}
    .mount-c > * {{ position:relative; }}
"""

CARDS_ROW = (f'<div class="sp-herocards-row">{card_html("A")}{card_html("5")}</div>')


def frame(fid, dur, body, css, script):
    return f"""<template>
  <div id="root" data-composition-id="{fid}" data-width="1920" data-height="1080">
    <div class="bg clip"      data-start="0" data-duration="{dur}" data-track-index="0"></div>
    <div class="deep clip"    data-start="0" data-duration="{dur}" data-track-index="1"></div>
    <div class="grid clip"    data-start="0" data-duration="{dur}" data-track-index="2"></div>
    <div class="spot clip"    data-start="0" data-duration="{dur}" data-track-index="3"></div>
    <div class="ambient clip" data-start="0" data-duration="{dur}" data-track-index="4"></div>
{body}
  </div>

  <style>{ENV}{product_css()}{css}
  </style>

  <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js" integrity="sha384-sG0Hv1tP1lZCk9KQmrIbY/XNwi+OY84GQqhMscbnsoBFqAz8KNCil1kvfL3Hbbk2" crossorigin="anonymous"></script>
  <script>
    (function () {{
      var root = document.querySelector('[data-composition-id="{fid}"]');
      if (!root) return;
      var q = function (s) {{ return root.querySelector(s); }};
      var qa = function (s) {{ return Array.prototype.slice.call(root.querySelectorAll(s)); }};
      /* Centred product mounts are positioned by GSAP in EVERY frame, so a
         state inherited across a cut is produced by the identical code path. */
      qa('.mount-c[data-scale]').forEach(function (el) {{
        gsap.set(el, {{ xPercent: -50, yPercent: -50, scale: parseFloat(el.dataset.scale) }});
      }});
      /* Same reason: the table's seats/chips/readouts carry a percentage
         translate, and GSAP resolves that to px with its own rounding. Running
         them through gsap.set in every frame — animated or not — means both
         sides of a cut round identically. */
      qa('.sp-seat, .sp-meta, .sp-chips, .sp-pot, .sp-dealer').forEach(function (el) {{
        gsap.set(el, {{ x: 0, y: 0 }});
      }});
      /* Anything that arrives already displaced by an earlier frame declares it,
         so the displacement is written by GSAP on both sides of the cut. */
      qa('[data-x]').forEach(function (el) {{ gsap.set(el, {{ x: parseFloat(el.dataset.x) }}); }});
{script}
      window.__timelines = window.__timelines || {{}};
      window.__timelines["{fid}"] = tl;
    }})();
  </script>
</template>
"""


# ── the table block, shared verbatim by frames 2, 3 and 4's opening state ───
def table_block(idp):
    return f"""
    <div class="mount {idp}-table" id="{idp}-table"
         style="left:{TABLE_X}px; top:{TABLE_Y}px; transform:scale({TABLE_DISP:.6f})">
      {table_html(show_cards=False)}
    </div>
    <div class="mount {idp}-status" id="{idp}-status"
         style="left:{TABLE_X}px; top:{STATUS_Y}px; transform:scale({TABLE_DISP:.6f})">
      {status_html()}
    </div>"""


def cards_block(idp, scale):
    """Hero cards, always built at BUILD and shown downscaled."""
    return f"""
    <div class="mount-c {idp}-cards" id="{idp}-cards"
         data-scale="{scale:.6f}" style="left:{CARD_CX}px; top:{CARD_CY}px">
      <div class="sp-heroglow" style="left:50%;top:50%;transform:translate(-50%,-50%)"></div>
      {CARDS_ROW}
    </div>"""


def opts_block(idp, resolved):
    return f"""
    <div class="mount {idp}-opts" id="{idp}-opts"
         style="left:{TABLE_X}px; top:{OPTS_Y}px; transform:scale({TABLE_DISP:.6f})">
      {options_html(resolved)}
    </div>"""


def range_block(idp):
    return f"""
    <div class="mount-c {idp}-range" id="{idp}-range"
         data-scale="{RANGE_DISP:.6f}" style="left:{RANGE_CX}px; top:{RANGE_CY}px">
      <div class="sp-range">{range_html(FILM_BG)}</div>
    </div>"""


# ══════════════════════════════════════════════════════════════════════════
# 1 — THE HOOK. The real cards, at the exact spot the real table will put them.
# ══════════════════════════════════════════════════════════════════════════
F1 = frame("01-the-hook", 4.5,
  f"""
    <div class="hk-line hk-l1 headline" id="hk-l1">YOU HAVE A&spades;5&spades;.</div>
    <div class="hk-line hk-l2 headline grad" id="hk-l2">WHAT DO YOU DO?</div>
    <div class="hk-cardlayer" id="hk-cardlayer">{cards_block("hk", 1.0)}</div>""",
  f"""
    .hk-line {{ position:absolute; left:0; width:1920px; text-align:center;
               font-size:54px; line-height:1.2; }}
    .hk-l1 {{ top:190px; }}
    .hk-l2 {{ top:258px; }}
    .hk-cardlayer {{ position:absolute; inset:0; transform:translateZ(0); }}""",
  """
      var l1 = q('#hk-l1'), l2 = q('#hk-l2'), cards = q('#hk-cards');
      var cardEls = qa('#hk-cards .sp-card');

      gsap.set([l1, l2], { opacity: 0, y: 10 });
      gsap.set(cardEls, { opacity: 0, y: -74 });

      var tl = gsap.timeline({ paused: true, defaults: { ease: 'power3.out' } });
      /* the two cards are dealt, then the question lands under them */
      tl.fromTo(cardEls[0], { opacity: 0, y: -74, rotation: -1 },
                            { opacity: 1, y: 0, rotation: 0, duration: 0.85 }, 1.05);
      tl.fromTo(cardEls[1], { opacity: 0, y: -74, rotation: 1 },
                            { opacity: 1, y: 0, rotation: 0, duration: 0.80 }, 1.68);
      tl.fromTo(l1, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.55 }, 2.25);
      tl.fromTo(l2, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.55 }, 2.62);
      tl.to({}, { duration: 4.5 }, 0);""")

# ══════════════════════════════════════════════════════════════════════════
# 2 — THE SPOT. The real PreflopTable builds around the hand already on screen.
# ══════════════════════════════════════════════════════════════════════════
F2 = frame("02-the-spot", 5,
  f"""
    <div class="hk-line hk-l1 headline" id="f2-l1">YOU HAVE A&spades;5&spades;.</div>
    <div class="hk-line hk-l2 headline grad" id="f2-l2">WHAT DO YOU DO?</div>
    {table_block("f2")}
    <div class="hk-cardlayer" id="f2-cardlayer">{cards_block("f2", 1.0)}</div>""",
  f"""
    .hk-line {{ position:absolute; left:0; width:1920px; text-align:center;
               font-size:54px; line-height:1.2; }}
    .hk-l1 {{ top:190px; }}
    .hk-l2 {{ top:258px; }}
    .hk-cardlayer {{ position:absolute; inset:0; transform:translateZ(0); }}""",
  f"""
      var l1 = q('#f2-l1'), l2 = q('#f2-l2');
      var table = q('#f2-table'), status = q('#f2-status'), cards = q('#f2-cards');
      var felt = q('#f2-table .sp-felt'), rail = q('#f2-table .sp-rail');
      var seats = qa('#f2-table .sp-seat'), metas = qa('#f2-table .sp-meta');
      var chips = qa('#f2-table .sp-chips'), pot = q('#f2-table .sp-pot');
      var dealer = q('#f2-table .sp-dealer');

      /* hidden states, outside the timeline */
      gsap.set(table, {{ opacity: 0 }});
      gsap.set(status, {{ opacity: 0, y: 8 }});
      gsap.set([rail, felt], {{ opacity: 0 }});
      /* A folded seat rests at the product's own 0.35, not at 1 — fading every
         seat to full opacity would quietly un-fold UTG and HJ. */
      var folded = seats.filter(function (e) {{ return e.classList.contains('sp-seat-folded'); }});
      var live   = seats.filter(function (e) {{ return !e.classList.contains('sp-seat-folded'); }});
      gsap.set(live.concat(metas), {{ opacity: 0, y: 8 }});
      gsap.set(folded, {{ opacity: 0, y: 8 }});
      gsap.set(chips, {{ opacity: 0 }});
      gsap.set([pot, dealer], {{ opacity: 0 }});

      var tl = gsap.timeline({{ paused: true, defaults: {{ ease: 'power3.out' }} }});

      /* the question clears — it has been asked */
      tl.to([l1, l2], {{ opacity: 0, duration: 0.55, ease: 'power3.inOut' }}, 0.40);

      /* the real table materialises and the hand settles into its seat */
      tl.set(table, {{ opacity: 1 }}, 0.45);
      tl.fromTo([rail, felt], {{ opacity: 0 }}, {{ opacity: 1, duration: 1.05 }}, 0.45);
      tl.to(cards, {{ scale: {TABLE_DISP:.6f}, duration: 1.05, ease: 'power3.inOut' }}, 0.45);

      /* seats, then the action in the lesson's own order, then the pot */
      tl.fromTo(live,   {{ opacity: 0, y: 8 }}, {{ opacity: 1,    y: 0, duration: 0.48, stagger: 0.04 }}, 1.50);
      tl.fromTo(folded, {{ opacity: 0, y: 8 }}, {{ opacity: 0.35, y: 0, duration: 0.48, stagger: 0.04 }}, 1.50);
      tl.fromTo(metas, {{ opacity: 0, y: 8 }}, {{ opacity: 1, y: 0, duration: 0.48, stagger: 0.04 }}, 1.66);
      tl.fromTo(dealer, {{ opacity: 0 }}, {{ opacity: 1, duration: 0.40 }}, 1.90);
      tl.fromTo(chips[0], {{ opacity: 0 }}, {{ opacity: 1, duration: 0.40 }}, 2.10);
      tl.fromTo(chips[1], {{ opacity: 0 }}, {{ opacity: 1, duration: 0.40 }}, 2.25);
      tl.fromTo(chips[2], {{ opacity: 0 }}, {{ opacity: 1, duration: 0.44 }}, 2.92);
      tl.fromTo(pot, {{ opacity: 0 }}, {{ opacity: 1, duration: 0.48 }}, 3.32);
      tl.fromTo(status, {{ opacity: 0, y: 8 }}, {{ opacity: 1, y: 0, duration: 0.55 }}, 3.55);
      tl.to({{}}, {{ duration: 5 }}, 0);""")


def opts_pair(idp):
    """Idle and resolved option rows, stacked, so the resolve is a crossfade
    between two REAL product states rather than a tweened approximation."""
    return f"""
    <div class="mount {idp}-opts-idle" id="{idp}-opts-idle"
         style="left:{TABLE_X}px; top:{OPTS_Y}px; transform:scale({TABLE_DISP:.6f})">
      {options_html(False)}
    </div>
    <div class="mount {idp}-opts-res" id="{idp}-opts-res"
         style="left:{TABLE_X}px; top:{OPTS_Y}px; transform:scale({TABLE_DISP:.6f})">
      {options_html(True)}
    </div>"""


HK_CSS = f"""
    .hk-line {{ position:absolute; left:0; width:1920px; text-align:center;
               font-size:54px; line-height:1.2; }}
    .hk-l1 {{ top:190px; }}
    .hk-l2 {{ top:258px; }}
    .hk-cardlayer {{ position:absolute; inset:0; transform:translateZ(0); }}"""

# ══════════════════════════════════════════════════════════════════════════
# 3 — THE DECISION. The real option buttons; 3-Bet is the lesson's own answer.
# ══════════════════════════════════════════════════════════════════════════
F3 = frame("03-the-decision", 5,
  f"""{table_block("dc")}
    <div class="hk-cardlayer">{cards_block("dc", TABLE_DISP)}</div>
{opts_pair("dc")}""",
  HK_CSS,
  """
      var idle = q('#dc-opts-idle'), res = q('#dc-opts-res');
      var idleBtns = qa('#dc-opts-idle .sp-opt');

      gsap.set(idleBtns, { opacity: 0, y: 14 });
      gsap.set(res, { opacity: 0 });

      var tl = gsap.timeline({ paused: true, defaults: { ease: 'power3.out' } });
      /* the three options settle, in the lesson's own order */
      tl.fromTo(idleBtns, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.55, stagger: 0.22 }, 0.40);
      /* a real second to answer, then 3-Bet resolves and the other two recede */
      tl.to(idle, { opacity: 0, duration: 0.70, ease: 'power3.inOut' }, 2.45);
      tl.to(res,  { opacity: 1, duration: 0.70, ease: 'power3.inOut' }, 2.45);
      tl.to({}, { duration: 5 }, 0);""")

# ══════════════════════════════════════════════════════════════════════════
# 4 — THE RANGE. The real PokerRangeGrid. The grid arrives whole, then the
#     strategy colours resolve across every cell at once — no cascade, no
#     per-cell brightness, no glow. A5s is then ringed, nothing more.
# ══════════════════════════════════════════════════════════════════════════
F4 = frame("04-the-range", 6,
  f"""{table_block("r4")}
    <div class="hk-cardlayer">{cards_block("r4", TABLE_DISP)}</div>
    <div class="mount {'r4'}-opts-res" id="r4-opts-res"
         style="left:{TABLE_X}px; top:{OPTS_Y}px; transform:scale({TABLE_DISP:.6f})">
      {options_html(True)}
    </div>
{range_block("r4")}
    <div class="r4-mkt headline" id="r4-mkt">DON&rsquo;T MEMORISE THE HAND. UNDERSTAND THE RANGE.</div>""",
  HK_CSS + f"""
    .r4-mkt {{ position:absolute; left:0; top:944px; width:1920px; text-align:center;
              font-size:26px; line-height:1.2; }}""",
  f"""
      var table = q('#r4-table'), status = q('#r4-status'), cards = q('#r4-cards');
      var opts = q('#r4-opts-res'), range = q('#r4-range'), mkt = q('#r4-mkt');
      var grid = q('#r4-range .sp-range'), ring = q('#r4-range .sp-ring');
      var strat = qa('#r4-range .sp-3bet');
      var legend = q('#r4-range #sp-range-legend');

      /* hidden states, outside the timeline */
      gsap.set(range, {{ opacity: 0 }});
      gsap.set(strat, {{ opacity: 0 }});
      gsap.set(ring, {{ opacity: 0 }});
      gsap.set(legend, {{ opacity: 0 }});
      gsap.set(mkt, {{ opacity: 0, y: 12 }});

      var tl = gsap.timeline({{ paused: true }});

      /* 0.0-0.3 — the inherited state, static. The seam. */

      /* the table hands over */
      tl.to([table, status, opts, cards], {{ opacity: 0, duration: 0.70, ease: 'power3.inOut' }}, 0.30);

      /* 1 — the grid appears AS A WHOLE, every cell already carrying the real
             "Other action" colour. Nothing cascades, nothing scans. */
      tl.fromTo(range, {{ opacity: 0 }}, {{ opacity: 1, duration: 0.80, ease: 'power3.out' }}, 1.10);

      /* 2 — the strategy resolves across the entire grid at once. ONE tween for
             all {'{'}n{'}'} cells, so two hands at the same frequency can never differ. */
      tl.fromTo(strat, {{ opacity: 0 }}, {{ opacity: 1, duration: 0.85, ease: 'power2.out' }}, 2.20);

      /* 3 — and only then the hand under discussion is ringed. Its fill is
             identical to every other 3-bet hand; the ring is the whole marking. */
      tl.fromTo(ring, {{ opacity: 0 }}, {{ opacity: 1, duration: 0.55, ease: 'power3.out' }}, 3.30);

      tl.fromTo(legend, {{ opacity: 0 }}, {{ opacity: 1, duration: 0.60, ease: 'power3.out' }}, 3.70);
      tl.fromTo(mkt, {{ opacity: 0, y: 12 }}, {{ opacity: 1, y: 0, duration: 0.75, ease: 'power3.out' }}, 4.10);

      /* 4 — the camera eases toward the range. Slow, small, and steady: the
             grid has to stay readable, so this is 3%, not a zoom. */
      tl.to(range, {{ scale: {RANGE_DISP * 1.03:.6f}, duration: 2.4, ease: 'power2.inOut' }}, 3.10);
      tl.to({{}}, {{ duration: 6 }}, 0);""")
