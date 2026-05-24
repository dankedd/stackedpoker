"""
Normalization Engine — converts ParsedHand into CanonicalHand.

Pipeline position: AFTER parsing, BEFORE validation.

Responsibilities:
- Normalize position strings to canonical form (BTN/SB/BB/UTG/HJ/CO/LJ)
- Normalize card strings to rank-uppercase + suit-lowercase
- Restructure flat action list into per-street CanonicalStreet objects
- Compute per-action stack and pot tracking
- Assign player IDs (deterministic: "seat_N")
- Compute effective_stack_bb and final_pot_bb
- Carry provenance (raw_text, parse_source, site)
"""
from __future__ import annotations

import logging
from app.models.schemas import ParsedHand, HandAction, PlayerInfo
from app.models.canonical import (
    CanonicalHand, CanonicalPlayer, CanonicalCard, CanonicalAction,
    CanonicalStreet, CanonicalStakes, Street, ActionType, ParseSource,
    VALID_RANKS, VALID_SUITS,
)

_log = logging.getLogger(__name__)

# Position alias map → canonical string
_POS_ALIASES: dict[str, str] = {
    # Button
    "btn": "BTN", "button": "BTN", "dealer": "BTN", "d": "BTN",
    # Small blind
    "sb": "SB", "small blind": "SB", "small_blind": "SB",
    # Big blind
    "bb": "BB", "big blind": "BB", "big_blind": "BB",
    # Under-the-gun
    "utg": "UTG", "under the gun": "UTG", "ep": "UTG",
    "utg+1": "UTG+1", "utg1": "UTG+1",
    "utg+2": "UTG+2", "utg2": "UTG+2",
    # Middle / Late
    "lj": "LJ", "lowjack": "LJ", "low jack": "LJ",
    "hj": "HJ", "hijack": "HJ", "hi jack": "HJ",
    "co": "CO", "cutoff": "CO", "cut off": "CO",
    # Generic positional aliases used by some clients
    "mp": "HJ", "mp1": "HJ", "mp2": "CO", "ep1": "UTG", "ep2": "UTG+1",
}

# Action alias map → canonical ActionType
_ACTION_ALIASES: dict[str, ActionType] = {
    "fold": ActionType.FOLD,   "folds": ActionType.FOLD,
    "check": ActionType.CHECK, "checks": ActionType.CHECK,
    "call": ActionType.CALL,   "calls": ActionType.CALL,
    "bet": ActionType.BET,     "bets": ActionType.BET,
    "raise": ActionType.RAISE, "raises": ActionType.RAISE,
    "post_sb": ActionType.POST_SB,
    "post_bb": ActionType.POST_BB,
    "post_ante": ActionType.POST_ANTE,
    "post_straddle": ActionType.POST_STRADDLE,
}


def normalize_position(raw: str) -> str:
    """Normalize any position variant to its canonical string."""
    key = raw.strip().lower()
    return _POS_ALIASES.get(key, raw.upper())


def normalize_card(raw: str) -> CanonicalCard | None:
    """Normalize a card string to CanonicalCard, returns None on invalid input."""
    if not raw or len(raw) != 2:
        return None
    rank = raw[0].upper()
    suit = raw[1].lower()
    if rank not in VALID_RANKS or suit not in VALID_SUITS:
        return None
    return CanonicalCard(rank=rank, suit=suit, notation=rank + suit)


def normalize_action_type(raw: str) -> ActionType:
    """Normalize action string to ActionType. Defaults to FOLD on unknown."""
    key = raw.strip().lower()
    return _ACTION_ALIASES.get(key, ActionType.FOLD)


