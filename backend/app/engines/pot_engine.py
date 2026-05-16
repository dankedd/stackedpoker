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

Production features (v2):
  - SidePot: models main pot / side pots for multiway all-in hands
  - compute_side_pots(): public API for callers that need pot breakdown
  - PotState: extended with is_all_in, all_in_players, main_pot, side_pots,
    uncalled_bet (defaults ensure full backward compatibility)
  - compute_pot_states(): tracks hand_contributions + folded_players for
    correct all-in detection and uncalled bet retroactive patching
"""
from __future__ import annotations

from dataclasses import dataclass, field
from app.models.schemas import HandAction, PlayerInfo


# ─────────────────────────────────────────────────────────────────────────────
# Data structures
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class SidePot:
    """One pot segment created by all-in action in a multiway hand."""
    amount: float                  # chips in this pot segment
    eligible_players: list[str]    # players who can win this segment (not folded)


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
    # ── Extended fields (all have defaults → fully backward-compatible) ───────
    is_all_in: bool = False                         # this action sent the player all-in
    all_in_players: list[str] = field(default_factory=list)  # cumulative all-in roster
    main_pot: float = 0.0                           # chips all active players compete for
    side_pots: list[SidePot] = field(default_factory=list)   # additional pots from all-ins
    uncalled_bet: float = 0.0                       # chips returned to last aggressor


# ─────────────────────────────────────────────────────────────────────────────
# Side-pot helpers
# ─────────────────────────────────────────────────────────────────────────────

def _pot_tiers(
    contributions: dict[str, float],
    folded_players: set[str],
) -> tuple[float, list[SidePot]]:
    """
    Pure tier computation — NO uncalled-bet detection.

    Used mid-hand where the last aggressor may still be awaiting a response,
    so we must not prematurely strip their contribution as "uncalled."

    Returns (main_pot, side_pots).  main_pot is the pot that every
    non-folded contributor is eligible to win; side_pots are the extra
    segments that only the deeper-stacked players compete for.
    """
    contributors = {p: a for p, a in contributions.items() if a > 0.001}
    if not contributors:
        return 0.0, []

    unique_levels = sorted(set(contributors.values()))
    pots: list[SidePot] = []
    prev_level = 0.0

    for level in unique_levels:
        # Everyone who put in at least `level` chips contributes to this band
        in_band = [p for p, a in contributors.items() if a >= level - 0.001]
        can_win = [p for p in in_band if p not in folded_players]
        band_chips = round((level - prev_level) * len(in_band), 2)
        if band_chips > 0.001:
            pots.append(SidePot(amount=band_chips, eligible_players=can_win))
        prev_level = level

    if not pots:
        return 0.0, []

    return pots[0].amount, pots[1:]


def compute_side_pots(
    hand_contributions: dict[str, float],
    folded_players: set[str],
) -> tuple[float, list[SidePot], float]:
    """
    Compute main pot, side pots, and uncalled bet from cumulative per-player
    contributions over the entire hand.

    Call this at the END of a hand (or street) when all action is resolved.
    Mid-hand use will misclassify the last aggressor's uncalled raise as an
    uncalled bet — use _pot_tiers() for per-action snapshots instead.

    Args:
        hand_contributions: player_name → total chips committed (never resets)
        folded_players:     set of player names who folded

    Returns:
        (main_pot, side_pots, uncalled_bet)

    Uncalled-bet rule:
        If exactly one player's cumulative contribution exceeds all others,
        the excess is an "uncalled bet" — returned to that player, not in any pot.
    """
    contributors = {p: a for p, a in hand_contributions.items() if a > 0.001}
    if not contributors:
        return 0.0, [], 0.0

    sorted_amts = sorted(contributors.values(), reverse=True)
    uncalled_bet = 0.0

    if len(sorted_amts) == 1:
        # Only one player ever contributed — whole amount is uncalled
        solo = list(contributors.keys())[0]
        uncalled_bet = round(sorted_amts[0], 2)
        contributors[solo] = 0.0

    elif sorted_amts[0] > sorted_amts[1] + 0.001:
        max_amt = sorted_amts[0]
        second_max = sorted_amts[1]
        at_max = [p for p, a in contributors.items() if abs(a - max_amt) < 0.001]
        if len(at_max) == 1:
            uncalled_bet = round(max_amt - second_max, 2)
            contributors[at_max[0]] = second_max  # trim to matched level

    # Recompute tiers on trimmed contributions
    contributors = {p: a for p, a in contributors.items() if a > 0.001}
    main_pot, side_pots = _pot_tiers(contributors, folded_players)
    return round(main_pot, 2), side_pots, round(uncalled_bet, 2)


# ─────────────────────────────────────────────────────────────────────────────
# Core engine
# ─────────────────────────────────────────────────────────────────────────────

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

    # ── Seed pot with blind posts ─────────────────────────────────────────────
    pot = antes_bb
    hand_contributions: dict[str, float] = {p.name: 0.0 for p in players}

    if sb_player and sb_player in stacks:
        actual_sb = min(sb_bb, stacks[sb_player])
        stacks[sb_player] -= actual_sb
        pot += actual_sb
        hand_contributions[sb_player] += actual_sb

    if bb_player and bb_player in stacks:
        actual_bb = min(1.0, stacks[bb_player])
        stacks[bb_player] -= actual_bb
        pot += actual_bb
        hand_contributions[bb_player] += actual_bb

    # Track how much each player has committed THIS street for raise "to" math
    street_invested: dict[str, float] = {p.name: 0.0 for p in players}
    if sb_player:
        street_invested[sb_player] = min(sb_bb, stacks.get(sb_player, 0.0) + sb_bb)
    if bb_player:
        street_invested[bb_player] = min(1.0, stacks.get(bb_player, 0.0) + 1.0)

    current_street = "preflop"
    states: list[PotState] = []
    folded_players: set[str] = set()
    all_in_players: list[str] = []  # cumulative roster, append-only

    for i, action in enumerate(actions):
        # ── Street transition ─────────────────────────────────────────────────
        if action.street != current_street:
            current_street = action.street
            street_invested = {p.name: 0.0 for p in players}

        pot_before = round(pot, 2)
        player = action.player
        chips_in = 0.0

        # ── Action accounting ─────────────────────────────────────────────────
        if action.action == "fold":
            folded_players.add(player)

        elif action.size_bb is not None:
            if action.action == "raise":
                current_in = street_invested.get(player, 0.0)
                chips_in = max(0.0, action.size_bb - current_in)
                chips_in = min(chips_in, stacks.get(player, chips_in))
                street_invested[player] = current_in + chips_in
                pot += chips_in
                if player in stacks:
                    stacks[player] -= chips_in

            elif action.action in ("call", "bet"):
                chips_in = min(action.size_bb, stacks.get(player, action.size_bb))
                street_invested[player] = street_invested.get(player, 0.0) + chips_in
                pot += chips_in
                if player in stacks:
                    stacks[player] -= chips_in

        # ── Cumulative hand contributions (never resets across streets) ───────
        hand_contributions[player] = hand_contributions.get(player, 0.0) + chips_in

        # ── All-in detection: stack went to ~0 this action ───────────────────
        is_all_in_action = (
            chips_in > 0.001
            and player in stacks
            and stacks[player] < 0.001
            and player not in all_in_players
        )
        if is_all_in_action:
            all_in_players.append(player)

        # ── Side pot computation (no uncalled-bet stripping mid-hand) ─────────
        main_pot_val, side_pots_val = _pot_tiers(dict(hand_contributions), folded_players)

        states.append(PotState(
            action_index=i,
            street=action.street,
            player=player,
            action_type=action.action,
            chips_in=round(chips_in, 2),
            pot_before=pot_before,
            pot_after=round(pot, 2),
            player_stacks=dict(stacks),
            is_all_in=is_all_in_action,
            all_in_players=list(all_in_players),
            main_pot=round(main_pot_val, 2),
            side_pots=side_pots_val,
            uncalled_bet=0.0,
        ))

    # ── Retroactive uncalled-bet detection on final state ────────────────────
    # Now that all actions are resolved, the last aggressor's unmatched chips
    # (if any) are definitively an uncalled bet.
    if states:
        _, _, uncalled = compute_side_pots(dict(hand_contributions), folded_players)
        if uncalled > 0.001:
            states[-1].uncalled_bet = round(uncalled, 2)

    return states


def find_blind_players(
    players: list[PlayerInfo],
    actions: list[HandAction],  # noqa: ARG001 — reserved for fallback heuristic
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
