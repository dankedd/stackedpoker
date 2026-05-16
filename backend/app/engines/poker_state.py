"""
Canonical PokerState — single source of truth for all analysis engines.

Every downstream system (coaching, scoring, heuristics, replay, AI) reads
from ONE authoritative state object.  No engine re-derives game facts.

Design rules:
  - Built ONCE at the start of `analyse_hand()`.
  - Immutable after construction (use @dataclass frozen=False but treat as read-only).
  - All fields are validated on build(); invalid hands produce is_valid=False.
  - Every field is documented so the AI prompt can reference it verbatim.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Optional

from app.models.schemas import ParsedHand, HandAction

_log = logging.getLogger(__name__)

# ── Relative hand strength labels ──────────────────────────────────────────

RELATIVE_STRENGTH_LABELS = [
    "nut",          # absolute nuts on this board
    "near_nut",     # top 2-3 combos
    "strong",       # two pair+, strong flush, nut straight
    "overpair",     # pocket pair above all board ranks
    "tptk",         # top pair, top kicker
    "tpgk",         # top pair, good kicker (A/K but not best)
    "tp_weak",      # top pair, weak kicker
    "middle_pair",  # paired with middle board card
    "bottom_pair",  # paired with lowest board card
    "underpair",    # pocket pair below lowest board rank
    "air",          # no pair, no draw, no showdown value
    "draw_only",    # no made hand, relies on draw equity
    "unknown",      # cannot determine
]

# ── Primary coaching priority labels ───────────────────────────────────────
# These drive what coaching says FIRST about the hand.
# Made hand ALWAYS takes priority over draw labels when category >= 1.

PRIMARY_LABEL_PRIORITY = {
    # Strong made hands — always lead coaching
    "straight_flush": 100,
    "quads":          95,
    "full_house":     90,
    "flush":          85,
    "straight":       80,
    "set":            75,
    "two_pair":       70,
    "overpair":       65,
    "tptk":           60,
    "tpgk":           55,
    "tp_weak":        50,
    "middle_pair":    45,
    "underpair":      40,
    "bottom_pair":    35,
    # Draw labels — only lead when made_hand_category == 0
    "combo_draw":     30,
    "flush_draw":     25,
    "oesd":           20,
    "double_gutter":  18,
    "gutshot":        15,
    "backdoor":       10,
    "air":             5,
    "unknown":         0,
}


@dataclass
class HandStrengthState:
    """
    Priority-ordered hand strength snapshot for a single street.

    Rule: made_hand_category >= 1 (pair or better) ALWAYS takes precedence
    over any draw label.  Draws are secondary information only.
    """
    # ── Made hand (PRIORITY 1) ─────────────────────────────────────────────
    made_hand_category: int     # 0-8 from hand_evaluator
    made_hand_label: str        # "high_card" | "pair" | ... | "straight_flush"
    made_hand_description: str  # "Pair of Jacks" / "Two Pair, Aces and Kings"

    # ── Relative strength (PRIORITY 2) ────────────────────────────────────
    relative_strength: str      # one of RELATIVE_STRENGTH_LABELS
    showdown_value: int         # 0-100 quantified

    # ── Nuttedness (PRIORITY 3) ────────────────────────────────────────────
    is_nut: bool = False
    is_near_nut: bool = False

    # ── Draws (SECONDARY — only primary when made_hand_category == 0) ─────
    has_direct_draw: bool = False
    draw_type: Optional[str] = None    # "flush_draw" | "oesd" | "gutshot" | etc.
    draw_outs: int = 0
    draw_equity_pct: float = 0.0
    has_backdoor_only: bool = False
    is_combo_draw: bool = False

    # ── Blockers (informational) ───────────────────────────────────────────
    blocks_nut_flush: bool = False
    blocks_top_straight: bool = False

    # ── Primary coaching label ─────────────────────────────────────────────
    # Derived automatically — never set manually.
    # Reflects what the coach should lead with.
    primary_label: str = "unknown"
    primary_reasoning: str = ""

    @property
    def is_strong_made_hand(self) -> bool:
        """Pair or better with decent strength — draws are secondary."""
        return (
            self.made_hand_category >= 2  # two pair or better
            or self.relative_strength in ("overpair", "tptk", "tpgk", "set", "near_nut", "nut")
        )

    @property
    def draw_is_primary(self) -> bool:
        """True only when hero has no made hand and relies on draw equity."""
        return self.made_hand_category == 0 and self.has_direct_draw

    @property
    def is_vulnerable_made_hand(self) -> bool:
        """Strong made hand but can be outdrawn (e.g., overpair vs flush draw board)."""
        return (
            self.is_strong_made_hand
            and self.made_hand_category < 5  # not flush or better
        )


@dataclass
class PokerState:
    """
    Single source of truth for every analysis engine.

    Build with PokerState.build(hand) once, then pass through the pipeline.
    All fields are validated; is_valid=False blocks coaching output.
    """

    # ── Game metadata ──────────────────────────────────────────────────────
    site: str
    hand_id: str
    stakes: str
    big_blind: float

    # ── Street & board ─────────────────────────────────────────────────────
    current_street: str          # "preflop" | "flop" | "turn" | "river"
    board_cards: list[str]       # all board cards to current street
    pot_bb: float                # total pot in BB at end of hand
    spr: float                   # stack-to-pot ratio at start of postflop

    # ── Position truth ─────────────────────────────────────────────────────
    hero_position: str           # "BTN" | "CO" | "SB" | "BB" | etc.
    hero_is_ip: bool             # True = acts LAST postflop (IP = in position)
    hero_is_pfr: bool            # True = hero was last preflop raiser
    hero_stack_bb: float
    effective_stack_bb: float    # min(hero_stack, villain_stack)

    # ── Hero cards ─────────────────────────────────────────────────────────
    hero_cards: list[str]        # e.g. ["Ah", "Kd"]
    hand_strength: Optional[HandStrengthState]  # None if no board yet

    # ── Node ───────────────────────────────────────────────────────────────
    node_id: str                 # e.g. "BTN_RFI_100bb"
    node_type: str               # "RFI" | "VS_OPEN" | "IP_PFR_CBET" | etc.
    legal_actions: frozenset[str]
    pot_type: str                # "SRP" | "3bet" | "4bet"
    last_aggressor: str          # player name of last raiser

    # ── Active players ─────────────────────────────────────────────────────
    active_player_count: int
    hero_vs_villain_positions: str   # e.g. "BTN_vs_BB"

    # ── Validation ─────────────────────────────────────────────────────────
    is_valid: bool
    confidence: float            # 0.0-1.0
    validation_warnings: list[str] = field(default_factory=list)
    validation_errors: list[str] = field(default_factory=list)

    # ── Debug / diagnostics ────────────────────────────────────────────────
    debug_notes: list[str] = field(default_factory=list)

    @classmethod
    def build(cls, hand: ParsedHand, hero_is_ip: bool, hero_is_pfr: bool) -> "PokerState":
        """
        Factory: build from ParsedHand + pre-computed IP/PFR flags.

        Call once at the start of analyse_hand().  All engines receive this object.
        """
        warnings: list[str] = []
        errors: list[str] = []
        debug: list[str] = []

        # ── Validate cards ─────────────────────────────────────────────────
        if not hand.hero_cards:
            warnings.append("Hero cards unknown — hand strength unavailable")
        elif len(hand.hero_cards) != 2:
            errors.append(f"Expected 2 hero cards, got {len(hand.hero_cards)}")

        # ── Determine current street ───────────────────────────────────────
        streets_played: list[str] = []
        for s in ("preflop", "flop", "turn", "river"):
            if any(a.street == s for a in hand.actions):
                streets_played.append(s)
        current_street = streets_played[-1] if streets_played else "preflop"

        board_cards: list[str] = list(hand.board.flop)
        if hand.board.turn:
            board_cards += list(hand.board.turn)
        if hand.board.river:
            board_cards += list(hand.board.river)

        # ── Compute hand strength ──────────────────────────────────────────
        hand_strength: Optional[HandStrengthState] = None
        if hand.hero_cards and board_cards:
            try:
                hand_strength = _compute_hand_strength(hand.hero_cards, board_cards)
                debug.append(
                    f"HandStrength: category={hand_strength.made_hand_category} "
                    f"rel={hand_strength.relative_strength} "
                    f"label={hand_strength.primary_label}"
                )
            except Exception as exc:
                warnings.append(f"Hand strength computation failed: {exc}")
                _log.warning("HandStrength error: %s", exc)

        # ── Pot / SPR ──────────────────────────────────────────────────────
        pot_bb = hand.pot_size_bb
        eff_stack = hand.effective_stack_bb
        # SPR at start of postflop (approximate: effective stack / pot after preflop)
        preflop_pot = _estimate_pot_after_preflop(hand)
        spr = (eff_stack / preflop_pot) if preflop_pot > 0 else 0.0

        # ── Node detection ─────────────────────────────────────────────────
        node_type, node_id, legal_actions = _detect_node(hand, current_street, hero_is_ip, hero_is_pfr)
        pot_type = _detect_pot_type(hand.actions)
        last_aggressor = _find_last_aggressor(hand.actions, current_street)

        # ── Hero stack ─────────────────────────────────────────────────────
        hero_player = next((p for p in hand.players if p.name == hand.hero_name), None)
        hero_stack_bb = (hero_player.stack_bb if hero_player else eff_stack)

        # ── Position matchup ───────────────────────────────────────────────
        folded_preflop = {
            a.player for a in hand.actions
            if a.street == "preflop" and a.action == "fold"
        }
        active_count = sum(1 for p in hand.players if p.name not in folded_preflop)
        hero_vs_villain = _build_position_matchup(hand, folded_preflop)

        # ── Confidence ─────────────────────────────────────────────────────
        confidence = 1.0
        confidence -= len(errors) * 0.3
        confidence -= len(warnings) * 0.07
        confidence = max(0.0, min(1.0, confidence))

        is_valid = len(errors) == 0 and len(hand.actions) > 0

        return cls(
            site=hand.site,
            hand_id=hand.hand_id,
            stakes=hand.stakes,
            big_blind=hand.big_blind,
            current_street=current_street,
            board_cards=board_cards,
            pot_bb=pot_bb,
            spr=round(spr, 1),
            hero_position=hand.hero_position,
            hero_is_ip=hero_is_ip,
            hero_is_pfr=hero_is_pfr,
            hero_stack_bb=hero_stack_bb,
            effective_stack_bb=eff_stack,
            hero_cards=hand.hero_cards,
            hand_strength=hand_strength,
            node_id=node_id,
            node_type=node_type,
            legal_actions=legal_actions,
            pot_type=pot_type,
            last_aggressor=last_aggressor,
            active_player_count=active_count,
            hero_vs_villain_positions=hero_vs_villain,
            is_valid=is_valid,
            confidence=confidence,
            validation_warnings=warnings,
            validation_errors=errors,
            debug_notes=debug,
        )

    def to_prompt_block(self) -> str:
        """Return a structured block for injection into AI coaching prompts."""
        hs = self.hand_strength
        strength_lines = ""
        if hs:
            strength_lines = (
                f"  Made hand:       {hs.made_hand_description} (category {hs.made_hand_category}/8)\n"
                f"  Relative:        {hs.relative_strength}\n"
                f"  Showdown value:  {hs.showdown_value}/100\n"
                f"  Primary label:   {hs.primary_label}\n"
                f"  Draw primary:    {hs.draw_is_primary} "
                f"({'draws lead coaching' if hs.draw_is_primary else 'made hand leads coaching'})\n"
            )
            if hs.has_direct_draw:
                strength_lines += (
                    f"  Draw (secondary):{hs.draw_type} ~{hs.draw_outs} outs "
                    f"(~{hs.draw_equity_pct:.0f}% improvement equity)\n"
                )

        warn_block = ""
        if self.validation_warnings:
            warn_block = "  Warnings: " + "; ".join(self.validation_warnings) + "\n"

        return (
            f"CANONICAL POKER STATE (engine-computed — single source of truth)\n"
            f"  Node:            {self.node_id} ({self.node_type})\n"
            f"  Legal actions:   {', '.join(sorted(self.legal_actions))}\n"
            f"  Pot type:        {self.pot_type}\n"
            f"  Board:           {' '.join(self.board_cards) if self.board_cards else 'none'}\n"
            f"  SPR:             {self.spr}\n"
            f"  Hero position:   {self.hero_position} ({'IP' if self.hero_is_ip else 'OOP'})\n"
            f"  Hero is PFR:     {self.hero_is_pfr}\n"
            f"  Last aggressor:  {self.last_aggressor or 'none'}\n"
            f"  Effective stack: {self.effective_stack_bb:.1f}bb\n"
            f"  Active players:  {self.active_player_count}\n"
            f"HAND STRENGTH (priority-ordered)\n"
            f"{strength_lines}"
            f"VALIDATION\n"
            f"  Valid:           {self.is_valid}\n"
            f"  Confidence:      {self.confidence:.2f}\n"
            f"{warn_block}"
        )


# ── Private builders ────────────────────────────────────────────────────────

def _compute_hand_strength(
    hero_cards: list[str],
    board_cards: list[str],
) -> HandStrengthState:
    """
    Build HandStrengthState with strict priority ordering:
      1. Made hand category (0-8)
      2. Relative strength within category (overpair, TPTK, etc.)
      3. Draws — ONLY primary when no made hand (category == 0)
    """
    from app.engines.hand_evaluator import evaluate_hole_and_board, RANK_VALUES, parse_card

    # ── Evaluate made hand ─────────────────────────────────────────────────
    try:
        hand_rank = evaluate_hole_and_board(hero_cards, board_cards)
        category = hand_rank.category
        made_label = hand_rank.category_name
        made_desc = hand_rank.description
    except Exception:
        category = 0
        made_label = "high_card"
        made_desc = "High card"

    # ── Relative strength ──────────────────────────────────────────────────
    relative, showdown_value = _compute_relative(hero_cards, board_cards, category)

    # ── Nuttedness ─────────────────────────────────────────────────────────
    is_nut = category >= 7 or (category == 5 and _has_nut_flush(hero_cards, board_cards))
    is_near_nut = category >= 6 or (category == 5 and _has_near_nut_flush(hero_cards, board_cards))

    # ── Draw info (secondary) ──────────────────────────────────────────────
    draw_info = _analyze_draws_simple(hero_cards, board_cards)

    # ── Primary label (made hand wins if category >= 1) ───────────────────
    if category >= 8:
        primary_label = "straight_flush"
        primary_reasoning = "Straight flush — maximum strength"
    elif category == 7:
        primary_label = "quads"
        primary_reasoning = "Four of a kind — near-invincible"
    elif category == 6:
        primary_label = "full_house"
        primary_reasoning = "Full house — strong made hand, hard to beat"
    elif category == 5:
        primary_label = "flush"
        primary_reasoning = f"Flush — {'nut' if is_nut else 'strong' if is_near_nut else 'weak'} flush"
    elif category == 4:
        primary_label = "straight"
        primary_reasoning = "Straight — strong made hand"
    elif category == 3:
        primary_label = "set"
        primary_reasoning = "Three of a kind / set — strong made hand"
    elif category == 2:
        primary_label = "two_pair"
        primary_reasoning = "Two pair — solid showdown value"
    elif category == 1:
        # One pair — use relative strength label
        primary_label = relative
        primary_reasoning = _pair_reasoning(relative, hero_cards, board_cards)
    else:
        # No made hand (category == 0) — draws lead
        if draw_info["is_combo"]:
            primary_label = "combo_draw"
            primary_reasoning = f"Combo draw — {draw_info.get('draw_type', 'flush+straight')} ({draw_info['outs']} outs, ~{draw_info['outs'] * 4}% equity)"
        elif draw_info.get("draw_type") == "flush_draw":
            primary_label = "flush_draw"
            primary_reasoning = f"Flush draw — {draw_info['outs']} outs"
        elif draw_info.get("draw_type") in ("oesd", "double_gutter"):
            primary_label = draw_info["draw_type"]
            primary_reasoning = f"Strong straight draw — {draw_info['outs']} outs"
        elif draw_info.get("draw_type") == "gutshot":
            primary_label = "gutshot"
            primary_reasoning = f"Gutshot — {draw_info['outs']} outs (~{draw_info['outs'] * 4}% equity)"
        elif draw_info.get("has_backdoor"):
            primary_label = "backdoor"
            primary_reasoning = "Backdoor draws only (~4-6% runner-runner equity)"
        else:
            primary_label = "air"
            primary_reasoning = "No made hand, no significant draw"

    return HandStrengthState(
        made_hand_category=category,
        made_hand_label=made_label,
        made_hand_description=made_desc,
        relative_strength=relative,
        showdown_value=showdown_value,
        is_nut=is_nut,
        is_near_nut=is_near_nut,
        has_direct_draw=draw_info.get("has_direct_draw", False),
        draw_type=draw_info.get("draw_type"),
        draw_outs=draw_info.get("outs", 0),
        draw_equity_pct=float(draw_info.get("outs", 0)) * 4.0,
        has_backdoor_only=draw_info.get("has_backdoor", False) and not draw_info.get("has_direct_draw", False),
        is_combo_draw=draw_info.get("is_combo", False),
        blocks_nut_flush=_blocks_nut_flush(hero_cards, board_cards),
        blocks_top_straight=False,  # simplified
        primary_label=primary_label,
        primary_reasoning=primary_reasoning,
    )


def _compute_relative(
    hero_cards: list[str],
    board_cards: list[str],
    category: int,
) -> tuple[str, int]:
    """
    Compute relative strength and showdown value (0-100) within hand category.
    """
    from app.engines.hand_evaluator import RANK_VALUES

    if category >= 2:
        # Two pair or better: always "strong" or better
        base_values = {2: 55, 3: 70, 4: 75, 5: 82, 6: 88, 7: 95, 8: 100}
        sv = min(100, base_values.get(category, 70))
        return "strong", sv

    if category == 1:
        # One pair — determine relative strength
        try:
            h1r = hero_cards[0][0].upper()
            h2r = hero_cards[1][0].upper()
            hv1 = RANK_VALUES.get(h1r, 0)
            hv2 = RANK_VALUES.get(h2r, 0)

            board_ranks = [RANK_VALUES.get(c[0].upper(), 0) for c in board_cards]
            max_board = max(board_ranks) if board_ranks else 0
            second_board = sorted(board_ranks, reverse=True)[1] if len(board_ranks) >= 2 else 0

            # Pocket pair
            if hv1 == hv2:
                pair_rank = hv1
                if pair_rank > max_board:
                    return "overpair", 62
                else:
                    return "underpair", 30

            # Paired with board
            for brank in sorted(board_ranks, reverse=True):
                if hv1 == brank or hv2 == brank:
                    # Determine kicker strength
                    kicker = hv1 if hv2 == brank else hv2
                    if brank == max_board:
                        # Top pair
                        if kicker >= 14:  return "tptk", 58     # AKo on K-high
                        if kicker >= 11:  return "tpgk", 53     # Top pair J+
                        return "tp_weak", 47
                    elif brank == second_board:
                        return "middle_pair", 38
                    else:
                        return "bottom_pair", 30

        except (IndexError, AttributeError, KeyError):
            pass
        return "unknown", 35

    # High card (category == 0)
    return "air", 10


def _pair_reasoning(relative: str, hero_cards: list[str], board_cards: list[str]) -> str:
    card_str = " ".join(hero_cards) if hero_cards else "??"
    board_str = " ".join(board_cards[:3]) if board_cards else "??"
    labels = {
        "overpair":    f"{card_str} is an overpair — strong hand with good showdown value",
        "tptk":        f"{card_str} makes top pair top kicker — solid value hand",
        "tpgk":        f"{card_str} makes top pair with a good kicker — decent value",
        "tp_weak":     f"{card_str} makes top pair with a weak kicker — be cautious with pot size",
        "middle_pair": f"{card_str} has middle pair — marginal showdown value, thin value spot",
        "bottom_pair": f"{card_str} has bottom pair — weak showdown value, fold equity needed",
        "underpair":   f"{card_str} is an underpair to the board — limited showdown value",
    }
    return labels.get(relative, f"{card_str} has a one-pair hand on {board_str}")


def _analyze_draws_simple(
    hero_cards: list[str],
    board_cards: list[str],
) -> dict:
    """
    Simplified draw analysis for PokerState construction.
    Returns dict with draw info — does NOT override made hand strength.
    Uses draw_evaluator when available.
    """
    try:
        from app.engines.draw_evaluator import analyze_draws
        if len(board_cards) >= 3:
            da = analyze_draws(hero_cards, board_cards[:3])  # Use flop for state
            return {
                "has_direct_draw": da.has_direct_straight_draw or da.has_flush_draw,
                "draw_type": (
                    "flush_draw" if da.has_flush_draw else
                    da.straight_draws[0].draw_type if da.straight_draws else None
                ),
                "outs": getattr(da, "primary_outs", 0),
                "is_combo": da.is_combo_draw,
                "has_backdoor": da.has_backdoor_straight or da.has_backdoor_flush,
            }
    except Exception:
        pass
    return {"has_direct_draw": False, "outs": 0, "is_combo": False, "has_backdoor": False}


def _has_nut_flush(hero_cards: list[str], board_cards: list[str]) -> bool:
    """True if hero has the nut flush (Ace of dominant suit + one more)."""
    try:
        from collections import Counter
        board_suits = Counter(c[1].lower() for c in board_cards)
        if not board_suits:
            return False
        dominant = board_suits.most_common(1)[0][0]
        hero_suit_cards = [c for c in hero_cards if c[1].lower() == dominant]
        if len(hero_suit_cards) >= 1:
            ranks = [c[0].upper() for c in hero_suit_cards]
            return "A" in ranks
    except Exception:
        pass
    return False


def _has_near_nut_flush(hero_cards: list[str], board_cards: list[str]) -> bool:
    """True if hero has King or Ace of dominant suit."""
    try:
        from collections import Counter
        board_suits = Counter(c[1].lower() for c in board_cards)
        if not board_suits:
            return False
        dominant = board_suits.most_common(1)[0][0]
        hero_suit_cards = [c for c in hero_cards if c[1].lower() == dominant]
        if hero_suit_cards:
            ranks = [c[0].upper() for c in hero_suit_cards]
            return "A" in ranks or "K" in ranks
    except Exception:
        pass
    return False


def _blocks_nut_flush(hero_cards: list[str], board_cards: list[str]) -> bool:
    """True if hero holds an Ace or high card of the dominant board suit."""
    try:
        from collections import Counter
        board_suits = Counter(c[1].lower() for c in board_cards)
        if not board_suits:
            return False
        dominant = board_suits.most_common(1)[0][0]
        hero_dominant = [c for c in hero_cards if c[1].lower() == dominant]
        if hero_dominant:
            ranks = [c[0].upper() for c in hero_dominant]
            from app.engines.hand_evaluator import RANK_VALUES
            return any(RANK_VALUES.get(r, 0) >= 12 for r in ranks)  # Q or better
    except Exception:
        pass
    return False


def _estimate_pot_after_preflop(hand: ParsedHand) -> float:
    """Estimate pot size after preflop action (for SPR calculation)."""
    # Start: SB + BB
    sb_bb = hand.big_blind / 2  # approximate SB as half BB
    pot = 1.0 + (sb_bb / hand.big_blind)  # 1 BB + 0.5 BB

    for a in hand.actions:
        if a.street == "preflop" and a.size_bb and a.action in ("call", "raise"):
            pot += a.size_bb

    return max(pot, 2.0)


def _detect_node(
    hand: ParsedHand,
    current_street: str,
    hero_is_ip: bool,
    hero_is_pfr: bool,
) -> tuple[str, str, frozenset[str]]:
    """
    Detect node type and legal actions for the current position.

    Returns: (node_type, node_id, legal_actions)
    """
    if current_street == "preflop":
        # Use preflop_ranges for preflop node detection
        try:
            from app.engines.preflop_ranges import detect_preflop_node, LEGAL_ACTIONS
            hero_actions = [(i, a) for i, a in enumerate(hand.actions) if a.is_hero and a.street == "preflop"]
            if hero_actions:
                first_idx, _ = hero_actions[0]
                node = detect_preflop_node(first_idx, hand.actions, hand.hero_position)
                stack_class = _stack_class(hand.effective_stack_bb)
                node_id = f"{hand.hero_position}_{node.node_type}_{stack_class}"
                return node.node_type, node_id, node.legal_actions
        except Exception:
            pass
        return "UNKNOWN", "UNKNOWN", frozenset({"fold", "call", "raise", "check"})

    # Postflop node detection
    ip_str = "IP" if hero_is_ip else "OOP"
    pfr_str = "PFR" if hero_is_pfr else "CALLER"
    pot_type = _detect_pot_type(hand.actions)
    stack_class = _stack_class(hand.effective_stack_bb)

    # Determine who has initiative (last preflop aggressor)
    has_initiative = hero_is_pfr

    if has_initiative:
        if hero_is_ip:
            node_type = f"IP_PFR_CBET_{current_street.upper()}"
            # IP PFR: can bet or check (never call if first to act)
            legal = frozenset({"bet", "check", "raise"})
        else:
            node_type = f"OOP_PFR_CBET_{current_street.upper()}"
            legal = frozenset({"bet", "check", "raise"})
    else:
        if hero_is_ip:
            node_type = f"IP_CALLER_{current_street.upper()}"
            legal = frozenset({"bet", "check", "call", "raise", "fold"})
        else:
            node_type = f"OOP_CALLER_{current_street.upper()}"
            legal = frozenset({"bet", "check", "call", "raise", "fold"})

    node_id = f"{hand.hero_position}_{ip_str}_{pfr_str}_{pot_type}_{stack_class}"
    return node_type, node_id, legal


def _detect_pot_type(actions: list[HandAction]) -> str:
    preflop = [a for a in actions if a.street == "preflop"]
    raises = [a for a in preflop if a.action == "raise"]
    if len(raises) >= 3:
        return "4BET"
    if len(raises) == 2:
        return "3BET"
    return "SRP"


def _find_last_aggressor(actions: list[HandAction], street: str) -> str:
    """Find the last player to raise on or before the current street."""
    order = ["preflop", "flop", "turn", "river"]
    idx = order.index(street) if street in order else 3
    relevant_streets = order[:idx + 1]

    last = ""
    for a in actions:
        if a.street in relevant_streets and a.action in ("raise", "bet"):
            last = a.player
    return last


def _stack_class(eff_bb: float) -> str:
    if eff_bb >= 100:
        return "100bb"
    if eff_bb >= 50:
        return "50bb"
    if eff_bb >= 25:
        return "25bb"
    return "short"


def _build_position_matchup(hand: ParsedHand, folded_preflop: set[str]) -> str:
    active = [p for p in hand.players if p.name not in folded_preflop]
    if len(active) == 2:
        villain = next((p for p in active if p.name != hand.hero_name), None)
        if villain:
            return f"{hand.hero_position}_vs_{villain.position}"
    return f"{hand.hero_position}_multiway"
