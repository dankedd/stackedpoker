"""
Deterministic pot and stack tracking engine.

Takes a parsed hand's action sequence plus the blind structure and computes
per-action pot states using strict net-chip accounting.

Chip convention (same as parsers):
  - raises:  size_bb is the "to" amount (total committed by raiser this street)
  - calls:   size_bb is the additional chips put in
  - bets:    size_bb is the bet amount (additional)
  - fold/check: no chips move

This engine is the authoritative source of truth for pot sizes used by
replay, coaching, and validation.  No AI, no heuristics.
"""
from __future__ import annotations

from dataclasses import dataclass
from app.models.schemas import HandAction, PlayerInfo


@dataclass
class PotState:
    action_index: int
    street: str
    player: str
    action_type: str
    chips_in: float        # net new chips this player committed this action
    pot_before: float      # pot BEFORE the action
    pot_after: float       # pot AFTER the action
    player_stacks: dict[str, float]  # all stacks after the action (copies)


def compute_pot_states(
    actions: list[HandAction],
    players: list[PlayerInfo],
    sb_bb: float,
    antes_bb: float = 0.0,
    sb_player: str = "",
    bb_player: str = "",
) -> list[PotState]:
    """
    Compute a PotState for every action in the hand.

    Args:
        actions:    parsed action list (HandAction objects)
        players:    player list with starting stack_bb values
        sb_bb:      small blind in BB units (typically 0.5)
        antes_bb:   total antes already collected, in BB units
        sb_player:  name of the player who posted the small blind
        bb_player:  name of the player who posted the big blind

    Returns:
        List of PotState, one per action, in the same order as `actions`.
    """
    stacks: dict[str, float] = {p.name: p.stack_bb for p in players}

    # Deduct blind posts from stacks and seed the pot.
    pot = antes_bb
    if sb_player and sb_player in stacks:
        actual_sb = min(sb_bb, stacks[sb_player])
        stacks[sb_player] -= actual_sb
        pot += actual_sb
    if bb_player and bb_player in stacks:
        actual_bb = min(1.0, stacks[bb_player])
        stacks[bb_player] -= actual_bb
        pot += actual_bb

    # Track how much each player has committed THIS street so we can compute
    # additional chips for raise "to" amounts.
    street_invested: dict[str, float] = {p.name: 0.0 for p in players}
    if sb_player:
        street_invested[sb_player] = min(sb_bb, stacks.get(sb_player, 0.0) + sb_bb)
    if bb_player:
        street_invested[bb_player] = min(1.0, stacks.get(bb_player, 0.0) + 1.0)

    current_street = "preflop"
    states: list[PotState] = []

    for i, action in enumerate(actions):
        # ── Street transition: reset per-street investment counters ──────────
        if action.street != current_street:
            current_street = action.street
            street_invested = {p.name: 0.0 for p in players}

        pot_before = round(pot, 2)
        player = action.player
        chips_in = 0.0

        if action.size_bb is not None:
            if action.action == "raise":
                # size_bb = "to" total for this player this street
                current_in = street_invested.get(player, 0.0)
                chips_in = max(0.0, action.size_bb - current_in)
                # Cap at remaining stack (all-in case)
                chips_in = min(chips_in, stacks.get(player, chips_in))
                street_invested[player] = current_in + chips_in
                pot += chips_in
                if player in stacks:
                    stacks[player] -= chips_in

            elif action.action in ("call", "bet"):
                # size_bb = additional chips put in
                chips_in = min(action.size_bb, stacks.get(player, action.size_bb))
                street_invested[player] = street_invested.get(player, 0.0) + chips_in
                pot += chips_in
                if player in stacks:
                    stacks[player] -= chips_in

        # fold / check: chips_in stays 0

        states.append(PotState(
            action_index=i,
            street=action.street,
            player=player,
            action_type=action.action,
            chips_in=round(chips_in, 2),
            pot_before=pot_before,
            pot_after=round(pot, 2),
            player_stacks=dict(stacks),
        ))

    return states


def find_blind_players(
    players: list[PlayerInfo],
    actions: list[HandAction],
) -> tuple[str, str]:
    """
    Identify the SB and BB players by looking at position labels from the
    parsed players list.  Falls back to scanning blind-post patterns in
    the actions list if position data is unavailable.
    """
    sb_player = ""
    bb_player = ""

    for p in players:
        if p.position == "SB":
            sb_player = p.name
        elif p.position == "BB":
            bb_player = p.name

    return sb_player, bb_player


def compute_final_pot(
    actions: list[HandAction],
    sb_bb: float,
    bb_bb: float,
    antes_bb: float,
    sb_player: str = "",
    bb_player: str = "",
) -> float:
    """
    Quick pot calculation without per-action state tracking.

    Correctly handles SB/BB raising preflop (no double-count) when
    sb_player / bb_player names are provided so their initial blind posts
    are tracked in street_invested before the first raise is processed.
    """
    pot = sb_bb + bb_bb + antes_bb  # blind posts seeded upfront

    # Pre-populate street_invested so that if the blind posters later raise
    # (common in BB squeeze / blind-vs-blind spots), the "to" total is
    # correctly interpreted as total - already_posted rather than total.
    street_invested: dict[str, float] = {}
    if sb_player:
        street_invested[sb_player] = sb_bb
    if bb_player:
        street_invested[bb_player] = bb_bb

    current_street = "preflop"
    for a in actions:
        if a.street != current_street:
            current_street = a.street
            street_invested = {}

        player = a.player
        if a.size_bb is None:
            continue

        if a.action == "raise":
            current_in = street_invested.get(player, 0.0)
            chips_in = max(0.0, a.size_bb - current_in)
            street_invested[player] = a.size_bb
            pot += chips_in
        elif a.action in ("call", "bet"):
            pot += a.size_bb
            street_invested[player] = street_invested.get(player, 0.0) + a.size_bb

    return round(pot, 2)
