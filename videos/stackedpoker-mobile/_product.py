# -*- coding: utf-8 -*-
"""
The REAL StackedPoker product surfaces, reproduced at their NATIVE pixel sizes.

Every value here was either read out of the product source or measured off the
live components rendered at /zz-video-ref (see _ref/geometry.json,
_ref/computed.json, _ref/data.json). Nothing is designed here.

Sources:
  table  -> components/learn/visuals/PreflopTable.tsx  (DESKTOP_LAYOUT)
  seats  -> components/learn/visuals/PreflopSeatRow.tsx
  chips  -> components/poker/ChipStack.tsx             (CHIP_PALETTE, PokerChip)
  pot    -> components/poker/PotDisplay.tsx
  dealer -> components/poker/DealerMarker.tsx
  card   -> components/learn/PlayingCardMini.tsx       (SIZE_CONFIG.lg)
  range  -> components/learn/visuals/PokerRangeGrid.tsx (mode="strategy")
  colors -> lib/learn/actionStyles.ts + app/globals.css tokens
"""
import re

# ── resolved theme tokens (hsl -> rgb, verified against the live probe) ──────
BACKGROUND   = "rgb(12,16,29)"        # --background 224 43% 8%
SECONDARY    = "rgb(25,31,46)"        # --secondary  222 30% 14%
BORDER       = "rgb(36,42,56)"        # --border     222 22% 18%
FOREGROUND   = "rgb(230,234,240)"     # --foreground 215 25% 92%
MUTED_FG     = "rgb(114,130,151)"     # --muted-foreground 215 15% 52%

ACTION_3BET  = "rgb(139,92,246)"              # actionStyles ACTION_CSS_COLOR['3bet']
ACTION_OTHER = "rgba(100,116,139,0.7)"        # actionStyles ACTION_CSS_COLOR['other']
FILM_RING_OFFSET = "#0D1526"                  # ring-offset-background, at the film's backdrop

# ── the canonical scenario, straight from resolveThreebetRangeReveal() ──────
RANGE_LABEL = "BTN 3-BET RANGE vs CO OPEN"
HIGHLIGHT   = "A5s"
STRATEGIES = {
    "AA": {"3bet": 1},   "KK": {"3bet": 1},   "QQ": {"3bet": 1},   "JJ": {"3bet": 1},
    "TT": {"3bet": 0.4, "other": 0.6},
    "AKs": {"3bet": 1},  "AKo": {"3bet": 1},  "AQs": {"3bet": 1},
    "AQo": {"3bet": 0.5, "other": 0.5},
    "KQs": {"3bet": 0.5, "other": 0.5},
    "A5s": {"3bet": 1},  "A4s": {"3bet": 1},
    "65s": {"3bet": 0.4, "other": 0.6},
    "54s": {"3bet": 0.3, "other": 0.7},
}
RANKS = "AKQJT98765432"

# ── measured table geometry, % of the 672x441 table box ─────────────────────
SEATS = [
    # position, label x/y, meta x/y, meta rows
    ("BTN", 50.00, 88.75, 50.00, 95.32, [("stack", "100 BB")], True,  False),
    ("SB",  16.44, 69.38, 16.44, 75.95, [("stack", "100 BB")], False, False),
    ("BB",  16.44, 30.63, 16.44, 37.21, [("stack", "100 BB")], False, False),
    ("UTG", 50.00, 11.25, 50.00, 16.80, [("fold",  "FOLD")],   False, True),
    ("HJ",  83.56, 30.63, 83.56, 36.19, [("fold",  "FOLD")],   False, True),
    ("CO",  83.56, 69.38, 83.56, 77.37, [("verb",  "RAISE"), ("behind", "97.7 BB behind")], False, False),
]
CHIPS = [  # x%, y%, tone, amount
    (27.91, 61.39, "blind", "0.5"),
    (27.91, 35.89, "blind", "1"),
    (72.08, 61.39, "bet",   "2.3"),
]
POT_Y        = 36.00
HERO_CARDS_Y = 56.96
DEALER_X, DEALER_Y = 58.93, 88.75


