"""
Ethical safeguards — prevents unethical live assistance.

The platform is EDUCATIONAL. It must NEVER function as a real-time
assistance (RTA) tool for live online poker play.

Three enforcement layers:
  1. MODE GATING:    Only TRAINING and POST_SESSION modes allowed by default
  2. DELAY ENFORCEMENT: Configurable minimum delay before feedback delivery
  3. AUDIT TRAIL:    All analysis requests logged with compliance metadata

Compliance modes:
  TRAINING:     Private study — full live feedback, no restrictions
  OBSERVATION:  Watching play — minimum 30-second coaching delay
  POST_SESSION: After play ends — unlimited analysis, no live component
  LOCKED:       Compliance-critical — all realtime features disabled

Site-specific restrictions (configurable):
  Some poker sites have explicit policies against any form of assistance.
  The compliance layer can enforce per-site restrictions via config.
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum

logger = logging.getLogger(__name__)


class ComplianceMode(str, Enum):
    TRAINING = "training"           # Private study — full access
    OBSERVATION = "observation"     # Delayed coaching (30s minimum)
    POST_SESSION = "post_session"   # Post-play analysis only
    LOCKED = "locked"               # All realtime disabled


# Minimum delay (seconds) before coaching feedback in each mode
_MODE_DELAYS: dict[ComplianceMode, float] = {
    ComplianceMode.TRAINING: 0.0,       # No delay
    ComplianceMode.OBSERVATION: 30.0,   # 30-second delay
    ComplianceMode.POST_SESSION: 0.0,   # N/A — only post-session
    ComplianceMode.LOCKED: float("inf"),  # Never
}

# Sites with known policies against assistance
_RESTRICTED_SITES: set[str] = {
    # Add site identifiers as needed
    # "pokerstars_live",
    # "ggpoker_live",
}


@dataclass
class ComplianceConfig:
    """Per-user compliance configuration."""
    mode: ComplianceMode = ComplianceMode.TRAINING
    custom_delay_seconds: float | None = None  # Override default delay
    restricted_sites: set[str] = field(default_factory=set)
    audit_enabled: bool = True

    @property
    def effective_delay(self) -> float:
        if self.custom_delay_seconds is not None:
            return self.custom_delay_seconds
        return _MODE_DELAYS.get(self.mode, 30.0)


@dataclass
class ComplianceCheck:
    """Result of a compliance check."""
    allowed: bool
    reason: str
    delay_seconds: float = 0.0
    mode: ComplianceMode = ComplianceMode.TRAINING


class ComplianceGate:
    """
    Enforces ethical restrictions on realtime coaching.

    Every coaching request passes through this gate before delivery.
    """

    def __init__(self, config: ComplianceConfig | None = None) -> None:
        self._config = config or ComplianceConfig()
        self._audit_log: list[dict] = []

    @property
    def config(self) -> ComplianceConfig:
        return self._config

    def check_realtime_allowed(
        self,
        *,
        site: str = "",
        is_live_play: bool = False,
    ) -> ComplianceCheck:
        """
        Check if realtime coaching is allowed in the current context.

        Args:
            site: Poker site identifier (for per-site restrictions)
            is_live_play: Whether the user is currently playing live

        Returns:
            ComplianceCheck with allowed/denied and reason.
        """
        mode = self._config.mode

        # LOCKED mode: nothing allowed
        if mode == ComplianceMode.LOCKED:
            return ComplianceCheck(
                allowed=False,
                reason="Realtime features are disabled in locked mode",
                mode=mode,
            )

        # POST_SESSION: no live coaching
        if mode == ComplianceMode.POST_SESSION and is_live_play:
            return ComplianceCheck(
                allowed=False,
                reason="Live coaching disabled — switch to post-session mode",
                mode=mode,
            )

        # Site-specific restrictions
        if site and site in (_RESTRICTED_SITES | self._config.restricted_sites):
            return ComplianceCheck(
                allowed=False,
                reason=f"Realtime assistance restricted for site: {site}",
                mode=mode,
            )

        # OBSERVATION mode: allowed with delay
        if mode == ComplianceMode.OBSERVATION:
            return ComplianceCheck(
                allowed=True,
                reason="Allowed with delay (observation mode)",
                delay_seconds=self._config.effective_delay,
                mode=mode,
            )

        # TRAINING mode: fully allowed
        return ComplianceCheck(
            allowed=True,
            reason="Training mode — full access",
            delay_seconds=0.0,
            mode=mode,
        )

    def enforce_delay(self, check: ComplianceCheck) -> float:
        """
        Returns the number of seconds to wait before delivering coaching.

        Call this before sending any coaching output to the user.
        """
        return max(0.0, check.delay_seconds)

    def log_audit(
        self,
        user_id: str,
        action: str,
        check: ComplianceCheck,
        metadata: dict | None = None,
    ) -> None:
        """Log a compliance event for audit trail."""
        if not self._config.audit_enabled:
            return

        entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "user_id": user_id,
            "action": action,
            "mode": check.mode.value,
            "allowed": check.allowed,
            "delay_seconds": check.delay_seconds,
            "reason": check.reason,
            **(metadata or {}),
        }
        self._audit_log.append(entry)

        # Keep audit log bounded
        if len(self._audit_log) > 10000:
            self._audit_log = self._audit_log[-5000:]

        if not check.allowed:
            logger.warning("[Compliance] BLOCKED: %s — %s", action, check.reason)

    def get_audit_log(self, user_id: str | None = None, limit: int = 100) -> list[dict]:
        """Retrieve audit log entries."""
        entries = self._audit_log
        if user_id:
            entries = [e for e in entries if e.get("user_id") == user_id]
        return entries[-limit:]

    def update_mode(self, mode: ComplianceMode) -> None:
        """Change the compliance mode."""
        old = self._config.mode
        self._config.mode = mode
        logger.info("[Compliance] mode changed: %s → %s", old.value, mode.value)


# Default gate
_gate: ComplianceGate | None = None


def get_compliance_gate() -> ComplianceGate:
    global _gate
    if _gate is None:
        _gate = ComplianceGate()
    return _gate
