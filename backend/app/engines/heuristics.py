"""
Theory-grounded heuristic rules engine.

Rules are organized by spot type + board texture and return
HeuristicFinding objects with severity, explanation and recommendations.

DESIGN RULES (enforced here):
  - NO fake frequencies in freq_recommendation (e.g. "65-75%")
  - NO fake solver percentages in explanation text
  - Language must be appropriately hedged by confidence level
  - Structural logic (bucket detection, sizing evaluation) is preserved
  - Only qualitative claims that are STRATEGICALLY DEFENSIBLE
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

    # ── Cross-street: fold facing no bet ─────────────────────────────────
    findings += _detect_fold_facing_no_bet(hand)

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
                recommendation="Consider smaller sizing on this dry high-card board",
                explanation=(
                    "On ace/king-high dry boards, the preflop raiser's range typically holds "
                    "a meaningful equity advantage. Smaller bet sizes are generally more efficient "
                    "on these textures — the caller's range is relatively capped, so large bets "
                    "are not required to extract value or deny equity. Theory supports "
                    "small, high-frequency bets on dry high-card boards."
                ),
                freq_recommendation="Small bet sizing is generally preferred on dry high-card boards",
            ))
        elif 0.25 <= bet_frac <= 0.45:
            findings.append(HeuristicFinding(
                severity="good",
                street="flop",
                action_taken=f"Small c-bet ({bet_frac:.0%} pot)",
                recommendation="Sizing is consistent with range advantage theory on this texture",
                explanation=(
                    "Small bet sizing on a dry ace/king-high board aligns with range advantage "
                    "principles — the preflop raiser's range connects more strongly with these boards "
                    "than the caller's. This approach allows continued pressure while keeping "
                    "the pot proportionate."
                ),
                freq_recommendation="Small bet approach is theoretically supported on dry high-card boards",
            ))

    elif bucket in ("wet_broadway", "A_high_wet"):
        if bet_frac > 0.67:
            findings.append(HeuristicFinding(
                severity="suboptimal",
                street="flop",
                action_taken=f"Large c-bet ({bet_frac:.0%} pot)",
                recommendation="Consider smaller sizing or mixing in more checks on wet boards",
                explanation=(
                    "On wet connected boards, the preflop raiser's range advantage is reduced "
                    "because the caller has more draws and connected holdings. Large c-bets "
                    "carry more risk on these textures — the caller's range can comfortably "
                    "continue with draws and made hands. Theory suggests mixing checks "
                    "with medium sizing rather than committing to large bets."
                ),
                freq_recommendation="Check frequency should generally increase on wet boards",
            ))
        elif 0.33 <= bet_frac <= 0.55:
            findings.append(HeuristicFinding(
                severity="good",
                street="flop",
                action_taken=f"Medium c-bet ({bet_frac:.0%} pot)",
                recommendation="Reasonable sizing for a wet board",
                explanation=(
                    "Medium sizing on a wet board avoids over-committing the pot on a "
                    "texture where the opponent can hold many draws and strong made hands. "
                    "This approach is defensible from a range construction standpoint."
                ),
                freq_recommendation="Selective continuation with medium sizing is theoretically sound on wet boards",
            ))

    elif bucket == "monotone":
        if bet_frac > 0.5:
            findings.append(HeuristicFinding(
                severity="suboptimal",
                street="flop",
                action_taken=f"Large c-bet ({bet_frac:.0%} pot) on monotone board",
                recommendation="Consider checking or using smaller sizing on monotone boards",
                explanation=(
                    "Monotone boards significantly redistribute equity based on flush "
                    "holdings. Large bets on these boards carry more risk when the "
                    "caller's range may contain more flush draw combinations in some "
                    "matchups. Theory generally favors checking more of your range "
                    "or using small bets when continuing on monotone boards."
                ),
                freq_recommendation="Increased check frequency is generally appropriate on monotone boards",
            ))

    elif bucket == "low_connected":
        if bet_frac > 0.6:
            findings.append(HeuristicFinding(
                severity="mistake",
                street="flop",
                action_taken=f"Large c-bet ({bet_frac:.0%} pot) on low connected board",
                recommendation="Check or use smaller sizing on low connected boards",
                explanation=(
                    "Low connected boards (e.g., 7-8-9, 6-7-8) are where the caller's range "
                    "tends to hold more equity — two-pairs, sets, and straight draws are common "
                    "in a BB defending range on these textures. Large bets here are generally "
                    "not supported by range dynamics. Checking or small bets are "
                    "more appropriate on boards that connect well with the caller's range."
                ),
                freq_recommendation="Checking is generally preferred on low connected boards when range advantage is absent",
            ))

    elif bucket == "paired_board":
        if bet_frac > 0.5:
            findings.append(HeuristicFinding(
                severity="note",
                street="flop",
                action_taken=f"Medium/large c-bet ({bet_frac:.0%} pot) on paired board",
                recommendation="Small bets are generally preferred on paired boards",
                explanation=(
                    "Paired boards reduce drawing equity for both ranges. Theory generally "
                    "supports small bets at higher frequency on paired boards — the preflop "
                    "raiser's range typically contains more trips and full houses, but the "
                    "board's structure doesn't demand large bets to extract value."
                ),
                freq_recommendation="Small bet approach is generally sound on paired boards",
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
                recommendation="Prefer smaller sizing out of position on dry boards",
                explanation=(
                    "Out of position, even on dry high-card boards, smaller c-bets "
                    "are generally more efficient. Acting first on every street increases "
                    "exposure to raises and limits information before committing. "
                    "Small bets OOP maintain initiative while keeping the pot manageable."
                ),
                freq_recommendation="OOP c-bets are generally more effective at smaller sizing",
            ))
    elif bucket in ("low_connected", "wet_broadway", "monotone"):
        findings.append(HeuristicFinding(
            severity="note",
            street="flop",
            action_taken=f"OOP c-bet ({bet_frac:.0%} pot) on wet board",
            recommendation="Check-call or check-raise is often preferred OOP on wet boards",
            explanation=(
                "Out of position on wet boards, c-bet frequency should be meaningfully "
                "reduced. Positional disadvantage combines with reduced range advantage "
                "on these textures. Check-calling with strong hands and "
                "check-raising with two-pairs and sets is generally more effective OOP."
            ),
            freq_recommendation="Checking OOP is generally preferred on wet boards",
        ))

    return findings


def _evaluate_ip_caller_donk(bet_frac: float, bucket: str) -> list[HeuristicFinding]:
    return [HeuristicFinding(
        severity="note",
        street="flop",
        action_taken=f"Donk bet ({bet_frac:.0%} pot) as IP caller",
        recommendation="Checking is generally preferred as the caller",
        explanation=(
            "Donk betting (leading into the preflop raiser) disrupts the natural "
            "range dynamic and generally gives up information advantage. "
            "Checking allows the preflop raiser to continue with their range, "
            "giving you more information before committing. This approach is "
            "theoretically sound in most configurations."
        ),
        freq_recommendation="Checking at high frequency is the theoretically standard play as the caller",
    )]


def _evaluate_ip_pfr_check(bucket: str, texture: BoardTexture) -> list[HeuristicFinding]:
    if bucket in ("low_connected", "monotone", "wet_broadway"):
        return [HeuristicFinding(
            severity="good",
            street="flop",
            action_taken="Check back IP as PFR",
            recommendation="Checking back aligns with theory on a board that connects with the caller's range",
            explanation=(
                "Checking back on a wet or connected board as the IP preflop raiser is "
                "a theoretically sound approach. These boards have more draws and strong "
                "combinations for the caller's range. Checking protects your range, "
                "manages pot size, and avoids building a large pot in a potentially "
                "unfavorable equity spot."
            ),
            freq_recommendation="Checking back is generally supported on wet boards where range advantage is reduced",
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
                    recommendation="Maintain consistent sizing or use polarized large bets only with strong hands or bluffs",
                    explanation=(
                        "A significant increase in sizing on the turn, relative to the flop bet, "
                        "is generally most appropriate when your range is very polarized — "
                        "either strong value hands or bluffs. For a merged range of medium-strength "
                        "hands, consistent or moderately larger sizing is typically more balanced "
                        "and harder to exploit."
                    ),
                    freq_recommendation="Turn sizing should be consistent with the hand's equity and range composition",
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
                recommendation="River bluffs are more effective when holding blockers to the opponent's calling range",
                explanation=(
                    "Effective river bluffing benefits from holding cards that reduce "
                    "the number of strong value combinations in the opponent's range (blockers). "
                    "Without blockers to key hands, fold equity is reduced "
                    "because the opponent can call with strong holdings at a higher rate. "
                    "Blocker selection is an important component of polarized river betting ranges."
                ),
                freq_recommendation="Blockers to the nuts improve bluff EV on the river",
            ))

    return findings


# ── Fold-facing-no-bet detector ────────────────────────────────────────────

def _detect_fold_facing_no_bet(hand: ParsedHand) -> list[HeuristicFinding]:
    """
    Detect hero folding on a postflop street when no villain bet/raise is
    outstanding.  This is an illegal game action (should be a check) and
    indicates either a corrupted hand history or parsing error.

    If the normalizer auto-corrected fold→check, this won't fire because
    the action is already a check.  This catches any remaining edge cases.
    """
    findings: list[HeuristicFinding] = []

    for street_name in ("flop", "turn", "river"):
        street_actions = [a for a in hand.actions if a.street == street_name]
        current_bet = 0.0
        for a in street_actions:
            if a.action in ("bet", "raise"):
                current_bet = a.size_bb or 1.0
            if a.is_hero and a.action == "fold" and current_bet == 0.0:
                findings.append(HeuristicFinding(
                    severity="mistake",
                    street=street_name,
                    action_taken=f"Fold on {street_name} facing no bet",
                    recommendation=(
                        "You cannot fold when not facing a bet — checking is "
                        "the correct action. This fold forfeits a pot you could "
                        "have won for free."
                    ),
                    explanation=(
                        f"On the {street_name}, no opponent bet or raised before your action. "
                        "Folding in this spot surrenders the entire pot unnecessarily. "
                        "When facing no aggression, checking keeps you in the hand at zero cost. "
                        "This is a fundamental game-state error that should never occur."
                    ),
                    freq_recommendation=None,
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
                    recommendation=f"Consider opening — {' '.join(hand.hero_cards)} is within the {hand.hero_position} opening range",
                    explanation=(
                        f"{' '.join(hand.hero_cards)} ({hand_bucket}) is within the {hand.hero_position} "
                        f"opening range based on standard range construction. Folding misses the "
                        f"opportunity to play a hand with positive expected value from this position."
                    ),
                    freq_recommendation=f"Opening {' '.join(hand.hero_cards)} from {hand.hero_position} is generally supported",
                ))

            elif act == "raise" and not in_range:
                findings.append(HeuristicFinding(
                    severity="mistake",
                    street="preflop",
                    action_taken=f"Open {' '.join(hand.hero_cards)} from {hand.hero_position}",
                    recommendation=f"Folding is generally correct — {' '.join(hand.hero_cards)} is below the standard {hand.hero_position} opening range",
                    explanation=(
                        f"{' '.join(hand.hero_cards)} ({hand_bucket}) falls below the standard {hand.hero_position} "
                        f"opening range in most GTO frameworks. Opening this hand bloats the pot with a "
                        f"below-range holding and creates difficult postflop spots."
                    ),
                    freq_recommendation=f"Folding {' '.join(hand.hero_cards)} from {hand.hero_position} aligns with standard range construction",
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
                recommendation="Open to approximately 2.5-3BB",
                explanation=(
                    "Min-raising preflop (2BB) gives the big blind strong pot odds to "
                    "continue with a very wide range, significantly reducing fold equity. "
                    "Standard opening sizes in modern play are typically 2.5x from late "
                    "position and 3x from early position, balancing fold equity with "
                    "stack depth management."
                ),
                freq_recommendation="Standard open sizing is generally 2.5x from late position, 3x from early position",
            )]
        elif size_bb > 5.0:
            return [HeuristicFinding(
                severity="suboptimal",
                street="preflop",
                action_taken=f"Large open to {size_bb}BB",
                recommendation="Reduce open size to approximately 2.5-3BB",
                explanation=(
                    "Very large preflop opens reduce the range of hands that can "
                    "profitably call, but also reduce postflop playability and pot odds "
                    "for your own hand. Standard sizing of 2.5-3BB is more commonly "
                    "supported as it achieves effective fold equity while maintaining "
                    "stack-to-pot flexibility."
                ),
                freq_recommendation="Standard open sizing is generally 2.5-3BB across most situations",
            )]
    return []


# ── Utility ────────────────────────────────────────────────────────────────

def _estimate_pot_at_street(hand: ParsedHand, street: str) -> float:
    """Estimate pot size (in BB) at the start of a given street."""
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
                    recommendation="Treat backdoor draws as supplemental equity, not a primary driver",
                    explanation=(
                        f"Your hand has only backdoor draw potential ({label}). "
                        "Backdoor draws add modest equity — not enough to drive aggressive "
                        "lines on their own. Any betting should be based on showdown value, "
                        "fold equity, or a pair; the backdoor draw is a secondary consideration."
                    ),
                    freq_recommendation="Backdoor draws provide supplemental equity; treat them as supporting, not leading",
                ))
        return findings

    # ── Combo draw: flush draw + straight draw ──────────────────────────
    if draw_analysis.is_combo_draw and outs >= 12:
        if first.action == "check":
            findings.append(HeuristicFinding(
                severity="note",
                street=street,
                action_taken=f"Check with {outs}-out combo draw",
                recommendation="Consider semi-bluffing — combo draws have strong equity to improve",
                explanation=(
                    f"You hold a strong combo draw ({label}, approximately {outs} outs). "
                    "Semi-bluffing builds the pot when you have substantial equity to improve "
                    f"and generates fold equity {'when in position' if is_ip else 'out of position'}. "
                    "Checking is defensible as a deception play, but aggressive lines "
                    "with high-equity draws are generally theoretically supported."
                ),
                freq_recommendation="Combo draws are generally strong candidates for semi-bluffing",
            ))
        elif first.action in ("bet", "raise"):
            findings.append(HeuristicFinding(
                severity="good",
                street=street,
                action_taken=f"Semi-bluff with {outs}-out combo draw",
                recommendation="Aggressive line is supported with a strong combo draw",
                explanation=(
                    f"Betting with a combo draw ({label}, approximately {outs} outs) "
                    "is generally supported by theory. You have strong equity to improve "
                    "plus fold equity — two ways to win this hand."
                ),
                freq_recommendation="Combo draws are strong semi-bluffing candidates",
            ))
        return findings

    # ── Flush draw or OESD: 8-9 outs ───────────────────────────────────
    if draw_analysis.has_flush_draw or (draw_analysis.has_direct_straight_draw and outs >= 8):
        if first.action in ("bet", "raise"):
            findings.append(HeuristicFinding(
                severity="good",
                street=street,
                action_taken=f"Semi-bluff with {outs}-out draw",
                recommendation="Aggressive play is generally supported with a strong single draw",
                explanation=(
                    f"Semi-bluffing with {label} ({outs} outs) is theoretically defensible. "
                    "Strong draws have meaningful equity to improve and generate fold equity "
                    "simultaneously — both paths can lead to winning the pot."
                ),
                freq_recommendation="Strong single draws are generally sound semi-bluffing candidates",
            ))
        return findings

    # ── Gutshot: 4 outs ────────────────────────────────────────────────
    if draw_analysis.has_direct_straight_draw and outs <= 5:
        if first.action in ("bet", "raise") and first.size_bb:
            findings.append(HeuristicFinding(
                severity="note",
                street=street,
                action_taken=f"Bet/raise with gutshot ({outs} outs)",
                recommendation="Gutshots are generally weak semi-bluffs — prefer pot-odds-based calls or checks",
                explanation=(
                    f"A gutshot ({label}) has only {outs} outs, providing limited equity to improve. "
                    "Without additional showdown value (overcards, backdoor draws), gutshots "
                    "are generally better played using pot odds as a guide for calling rather "
                    "than aggressive semi-bluffing. The fold equity required to make gutshot "
                    "bluffs profitable is typically high."
                ),
                freq_recommendation="Gutshots generally work better as check-calls unless combined with additional equity",
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
