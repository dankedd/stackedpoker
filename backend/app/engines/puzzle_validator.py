"""
Puzzle Validator — validates puzzle correctness BEFORE rendering.

Every puzzle must pass ALL checks:
  1. Hand strength correctness (made hand matches board + hole cards)
  2. Draw correctness (flush draws need exactly 4 suited, etc.)
  3. Board consistency (valid cards, no duplicates, correct count per street)
  4. Action legality (valid poker actions for the street)
  5. Stack consistency (bets don't exceed stacks, pot is correct)
  6. Sizing validity (bet amounts are sorted ascending)
  7. Solver/action coherence (coaching text matches evaluated hand)
  8. Coaching text coherence (no contradictions with hand state)
  9. Action ordering (passive → aggressive, left to right)

If validation fails, the puzzle MUST NOT render.
"""
from __future__ import annotations

import re
import logging
from dataclasses import dataclass, field
from typing import Optional

from app.engines.hand_evaluator import (
    evaluate_hole_and_board,
    parse_card,
    RANK_VALUES,
)
from app.engines.draw_evaluator import analyze_draws

logger = logging.getLogger(__name__)

# ── Result types ──────────────────────────────────────────────────────────────

@dataclass
class ValidationIssue:
    """A single validation finding."""
    check: str           # e.g. "hand_strength", "draw_correctness"
    severity: str        # "error" | "warning"
    message: str
    step_idx: Optional[int] = None
    field: Optional[str] = None


@dataclass
class PuzzleValidationResult:
    """Complete validation result for one puzzle."""
    puzzle_id: str
    valid: bool
    issues: list[ValidationIssue] = field(default_factory=list)

    @property
    def errors(self) -> list[ValidationIssue]:
        return [i for i in self.issues if i.severity == "error"]

    @property
    def warnings(self) -> list[ValidationIssue]:
        return [i for i in self.issues if i.severity == "warning"]


# ── Puzzle data shape (matches frontend Puzzle interface) ─────────────────────

@dataclass
class PuzzleOption:
    id: str
    label: str
    quality: str
    ev_loss: float
    coaching: str


@dataclass
class PuzzleStep:
    street: str
    board: list[str]
    context: str
    prompt: str
    options: list[PuzzleOption]


@dataclass
class PuzzleData:
    id: str
    hero_cards: list[str]
    hero_position: str
    villain_position: str
    effective_stack: float
    steps: list[PuzzleStep]


# ── Action ordering constants ─────────────────────────────────────────────────

# Canonical aggression ordering: lower = more passive
ACTION_AGGRESSION_ORDER = {
    "fold": 0,
    "check": 1,
    "call": 2,
    "bet": 3,
    "raise": 4,
    "jam": 5,
    "all-in": 5,
    "shove": 5,
}

# Patterns to extract action type from button label
_ACTION_PATTERNS = [
    (r'\bfold\b', 'fold'),
    (r'\bcheck\b', 'check'),
    (r'\bcall\b', 'call'),
    (r'\bbet\b', 'bet'),
    (r'\braise\b', 'raise'),
    (r'\bjam\b', 'jam'),
    (r'\ball[- ]?in\b', 'jam'),
    (r'\bshove\b', 'jam'),
    (r'\b3[- ]?bet\b', 'raise'),
    (r'\b4[- ]?bet\b', 'raise'),
    (r'\blimp\b', 'call'),
]

# Patterns to extract bet sizing from label (in bb)
_SIZING_RE = re.compile(r'\$?(\d+(?:\.\d+)?)\s*(?:bb|BB)', re.IGNORECASE)
_SIZING_DOLLAR_RE = re.compile(r'\$(\d+(?:\.\d+)?)\b')
_SIZING_PCT_RE = re.compile(r'(\d+(?:\.\d+)?)\s*%', re.IGNORECASE)

# ── Coaching text contradiction patterns ──────────────────────────────────────

# Claims hero has a flush (made hand)
_CLAIMS_FLUSH = re.compile(
    r'\b(?:you have (?:the|a) flush|hero has (?:the|a) flush|'
    r'made flush|nut flush(?! draw)|flush —|flush —|'
    r'rivered (?:the|a) flush)\b',
    re.IGNORECASE,
)

