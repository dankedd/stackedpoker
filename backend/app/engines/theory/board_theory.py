"""
Board Texture Theory — Flop Classification and Strategy Mapping
================================================================
Original implementation of board texture analysis informed by GTO principles.

Boards are classified by:
  1. High-card rank       (A-high, K-high, mid-high 9–Q, low 2–8)
  2. Connectivity         (disconnected, gutshot, OESD-possible, connected)
  3. Suitedness           (rainbow, two-tone, monotone)
  4. Pairing              (unpaired, one pair, trips)
  5. Range-equity impact  (IP advantage, OOP advantage, neutral)

This classification drives:
  - Expected c-bet frequency
  - Preferred bet-sizing
  - Donk-betting viability
  - Range advantage assessment

All classifications are original analytical work inspired by observed solver
patterns (not reproduced from any specific solver output or copyrighted source).
"""

from __future__ import annotations
from enum import Enum
from dataclasses import dataclass
from typing import Optional


class BoardHighCard(str, Enum):
    ACE   = "ace"    # A-high
    KING  = "king"   # K-high (no ace)
    QUEEN = "queen"  # Q-high
    MID   = "mid"    # 9–J high
    LOW   = "low"    # 2–8 high


class BoardConnectivity(str, Enum):
    DISCONNECTED = "disconnected"   # No straight possible (e.g., A92r)
    GUTSHOT_ONLY = "gutshot_only"   # Only gutshot draws exist
    OESD_POSSIBLE = "oesd_possible" # Open-ended straight draw possible
    CONNECTED    = "connected"      # Two or more OESD + straight combos


class BoardSuitedness(str, Enum):
    RAINBOW   = "rainbow"    # All three different suits
    TWO_TONE  = "two_tone"   # Two cards same suit
    MONOTONE  = "monotone"   # All three same suit


class BoardPairing(str, Enum):
    UNPAIRED = "unpaired"  # Three distinct ranks
    PAIRED   = "paired"    # One pair on board
    TRIPS    = "trips"     # Three of a kind on board


class BoardFamily(str, Enum):
    """
    Board family classification — drives strategic behavior.
    Roughly ordered from most IP-favorable to most OOP-favorable.
    """
    A_HIGH_DRY         = "A_high_dry"         # A-high rainbow disconnected
    A_HIGH_WET         = "A_high_wet"          # A-high with draws
    K_HIGH_DRY         = "K_high_dry"          # K-high rainbow disconnected
    K_HIGH_WET         = "K_high_wet"          # K-high with draws
    MID_HIGH_DRY       = "mid_high_dry"        # Q/J/T-high dry
    MID_HIGH_WET       = "mid_high_wet"        # Q/J/T-high wet
    LOW_CONNECTED      = "low_connected"       # 2–8 high, connected (best for BB)
    LOW_PAIRED         = "low_paired"          # Low paired board
    PAIRED_BOARD       = "paired_board"        # Any paired board
    MONOTONE           = "monotone"            # Flush-heavy board


@dataclass(frozen=True)
class BoardTextureProfile:
    """Strategic profile for a board family."""
    family: BoardFamily
    description: str

    # C-bet guidance (from IP aggressor perspective)
    ip_cbet_frequency: str      # "very_high (>80%)", "high (60-80%)", "medium (40-60%)", "low (<40%)"
    ip_cbet_size: str           # "small (25-33%)", "medium (40-67%)", "large (75-100%+)"
    ip_cbet_rationale: str

    # OOP donk bet guidance
    oop_donk_frequency: str     # "rare", "occasional", "common", "dominant"
    oop_donk_rationale: str

    # Range dynamics
    range_advantage: str        # "ip_strong", "ip_moderate", "neutral", "oop_moderate"
    nut_advantage: str          # "ip", "oop", "neutral"

    # Key strategic concept
    key_concept: str
    coaching_tags: list[str]


