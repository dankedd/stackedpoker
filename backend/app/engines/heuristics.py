"""
Solver-inspired heuristic rules engine.

Rules are organized by spot type + board texture and return
HeuristicFinding objects with severity, explanation and recommendations.
"""
from __future__ import annotations
from app.models.schemas import (
    ParsedHand, SpotClassification, BoardTexture, HeuristicFinding, HandAction
)
from app.engines.preflop_ranges import (
    detect_preflop_node, classify_hand, _is_in_rfi_range,
)


def run_heuristics(
    hand: ParsedHand,
    spot: SpotClassification,
    texture: BoardTexture,
    draw_analysis=None,   # DrawAnalysis | None — from draw_evaluator
    poker_state=None,     # PokerState | None — canonical state for made-hand priority
) -> list[HeuristicFinding]:
    findings: list[HeuristicFinding] = []

    flop_actions = [a for a in hand.actions if a.street == "flop" and a.is_hero]
    turn_actions = [a for a in hand.actions if a.street == "turn" and a.is_hero]
    river_actions = [a for a in hand.actions if a.street == "river" and a.is_hero]

    # Resolve made-hand category from PokerState when available.
    # This prevents draw labels from overriding strong made hands.
    made_hand_category = 0
    if poker_state is not None and poker_state.hand_strength is not None:
        made_hand_category = poker_state.hand_strength.made_hand_category

    # ── Flop ──────────────────────────────────────────────────────────────
    if hand.board.flop:
        findings += _evaluate_flop(flop_actions, spot, texture, hand)
        if draw_analysis is not None:
            findings += _evaluate_draw_spot(
                flop_actions, draw_analysis, spot, "flop",
                made_hand_category=made_hand_category,
            )

    # ── Turn ──────────────────────────────────────────────────────────────
    if hand.board.turn and flop_actions:
        findings += _evaluate_turn(turn_actions, flop_actions, spot, texture)
        if hand.hero_cards:
            turn_draw = _get_turn_draw(hand)
            if turn_draw is not None:
                # Recompute made-hand category on flop+turn board
                turn_made = _get_made_hand_category(hand.hero_cards, hand.board.flop + hand.board.turn)
                findings += _evaluate_draw_spot(
                    turn_actions, turn_draw, spot, "turn",
                    made_hand_category=turn_made,
                )

    # ── River ─────────────────────────────────────────────────────────────
    if hand.board.river and river_actions:
        findings += _evaluate_river(river_actions, spot, texture, hand)

    # ── Preflop ───────────────────────────────────────────────────────────
    preflop_actions = [a for a in hand.actions if a.street == "preflop" and a.is_hero]
    findings += _evaluate_preflop(preflop_actions, spot, hand)

    return findings


def _get_turn_draw(hand: ParsedHand):
    """Re-analyze draws on flop+turn board. Returns DrawAnalysis or None."""
    try:
        from app.engines.draw_evaluator import analyze_draws
        board = hand.board.flop + hand.board.turn
        return analyze_draws(hand.hero_cards, board)
    except Exception:
        return None


