"""
Solver-inspired heuristic rules engine.

Rules are organized by spot type + board texture and return
HeuristicFinding objects with severity, explanation and recommendations.
"""
from __future__ import annotations
from dataclasses import dataclass
from app.models.schemas import (
    ParsedHand, SpotClassification, BoardTexture, HeuristicFinding, HandAction
)


def run_heuristics(
    hand: ParsedHand,
    spot: SpotClassification,
    texture: BoardTexture,
) -> list[HeuristicFinding]:
    findings: list[HeuristicFinding] = []

    flop_actions = [a for a in hand.actions if a.street == "flop" and a.is_hero]
    turn_actions = [a for a in hand.actions if a.street == "turn" and a.is_hero]
    river_actions = [a for a in hand.actions if a.street == "river" and a.is_hero]

    # ── Flop ──────────────────────────────────────────────────────────────
    if hand.board.flop:
        findings += _evaluate_flop(flop_actions, spot, texture, hand)

    # ── Turn ──────────────────────────────────────────────────────────────
    if hand.board.turn and flop_actions:
        findings += _evaluate_turn(turn_actions, flop_actions, spot, texture)

    # ── River ─────────────────────────────────────────────────────────────
    if hand.board.river and river_actions:
        findings += _evaluate_river(river_actions, spot, texture, hand)

    # ── Preflop ───────────────────────────────────────────────────────────
    preflop_actions = [a for a in hand.actions if a.street == "preflop" and a.is_hero]
    findings += _evaluate_preflop(preflop_actions, spot, hand)

    return findings


# ── Flop evaluator ─────────────────────────────────────────────────────────

def _evaluate_flop(
    hero_actions: list[HandAction],
    spot: SpotClassification,
    texture: BoardTexture,
    hand: ParsedHand,
) -> list[HeuristicFinding]:
    findings = []

    if not hero_actions:
        # Hero checked or is not acting on the flop yet
        return findings

    first_action = hero_actions[0]
    bucket = texture.bucket
    is_pfr = spot.hero_is_pfr
    is_ip = spot.hero_is_ip

    if first_action.action == "bet" and first_action.size_bb:
        pot = _estimate_pot_at_street(hand, "flop")
        bet_fraction = first_action.size_bb / pot if pot > 0 else 0

        # C-bet sizing heuristics
        if is_pfr and is_ip:
            findings += _evaluate_ip_pfr_cbet(bet_fraction, bucket, texture)

        elif is_pfr and not is_ip:
            findings += _evaluate_oop_pfr_cbet(bet_fraction, bucket, texture)

        elif not is_pfr and is_ip:
            findings += _evaluate_ip_caller_donk(bet_fraction, bucket)

    elif first_action.action == "check" and is_pfr and is_ip:
        # IP PFR checking back — evaluate if it's appropriate
        findings += _evaluate_ip_pfr_check(bucket, texture)

    return findings