BOARD_TEXTURE_PROFILES: dict[BoardFamily, BoardTextureProfile] = {

    BoardFamily.A_HIGH_DRY: BoardTextureProfile(
        family=BoardFamily.A_HIGH_DRY,
        description=(
            "Ace-high rainbow disconnected board (e.g., A♠7♦2♣, A♥9♦3♣). "
            "IP (preflop aggressor) has a massive range advantage — aces are heavily "
            "over-represented in the opening range vs the calling range."
        ),
        ip_cbet_frequency="very_high (>80%)",
        ip_cbet_size="small (25-33%)",
        ip_cbet_rationale=(
            "IP can c-bet nearly 100% of range for a small size. "
            "The small sizing is optimal because IP's range dominates: "
            "a merged range of 25-33% pot captures maximum equity denial "
            "while allowing IP to bluff cheaply with air. "
            "Going large invites OOP to correctly fold all weak hands, "
            "reducing overall EV. The small bet forces OOP to defend wide."
        ),
        oop_donk_frequency="rare",
        oop_donk_rationale=(
            "OOP rarely leads because IP's range is so dominant on ace-high boards. "
            "Donk betting hands OOP here is counterproductive: IP's range contains "
            "so many aces that OOP's donk bet rarely gets through. "
            "OOP should mostly check and defend vs the expected c-bet."
        ),
        range_advantage="ip_strong",
        nut_advantage="ip",
        key_concept=(
            "On ace-high dry boards, the preflop aggressor (IP) has a massive range advantage. "
            "A high-frequency small c-bet (25-33% pot) with the entire range is theoretically "
            "optimal. This is a 'merged' betting strategy: bet most of the range at a small size "
            "rather than polarizing. The small bet forces BB to defend wide, denying equity "
            "from all the weak hands in BB's bloated calling range."
        ),
        coaching_tags=["ip_range_advantage", "small_cbet_merged", "equity_denial", "ace_high_board"],
    ),

    BoardFamily.A_HIGH_WET: BoardTextureProfile(
        family=BoardFamily.A_HIGH_WET,
        description=(
            "Ace-high board with flush draw or connected (e.g., A♠J♥T♥, A♦8♥7♥). "
            "IP retains range advantage on the ace but flush/straight draws give "
            "OOP's range more equity to continue with."
        ),
        ip_cbet_frequency="high (60-80%)",
        ip_cbet_size="medium (50-67%)",
        ip_cbet_rationale=(
            "On ace-high wet boards, IP still has the range advantage but can no longer "
            "use a pure merged small bet. Draws in OOP's range have equity, so IP needs "
            "to size up to charge them appropriately. A medium size (50-67%) balances "
            "value and charge-the-draws objectives."
        ),
        oop_donk_frequency="occasional",
        oop_donk_rationale=(
            "OOP has more equity on wet boards with draws. Donking with the nut flush draw "
            "or top pair + draw is viable on some ace-high wet textures."
        ),
        range_advantage="ip_moderate",
        nut_advantage="ip",
        key_concept=(
            "Ace-high wet boards require IP to size up vs dry boards. "
            "Flush draws in OOP's range have ~35% equity and must be charged. "
            "IP's c-bet strategy shifts from merged (small) to more polarized (medium) "
            "to extract maximum value from the strong hands while denying draw equity."
        ),
        coaching_tags=["ip_range_advantage", "medium_cbet_draw_boards", "ace_high_board", "charge_draws"],
    ),

    BoardFamily.K_HIGH_DRY: BoardTextureProfile(
        family=BoardFamily.K_HIGH_DRY,
        description=(
            "King-high rainbow disconnected board (e.g., K♠7♦2♣, K♥9♦3♠). "
            "Similar to A-high dry but IP's advantage is slightly reduced because "
            "BB has more kings than aces (BB defends K-high hands more than A-high)."
        ),
        ip_cbet_frequency="high (70-85%)",
        ip_cbet_size="small (25-40%)",
        ip_cbet_rationale=(
            "K-high dry boards still strongly favor IP, though slightly less than A-high. "
            "A small c-bet at high frequency remains the dominant strategy. "
            "IP's range contains many more kings than BB's calling range."
        ),
        oop_donk_frequency="rare",
        oop_donk_rationale="OOP's range contains relatively few kings; donking is rarely profitable.",
        range_advantage="ip_moderate",
        nut_advantage="ip",
        key_concept=(
            "K-high dry boards are structurally similar to A-high dry but slightly "
            "less extreme in IP's favor. The same high-frequency small c-bet strategy applies. "
            "IP's advantage diminishes slightly as OOP's range overlaps more with king holdings."
        ),
        coaching_tags=["ip_range_advantage", "small_cbet_merged", "k_high_board"],
    ),

    BoardFamily.K_HIGH_WET: BoardTextureProfile(
        family=BoardFamily.K_HIGH_WET,
        description=(
            "King-high wet board with draws (e.g., K♠Q♥J♦, K♦T♠9♠). "
            "High-card boards with strong connectivity give OOP's speculative hands more power."
        ),
        ip_cbet_frequency="medium (50-65%)",
        ip_cbet_size="medium to large (50-75%)",
        ip_cbet_rationale=(
            "On highly connected boards, IP must check more because OOP has many draws "
            "that benefit from check-raising. IP should c-bet strong hands and some bluffs, "
            "checking back medium-strength hands to protect against x/r."
        ),
        oop_donk_frequency="occasional",
        oop_donk_rationale=(
            "OOP can lead with draws and strong made hands that benefit from "
            "building the pot. High-card connected boards give OOP more two-pair "
            "and straight draw equity from the calling range."
        ),
        range_advantage="ip_moderate",
        nut_advantage="neutral",
        key_concept=(
            "On K-high connected boards both ranges interact heavily. "
            "IP must c-bet a more polarized range (value + bluffs) rather than "
            "a merged range. Checking mediocre hands protects against x/r "
            "and preserves equity with hands like middle pair."
        ),
        coaching_tags=["connected_board", "polarized_cbet", "check_protect_range"],
    ),

    BoardFamily.LOW_CONNECTED: BoardTextureProfile(
        family=BoardFamily.LOW_CONNECTED,
        description=(
            "Low-card connected board (e.g., 6♠5♣4♦, 7♥6♦4♣, 8♦5♥3♣). "
            "OOP's (BB's) calling range is more connected to these boards than IP's "
            "preflop opening range. BB leads these boards with high frequency."
        ),
        ip_cbet_frequency="medium (45-60%)",
        ip_cbet_size="medium (40-67%)",
        ip_cbet_rationale=(
            "IP cannot freely c-bet low connected boards because OOP's range contains "
            "many two-pair, straight, and pair+draw combinations. "
            "IP must check back more and protect against check-raises."
        ),
        oop_donk_frequency="common to dominant (40-70%)",
        oop_donk_rationale=(
            "OOP (BB) leads frequently on low connected boards because BB's range "
            "has a nut advantage here — BB's calling range contains more straights, "
            "two pairs, and draw combinations on these textures than IP's opening range. "
            "Small donk bets (25% pot) are the primary tool — building the pot with "
            "the strong hands while gathering information with the medium hands."
        ),
        range_advantage="oop_moderate",
        nut_advantage="oop",
        key_concept=(
            "Low connected boards are where OOP (BB) gets to be the aggressor. "
            "The calling range hits these boards harder than opening ranges because "
            "openers rarely include suited low connectors (43s, 54s, 65s) in their range, "
            "while BB defends with these hands. BB leads frequently with a small sizing "
            "(25% pot) across most of its range — strong hands, medium hands, and semi-bluffs. "
            "IP faces the unusual situation of being checked TO rather than checking to act last."
        ),
        coaching_tags=[
            "oop_range_advantage", "low_connected_board", "donk_bet_dominant",
            "oop_nut_advantage", "bb_calling_range_hits",
        ],
    ),

    BoardFamily.PAIRED_BOARD: BoardTextureProfile(
        family=BoardFamily.PAIRED_BOARD,
        description=(
            "Board with a pair (e.g., A♠A♦7♣, K♥K♦3♠, 7♣7♦2♣). "
            "Paired boards compress equity — sets become less likely, "
            "and both players' ranges collapse toward single pair hands."
        ),
        ip_cbet_frequency="medium to high (60-75%)",
        ip_cbet_size="small to medium (25-50%)",
        ip_cbet_rationale=(
            "On paired boards, neither player has many trips/full houses, "
            "so the betting dynamics favor the range advantage holder (usually IP). "
            "Small bets deny equity to kicker-dependent hands and underpairs."
        ),
        oop_donk_frequency="occasional",
        oop_donk_rationale="Limited donking — paired boards favor checking and pot control.",
        range_advantage="ip_moderate",
        nut_advantage="neutral",
        key_concept=(
            "Paired boards compress the value range for both players. "
            "Trips are rare, so the advantage shifts toward the player with "
            "the best kicker for the paired card or the best overpair. "
            "IP typically has kicker advantages on paired high boards (e.g., AA-paired)."
        ),
        coaching_tags=["paired_board", "kicker_advantage", "compressed_equity"],
    ),

    BoardFamily.MONOTONE: BoardTextureProfile(
        family=BoardFamily.MONOTONE,
        description=(
            "All three flop cards same suit (e.g., A♥K♥7♥, 8♦5♦3♦). "
            "One player often has the nut flush; the other fears it. "
            "Betting dynamics heavily influenced by flush-draw equity."
        ),
        ip_cbet_frequency="low to medium (35-55%)",
        ip_cbet_size="small to medium (25-50%)",
        ip_cbet_rationale=(
            "On monotone boards, IP checks more frequently because OOP has many "
            "flush draws and pairs-plus-flush-draw combinations. Checking back "
            "with made hands prevents getting raised off equity. "
            "When IP bets, it's primarily with flushes and nut draws."
        ),
        oop_donk_frequency="rare",
        oop_donk_rationale=(
            "Monotone boards reduce OOP donk betting frequency because "
            "the ranges are very draw-dependent and pot control matters."
        ),
        range_advantage="neutral",
        nut_advantage="neutral",
        key_concept=(
            "Monotone boards create massive equity swings between the nut flush "
            "and flush-heavy ranges. The player with the nut flush draw has huge equity, "
            "while non-flush hands have poor equity realization. "
            "Both players should check frequently and play cautiously with non-flush holdings."
        ),
        coaching_tags=["monotone_board", "flush_equity_dominant", "check_frequently"],
    ),

    BoardFamily.MID_HIGH_DRY: BoardTextureProfile(
        family=BoardFamily.MID_HIGH_DRY,
        description=(
            "Mid-high dry board (e.g., Q♠9♦2♣, J♥8♦3♠, T♦7♣2♠). "
            "Neither player dominates — both ranges have reasonable middle pairs."
        ),
        ip_cbet_frequency="high (65-80%)",
        ip_cbet_size="small to medium (33-50%)",
        ip_cbet_rationale=(
            "IP still has a range advantage (more high pairs, more overcard combos) "
            "but the advantage is smaller than on A/K-high boards. "
            "A medium frequency, small-to-medium size c-bet captures value and "
            "denies equity without over-committing with marginal hands."
        ),
        oop_donk_frequency="occasional",
        oop_donk_rationale="OOP can lead on specific mid-high boards with strong two pairs or nut draws.",
        range_advantage="ip_moderate",
        nut_advantage="ip",
        key_concept=(
            "Mid-high boards are contested territory. IP has a range advantage "
            "but it is not as extreme as on A/K-high boards. "
            "Both players can have strong top pair and overpairs. "
            "C-betting frequencies and sizes are moderated vs ace-high boards."
        ),
        coaching_tags=["contested_board", "ip_moderate_advantage", "medium_cbet"],
    ),

    BoardFamily.MID_HIGH_WET: BoardTextureProfile(
        family=BoardFamily.MID_HIGH_WET,
        description=(
            "Mid-high connected or two-tone board (e.g., Q♠J♦T♥, J♠9♦8♠). "
            "Both players have many draws; straights and two pairs are common."
        ),
        ip_cbet_frequency="medium (50-65%)",
        ip_cbet_size="medium to large (50-75%)",
        ip_cbet_rationale=(
            "Wet mid-high boards require IP to charge draws and protect value. "
            "A medium-to-large size is needed because OOP has substantial draw equity "
            "that must be denied. IP checks more compared to dry mid-high boards."
        ),
        oop_donk_frequency="occasional",
        oop_donk_rationale="OOP has nut-adjacent draws and can lead with two pair+flush draw combo draws.",
        range_advantage="ip_moderate",
        nut_advantage="neutral",
        key_concept=(
            "Mid-high wet boards are the most balanced equity spots. "
            "Many hands from both ranges connect — both players have top pairs, "
            "draws, and two pairs. C-betting here requires a balanced approach: "
            "bet strong hands and selected draws large; check back medium-strength hands."
        ),
        coaching_tags=["highly_contested", "balanced_ranges", "draw_heavy", "charge_draws"],
    ),
}


