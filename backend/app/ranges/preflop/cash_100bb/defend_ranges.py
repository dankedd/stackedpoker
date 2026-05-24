"""
Big Blind defend ranges for 100bb cash game.

Philosophy:
- BB gets the best pot odds — defends wide.
- Ranges tighten as opener's position is earlier (UTG opens tighter).
- OOP disadvantage means some borderline hands are folded vs tighter openers.
- SB defend vs BTN open is widest due to SB's wide steal range.

Capped ranges: BB calling (not 3-betting) is capped relative to the opener
because BB would 3-bet AA/KK/QQ/AK a significant frequency.
These ranges represent BB CALLING ranges — not BB's full defend range.
"""

# ── BB defend (call) vs BTN open (~33–38%) ────────────────────────────────────
# BB faces BTN steal — widest defend range.
# Many hands with playability: pairs, suited hands, connected hands.
BB_VS_BTN_DEFEND = [
    # All pairs
    "AA:0.2", "KK:0.2", "QQ:0.3", "JJ:0.4",  # premiums often 3bet
    "TT", "99", "88", "77", "66", "55", "44", "33", "22",
    # Suited aces
    "AKs:0.3", "AQs:0.4", "AJs:0.5",  # stronger aces often 3bet
    "ATs", "A9s", "A8s", "A7s", "A6s", "A5s", "A4s", "A3s", "A2s",
    # Suited kings
    "KQs:0.5", "KJs", "KTs", "K9s", "K8s", "K7s", "K6s:0.7", "K5s:0.6",
    # Suited queens
    "QJs:0.5", "QTs", "Q9s", "Q8s", "Q7s:0.7", "Q6s:0.6",
    # Suited jacks
    "JTs:0.6", "J9s", "J8s", "J7s:0.7",
    # Suited tens
    "T9s", "T8s", "T7s:0.7", "T6s:0.5",
    # Suited nines and below (connectors)
    "98s", "97s", "96s:0.7",
    "87s", "86s:0.7", "85s:0.5",
    "76s", "75s:0.7",
    "65s", "64s:0.6",
    "54s", "53s:0.6",
    "43s:0.5", "42s:0.4",
    "32s:0.4",
    # Offsuit broadway
    "AKo:0.2", "AQo:0.3", "AJo:0.5",
    "ATo", "A9o", "A8o", "A7o:0.7", "A6o:0.6",
    "KQo:0.5", "KJo", "KTo", "K9o:0.7", "K8o:0.5",
    "QJo:0.6", "QTo", "Q9o:0.7",
    "JTo", "J9o:0.7", "J8o:0.5",
    "T9o:0.7", "T8o:0.5",
    "98o:0.6",
]

# ── BB defend (call) vs CO open (~28–33%) ─────────────────────────────────────
# CO opens tighter than BTN — BB defends somewhat tighter.
BB_VS_CO_DEFEND = [
    # Pairs (premiums often 3bet)
    "AA:0.2", "KK:0.2", "QQ:0.2", "JJ:0.3",
    "TT", "99", "88", "77", "66", "55", "44", "33", "22",
    # Suited aces
    "AKs:0.3", "AQs:0.4", "AJs:0.5",
    "ATs", "A9s", "A8s", "A7s", "A6s", "A5s", "A4s", "A3s",
    "A2s:0.6",
    # Suited kings
    "KQs:0.4", "KJs", "KTs", "K9s", "K8s:0.7", "K7s:0.5",
    # Suited queens
    "QJs:0.5", "QTs", "Q9s", "Q8s:0.6",
    # Suited jacks
    "JTs:0.6", "J9s", "J8s:0.7",
    # Suited tens and below
    "T9s", "T8s", "T7s:0.6",
    "98s", "97s:0.7",
    "87s", "86s:0.6",
    "76s", "75s:0.6",
    "65s", "64s:0.5",
    "54s", "53s:0.5",
    "43s:0.4",
    # Offsuit
    "AKo:0.2", "AQo:0.3", "AJo:0.5",
    "ATo", "A9o", "A8o:0.7",
    "KQo:0.5", "KJo", "KTo:0.7",
    "QJo:0.6", "QTo:0.7",
    "JTo:0.7", "J9o:0.5",
    "T9o:0.6",
    "98o:0.5",
]

# ── BB defend (call) vs SB open (~35–40%) ─────────────────────────────────────
# SB opens wide → BB defends widest vs SB.
# BB has positional advantage postflop vs SB.
BB_VS_SB_DEFEND = [
    # Pairs
    "AA:0.2", "KK:0.2", "QQ:0.3", "JJ:0.4",
    "TT", "99", "88", "77", "66", "55", "44", "33", "22",
    # Suited aces
    "AKs:0.3", "AQs:0.4", "AJs:0.5",
    "ATs", "A9s", "A8s", "A7s", "A6s", "A5s", "A4s", "A3s", "A2s",
    # Suited kings
    "KQs:0.5", "KJs", "KTs", "K9s", "K8s", "K7s", "K6s:0.7",
    # Suited queens and jacks
    "QJs:0.5", "QTs", "Q9s", "Q8s:0.7",
    "JTs:0.6", "J9s", "J8s:0.7",
    # Suited tens and below
    "T9s", "T8s", "T7s:0.7",
    "98s", "97s",
    "87s", "86s:0.7",
    "76s", "75s:0.7",
    "65s", "64s:0.6",
    "54s", "53s:0.6",
    "43s:0.5", "42s:0.4",
    # Offsuit
    "AKo:0.2", "AQo:0.3", "AJo:0.5",
    "ATo", "A9o", "A8o", "A7o:0.7",
    "KQo:0.5", "KJo", "KTo",
    "QJo:0.6", "QTo:0.7", "Q9o:0.6",
    "JTo", "J9o:0.7",
    "T9o:0.7",
    "98o:0.6",
    "87o:0.5",
]

# ── BB defend (call) vs HJ/UTG open (~20–24%) ─────────────────────────────────
# Much tighter — UTG/HJ ranges are strong, BB needs better hands.
BB_VS_UTG_DEFEND = [
    # Pairs (premiums often 3bet)
    "AA:0.2", "KK:0.2", "QQ:0.3", "JJ:0.4",
    "TT", "99", "88", "77", "66", "55", "44",
    "33:0.6", "22:0.5",
    # Suited hands (tighter)
    "AKs:0.3", "AQs:0.4", "AJs:0.6",
    "ATs", "A9s", "A8s:0.7", "A7s:0.6",
    "A5s:0.7", "A4s:0.6",
    "KQs:0.5", "KJs", "KTs:0.7",
    "QJs:0.6", "QTs:0.7",
    "JTs",
    "T9s", "98s:0.7",
    "87s:0.6", "76s:0.6",
    "65s:0.5", "54s:0.5",
    # Offsuit (tight)
    "AKo:0.3", "AQo:0.5",
    "AJo:0.7", "ATo:0.7",
    "KQo:0.6", "KJo:0.7",
    "QJo:0.5",
]