def normalize_hand(parsed: ParsedHand, raw_text: str | None = None) -> CanonicalHand:
    """Convert a ParsedHand (from any parser) into a fully normalized CanonicalHand.

    This is the single entry point for the normalization layer.
    """
    # ── 1. Build player map ───────────────────────────────────────────────────
    players: list[CanonicalPlayer] = []
    player_by_name: dict[str, CanonicalPlayer] = {}
    player_id_by_name: dict[str, str] = {}

    for p in parsed.players:
        pid = f"seat_{p.seat}"
        position = normalize_position(p.position)
        cp = CanonicalPlayer(
            id=pid,
            name=p.name,
            seat=p.seat,
            position=position,
            stack_bb=p.stack_bb,
            hole_cards=[],
            is_hero=(p.name == parsed.hero_name),
            is_active=True,
        )
        players.append(cp)
        player_by_name[p.name] = cp
        player_id_by_name[p.name] = pid

    # ── 1b. Infer players from actions when player list is empty ─────────────
    # This handles truncated inputs (OCR, partial pastes) where the seat
    # definitions are missing but the action history is intact.
    if not players and parsed.actions:
        _log.info(
            "No players found in parsed hand — inferring from %d actions",
            len(parsed.actions),
        )
        players, player_by_name, player_id_by_name = _infer_players_from_actions(
            parsed.actions,
            parsed.hero_name,
            parsed.hero_position,
            parsed.effective_stack_bb,
        )

    # ── 2. Assign hero cards ──────────────────────────────────────────────────
    hero_player = player_by_name.get(parsed.hero_name)
    hero_id = player_id_by_name.get(parsed.hero_name)
    if hero_id is None and players:
        # hero_name didn't match any player.  If players were inferred from
        # actions, the first is_hero player is the correct match.  If players
        # came from the parser (seat definitions), the mismatch is real and
        # the validator should flag it — so we keep hero_id pointing to a
        # non-existent ID only when inference was NOT used.
        hero_candidate = next((p for p in players if p.is_hero), None)
        if hero_candidate is not None:
            hero_id = hero_candidate.id
            hero_player = hero_candidate
            _log.debug("Hero name %r unmatched — mapped to is_hero player %s", parsed.hero_name, hero_id)
        else:
            # No player marked is_hero.  Keep the stale ID so the validator
            # can report HERO_NOT_IN_PLAYERS.
            hero_id = f"seat_0"
    elif hero_id is None:
        hero_id = "seat_0"

    if hero_player and parsed.hero_cards:
        hero_player.hole_cards = [
            c for c in (normalize_card(raw) for raw in parsed.hero_cards)
            if c is not None
        ]

    # ── 3. Build per-street structures with pot/stack tracking ────────────────
    streets = _build_streets(parsed, player_id_by_name, players)

    # ── 4. Compute effective stack and final pot ───────────────────────────────
    effective_stack = parsed.effective_stack_bb
    final_pot = _compute_final_pot(streets)

    # ── 5. Build stakes ───────────────────────────────────────────────────────
    ante_bb = _infer_ante(parsed)
    currency = _infer_currency(parsed.stakes)
    display = parsed.stakes
    if not display:
        display = f"{parsed.big_blind}/{parsed.big_blind * 2}"

    stakes = CanonicalStakes(
        small_blind_bb=0.5,
        big_blind=parsed.big_blind,
        ante_bb=ante_bb,
        straddle_bb=0.0,
        currency=currency,
        display=display,
    )

    # ── 6. Determine game type / tournament flag ───────────────────────────────
    game_type = parsed.game_type or "NLHE"
    is_tournament = (
        parsed.game_type in ("MTT-NLHE", "MTT-PLO", "SNG-NLHE", "SPIN")
        or parsed.site == "Unknown"
        and parsed.big_blind >= 10  # heuristic: chip-denominated
    )

    # ── 7. Assemble ───────────────────────────────────────────────────────────
    return CanonicalHand(
        schema_version="1.0",
        hand_id=parsed.hand_id,
        site=parsed.site,
        game_type=game_type,
        is_tournament=is_tournament,
        stakes=stakes,
        table_name="",
        table_max_seats=parsed.table_max_seats,
        players=players,
        hero_id=hero_id,
        streets=streets,
        showdown=None,
        effective_stack_bb=effective_stack,
        final_pot_bb=final_pot,
        parse_source=ParseSource.TEXT_HISTORY,
        raw_text=raw_text,
    )


# ── Player inference from actions ─────────────────────────────────────────────

# Names that imply positions (case-insensitive)
_NAME_TO_POSITION: dict[str, str] = {
    "hero": "",       # hero position comes from parsed.hero_position
    "villain": "",    # assigned later
    "btn": "BTN", "button": "BTN",
    "sb": "SB", "small blind": "SB",
    "bb": "BB", "big blind": "BB",
    "utg": "UTG", "utg+1": "UTG+1", "utg+2": "UTG+2",
    "lj": "LJ", "hj": "HJ", "co": "CO",
    "mp": "HJ", "ep": "UTG",
}

