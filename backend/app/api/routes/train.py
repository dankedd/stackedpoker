"""Training tools API routes — range trainer setup and range evaluation."""

import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.middleware.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(tags=["train"])


# ── Range trainer data ────────────────────────────────────────────────────────
#
# Each entry defines a node scenario with a human title, description, position
# context, and the target range expressed as a flat list of hand combos using
# standard two-card notation (e.g. "AKs", "AKo", "AA", "KK", …).
#
# Suited combos like "AKs" represent all four suited AK combinations.
# Offsuit combos like "AKo" represent all twelve offsuit AK combinations.
# Pocket pairs like "AA" represent all six AA combinations.
#
# The frontend range grid displays these as a 13×13 matrix and the user submits
# their selections as a list of combo strings in the same format.

_RANGE_NODES: dict[str, dict] = {
    "BTN_open": {
        "title": "BTN RFI (Open Raise)",
        "description": "You are on the Button with no prior action. Build the correct opening range.",
        "position": "BTN",
        "node_type": "RFI",
        "facing_size_bb": 0.0,
        "instruction": "Select all hands you should open-raise from the Button (approx. 42% of hands).",
        "target_range": [
            # Pocket pairs — all pairs down to 22
            "AA", "KK", "QQ", "JJ", "TT", "99", "88", "77", "66", "55", "44", "33", "22",
            # Ace-high
            "AKs", "AKo", "AQs", "AQo", "AJs", "AJo", "ATs", "ATo",
            "A9s", "A9o", "A8s", "A8o", "A7s", "A7o", "A6s", "A5s", "A4s", "A3s", "A2s",
            # King-high
            "KQs", "KQo", "KJs", "KJo", "KTs", "KTo", "K9s", "K9o", "K8s", "K7s", "K6s", "K5s",
            # Queen-high
            "QJs", "QJo", "QTs", "QTo", "Q9s", "Q9o", "Q8s",
            # Jack-high
            "JTs", "JTo", "J9s", "J8s",
            # Ten-high
            "T9s", "T8s", "T7s",
            # Nine-high suited connectors
            "98s", "97s",
            # Eight-high
            "87s", "86s",
            # Seven-high
            "76s", "75s",
            # Six-high
            "65s", "64s",
            # Five-high
            "54s",
        ],
        "hint": "BTN opens the widest range — roughly top 40-45% of hands including suited connectors and broadway hands.",
        "total_combos_approx": 560,
    },

    "CO_open": {
        "title": "CO RFI (Open Raise)",
        "description": "You are on the Cutoff with no prior action. Build the correct opening range.",
        "position": "CO",
        "node_type": "RFI",
        "facing_size_bb": 0.0,
        "instruction": "Select all hands you should open-raise from the Cutoff (approx. 27% of hands).",
        "target_range": [
            # All pocket pairs
            "AA", "KK", "QQ", "JJ", "TT", "99", "88", "77", "66", "55", "44", "33", "22",
            # Ace-high
            "AKs", "AKo", "AQs", "AQo", "AJs", "AJo", "ATs", "ATo",
            "A9s", "A8s", "A7s", "A6s", "A5s", "A4s", "A3s", "A2s",
            # King-high
            "KQs", "KQo", "KJs", "KJo", "KTs", "KTo", "K9s", "K8s", "K7s", "K6s",
            # Queen-high
            "QJs", "QJo", "QTs", "QTo", "Q9s", "Q8s",
            # Jack-high
            "JTs", "JTo", "J9s", "J8s",
            # Ten-high
            "T9s", "T8s",
            # Connectors
            "98s", "87s", "76s", "65s", "54s",
        ],
        "hint": "CO opens slightly tighter than BTN — still wide but cut some marginal offsuit holdings.",
        "total_combos_approx": 380,
    },

    "HJ_open": {
        "title": "HJ RFI (Open Raise)",
        "description": "You are in the Hijack with no prior action. Build the correct opening range.",
        "position": "HJ",
        "node_type": "RFI",
        "facing_size_bb": 0.0,
        "instruction": "Select all hands you should open-raise from the Hijack (approx. 22% of hands).",
        "target_range": [
            "AA", "KK", "QQ", "JJ", "TT", "99", "88", "77", "66", "55",
            "AKs", "AKo", "AQs", "AQo", "AJs", "AJo", "ATs", "ATo",
            "A9s", "A8s", "A7s", "A6s", "A5s",
            "KQs", "KQo", "KJs", "KJo", "KTs", "K9s",
            "QJs", "QJo", "QTs", "Q9s",
            "JTs", "J9s",
            "T9s", "T8s",
            "98s", "87s", "76s", "65s",
        ],
        "hint": "HJ range is around top 22% — tighter than CO, fewer offsuit combos, fewer low pairs.",
        "total_combos_approx": 310,
    },

    "BTN_vs_BB_3bet_call": {
        "title": "BTN vs BB 3-Bet — Call Range",
        "description": "You opened BTN, the BB 3-bets to ~9bb. Build your calling range (flat, no 4-bet).",
        "position": "BTN",
        "node_type": "VS_3BET",
        "facing_size_bb": 9.0,
        "instruction": "Select all hands you should call the BB 3-bet with (IP defend range).",
        "target_range": [
            # Strong pairs that don't want to 4-bet/fold
            "JJ", "TT", "99", "88",
            # Broadway suited
            "AJs", "ATs", "KQs", "KJs", "QJs",
            # Offsuit broadway (some)
            "AJo", "ATo", "KQo",
            # Suited connectors with good equity + playability
            "JTs", "T9s", "98s", "87s", "76s",
            # Suited aces with good post-flop potential
            "A5s", "A4s", "A3s", "A2s",
            # King suited
            "KTs", "K9s",
            # Queen suited
            "QTs",
        ],
        "hint": "IP against a 3-bet you can call wider — hands that play well post-flop IP. Pure value (QQ+, AK) should 4-bet. Trash folds.",
        "total_combos_approx": 160,
    },

    "BB_vs_BTN_3bet": {
        "title": "BB 3-Bet vs BTN Open",
        "description": "You are in the BB and the BTN has opened. Build your 3-betting range.",
        "position": "BB",
        "node_type": "VS_OPEN",
        "facing_size_bb": 2.5,
        "instruction": "Select all hands you should 3-bet with from the BB vs a BTN open.",
        "target_range": [
            # Value 3-bets
            "AA", "KK", "QQ", "JJ",
            "AKs", "AKo", "AQs", "AQo",
            # Bluff 3-bets (polarised — strong enough to not fold but not want to flat OOP)
            "A5s", "A4s", "A3s", "A2s",  # nut blockers + backdoor equity
            "KJs", "K9s",                # blocker value
            "QJs", "J9s",                # suited cards with equity
            "T9s", "87s", "76s",         # suited connectors (high initiative)
        ],
        "hint": "From BB OOP you want a polarised 3-bet range: strong value hands + suited bluffs that block nuts and have decent equity.",
        "total_combos_approx": 110,
    },

    "UTG_open": {
        "title": "UTG RFI (Open Raise)",
        "description": "You are Under The Gun (first to act) with no prior action.",
        "position": "UTG",
        "node_type": "RFI",
        "facing_size_bb": 0.0,
        "instruction": "Select all hands you should open-raise from UTG (approx. 14% of hands).",
        "target_range": [
            # Pairs
            "AA", "KK", "QQ", "JJ", "TT", "99", "88",
            # Ace-high
            "AKs", "AKo", "AQs", "AQo", "AJs", "AJo", "ATs",
            "A9s", "A8s", "A7s", "A6s", "A5s",
            # King-high
            "KQs", "KQo", "KJs", "KTs",
            # Queen-high
            "QJs", "QTs",
            # Jack-high
            "JTs",
            # Suited connectors
            "T9s", "98s",
        ],
        "hint": "UTG must be tight — around top 14%. Marginal offsuit hands and low pairs become folds here.",
        "total_combos_approx": 190,
    },

    "SB_vs_BTN_defend": {
        "title": "SB vs BTN Open — Defend Range",
        "description": "BTN opens, folded to you in SB. Build your calling + 3-bet range.",
        "position": "SB",
        "node_type": "VS_OPEN",
        "facing_size_bb": 2.5,
        "instruction": "Select all hands you should play (call or 3-bet) from the SB vs BTN open.",
        "target_range": [
            # 3-bet value
            "AA", "KK", "QQ", "JJ", "AKs", "AKo",
            # 3-bet bluff
            "A5s", "A4s", "A3s", "A2s",
            # Call range (OOP, so tighter)
            "TT", "99", "88",
            "AQs", "AQo", "AJs", "ATs",
            "KQs", "KQo", "KJs",
            "QJs", "JTs",
            "T9s", "98s",
        ],
        "hint": "SB is the worst position post-flop (always OOP). Defend tighter than BB — more 3-bets and fewer calls.",
        "total_combos_approx": 145,
    },
}


