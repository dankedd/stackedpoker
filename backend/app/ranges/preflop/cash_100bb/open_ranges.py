"""
Open-raise (RFI) ranges for 100bb cash game.

Philosophy:
- Simplified practical ranges. Not solver-exact.
- Represent realistic modern low-to-mid stakes play.
- Mixed frequencies (0.0–1.0) indicate strategically borderline hands.
- Ranges widen as position improves (UTG tightest → BTN widest).
"""

# ── UTG (~13–15% of hands) ─────────────────────────────────────────────────────
# Tight value-heavy range. Pairs 99+, strong suited broadways, AKo/AQo.
UTG_OPEN = [
    # Pairs
    "AA", "KK", "QQ", "JJ", "TT", "99",
    "88:0.5",
    # Suited hands
    "AKs", "AQs", "AJs", "ATs",
    "KQs", "KJs",
    "QJs",
    # Suited connectors (occasional)
    "JTs:0.7",
    "T9s:0.4",
    "A9s:0.7",
    "KTs:0.6",
    # Offsuit
    "AKo", "AQo",
    "AJo:0.5",
    "KQo:0.7",
]

# ── HJ / LJ (~16–19%) ─────────────────────────────────────────────────────────
# Opens all UTG hands + slightly wider suited/offsuit range.
HJ_OPEN = [
    # Pairs
    "AA", "KK", "QQ", "JJ", "TT", "99", "88",
    "77:0.5",
    # Suited
    "AKs", "AQs", "AJs", "ATs", "A9s",
    "A8s:0.6",
    "KQs", "KJs", "KTs",
    "QJs", "QTs:0.6",
    "JTs",
    "T9s",
    "98s:0.6",
    "87s:0.4",
    # Offsuit
    "AKo", "AQo", "AJo",
    "ATo:0.5",
    "KQo",
    "KJo:0.6",
    "QJo:0.4",
]

# ── CO (~24–28%) ───────────────────────────────────────────────────────────────
# Significantly wider. Adds many suited hands, more offsuit broadways,
# all medium pairs.
CO_OPEN = [
    # Pairs
    "AA", "KK", "QQ", "JJ", "TT", "99", "88", "77", "66",
    "55:0.6",
    # Suited aces
    "AKs", "AQs", "AJs", "ATs", "A9s", "A8s", "A7s", "A6s", "A5s",
    "A4s:0.7", "A3s:0.5",
    # Suited kings
    "KQs", "KJs", "KTs", "K9s:0.6",
    # Suited queens and below
    "QJs", "QTs", "Q9s:0.5",
    "JTs", "J9s:0.5",
    "T9s", "T8s:0.5",
    "98s", "97s:0.4",
    "87s", "76s:0.6",
    "65s:0.4",
    # Offsuit
    "AKo", "AQo", "AJo", "ATo",
    "A9o:0.4",
    "KQo", "KJo",
    "KTo:0.5",
    "QJo",
    "QTo:0.4",
    "JTo:0.4",
]

# ── BTN (~40–45%) ──────────────────────────────────────────────────────────────
# Very wide. Opens all pairs, almost all suited hands, many offsuit hands.
BTN_OPEN = [
    # All pairs
    "AA", "KK", "QQ", "JJ", "TT", "99", "88", "77", "66", "55", "44", "33", "22",
    # Suited aces — all of them
    "AKs", "AQs", "AJs", "ATs", "A9s", "A8s", "A7s", "A6s", "A5s", "A4s", "A3s", "A2s",
    # Suited kings
    "KQs", "KJs", "KTs", "K9s", "K8s", "K7s:0.7", "K6s:0.6", "K5s:0.5",
    # Suited queens
    "QJs", "QTs", "Q9s", "Q8s:0.6", "Q7s:0.4",
    # Suited jacks
    "JTs", "J9s", "J8s:0.7", "J7s:0.4",
    # Suited tens
    "T9s", "T8s", "T7s:0.6",
    # Suited nines
    "98s", "97s", "96s:0.5",
    # Suited eights and below (connectors / one-gappers)
    "87s", "86s:0.6", "76s", "75s:0.5", "65s", "64s:0.4", "54s", "53s:0.4", "43s:0.4",
    # Offsuit broadway
    "AKo", "AQo", "AJo", "ATo", "A9o", "A8o:0.7", "A7o:0.6", "A6o:0.5", "A5o:0.5",
    "KQo", "KJo", "KTo", "K9o:0.6", "K8o:0.4",
    "QJo", "QTo", "Q9o:0.5",
    "JTo", "J9o:0.6",
    "T9o:0.5",
    "98o:0.4",
]

# ── SB (~35–40% open, slightly tighter than BTN due to postflop OOP) ──────────
SB_OPEN = [
    # All pairs
    "AA", "KK", "QQ", "JJ", "TT", "99", "88", "77", "66", "55", "44",
    "33:0.7", "22:0.6",
    # Suited aces
    "AKs", "AQs", "AJs", "ATs", "A9s", "A8s", "A7s", "A6s", "A5s", "A4s", "A3s",
    "A2s:0.7",
    # Suited kings
    "KQs", "KJs", "KTs", "K9s", "K8s:0.7", "K7s:0.5",
    # Suited queens
    "QJs", "QTs", "Q9s", "Q8s:0.6",
    # Suited jacks and below
    "JTs", "J9s", "J8s:0.6",
    "T9s", "T8s:0.7",
    "98s", "97s:0.6",
    "87s", "76s:0.7", "65s:0.6", "54s:0.5",
    # Offsuit
    "AKo", "AQo", "AJo", "ATo", "A9o", "A8o:0.7", "A7o:0.6",
    "KQo", "KJo", "KTo", "K9o:0.5",
    "QJo", "QTo:0.7",
    "JTo:0.7",
    "T9o:0.5",
]
