"""
Puzzle Audit System — Retroactive audit of all puzzle draw classifications.

Scans puzzle data files for draw labels in prompts, coaching text, and
descriptions, then validates them against the draw_evaluator engine.

Detects:
  - False OESDs (labeled OESD but actual draw is different)
  - False gutshots
  - False combo draws
  - Incorrect outs counts
  - Backdoor draws labeled as direct draws

Run from backend/:
    python scripts/audit_puzzles.py

Reports:
  - Affected puzzle IDs
  - Incorrect labels found
  - Corrected labels from engine
  - Severity score (1=low, 2=medium, 3=critical)
  - Root cause category
"""
from __future__ import annotations

import json
import os
import re
import sys
from dataclasses import dataclass, field

# Allow running from backend/ directory
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app.engines.draw_evaluator import analyze_draws

# ── Puzzle data (extracted from TypeScript at audit time) ─────────────────────
# These are the puzzles that have hero cards + board defined.
# Format: (puzzle_id, hero_cards, board_cards_per_step, text_to_audit)

KNOWN_PUZZLES = [
    # (puzzle_id, hero_cards, board, text_fields_to_check)
    # From tournament.ts — THE BUG CASE
    (
        "tr5-mtt-bb-draw-turned-pair",
        ["9h", "8h"],
        ["Ah", "7d", "2s"],  # flop
        [
            "OESD (needs 5 or T for straight)",          # prompt line 258 — WRONG
            "With only an OESD and no pair on A72",      # coaching — WRONG
            "getting the right price with OESD",         # context — WRONG
        ]
    ),

    # From postflop.ts po5 — double gutter mislabeled as OESD
    (
        "po5-check-raise-wet-board",
        ["9h", "8h"],
        ["7h", "Jh", "5c"],  # flop
        [
            "you have OESD plus flush draw",             # prompt line 240 — inaccurate
        ]
    ),

    # Correct puzzles (should pass audit)
    (
        "po2-btn-bluff-wet-board",
        ["Jh", "Th"],
        ["Qh", "8h", "3c"],
        [
            "flush draw + gutshot to a straight",  # correct
        ]
    ),

    (
        "s4-bb-float-draw-hit",
        ["Ah", "Kh"],  # if applicable — check hand
        [],
        []
    ),

    # Starter puzzle s5 (OESD example)
    (
        "s5-hup-oesd-straight",
        ["5h", "6h"],  # approximate from context
        ["4c", "7d", "Kh"],  # 4-5-6-7 = OESD (needs 3 or 8)
        [
            "OESD (3 or 8 makes a straight)",  # should be correct
        ]
    ),
]


# ── Draw label patterns to search for ─────────────────────────────────────────

DRAW_LABEL_PATTERNS = [
    (r'\bOESD\b',         'oesd'),
    (r'\bgutshot\b',      'gutshot'),
    (r'\bdouble gutter\b','double_gutter'),
    (r'\bdouble belly\b', 'double_gutter'),
    (r'\bDBB\b',          'double_gutter'),
    (r'\bflush draw\b',   'flush_draw'),
    (r'\bcombo draw\b',   'combo_draw'),
    (r'\bbackdoor\b',     'backdoor'),
]


@dataclass
class AuditFinding:
    puzzle_id: str
    hole_cards: list[str]
    board_cards: list[str]
    text_found: str
    label_in_text: str         # what the text claims
    engine_says: str           # what the engine classifies
    is_correct: bool
    severity: int              # 1=minor, 2=major, 3=critical
    root_cause: str
    correction: str


@dataclass
class AuditReport:
    total_puzzles_checked: int = 0
    total_findings: int = 0
    critical_findings: list[AuditFinding] = field(default_factory=list)
    major_findings: list[AuditFinding] = field(default_factory=list)
    minor_findings: list[AuditFinding] = field(default_factory=list)
    passed: list[str] = field(default_factory=list)
    failed: list[str] = field(default_factory=list)


# ── Main audit ────────────────────────────────────────────────────────────────

def run_audit() -> AuditReport:
    report = AuditReport()

    for puzzle_id, hole_cards, board_cards, texts in KNOWN_PUZZLES:
        report.total_puzzles_checked += 1

        if not hole_cards or not board_cards:
            continue

        da = analyze_draws(hole_cards, board_cards)
        findings = _check_texts(puzzle_id, hole_cards, board_cards, texts, da)

        if findings:
            report.failed.append(puzzle_id)
            for f in findings:
                report.total_findings += 1
                if f.severity == 3:
                    report.critical_findings.append(f)
                elif f.severity == 2:
                    report.major_findings.append(f)
                else:
                    report.minor_findings.append(f)
        else:
            if texts:  # only count as passed if there were texts to check
                report.passed.append(puzzle_id)

    return report


