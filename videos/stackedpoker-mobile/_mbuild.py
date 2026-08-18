# -*- coding: utf-8 -*-
"""StackedPoker — 9:16 mobile film. Recomposed for portrait, not cropped."""
import io, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _product
_product.BUILD = 5.5
from _product import product_css, range_html, card_html
from _mproduct import (mobile_css, mobile_table_html, mobile_status_html,
                       mobile_options_html, MBUILD)

OUT = "compositions/frames"
W, H = 1080, 1920
SAFE_TOP, SAFE_BOT = 250, 1620
FILM_BG = "#0D1526"

# ── display scales (every surface is built at MBUILD and shown DOWNSCALED) ──
CARD_HOOK   = 1.00                  # 297 x 418 per card — the hook
TABLE_S     = 0.395                 # 933 x 1337 — the real MOBILE_LAYOUT table
CARD_TABLE  = TABLE_S               # cards ride the table's scale
CARD_DEC    = 0.40                  # the decision scene's anchor
OPTS_S      = 0.4835                # 952 wide, buttons 952 x 152
RANGE_S     = 0.442                 # 870 wide — 80% of the frame, cells 63px

TABLE_W, TABLE_H = 390 * MBUILD * TABLE_S, (390 / (3 / 4.3)) * MBUILD * TABLE_S
TABLE_X, TABLE_Y = (W - TABLE_W) / 2, 268.0
CARD_CX = W / 2
CARD_HOOK_CY = 880.0
CARD_TABLE_CY = TABLE_Y + 0.5539 * TABLE_H
CARD_DEC_CY = 450.0

ENV = f"""
    @font-face {{ font-family:"Geist"; src:url("capture/assets/fonts/Geist-Regular.woff2") format("woff2");
                 font-weight:100 900; font-style:normal; font-display:block; }}
    @font-face {{ font-family:"Geist Mono"; src:url("capture/assets/fonts/GeistMono-Regular.woff2") format("woff2");
                 font-weight:100 900; font-style:normal; font-display:block; }}
    #root {{ position:absolute; left:0; top:0; width:{W}px; height:{H}px; overflow:hidden; }}

    .bg      {{ position:absolute; inset:0; background:{FILM_BG}; }}
    .deep    {{ position:absolute; inset:0;
               background: radial-gradient(1200px 1400px at 50% 112%, #080D1A 0%, rgba(8,13,26,0) 70%); }}
    .grid    {{ position:absolute; inset:0;
               background-image:
                 linear-gradient(rgba(186,205,247,0.03) 1px, transparent 1px),
                 linear-gradient(90deg, rgba(186,205,247,0.03) 1px, transparent 1px);
               background-size:90px 90px; }}
    .spot    {{ position:absolute; inset:0;
               background: radial-gradient(900px 1100px at 50% 4%,
                 rgba(124,92,255,0.22) 0%, rgba(94,168,255,0.09) 42%, rgba(94,168,255,0) 72%); }}
    .ambient {{ position:absolute; inset:0;
               background: radial-gradient(1100px 900px at 50% 102%,
                 rgba(94,168,255,0.10) 0%, rgba(94,168,255,0) 72%); }}

    .glass {{ background: rgba(14,24,44,0.62);
             border: 1px solid rgba(186,205,247,0.10);
             border-radius: 34px;
             box-shadow: inset 0 1px 0 rgba(186,205,247,0.14), 0 50px 140px rgba(0,0,0,0.45);
             backdrop-filter: blur(18px); }}

    .display  {{ font-family:"Geist"; font-weight:900; letter-spacing:-0.03em; color:#FFFFFF; }}
    .headline {{ font-family:"Geist"; font-weight:800; letter-spacing:-0.025em; color:#FFFFFF; }}
    .body     {{ font-family:"Geist"; font-weight:400; line-height:1.6; color:rgba(186,205,247,0.66); }}
    .label    {{ font-family:"Geist Mono"; font-weight:500; letter-spacing:0.22em;
                text-transform:uppercase; color:rgba(186,205,247,0.42); }}
    .grad     {{ background:linear-gradient(135deg,#7C5CFF 0%,#5EA8FF 100%);
                -webkit-background-clip:text; background-clip:text; color:transparent; }}

    .ctr {{ position:absolute; left:0; width:{W}px; text-align:center;
           will-change:transform; }}
    .mount   {{ position:absolute; transform-origin:0 0; will-change:transform; }}
    .mount-c {{ position:absolute; transform-origin:50% 50%; will-change:transform; }}

"""


