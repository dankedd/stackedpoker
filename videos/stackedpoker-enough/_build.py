# -*- coding: utf-8 -*-
"""StackedPoker — "ENOUGH." 1080x1920, ~21.7s.

MORE -> ENOUGH -> one real decision -> what do you do -> the range -> why ->
coach -> understand why -> CTA.
"""
import io, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _product
_product.BUILD = 5.5
from _product import product_css, card_html
from _mproduct import (mobile_css, mobile_table_html, mobile_status_html,
                       mobile_options_html, MBUILD)
from _ranges import HERO, MONTAGE, grid_html

OUT = "compositions/frames"
W, H = 1080, 1920
FILM_BG = "#0D1526"
EASE = "cubic-bezier(0.22, 1, 0.36, 1)"

TABLE_S, CARD_DEC, OPTS_S, RANGE_S = 0.395, 0.40, 0.4835, 0.442
TABLE_W = 390 * MBUILD * TABLE_S
TABLE_H = (390 / (3 / 4.3)) * MBUILD * TABLE_S
TABLE_X, TABLE_Y = (W - TABLE_W) / 2, 268.0
CARD_CX, CARD_HOOK_CY = W / 2, 880.0
CARD_TABLE_CY = TABLE_Y + 0.5539 * TABLE_H
CARD_DEC_CY = 450.0
OPTS_W = 358 * MBUILD * OPTS_S
OPTS_X, OPTS_Y = (W - OPTS_W) / 2, 820.0
STATUS_S = 0.38
STATUS_W = 358 * MBUILD * STATUS_S
RANGE_CX, RANGE_CY = W / 2, 960.0

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
    .label    {{ font-family:"Geist Mono"; font-weight:500; letter-spacing:0.18em;
                text-transform:uppercase; color:rgba(186,205,247,0.42); }}
    .grad     {{ background:linear-gradient(135deg,#7C5CFF 0%,#5EA8FF 100%);
                -webkit-background-clip:text; background-clip:text; color:transparent; }}

    .ctr {{ position:absolute; left:0; width:{W}px; text-align:center; will-change:transform; }}
    .mount   {{ position:absolute; transform-origin:0 0; will-change:transform; }}
    .mount-c {{ position:absolute; transform-origin:50% 50%; will-change:transform; }}
"""

PHONE_RANGE = f"""
    .sp-range {{ width:{358 * MBUILD:g}px; }}
    .sp-range-cols {{ display:flex; gap:{1 * MBUILD:g}px; margin-left:{20 * MBUILD:g}px;
                     margin-bottom:{2 * MBUILD:g}px; }}
    .sp-range-col {{ flex:1; text-align:center; font-family:"Geist"; font-size:{8 * MBUILD:g}px;
                    font-weight:700; color:rgba(114,130,151,0.4); line-height:1; }}
    .sp-range-row {{ display:flex; align-items:center; gap:{1 * MBUILD:g}px; }}
    .sp-range-rowlabel {{ width:{20 * MBUILD:g}px; flex:none; text-align:center;
                         font-family:"Geist"; font-size:{8 * MBUILD:g}px; font-weight:700;
                         color:rgba(114,130,151,0.4); }}
    .sp-cell {{ position:relative; flex:1; aspect-ratio:1/1; display:flex; align-items:center;
               justify-content:center; border-radius:{3 * MBUILD:g}px; overflow:hidden;
               font-family:"Geist"; font-size:{8 * MBUILD:g}px; font-weight:700; line-height:1; }}
    .sp-act {{ position:absolute; left:0; top:0; bottom:0; }}
    .sp-cell span {{ position:relative; z-index:10; border-radius:{2 * MBUILD:g}px;
                    background:rgba(0,0,0,0.3); padding:0 {2 * MBUILD:g}px; color:#fff; }}
    .sp-cellwrap {{ position:relative; flex:1; min-width:0; aspect-ratio:1/1; display:flex; }}
    .sp-cellwrap .sp-cell {{ flex:1; }}
    .sp-ring {{ position:absolute; inset:0; border-radius:{3 * MBUILD:g}px; pointer-events:none;
               z-index:20; box-shadow:0 0 0 {1 * MBUILD:g}px {FILM_BG},
                                      0 0 0 {3 * MBUILD:g}px #fff; }}
    .sp-range-title {{ font-family:"Geist Mono"; font-size:{10 * MBUILD:g}px; font-weight:600;
                      letter-spacing:0.18em; text-transform:uppercase;
                      color:rgba(114,130,151,0.55); text-align:center;
                      margin-bottom:{6 * MBUILD:g}px; }}
    .sp-range-legend {{ display:flex; align-items:center; justify-content:center;
                       gap:{16 * MBUILD:g}px; padding-top:{6 * MBUILD:g}px; }}
    .sp-legend-item {{ display:flex; align-items:center; gap:{8 * MBUILD:g}px; }}
    .sp-legend-sw {{ width:{14 * MBUILD:g}px; height:{14 * MBUILD:g}px;
                    border-radius:{3 * MBUILD:g}px; flex:none; }}
    .sp-legend-tx {{ font-family:"Geist"; font-size:{13 * MBUILD:g}px; font-weight:400;
                    color:rgba(114,130,151,0.6); }}
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
      var EASE = "{EASE}";
      qa('.mount-c[data-scale]').forEach(function (el) {{
        gsap.set(el, {{ xPercent: -50, yPercent: -50, scale: parseFloat(el.dataset.scale),
                       y: parseFloat(el.dataset.dy || 0) }});
      }});
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


def table_mount(idp):
    return f"""
    <div class="mount {idp}-table" id="{idp}-table"
         style="left:{TABLE_X:.2f}px; top:{TABLE_Y:.2f}px; transform:scale({TABLE_S:.6f})">
      {mobile_table_html(card_html, show_cards=False)}
    </div>
    <div class="mount {idp}-status" id="{idp}-status"
         style="left:{(W - STATUS_W) / 2:.2f}px; top:1500px; transform:scale({STATUS_S:.6f})">
      {mobile_status_html()}
    </div>"""


def opts_mount(idp, resolved, suffix=""):
    return f"""
    <div class="mount {idp}-opts{suffix}" id="{idp}-opts{suffix}"
         style="left:{OPTS_X:.2f}px; top:{OPTS_Y}px; transform:scale({OPTS_S:.6f})">
      {mobile_options_html(resolved)}
    </div>"""


ALL_RANGES = [HERO] + MONTAGE


def range_stack(idp):
    return "".join(f"""
    <div class="mount-c {idp}-rw" id="{idp}-rw{i}" data-scale="{RANGE_S:.6f}"
         data-layout-allow-overlap
         style="left:{RANGE_CX}px; top:{RANGE_CY}px">
      {grid_html(r, f"{idp}-r{i}", MBUILD)}
    </div>""" for i, r in enumerate(ALL_RANGES))