def classify_board_family(
    high_card: str,         # "A", "K", "Q", "J", "T", "9"-"2"
    connectivity: str,      # "disconnected", "gutshot_only", "oesd_possible", "connected"
    suitedness: str,        # "rainbow", "two_tone", "monotone"
    is_paired: bool,
) -> BoardFamily:
    """
    Classify a board into its strategic family.

    Args:
        high_card:    Rank of highest board card (e.g., "A", "K", "9")
        connectivity: Board connectivity classification
        suitedness:   Suit distribution
        is_paired:    Whether the board has a pair

    Returns:
        BoardFamily enum value
    """
    if is_paired:
        return BoardFamily.PAIRED_BOARD

    if suitedness == "monotone":
        return BoardFamily.MONOTONE

    is_connected = connectivity in ("oesd_possible", "connected")
    is_dry = connectivity in ("disconnected", "gutshot_only")

    high_card_upper = high_card.upper()

    # Map rank to category
    if high_card_upper == "A":
        return BoardFamily.A_HIGH_WET if is_connected else BoardFamily.A_HIGH_DRY
    if high_card_upper == "K":
        return BoardFamily.K_HIGH_WET if is_connected else BoardFamily.K_HIGH_DRY
    if high_card_upper in ("Q", "J", "T"):
        return BoardFamily.MID_HIGH_WET if is_connected else BoardFamily.MID_HIGH_DRY
    # Low boards (9 and below)
    return BoardFamily.LOW_CONNECTED if is_connected else BoardFamily.MID_HIGH_DRY