BUILD = 3.4   # native build multiplier; every surface is displayed downscaled


def _px(css: str, k: float = None) -> str:
    """Multiply every `<n>px` in a CSS block by the build factor. Percentages,
    unitless numbers and colours are untouched, so only physical sizes scale —
    which is exactly what rendering the same design at a higher DPI does."""
    if k is None:
        k = BUILD          # resolved at CALL time, so a caller can rebuild at another scale
    def rep(m):
        v = float(m.group(1)) * k
        return f"{v:g}px"
    return re.sub(r"(-?\d*\.?\d+)px", rep, css)


def product_css() -> str:
    """The real product surfaces, emitted at BUILD x their native pixel sizes."""
    return _px(f"""
    /* ══════════════════════════════════════════════════════════════════════
       REAL STACKEDPOKER PRODUCT SURFACES — native sizes, reproduced verbatim.
       Each block is scaled as ONE object by its wrapper's transform, so every
       internal proportion stays exactly as the product renders it.
       ══════════════════════════════════════════════════════════════════════ */

    /* ── PlayingCardMini, SIZE_CONFIG.lg (54x76, r8, inset 6, rank 21, suit 16) ── */
    .sp-card {{ position:relative; width:54px; height:76px; border-radius:8px;
               overflow:hidden; flex:none;
               background:linear-gradient(165deg,#FEFEFC 0%,#F9F6F0 40%,#F0EBE1 100%);
               border:1px solid rgba(200,193,182,0.80);
               box-shadow:0 8px 20px rgba(0,0,0,0.58), 0 2px 6px rgba(0,0,0,0.32),
                          inset 0 1.5px 0 rgba(255,255,255,1), inset 0 -1px 0 rgba(0,0,0,0.07); }}
    .sp-card-gloss {{ position:absolute; left:0; right:0; top:0; height:40%;
                     background:linear-gradient(180deg,rgba(255,255,255,0.32) 0%,rgba(255,255,255,0) 100%);
                     border-radius:inherit; pointer-events:none; }}
    .sp-idx {{ position:absolute; z-index:10; display:flex; flex-direction:column;
              line-height:1; font-weight:900; font-family:"Geist",sans-serif; }}
    .sp-idx-tl {{ top:6px; left:6px; align-items:flex-start; }}
    .sp-idx-br {{ bottom:6px; right:6px; align-items:flex-end; transform:rotate(180deg); }}
    .sp-idx .r {{ font-size:21px; line-height:1; letter-spacing:-0.025em; }}
    .sp-idx .s {{ font-size:16px; line-height:1; }}
    .sp-black {{ color:#1C1917; }}
    .sp-red   {{ color:#B41C22; }}

    /* ── PreflopTable, DESKTOP_LAYOUT — 672x441 (16/10.5) ───────────────── */
    .sp-table {{ position:relative; width:672px; height:441px; }}
    .sp-rail {{ position:absolute; inset:10%; border-radius:999px;
               background:linear-gradient(180deg,rgba(255,255,255,0.05) 0%,rgba(255,255,255,0.015) 100%);
               box-shadow:0 18px 44px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.04); }}
    .sp-felt {{ position:absolute; inset:12.5%; border-radius:999px;
               border:1px solid rgba(2,44,34,0.4);
               background:radial-gradient(ellipse at 50% 40%,
                          rgba(21,63,46,0.92) 0%, rgba(13,44,32,0.95) 55%, rgba(7,26,20,0.97) 100%);
               box-shadow:inset 0 0 46px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.03); }}

    .sp-seat {{ position:absolute; transform:translate(-50%,-50%); white-space:nowrap;
               text-align:center; z-index:10; }}
    .sp-hero-prefix {{ font-family:"Geist",sans-serif; font-size:9px; font-weight:900;
                      letter-spacing:0.1em; text-transform:uppercase;
                      color:rgba(196,181,253,0.8); margin-right:3px; vertical-align:middle; }}
    .sp-pos {{ font-family:"Geist",sans-serif; font-size:13px; font-weight:800;
              vertical-align:middle; color:{FOREGROUND}; }}
    .sp-pos-hero {{ color:rgb(221,214,254); }}
    .sp-seat-folded {{ opacity:0.35; }}

    .sp-meta {{ position:absolute; transform:translate(-50%,-50%); display:flex;
               flex-direction:column; align-items:center; gap:8px; z-index:10;
               white-space:nowrap; text-align:center; }}
    .sp-stack  {{ font-family:"Geist",sans-serif; font-size:10px; font-weight:500;
                 color:rgba(114,130,151,0.45); }}
    .sp-fold   {{ font-family:"Geist",sans-serif; font-size:10px; font-weight:600;
                 color:rgba(114,130,151,0.4); opacity:0.35; }}
    .sp-verb   {{ font-family:"Geist",sans-serif; font-size:10px; font-weight:600;
                 color:rgba(125,211,252,0.8); }}
    .sp-behind {{ font-family:"Geist",sans-serif; font-size:9px; font-weight:500;
                 color:rgba(114,130,151,0.4); }}

    /* PokerChip: conic edge wedges + inset face + inner hairline ring */
    .sp-chips {{ position:absolute; transform:translate(-50%,-50%); z-index:10;
                display:flex; flex-direction:column; align-items:center; gap:2px; }}
    .sp-pile {{ position:relative; width:24px; height:24px; }}
    .sp-chip {{ position:absolute; width:20px; height:20px; border-radius:999px;
               box-shadow:0 2px 3px rgba(0,0,0,0.55), inset 0 1px 1px rgba(255,255,255,0.2); }}
    .sp-chip-face {{ position:absolute; inset:3px; border-radius:999px; border:1px solid; }}
    .sp-chip-face::after {{ content:""; position:absolute; inset:2px; border-radius:999px;
                           border:1px solid rgba(255,255,255,0.1); }}
    .sp-chip-amt {{ font-family:"Geist",sans-serif; font-size:10px; font-weight:700;
                   line-height:1; font-variant-numeric:tabular-nums; }}
    .sp-chip-blind {{ background:repeating-conic-gradient(#cbd5e1 0deg 18deg,#3f4b5f 18deg 36deg); }}
    .sp-chip-blind .sp-chip-face {{ background:linear-gradient(155deg,#64748b 0%,#334155 65%,#1e293b 100%);
                                   border-color:rgba(226,232,240,0.35); }}
    .sp-chip-bet {{ background:repeating-conic-gradient(#bae6fd 0deg 18deg,#0c4a6e 18deg 36deg); }}
    .sp-chip-bet .sp-chip-face {{ background:linear-gradient(155deg,#38bdf8 0%,#0284c7 65%,#075985 100%);
                                 border-color:rgba(224,242,254,0.45); }}
    .sp-amt-blind {{ color:#e2e8f0; }}
    .sp-amt-bet   {{ color:#e0f2fe; }}

    .sp-pot {{ position:absolute; left:50%; transform:translate(-50%,-50%); z-index:10;
              display:flex; flex-direction:column; align-items:center; gap:2px; }}
    .sp-pot-l {{ font-family:"Geist",sans-serif; font-size:8px; font-weight:700;
                letter-spacing:0.18em; text-transform:uppercase; color:rgba(252,211,77,0.5); }}
    .sp-pot-v {{ font-family:"Geist",sans-serif; font-size:13px; font-weight:900;
                color:rgb(253,230,138); white-space:nowrap; }}

    .sp-herocards {{ position:absolute; left:50%; transform:translate(-50%,-50%); z-index:10;
                    display:flex; flex-direction:column; align-items:center; gap:6px; }}
    .sp-herocards-row {{ position:relative; display:flex; width:114px;
                        align-items:center; justify-content:space-between; }}
    .sp-heroglow {{ position:absolute; width:112px; height:64px; border-radius:999px;
                   background:rgba(139,92,246,0.10); filter:blur(24px); pointer-events:none; }}

    .sp-dealer {{ position:absolute; transform:translate(-50%,-50%); z-index:20;
                display:flex; width:16px; height:16px; align-items:center; justify-content:center;
                border-radius:999px; border:1px solid rgba(0,0,0,0.1); background:rgba(255,255,255,0.9);
                font-family:"Geist",sans-serif; font-size:8px; font-weight:900; color:#262626;
                box-shadow:0 1px 2px rgba(0,0,0,0.05); }}

    .sp-status {{ width:672px; border-radius:12px; border:1px solid rgba(36,42,56,0.2);
                 background:rgba(25,31,46,0.1); padding:8px 12px; text-align:center; }}
    .sp-status-1 {{ font-family:"Geist",sans-serif; font-size:10px; font-weight:500;
                   letter-spacing:0.06em; color:rgba(255,255,255,0.4); white-space:nowrap; }}
    .sp-status-2 {{ font-family:"Geist",sans-serif; font-size:11px; font-weight:900;
                   letter-spacing:0.06em; color:rgb(196,181,253); white-space:nowrap;
                   margin-top:2px; }}

    /* ── DecisionSpot option buttons ─────────────────────────────────────── */
    .sp-opts {{ display:flex; gap:12px; }}
    .sp-opt {{ position:relative; width:216px; border-radius:12px; padding:16px;
              font-family:"Geist",sans-serif; font-size:14px; font-weight:600;
              text-align:left; border:1px solid; overflow:hidden; }}
    .sp-opt-idle {{ border-color:rgba(36,42,56,0.5); background:rgba(25,31,46,0.4); color:{FOREGROUND}; }}
    .sp-opt-sel {{ border-color:rgba(139,92,246,0.5); background:rgba(139,92,246,0.15);
                  color:rgb(221,214,254); box-shadow:0 10px 15px -3px rgba(46,16,101,0.2); }}
    .sp-opt-sel::before {{ content:""; position:absolute; inset:0;
                          background:linear-gradient(to bottom right, rgba(139,92,246,0.10), transparent); }}
    .sp-opt-dim {{ border-color:rgba(36,42,56,0.2); background:rgba(25,31,46,0.15);
                  color:rgba(114,130,151,0.3); opacity:0.5; }}

    /* ── PokerRangeGrid, mode="strategy" — 13x13, gap-px, r3, native 520 ─── */
    .sp-range {{ width:520px; }}
    .sp-range-title {{ font-family:"Geist Mono",monospace; font-size:10px; font-weight:600;
                      letter-spacing:0.18em; text-transform:uppercase;
                      color:rgba(114,130,151,0.4); text-align:center; }}
    .sp-range-cols {{ display:flex; gap:1px; margin-left:20px; margin-bottom:2px; }}
    .sp-range-col {{ flex:1; text-align:center; font-family:"Geist",sans-serif;
                    font-size:10px; font-weight:700; color:rgba(114,130,151,0.4); line-height:1; }}
    .sp-range-row {{ display:flex; align-items:center; gap:1px; }}
    .sp-range-rowlabel {{ width:20px; flex:none; text-align:center; font-family:"Geist",sans-serif;
                         font-size:10px; font-weight:700; color:rgba(114,130,151,0.4); }}
    .sp-cell {{ position:relative; flex:1; aspect-ratio:1/1; display:flex; align-items:center;
               justify-content:center; border-radius:3px; overflow:hidden;
               font-family:"Geist",sans-serif; font-size:10px; font-weight:700; line-height:1;
               background:{ACTION_OTHER}; }}
    /* The 3-bet layer. Same colour and same width for every hand at the same
       frequency — no per-cell brightness, opacity, glow or gradient. */
    .sp-3bet {{ position:absolute; left:0; top:0; bottom:0; background:{ACTION_3BET}; }}
    /* highlightHand — ring-2 ring-white ring-offset-1. A ring on TOP of the cell,
       so A5s keeps the exact 3-bet colour every other 3-bet hand has. */
    .sp-cellwrap {{ position:relative; flex:1; min-width:0; aspect-ratio:1/1; display:flex; }}
    .sp-cellwrap .sp-cell {{ flex:1; }}
    .sp-ring {{ position:absolute; inset:0; border-radius:3px; pointer-events:none; z-index:20;
               box-shadow:0 0 0 1px {FILM_RING_OFFSET}, 0 0 0 3px #fff; }}
    .sp-cell span {{ position:relative; z-index:10; border-radius:2px;
                    background:rgba(0,0,0,0.3); padding:0 2px; color:#fff;
                    filter:drop-shadow(0 1px 1px rgba(0,0,0,0.05)); }}
    /* highlightHand — ring-2 ring-white ring-offset-1 ring-offset-background.
       A ring, never a glow: the cell keeps its own strategy colour underneath. */
    .sp-cell-hi {{ z-index:10; }}
    .sp-range-legend {{ display:flex; align-items:center; justify-content:center;
                       gap:16px; padding-top:4px; }}
    .sp-legend-item {{ display:flex; align-items:center; gap:8px; }}
    .sp-legend-sw {{ width:14px; height:14px; border-radius:3px; flex:none; }}
    .sp-legend-tx {{ font-family:"Geist",sans-serif; font-size:13px; font-weight:400;
                    color:rgba(114,130,151,0.6); }}
""")


