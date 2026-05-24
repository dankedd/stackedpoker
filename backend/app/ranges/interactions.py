"""
Range Interaction Engine.

Evaluates structural range dynamics on a given board.
Uses deterministic heuristics — no solver math, no equity simulation.

Output: RangeInteractionProfile — a strategic assessment of how two
preflop ranges interact with a specific board.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

from app.ranges.models import PreflopRange, RangeCombo, RANK_VAL, RANK_ORDER
from app.ranges.abstractions import is_capped, bucket_breakdown, HandBucket


DensityLabel = Literal["none", "low", "medium", "high", "very_high"]
AdvantageLabel = Literal["IP", "OOP", "NEUTRAL"]


# ── Result types ───────────────────────────────────────────────────────────────

@dataclass
class RangeMetrics:
    """
    Raw combo counts for a single range on a given board.
    All values are weighted combo counts (floats).
    """
    overpair_combos: float        # pairs above top board card
    set_combos: float             # pairs matching any board rank → flopped set
    top_pair_combos: float        # non-pairs containing the top board rank
    strong_top_pair_combos: float # top pair with kicker ≥ J (TPTK / TPGK quality)
    second_pair_combos: float     # non-pairs containing the second board rank
    two_pair_candidates: float    # contains 2 board ranks (approx)
    draw_density_est: float       # suited/connected combos (proxy for draw freq)
    broadway_density: float       # broadway cards in range (T+)
    nut_combos: float             # sets + overpairs (strongest made hands)


@dataclass
class RangeInteractionProfile:
    """
    Structural interaction summary for two ranges on a board.

    IP = in-position player (e.g., BTN in BTN vs BB spot)
    OOP = out-of-position player (e.g., BB)

    Phase 4 extensions add nut/air/two-pair densities, board pressure,
    strategic flags, and qualitative reasoning. All Phase 4 fields have
    defaults so existing construction calls remain unaffected.
    """

    # ── Core outputs (required) ───────────────────────────────────────────────
    range_advantage: AdvantageLabel       # who has more equity-rich combos
    nut_advantage: AdvantageLabel         # who has more nut-class hands
    ip_capped: bool                       # IP range missing premiums
    oop_capped: bool                      # OOP range missing premiums
    board_dynamic: bool                   # board likely to change range equities
    top_pair_density: dict[str, DensityLabel]   # {"IP": "high", "OOP": "medium"}
    overpair_density: dict[str, DensityLabel]
    set_density: dict[str, DensityLabel]
    draw_density: dict[str, DensityLabel]
    broadway_density: dict[str, DensityLabel]
    ip_metrics: RangeMetrics
    oop_metrics: RangeMetrics
    summary: str

    # ── Phase 4 extensions (optional, always populated by evaluators.py) ─────
    nut_density: dict[str, DensityLabel] = field(default_factory=dict)
    """Density of nut-class hands (sets + straights + strong two pair)."""

    two_pair_density: dict[str, DensityLabel] = field(default_factory=dict)
    """Density of two-pair holdings."""

    air_density: dict[str, DensityLabel] = field(default_factory=dict)
    """Density of complete board misses / pure bluffs."""

    board_pressure_profile: str = "neutral"
    """Strategic pressure label — who benefits from aggression on this texture."""

    strategic_flags: list[str] = field(default_factory=list)
    """
    Qualitative strategic tags, e.g.
      strong_range_advantage, nut_advantage_shift, capped_defender,
      dynamic_board, draw_heavy, high_bluff_pressure.
    """

    range_advantage_reason: str = ""
    """Short qualitative explanation of the range advantage verdict."""

    nut_advantage_reason: str = ""
    """Short qualitative explanation of the nut advantage verdict."""

    ip_position: str = ""
    """Canonical position of the IP player, e.g. 'BTN'."""

    oop_position: str = ""
    """Canonical position of the OOP player, e.g. 'BB'."""


# ── Engine ─────────────────────────────────────────────────────────────────────

class RangeInteractionEngine:
    """
    Evaluates two preflop ranges against a board.

    Usage:
        engine = RangeInteractionEngine()
        profile = engine.analyze(btn_range, bb_range, ["Ah", "Kd", "3c"])
    """

    def analyze(
        self,
        ip_range: PreflopRange,
        oop_range: PreflopRange,
        board: list[str],
    ) -> RangeInteractionProfile:
        """
        Produce a RangeInteractionProfile for two ranges on a board.

        ip_range:  In-position player's range (e.g., BTN open)
        oop_range: Out-of-position player's range (e.g., BB defend)
        board:     Board cards as strings ["Ah", "Kd", "3c"]
        """
        if not board:
            raise ValueError("Board must contain at least one card")

        board_ranks = _parse_board_ranks(board)
        board_suits = _parse_board_suits(board)

        ip_m  = _board_rank_metrics(ip_range, board)
        oop_m = _board_rank_metrics(oop_range, board)

        ip_cap  = is_capped(ip_range)
        oop_cap = is_capped(oop_range)

        dynamic = _is_board_dynamic(board_ranks, board_suits)

        range_adv = _determine_range_advantage(ip_m, oop_m, board_ranks, ip_range, oop_range)
        nut_adv   = _determine_nut_advantage(ip_m, oop_m)

        summary = _build_summary(
            range_adv, nut_adv, ip_cap, oop_cap, dynamic,
            ip_range.position, oop_range.position, board
        )

        return RangeInteractionProfile(
            range_advantage=range_adv,
            nut_advantage=nut_adv,
            ip_capped=ip_cap,
            oop_capped=oop_cap,
            board_dynamic=dynamic,
            top_pair_density={
                "IP":  _density_label(ip_m.top_pair_combos),
                "OOP": _density_label(oop_m.top_pair_combos),
            },
            overpair_density={
                "IP":  _density_label(ip_m.overpair_combos),
                "OOP": _density_label(oop_m.overpair_combos),
            },
            set_density={
                "IP":  _density_label(ip_m.set_combos),
                "OOP": _density_label(oop_m.set_combos),
            },
            draw_density={
                "IP":  _density_label(ip_m.draw_density_est),
                "OOP": _density_label(oop_m.draw_density_est),
            },
            broadway_density={
                "IP":  _density_label(ip_m.broadway_density),
                "OOP": _density_label(oop_m.broadway_density),
            },
            ip_metrics=ip_m,
            oop_metrics=oop_m,
            summary=summary,
        )


# ── Board parsing ──────────────────────────────────────────────────────────────

def _parse_board_ranks(board: list[str]) -> list[str]:
    """Extract ranks from board cards, sorted high→low."""
    ranks = [card[0].upper() for card in board]
    return sorted(ranks, key=lambda r: RANK_VAL.get(r, 0), reverse=True)


def _parse_board_suits(board: list[str]) -> list[str]:
    """Extract suits from board cards."""
    return [card[1].lower() for card in board if len(card) >= 2]


# ── Metrics computation ────────────────────────────────────────────────────────

def _board_rank_metrics(range_: PreflopRange, board: list[str]) -> RangeMetrics:
    """
    Compute structural metrics for a range against board cards.

    All outputs are weighted combo counts.
    """
    board_ranks = _parse_board_ranks(board)
    board_rank_set = set(board_ranks)
    top_rank = board_ranks[0] if board_ranks else "A"
    top_rank_val = RANK_VAL.get(top_rank, 12)

    overpair        = 0.0
    sets            = 0.0
    top_pair        = 0.0
    strong_top_pair = 0.0
    second_pair     = 0.0
    two_pair_c      = 0.0
    draw_est        = 0.0
    broadway        = 0.0

    second_rank = board_ranks[1] if len(board_ranks) > 1 else None

    for combo in range_.combos:
        w = combo.combo_count
        if w <= 0:
            continue

        r1 = combo.hand[0].upper()
        # Second rank: char at index 1 unless it's 's'/'o'
        r2_char = combo.hand[1].upper() if len(combo.hand) > 1 else None
        r2 = r2_char if r2_char and r2_char in RANK_VAL else None

        # Broadway count
        if r1 in ("T", "J", "Q", "K", "A"):
            broadway += w
        elif r2 and r2 in ("T", "J", "Q", "K", "A"):
            broadway += w * 0.5

        # Pocket pair logic
        if combo.pocket_pair:
            pair_val = RANK_VAL.get(r1, 0)
            if pair_val > top_rank_val:
                overpair += w
            elif r1 in board_rank_set:
                sets += w
        else:
            # Draw density: suited connectors contribute
            if combo.suited:
                draw_est += w * 0.6  # proxy — suited hands can make flushes
            if r2:
                # One-gappers and connectors add straight draw potential
                gap = abs(RANK_VAL.get(r1, 0) - RANK_VAL.get(r2, 0))
                if gap <= 2:
                    draw_est += w * 0.3

            # Top pair and second pair
            has_top    = (r1 == top_rank) or (r2 == top_rank)
            has_second = second_rank and ((r1 == second_rank) or (r2 == second_rank))

            if has_top:
                top_pair += w
                # Strong top pair: kicker is J or better (TPTK / TPGK)
                kicker = r2 if r1 == top_rank else r1
                if kicker and RANK_VAL.get(kicker, 0) >= 9:  # J or higher
                    strong_top_pair += w
            elif has_second:
                second_pair += w

            # Two pair candidate: hand contains two board ranks
            board_rank_hits = sum(
                1 for r in (r1, r2) if r and r in board_rank_set
            )
            if board_rank_hits >= 2:
                two_pair_c += w

    nut_combos = overpair + sets + top_pair * 0.3  # rough nut estimate

    return RangeMetrics(
        overpair_combos=overpair,
        set_combos=sets,
        top_pair_combos=top_pair,
        strong_top_pair_combos=strong_top_pair,
        second_pair_combos=second_pair,
        two_pair_candidates=two_pair_c,
        draw_density_est=draw_est,
        broadway_density=broadway,
        nut_combos=nut_combos,
    )


# ── Advantage heuristics ───────────────────────────────────────────────────────

def _determine_range_advantage(
    ip_m: RangeMetrics,
    oop_m: RangeMetrics,
    board_ranks: list[str],
    ip_range: PreflopRange,
    oop_range: PreflopRange,
) -> AdvantageLabel:
    """
    Determine which range has overall structural advantage on this board.

    Heuristics:
    - On A/K high boards: IP range (openers) typically have more strong
      Ax/Kx combos with better kickers.
    - On low connected boards: OOP defend ranges have more small pairs
      and suited connectors that connect.
    - Broadway density advantage → range advantage on high boards.
    - On paired/static boards: overpair advantage is decisive.
    """
    top_rank = board_ranks[0] if board_ranks else "A"
    top_val  = RANK_VAL.get(top_rank, 12)

    ip_score  = 0
    oop_score = 0

    # ── Strong top pair (TPTK / TPGK quality) — most decisive on high boards ──
    # On A/K high boards, opener ranges have far more strong-kicker Ax/Kx hands.
    # BB defend ranges have many weak-kicker Ax (A2-A7) reducing quality.
    if ip_m.strong_top_pair_combos > oop_m.strong_top_pair_combos * 1.5:
        ip_score += 3
    elif oop_m.strong_top_pair_combos > ip_m.strong_top_pair_combos * 1.5:
        oop_score += 3
    elif ip_m.strong_top_pair_combos > oop_m.strong_top_pair_combos + 5:
        ip_score += 2
    elif oop_m.strong_top_pair_combos > ip_m.strong_top_pair_combos + 5:
        oop_score += 2

    # ── Total top pair volume ─────────────────────────────────────────────────
    if ip_m.top_pair_combos > oop_m.top_pair_combos * 1.4:
        ip_score += 1
    elif oop_m.top_pair_combos > ip_m.top_pair_combos * 1.4:
        oop_score += 1

    # ── Overpair advantage ────────────────────────────────────────────────────
    if ip_m.overpair_combos > oop_m.overpair_combos * 1.2:
        ip_score += 1
    elif oop_m.overpair_combos > ip_m.overpair_combos * 1.2:
        oop_score += 1

    # ── Low boards (top card ≤ 8 = "9 or below"): OOP structural boost ───────
    # BB defend ranges have more small pairs and suited connectors
    # that connect directly on 9-8-7, 6-5-4 type boards.
    if top_val <= 7:  # 9 or below
        oop_score += 2

    # ── Set density ───────────────────────────────────────────────────────────
    if ip_m.set_combos > oop_m.set_combos + 2:
        ip_score += 1
    elif oop_m.set_combos > ip_m.set_combos + 2:
        oop_score += 1

    if ip_score > oop_score + 1:
        return "IP"
    if oop_score > ip_score + 1:
        return "OOP"
    return "NEUTRAL"


def _determine_nut_advantage(
    ip_m: RangeMetrics,
    oop_m: RangeMetrics,
) -> AdvantageLabel:
    """
    Determine nut advantage: who has more set/overpair class hands.

    Sets and overpairs dominate the nut portion of most boards.
    """
    ip_nuts  = ip_m.nut_combos
    oop_nuts = oop_m.nut_combos

    if ip_nuts > oop_nuts * 1.4:
        return "IP"
    if oop_nuts > ip_nuts * 1.4:
        return "OOP"
    return "NEUTRAL"


def _is_board_dynamic(board_ranks: list[str], board_suits: list[str]) -> bool:
    """
    Simple heuristic for board dynamism.

    Dynamic boards: flush draws present, connected ranks, low/middle cards.
    Static boards: ace-high rainbow disconnected.
    """
    if not board_ranks:
        return False

    # Flush draw: ≥ 2 cards of same suit on flop
    from collections import Counter
    suit_counts = Counter(board_suits)
    if max(suit_counts.values(), default=0) >= 2:
        return True

    # Connected ranks
    if len(board_ranks) >= 2:
        vals = sorted([RANK_VAL.get(r, 0) for r in board_ranks], reverse=True)
        if vals[0] - vals[-1] <= 4:  # all within 4 ranks of each other
            return True

    # Low board (top card ≤ 9) = generally dynamic
    top_val = RANK_VAL.get(board_ranks[0], 12)
    if top_val <= 7:
        return True

    return False


# ── Density labeling ───────────────────────────────────────────────────────────

def _density_label(combos: float) -> DensityLabel:
    """Convert weighted combo count to a readable density label."""
    if combos <= 0:
        return "none"
    if combos < 4:
        return "low"
    if combos < 10:
        return "medium"
    if combos < 20:
        return "high"
    return "very_high"


# ── Summary builder ────────────────────────────────────────────────────────────

def _build_summary(
    range_adv: AdvantageLabel,
    nut_adv: AdvantageLabel,
    ip_capped: bool,
    oop_capped: bool,
    dynamic: bool,
    ip_pos: str,
    oop_pos: str,
    board: list[str],
) -> str:
    board_str = " ".join(board)
    parts: list[str] = [f"Board: {board_str}."]

    adv_map = {"IP": ip_pos, "OOP": oop_pos, "NEUTRAL": "Neither side"}
    parts.append(f"Range advantage: {adv_map[range_adv]}.")
    parts.append(f"Nut advantage: {adv_map[nut_adv]}.")

    if ip_capped:
        parts.append(f"{ip_pos} range appears capped (few premiums).")
    if oop_capped:
        parts.append(f"{oop_pos} range appears capped (few premiums).")

    parts.append("Dynamic board." if dynamic else "Static board.")
    return " ".join(parts)
