"""
Safety and grounding — prevents hallucinated strategy and ensures trust.

Three pillars:
  1. GROUNDING: LLM claims must be traceable to context data
  2. CALIBRATION: Confidence communicated honestly (no fake precision)
  3. CONSISTENCY: Same spot → same advice across sessions

Checks run on LLM output BEFORE returning to user.
Violations are logged, and the output is sanitized or replaced.
"""

from __future__ import annotations

import logging
import re

logger = logging.getLogger(__name__)

# ── Forbidden patterns ────────────────────────────────────────────────────
# LLM output matching these patterns gets flagged and sanitized.

# Fake precision: "67.3% of the time", "EV is +2.34bb"
_FAKE_FREQUENCY_PATTERN = re.compile(
    r"\b\d{2,3}\.\d+\s*%",  # "67.3%", "42.1%"
)
_FAKE_EV_PATTERN = re.compile(
    r"[+-]?\d+\.\d{2,}\s*bb",  # "+2.34bb", "-0.47bb"
    re.IGNORECASE,
)

# Absolute solver claims without grounding
_UNGROUNDED_CLAIMS = [
    "the solver says",
    "solver output shows",
    "according to the solver",
    "GTO solution is",
    "optimal frequency is",
    "equilibrium strategy is",
]


def check_output(reply: str, context_has_solver: bool = False) -> tuple[str, list[str]]:
    """
    Validate and sanitize LLM output.

    Returns:
        (sanitized_reply, list_of_warnings)
    """
    warnings: list[str] = []
    sanitized = reply

    # Check for fake frequencies
    if _FAKE_FREQUENCY_PATTERN.search(sanitized):
        if not context_has_solver:
            warnings.append("fake_frequency_detected")
            # Replace specific percentages with directional language
            sanitized = _FAKE_FREQUENCY_PATTERN.sub("frequently", sanitized)
            logger.warning("[Safety] Sanitized fake frequency in output")

    # Check for fake EV values
    if _FAKE_EV_PATTERN.search(sanitized):
        if not context_has_solver:
            warnings.append("fake_ev_detected")
            sanitized = _FAKE_EV_PATTERN.sub("some EV", sanitized)
            logger.warning("[Safety] Sanitized fake EV in output")

    # Check for ungrounded solver claims
    reply_lower = sanitized.lower()
    for claim in _UNGROUNDED_CLAIMS:
        if claim in reply_lower and not context_has_solver:
            warnings.append("ungrounded_solver_claim")
            logger.warning("[Safety] Ungrounded solver claim: '%s'", claim)
            break

    # Length guard: truncate excessively long responses
    if len(sanitized) > 2000:
        sanitized = sanitized[:1997] + "..."
        warnings.append("truncated_long_response")

    return sanitized, warnings


def confidence_disclaimer(solver_confidence: float) -> str:
    """
    Generate appropriate confidence disclaimer for coaching output.

    High confidence (>0.7): no disclaimer needed
    Medium (0.4-0.7): "Based on approximate strategy data..."
    Low (<0.4): "This is general theory — no solver data available for this exact spot."
    """
    if solver_confidence >= 0.7:
        return ""
    if solver_confidence >= 0.4:
        return (
            "Note: This advice is based on approximate strategy data for similar spots. "
            "The exact frequencies may differ."
        )
    return (
        "Note: No solver data is available for this exact spot. "
        "This advice is based on general GTO principles."
    )


def validate_exploit_recommendation(
    recommendation: str,
    confidence: float,
    sample_size: int,
) -> tuple[bool, str]:
    """
    Gate exploitative advice behind safety thresholds.

    Returns (is_safe, reason).
    """
    if confidence < 0.80:
        return False, "Confidence too low for exploit recommendation"
    if sample_size < 50:
        return False, f"Sample size too small ({sample_size} < 50 minimum)"
    return True, "Passes safety checks"