def card_html(rank: str, suit: str = "s") -> str:
    """PlayingCardMini — two mirrored corner indices, no centre pip."""
    sym = {"s": "&spades;", "h": "&hearts;", "d": "&diams;", "c": "&clubs;"}[suit]
    col = "sp-red" if suit in "hd" else "sp-black"
    idx = f'<span class="r">{rank}</span><span class="s">{sym}</span>'
    return (f'<div class="sp-card"><div class="sp-card-gloss"></div>'
            f'<div class="sp-idx sp-idx-tl {col}">{idx}</div>'
            f'<div class="sp-idx sp-idx-br {col}">{idx}</div></div>')


def table_html(show_cards: bool = True) -> str:
    """The real PreflopTable at native size, in its settled tb-s6a state."""
    parts = ['<div class="sp-table">', '<div class="sp-rail"></div>', '<div class="sp-felt"></div>']

    parts.append(
        f'<div class="sp-pot" style="top:{POT_Y}%">'
        f'<span class="sp-pot-l">Pot</span><span class="sp-pot-v">3.8 BB</span></div>')

    for x, y, tone, amt in CHIPS:
        parts.append(
            f'<div class="sp-chips" style="left:{x}%;top:{y}%">'
            f'<div class="sp-pile">'
            f'<div class="sp-chip sp-chip-{tone}" style="left:0;top:4px;opacity:0.65"><div class="sp-chip-face"></div></div>'
            f'<div class="sp-chip sp-chip-{tone}" style="left:4px;top:0"><div class="sp-chip-face"></div></div>'
            f'</div><span class="sp-chip-amt sp-amt-{tone}">{amt}</span></div>')

    if show_cards:
        parts.append(
            f'<div class="sp-herocards" style="top:{HERO_CARDS_Y}%">'
            f'<div class="sp-heroglow"></div>'
            f'<div class="sp-herocards-row">{card_html("A")}{card_html("5")}</div></div>')

    for pos, lx, ly, mx, my, rows, is_hero, folded in SEATS:
        cls = "sp-seat" + (" sp-seat-folded" if folded else "")
        prefix = '<span class="sp-hero-prefix">HERO &middot;</span>' if is_hero else ""
        poscls = "sp-pos sp-pos-hero" if is_hero else "sp-pos"
        parts.append(f'<div class="{cls}" style="left:{lx}%;top:{ly}%">'
                     f'{prefix}<span class="{poscls}">{pos}</span></div>')
        inner = "".join(f'<span class="sp-{k if k != "stack" else "stack"}">{v}</span>'
                        if k != "behind" else f'<span class="sp-behind">{v}</span>' for k, v in rows)
        parts.append(f'<div class="sp-meta" style="left:{mx}%;top:{my}%">{inner}</div>')

    parts.append(f'<div class="sp-dealer" style="left:{DEALER_X}%;top:{DEALER_Y}%">D</div>')
    parts.append("</div>")
    return "".join(parts)


