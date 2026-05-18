"""
Canonical Hand Schema — single source of truth for all poker hand data.

Every analysis engine, validator, and test fixture uses this schema.
ParsedHand (from parsers) is converted into CanonicalHand via the normalizer
before any analysis occurs.

Schema version: 1.0
"""
from __future__ import annotations

from enum import Enum
from typing import Literal
from pydantic import BaseModel, Field


# ── Enums ──────────────────────────────────────────────────────────────────────

class Site(str, Enum):
    GGPOKER    = "GGPoker"
    POKERSTARS = "PokerStars"
    WINAMAX    = "Winamax"
    PARTYPOKER = "PartyPoker"
    WPN        = "WPN"
    UNKNOWN    = "Unknown"


class GameType(str, Enum):
    NLHE     = "NLHE"
    PLO      = "PLO"
    PLO5     = "PLO5"
    MTT_NLHE = "MTT-NLHE"
    MTT_PLO  = "MTT-PLO"
    SNG_NLHE = "SNG-NLHE"
    SPIN     = "SPIN"


class Street(str, Enum):
    PREFLOP = "preflop"
    FLOP    = "flop"
    TURN    = "turn"
    RIVER   = "river"


class ActionType(str, Enum):
    FOLD         = "fold"
    CHECK        = "check"
    CALL         = "call"
    BET          = "bet"
    RAISE        = "raise"
    POST_SB      = "post_sb"
    POST_BB      = "post_bb"
    POST_ANTE    = "post_ante"
    POST_STRADDLE = "post_straddle"


class Position(str, Enum):
    BTN = "BTN"
    SB  = "SB"
    BB  = "BB"
    UTG = "UTG"
    UTG1 = "UTG+1"
    UTG2 = "UTG+2"
    LJ  = "LJ"
    HJ  = "HJ"
    CO  = "CO"


class ParseSource(str, Enum):
    TEXT_HISTORY = "text_history"
    SCREENSHOT   = "screenshot"
    MANUAL       = "manual"


# ── Cards ──────────────────────────────────────────────────────────────────────

VALID_RANKS = frozenset("23456789TJQKA")
VALID_SUITS = frozenset("cdhs")


class CanonicalCard(BaseModel):
    rank: str   # 2-9, T, J, Q, K, A
    suit: str   # c, d, h, s
    notation: str  # "Ah", "Td"

    @classmethod
    def from_notation(cls, s: str) -> "CanonicalCard":
        if len(s) != 2:
            raise ValueError(f"Invalid card notation: {s!r}")
        rank = s[0].upper()
        suit = s[1].lower()
        if rank not in VALID_RANKS:
            raise ValueError(f"Invalid rank {rank!r} in card {s!r}")
        if suit not in VALID_SUITS:
            raise ValueError(f"Invalid suit {suit!r} in card {s!r}")
        return cls(rank=rank, suit=suit, notation=rank + suit)

    def __hash__(self) -> int:
        return hash(self.notation)

    def __eq__(self, other: object) -> bool:
        if isinstance(other, CanonicalCard):
            return self.notation == other.notation
        return NotImplemented


# ── Stakes ─────────────────────────────────────────────────────────────────────

class CanonicalStakes(BaseModel):
    small_blind_bb: float = 0.5   # always 0.5 in BB units
    big_blind: float              # in currency units (1.0 if chips/unitless)
    ante_bb: float = 0.0          # ante in BB units
    straddle_bb: float = 0.0      # straddle in BB units
    currency: str = ""            # "USD", "EUR", "", "chips"
    display: str                  # e.g. "$0.50/$1.00" or "T500/T1000"


# ── Players ────────────────────────────────────────────────────────────────────

class CanonicalPlayer(BaseModel):
    id: str           # canonical ID: "seat_N" (deterministic)
    name: str
    seat: int
    position: str     # canonical position string (BTN/SB/BB/UTG/HJ/CO/LJ)
    stack_bb: float   # starting stack in BB units
    hole_cards: list[CanonicalCard] = Field(default_factory=list)
    is_hero: bool = False
    is_active: bool = True   # becomes False once folded


# ── Actions ────────────────────────────────────────────────────────────────────

class CanonicalAction(BaseModel):
    sequence: int         # global action index (0-based)
    street: Street
    player_id: str
    player_name: str
    action: ActionType
    amount_bb: float = 0.0         # chips put into pot this action
    total_bet_bb: float = 0.0      # cumulative total on this street (for raises)
    is_hero: bool = False
    is_all_in: bool = False
    stack_before_bb: float = 0.0   # player stack before this action
    stack_after_bb: float = 0.0    # player stack after this action
    pot_before_bb: float = 0.0     # total pot before this action
    pot_after_bb: float = 0.0      # total pot after this action


# ── Streets ────────────────────────────────────────────────────────────────────

class CanonicalStreet(BaseModel):
    name: Street
    board_cards: list[CanonicalCard] = Field(default_factory=list)
    pot_start_bb: float = 0.0      # pot at start of this street
    actions: list[CanonicalAction] = Field(default_factory=list)


