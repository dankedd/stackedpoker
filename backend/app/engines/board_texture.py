from __future__ import annotations
from app.models.schemas import BoardTexture


RANK_ORDER = {r: i for i, r in enumerate("23456789TJQKA", 2)}


def classify_board(flop: list[str], turn: list[str] = None, river: list[str] = None) -> BoardTexture:
    """Classify board texture from community cards."""
    if not flop or len(flop) < 3:
        return _unknown_texture()

    all_cards = flop + (turn or []) + (river or [])
    flop_cards = flop[:3]

    ranks = [c[0].upper() for c in flop_cards]
    suits = [c[1].lower() for c in flop_cards]
    rank_values = sorted([RANK_ORDER.get(r, 0) for r in ranks], reverse=True)

    suitedness = _classify_suitedness(suits)
    is_paired = len(set(ranks)) < 3
    connectivity = _classify_connectivity(rank_values)
    wetness = _classify_wetness(suitedness, connectivity, is_paired)
    high_card = ranks[rank_values.index(max(rank_values))]
    bucket = _classify_bucket(rank_values, suitedness, is_paired, connectivity)
    range_advantage = _classify_range_advantage(rank_values, bucket)

    description = _build_description(bucket, suitedness, connectivity, is_paired, high_card)

    return BoardTexture(
        bucket=bucket,
        high_card_rank=high_card,
        connectivity=connectivity,
        wetness=wetness,
        suitedness=suitedness,
        is_paired=is_paired,
        description=description,
        range_advantage=range_advantage,
    )


# ── Helpers ────────────────────────────────────────────────────────────────

def _classify_suitedness(suits: list[str]) -> str:
    unique = len(set(suits))
    if unique == 1:
        return "monotone"
    if unique == 2:
        return "two_tone"
    return "rainbow"


def _classify_connectivity(rv: list[int]) -> str:
    """rv is sorted descending list of rank values."""
    hi, mid, lo = rv[0], rv[1], rv[2]
    gaps = [(hi - mid - 1), (mid - lo - 1)]
    total_gap = hi - lo

    if total_gap <= 2:
        return "connected"
    if total_gap <= 4 and max(gaps) <= 2:
        return "oesd"
    if total_gap <= 6:
        return "gutshot"
    return "disconnected"


def _classify_wetness(suitedness: str, connectivity: str, is_paired: bool) -> str:
    if is_paired:
        return "dry"
    wet_score = 0
    if suitedness == "monotone":
        wet_score += 2
    elif suitedness == "two_tone":
        wet_score += 1
    if connectivity == "connected":
        wet_score += 2
    elif connectivity == "oesd":
        wet_score += 1
    if wet_score >= 3:
        return "wet"
    if wet_score >= 1:
        return "semi_wet"
    return "dry"


def _classify_bucket(rv: list[int], suitedness: str, is_paired: bool, connectivity: str) -> str:
    hi = rv[0]

    if is_paired:
        return "paired_board"

    if suitedness == "monotone":
        return "monotone"

    # High card category
    if hi >= RANK_ORDER["A"]:  # 14
        if connectivity == "disconnected" and suitedness == "rainbow":
            return "A_high_dry"
        return "A_high_wet"

    if hi >= RANK_ORDER["K"]:  # 13
        if connectivity in ("connected", "oesd") or suitedness in ("two_tone", "monotone"):
            return "wet_broadway"
        return "K_high_dry"

    if hi >= RANK_ORDER["Q"]:  # 12
        if connectivity in ("connected", "oesd"):
            return "wet_broadway"
        return "Q_high_semi"

    if hi >= RANK_ORDER["J"]:  # 11
        if connectivity in ("connected", "oesd"):
            return "wet_broadway"
        return "J_high"

    if hi >= RANK_ORDER["T"]:  # 10
        if connectivity in ("connected", "oesd"):
            return "low_connected"
        return "T_high"

    # Low boards 2-9
    if connectivity in ("connected", "oesd"):
        return "low_connected"
    return "low_dry"


def _classify_range_advantage(rv: list[int], bucket: str) -> str:
    """
    Rough heuristic: ace/king-high dry boards heavily favour the PFR,
    low connected boards are more neutral or favour the caller's range.
    """
    if bucket in ("A_high_dry", "K_high_dry"):
        return "pfr"
    if bucket in ("low_connected", "wet_broadway", "monotone"):
        return "caller"
    if bucket in ("A_high_wet", "Q_high_semi"):
        return "pfr"
    return "neutral"


def _build_description(bucket: str, suitedness: str, connectivity: str, is_paired: bool, high_card: str) -> str:
    suit_desc = {
        "rainbow": "rainbow",
        "two_tone": "two-tone",
        "monotone": "monotone (flush possible)",
    }[suitedness]

    conn_desc = {
        "disconnected": "disconnected",
        "gutshot": "gutshot-connected",
        "oesd": "open-ended straight draw possible",
        "connected": "heavily connected",
    }[connectivity]

    if is_paired:
        return f"Paired board — {suit_desc}, {conn_desc}"

    bucket_labels = {
        "A_high_dry": f"Ace-high dry board ({suit_desc})",
        "A_high_wet": f"Ace-high wet board ({suit_desc}, {conn_desc})",
        "K_high_dry": f"King-high dry board ({suit_desc})",
        "wet_broadway": f"Broadway wet board ({suit_desc}, {conn_desc})",
        "Q_high_semi": f"Queen-high semi-wet board ({suit_desc})",
        "J_high": f"Jack-high board ({suit_desc})",
        "T_high": f"Ten-high board ({suit_desc})",
        "low_connected": f"Low connected board ({suit_desc}, {conn_desc})",
        "low_dry": f"Low dry board ({suit_desc})",
        "monotone": f"Monotone board — three-flush",
        "paired_board": f"Paired board ({suit_desc})",
    }
    return bucket_labels.get(bucket, f"{high_card}-high board ({suit_desc})")


def _unknown_texture() -> BoardTexture:
    return BoardTexture(
        bucket="unknown",
        high_card_rank="?",
        connectivity="disconnected",
        wetness="dry",
        suitedness="rainbow",
        is_paired=False,
        description="Unable to classify board",
        range_advantage="neutral",
    )