def status_html() -> str:
    return ('<div class="sp-status">'
            '<p class="sp-status-1">PREFLOP &middot; 100BB EFFECTIVE</p>'
            '<p class="sp-status-2">CO OPEN</p></div>')


def options_html(resolved: bool) -> str:
    """The three real options in the lesson's own order. 3-Bet is the answer."""
    if resolved:
        css = ["sp-opt sp-opt-sel", "sp-opt sp-opt-dim", "sp-opt sp-opt-dim"]
    else:
        css = ["sp-opt sp-opt-idle"] * 3
    labels = ["3-Bet", "Call", "Fold"]
    return ('<div class="sp-opts">'
            + "".join(f'<div class="{c}" id="sp-opt-{i}"><span style="position:relative">{l}</span></div>'
                      for i, (c, l) in enumerate(zip(css, labels)))
            + "</div>")


def hand_name(r: int, c: int) -> str:
    a, b = RANKS[r], RANKS[c]
    if r == c:
        return a + a
    return (a + b + "s") if c > r else (b + a + "o")


def cell_background(hand: str) -> str:
    """segmentedBackground() from PokerRangeGrid — hard stops, exactly
    proportional to frequency. Never opacity, never glow."""
    mix = STRATEGIES.get(hand)
    if not mix:
        return f"linear-gradient(to right, {ACTION_OTHER} 0%, {ACTION_OTHER} 100%)"
    order = ["3bet", "other"]
    stops, cum = [], 0.0
    total = sum(mix.values())
    for a in order:
        f = mix.get(a)
        if not f:
            continue
        col = ACTION_3BET if a == "3bet" else ACTION_OTHER
        start = cum / total * 100
        cum += f
        end = cum / total * 100
        stops += [f"{col} {start:g}%", f"{col} {end:g}%"]
    return f"linear-gradient(to right, {', '.join(stops)})"