# ── Showdown ───────────────────────────────────────────────────────────────────

class ShowdownPlayer(BaseModel):
    player_id: str
    player_name: str
    cards: list[CanonicalCard]
    hand_rank: str = ""   # "Flush", "Two Pair", etc.
    hand_description: str = ""


class ShowdownResult(BaseModel):
    players: list[ShowdownPlayer] = Field(default_factory=list)
    winners: list[str] = Field(default_factory=list)  # player_ids
    main_pot_bb: float = 0.0
    side_pots: list[dict] = Field(default_factory=list)  # {amount_bb, eligible_player_ids}


# ── Full Canonical Hand ────────────────────────────────────────────────────────

class CanonicalHand(BaseModel):
    """The single canonical representation of a poker hand.

    ALL analysis engines must accept only this schema.
    Created from ParsedHand via the normalizer.
    """
    schema_version: str = "1.0"

    # Identity
    hand_id: str
    site: str
    game_type: str
    is_tournament: bool = False

    # Stakes
    stakes: CanonicalStakes

    # Table
    table_name: str = ""
    table_max_seats: int = 6

    # Players (ordered by seat)
    players: list[CanonicalPlayer]
    hero_id: str   # matches a player's id

    # Streets (preflop through as far as action went)
    streets: list[CanonicalStreet]

    # Showdown (None if hand ended before showdown)
    showdown: ShowdownResult | None = None

    # Computed totals (set by normalizer)
    effective_stack_bb: float
    final_pot_bb: float

    # Provenance
    parse_source: str = "text_history"
    raw_text: str | None = None     # original text (for debug)


# ── Pipeline validation ────────────────────────────────────────────────────────

class ValidationSeverity(str, Enum):
    ERROR   = "error"    # blocks analysis
    WARNING = "warning"  # degrades confidence


class ValidationErrorCode(str, Enum):
    # Cards
    INVALID_CARD_FORMAT    = "INVALID_CARD_FORMAT"
    DUPLICATE_CARD         = "DUPLICATE_CARD"
    # Board
    BOARD_PROGRESSION_SKIP = "BOARD_PROGRESSION_SKIP"
    WRONG_BOARD_CARD_COUNT = "WRONG_BOARD_CARD_COUNT"
    # Players
    HERO_NOT_IN_PLAYERS    = "HERO_NOT_IN_PLAYERS"
    DUPLICATE_SEAT         = "DUPLICATE_SEAT"
    NEGATIVE_STACK         = "NEGATIVE_STACK"
    TOO_FEW_PLAYERS        = "TOO_FEW_PLAYERS"
    TOO_MANY_PLAYERS       = "TOO_MANY_PLAYERS"
    HERO_CARDS_MISSING     = "HERO_CARDS_MISSING"
    HERO_POSITION_UNKNOWN  = "HERO_POSITION_UNKNOWN"
    # Actions
    ACTION_OUT_OF_ORDER         = "ACTION_OUT_OF_ORDER"
    NEGATIVE_ACTION_AMOUNT      = "NEGATIVE_ACTION_AMOUNT"
    RAISE_BELOW_MIN             = "RAISE_BELOW_MIN"
    ACTION_BY_FOLDED_PLAYER     = "ACTION_BY_FOLDED_PLAYER"
    NO_HERO_ACTIONS             = "NO_HERO_ACTIONS"
    # Pot tracking
    IMPOSSIBLE_POT_SIZE         = "IMPOSSIBLE_POT_SIZE"
    NEGATIVE_STACK_AFTER_ACTION = "NEGATIVE_STACK_AFTER_ACTION"
    OVERBET_STACK               = "OVERBET_STACK"
    # Blinds
    MISSING_BIG_BLIND           = "MISSING_BIG_BLIND"
    # General
    NO_ACTIONS_PARSED           = "NO_ACTIONS_PARSED"
    EFFECTIVE_STACK_ZERO        = "EFFECTIVE_STACK_ZERO"


class PipelineValidationError(BaseModel):
    code: str    # ValidationErrorCode value
    message: str
    severity: str   # "error" | "warning"
    field: str | None = None   # which field triggered this


class PipelineValidationResult(BaseModel):
    """Returned by the validation layer. Blocks analysis if valid=False."""
    valid: bool
    can_analyze: bool          # True if no hard errors (warnings are OK)
    errors: list[PipelineValidationError] = Field(default_factory=list)
    warnings: list[PipelineValidationError] = Field(default_factory=list)
    confidence: float = Field(1.0, ge=0.0, le=1.0)
    hero_detected_by: str = ""


class PipelineResult(BaseModel):
    """Full output of the normalization + validation pipeline.

    Returned to the frontend before analysis runs.
    Analysis MUST NOT run unless can_analyze=True.
    """
    canonical: CanonicalHand
    validation: PipelineValidationResult
    # Debug info (only populated in dev mode)
    parse_diagnostics: dict | None = None
    raw_extracted_entities: dict | None = None
