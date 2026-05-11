from __future__ import annotations
from pydantic import BaseModel, Field
from typing import Literal


# ── Input ──────────────────────────────────────────────────────────────────

class HandAnalysisRequest(BaseModel):
    hand_text: str = Field(..., min_length=50, description="Raw hand history text")


# ── Parsed hand ────────────────────────────────────────────────────────────

class BoardCards(BaseModel):
    flop: list[str] = Field(default_factory=list)
    turn: list[str] = Field(default_factory=list)
    river: list[str] = Field(default_factory=list)


class PlayerInfo(BaseModel):
    name: str
    seat: int
    stack_bb: float
    position: str


class HandAction(BaseModel):
    street: Literal["preflop", "flop", "turn", "river"]
    player: str
    action: Literal["fold", "check", "call", "bet", "raise"]
    size_bb: float | None = None
    is_hero: bool = False


class ParsedHand(BaseModel):
    site: Literal["GGPoker", "PokerStars", "Unknown"]
    game_type: str
    stakes: str
    hand_id: str
    hero_name: str
    hero_position: str
    effective_stack_bb: float
    hero_cards: list[str]
    board: BoardCards
    players: list[PlayerInfo]
    actions: list[HandAction]
    pot_size_bb: float
    big_blind: float
    table_max_seats: int = 6


# ── Spot classification ────────────────────────────────────────────────────

class SpotClassification(BaseModel):
    pot_type: Literal["SRP", "3bet", "4bet"]
    position_matchup: str
    stack_depth: Literal["deep", "medium", "short"]
    spot_id: str
    ip_player: str
    oop_player: str
    hero_is_ip: bool
    hero_is_pfr: bool


# ── Board texture ──────────────────────────────────────────────────────────

class BoardTexture(BaseModel):
    bucket: str
    high_card_rank: str
    connectivity: Literal["disconnected", "gutshot", "oesd", "connected"]
    wetness: Literal["dry", "semi_wet", "wet"]
    suitedness: Literal["rainbow", "two_tone", "monotone"]
    is_paired: bool
    description: str
    range_advantage: Literal["pfr", "caller", "neutral"]


# ── Heuristic findings ─────────────────────────────────────────────────────

class HeuristicFinding(BaseModel):
    severity: Literal["mistake", "suboptimal", "good", "note"]
    street: str
    action_taken: str
    recommendation: str
    explanation: str
    freq_recommendation: str | None = None


# ── Full analysis ──────────────────────────────────────────────────────────

class AnalysisResponse(BaseModel):
    parsed_hand: ParsedHand
    spot_classification: SpotClassification
    board_texture: BoardTexture
    findings: list[HeuristicFinding]
    overall_score: int = Field(..., ge=0, le=100)
    ai_coaching: str
    mistakes_count: int
    recommendations: list[str]
    replay: ReplayAnalysis | None = None


class ParseResponse(BaseModel):
    parsed_hand: ParsedHand


# ── Replay / vision analysis ───────────────────────────────────────────────

class ReplayFeedback(BaseModel):
    rating: Literal["good", "okay", "mistake"]
    title: str
    explanation: str
    gto_note: str | None = None


class ReplayAction(BaseModel):
    id: int
    street: Literal["preflop", "flop", "turn", "river"]
    player: str
    action: str
    amount: str | None = None
    pot_after: float
    is_hero: bool
    feedback: ReplayFeedback | None = None


class SeatedPlayer(BaseModel):
    name: str
    position: str
    stack_bb: float | None = None
    hole_cards: list[str] = Field(default_factory=list)
    is_hero: bool = False
    seat_index: int = 0         # 0 = hero seat, 1..N-1 = clockwise from hero


class HandSummaryData(BaseModel):
    stakes: str
    hero_position: str
    hero_cards: list[str]
    villain_position: str | None = None
    villain_cards: list[str] | None = None
    effective_stack_bb: float
    board: BoardCards
    big_blind: float = 1.0      # big blind in currency units (1.0 = unknown / bb-native)
    currency: str = ""          # "USD", "EUR", "" = unitless
    players: list[SeatedPlayer] = Field(default_factory=list)
    player_count: int = 2


class OverallVerdict(BaseModel):
    score: int = Field(..., ge=0, le=100)
    title: str
    summary: str
    key_mistakes: list[str] = Field(default_factory=list)
    key_strengths: list[str] = Field(default_factory=list)


class ReplayAnalysis(BaseModel):
    hand_summary: HandSummaryData
    actions: list[ReplayAction]
    overall_verdict: OverallVerdict


# ── Raw extraction schema (AI Phase 1 output) ──────────────────────────────

