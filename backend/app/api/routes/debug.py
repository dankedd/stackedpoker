"""
POST /api/debug/spot

Developer endpoint — accepts a raw CanonicalHand JSON body and returns the
full solver abstraction output for that hand:

    SolverSpot      — all strategic dimensions
    BoardFeatures   — full board texture profile (None for preflop-only hands)
    NodeKey         — hashable spot identifier with prefix helpers
    Derived strings — node_key_string, positional_prefix, street_prefix

Intended for integration testing, solver pipeline validation, and debugging
the CanonicalHand → SolverSpot → NodeKey pipeline without touching the UI.

No auth guard: this is a debug/internal route.  Gate behind settings.debug
or an API key if you expose it to production.
"""

from __future__ import annotations

import logging
from typing import Any, Optional

from fastapi import APIRouter, Body, HTTPException
from pydantic import BaseModel

from app.models.canonical import CanonicalHand
from app.solver.abstractions import NodeKey, SpotAbstraction
from app.solver.board_features import BoardFeatures
from app.solver.models import SolverSpot

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Swagger example payload ────────────────────────────────────────────────────
#
# BTN vs BB, SRP, 100 BB deep, flop Ah Kd 3c (A-high dry rainbow).
# Hero is BTN (seat_1), villain is BB (seat_2).
# Preflop: BTN opens 2.5bb, BB calls → pot 5bb.
# Flop: BB checks, BTN bets 3.5bb.
#
# Expected NodeKey: SRP::BTN_vs_BB::100bb::8_PLUS::A_HIGH_DRY::flop::2p
#
_EXAMPLE_BTN_BB_SRP: dict[str, Any] = {
    "hand_id": "debug-btn-bb-srp-001",
    "site": "GGPoker",
    "game_type": "NLHE",
    "is_tournament": False,
    "schema_version": "1.0",
    "stakes": {
        "small_blind_bb": 0.5,
        "big_blind": 1.0,
        "ante_bb": 0.0,
        "straddle_bb": 0.0,
        "currency": "USD",
        "display": "$0.50/$1.00"
    },
    "table_name": "Debug Table",
    "table_max_seats": 6,
    "players": [
        {
            "id": "seat_1",
            "name": "Hero",
            "seat": 1,
            "position": "BTN",
            "stack_bb": 100.0,
            "hole_cards": [
                {"rank": "A", "suit": "h", "notation": "Ah"},
                {"rank": "K", "suit": "d", "notation": "Kd"}
            ],
            "is_hero": True,
            "is_active": True
        },
        {
            "id": "seat_2",
            "name": "Villain",
            "seat": 2,
            "position": "BB",
            "stack_bb": 100.0,
            "hole_cards": [],
            "is_hero": False,
            "is_active": True
        }
    ],
    "hero_id": "seat_1",
    "streets": [
        {
            "name": "preflop",
            "board_cards": [],
            "pot_start_bb": 0.0,
            "actions": [
                {
                    "sequence": 0,
                    "street": "preflop",
                    "player_id": "seat_2",
                    "player_name": "Villain",
                    "action": "post_bb",
                    "amount_bb": 1.0,
                    "total_bet_bb": 1.0,
                    "is_hero": False,
                    "is_all_in": False,
                    "stack_before_bb": 100.0,
                    "stack_after_bb": 99.0,
                    "pot_before_bb": 0.0,
                    "pot_after_bb": 1.0
                },
                {
                    "sequence": 1,
                    "street": "preflop",
                    "player_id": "seat_1",
                    "player_name": "Hero",
                    "action": "raise",
                    "amount_bb": 2.5,
                    "total_bet_bb": 2.5,
                    "is_hero": True,
                    "is_all_in": False,
                    "stack_before_bb": 100.0,
                    "stack_after_bb": 97.5,
                    "pot_before_bb": 1.0,
                    "pot_after_bb": 3.5
                },
                {
                    "sequence": 2,
                    "street": "preflop",
                    "player_id": "seat_2",
                    "player_name": "Villain",
                    "action": "call",
                    "amount_bb": 1.5,
                    "total_bet_bb": 2.5,
                    "is_hero": False,
                    "is_all_in": False,
                    "stack_before_bb": 99.0,
                    "stack_after_bb": 97.5,
                    "pot_before_bb": 3.5,
                    "pot_after_bb": 5.0
                }
            ]
        },
        {
            "name": "flop",
            "board_cards": [
                {"rank": "A", "suit": "h", "notation": "Ah"},
                {"rank": "K", "suit": "d", "notation": "Kd"},
                {"rank": "3", "suit": "c", "notation": "3c"}
            ],
            "pot_start_bb": 5.0,
            "actions": [
                {
                    "sequence": 3,
                    "street": "flop",
                    "player_id": "seat_2",
                    "player_name": "Villain",
                    "action": "check",
                    "amount_bb": 0.0,
                    "total_bet_bb": 0.0,
                    "is_hero": False,
                    "is_all_in": False,
                    "stack_before_bb": 97.5,
                    "stack_after_bb": 97.5,
                    "pot_before_bb": 5.0,
                    "pot_after_bb": 5.0
                },
                {
                    "sequence": 4,
                    "street": "flop",
                    "player_id": "seat_1",
                    "player_name": "Hero",
                    "action": "bet",
                    "amount_bb": 3.5,
                    "total_bet_bb": 3.5,
                    "is_hero": True,
                    "is_all_in": False,
                    "stack_before_bb": 97.5,
                    "stack_after_bb": 94.0,
                    "pot_before_bb": 5.0,
                    "pot_after_bb": 8.5
                }
            ]
        }
    ],
    "effective_stack_bb": 97.5,
    "final_pot_bb": 8.5,
    "parse_source": "manual"
}

