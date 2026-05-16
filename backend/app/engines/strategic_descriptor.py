"""
Strategic Descriptor — Human-quality poker situation descriptions.

Generates accurate, context-aware descriptions that combine:
  - Draw classification (from draw_evaluator)
  - Board texture (from board_texture)
  - Position
  - Stack depth
  - Initiative (PFR vs caller)
  - SPR (stack-to-pot ratio)

Design rules:
  1. NEVER produce a description that contradicts the draw classification.
  2. Backdoor draws are ALWAYS labeled "backdoor", never as direct draws.
  3. Descriptions reference specific cards (e.g., "9h8h on A72r").
  4. Use precise poker vocabulary: OESD, gutshot, DBB, NFD, combo draw.
  5. Unknown/uncertain classifications produce neutral wording.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Sequence

from app.engines.draw_evaluator import DrawAnalysis
from app.engines.outs_engine import OutsResult, outs_summary


@dataclass
class StrategicDescription:
    """Full strategic description of a hero's situation."""
    # Core description (matches draw classification exactly)
    hand_description: str          # e.g. "9h8h on A72r — 9-high with backdoor draws only"
    draw_summary: str              # e.g. "Backdoor flush (hearts) + backdoor straight (runner-runner)"
    equity_context: str            # e.g. "~4% equity (backdoor only) — primarily a bluff-catcher"
    strategic_label: str           # e.g. "OESD" or "Double gutshot" or "Backdoor potential"
    recommendation: str            # short strategic note
    full_description: str          # complete paragraph combining all of the above


def describe_situation(
    hole_cards: Sequence[str],
    board_cards: Sequence[str],
    draw_analysis: DrawAnalysis,
    outs_result: OutsResult,
    position: str = "",
    is_ip: bool = True,
    is_pfr: bool = False,
    effective_stack_bb: float = 100.0,
    pot_bb: float = 0.0,
) -> StrategicDescription:
    """
    Generate a complete strategic description matching the draw analysis.

    All labels are derived from `draw_analysis` — never invented independently.
    """
    hand_str = _format_hand(hole_cards, board_cards)
    draw_sum = _build_draw_summary(draw_analysis)
    equity_ctx = _build_equity_context(draw_analysis, outs_result)
    label = _derive_strategic_label(draw_analysis)
    rec = _build_recommendation(draw_analysis, is_ip, is_pfr, pot_bb, effective_stack_bb)
    full = _assemble_full_description(
        hand_str, draw_sum, equity_ctx, rec, draw_analysis, position, is_ip, effective_stack_bb, pot_bb
    )

    return StrategicDescription(
        hand_description=hand_str,
        draw_summary=draw_sum,
        equity_context=equity_ctx,
        strategic_label=label,
        recommendation=rec,
        full_description=full,
    )


# ── Component builders ─────────────────────────────────────────────────────────

def _format_hand(hole_cards: Sequence[str], board_cards: Sequence[str]) -> str:
    """Format e.g. '9h8h on Ah7d2s'."""
    hole_str = "".join(hole_cards)
    board_str = "".join(board_cards) if board_cards else "(no board)"
    return f"{hole_str} on {board_str}"


def _build_draw_summary(da: DrawAnalysis) -> str:
    """Build accurate draw summary strictly from classification results."""
    parts: list[str] = []

    # Made hand context
    if da.has_pair_or_better:
        parts.append(da.made_hand_description)

    # Direct draws
    if da.is_combo_draw:
        flush_part = next(
            (f.description for f in da.flush_draws if f.draw_type == "flush_draw"), ""
        )
        str_part = next(
            (s.description for s in da.straight_draws
             if s.draw_type in ("oesd", "double_gutter", "gutshot")), ""
        )
        if flush_part and str_part:
            parts.append(f"Combo draw: {flush_part} + {str_part}")
    elif da.has_flush_draw:
        fd = next(f for f in da.flush_draws if f.draw_type == "flush_draw")
        parts.append(fd.description)
    elif da.has_direct_straight_draw:
        for sd in da.straight_draws:
            if sd.draw_type in ("oesd", "double_gutter", "gutshot"):
                parts.append(sd.description)

    # Backdoor draws (only if no direct draws)
    if not da.has_flush_draw and da.has_backdoor_flush:
        fd = next(f for f in da.flush_draws if f.draw_type == "backdoor_flush")
        parts.append(fd.description)

    if not da.has_direct_straight_draw and da.has_backdoor_straight:
        for sd in da.straight_draws:
            if sd.draw_type == "backdoor_straight":
                parts.append(sd.description)

    if not parts:
        if da.made_hand_category in ("high_card",):
            return "No draw — high card only"
        return da.made_hand_description

    return " | ".join(parts)


def _build_equity_context(da: DrawAnalysis, outs: OutsResult) -> str:
    """Build equity context string matched to draw type."""
    if da.street == "river":
        return "River — hand is complete, no outs remaining"

    total = outs.total_outs

    if total > 0:
        equity_str = outs_summary(outs)
        if da.is_combo_draw:
            return f"Strong combo draw: {equity_str}"
        if da.has_flush_draw:
            return f"Flush draw equity: {equity_str}"
        if da.has_direct_straight_draw:
            best = next(
                (s for s in da.straight_draws
                 if s.draw_type in ("oesd", "double_gutter", "gutshot")), None
            )
            if best:
                dtype = best.draw_type.replace("_", " ").title()
                return f"{dtype}: {equity_str}"

    # Backdoor only
    bd_parts = []
    if outs.backdoor_flush_equity_pct:
        bd_parts.append(f"~{outs.backdoor_flush_equity_pct:.1f}% backdoor flush equity")
    if outs.backdoor_straight_equity_pct:
        bd_parts.append(f"~{outs.backdoor_straight_equity_pct:.1f}% backdoor straight equity")

    if bd_parts:
        total_bd = outs.backdoor_flush_equity_pct + outs.backdoor_straight_equity_pct
        return (
            f"Backdoor only: {' + '.join(bd_parts)} = ~{total_bd:.1f}% total "
            f"(runner-runner, not a direct draw)"
        )

    if da.has_pair_or_better:
        return f"Made hand: {da.made_hand_description}"

    return "No significant equity — high card only"


