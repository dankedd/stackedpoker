"""
Abstraction similarity scoring for nearest-neighbour strategy retrieval.

similarity_score(key_a, key_b) → float [0.0, 1.0]

Dimensions and weights
----------------------
spot_type        0.30  binary match — most important: SRP vs 3bet are fundamentally different
spr_bucket       0.22  ordinal distance on 0_2 < 2_4 < 4_8 < 8_PLUS
board_class      0.25  group-based texture similarity (see _BOARD_GROUPS)
position_matchup 0.13  IP/OOP match + position family proximity
street           0.07  binary match
player_count     0.03  binary/linear distance

Weights sum to 1.00.

Board class groups
------------------
Same group → 1.0 (identical texture family)
Adjacent group → 0.55 (related texture family)
Other → 0.10 (structurally dissimilar but not zero — keeps fallback viable)
"""

from __future__ import annotations

# ── Board class groupings ─────────────────────────────────────────────────────
# Each group represents boards with similar strategic properties.
# Adjacency encodes which groups share strategic characteristics.

_BOARD_GROUPS: dict[str, str] = {
    "A_HIGH_DRY":          "dry_high_card",
    "K_HIGH_DRY":          "dry_high_card",
    "RAINBOW_STATIC":      "dry_high_card",
    "A_HIGH_WET":          "wet_high_card",
    "K_HIGH_WET":          "wet_high_card",
    "DOUBLE_BROADWAY":     "broadway",
    "TRIPLE_BROADWAY":     "broadway",
    "LOW_CONNECTED":       "low_connected",
    "LOW_DYNAMIC":         "low_connected",
    "MIDDLE_CONNECTED":    "middle",
    "RAINBOW_DYNAMIC":     "middle",
    "PAIRED_LOW":          "paired",
    "PAIRED_HIGH":         "paired",
    "MONOTONE":            "monotone",
    "FLUSH_COMPLETING":    "completing",
    "STRAIGHT_COMPLETING": "completing",
    "NEUTRAL":             "neutral",
}

# Each group lists which other groups are "adjacent" (thematically related)
_BOARD_ADJACENT: dict[str, frozenset[str]] = {
    "dry_high_card":  frozenset({"broadway", "wet_high_card", "paired"}),
    "wet_high_card":  frozenset({"dry_high_card", "broadway", "middle"}),
    "broadway":       frozenset({"dry_high_card", "wet_high_card"}),
    "low_connected":  frozenset({"middle", "completing"}),
    "middle":         frozenset({"low_connected", "wet_high_card"}),
    "paired":         frozenset({"dry_high_card", "broadway"}),
    "monotone":       frozenset({"completing"}),
    "completing":     frozenset({"low_connected", "monotone"}),
    "neutral":        frozenset(),
}

_BOARD_SAME_GROUP_SCORE  = 1.00
_BOARD_ADJACENT_SCORE    = 0.55
_BOARD_UNRELATED_SCORE   = 0.10


def _board_similarity(a: str, b: str) -> float:
    if a == b:
        return 1.0
    ga = _BOARD_GROUPS.get(a, "neutral")
    gb = _BOARD_GROUPS.get(b, "neutral")
    if ga == gb:
        return _BOARD_SAME_GROUP_SCORE
    if gb in _BOARD_ADJACENT.get(ga, frozenset()):
        return _BOARD_ADJACENT_SCORE
    return _BOARD_UNRELATED_SCORE


# ── SPR bucket similarity ─────────────────────────────────────────────────────

_SPR_ORDER: dict[str, int] = {"0_2": 0, "2_4": 1, "4_8": 2, "8_PLUS": 3}
_SPR_MAX_DIST = 3  # max possible distance


def _spr_similarity(a: str, b: str) -> float:
    if a == b:
        return 1.0
    oa = _SPR_ORDER.get(a, 2)
    ob = _SPR_ORDER.get(b, 2)
    dist = abs(oa - ob)
    return max(0.0, 1.0 - dist / _SPR_MAX_DIST)


# ── Position matchup similarity ───────────────────────────────────────────────
# Two dimensions: (1) IP vs OOP, (2) proximity of position families.

_IP_POSITIONS = frozenset({
    "BTN", "CO", "HJ", "LJ", "UTG", "UTG1", "UTG2",
})

def _is_ip_matchup(matchup: str) -> bool | None:
    """Return True if the first-listed position is IP, None if multiway/unknown."""
    if matchup.startswith("MULTIWAY") or matchup == "UNKNOWN":
        return None
    parts = matchup.split("_vs_")
    if len(parts) != 2:
        return None
    ip_pos = parts[0]
    return ip_pos in _IP_POSITIONS


_POSITION_FAMILY: dict[str, str] = {
    "BTN": "late", "CO": "late",
    "HJ": "mid",  "LJ": "mid",
    "UTG": "early", "UTG1": "early", "UTG2": "early",
    "SB": "blind", "BB": "blind",
}


