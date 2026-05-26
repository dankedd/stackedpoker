"""Deterministic per-action scoring engine.

Converts heuristic findings + spot/texture context into structured ActionCoaching.
Same input always produces the same output — no randomness, no LLM decisions.

The LLM may only improve wording later; it never controls scores or frequencies.
"""
from __future__ import annotations

from app.models.schemas import (
    ActionCoaching,
    BoardTexture,
    HandAction,
    HeuristicFinding,
    ParsedHand,
    SpotClassification,
    StrategicOption,
)
from app.engines.preflop_ranges import detect_preflop_node, get_preflop_recommendation


# ── Public API ─────────────────────────────────────────────────────────────

def score_all_hero_actions(
    hand: ParsedHand,
    findings: list[HeuristicFinding],
    spot: SpotClassification,
    texture: BoardTexture,
) -> dict[int, ActionCoaching]:
    """Return {action_index: ActionCoaching} for every hero action in the hand."""
    return {
        i: _score_action(action, findings, spot, texture, hand)
        for i, action in enumerate(hand.actions)
        if action.is_hero
    }


# ── Core scoring ───────────────────────────────────────────────────────────

def _score_action(
    action: HandAction,
    findings: list[HeuristicFinding],
    spot: SpotClassification,
    texture: BoardTexture,
    hand: ParsedHand,
) -> ActionCoaching:
    relevant = _find_relevant(action, findings)
    severity = relevant[0].severity if relevant else "note"

    # Resolve action index for preflop node detection
    try:
        action_idx = hand.actions.index(action)
    except ValueError:
        action_idx = 0

    # Compute strategic options FIRST — they encode hand-strength-aware
    # recommendations that the base heuristic severity may miss.
    options = _strategic_options(action, relevant, spot, texture, hand, action_idx)

    # ── Strategy-deviation penalty ────────────────────────────────────────
    # If the primary strategic recommendation disagrees with the actual
    # action, apply a score penalty proportional to confidence.
    # This prevents contradictions like "Good Fold" when primary = Call.
    score = _severity_to_score(severity, action, spot)
    deviation = _compute_deviation(action, options)
    if deviation.is_deviation:
        score = max(0, score - deviation.penalty)
        # Upgrade severity to match the deviation
        if deviation.penalty >= 25:
            severity = "mistake"
        elif deviation.penalty >= 12:
            severity = "suboptimal"

    quality = _score_to_quality(score)
    mistake_level = _severity_to_mistake_level(severity)

    explanation = relevant[0].explanation if relevant else _default_explanation(action, spot, texture)
    adjustment = relevant[0].recommendation if relevant else _default_adjustment(action, spot, texture)

    # Override explanation when a strong deviation is detected but heuristics
    # missed it (no relevant finding).
    if deviation.is_deviation and not relevant:
        explanation = deviation.explanation
        adjustment = deviation.adjustment

    return ActionCoaching(
        score=score,
        quality=quality,
        mistake_level=mistake_level,
        strategic_options=options,
        reason_codes=_reason_codes(action, relevant, spot, texture),
        explanation=explanation,
        adjustment=adjustment,
    )


# ── Finding matcher ────────────────────────────────────────────────────────

def _find_relevant(
    action: HandAction, findings: list[HeuristicFinding]
) -> list[HeuristicFinding]:
    result = []
    for f in findings:
        if f.street.lower() != action.street.lower():
            continue
        at = f.action_taken.lower()
        verb = action.action
        if verb == "bet" and any(k in at for k in ("bet", "cbet", "c-bet", "barrel", "donk")):
            result.append(f)
        elif verb == "check" and "check" in at:
            result.append(f)
        elif verb == "raise" and any(k in at for k in ("raise", "open", "min-raise")):
            result.append(f)
        elif verb == "call" and "call" in at:
            result.append(f)
        elif verb == "fold" and "fold" in at:
            result.append(f)
    return result


# ── Score + quality mapping ────────────────────────────────────────────────