def _evaluate_ip_pfr_cbet(bet_frac: float, bucket: str, texture: BoardTexture) -> list[HeuristicFinding]:
    findings = []

    if bucket in ("A_high_dry", "K_high_dry"):
        if bet_frac > 0.75:
            findings.append(HeuristicFinding(
                severity="suboptimal",
                street="flop",
                action_taken=f"Large c-bet ({bet_frac:.0%} pot)",
                recommendation="Use a smaller sizing (25-40% pot)",
                explanation=(
                    "On ace/king-high dry boards, your range has a significant equity advantage. "
                    "Smaller bets (25-40% pot) allow you to bet at a high frequency and extract "
                    "value while keeping the pot manageable. Large bets are inefficient here "
                    "because the caller's range is capped and weak."
                ),
                freq_recommendation="High frequency small bet (33% pot)",
            ))
        elif 0.25 <= bet_frac <= 0.45:
            findings.append(HeuristicFinding(
                severity="good",
                street="flop",
                action_taken=f"Small c-bet ({bet_frac:.0%} pot)",
                recommendation="Optimal sizing on this board texture",
                explanation=(
                    "Excellent sizing on a dry ace/king-high board. This small bet exploits your "
                    "range advantage — the preflop raiser's range connects much better with these "
                    "boards than the caller's. You can bet at high frequency and force the caller "
                    "to defend with weak holdings."
                ),
                freq_recommendation="High frequency (65-75%)",
            ))

    elif bucket in ("wet_broadway", "A_high_wet"):
        if bet_frac > 0.67:
            findings.append(HeuristicFinding(
                severity="suboptimal",
                street="flop",
                action_taken=f"Large c-bet ({bet_frac:.0%} pot)",
                recommendation="Reduce sizing or check more frequently (33-50% pot)",
                explanation=(
                    "On wet connected boards, your range advantage is reduced because the caller "
                    "has many draws and connected holdings. Large c-bets are risky as you will "
                    "often get raised, and you may be building the pot in a spot where your "
                    "equity is more vulnerable. Mix in checks and use medium sizing."
                ),
                freq_recommendation="Medium frequency (40-55%), smaller sizing",
            ))
        elif 0.33 <= bet_frac <= 0.55:
            findings.append(HeuristicFinding(
                severity="good",
                street="flop",
                action_taken=f"Medium c-bet ({bet_frac:.0%} pot)",
                recommendation="Good sizing for a wet board",
                explanation=(
                    "Reasonable sizing on a wet board. You're not overcommitting the pot on a "
                    "board where your opponent can have many draws and strong made hands."
                ),
                freq_recommendation="Medium frequency (45-55%)",
            ))

    elif bucket == "monotone":
        if bet_frac > 0.5:
            findings.append(HeuristicFinding(
                severity="suboptimal",
                street="flop",
                action_taken=f"Large c-bet ({bet_frac:.0%} pot) on monotone board",
                recommendation="Check or use small bet (25-33% pot)",
                explanation=(
                    "Monotone boards heavily favour the player with flush draws or made flushes. "
                    "On rainbow preflop ranges, the caller often has more flush combos in some "
                    "positions. Large bets on monotone boards are risky — consider checking "
                    "more of your range or betting very small with your made hands for protection."
                ),
                freq_recommendation="Low-medium frequency, small sizing",
            ))

    elif bucket == "low_connected":
        if bet_frac > 0.6:
            findings.append(HeuristicFinding(
                severity="mistake",
                street="flop",
                action_taken=f"Large c-bet ({bet_frac:.0%} pot) on low connected board",
                recommendation="Check or use small-medium bet (33-50% pot)",
                explanation=(
                    "Low connected boards (e.g. 7-8-9, 6-7-8) are where the caller's range "
                    "has the most equity — they often have more two-pairs, sets, and straights. "
                    "Large bets here often have poor EV. Prefer checking or small bets that "
                    "don't over-invest on unfavourable board textures."
                ),
                freq_recommendation="Low frequency (25-35%), small sizing",
            ))

    elif bucket == "paired_board":
        if bet_frac > 0.5:
            findings.append(HeuristicFinding(
                severity="note",
                street="flop",
                action_taken=f"Medium/large c-bet ({bet_frac:.0%} pot) on paired board",
                recommendation="Small bets (25-33%) are often preferred on paired boards",
                explanation=(
                    "Paired boards reduce drawing equity for both sides. They typically favour "
                    "the preflop raiser since they have more trips and full houses in their range. "
                    "Small bets at high frequency are generally preferred over large bets."
                ),
                freq_recommendation="High frequency small bet (25-33%)",
            ))

    return findings