class RawPlayerSeen(BaseModel):
    label: str = Field(..., description="Exact player name / label visible on screen")
    position_label: str = Field(..., description="Exact position badge text (BB, SB, BTN, CO, HJ, LJ, UTG, …)")
    cards: list[str] = Field(default_factory=list, description="Face-up cards only")
    hero_signal: bool = Field(False, description="True if player has hero highlight / badge / YOU indicator")
    stack_text: str | None = Field(None, description="Raw stack size text as displayed")


class RawActionSeen(BaseModel):
    player_label: str = Field(..., description="Exact player label from action display")
    action: str = Field(..., description="fold / check / call / raise / bet / allin / post / blind")
    amount_text: str | None = Field(None, description="Raw amount text as shown on screen")
    street: Literal["preflop", "flop", "turn", "river"]


class RawExtraction(BaseModel):
    players: list[RawPlayerSeen]
    actions: list[RawActionSeen]
    flop: list[str] = Field(default_factory=list)
    turn: list[str] = Field(default_factory=list)
    river: list[str] = Field(default_factory=list)
    pot_text: str | None = None
    stakes_text: str | None = None
    extraction_confidence: float = Field(0.5, ge=0.0, le=1.0)
    extraction_notes: str | None = None


# ── Coaching schema (AI Phase 2 output) ───────────────────────────────────

class CoachingFeedbackItem(BaseModel):
    action_idx: int = Field(..., description="Index of the action in the full action list (0-based)")
    rating: Literal["good", "okay", "mistake"]
    title: str
    explanation: str
    gto_note: str | None = None


class CoachingOutput(BaseModel):
    action_feedback: list[CoachingFeedbackItem] = Field(default_factory=list)
    overall_verdict: OverallVerdict


# ── Pipeline validation result ─────────────────────────────────────────────

class ValidationInfo(BaseModel):
    confidence: float = Field(..., ge=0.0, le=1.0)
    hero_detected_by: str
    warnings: list[str] = Field(default_factory=list)
    errors: list[str] = Field(default_factory=list)
    is_valid: bool


class VisionAnalysisResponse(BaseModel):
    filename: str
    mime_type: str
    file_size_bytes: int
    analysis: ReplayAnalysis
    validation: ValidationInfo


# ── Two-step extraction + confirmation pipeline ────────────────────────────

class ExtractedCard(BaseModel):
    card: str
    confidence: float = Field(1.0, ge=0.0, le=1.0)


class ExtractedPlayer(BaseModel):
    name: str
    position_raw: str               # exact text from screenshot
    position: str                   # canonical (UTG / HJ / CO / BTN / SB / BB)
    position_confidence: float = Field(0.8, ge=0.0, le=1.0)
    cards: list[ExtractedCard] = Field(default_factory=list)
    stack_text: str | None = None
    stack_bb: float | None = None
    is_hero: bool = False
    hero_confidence: float = Field(0.5, ge=0.0, le=1.0)
    hero_signals: list[str] = Field(default_factory=list)


class ExtractedAction(BaseModel):
    player_name: str
    action: str
    amount_text: str | None = None          # raw OCR text: "$1.23", "3bb", "100"
    amount_usd: float | None = None         # currency value if amount_text had a symbol
    amount_bb: float | None = None          # normalized big-blind value (always correct)
    street: Literal["preflop", "flop", "turn", "river"]
    sequence_idx: int


class ExtractionResult(BaseModel):
    """Returned to frontend after Phase 1+2. User reviews and edits before confirming."""
    players: list[ExtractedPlayer]
    actions: list[ExtractedAction]
    board: BoardCards
    pot_text: str | None = None
    stakes: str | None = None
    big_blind: float | None = None      # parsed big blind in currency units
    currency: str = ""                  # detected currency code
    effective_stack_bb: float = 100.0
    overall_confidence: float = Field(0.5, ge=0.0, le=1.0)
    hero_detected_by: str = ""
    warnings: list[str] = Field(default_factory=list)
    errors: list[str] = Field(default_factory=list)
    ocr_available: bool = False
    preprocessing_applied: list[str] = Field(default_factory=list)


class ConfirmedPokerState(BaseModel):
    """User-validated state sent to backend for coaching + replay generation."""
    hero_name: str
    hero_position: str
    hero_cards: list[str]
    hero_stack_bb: float = 100.0
    villain_name: str | None = None
    villain_position: str | None = None
    villain_cards: list[str] = Field(default_factory=list)
    board: BoardCards
    stakes: str | None = None
    effective_stack_bb: float = 100.0
    actions: list[ExtractedAction]
    all_players: list[ExtractedPlayer] = Field(default_factory=list)


class HealthResponse(BaseModel):
    status: str
    version: str = "1.0.0"