_SEVERITY_BASE: dict[str, int] = {
    "good":      90,
    "note":      80,
    "suboptimal": 72,
    "mistake":   55,
}

def _severity_to_score(severity: str, action: HandAction, spot: SpotClassification) -> int:
    base = _SEVERITY_BASE.get(severity, 80)
    # Small deterministic context adjustment
    if action.street in ("flop", "turn") and spot.hero_is_ip and severity == "note":
        base = min(base + 2, 95)
    return max(0, min(100, base))


def _score_to_quality(score: int) -> str:
    if score >= 90: return "Elite"
    if score >= 80: return "Good"
    if score >= 65: return "Standard"
    if score >= 50: return "Mistake"
    return "Punt"


def _severity_to_mistake_level(severity: str) -> str:
    return {
        "good":       "None",
        "note":       "None",
        "suboptimal": "Minor",
        "mistake":    "Major",
    }.get(severity, "None")


# ── Strategy-deviation detection ──────────────────────────────────────────

class _Deviation:
    """Result of comparing actual action against primary strategic recommendation."""
    __slots__ = ("is_deviation", "penalty", "explanation", "adjustment")

    def __init__(
        self,
        is_deviation: bool = False,
        penalty: int = 0,
        explanation: str = "",
        adjustment: str = "",
    ):
        self.is_deviation = is_deviation
        self.penalty = penalty
        self.explanation = explanation
        self.adjustment = adjustment


# Confidence → penalty weight when actual action deviates from primary
_CONFIDENCE_PENALTY: dict[str, int] = {
    "high":   30,
    "medium": 18,
    "low":    8,
}


def _normalize_action_verb(action: str) -> str:
    """Collapse action strings to a comparable verb."""
    a = action.strip().lower()
    # "Bet 33%", "Bet 75%" → "bet"
    if a.startswith("bet"):
        return "bet"
    if a.startswith("raise"):
        return "raise"
    return a