def _evaluate_oop_pfr_cbet(bet_frac: float, bucket: str, texture: BoardTexture) -> list[HeuristicFinding]:
    findings = []

    if bucket in ("A_high_dry", "K_high_dry"):
        if bet_frac > 0.6:
            findings.append(HeuristicFinding(
                severity="suboptimal",
                street="flop",
                action_taken=f"Large OOP c-bet ({bet_frac:.0%} pot)",
                recommendation="Use smaller sizing (25-40%) OOP on dry boards",
                explanation=(
                    "Out of position, even on dry high-card boards, prefer smaller c-bets. "
                    "You are more exposed to raises and have less information about your "
                    "opponent's range. Small bets (25-40%) maintain initiative while "
                    "keeping the pot smaller when you don't have strong equity."
                ),
                freq_recommendation="Medium frequency (50-65%), small sizing",
            ))
    elif bucket in ("low_connected", "wet_broadway", "monotone"):
        findings.append(HeuristicFinding(
            severity="note",
            street="flop",
            action_taken=f"OOP c-bet ({bet_frac:.0%} pot) on wet board",
            recommendation="Check-call or check-raise is often preferred OOP on wet boards",
            explanation=(
                "Out of position on wet boards, your continuation bet frequency should be "
                "significantly reduced. You have less fold equity and face more difficult "
                "decisions on future streets. Check-calling with strong hands and "
                "check-raising with sets/two-pairs is often superior."
            ),
            freq_recommendation="Low frequency OOP c-bet on wet boards (25-35%)",
        ))

    return findings


def _evaluate_ip_caller_donk(bet_frac: float, bucket: str) -> list[HeuristicFinding]:
    return [HeuristicFinding(
        severity="note",
        street="flop",
        action_taken=f"Donk bet ({bet_frac:.0%} pot) as IP caller",
        recommendation="Check or raise instead of donk betting",
        explanation=(
            "Donk betting (betting out of position into the preflop raiser) is generally "
            "a non-GTO play that gives up positional advantage. Prefer checking to allow "
            "the PFR to c-bet, then respond accordingly. This keeps the PFR's range wide "
            "and gives you more information before committing chips."
        ),
        freq_recommendation="Check at high frequency as OOP caller",
    )]


def _evaluate_ip_pfr_check(bucket: str, texture: BoardTexture) -> list[HeuristicFinding]:
    if bucket in ("low_connected", "monotone", "wet_broadway"):
        return [HeuristicFinding(
            severity="good",
            street="flop",
            action_taken="Check back IP as PFR",
            recommendation="Good check on a board that favours the caller's range",
            explanation=(
                "Checking back on a wet/connected board as the IP PFR is often correct. "
                "These boards have more draws and strong combos for the caller's range. "
                "By checking, you protect your checking range, keep the pot smaller, "
                "and avoid building a large pot in an unfavourable spot."
            ),
            freq_recommendation="High check frequency on wet boards",
        )]
    return []


# ── Turn evaluator ─────────────────────────────────────────────────────────

def _evaluate_turn(
    hero_actions: list[HandAction],
    flop_actions: list[HandAction],
    spot: SpotClassification,
    texture: BoardTexture,
) -> list[HeuristicFinding]:
    findings = []

    if not hero_actions:
        return findings

    first = hero_actions[0]
    first_flop = flop_actions[0] if flop_actions else None

    if first.action == "bet" and first_flop and first_flop.action == "bet":
        # Double barrel
        if first.size_bb and first_flop.size_bb:
            if first.size_bb > first_flop.size_bb * 2.5:
                findings.append(HeuristicFinding(
                    severity="suboptimal",
                    street="turn",
                    action_taken="Large turn barrel after flop bet",
                    recommendation="Keep consistent sizing or use polarized large bets with strong hands/bluffs only",
                    explanation=(
                        "Turn bets after a flop c-bet should generally be consistent or "
                        "slightly larger for value. Extremely large turn bets can be "
                        "inefficient unless you are very polarized (strong made hand or pure bluff). "
                        "Consider your hand's equity before sizing up on the turn."
                    ),
                    freq_recommendation="Turn sizing ~50-75% pot for balanced range",
                ))

    return findings


# ── River evaluator ────────────────────────────────────────────────────────