PHONE_RANGE = f"""
    /* PokerRangeGrid at PHONE width — below the sm: breakpoint the cells are
       25px with 8px labels, not the desktop 37.5/10. Declared AFTER product_css
       so it wins the cascade. */
    .sp-range {{ width:{358 * MBUILD:g}px; }}
    .sp-range-col, .sp-range-rowlabel, .sp-cell {{ font-size:{8 * MBUILD:g}px; }}
    .sp-range-title {{ font-size:{10 * MBUILD:g}px; letter-spacing:0.18em; }}
    .sp-legend-sw {{ width:{14 * MBUILD:g}px; height:{14 * MBUILD:g}px; }}
    .sp-legend-tx {{ font-size:{13 * MBUILD:g}px; }}
"""


def frame(fid, dur, body, css, script):
    return f"""<template>
  <div id="root" data-composition-id="{fid}" data-width="{W}" data-height="{H}">
    <div class="bg clip"      data-start="0" data-duration="{dur}" data-track-index="0"></div>
    <div class="deep clip"    data-start="0" data-duration="{dur}" data-track-index="1"></div>
    <div class="grid clip"    data-start="0" data-duration="{dur}" data-track-index="2"></div>
    <div class="spot clip"    data-start="0" data-duration="{dur}" data-track-index="3"></div>
    <div class="ambient clip" data-start="0" data-duration="{dur}" data-track-index="4"></div>
{body}
  </div>

  <style>{ENV}{product_css()}{mobile_css(390)}{PHONE_RANGE}{css}
  </style>

  <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js" integrity="sha384-sG0Hv1tP1lZCk9KQmrIbY/XNwi+OY84GQqhMscbnsoBFqAz8KNCil1kvfL3Hbbk2" crossorigin="anonymous"></script>
  <script>
    (function () {{
      var root = document.querySelector('[data-composition-id="{fid}"]');
      if (!root) return;
      var q = function (s) {{ return root.querySelector(s); }};
      var qa = function (s) {{ return Array.prototype.slice.call(root.querySelectorAll(s)); }};
      /* Every centred mount is positioned by GSAP in EVERY frame, so a state
         inherited across a hard cut is produced by one identical code path. */
      qa('.mount-c[data-scale]').forEach(function (el) {{
        gsap.set(el, {{ xPercent: -50, yPercent: -50, scale: parseFloat(el.dataset.scale),
                       y: parseFloat(el.dataset.dy || 0) }});
      }});
      /* Inherited text is written through GSAP in every frame too. */
      qa('[data-gy]').forEach(function (el) {{ gsap.set(el, {{ y: parseFloat(el.dataset.gy) }}); }});
      qa('.mt-seat, .mt-meta, .mt-chips, .mt-pot').forEach(function (el) {{
        gsap.set(el, {{ x: 0, y: 0 }});
      }});
{script}
      window.__timelines = window.__timelines || {{}};
      window.__timelines["{fid}"] = tl;
    }})();
  </script>
</template>
"""


def cards_mount(idp, scale, cy):
    return f"""
    <div class="mount-c {idp}-cards" id="{idp}-cards" data-scale="{scale:.6f}"
         data-dy="{cy - CARD_HOOK_CY:.2f}"
         style="left:{CARD_CX}px; top:{CARD_HOOK_CY:.2f}px">
      <div class="mt-cards" style="position:relative; left:auto; top:auto; transform:none">
        <div class="mt-glow"></div>{card_html("A")}{card_html("5")}
      </div>
    </div>"""


def table_mount(idp, scale=TABLE_S, x=None, y=None):
    x = TABLE_X if x is None else x
    y = TABLE_Y if y is None else y
    return f"""
    <div class="mount {idp}-table" id="{idp}-table"
         style="left:{x:.2f}px; top:{y:.2f}px; transform:scale({scale:.6f})">
      {mobile_table_html(card_html, show_cards=False)}
    </div>"""
