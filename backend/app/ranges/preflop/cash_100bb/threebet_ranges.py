"""
3-bet ranges for 100bb cash game.

Philosophy:
- Polarized construction: value hands + bluffs with blocker/equity properties.
- Value hands: premiums + strong broadway that play well in 3bet pots.
- Bluffs: suited aces (A blocker + equity), suited connectors (equity + backdoor).
- Linear construction only for very strong positions (e.g., BTN vs SB where
  SB opens wide — we can 3bet all strong hands, not just polar extremes).

Mixed frequencies denote hands that are sometimes called, sometimes 3bet.
"""

# ── SB 3-bet vs BTN open (~7–10%) ─────────────────────────────────────────────
# Polarized: strong value + blocker bluffs.
# SB is OOP postflop so 3bets force folds or play bloated OOP pots — we want
# strong hands that benefit from fold equity and blocker bluffs.
SB_3BET_VS_BTN = [
    # Value
    "AA", "KK", "QQ",
    "JJ:0.6",    # sometimes flat
    "AKs", "AKo",
    "AQs:0.7",
    # Bluffs / semi-bluffs (A-blocker + suited equity)
    "A5s", "A4s", "A3s",
    # Suited connectors as bluffs (equity + fold equity)
    "76s:0.5",
    "65s:0.5",
    "54s:0.4",
    "KQs:0.4",   # strong hand, sometimes 3bet for value
]

# ── BB 3-bet vs BTN open (~6–9%) ──────────────────────────────────────────────
# Similar to SB but BB has positional advantage postflop — slightly wider value.
BB_3BET_VS_BTN = [
    # Value
    "AA", "KK", "QQ",
    "JJ:0.5",
    "TT:0.3",
    "AKs", "AKo",
    "AQs:0.6",
    "AJs:0.3",
    # Bluffs
    "A5s", "A4s", "A3s", "A2s:0.5",
    "K5s:0.4",  # backdoor equity blocker
    "65s:0.5",
    "54s:0.4",
    "76s:0.4",
]

# ── BB 3-bet vs CO open (~5–8%) ───────────────────────────────────────────────
# CO opens tighter than BTN — 3bet range is slightly narrower value.
BB_3BET_VS_CO = [
    # Value
    "AA", "KK", "QQ",
    "JJ:0.4",
    "AKs", "AKo",
    "AQs:0.5",
    # Bluffs
    "A5s", "A4s", "A3s",
    "65s:0.4",
    "54s:0.4",
]

# ── BTN 3-bet vs CO open (~5–8%) ──────────────────────────────────────────────
# BTN in position — linear construction possible for strong hands.
# Also includes polar bluffs.
BTN_3BET_VS_CO = [
    # Value (linear — all strong hands)
    "AA", "KK", "QQ", "JJ",
    "TT:0.4",
    "AKs", "AKo",
    "AQs", "AQo:0.5",
    "KQs:0.5",
    # Bluffs
    "A5s", "A4s",
    "65s:0.4",
    "54s:0.3",
]

# ── BTN 3-bet vs SB open (~7–10%) ─────────────────────────────────────────────
# SB opens wide — BTN can 3bet wider with linear range.
BTN_3BET_VS_SB = [
    # Value (wide linear — SB opens wide, so much of BTN range has equity)
    "AA", "KK", "QQ", "JJ", "TT",
    "99:0.5",
    "AKs", "AKo",
    "AQs", "AQo:0.6",
    "AJs:0.7",
    "KQs:0.7",
    "KQo:0.4",
    # Bluffs
    "A5s", "A4s", "A3s:0.5",
    "76s:0.5",
    "65s:0.5",
]

# ── CO 3-bet vs BTN open (~5–7%) ──────────────────────────────────────────────
# CO OOP vs BTN — polarized.
CO_3BET_VS_BTN = [
    # Value
    "AA", "KK", "QQ",
    "JJ:0.5",
    "AKs", "AKo",
    "AQs:0.5",
    # Bluffs
    "A5s", "A4s", "A3s",
    "65s:0.4",
    "54s:0.4",
]