def _derive_strategic_label(da: DrawAnalysis) -> str:
    """
    Single most accurate label for this draw situation.
    This is the label that would appear in coaching text.
    """
    if da.is_combo_draw:
        flush_suits = [f.suit.upper() for f in da.flush_draws if f.draw_type == "flush_draw"]
        direct_str = next(
            (s for s in da.straight_draws if s.draw_type in ("oesd", "double_gutter", "gutshot")),
            None,
        )
        if direct_str:
            str_label = {
                "oesd": "OESD",
                "double_gutter": "double gutshot",
                "gutshot": "gutshot",
            }.get(direct_str.draw_type, direct_str.draw_type)
            return f"Combo draw ({str_label} + flush draw)"
        return "Combo draw (flush + straight)"

    if da.has_flush_draw:
        return "Flush draw"

    if da.has_direct_straight_draw:
        direct = next(
            (s for s in da.straight_draws if s.draw_type in ("oesd", "double_gutter", "gutshot")),
            None,
        )
        if direct:
            return {
                "oesd": "OESD",
                "double_gutter": "Double gutshot (DBB)",
                "gutshot": "Gutshot",
            }.get(direct.draw_type, direct.draw_type)

    # Backdoor — must never be labeled as a direct draw
    backdoor_parts = []
    if da.has_backdoor_flush:
        backdoor_parts.append("backdoor flush")
    if da.has_backdoor_straight:
        backdoor_parts.append("backdoor straight")
    if backdoor_parts:
        return "Backdoor potential (" + " + ".join(backdoor_parts) + ")"

    if da.has_pair_or_better:
        return da.made_hand_category.replace("_", " ").title()

    return "No draw — high card"


def _build_recommendation(
    da: DrawAnalysis,
    is_ip: bool,
    is_pfr: bool,
    pot_bb: float,
    stack_bb: float,
) -> str:
    """Generate short, actionable recommendation based on draw type."""
    spr = round(stack_bb / pot_bb, 1) if pot_bb > 0 else 99.0
    pos_str = "IP" if is_ip else "OOP"
    role_str = "PFR" if is_pfr else "caller"

    if da.is_combo_draw:
        outs_est = da.primary_outs
        if outs_est >= 12:
            return (
                f"{pos_str} combo draw with {outs_est}+ outs. "
                f"Strong semi-bluff candidate. {'Check-raise' if not is_ip else 'Bet'} for maximum EV."
            )
        return (
            f"{pos_str} combo draw. Semi-bluff with pot equity — "
            f"{'Check-raise' if not is_ip else 'bet'} to leverage fold equity and draw value."
        )

    if da.has_flush_draw and not da.has_direct_straight_draw:
        return (
            f"Flush draw {pos_str}. "
            f"{'Call or semi-bluff-raise' if not is_ip else 'Bet or call'} "
            f"based on stack depth (SPR ~{spr})."
        )

    if da.has_direct_straight_draw:
        direct = next(
            s for s in da.straight_draws
            if s.draw_type in ("oesd", "double_gutter", "gutshot")
        )
        label = {
            "oesd": "OESD (8 outs)",
            "double_gutter": "double gutshot (8 outs)",
            "gutshot": "gutshot (4 outs)",
        }.get(direct.draw_type, direct.draw_type)

        if direct.draw_type in ("oesd", "double_gutter"):
            return (
                f"{label} {pos_str}. Semi-bluff value is high — "
                f"{'check-raise or lead' if not is_ip else 'bet or float'}."
            )
        return (
            f"{label} {pos_str}. Only 4 outs (~8% turn equity). "
            f"Call at the right price; avoid over-investing."
        )

    # Backdoor — critical: must advise conservatively
    if da.has_backdoor_flush or da.has_backdoor_straight:
        return (
            f"Backdoor draws only {pos_str}. "
            f"No immediate equity — check OOP, take free cards IP. "
            f"Do NOT invest chips as if you have a real draw."
        )

    return f"No draws. Play based on made hand strength ({da.made_hand_description})."


def _assemble_full_description(
    hand_str: str,
    draw_sum: str,
    equity_ctx: str,
    rec: str,
    da: DrawAnalysis,
    position: str,
    is_ip: bool,
    stack_bb: float,
    pot_bb: float,
) -> str:
    """Combine all components into a single coaching paragraph."""
    pos_label = position or ("IP" if is_ip else "OOP")
    stack_label = (
        "deep" if stack_bb >= 100
        else "medium" if stack_bb >= 50
        else "short"
    )
    street = da.street.title()

    # Confidence warning
    conf_note = ""
    if da.confidence < 0.75:
        conf_note = " [Analysis confidence reduced — board complicates draw picture.]"

    return (
        f"{hand_str} ({pos_label}, {stack_label} stack, {street}). "
        f"{draw_sum}. "
        f"{equity_ctx}. "
        f"{rec}"
        f"{conf_note}"
    )