# For heads-up defaults when no positions can be inferred
_HU_POSITIONS = ["BTN", "BB"]
_DEFAULT_POSITIONS = ["BTN", "SB", "BB", "UTG", "HJ", "CO", "LJ", "UTG+1", "UTG+2"]


def _infer_position_from_name(name: str) -> str:
    """Try to derive a canonical position from a player name/alias."""
    key = name.strip().lower()
    if key in _NAME_TO_POSITION:
        return _NAME_TO_POSITION[key]
    # Also check the existing position alias map
    normalized = _POS_ALIASES.get(key)
    if normalized:
        return normalized
    return ""


def _infer_players_from_actions(
    actions: list[HandAction],
    hero_name: str,
    hero_position: str,
    effective_stack_bb: float,
) -> tuple[list[CanonicalPlayer], dict[str, CanonicalPlayer], dict[str, str]]:
    """
    Reconstruct a player list from parsed actions when seat definitions are missing.

    Extracts unique player names from actions, assigns seats and positions,
    and marks the hero. Uses name-based heuristics and preflop action order
    to infer positions.

    Returns:
        (players, player_by_name, player_id_by_name)
    """
    # Collect unique player names in order of first appearance
    seen: set[str] = set()
    ordered_names: list[str] = []
    for a in actions:
        if a.player not in seen:
            seen.add(a.player)
            ordered_names.append(a.player)

    if not ordered_names:
        return [], {}, {}

    # Default stack for inferred players
    default_stack = effective_stack_bb if effective_stack_bb > 0 else 100.0

    # Try to assign positions from names
    name_positions: dict[str, str] = {}
    for name in ordered_names:
        pos = _infer_position_from_name(name)
        if pos:
            name_positions[name] = pos

    # Assign hero position
    if hero_name and hero_name in seen:
        hero_pos = normalize_position(hero_position) if hero_position else ""
        if hero_pos and hero_pos != "?":
            name_positions[hero_name] = hero_pos

    # Fill remaining positions from defaults
    used_positions = set(name_positions.values()) - {""}
    n_players = len(ordered_names)

    if n_players == 2:
        available = [p for p in _HU_POSITIONS if p not in used_positions]
    else:
        available = [p for p in _DEFAULT_POSITIONS if p not in used_positions]

    avail_idx = 0
    for name in ordered_names:
        if name not in name_positions or name_positions[name] == "":
            if avail_idx < len(available):
                name_positions[name] = available[avail_idx]
                avail_idx += 1
            else:
                name_positions[name] = "?"

    # Build CanonicalPlayer list
    players: list[CanonicalPlayer] = []
    player_by_name: dict[str, CanonicalPlayer] = {}
    player_id_by_name: dict[str, str] = {}

    for seat_idx, name in enumerate(ordered_names, start=1):
        pid = f"seat_{seat_idx}"
        position = name_positions.get(name, "?")
        is_hero = (name == hero_name) if hero_name else (seat_idx == 1)

        cp = CanonicalPlayer(
            id=pid,
            name=name,
            seat=seat_idx,
            position=position,
            stack_bb=default_stack,
            hole_cards=[],
            is_hero=is_hero,
            is_active=True,
        )
        players.append(cp)
        player_by_name[name] = cp
        player_id_by_name[name] = pid

    _log.info(
        "Inferred %d player(s) from actions: %s",
        len(players),
        [(p.name, p.position, p.id) for p in players],
    )

    return players, player_by_name, player_id_by_name


# ── Internal helpers ───────────────────────────────────────────────────────────

