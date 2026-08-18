# -*- coding: utf-8 -*-
"""
The REAL StackedPoker MOBILE surfaces, at native CSS pixel sizes x MBUILD.

PreflopTable has its own MOBILE_LAYOUT (aspect 3/4.3, superellipse rail, seat
pods outside the rail, chips inside the felt, inline dealer button). This file
reproduces THAT layout — not a crop of the desktop oval — from the component
source plus the geometry measured off the real component rendered at a 390px
phone viewport (`_ref/mobile-geometry.json`).

Source: components/learn/visuals/PreflopTable.tsx  -> MOBILE_LAYOUT, bandPoint,
        superellipseClipPath; PreflopSeatRow.tsx; poker/ChipStack.tsx;
        poker/PotDisplay.tsx; poker/DealerMarker.tsx (InlineDealerMarker).
"""
import math, re, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

MBUILD = 5.5            # native build multiplier; every surface is shown downscaled

# ── MOBILE_LAYOUT, verbatim ─────────────────────────────────────────────────
ASPECT = 3 / 4.3
BANDS_RAIL = dict(outerRx=44.5, outerRy=39.5, innerRx=41.5, innerRy=36.5)
LABEL_EXPONENT = 3.5
CHIP_PX = 15
CHIP_SPREAD = max(3, round(CHIP_PX * 0.22))     # 3
POT_Y = 35.0
CARD_ZONE_Y = 55.39                              # measured (card row's own centre)

# ── measured off the real component at a 390px viewport ─────────────────────
M_SEATS = [
    # pos,  label x,y ,  meta x,y (None = mobile hides a folded seat's row 2),
    #        rows, is_hero, folded, meta_above
    ("BTN", 50.00, 88.00, 50.00, 93.19, [("stack", "100 BB")], True,  False, False),
    ("SB",  10.39, 75.57, 10.39, 80.76, [("stack", "100 BB")], False, False, False),
    ("BB",  10.39, 24.43, 10.39, 19.24, [("stack", "100 BB")], False, False, True),
    ("UTG", 50.00, 12.00, None,  None,  [],                    False, True,  False),
    ("HJ",  89.61, 24.43, None,  None,  [],                    False, True,  False),
    ("CO",  89.61, 75.57, 89.61, 80.76, [("stack", "97.7 BB")], False, False, False),
]
M_CHIPS = [  # x%, y%, tone, amount, action label
    (23.0, 64.47, "blind", "0.5", None),
    (23.0, 35.53, "blind", "1",   None),
    (77.0, 64.47, "bet",   "2.3", "RAISE"),
]


def _px(css: str, k: float = MBUILD) -> str:
    return re.sub(r"(-?\d*\.?\d+)px", lambda m: f"{float(m.group(1)) * k:g}px", css)


def superellipse_clip(rx: float, ry: float, exponent: float, samples: int = 72) -> str:
    """superellipseClipPath() from PreflopTable.tsx, same 72 samples."""
    pts = []
    for i in range(samples):
        a = 2 * math.pi * i / samples
        sh = lambda v: math.copysign(abs(v) ** (2 / exponent), v) if v else 0.0
        x = 50 - rx * sh(math.sin(a))
        y = 50 + ry * sh(math.cos(a))
        pts.append(f"{x:.2f}% {y:.2f}%")
    return "polygon(" + ", ".join(pts) + ")"


CLIP = superellipse_clip(50, 50, LABEL_EXPONENT)