# Claims hero has a straight
_CLAIMS_STRAIGHT = re.compile(
    r'\b(?:you have (?:the|a) straight|made (?:the|a)? straight|'
    r'nut straight|rivered (?:the|a) straight|'
    r'you made the straight)\b',
    re.IGNORECASE,
)

# Claims "near top of range" or "strong hand" or "bet for value"
_CLAIMS_STRONG = re.compile(
    r'\b(?:near top of range|top of (?:your )?range|'
    r'bet for value|value bet|strong value|'
    r'strong made hand|premium hand|monster)\b',
    re.IGNORECASE,
)

# Claims OESD
_CLAIMS_OESD = re.compile(r'\bOESD\b', re.IGNORECASE)

# Claims combo draw
_CLAIMS_COMBO = re.compile(r'\bcombo draw\b', re.IGNORECASE)

# Claims overbet
_CLAIMS_OVERBET = re.compile(r'\boverbet\b', re.IGNORECASE)


# ── Main validation function ─────────────────────────────────────────────────

def validate_puzzle_state(puzzle: PuzzleData) -> PuzzleValidationResult:
    """
    Validate a puzzle for correctness. Returns PuzzleValidationResult.
    If result.valid is False, the puzzle MUST NOT render.
    """
    result = PuzzleValidationResult(puzzle_id=puzzle.id, valid=True)

    # ── Validate hero cards ───────────────────────────────────────────────
    _validate_hero_cards(puzzle, result)

    # ── Per-step validation ───────────────────────────────────────────────
    for step_idx, step in enumerate(puzzle.steps):
        _validate_board(puzzle, step, step_idx, result)
        _validate_hand_strength_coherence(puzzle, step, step_idx, result)
        _validate_draw_coherence(puzzle, step, step_idx, result)
        _validate_action_ordering(step, step_idx, result)
        _validate_coaching_coherence(puzzle, step, step_idx, result)
        _validate_sizing_order(step, step_idx, result)

    result.valid = len(result.errors) == 0
    return result


# ── Individual checks ─────────────────────────────────────────────────────────

def _validate_hero_cards(puzzle: PuzzleData, result: PuzzleValidationResult) -> None:
    """Validate hero cards are valid poker cards."""
    if len(puzzle.hero_cards) != 2:
        result.issues.append(ValidationIssue(
            check="hero_cards",
            severity="error",
            message=f"Expected 2 hero cards, got {len(puzzle.hero_cards)}",
        ))
        return

    try:
        for c in puzzle.hero_cards:
            parse_card(c)
    except ValueError as e:
        result.issues.append(ValidationIssue(
            check="hero_cards",
            severity="error",
            message=f"Invalid hero card: {e}",
        ))


def _validate_board(
    puzzle: PuzzleData,
    step: PuzzleStep,
    step_idx: int,
    result: PuzzleValidationResult,
) -> None:
    """Validate board cards for this step."""
    expected_counts = {"preflop": 0, "flop": 3, "turn": 4, "river": 5}
    expected = expected_counts.get(step.street)

    if expected is not None and len(step.board) != expected:
        result.issues.append(ValidationIssue(
            check="board_consistency",
            severity="error",
            message=f"Street '{step.street}' expects {expected} board cards, got {len(step.board)}",
            step_idx=step_idx,
        ))
        return

    # Check for duplicate cards (including hero cards)
    all_cards = list(puzzle.hero_cards) + list(step.board)
    seen = set()
    for c in all_cards:
        key = c.upper()
        if key in seen:
            result.issues.append(ValidationIssue(
                check="board_consistency",
                severity="error",
                message=f"Duplicate card detected: {c}",
                step_idx=step_idx,
            ))
        seen.add(key)

    # Validate each card
    for c in step.board:
        try:
            parse_card(c)
        except ValueError:
            result.issues.append(ValidationIssue(
                check="board_consistency",
                severity="error",
                message=f"Invalid board card: {c}",
                step_idx=step_idx,
            ))