def _build_streets(
    parsed: ParsedHand,
    player_id_by_name: dict[str, str],
    players: list[CanonicalPlayer],
) -> list[CanonicalStreet]:
    """Build CanonicalStreet list with full per-action pot/stack tracking."""
    # Starting stacks
    stacks: dict[str, float] = {p.name: p.stack_bb for p in parsed.players}
    folded: set[str] = set()

    # Seed pot with blinds (standard 0.5bb SB + 1.0bb BB)
    pot = 0.0
    sb_name = next((p.name for p in parsed.players if p.position in ("SB", "sb")), "")
    bb_name = next((p.name for p in parsed.players if p.position in ("BB", "bb")), "")
    if sb_name and sb_name in stacks:
        sb_amount = min(0.5, stacks[sb_name])
        stacks[sb_name] -= sb_amount
        pot += sb_amount
    if bb_name and bb_name in stacks:
        bb_amount = min(1.0, stacks[bb_name])
        stacks[bb_name] -= bb_amount
        pot += bb_amount

    # Group actions by street
    street_actions: dict[str, list[HandAction]] = {
        "preflop": [], "flop": [], "turn": [], "river": [],
    }
    for a in parsed.actions:
        street_actions[a.street].append(a)

    # Board cards per street
    board_by_street: dict[str, list[CanonicalCard]] = {
        "preflop": [],
        "flop": [c for c in (normalize_card(x) for x in parsed.board.flop) if c],
        "turn": [c for c in (normalize_card(x) for x in parsed.board.turn) if c],
        "river": [c for c in (normalize_card(x) for x in parsed.board.river) if c],
    }

    canonical_streets: list[CanonicalStreet] = []
    global_seq = 0

    for street_name in ("preflop", "flop", "turn", "river"):
        raw_actions = street_actions[street_name]
        board_cards = board_by_street[street_name]
        pot_start = pot
        # Per-street bet tracking for raise sizing
        street_bets: dict[str, float] = {}

        c_actions: list[CanonicalAction] = []
        for a in raw_actions:
            pid = player_id_by_name.get(a.player, f"unknown_{a.player}")
            action_type = normalize_action_type(a.action)
            stack_before = stacks.get(a.player, 0.0)
            pot_before = pot

            # Compute amount committed this action
            amount_bb = 0.0
            total_bet = 0.0
            is_all_in = getattr(a, "is_all_in", False)

            if action_type in (ActionType.BET,):
                raw = a.size_bb or 0.0
                amount_bb = min(raw, stack_before)
                total_bet = amount_bb
                if amount_bb >= stack_before - 0.001:
                    is_all_in = True

            elif action_type == ActionType.RAISE:
                # size_bb is "to" total for raises
                raw_total = a.size_bb or 0.0
                already_in = street_bets.get(a.player, 0.0)
                additional = raw_total - already_in
                if additional <= 0:
                    additional = raw_total  # fallback: treat as additional
                amount_bb = min(additional, stack_before)
                total_bet = raw_total
                if amount_bb >= stack_before - 0.001:
                    is_all_in = True

            elif action_type == ActionType.CALL:
                raw = a.size_bb or 0.0
                amount_bb = min(raw, stack_before)
                if amount_bb >= stack_before - 0.001:
                    is_all_in = True

            elif action_type == ActionType.FOLD:
                folded.add(a.player)

            # Apply to stacks and pot
            stacks[a.player] = max(0.0, stack_before - amount_bb)
            pot += amount_bb
            street_bets[a.player] = street_bets.get(a.player, 0.0) + amount_bb

            c_actions.append(CanonicalAction(
                sequence=global_seq,
                street=Street(street_name),
                player_id=pid,
                player_name=a.player,
                action=action_type,
                amount_bb=round(amount_bb, 4),
                total_bet_bb=round(total_bet, 4),
                is_hero=a.is_hero,
                is_all_in=is_all_in,
                stack_before_bb=round(stack_before, 4),
                stack_after_bb=round(stacks[a.player], 4),
                pot_before_bb=round(pot_before, 4),
                pot_after_bb=round(pot, 4),
            ))
            global_seq += 1

        # Only include streets that have actions or board cards (except preflop which always exists)
        if street_name == "preflop" or raw_actions or board_cards:
            canonical_streets.append(CanonicalStreet(
                name=Street(street_name),
                board_cards=board_cards,
                pot_start_bb=round(pot_start, 4),
                actions=c_actions,
            ))

    return canonical_streets


def _compute_final_pot(streets: list[CanonicalStreet]) -> float:
    """Return the final pot size from the last action across all streets."""
    for street in reversed(streets):
        if street.actions:
            return round(street.actions[-1].pot_after_bb, 4)
    return 0.0


def _infer_ante(parsed: ParsedHand) -> float:
    """Infer ante in BB units from parsed hand diagnostics if available."""
    if parsed.parse_diagnostics:
        # future: parse_diagnostics could carry ante info
        pass
    return 0.0


def _infer_currency(stakes: str) -> str:
    """Infer currency from stakes display string."""
    if "$" in stakes:
        return "USD"
    if "€" in stakes:
        return "EUR"
    if "£" in stakes:
        return "GBP"
    # Tournament / chip-denominated
    if stakes.upper().startswith("T") or any(c.isdigit() for c in stakes[:3]):
        return "chips"
    return ""