def mobile_css(table_w_css: float) -> str:
    """table_w_css is the table's width in CSS px (390 at a phone viewport)."""
    h = table_w_css / ASPECT
    r = BANDS_RAIL
    rail_inset = f"{(50 - r['outerRy']) / 100 * h:g}px {(50 - r['outerRx']) / 100 * table_w_css:g}px"
    felt_inset = f"{(50 - r['innerRy']) / 100 * h:g}px {(50 - r['innerRx']) / 100 * table_w_css:g}px"
    return _px(f"""
    /* ══ REAL STACKEDPOKER MOBILE TABLE — PreflopTable MOBILE_LAYOUT ══ */
    .mt-table {{ position:relative; width:{table_w_css:g}px; height:{h:g}px; }}
    /* LAYER 0 — the rail's drop shadow, on its own element because clip-path
       clips box-shadows away (the component does exactly this on mobile). */
    .mt-railshadow {{ position:absolute; inset:{rail_inset}; border-radius:999px;
                     box-shadow:0 18px 44px rgba(0,0,0,0.45); pointer-events:none; }}
    .mt-rail {{ position:absolute; inset:{rail_inset}; clip-path:{CLIP};
               background:linear-gradient(180deg,rgba(255,255,255,0.05) 0%,rgba(255,255,255,0.015) 100%); }}
    .mt-felt {{ position:absolute; inset:{felt_inset}; clip-path:{CLIP};
               background:radial-gradient(ellipse at 50% 40%,
                          rgba(21,63,46,0.92) 0%, rgba(13,44,32,0.95) 45%, rgba(6,22,17,0.99) 100%); }}

    .mt-seat {{ position:absolute; transform:translate(-50%,-50%); white-space:nowrap;
               text-align:center; z-index:10; }}
    .mt-seat-folded {{ opacity:0.35; }}
    .mt-hero-prefix {{ font-family:"Geist",sans-serif; font-size:9px; font-weight:900;
                      letter-spacing:0.1em; text-transform:uppercase;
                      color:rgba(196,181,253,0.8); margin-right:3px; vertical-align:middle; }}
    .mt-pos {{ font-family:"Geist",sans-serif; font-size:13px; font-weight:800;
              vertical-align:middle; color:rgb(230,234,240); }}
    .mt-pos-hero {{ color:rgb(221,214,254); }}

    .mt-meta {{ position:absolute; transform:translate(-50%,-50%); display:flex;
               flex-direction:column; align-items:center; gap:8px; z-index:10;
               white-space:nowrap; }}
    .mt-stack {{ font-family:"Geist",sans-serif; font-size:10px; font-weight:500;
                color:rgba(114,130,151,0.45); }}

    /* InlineDealerMarker — compact, hugging the label on its free side */
    .mt-dealer {{ position:absolute; left:50%; bottom:100%; margin-bottom:2px;
                 transform:translateX(-50%); display:flex; width:14px; height:14px;
                 align-items:center; justify-content:center; border-radius:999px;
                 border:1px solid rgba(0,0,0,0.1); background:rgba(255,255,255,0.9);
                 font-family:"Geist",sans-serif; font-size:7px; font-weight:900;
                 color:#262626; box-shadow:0 1px 2px rgba(0,0,0,0.05); }}

    .mt-chips {{ position:absolute; transform:translate(-50%,-50%); z-index:20;
                display:flex; flex-direction:column; align-items:center; gap:2px; }}
    .mt-pile {{ position:relative; width:{CHIP_PX + CHIP_SPREAD}px; height:{CHIP_PX + CHIP_SPREAD}px; }}
    .mt-chip {{ position:absolute; width:{CHIP_PX}px; height:{CHIP_PX}px; border-radius:999px;
               box-shadow:0 2px 3px rgba(0,0,0,0.55), inset 0 1px 1px rgba(255,255,255,0.2); }}
    .mt-chip-face {{ position:absolute; inset:3px; border-radius:999px; border:1px solid; }}
    .mt-chip-face::after {{ content:""; position:absolute; inset:2px; border-radius:999px;
                           border:1px solid rgba(255,255,255,0.1); }}
    .mt-chip-blind {{ background:repeating-conic-gradient(#cbd5e1 0deg 18deg,#3f4b5f 18deg 36deg); }}
    .mt-chip-blind .mt-chip-face {{ background:linear-gradient(155deg,#64748b 0%,#334155 65%,#1e293b 100%);
                                   border-color:rgba(226,232,240,0.35); }}
    .mt-chip-bet {{ background:repeating-conic-gradient(#bae6fd 0deg 18deg,#0c4a6e 18deg 36deg); }}
    .mt-chip-bet .mt-chip-face {{ background:linear-gradient(155deg,#38bdf8 0%,#0284c7 65%,#075985 100%);
                                 border-color:rgba(224,242,254,0.45); }}
    .mt-amt {{ font-family:"Geist",sans-serif; font-size:10px; font-weight:700; line-height:1;
              font-variant-numeric:tabular-nums; }}
    .mt-amt-blind {{ color:#e2e8f0; }}
    .mt-amt-bet   {{ color:#e0f2fe; }}
    .mt-verb {{ font-family:"Geist",sans-serif; font-size:9px; font-weight:700; line-height:1;
               letter-spacing:0.025em; text-transform:uppercase; color:rgba(125,211,252,0.9); }}

    .mt-pot {{ position:absolute; left:50%; transform:translate(-50%,-50%); z-index:10;
              display:flex; flex-direction:column; align-items:center; gap:2px; }}
    .mt-pot-l {{ font-family:"Geist",sans-serif; font-size:8px; font-weight:700;
                letter-spacing:0.18em; text-transform:uppercase; color:rgba(252,211,77,0.5); }}
    .mt-pot-v {{ font-family:"Geist",sans-serif; font-size:13px; font-weight:900;
                color:rgb(253,230,138); white-space:nowrap; }}

    .mt-cards {{ position:absolute; left:50%; transform:translate(-50%,-50%); z-index:10;
                display:flex; align-items:center; gap:10px; }}
    .mt-glow {{ position:absolute; left:50%; top:50%; transform:translate(-50%,-50%);
               width:112px; height:64px; border-radius:999px;
               background:rgba(139,92,246,0.10); filter:blur(24px); pointer-events:none; }}

    /* the lesson's own status strip and stacked option buttons */
    .mt-status {{ width:358px; border-radius:12px; border:1px solid rgba(36,42,56,0.2);
                 background:rgba(25,31,46,0.1); padding:8px 12px; text-align:center; }}
    .mt-status-1 {{ font-family:"Geist",sans-serif; font-size:10px; font-weight:500;
                   letter-spacing:0.06em; color:rgba(255,255,255,0.4); white-space:nowrap; }}
    .mt-status-2 {{ font-family:"Geist",sans-serif; font-size:11px; font-weight:900;
                   letter-spacing:0.06em; color:rgb(196,181,253); margin-top:2px; }}

    .mt-opts {{ display:flex; flex-direction:column; gap:12px; width:358px; }}
    .mt-opt {{ position:relative; border-radius:12px; padding:16px; overflow:hidden;
              font-family:"Geist",sans-serif; font-size:14px; font-weight:600;
              text-align:left; border:1px solid; }}
    .mt-opt-idle {{ border-color:rgba(36,42,56,0.5); background:rgba(25,31,46,0.4); color:rgb(230,234,240); }}
    .mt-opt-sel  {{ border-color:rgba(139,92,246,0.5); background:rgba(139,92,246,0.15);
                   color:rgb(221,214,254); box-shadow:0 10px 15px -3px rgba(46,16,101,0.2); }}
    .mt-opt-sel::before {{ content:""; position:absolute; inset:0;
                          background:linear-gradient(to bottom right, rgba(139,92,246,0.10), transparent); }}
    .mt-opt-dim {{ border-color:rgba(36,42,56,0.2); background:rgba(25,31,46,0.15);
                  color:rgba(114,130,151,0.3); opacity:0.5; }}
""")