# ── Request body ──────────────────────────────────────────────────────────────

class RangeEvaluationBody(BaseModel):
    node_id: str
    submitted_range: list[str]  # list of combo strings e.g. ["AKs", "AKo", "AA"]


# ── GET /train/ranges/{node_id} ───────────────────────────────────────────────

@router.get("/train/ranges/{node_id}")
async def get_range_trainer_setup(
    node_id: str,
    _current_user: dict = Depends(get_current_user),
) -> dict:
    """
    Return the RangeTrainerSetup for a given preflop node.

    The frontend uses this to initialise the range grid:
    - node metadata (title, position, facing_size_bb, instruction)
    - list of available node IDs for navigation
    Does NOT include the target range (that would defeat the drill).
    """
    if node_id not in _RANGE_NODES:
        available = list(_RANGE_NODES.keys())
        raise HTTPException(
            status_code=404,
            detail=f"Node '{node_id}' not found. Available nodes: {available}",
        )

    node = _RANGE_NODES[node_id]

    return {
        "node_id": node_id,
        "title": node["title"],
        "description": node["description"],
        "position": node["position"],
        "node_type": node["node_type"],
        "facing_size_bb": node["facing_size_bb"],
        "instruction": node["instruction"],
        "hint": node["hint"],
        "total_combos_approx": node["total_combos_approx"],
        "available_nodes": list(_RANGE_NODES.keys()),
    }