def _position_similarity(a: str, b: str) -> float:
    if a == b:
        return 1.0

    # Both multiway → 0.7 (same dynamic)
    if a.startswith("MULTIWAY") and b.startswith("MULTIWAY"):
        return 0.70

    # One multiway, one HU → low similarity
    if a.startswith("MULTIWAY") or b.startswith("MULTIWAY"):
        return 0.20

    # Extract IP player family
    ip_a = _is_ip_matchup(a)
    ip_b = _is_ip_matchup(b)

    # Different sides (one IP, one OOP) → 0.0 (never use wrong side strategy)
    if ip_a is not None and ip_b is not None and ip_a != ip_b:
        return 0.0

    # Same side — compare position families
    parts_a = a.split("_vs_")
    parts_b = b.split("_vs_")
    if len(parts_a) == 2 and len(parts_b) == 2:
        fam_a = _POSITION_FAMILY.get(parts_a[0], "unknown")
        fam_b = _POSITION_FAMILY.get(parts_b[0], "unknown")
        if fam_a == fam_b:
            return 0.85   # same position family, different specific seat
        return 0.55       # different family (early vs late), same IP/OOP side

    return 0.40


# ── Street similarity ─────────────────────────────────────────────────────────

def _street_similarity(a: str, b: str) -> float:
    return 1.0 if a == b else 0.0


# ── Player count similarity ───────────────────────────────────────────────────

def _player_count_similarity(a: int, b: int) -> float:
    if a == b:
        return 1.0
    return max(0.0, 1.0 - abs(a - b) * 0.35)


# ── Public API ────────────────────────────────────────────────────────────────

# Dimension weights — must sum to 1.0
_WEIGHTS = {
    "spot_type":        0.30,
    "spr_bucket":       0.22,
    "board_class":      0.25,
    "position_matchup": 0.13,
    "street":           0.07,
    "player_count":     0.03,
}
assert abs(sum(_WEIGHTS.values()) - 1.0) < 1e-9, "Weights must sum to 1.0"


def parse_node_key(key: str) -> dict:
    """
    Parse a canonical node key string into its component dimensions.

    Format: spot_type::position_matchup::stack_depth::spr_bucket::board_class::street::Np[::ip|oop]
    Returns a dict with all dimensions.  Raises ValueError on malformed keys.
    """
    # Strip optional is_ip suffix added by strategy_db
    stripped = key
    if stripped.endswith("::ip") or stripped.endswith("::oop"):
        is_ip_str = stripped.rsplit("::", 1)[1]
        stripped = stripped.rsplit("::", 1)[0]
    else:
        is_ip_str = None

    parts = stripped.split("::")
    if len(parts) != 7:
        raise ValueError(
            f"Invalid node key — expected 7 segments, got {len(parts)}: {key!r}"
        )

    player_count_str = parts[6]
    if player_count_str.endswith("p"):
        player_count_str = player_count_str[:-1]

    result = {
        "spot_type":          parts[0],
        "position_matchup":   parts[1],
        "stack_depth_bucket": parts[2],
        "spr_bucket":         parts[3],
        "board_class":        parts[4],
        "street":             parts[5],
        "player_count":       int(player_count_str),
    }
    if is_ip_str is not None:
        result["is_ip"] = (is_ip_str == "ip")

    return result


def similarity_score(key_a: str, key_b: str) -> float:
    """
    Compute normalised similarity [0.0, 1.0] between two node key strings.

    Higher = more strategically similar.
    1.0 = identical spot.
    0.0 = completely dissimilar.

    Handles both bare node_key strings and extended keys with ::ip/::oop suffix.
    """
    try:
        a = parse_node_key(key_a)
        b = parse_node_key(key_b)
    except ValueError:
        return 0.0

    spot_sim  = 1.0 if a["spot_type"] == b["spot_type"] else 0.0
    spr_sim   = _spr_similarity(a["spr_bucket"], b["spr_bucket"])
    board_sim = _board_similarity(a["board_class"], b["board_class"])
    pos_sim   = _position_similarity(a["position_matchup"], b["position_matchup"])
    str_sim   = _street_similarity(a["street"], b["street"])
    pc_sim    = _player_count_similarity(a["player_count"], b["player_count"])

    return (
        _WEIGHTS["spot_type"]        * spot_sim
        + _WEIGHTS["spr_bucket"]     * spr_sim
        + _WEIGHTS["board_class"]    * board_sim
        + _WEIGHTS["position_matchup"] * pos_sim
        + _WEIGHTS["street"]         * str_sim
        + _WEIGHTS["player_count"]   * pc_sim
    )


def similarity_breakdown(key_a: str, key_b: str) -> dict:
    """
    Return per-dimension scores for debugging / observability.
    """
    try:
        a = parse_node_key(key_a)
        b = parse_node_key(key_b)
    except ValueError:
        return {"error": "invalid key"}

    dims = {
        "spot_type":        1.0 if a["spot_type"] == b["spot_type"] else 0.0,
        "spr_bucket":       _spr_similarity(a["spr_bucket"], b["spr_bucket"]),
        "board_class":      _board_similarity(a["board_class"], b["board_class"]),
        "position_matchup": _position_similarity(a["position_matchup"], b["position_matchup"]),
        "street":           _street_similarity(a["street"], b["street"]),
        "player_count":     _player_count_similarity(a["player_count"], b["player_count"]),
    }
    weighted = {k: round(v * _WEIGHTS[k], 4) for k, v in dims.items()}
    total = round(sum(weighted.values()), 4)
    return {"dimensions": dims, "weighted": weighted, "total": total}