def _get_made_hand_category(hero_cards: list[str], board_cards: list) -> int:
    """Return made-hand category (0-8) for hero on a given board. 0 on error."""
    try:
        from app.engines.hand_evaluator import evaluate_hole_and_board
        return evaluate_hole_and_board(hero_cards, [str(c) for c in board_cards]).category
    except Exception:
        return 0


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
    hand_bucket = classify_hand(hand.hero_cards)

    for hero_action in hero_actions:
        try:
            action_idx = hand.actions.index(hero_action)
        except ValueError:
            continue

        node = detect_preflop_node(action_idx, hand.actions, hand.hero_position)
        act = hero_action.action

        # ── Illegal action check ──────────────────────────────────────────
        if act not in node.legal_actions:
            findings.append(HeuristicFinding(
                severity="mistake",
                street="preflop",
                action_taken=f"{act.capitalize()} in {node.node_type} node",
                recommendation=f"Legal actions here: {', '.join(sorted(node.legal_actions))}",
                explanation=(
                    f"'{act}' is not a valid action in a {node.node_type} node. "
                    f"Preflop node detection: {node.raise_count_before} raise(s) before this action. "
                    f"Legal options: {', '.join(sorted(node.legal_actions))}."
                ),
                freq_recommendation=f"Choose from: {', '.join(sorted(node.legal_actions))}",
            ))
            continue  # Skip further checks for this action

        # ── Range-appropriateness check for RFI nodes ─────────────────────
        if node.node_type == "RFI":
            in_range = _is_in_rfi_range(node.hero_position, hand_bucket)

            if act == "fold" and in_range:
                findings.append(HeuristicFinding(
                    severity="suboptimal",
                    street="preflop",
                    action_taken=f"Fold {' '.join(hand.hero_cards)} in {hand.hero_position} RFI",
                    recommendation=f"Open to 2.5-3bb — {' '.join(hand.hero_cards)} is in the {hand.hero_position} range",
                    explanation=(
                        f"{' '.join(hand.hero_cards)} ({hand_bucket}) is within the {hand.hero_position} "
                        f"opening range. Folding misses EV from stealing the blinds and playing "
                        f"a range-strong hand."
                    ),
                    freq_recommendation=f"Open {' '.join(hand.hero_cards)} at high frequency from {hand.hero_position}",
                ))

            elif act == "raise" and not in_range:
                findings.append(HeuristicFinding(
                    severity="mistake",
                    street="preflop",
                    action_taken=f"Open {' '.join(hand.hero_cards)} from {hand.hero_position}",
                    recommendation=f"Fold — {' '.join(hand.hero_cards)} is below the {hand.hero_position} opening range",
                    explanation=(
                        f"{' '.join(hand.hero_cards)} ({hand_bucket}) is not in the {hand.hero_position} "
                        f"GTO opening range. Opening this hand bloats the pot with a below-range "
                        f"holding and makes post-flop play difficult."
                    ),
                    freq_recommendation=f"Fold {' '.join(hand.hero_cards)} from {hand.hero_position}",
                ))

            # Sizing check for raises
            elif act == "raise" and hero_action.size_bb:
                findings += _evaluate_preflop_sizing(hero_action.size_bb, spot)

        else:
            # Non-RFI: only sizing check for raises
            if act == "raise" and hero_action.size_bb:
                findings += _evaluate_preflop_sizing(hero_action.size_bb, spot)

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
    """Estimate pot size (in BB) at the start of a given street.

    Starts from 1.5bb (SB + BB) then adds all action sizes from prior streets.
    Previously broken: `hand.big_blind / hand.big_blind + 0.5` always returned 1.5
    regardless of action — operator precedence bug.  Now correctly sums action sizes.
    """
    streets_before = {
        "preflop": [],
        "flop": ["preflop"],
        "turn": ["preflop", "flop"],
        "river": ["preflop", "flop", "turn"],
    }
    # 1.5bb = SB(0.5) + BB(1.0) before any action
    total = 1.5
    for s in streets_before.get(street, []):
        for a in hand.actions:
            if a.street == s and a.action in ("call", "bet", "raise") and a.size_bb:
                total += a.size_bb
    return max(total, 2.0)


# ── Draw-aware heuristics ──────────────────────────────────────────────────