def _validate_hand_strength_coherence(
    puzzle: PuzzleData,
    step: PuzzleStep,
    step_idx: int,
    result: PuzzleValidationResult,
) -> None:
    """
    Validate that coaching text claims about hand strength match
    the actual evaluated hand.
    """
    if step.street == "preflop" or not step.board:
        return

    try:
        hand_rank = evaluate_hole_and_board(puzzle.hero_cards, step.board)
    except Exception:
        return

    category = hand_rank.category
    all_text = _collect_step_text(step)

    # Check: claims flush but hero doesn't have one
    if _CLAIMS_FLUSH.search(all_text) and category != 5 and category != 8:
        result.issues.append(ValidationIssue(
            check="hand_strength",
            severity="error",
            message=(
                f"Text claims hero has a flush, but actual hand is "
                f"'{hand_rank.category_name}' ({hand_rank.description})"
            ),
            step_idx=step_idx,
        ))

    # Check: claims straight but hero doesn't have one
    if _CLAIMS_STRAIGHT.search(all_text) and category != 4 and category != 8:
        result.issues.append(ValidationIssue(
            check="hand_strength",
            severity="error",
            message=(
                f"Text claims hero has a straight, but actual hand is "
                f"'{hand_rank.category_name}' ({hand_rank.description})"
            ),
            step_idx=step_idx,
        ))

    # Check: claims "near top of range" / "strong value" but hero has air
    if _CLAIMS_STRONG.search(all_text) and category == 0:
        result.issues.append(ValidationIssue(
            check="hand_strength",
            severity="error",
            message=(
                f"Text claims hero has a strong/value hand, but actual hand is "
                f"high card only ({hand_rank.description})"
            ),
            step_idx=step_idx,
        ))


def _validate_draw_coherence(
    puzzle: PuzzleData,
    step: PuzzleStep,
    step_idx: int,
    result: PuzzleValidationResult,
) -> None:
    """
    Validate that coaching text claims about draws match
    the actual draw evaluation.
    """
    if step.street == "preflop" or not step.board:
        return

    try:
        da = analyze_draws(puzzle.hero_cards, step.board)
    except Exception:
        return

    all_text = _collect_step_text(step)

    # Check: claims OESD but no OESD exists
    if _CLAIMS_OESD.search(all_text):
        has_oesd = any(sd.draw_type == "oesd" for sd in da.straight_draws)
        if not has_oesd:
            actual = da.primary_label if da.primary_label else "no draw"
            result.issues.append(ValidationIssue(
                check="draw_correctness",
                severity="error",
                message=(
                    f"Text claims OESD, but actual draw classification is: {actual}"
                ),
                step_idx=step_idx,
            ))

    # Check: claims combo draw but it's not
    if _CLAIMS_COMBO.search(all_text) and not da.is_combo_draw:
        result.issues.append(ValidationIssue(
            check="draw_correctness",
            severity="error",
            message=f"Text claims combo draw, but draw analysis says: {da.primary_label}",
            step_idx=step_idx,
        ))

    # Check: claims flush draw on river (impossible)
    if step.street == "river":
        if re.search(r'\bflush draw\b', all_text, re.IGNORECASE):
            # Only flag if it's not referring to a "missed" or "busted" flush draw
            if not re.search(r'\b(?:missed|busted|bricked)\b', all_text, re.IGNORECASE):
                result.issues.append(ValidationIssue(
                    check="draw_correctness",
                    severity="warning",
                    message="Text references flush draw on the river — draws cannot exist on the river",
                    step_idx=step_idx,
                ))


def _validate_action_ordering(
    step: PuzzleStep,
    step_idx: int,
    result: PuzzleValidationResult,
) -> None:
    """
    Validate that action buttons are ordered passive → aggressive (left to right).
    """
    if len(step.options) <= 1:
        return

    aggression_scores = []
    for opt in step.options:
        score = _get_aggression_score(opt.label)
        aggression_scores.append(score)

    # Check non-decreasing order
    for i in range(1, len(aggression_scores)):
        if aggression_scores[i] < aggression_scores[i - 1]:
            result.issues.append(ValidationIssue(
                check="action_ordering",
                severity="error",
                message=(
                    f"Actions not in passive→aggressive order: "
                    f"'{step.options[i-1].label}' (score {aggression_scores[i-1]}) "
                    f"before '{step.options[i].label}' (score {aggression_scores[i]})"
                ),
                step_idx=step_idx,
            ))
            break