def range_html(ring_offset_color: str) -> str:
    """The real 13x13 strategy grid. Every cell is built by one rule; the hero
    hand differs ONLY by a ring, never by its colour, brightness or glow."""
    out = [f'<div class="sp-range-title" id="sp-range-title">{RANGE_LABEL}</div>',
           '<div class="sp-range-grid" id="sp-range-grid">',
           '<div class="sp-range-cols">'
           + "".join(f'<div class="sp-range-col">{r}</div>' for r in RANKS) + "</div>"]
    for r in range(13):
        row = [f'<div class="sp-range-rowlabel">{RANKS[r]}</div>']
        for c in range(13):
            h = hand_name(r, c)
            freq = STRATEGIES.get(h, {}).get("3bet", 0)
            layer = (f'<div class="sp-3bet" style="width:{freq * 100:g}%"></div>' if freq else "")
            cell = f'<div class="sp-cell" data-hand="{h}">{layer}<span>{h}</span></div>'
            if h == HIGHLIGHT:
                # ring-2 ring-white ring-offset-1 lives on a sibling, so the cell
                # itself keeps the identical 3-bet fill every other 3-bet hand has
                cell = (f'<div class="sp-cellwrap">{cell}'
                        f'<div class="sp-ring" id="sp-hero-ring"></div></div>')
            row.append(cell)
        out.append('<div class="sp-range-row">' + "".join(row) + "</div>")
    out.append("</div>")
    out.append('<div class="sp-range-legend" id="sp-range-legend">'
               f'<div class="sp-legend-item"><div class="sp-legend-sw" style="background:{ACTION_3BET}"></div>'
               '<span class="sp-legend-tx">3-Bet</span></div>'
               f'<div class="sp-legend-item"><div class="sp-legend-sw" style="background:{ACTION_OTHER}"></div>'
               '<span class="sp-legend-tx">Other action</span></div></div>')
    return "".join(out)


def ring_css(offset_color: str) -> str:
    """ring-2 ring-white ring-offset-1, at build scale."""
    o, w = 1 * BUILD, 2 * BUILD
    return (f"box-shadow:0 0 0 {o:g}px {offset_color}, 0 0 0 {o + w:g}px #fff;"
            f"border-radius:{3 * BUILD:g}px;")