# BTN vs BB SRP on a low dynamic board: 9h 8h 7c
# Expected NodeKey: SRP::BTN_vs_BB::100bb::8_PLUS::LOW_DYNAMIC::flop::2p
#
# IMPORTANT: This must be a fully standalone dict — NOT built via {**_EXAMPLE_BTN_BB_SRP}.
# FastAPI's openapi_extra deep-merges dicts, which concatenates lists instead of
# replacing them, causing duplicated players (4 instead of 2) and streets (4 instead of 2).
_EXAMPLE_BTN_BB_987: dict[str, Any] = {
    "hand_id": "debug-btn-bb-srp-987",
    "site": "GGPoker",
    "game_type": "NLHE",
    "is_tournament": False,
    "schema_version": "1.0",
    "stakes": {
        "small_blind_bb": 0.5,
        "big_blind": 1.0,
        "ante_bb": 0.0,
        "straddle_bb": 0.0,
        "currency": "USD",
        "display": "$0.50/$1.00"
    },
    "table_name": "Debug Table",
    "table_max_seats": 6,
    "players": [
        {
            "id": "seat_1",
            "name": "Hero",
            "seat": 1,
            "position": "BTN",
            "stack_bb": 100.0,
            "hole_cards": [
                {"rank": "9", "suit": "s", "notation": "9s"},
                {"rank": "8", "suit": "s", "notation": "8s"}
            ],
            "is_hero": True,
            "is_active": True
        },
        {
            "id": "seat_2",
            "name": "Villain",
            "seat": 2,
            "position": "BB",
            "stack_bb": 100.0,
            "hole_cards": [],
            "is_hero": False,
            "is_active": True
        }
    ],
    "hero_id": "seat_1",
    "streets": [
        {
            "name": "preflop",
            "board_cards": [],
            "pot_start_bb": 0.0,
            "actions": [
                {
                    "sequence": 0,
                    "street": "preflop",
                    "player_id": "seat_2",
                    "player_name": "Villain",
                    "action": "post_bb",
                    "amount_bb": 1.0,
                    "total_bet_bb": 1.0,
                    "is_hero": False,
                    "is_all_in": False,
                    "stack_before_bb": 100.0,
                    "stack_after_bb": 99.0,
                    "pot_before_bb": 0.0,
                    "pot_after_bb": 1.0
                },
                {
                    "sequence": 1,
                    "street": "preflop",
                    "player_id": "seat_1",
                    "player_name": "Hero",
                    "action": "raise",
                    "amount_bb": 2.5,
                    "total_bet_bb": 2.5,
                    "is_hero": True,
                    "is_all_in": False,
                    "stack_before_bb": 100.0,
                    "stack_after_bb": 97.5,
                    "pot_before_bb": 1.0,
                    "pot_after_bb": 3.5
                },
                {
                    "sequence": 2,
                    "street": "preflop",
                    "player_id": "seat_2",
                    "player_name": "Villain",
                    "action": "call",
                    "amount_bb": 1.5,
                    "total_bet_bb": 2.5,
                    "is_hero": False,
                    "is_all_in": False,
                    "stack_before_bb": 99.0,
                    "stack_after_bb": 97.5,
                    "pot_before_bb": 3.5,
                    "pot_after_bb": 5.0
                }
            ]
        },
        {
            "name": "flop",
            "board_cards": [
                {"rank": "9", "suit": "h", "notation": "9h"},
                {"rank": "8", "suit": "h", "notation": "8h"},
                {"rank": "7", "suit": "c", "notation": "7c"}
            ],
            "pot_start_bb": 5.0,
            "actions": [
                {
                    "sequence": 3,
                    "street": "flop",
                    "player_id": "seat_2",
                    "player_name": "Villain",
                    "action": "check",
                    "amount_bb": 0.0,
                    "total_bet_bb": 0.0,
                    "is_hero": False,
                    "is_all_in": False,
                    "stack_before_bb": 97.5,
                    "stack_after_bb": 97.5,
                    "pot_before_bb": 5.0,
                    "pot_after_bb": 5.0
                },
                {
                    "sequence": 4,
                    "street": "flop",
                    "player_id": "seat_1",
                    "player_name": "Hero",
                    "action": "bet",
                    "amount_bb": 3.5,
                    "total_bet_bb": 3.5,
                    "is_hero": True,
                    "is_all_in": False,
                    "stack_before_bb": 97.5,
                    "stack_after_bb": 94.0,
                    "pot_before_bb": 5.0,
                    "pot_after_bb": 8.5
                }
            ]
        }
    ],
    "effective_stack_bb": 97.5,
    "final_pot_bb": 8.5,
    "parse_source": "manual"
}