class DonkBetFrequencyClass(str, Enum):
    NONE       = "none"        # 0–10%: almost never donk
    LOW        = "low"         # 10–25%: occasional donk
    MID        = "mid"         # 25–50%: situational donk
    HIGH       = "high"        # 50%+: dominant donk strategy


def donk_bet_frequency_class(board_family: BoardFamily) -> DonkBetFrequencyClass:
    """
    Return the expected donk-bet frequency class for OOP on a given board family.

    This is an original heuristic mapping derived from the strategic profiles above.
    """
    mapping = {
        BoardFamily.A_HIGH_DRY:    DonkBetFrequencyClass.NONE,
        BoardFamily.A_HIGH_WET:    DonkBetFrequencyClass.LOW,
        BoardFamily.K_HIGH_DRY:    DonkBetFrequencyClass.NONE,
        BoardFamily.K_HIGH_WET:    DonkBetFrequencyClass.LOW,
        BoardFamily.MID_HIGH_DRY:  DonkBetFrequencyClass.LOW,
        BoardFamily.MID_HIGH_WET:  DonkBetFrequencyClass.LOW,
        BoardFamily.LOW_CONNECTED: DonkBetFrequencyClass.HIGH,
        BoardFamily.LOW_PAIRED:    DonkBetFrequencyClass.LOW,
        BoardFamily.PAIRED_BOARD:  DonkBetFrequencyClass.LOW,
        BoardFamily.MONOTONE:      DonkBetFrequencyClass.NONE,
    }
    return mapping.get(board_family, DonkBetFrequencyClass.NONE)


def get_board_profile(board_family: BoardFamily) -> Optional[BoardTextureProfile]:
    """Return the full strategic profile for a board family."""
    return BOARD_TEXTURE_PROFILES.get(board_family)
