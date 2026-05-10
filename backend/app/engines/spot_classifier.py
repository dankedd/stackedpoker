from __future__ import annotations
from app.models.schemas import ParsedHand, SpotClassification, HandAction


_POSITION_ORDER = ["UTG", "UTG+1", "UTG+2", "UTG+3", "HJ", "CO", "BTN", "SB", "BB"]


def classify_spot(hand: ParsedHand) -> SpotClassification:
    pot_type = _detect_pot_type(hand.actions)
    stack_depth = _classify_stack_depth(hand.effective_stack_bb)
    ip_player, oop_player = _determine_position_order(hand)
    hero_is_ip = hand.hero_name == ip_player
    hero_is_pfr = _detect_pfr(hand.actions, hand.hero_name)
    position_matchup = _build_position_matchup(hand)
    spot_id = f"{position_matchup}_{pot_type}_{stack_depth}"

    return SpotClassification(
        pot_type=pot_type,
        position_matchup=position_matchup,
        stack_depth=stack_depth,
        spot_id=spot_id,
        ip_player=ip_player,
        oop_player=oop_player,
        hero_is_ip=hero_is_ip,
        hero_is_pfr=hero_is_pfr,
    )


# ── Helpers ────────────────────────────────────────────────────────────────

def _detect_pot_type(actions: list[HandAction]) -> str:
    preflop = [a for a in actions if a.street == "preflop"]
    raises = [a for a in preflop if a.action == "raise"]
    if len(raises) >= 3:
        return "4bet"
    if len(raises) == 2:
        return "3bet"
    return "SRP"


def _classify_stack_depth(eff_bb: float) -> str:
    if eff_bb >= 100:
        return "deep"
    if eff_bb >= 50:
        return "medium"
    return "short"


def _determine_position_order(hand: ParsedHand) -> tuple[str, str]:
    """
    Returns (ip_player, oop_player) for the flop.
    BTN/CO is IP vs blinds. SB is OOP vs everyone.
    """
    positions = {p.name: p.position for p in hand.players}

    late_positions = {"BTN", "CO", "HJ"}
    early_positions = {"UTG", "UTG+1", "UTG+2", "UTG+3"}
    blind_positions = {"SB", "BB"}

    if not hand.players:
        return hand.hero_name, "Villain"

    # Find active players (those who didn't fold preflop)
    folded = {
        a.player
        for a in hand.actions
        if a.street == "preflop" and a.action == "fold"
    }
    active = [p for p in hand.players if p.name not in folded]
    if len(active) < 2:
        active = hand.players[:2]

    # Sort by position: late positions are IP vs blinds
    def pos_rank(p):
        pos = positions.get(p.name, "BB")
        return _POSITION_ORDER.index(pos) if pos in _POSITION_ORDER else 99

    sorted_active = sorted(active, key=pos_rank)
    oop = sorted_active[0] if sorted_active else active[0]
    ip = sorted_active[-1] if sorted_active else active[-1]

    return ip.name, oop.name


def _detect_pfr(actions: list[HandAction], hero_name: str) -> bool:
    """Returns True if hero was the preflop raiser."""
    preflop_raises = [
        a for a in actions if a.street == "preflop" and a.action == "raise"
    ]
    if not preflop_raises:
        return False
    last_raise = preflop_raises[-1]
    return last_raise.player == hero_name


def _build_position_matchup(hand: ParsedHand) -> str:
    positions = {p.name: p.position for p in hand.players}
    hero_pos = hand.hero_position

    folded_preflop = {
        a.player
        for a in hand.actions
        if a.street == "preflop" and a.action == "fold"
    }
    active = [p for p in hand.players if p.name not in folded_preflop]

    if len(active) == 2:
        opponent = next((p for p in active if p.name != hand.hero_name), None)
        if opponent:
            villain_pos = opponent.position
            return f"{hero_pos}_vs_{villain_pos}"

    return f"{hero_pos}_multiway"