# ── Response schemas ──────────────────────────────────────────────────────────


class NodeKeyResponse(BaseModel):
    """All NodeKey fields plus the derived string representations."""

    string: str
    """Full node key: 'SRP::BTN_vs_BB::100bb::8_PLUS::A_HIGH_DRY::flop::2p'"""

    positional_prefix: str
    """Prefix scoped to spot_type + matchup: 'SRP::BTN_vs_BB'"""

    street_prefix: str
    """Prefix scoped to spot_type + matchup + stack + street: 'SRP::BTN_vs_BB::100bb::flop'"""

    spot_type: str
    position_matchup: str
    stack_depth_bucket: str
    spr_bucket: str
    board_class: str
    street: str
    player_count: int


class SpotDebugResponse(BaseModel):
    """Full solver abstraction output for a single CanonicalHand."""

    spot: SolverSpot
    """SolverSpot with all strategic dimensions — spot_type, matchup, SPR, board_class, etc."""

    board_features: Optional[BoardFeatures]
    """Full board texture profile (20 fields), or null for preflop-only hands."""

    node_key: NodeKeyResponse
    """NodeKey with string representations and prefix helpers."""

    summary: dict[str, str]
    """Human-readable one-liner per dimension — for quick eyeballing."""


# ── Route ─────────────────────────────────────────────────────────────────────