def _compute_deviation(
    action: HandAction,
    options: list[StrategicOption],
) -> _Deviation:
    """
    Check whether the actual action deviates from the primary strategic
    recommendation.  Returns a _Deviation with the appropriate penalty.

    Rules:
      - If no options exist, no deviation.
      - Primary option (priority=1) is authoritative.
      - If actual action matches primary, no deviation.
      - If actual action matches a secondary/alternative, minor deviation.
      - If actual action matches nothing, full penalty scaled by confidence.
    """
    if not options:
        return _Deviation()

    primary = next((o for o in options if o.priority == 1), None)
    if primary is None:
        return _Deviation()

    actual_verb = _normalize_action_verb(action.action)
    primary_verb = _normalize_action_verb(primary.action)

    # Exact match with primary → no deviation
    if actual_verb == primary_verb:
        return _Deviation()

    # Check if actual matches any secondary/alternative option
    secondary_match = any(
        _normalize_action_verb(o.action) == actual_verb
        for o in options
        if o.priority > 1
    )

    base_penalty = _CONFIDENCE_PENALTY.get(primary.confidence, 18)

    if secondary_match:
        # Actual action is a recognized alternative — minor penalty
        penalty = max(4, base_penalty // 3)
        return _Deviation(
            is_deviation=True,
            penalty=penalty,
            explanation=(
                f"Your {action.action} is a recognized alternative, but the "
                f"primary strategic recommendation is {primary.action.lower()}. "
                f"{primary.reasoning}"
            ),
            adjustment=(
                f"Consider {primary.action.lower()} as the default line here. "
                f"{primary.reasoning}"
            ),
        )

    # Actual action is NOT any listed option — full penalty
    return _Deviation(
        is_deviation=True,
        penalty=base_penalty,
        explanation=(
            f"Your {action.action} deviates from the primary recommendation "
            f"({primary.action.lower()}). {primary.reasoning}"
        ),
        adjustment=(
            f"The strategically correct action here is to {primary.action.lower()}. "
            f"{primary.reasoning}"
        ),
    )


# ── Strategic options lookup ───────────────────────────────────────────────

def _strategic_options(
    action: HandAction,
    findings: list[HeuristicFinding],
    spot: SpotClassification,
    texture: BoardTexture,
    hand: ParsedHand,
    action_idx: int,
) -> list[StrategicOption]:
    street = action.street
    act = action.action
    bucket = texture.bucket
    is_pfr = spot.hero_is_pfr
    is_ip = spot.hero_is_ip
    severity = findings[0].severity if findings else None

    def so(a: str, p: int, reasoning: str, confidence: str = "medium") -> StrategicOption:
        return StrategicOption(action=a, priority=p, confidence=confidence, reasoning=reasoning)

    if street == "preflop":
        # Node-validated: derive strategic options from range recommendation
        node = detect_preflop_node(action_idx, hand.actions, hand.hero_position)
        rec = get_preflop_recommendation(node, act, hand.hero_cards)
        # Convert preflop alternatives to StrategicOption (no frequencies)
        options = []
        for i, pa in enumerate(rec.alternatives[:3], start=1):
            options.append(so(pa.action, i, rec.reasoning, rec.confidence.lower() if hasattr(rec.confidence, "lower") else "medium"))
        return options if options else [so(act.capitalize(), 1, rec.reasoning)]

    # ── Facing-bet detection ─────────────────────────────────────────────
    # Determine if hero faces a bet/raise on this street.  If not, fold is
    # never a valid primary recommendation — check/bet are the only options.
    facing_bet = _is_facing_bet(hand, action)

    # If hero folded facing no bet, always recommend Check as primary
    if act == "fold" and not facing_bet and street != "preflop":
        return [
            so("Check", 1,
               "No opponent bet to face — checking costs nothing and keeps you in the hand",
               "high"),
            so("Bet", 2,
               "Betting for value or as a bluff is also an option when not facing aggression"),
        ]

    # ── Postflop: made-hand-priority strategic options ─────────────────────
    made_category = _resolve_made_category(hand)
    is_overpair = _is_overpair(hand)
    is_mistake = severity in ("mistake", "suboptimal")
    is_strong_made = made_category >= 2 or is_overpair  # two pair+, OR overpair
    is_pair = made_category == 1 and not is_overpair

    if street == "flop":
        if act == "bet":
            return _flop_bet_options(so, bucket, is_pfr, is_ip, is_strong_made, is_mistake)
        if act == "check":
            return _flop_check_options(so, bucket, is_pfr, is_ip, is_strong_made)
        if act == "call":
            if is_strong_made:
                return [
                    so("Call", 1, "Strong made hands can continue calling for value"),
                    so("Raise", 2, "Raising strong hands for value and protection is also theoretically sound"),
                ]
            return [
                so("Call", 1, "Calling keeps you in the hand to realize equity"),
                so("Fold", 2, "Folding weak hands against strong bets preserves stack"),
            ]
        if act == "fold":
            if is_strong_made:
                return [
                    so("Call", 1, "Folding strong made hands is generally a significant error — continuing is correct", "high"),
                    so("Raise", 2, "Raising for value and protection is an alternative to calling"),
                ]
            return [
                so("Fold", 1, "Folding weak hands against strong bets is theoretically defensible"),
                so("Call", 2, "Calling can be correct with sufficient pot odds or draw potential"),
            ]

    elif street == "turn":
        if act == "bet":
            if is_strong_made:
                return [
                    so("Bet 75%", 1, "Strong made hands benefit from larger sizing to build the pot on the turn", "high"),
                    so("Bet 50%", 2, "Medium sizing balances between value extraction and keeping worse hands in"),
                    so("Check", 3, "Checking strong hands occasionally adds deception and range balance"),
                ]
            if is_pair:
                return [
                    so("Bet 50%", 1, "One-pair hands prefer smaller sizing to keep worse hands in while managing pot size"),
                    so("Check", 2, "Checking pairs on the turn controls pot size and protects against raises"),
                    so("Bet 75%", 3, "Larger sizing with pairs can work as protection but risks folding out dominated hands"),
                ]
            return [
                so("Check", 1, "Draws and weak hands generally prefer checking to realize equity cheaply"),
                so("Bet 50%", 2, "Semi-bluffing with draws is theoretically supported when fold equity is significant"),
                so("Bet 75%", 3, "Polar larger bets can work with strong draws but increase variance"),
            ]
        if act == "check":
            if is_strong_made and is_pfr and is_ip:
                return [
                    so("Bet 75%", 1, "IP PFR with a strong made hand generally prefers betting to build the pot", "high"),
                    so("Check", 2, "Checking strong hands occasionally is theoretically sound for balance"),
                ]
            return [
                so("Check", 1, "Checking is theoretically correct to control pot size and realize equity"),
                so("Bet 50%", 2, "Betting for value or protection is an alternative when board favors aggressor"),
            ]
        if act == "call":
            if is_strong_made:
                return [
                    so("Call", 1, "Continuing with strong hands against a turn bet is correct"),
                    so("Raise", 2, "Raising for value on the turn builds the pot with strong made hands"),
                ]
            return [
                so("Call", 1, "Calling with pot odds and equity justification is theoretically sound"),
                so("Fold", 2, "Folding marginal hands to pressure preserves stack for better spots"),
            ]
        if act == "fold":
            if is_strong_made:
                return [
                    so("Call", 1, "Folding strong made hands to a turn bet is generally a major error", "high"),
                    so("Raise", 2, "Raising is also an option with strong made hands on the turn"),
                ]
            return [
                so("Fold", 1, "Folding is theoretically defensible when pot odds don't justify continuing"),
                so("Call", 2, "Calling can be correct with strong draws or significant implied odds"),
            ]

    elif street == "river":
        if act == "bet":
            if is_strong_made:
                return [
                    so("Bet 75%", 1, "Strong made hands on the river prefer larger sizing to maximize value", "high"),
                    so("Bet 50%", 2, "Smaller river sizing can induce calls from a wider range of worse hands"),
                    so("Check", 3, "Checking strong hands adds balance and can induce bluffs"),
                ]
            return [
                so("Check", 1, "Weak hands and bluffs should generally check on the river to control pot size"),
                so("Bet 75%", 2, "Polar river bets with blockers can be theoretically justified as bluffs"),
            ]
        if act == "check":
            if is_strong_made and is_pfr and is_ip:
                return [
                    so("Bet 75%", 1, "IP PFR with a strong river hand generally prefers betting for maximum value", "high"),
                    so("Check", 2, "Checking strong hands occasionally for balance and to induce bluffs"),
                ]
            return [
                so("Check", 1, "Checking marginal hands on the river is often correct to avoid thin value"),
                so("Bet 75%", 2, "Betting for thin value or as a bluff is an alternative depending on range advantage"),
            ]
        if act == "call":
            if is_strong_made:
                return [
                    so("Call", 1, "Calling with strong hands is correct — avoid folding to river bets", "high"),
                    so("Fold", 2, "Folding is rarely correct with strong made hands on the river"),
                ]
            return [
                so("Fold", 1, "Folding weak hands on the river when pot odds don't justify calling is theoretically correct"),
                so("Call", 2, "Calling can be justified with enough pot odds relative to opponent's bluffing frequency"),
            ]
        if act == "fold":
            if is_strong_made:
                return [
                    so("Call", 1, "Folding strong made hands to a river bet is generally a major error", "high"),
                    so("Fold", 2, "Only fold strong hands when facing extreme bet sizes and opponent has a very narrow range"),
                ]
            return [
                so("Fold", 1, "Folding is theoretically correct when pot odds do not justify continuing"),
                so("Call", 2, "Calling is justified when opponent's bluffing range is wide enough"),
            ]

    return [so(act.capitalize(), 1, "Standard action for this spot")]


# ── Postflop alternative helpers ───────────────────────────────────────────

def _is_facing_bet(hand: ParsedHand, hero_action: HandAction) -> bool:
    """Return True if there is an outstanding bet/raise on this street before hero acts."""
    street_actions = [a for a in hand.actions if a.street == hero_action.street]
    for a in street_actions:
        if a is hero_action or (a.player == hero_action.player and a.is_hero == hero_action.is_hero):
            break  # reached hero's action — stop looking
        if a.action in ("bet", "raise"):
            return True
    return False


def _resolve_made_category(hand: ParsedHand) -> int:
    """Return made-hand category (0-8) for hero using available board cards."""
    try:
        from app.engines.hand_evaluator import evaluate_hole_and_board
        board = list(hand.board.flop)
        if hand.board.turn:
            board += list(hand.board.turn)
        if hand.board.river:
            board += list(hand.board.river)
        if hand.hero_cards and board:
            return evaluate_hole_and_board(hand.hero_cards, board).category
    except Exception:
        pass
    return 0


_RANK_ORDER = "23456789TJQKA"


def _is_overpair(hand: ParsedHand) -> bool:
    """Return True if hero holds a pocket pair higher than every board card.

    Overpairs (e.g. KK on J-7-2) are at the top of the one-pair range and
    should be treated as strong made hands for strategic-options purposes.
    """
    if not hand.hero_cards or len(hand.hero_cards) != 2:
        return False
    c1, c2 = hand.hero_cards[0], hand.hero_cards[1]
    if len(c1) < 2 or len(c2) < 2:
        return False
    r1, r2 = c1[0].upper(), c2[0].upper()
    if r1 != r2:
        return False  # not a pocket pair

    board = list(hand.board.flop)
    if hand.board.turn:
        board += list(hand.board.turn)
    if hand.board.river:
        board += list(hand.board.river)
    if not board:
        return False

    pair_rank = _RANK_ORDER.index(r1) if r1 in _RANK_ORDER else -1
    for card in board:
        if len(card) < 2:
            continue
        board_rank = _RANK_ORDER.index(card[0].upper()) if card[0].upper() in _RANK_ORDER else -1
        if board_rank >= pair_rank:
            return False  # board has a card as high or higher
    return True


def _flop_bet_options(
    so,
    bucket: str,
    is_pfr: bool,
    is_ip: bool,
    is_strong_made: bool,
    is_mistake: bool,
) -> list[StrategicOption]:
    """Node-aware flop bet strategic options. Sizing derived from texture + made-hand strength."""
    is_donk = not is_pfr and not is_ip  # OOP caller leading into PFR = donk

    if is_strong_made:
        if is_donk:
            return [
                so("Check", 1, "Donk-betting strong hands is often suboptimal — checking to induce PFR continuation or check-raise is stronger"),
                so("Bet 50%", 2, "If leading, medium sizing keeps the PFR's range wide enough to get value"),
                so("Bet 75%", 3, "Larger donk sizing risks folding out the PFR's weaker hands prematurely"),
            ]
        if bucket in ("A_high_dry", "K_high_dry"):
            return [
                so("Bet 33%", 1, "Small sizing on dry high-card boards is theoretically optimal — keeps opponent's range wide", "high"),
                so("Bet 50%", 2, "Medium sizing is also viable to build the pot with strong made hands"),
                so("Check", 3, "Checking occasionally maintains range balance and traps opponents"),
            ]
        if bucket in ("wet_broadway", "A_high_wet", "low_connected"):
            return [
                so("Bet 50%", 1, "Medium sizing on wet boards balances value and protection against draws"),
                so("Bet 75%", 2, "Larger sizing on draw-heavy boards charges opponents to continue with draws"),
                so("Check", 3, "Checking strong hands occasionally is correct for range balance on wet boards"),
            ]
        return [
            so("Bet 50%", 1, "Medium sizing is generally correct with strong made hands on this texture"),
            so("Bet 33%", 2, "Smaller sizing keeps a wider range of worse hands in"),
            so("Check", 3, "Checking is an option for deception and range balance"),
        ]

    # Weak made hand or draw
    if is_donk:
        return [
            so("Check", 1, "Donk-betting with weak hands or draws into the PFR is generally inadvisable — check is preferred"),
            so("Bet 33%", 2, "If leading with a draw, small sizing is the least costly option"),
        ]
    if bucket in ("A_high_dry", "K_high_dry"):
        if is_mistake:
            return [
                so("Bet 33%", 1, "Small sizing is the theoretically correct approach on dry boards when betting"),
                so("Check", 2, "Checking is also viable to realize equity cheaply on this dry texture"),
            ]
        return [
            so("Bet 33%", 1, "Small sizing on dry high-card boards is theoretically supported for the PFR", "high"),
            so("Bet 50%", 2, "Medium sizing is an alternative when board strongly favors PFR's range"),
            so("Check", 3, "Checking is correct to include in range for balance and equity realization"),
        ]
    if bucket in ("wet_broadway", "A_high_wet"):
        if is_mistake:
            return [
                so("Check", 1, "Checking is often preferable on wet boards with weak hands — avoid inflating the pot"),
                so("Bet 33%", 2, "Small sizing with draws or weak hands minimizes risk if betting"),
                so("Bet 50%", 3, "Medium sizing requires stronger hands to justify on draw-heavy boards"),
            ]
        return [
            so("Bet 33%", 1, "Small sizing with draws maintains good risk-reward ratio on wet boards"),
            so("Bet 50%", 2, "Medium sizing works when semi-bluffing with strong draws"),
            so("Check", 3, "Checking draws to realize equity freely is also theoretically correct"),
        ]
    if bucket in ("low_connected", "monotone"):
        return [
            so("Check", 1, "Checking is generally preferred on low-connected or monotone boards — these favor caller ranges"),
            so("Bet 33%", 2, "Small sizing is the least risky option if betting on this texture"),
            so("Bet 50%", 3, "Medium sizing requires strong equity advantage to justify on these boards"),
        ]
    return [
        so("Bet 33%", 1, "Small sizing is generally the default approach on this flop texture"),
        so("Bet 50%", 2, "Medium sizing works with stronger portions of range"),
        so("Check", 3, "Checking is correct for hands that prefer to realize equity passively"),
    ]


def _flop_check_options(
    so,
    bucket: str,
    is_pfr: bool,
    is_ip: bool,
    is_strong_made: bool,
) -> list[StrategicOption]:
    """Node-aware flop check strategic options."""
    if is_strong_made and is_pfr and is_ip:
        if bucket in ("A_high_dry", "K_high_dry"):
            return [
                so("Bet 33%", 1, "IP PFR with a strong hand on a dry board should generally bet small for value", "high"),
                so("Check", 2, "Checking strong hands occasionally maintains range balance and trapping potential"),
            ]
        return [
            so("Bet 50%", 1, "IP PFR with a strong made hand generally prefers betting on this texture"),
            so("Check", 2, "Checking is an option for deception and to balance the checking range"),
        ]
    if is_pfr and is_ip and bucket in ("A_high_dry", "K_high_dry"):
        return [
            so("Bet 33%", 1, "Small sizing on a dry board is theoretically correct for the IP PFR with range advantage", "high"),
            so("Check", 2, "Checking is a valid alternative to balance range and avoid being exploitable"),
        ]
    return [
        so("Check", 1, "Checking is theoretically correct here to realize equity and avoid bloating the pot"),
        so("Bet 33%", 2, "Small betting is an alternative when hand strength justifies continuation"),
    ]


# ── Reason codes ───────────────────────────────────────────────────────────

def _reason_codes(
    action: HandAction,
    findings: list[HeuristicFinding],
    spot: SpotClassification,
    texture: BoardTexture,
) -> list[str]:
    codes: list[str] = []

    # Range advantage (relative to hero role)
    if texture.range_advantage == "pfr" and spot.hero_is_pfr:
        codes.append("RANGE_ADVANTAGE")
    elif texture.range_advantage == "caller" and not spot.hero_is_pfr:
        codes.append("RANGE_ADVANTAGE")
    elif texture.range_advantage == "caller" and spot.hero_is_pfr:
        codes.append("RANGE_DISADVANTAGE")

    # Board texture
    if texture.wetness == "dry":
        codes.append("DRY_BOARD")
    elif texture.wetness == "wet":
        codes.append("WET_BOARD")

    if texture.suitedness == "monotone":
        codes.append("MONOTONE_BOARD")
    elif texture.suitedness == "two_tone":
        codes.append("FLUSH_DRAW_PRESENT")

    if texture.connectivity in ("connected", "oesd"):
        codes.append("STRAIGHT_DRAWS_PRESENT")

    if texture.is_paired:
        codes.append("PAIRED_BOARD")

    # Position + role
    codes.append("IN_POSITION" if spot.hero_is_ip else "OUT_OF_POSITION")
    codes.append("AGGRESSOR" if spot.hero_is_pfr else "CALLER")

    # From findings
    for f in findings:
        at = f.action_taken.lower()
        expl = (f.explanation or "").lower()
        if "large" in at or "over" in at:
            codes.append("OVER_SIZING")
        if "donk" in at:
            codes.append("DONK_BET")
        if "min-raise" in at or "min raise" in at:
            codes.append("MIN_RAISE")
        if "blocker" in expl:
            codes.append("BLOCKER_SPOT")

    return list(dict.fromkeys(codes))  # deduplicate, preserve order


# ── Default text ───────────────────────────────────────────────────────────

def _default_explanation(
    action: HandAction, spot: SpotClassification, texture: BoardTexture
) -> str:
    street = action.street
    act = action.action
    pfr_str = "the preflop aggressor" if spot.hero_is_pfr else "the caller"
    ip_str = "in position" if spot.hero_is_ip else "out of position"

    if street == "preflop":
        if act in ("raise", "bet"):
            return (
                "Your preflop sizing is within a reasonable range for this spot. "
                "Maintain consistent opens to avoid becoming exploitable."
            )
        if act == "call":
            return "Calling defends your range appropriately for this position and depth."
        return "Folding keeps you out of marginal spots outside your opening range."

    if street == "flop":
        bucket = texture.bucket.replace("_", "-")
        return (
            f"As {pfr_str}, {ip_str}, your action is consistent with a balanced "
            f"strategy on this {bucket} board."
        )

    if street == "turn":
        return (
            "Your turn action maintains a balanced range across value and protection. "
            "Keep sizing consistent with your flop line."
        )

    return (
        "River action. Your bluff-to-value ratio should account for opponent "
        "calling frequencies and blockers you hold."
    )


def _default_adjustment(
    action: HandAction, spot: SpotClassification, texture: BoardTexture
) -> str:
    street = action.street
    act = action.action

    if street == "preflop":
        if act in ("raise", "bet"):
            return "Use 2.5bb from late position, 3bb from early position as default sizing."
        return "Maintain a balanced defend/3bet range for your position."

    if street == "flop":
        if act == "bet":
            if texture.range_advantage == "pfr" and spot.hero_is_pfr:
                return "Range advantage supports a small sizing (25-33% pot) on this texture to keep opponent's range wide."
            return "Use 33-50% pot sizing to keep your range balanced across strong hands and bluffs."
        return "Include strong draws and weak made hands in your check range for balance."

    if street == "turn":
        return "Polar turn bets prefer 50-75% pot sizing. Check non-continuing hands to protect your range."

    return "River: pot-sized bluffs with blockers to the nuts; 50-75% pot for thin value."
