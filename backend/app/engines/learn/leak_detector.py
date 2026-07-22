"""Detect poker leaks from analysis findings and lesson errors, write to user_leaks."""

import logging
from dataclasses import dataclass
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

# Maps coaching_tags from concepts to leak_type labels
FINDING_TO_LEAK: dict[str, tuple[str, str]] = {
    "fold_too_much":       ("mdf",            "underfold"),
    "mdf_defense":         ("mdf",            "underfold"),
    "bluff_breakeven":     ("alpha",          "over_bluff"),
    "bluff_sizing":        ("alpha",          "over_bluff"),
    "range_advantage":     ("range_advantage","ignore_range_adv"),
    "nut_advantage":       ("nut_advantage",  "ignore_nut_adv"),
    "cbet_theory":         ("cbet_theory",    "cbet_leak"),
    "equity_realization":  ("equity_real",    "poor_equity_real"),
    "spr_theory":          ("spr_theory",     "spr_misapply"),
    "blocker_effects":     ("blockers",       "ignore_blockers"),
    "polarized_betting":   ("polarized",      "range_construction"),
    "pot_odds":            ("pot_odds",       "pot_odds_error"),
    # Foundations Module 2 — The Math Behind Every Decision
    "drawing_probability":       ("drawing_probability", "drawing_math_error"),
    "clean_outs":                ("clean_outs",           "drawing_math_error"),
    "dead_outs":                 ("dead_outs",            "drawing_math_error"),
    "decision_quality":          ("decision_quality",     "outcome_bias"),
    "expected_value":            ("expected_value",       "ev_reasoning_error"),
    "fold_equity":               ("fold_equity",           "underestimate_fold_equity"),
    "semi_bluff":                ("fold_equity",           "underestimate_fold_equity"),
    "equity_realization":        ("equity_realization",   "poor_equity_realization"),
    "position_realization":      ("equity_realization",   "ignore_position_in_eqr"),
    "suitedness_realization":    ("equity_realization",   "ignore_suitedness"),
    "connectedness_realization": ("equity_realization",   "ignore_connectedness"),
    "range_advantage_realization": ("equity_realization", "ignore_range_advantage"),
    "spr_realization":           ("equity_realization",   "ignore_spr"),
}

@dataclass
class LeakUpdate:
    concept_id: str
    node_type: str
    leak_type: str
    severity: str

def _severity(ev_loss_bb: float, quality: str) -> str:
    if quality == "punt" or ev_loss_bb >= 1.5:
        return "severe"
    if quality == "mistake" or ev_loss_bb >= 0.5:
        return "moderate"
    return "mild"

def detect_leaks_from_step(
    concept_ids: list[str],
    quality: str,
    ev_loss_bb: float,
    node_type: str = "unknown",
) -> list[LeakUpdate]:
    """Given a wrong step answer, generate leak updates for each relevant concept."""
    if quality in ("perfect", "good"):
        return []

    leaks = []
    for cid in concept_ids:
        leak_type = FINDING_TO_LEAK.get(cid, (cid, "general_error"))[1]
        severity = _severity(ev_loss_bb, quality)
        leaks.append(LeakUpdate(
            concept_id=cid,
            node_type=node_type,
            leak_type=leak_type,
            severity=severity,
        ))
    return leaks

def detect_leaks_from_analysis_findings(findings: list[dict]) -> list[LeakUpdate]:
    """Extract leaks from hand analysis heuristic findings."""
    leaks = []
    for f in findings:
        quality = f.get("quality", "good")
        if quality not in ("mistake", "punt", "suboptimal"):
            continue
        coaching_tags = f.get("coaching_tags", [])
        ev_loss = f.get("ev_loss_bb", 0.0) or 0.0
        node_type = f.get("node_type", "unknown")

        for tag in coaching_tags:
            if tag in FINDING_TO_LEAK:
                cid, ltype = FINDING_TO_LEAK[tag]
                leaks.append(LeakUpdate(
                    concept_id=cid,
                    node_type=node_type,
                    leak_type=ltype,
                    severity=_severity(ev_loss, quality),
                ))
    return leaks