# ── POST /train/ranges/evaluate ───────────────────────────────────────────────

@router.post("/train/ranges/evaluate")
async def evaluate_range_submission(
    body: RangeEvaluationBody,
    _current_user: dict = Depends(get_current_user),
) -> dict:
    """
    Evaluate a submitted range against the target range for a node.

    Returns:
    - overlap score 0-100
    - missed combos (in target but not submitted)
    - extra combos (submitted but not in target)
    - quality label
    - detailed feedback
    """
    node_id = body.node_id
    if node_id not in _RANGE_NODES:
        raise HTTPException(status_code=404, detail=f"Node '{node_id}' not found.")

    node = _RANGE_NODES[node_id]
    target = set(node["target_range"])
    submitted = set(body.submitted_range)

    # Normalise to uppercase for comparison
    target_norm = {c.strip() for c in target}
    submitted_norm = {c.strip() for c in submitted}

    intersection = target_norm & submitted_norm
    union = target_norm | submitted_norm
    missed = sorted(target_norm - submitted_norm)
    extra = sorted(submitted_norm - target_norm)

    overlap_pct = round(len(intersection) / len(union) * 100, 1) if union else 0.0
    precision = round(len(intersection) / len(submitted_norm) * 100, 1) if submitted_norm else 0.0
    recall = round(len(intersection) / len(target_norm) * 100, 1) if target_norm else 0.0

    # Score is the harmonic mean of precision and recall (F1-style), scaled 0-100
    if precision + recall > 0:
        f1 = 2 * precision * recall / (precision + recall)
    else:
        f1 = 0.0
    score = round(f1, 1)

    if score >= 90:
        quality = "perfect"
        summary = "Excellent! Your range is very close to the GTO target."
    elif score >= 75:
        quality = "good"
        summary = "Good range construction — a few small adjustments needed."
    elif score >= 55:
        quality = "acceptable"
        summary = "Reasonable attempt but there are meaningful gaps to address."
    elif score >= 30:
        quality = "mistake"
        summary = "Range needs significant work. Review the key hands below."
    else:
        quality = "punt"
        summary = "Range construction needs a full restart. Study the target range carefully."

    # Build targeted feedback
    feedback_parts = [summary]
    if missed:
        # Group into categories for readability
        feedback_parts.append(
            f"Missing {len(missed)} combo type(s): {', '.join(missed[:8])}"
            + ("…" if len(missed) > 8 else "")
        )
    if extra:
        feedback_parts.append(
            f"Over-included {len(extra)} combo type(s): {', '.join(extra[:8])}"
            + ("…" if len(extra) > 8 else "")
        )

    return {
        "node_id": node_id,
        "score": score,
        "quality": quality,
        "overlap_pct": overlap_pct,
        "precision": precision,
        "recall": recall,
        "correct_count": len(intersection),
        "target_count": len(target_norm),
        "submitted_count": len(submitted_norm),
        "missed_combos": missed,
        "extra_combos": extra,
        "feedback": " ".join(feedback_parts),
        "hint": node["hint"],
    }