def _evaluate_river(
    hero_actions: list[HandAction],
    spot: SpotClassification,
    texture: BoardTexture,
    hand: ParsedHand,
) -> list[HeuristicFinding]:
    findings = []

    if not hero_actions:
        return findings

    first = hero_actions[0]
    hero_cards = hand.hero_cards

    if first.action == "bet":
        # River bluff detection heuristic
        has_blockers = _check_bluff_blockers(hero_cards, hand.board)
        if not has_blockers:
            findings.append(HeuristicFinding(
                severity="note",
                street="river",
                action_taken="River bet without strong blockers",
                recommendation="River bluffs should prioritise hands with blockers to villain's calling range",
                explanation=(
                    "Effective river bluffing requires holding cards that reduce the "
                    "number of strong value combos in your opponent's range (blockers). "
                    "Without blockers to nuts/strong hands, your bluff has lower EV "
                    "since your opponent can call at a higher frequency."
                ),
                freq_recommendation="Prioritize blocker-heavy hands for river bluffs",
            ))

    return findings


# ── Preflop evaluator ──────────────────────────────────────────────────────

def _evaluate_preflop(
    hero_actions: list[HandAction],
    spot: SpotClassification,
    hand: ParsedHand,
) -> list[HeuristicFinding]:
    findings = []

    raises = [a for a in hero_actions if a.action == "raise"]
    if raises:
        first_raise = raises[0]
        if first_raise.size_bb:
            findings += _evaluate_preflop_sizing(first_raise.size_bb, spot)

    return findings


def _evaluate_preflop_sizing(size_bb: float, spot: SpotClassification) -> list[HeuristicFinding]:
    if spot.pot_type == "SRP":
        if size_bb < 2.0:
            return [HeuristicFinding(
                severity="mistake",
                street="preflop",
                action_taken=f"Min-raise to {size_bb}BB",
                recommendation="Open to 2.5-3BB for a standard raise",
                explanation=(
                    "Min-raising preflop (2BB) is generally suboptimal as it gives the "
                    "big blind excellent pot odds to call with almost any two cards, reducing "
                    "your fold equity and making post-flop spots more difficult. "
                    "Standard opens of 2.5-3x are more common in modern GTO play."
                ),
                freq_recommendation="Standard open sizing: 2.5x BTN, 3x EP",
            )]
        elif size_bb > 5.0:
            return [HeuristicFinding(
                severity="suboptimal",
                street="preflop",
                action_taken=f"Large open to {size_bb}BB",
                recommendation="Reduce open size to 2.5-3BB",
                explanation=(
                    "Opening too large preflop reduces your ability to build a balanced "
                    "range and may cause opponents to play more exploitatively against you. "
                    "Large opens also leave less room for post-flop play. "
                    "Standard sizing of 2.5-3BB achieves good fold equity while maintaining "
                    "playability."
                ),
                freq_recommendation="2.5-3x standard open sizing",
            )]
    return []


# ── Utility ────────────────────────────────────────────────────────────────

def _estimate_pot_at_street(hand: ParsedHand, street: str) -> float:
    """Rough pot estimate at the start of a given street."""
    streets_before = {
        "preflop": [],
        "flop": ["preflop"],
        "turn": ["preflop", "flop"],
        "river": ["preflop", "flop", "turn"],
    }
    total = hand.big_blind / hand.big_blind + 0.5  # BB + SB in BB
    for s in streets_before.get(street, []):
        for a in hand.actions:
            if a.street == s and a.action in ("call", "bet", "raise") and a.size_bb:
                total += a.size_bb
    return max(total, 2.0)


def _check_bluff_blockers(hero_cards: list[str], board) -> bool:
    """Simple blocker check — does hero hold an ace, king, or board suit card?"""
    if not hero_cards:
        return False
    ranks = [c[0].upper() for c in hero_cards]
    suits = [c[1].lower() for c in hero_cards]

    # Has top card blocker
    if "A" in ranks or "K" in ranks:
        return True

    # Has suit blocker on monotone/two-tone board
    all_board = board.flop + board.turn + board.river
    if all_board:
        board_suits = [c[1].lower() for c in all_board]
        suit_counts = {s: board_suits.count(s) for s in set(board_suits)}
        dominant_suit = max(suit_counts, key=suit_counts.get)
        if dominant_suit in suits:
            return True

    return False