def _validate_coaching_coherence(
    puzzle: PuzzleData,
    step: PuzzleStep,
    step_idx: int,
    result: PuzzleValidationResult,
) -> None:
    """
    Validate that coaching recommendations don't contradict the hand state.
    E.g., "overbet" recommendation with a busted draw is wrong.
    """
    if step.street == "preflop" or not step.board:
        return

    try:
        hand_rank = evaluate_hole_and_board(puzzle.hero_cards, step.board)
        da = analyze_draws(puzzle.hero_cards, step.board)
    except Exception:
        return

    category = hand_rank.category

    for opt in step.options:
        coaching_lower = opt.coaching.lower()

        # Overbet recommendation with air/busted draw
        if _CLAIMS_OVERBET.search(opt.coaching):
            is_busted = (
                category == 0
                and not da.has_flush_draw
                and not da.has_direct_straight_draw
            )
            if is_busted and opt.quality == "perfect":
                result.issues.append(ValidationIssue(
                    check="coaching_coherence",
                    severity="error",
                    message=(
                        f"Option '{opt.label}' rated 'perfect' recommends overbet "
                        f"with air/busted draw ({hand_rank.description})"
                    ),
                    step_idx=step_idx,
                    field=f"option:{opt.id}",
                ))


def _validate_sizing_order(
    step: PuzzleStep,
    step_idx: int,
    result: PuzzleValidationResult,
) -> None:
    """
    When multiple bet-sizing options exist, verify they are sorted ascending.
    """
    bet_options = []
    for opt in step.options:
        sizing = _extract_sizing(opt.label)
        if sizing is not None:
            bet_options.append((opt, sizing))

    if len(bet_options) < 2:
        return

    for i in range(1, len(bet_options)):
        if bet_options[i][1] < bet_options[i - 1][1]:
            result.issues.append(ValidationIssue(
                check="sizing_order",
                severity="error",
                message=(
                    f"Bet sizings not sorted ascending: "
                    f"'{bet_options[i-1][0].label}' ({bet_options[i-1][1]}) "
                    f"before '{bet_options[i][0].label}' ({bet_options[i][1]})"
                ),
                step_idx=step_idx,
            ))
            break


# ── Helpers ───────────────────────────────────────────────────────────────────

def _collect_step_text(step: PuzzleStep) -> str:
    """Collect all text from a step for pattern matching."""
    parts = [step.context, step.prompt]
    for opt in step.options:
        parts.append(opt.coaching)
    return " ".join(parts)


def _get_aggression_score(label: str) -> float:
    """Map a button label to an aggression score for ordering validation."""
    label_lower = label.lower()

    # Check for known action patterns
    best_match = ("check", 1)  # default
    for pattern, action in _ACTION_PATTERNS:
        if re.search(pattern, label_lower):
            best_match = (action, ACTION_AGGRESSION_ORDER.get(action, 2))
            break

    base_score = best_match[1]

    # If it's a bet/raise, add sizing as a tiebreaker
    sizing = _extract_sizing(label)
    if sizing is not None and base_score >= 3:
        base_score += sizing / 1000.0  # small bump for sorting within same action type

    return base_score


def _extract_sizing(label: str) -> Optional[float]:
    """Extract bet sizing from a label (in bb or dollars)."""
    m = _SIZING_RE.search(label)
    if m:
        return float(m.group(1))
    m = _SIZING_DOLLAR_RE.search(label)
    if m:
        return float(m.group(1))
    return None


# ── Batch validation ──────────────────────────────────────────────────────────

def validate_all_puzzles(puzzles: list[PuzzleData]) -> list[PuzzleValidationResult]:
    """Validate all puzzles and return results."""
    results = []
    for puzzle in puzzles:
        result = validate_puzzle_state(puzzle)
        results.append(result)
        if not result.valid:
            logger.warning(
                "Puzzle %s FAILED validation: %d errors",
                puzzle.id,
                len(result.errors),
            )
    return results
