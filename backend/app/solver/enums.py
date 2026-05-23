from enum import Enum


# ── Spot-level enums ──────────────────────────────────────────────────────────


class SpotType(str, Enum):
    """Pre-flop pot construction type, derived from action sequence."""
    SRP = "SRP"               # Single raise pot (one open, one caller)
    THREE_BET = "3BET"        # Two raises preflop
    FOUR_BET = "4BET"         # Three or more raises preflop
    LIMPED = "LIMPED"         # No preflop raise (walk or multi-limp)
    SQUEEZE = "SQUEEZE"       # 3-bet after a raise + ≥1 cold caller
    ISO_RAISE = "ISO_RAISE"   # Raise over ≥1 limper(s)
    UNKNOWN = "UNKNOWN"


class PositionMatchup(str, Enum):
    """
    Heads-up positional matchup at the flop, expressed as IP_vs_OOP.

    Multiway variants are bucketed by player count.
    All values are deterministically derived from surviving preflop positions.
    """
    # BTN in position vs blinds / earlier opens
    BTN_vs_BB = "BTN_vs_BB"
    BTN_vs_SB = "BTN_vs_SB"
    BTN_vs_CO = "BTN_vs_CO"
    BTN_vs_HJ = "BTN_vs_HJ"
    BTN_vs_LJ = "BTN_vs_LJ"
    BTN_vs_UTG = "BTN_vs_UTG"
    BTN_vs_UTG1 = "BTN_vs_UTG1"
    BTN_vs_UTG2 = "BTN_vs_UTG2"

    # CO in position
    CO_vs_BB = "CO_vs_BB"
    CO_vs_SB = "CO_vs_SB"
    CO_vs_HJ = "CO_vs_HJ"
    CO_vs_LJ = "CO_vs_LJ"
    CO_vs_UTG = "CO_vs_UTG"
    CO_vs_UTG1 = "CO_vs_UTG1"
    CO_vs_UTG2 = "CO_vs_UTG2"

    # HJ in position
    HJ_vs_BB = "HJ_vs_BB"
    HJ_vs_SB = "HJ_vs_SB"
    HJ_vs_LJ = "HJ_vs_LJ"
    HJ_vs_UTG = "HJ_vs_UTG"
    HJ_vs_UTG1 = "HJ_vs_UTG1"
    HJ_vs_UTG2 = "HJ_vs_UTG2"

    # LJ in position
    LJ_vs_BB = "LJ_vs_BB"
    LJ_vs_SB = "LJ_vs_SB"
    LJ_vs_UTG = "LJ_vs_UTG"
    LJ_vs_UTG1 = "LJ_vs_UTG1"
    LJ_vs_UTG2 = "LJ_vs_UTG2"

    # UTG variants in position
    UTG_vs_BB = "UTG_vs_BB"
    UTG_vs_SB = "UTG_vs_SB"
    UTG1_vs_BB = "UTG1_vs_BB"
    UTG1_vs_SB = "UTG1_vs_SB"
    UTG2_vs_BB = "UTG2_vs_BB"
    UTG2_vs_SB = "UTG2_vs_SB"

    # Blind battles
    SB_vs_BB = "SB_vs_BB"   # SB opens, BB defends (SB is IP postflop → NO — BB is OOP)
    BB_vs_SB = "BB_vs_SB"   # SB completes / limps, BB raises

    # Multiway buckets
    MULTIWAY_3WAY = "MULTIWAY_3WAY"
    MULTIWAY_4WAY = "MULTIWAY_4WAY"
    MULTIWAY_5WAY = "MULTIWAY_5WAY"
    MULTIWAY_6WAY_PLUS = "MULTIWAY_6WAY_PLUS"
    MULTIWAY = "MULTIWAY"   # Generic fallback for any multiway

    UNKNOWN = "UNKNOWN"


class StackDepthBucket(str, Enum):
    """Effective stack depth bucketed into standard solver ranges (in BB)."""
    BB10 = "10bb"
    BB20 = "20bb"
    BB40 = "40bb"
    BB60 = "60bb"
    BB100 = "100bb"
    BB150 = "150bb"
    BB200_PLUS = "200bb_plus"


class SPRBucket(str, Enum):
    """Stack-to-pot ratio at the start of the postflop street."""
    SPR_0_2 = "0_2"
    SPR_2_4 = "2_4"
    SPR_4_8 = "4_8"
    SPR_8_PLUS = "8_PLUS"


class SolverStreet(str, Enum):
    """Street at which the spot is being classified."""
    PREFLOP = "preflop"
    FLOP = "flop"
    TURN = "turn"
    RIVER = "river"


# ── Board-level enums ─────────────────────────────────────────────────────────


class BoardClassEnum(str, Enum):
    # Ace-high boards
    A_HIGH_DRY = "A_HIGH_DRY"
    A_HIGH_WET = "A_HIGH_WET"

    # King-high boards
    K_HIGH_DRY = "K_HIGH_DRY"
    K_HIGH_WET = "K_HIGH_WET"

    # Low connected boards
    LOW_CONNECTED = "LOW_CONNECTED"
    LOW_DYNAMIC = "LOW_DYNAMIC"

    # Middle connected boards
    MIDDLE_CONNECTED = "MIDDLE_CONNECTED"

    # Broadway density
    DOUBLE_BROADWAY = "DOUBLE_BROADWAY"
    TRIPLE_BROADWAY = "TRIPLE_BROADWAY"

    # Paired boards
    PAIRED_LOW = "PAIRED_LOW"
    PAIRED_HIGH = "PAIRED_HIGH"

    # Suit texture
    MONOTONE = "MONOTONE"
    RAINBOW_STATIC = "RAINBOW_STATIC"
    RAINBOW_DYNAMIC = "RAINBOW_DYNAMIC"

    # Turn / river evolution classes
    FLUSH_COMPLETING = "FLUSH_COMPLETING"
    STRAIGHT_COMPLETING = "STRAIGHT_COMPLETING"

    # Fallback
    NEUTRAL = "NEUTRAL"


class ConnectednessLabel(str, Enum):
    EXTREMELY_CONNECTED = "extremely_connected"
    HIGHLY_CONNECTED = "highly_connected"
    CONNECTED = "connected"
    SEMI_CONNECTED = "semi_connected"
    WEAKLY_CONNECTED = "weakly_connected"
    DISCONNECTED = "disconnected"