@router.post(
    "/debug/spot",
    response_model=SpotDebugResponse,
    summary="Classify a CanonicalHand into a SolverSpot abstraction",
    description=(
        "Accepts a **CanonicalHand** JSON body and runs the full deterministic "
        "abstraction pipeline:\n\n"
        "```\n"
        "CanonicalHand → SolverSpot → BoardFeatures → NodeKey\n"
        "```\n\n"
        "**Required top-level fields**\n\n"
        "| Field | Type | Notes |\n"
        "|---|---|---|\n"
        "| `hand_id` | string | Any unique ID |\n"
        "| `site` | string | e.g. `GGPoker`, `PokerStars` |\n"
        "| `game_type` | string | e.g. `NLHE`, `PLO` |\n"
        "| `stakes` | object | Must include `big_blind` and `display` |\n"
        "| `players` | array | At least 2; one must have `is_hero: true` |\n"
        "| `hero_id` | string | Must match a player `id` |\n"
        "| `streets` | array | At least `preflop`; include `flop` for board classification |\n"
        "| `effective_stack_bb` | float | Starting effective stack in BB |\n"
        "| `final_pot_bb` | float | Total pot at hand end |\n\n"
        "**No solver outputs** (EV, frequencies, ranges) are produced — "
        "this is the pure abstraction layer."
    ),
    tags=["debug"],
    # NOTE: Do NOT use openapi_extra for request body examples here.
    # FastAPI deep-merges openapi_extra with the auto-generated spec, which
    # CONCATENATES list fields (players, streets, actions) instead of replacing
    # them — producing duplicated players (4 instead of 2) and streets (4 instead
    # of 2) in the serialised OpenAPI JSON.  Body(openapi_examples=...) is the
    # correct mechanism and does not suffer from this bug.
)
async def debug_spot(
    hand: CanonicalHand = Body(
        ...,
        # openapi_examples provides the named dropdown entries in Swagger UI.
        # The first example is also used as the pre-fill when clicking "Try it out".
        openapi_examples={
            "BTN_vs_BB_SRP_AK3_dry": {
                "summary": "BTN vs BB SRP — AKo on Ah Kd 3c (A-high dry)",
                "description": (
                    "Hero opens BTN to 2.5bb, BB calls. Flop Ah Kd 3c. "
                    "Expected: SRP::BTN_vs_BB::100bb::8_PLUS::A_HIGH_DRY::flop::2p"
                ),
                "value": _EXAMPLE_BTN_BB_SRP,
            },
            "BTN_vs_BB_SRP_987_dynamic": {
                "summary": "BTN vs BB SRP — 9h 8h 7c (low dynamic)",
                "description": (
                    "Hero opens BTN to 2.5bb, BB calls. Flop 9h 8h 7c. "
                    "Expected: SRP::BTN_vs_BB::100bb::8_PLUS::LOW_DYNAMIC::flop::2p"
                ),
                "value": _EXAMPLE_BTN_BB_987,
            },
        },
    ),
) -> SpotDebugResponse:
    """
    POST /api/debug/spot

    Run the full CanonicalHand → SpotAbstraction pipeline and return every
    derived dimension as structured JSON.

    **Validation errors (422)** indicate the request body does not match the
    CanonicalHand schema.  Common causes:
    - Missing required fields: `hand_id`, `site`, `game_type`, `stakes`,
      `players`, `hero_id`, `streets`, `effective_stack_bb`, `final_pot_bb`
    - `hero_id` does not match any player `id`
    - `stakes` missing `big_blind` or `display`
    - Player missing `id`, `name`, `seat`, `position`, or `stack_bb`
    - Action missing `sequence`, `street`, `player_id`, `player_name`, or `action`
    - Card missing `rank`, `suit`, or `notation`
    """
    try:
        abstraction = SpotAbstraction.from_canonical_hand(hand)
    except Exception as exc:
        logger.exception("Solver spot classification failed for hand %s", hand.hand_id)
        raise HTTPException(
            status_code=422,
            detail=f"Spot classification failed: {exc}",
        ) from exc

    spot = abstraction.solver_spot
    key = abstraction.node_key

    # ── NodeKey ──────────────────────────────────────────────────────────────
    node_key_response = NodeKeyResponse(
        string=key.to_string(),
        positional_prefix=key.positional_prefix(),
        street_prefix=key.street_prefix(),
        spot_type=key.spot_type,
        position_matchup=key.position_matchup,
        stack_depth_bucket=key.stack_depth_bucket,
        spr_bucket=key.spr_bucket,
        board_class=key.board_class,
        street=key.street,
        player_count=key.player_count,
    )

    # ── Summary ───────────────────────────────────────────────────────────────
    summary = _build_summary(spot, key)

    return SpotDebugResponse(
        spot=spot,
        board_features=spot.board_texture,
        node_key=node_key_response,
        summary=summary,
    )


# ── Internal helpers ──────────────────────────────────────────────────────────


def _build_summary(spot, key: NodeKey) -> dict[str, str]:
    """One-liner per abstraction dimension — for quick human inspection."""
    ip_label = "IP (acts last postflop)" if spot.is_ip else "OOP (acts first postflop)"
    players = (
        f"heads-up ({spot.hero_position} vs {spot.villain_position})"
        if spot.player_count == 2 and spot.villain_position
        else f"{spot.player_count}-way ({spot.position_matchup.replace('MULTIWAY_', '')})"
    )

    board_desc = "no board (preflop only)"
    if spot.board_texture is not None:
        bt = spot.board_texture
        suit_label = (
            "monotone" if bt.monotone
            else "two-tone" if bt.two_tone
            else "rainbow"
        )
        dyn_label = "dynamic" if bt.dynamic else "static"
        board_desc = (
            f"{key.board_class} — {suit_label}, {bt.connectedness_label}, {dyn_label}"
        )

    spr_label = {
        "0_2": "commit territory (SPR < 2)",
        "2_4": "low SPR (2–4)",
        "4_8": "medium SPR (4–8)",
        "8_PLUS": "deep (SPR 8+)",
    }.get(key.spr_bucket, key.spr_bucket)

    return {
        "pot_type": key.spot_type,
        "position": f"{spot.hero_position} — {ip_label}",
        "matchup": players,
        "stack_depth": f"{spot.effective_stack_bb:.1f} BB effective → {key.stack_depth_bucket} bucket",
        "spr": f"{spot.spr:.2f} → {spr_label}",
        "board": board_desc,
        "street": key.street,
        "node_key": key.to_string(),
    }
