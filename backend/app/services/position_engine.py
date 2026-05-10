"""
Deterministic poker position assignment engine.

Supports 2–9 player tables. Given per-player detected position labels
(some may be empty or unrecognised), assigns canonical positions using
clockwise inference from the nearest reliable anchor (BTN, then SB, then BB).

Entry points:
    normalize_position(raw)              → canonical str
    get_positions_for_count(n)           → list[str]  (clockwise from BTN)
    infer_positions(detected)            → (list[str], method_str)
    visual_seat_index(pos, hero_pos, n)  → int        (0 = hero)
"""
from __future__ import annotations

# ── Canonical position tables ──────────────────────────────────────────────
# Clockwise seating order starting from BTN.
# Preflop action order: canonical[3:] + canonical[:3]  (UTG first, BTN last).

POSITIONS_BY_COUNT: dict[int, list[str]] = {
    2: ["BTN", "BB"],                                           # HU: BTN posts SB
    3: ["BTN", "SB", "BB"],
    4: ["BTN", "SB", "BB", "UTG"],
    5: ["BTN", "SB", "BB", "UTG", "CO"],
    6: ["BTN", "SB", "BB", "UTG", "HJ", "CO"],
    7: ["BTN", "SB", "BB", "UTG", "LJ", "HJ", "CO"],
    8: ["BTN", "SB", "BB", "UTG", "UTG+1", "LJ", "HJ", "CO"],
    9: ["BTN", "SB", "BB", "UTG", "UTG+1", "UTG+2", "LJ", "HJ", "CO"],
}

# All valid canonical position names (union across all table sizes)
ALL_POSITIONS: frozenset[str] = frozenset(
    p for positions in POSITIONS_BY_COUNT.values() for p in positions
)

# ── Alias table → canonical name ──────────────────────────────────────────

POSITION_ALIASES: dict[str, str] = {
    # BTN
    "BTN": "BTN", "BUTTON": "BTN", "DEALER": "BTN", "D": "BTN",
    "BU": "BTN", "BT": "BTN",
    # SB
    "SB": "SB", "SMALL BLIND": "SB", "SMALLBLIND": "SB", "SMALL_BLIND": "SB",
    "SM BLIND": "SB",
    # BB
    "BB": "BB", "BIG BLIND": "BB", "BIGBLIND": "BB", "BIG_BLIND": "BB",
    "BG BLIND": "BB",
    # UTG
    "UTG": "UTG", "UNDER THE GUN": "UTG", "EP": "UTG",
    "UTG+1": "UTG+1", "UTG1": "UTG+1",
    "UTG+2": "UTG+2", "UTG2": "UTG+2",
    # LJ
    "LJ": "LJ", "LOJACK": "LJ", "LOW JACK": "LJ",
    # HJ — note: LJ is sometimes called HJ in loose usage; we keep them separate
    "HJ": "HJ", "HIJACK": "HJ", "HIGH JACK": "HJ",
    # CO
    "CO": "CO", "CUTOFF": "CO", "CUT OFF": "CO", "CUT-OFF": "CO",
    "CUT": "CO",
}


def normalize_position(raw: str) -> str:
    """
    Map any position label (from OCR / AI extraction) to its canonical name.

    Returns the canonical name if found, otherwise the uppercased input
    (caller should check against ALL_POSITIONS if strict validation needed).
    """
    upper = raw.upper().strip().replace("-", " ")
    return POSITION_ALIASES.get(upper, upper)


# ── Table layout helpers ───────────────────────────────────────────────────

def get_positions_for_count(n: int) -> list[str]:
    """Return canonical clockwise positions for n players, starting from BTN."""
    n = max(2, min(9, n))
    return list(POSITIONS_BY_COUNT[n])


# ── Position inference ─────────────────────────────────────────────────────

def infer_positions(
    detected: list[str],  # normalised position per player; "" = unknown
) -> tuple[list[str], str]:
    """
    Infer canonical positions for all N players via clockwise reasoning.

    Returns (assigned_positions, method_str).

    Strategy:
      1. If all positions already known and unique → "all_detected"
      2. Find anchor in priority: BTN → SB → BB → UTG
         Back-compute which player holds BTN, then assign all positions clockwise.
      3. If no anchor found: keep known positions, fill unknowns from canonical
         remainder → "partial_fallback"
    """
    N = len(detected)
    if N < 2:
        return list(detected), "trivial"

    canonical = get_positions_for_count(N)
    canon_set = frozenset(canonical)

    # ── 1. Already complete and unique ────────────────────────────────────
    if all(p in canon_set for p in detected) and len(set(detected)) == N:
        return list(detected), "all_detected"

    # ── 2. Anchor-based inference ─────────────────────────────────────────
    btn_player: int | None = None  # index of the player who holds BTN

    for anchor_pos in ("BTN", "SB", "BB", "UTG"):
        if anchor_pos not in canonical:
            continue
        anchor_canon_idx = canonical.index(anchor_pos)
        for player_idx, pos in enumerate(detected):
            if pos == anchor_pos:
                btn_player = (player_idx - anchor_canon_idx) % N
                break
        if btn_player is not None:
            break

    if btn_player is not None:
        result: list[str] = [""] * N
        for ci, pos in enumerate(canonical):
            pi = (btn_player + ci) % N
            result[pi] = pos
        return result, "anchor_inferred"

    # ── 3. Partial fallback: fill unknown slots with remaining canonical ──
    result = list(detected)
    occupied = {p for p in result if p in canon_set}
    remaining = [p for p in canonical if p not in occupied]
    ri = 0
    for i, p in enumerate(result):
        if p not in canon_set:
            if ri < len(remaining):
                result[i] = remaining[ri]
                ri += 1
            else:
                result[i] = f"P{i + 1}"
    return result, "partial_fallback"


# ── Visual seat indices ────────────────────────────────────────────────────

def visual_seat_index(position: str, hero_position: str, n_players: int) -> int:
    """
    Compute how far clockwise a player sits from the hero's seat.

    Hero → 0 (bottom of screen)
    First clockwise from hero → 1
    …
    Last clockwise (just to hero's right) → N-1
    """
    canonical = get_positions_for_count(n_players)
    try:
        pos_idx  = canonical.index(position)
        hero_idx = canonical.index(hero_position)
    except ValueError:
        return 0
    return (pos_idx - hero_idx) % n_players


def preflop_action_order(n_players: int) -> list[str]:
    """
    Return positions in preflop action order (UTG first, BTN last).

    Canonical: BTN SB BB UTG HJ CO  →  preflop: UTG HJ CO BTN SB BB
    """
    canonical = get_positions_for_count(n_players)
    if "UTG" in canonical:
        utg_idx = canonical.index("UTG")
    else:
        # Heads-up or 3-max without UTG: BTN (SB in HU) acts first preflop
        utg_idx = 0
    return canonical[utg_idx:] + canonical[:utg_idx]