def _evaluate_draw_spot(
    hero_actions: list[HandAction],
    draw_analysis,          # DrawAnalysis from draw_evaluator
    spot: SpotClassification,
    street: str,
    made_hand_category: int = 0,
) -> list[HeuristicFinding]:
    """Generate findings based on hero's draw strength on the current street.

    CRITICAL: If hero has a made hand (category >= 1), draw findings are
    suppressed unless the draw adds meaningful equity (e.g., flush draw on top
    of a pair).  A made hand NEVER gets labeled as a draw-only hand.
    """
    findings: list[HeuristicFinding] = []

    if not hero_actions:
        return findings

    # ── Made-hand priority gate ────────────────────────────────────────────
    # If hero has two pair or better (category >= 2), draw heuristics don't
    # apply — the hand's primary coaching driver is the made hand, not the draw.
    if made_hand_category >= 2:
        return findings

    first = hero_actions[0]
    outs = getattr(draw_analysis, "primary_outs", 0)
    label = getattr(draw_analysis, "primary_label", "draw")
    is_ip = spot.hero_is_ip

    # ── Backdoor-only: hero has no direct draw ──────────────────────────
    if not draw_analysis.has_direct_straight_draw and not draw_analysis.has_flush_draw:
        if draw_analysis.has_backdoor_flush or draw_analysis.has_backdoor_straight:
            if first.action in ("bet", "raise") and first.size_bb:
                findings.append(HeuristicFinding(
                    severity="note",
                    street=street,
                    action_taken=f"{first.action.capitalize()} with backdoor draws only",
                    recommendation="Treat backdoor draws as high-card equity, not a draw",
                    explanation=(
                        f"Your hand has only backdoor draw potential ({label}). "
                        "Backdoor draws add ~4-6% equity — not enough to drive aggressive "
                        "lines on their own. Any betting should be based on showdown value, "
                        "fold equity, or a pair; not the draw."
                    ),
                    freq_recommendation="Back-door draws ≈ 4-6% extra equity — size accordingly",
                ))
        return findings

    # ── Combo draw: flush draw + straight draw ──────────────────────────
    if draw_analysis.is_combo_draw and outs >= 12:
        if first.action == "check":
            findings.append(HeuristicFinding(
                severity="note",
                street=street,
                action_taken=f"Check with {outs}-out combo draw",
                recommendation="Consider semibluffing — combo draws are strong enough to bet for value",
                explanation=(
                    f"You hold a powerful combo draw ({label}, ~{outs} outs). "
                    f"This gives approximately {outs * 4}% equity to improve by the river. "
                    "Semibluffing builds the pot when you have massive equity and generates "
                    f"fold equity {'IP' if is_ip else 'OOP'}. "
                    "Checking is fine as a deception play, but leading/raising is highly +EV."
                ),
                freq_recommendation=f"Semibet ~{min(70, 50 + outs * 2)}% of the time with combo draws",
            ))
        elif first.action in ("bet", "raise"):
            findings.append(HeuristicFinding(
                severity="good",
                street=street,
                action_taken=f"Semibluff with {outs}-out combo draw",
                recommendation="Correct — combo draws are strong semibluffing hands",
                explanation=(
                    f"Betting with a combo draw ({label}, ~{outs} outs) is excellent. "
                    f"You have ~{outs * 4}% raw equity to improve by the river, plus fold equity. "
                    "This is a highly +EV semibluff that builds the pot on your terms."
                ),
                freq_recommendation="High semibluff frequency with 12+ out combo draws",
            ))
        return findings

    # ── Flush draw or OESD: 8-9 outs ───────────────────────────────────
    if draw_analysis.has_flush_draw or (draw_analysis.has_direct_straight_draw and outs >= 8):
        if first.action in ("bet", "raise"):
            findings.append(HeuristicFinding(
                severity="good",
                street=street,
                action_taken=f"Semibluff with {outs}-out draw",
                recommendation="Good semibluff with a strong single draw",
                explanation=(
                    f"Semibluffing with {label} ({outs} outs) is correct. "
                    f"You have ~{outs * 4}% equity to improve to the best hand by the river. "
                    "Strong draws play best as semibluffs — they protect your betting range "
                    "and can win two ways: by making the best hand or by folding out equity."
                ),
                freq_recommendation=f"Mix semibet (~55%) and check (~45%) for balance",
            ))
        return findings

    # ── Gutshot: 4 outs ────────────────────────────────────────────────
    if draw_analysis.has_direct_straight_draw and outs <= 5:
        if first.action in ("bet", "raise") and first.size_bb:
            findings.append(HeuristicFinding(
                severity="note",
                street=street,
                action_taken=f"Bet/raise with gutshot ({outs} outs)",
                recommendation="Gutshots are weak semibluffs — prefer checking or calling with pot odds",
                explanation=(
                    f"A gutshot ({label}) has only {outs} outs — approximately "
                    f"{outs * 4}% equity to improve. Unless you have additional "
                    "showdown value (overcards, backdoor draws), gutshots are generally "
                    "better played as check/calls, using pot odds rather than "
                    "generating fold equity."
                ),
                freq_recommendation="Check-call with gutshots; semibet only with added equity",
            ))

    return findings


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