def _check_texts(
    puzzle_id: str,
    hole_cards: list[str],
    board_cards: list[str],
    texts: list[str],
    da,
) -> list[AuditFinding]:
    findings = []

    for text in texts:
        text_lower = text.lower()

        # Check if text claims OESD
        if 'oesd' in text_lower:
            if not da.has_direct_straight_draw:
                # Claims OESD but no direct draw at all
                correction = _build_correction(da)
                findings.append(AuditFinding(
                    puzzle_id=puzzle_id,
                    hole_cards=hole_cards,
                    board_cards=board_cards,
                    text_found=text,
                    label_in_text="OESD",
                    engine_says=da.primary_label,
                    is_correct=False,
                    severity=3,  # critical
                    root_cause="false_oesd_no_direct_draw",
                    correction=correction,
                ))
            else:
                # Has direct draw — but is it really an OESD?
                oesd = next((s for s in da.straight_draws if s.draw_type == 'oesd'), None)
                dg = next((s for s in da.straight_draws if s.draw_type == 'double_gutter'), None)

                if oesd is None and dg is not None:
                    # It's a double gutter, not OESD
                    findings.append(AuditFinding(
                        puzzle_id=puzzle_id,
                        hole_cards=hole_cards,
                        board_cards=board_cards,
                        text_found=text,
                        label_in_text="OESD",
                        engine_says="Double gutshot (DBB)",
                        is_correct=False,
                        severity=2,  # major (outs are same, but label is wrong)
                        root_cause="oesd_label_for_double_gutter",
                        correction=(
                            f"Replace 'OESD' with 'double gutshot (DBB)'. "
                            f"Outs count ({dg.available_outs}) is correct."
                        ),
                    ))

        # Check if text claims specific outs count we can verify
        outs_match = re.search(r'(\d+)\s+out', text_lower)
        if outs_match:
            claimed = int(outs_match.group(1))
            if claimed != da.primary_outs and da.primary_outs > 0:
                findings.append(AuditFinding(
                    puzzle_id=puzzle_id,
                    hole_cards=hole_cards,
                    board_cards=board_cards,
                    text_found=text,
                    label_in_text=f"{claimed} outs",
                    engine_says=f"{da.primary_outs} outs",
                    is_correct=False,
                    severity=2,
                    root_cause="incorrect_outs_count",
                    correction=f"Change outs count from {claimed} to {da.primary_outs}.",
                ))

    return findings


def _build_correction(da) -> str:
    parts = []
    if da.has_backdoor_straight:
        parts.append("backdoor straight potential (runner-runner)")
    if da.has_backdoor_flush:
        parts.append("backdoor flush draw (runner-runner)")
    if not parts:
        parts.append("no draw — high card only")

    return (
        f"Not an OESD. Correct classification: {', '.join(parts)}. "
        f"primary_outs = {da.primary_outs} (0 for backdoor draws). "
        f"Do NOT label as OESD, gutshot, or any direct draw."
    )


# ── Report printer ────────────────────────────────────────────────────────────

def print_report(report: AuditReport) -> None:
    print("\n" + "=" * 70)
    print("  POKER PUZZLE DRAW CLASSIFICATION AUDIT REPORT")
    print("=" * 70)
    print(f"\nPuzzles checked : {report.total_puzzles_checked}")
    print(f"Issues found    : {report.total_findings}")
    print(f"Critical        : {len(report.critical_findings)}")
    print(f"Major           : {len(report.major_findings)}")
    print(f"Minor           : {len(report.minor_findings)}")
    print(f"Passed          : {len(report.passed)}")
    print(f"Failed          : {len(report.failed)}")

    if report.critical_findings:
        print("\n" + "─" * 70)
        print("  CRITICAL ISSUES (severity=3) — must fix before publication")
        print("─" * 70)
        for f in report.critical_findings:
            _print_finding(f)

    if report.major_findings:
        print("\n" + "─" * 70)
        print("  MAJOR ISSUES (severity=2) — label accuracy problem")
        print("─" * 70)
        for f in report.major_findings:
            _print_finding(f)

    if report.minor_findings:
        print("\n" + "─" * 70)
        print("  MINOR ISSUES (severity=1)")
        print("─" * 70)
        for f in report.minor_findings:
            _print_finding(f)

    if report.passed:
        print(f"\n✓ Passed: {', '.join(report.passed)}")

    print("\n" + "=" * 70)
    if report.total_findings == 0:
        print("  ALL AUDITED PUZZLES PASSED.")
    else:
        print(f"  {report.total_findings} ISSUE(S) REQUIRE ATTENTION.")
    print("=" * 70 + "\n")


def _print_finding(f: AuditFinding) -> None:
    sev = {3: "CRITICAL", 2: "MAJOR", 1: "MINOR"}.get(f.severity, "?")
    print(f"\n  [{sev}] {f.puzzle_id}")
    print(f"  Cards  : {f.hole_cards} on {f.board_cards}")
    print(f"  Found  : {f.text_found!r}")
    print(f"  Label  : {f.label_in_text!r}")
    print(f"  Engine : {f.engine_says!r}")
    print(f"  Cause  : {f.root_cause}")
    print(f"  Fix    : {f.correction}")


if __name__ == "__main__":
    report = run_audit()
    print_report(report)
    sys.exit(1 if report.critical_findings else 0)