def mobile_table_html(card_html, show_cards=True) -> str:
    p = ['<div class="mt-table">',
         '<div class="mt-railshadow"></div>',
         '<div class="mt-rail"></div>',
         '<div class="mt-felt"></div>',
         f'<div class="mt-pot" style="top:{POT_Y}%">'
         f'<span class="mt-pot-l">Pot</span><span class="mt-pot-v">3.8 BB</span></div>']

    for x, y, tone, amt, verb in M_CHIPS:
        v = f'<span class="mt-verb">{verb}</span>' if verb else ""
        p.append(
            f'<div class="mt-chips" style="left:{x}%;top:{y}%"><div class="mt-pile">'
            f'<div class="mt-chip mt-chip-{tone}" style="left:0;top:{CHIP_SPREAD}px;opacity:0.65">'
            f'<div class="mt-chip-face"></div></div>'
            f'<div class="mt-chip mt-chip-{tone}" style="left:{CHIP_SPREAD}px;top:0">'
            f'<div class="mt-chip-face"></div></div></div>'
            f'<span class="mt-amt mt-amt-{tone}">{amt}</span>{v}</div>')

    if show_cards:
        p.append(f'<div class="mt-cards" style="top:{CARD_ZONE_Y}%">'
                 f'<div class="mt-glow"></div>{card_html("A")}{card_html("5")}</div>')

    for pos, lx, ly, mx, my, rows, hero, folded, above in M_SEATS:
        cls = "mt-seat" + (" mt-seat-folded" if folded else "")
        pre = '<span class="mt-hero-prefix">HERO &middot;</span>' if hero else ""
        pc = "mt-pos mt-pos-hero" if hero else "mt-pos"
        d = '<span class="mt-dealer">D</span>' if pos == "BTN" else ""
        p.append(f'<div class="{cls}" style="left:{lx}%;top:{ly}%">{pre}'
                 f'<span class="{pc}">{pos}</span>{d}</div>')
        if mx is not None:
            inner = "".join(f'<span class="mt-stack">{v}</span>' for _, v in rows)
            p.append(f'<div class="mt-meta" style="left:{mx}%;top:{my}%">{inner}</div>')
    p.append("</div>")
    return "".join(p)


def mobile_status_html() -> str:
    return ('<div class="mt-status">'
            '<p class="mt-status-1">PREFLOP &middot; 100BB EFFECTIVE</p>'
            '<p class="mt-status-2">CO OPEN</p></div>')


def mobile_options_html(resolved: bool) -> str:
    css = (["mt-opt mt-opt-sel", "mt-opt mt-opt-dim", "mt-opt mt-opt-dim"] if resolved
           else ["mt-opt mt-opt-idle"] * 3)
    return ('<div class="mt-opts">' + "".join(
        f'<div class="{c}"><span style="position:relative">{l}</span></div>'
        for c, l in zip(css, ["3-Bet", "Call", "Fold"])) + "</div>")
