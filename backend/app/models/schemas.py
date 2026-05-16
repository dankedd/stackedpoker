from __future__ import annotations
from pydantic import BaseModel, Field
from typing import Literal


# ── Input ──────────────────────────────────────────────────────────────────

class HandAnalysisRequest(BaseModel):
    hand_text: str = Field(..., min_length=50, description="Raw hand history text")
    game_type: str | None = Field(None, description="Game format selected by user (e.g. Hold'em, PLO)")
    player_count: int | None = Field(None, ge=1, le=9, description="Table size selected by user")


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
    size_bb: float | None = None   # for raises: "to" total; for calls/bets: additional
    additional_bb: float | None = None  # net new chips committed (set by pot engine)
    is_hero: bool = False
    is_all_in: bool = False        # player commits remaining chips


class ParseDiagnostics(BaseModel):
    sections_found: list[str] = Field(default_factory=list)
    sections_missing: list[str] = Field(default_factory=list)
    actions_parsed: int = 0
    board_cards_parsed: int = 0
    hero_cards_found: bool = False
    recovered_actions: int = 0
    warnings: list[str] = Field(default_factory=list)
    errors: list[str] = Field(default_factory=list)
    is_partial: bool = False


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
    parse_diagnostics: ParseDiagnostics | None = None


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
    validation: ValidationInfo | None = None
    replay: ReplayAnalysis | None = None
    saved_id: str | None = None      # set after Supabase persist; None = save failed
    save_error: str | None = None    # exact Supabase/network error if save failed


class ParseResponse(BaseModel):
    parsed_hand: ParsedHand


# ── Replay / vision analysis ───────────────────────────────────────────────

class ReplayFeedback(BaseModel):
    rating: Literal["good", "okay", "mistake"]
    title: str
    explanation: str
    gto_note: str | None = None


class PreferredAction(BaseModel):
    action: str
    frequency: int = Field(..., ge=0, le=100)


class ActionCoaching(BaseModel):
    score: int = Field(..., ge=0, le=100)
    quality: Literal["Elite", "Good", "Standard", "Mistake", "Punt"]
    mistake_level: Literal["None", "Minor", "Major", "Critical"]
    preferred_actions: list[PreferredAction] = Field(default_factory=list)
    reason_codes: list[str] = Field(default_factory=list)
    explanation: str
    adjustment: str


class SidePotSchema(BaseModel):
    amount: float
    eligible_players: list[str] = Field(default_factory=list)


class ReplayAction(BaseModel):
    id: int
    street: Literal["preflop", "flop", "turn", "river"]
    player: str
    action: str
    amount: str | None = None
    pot_after: float
    hero_stack_after: float | None = None    # hero's stack after this action (BB)
    villain_stack_after: float | None = None  # primary villain's stack after this action (BB)
    # Extended pot-engine fields (all optional for backward compatibility)
    player_stacks_after: dict[str, float] | None = None   # full stack map after this action
    is_all_in: bool = False                               # this action went all-in
    all_in_players: list[str] = Field(default_factory=list)  # cumulative all-in roster
    main_pot: float | None = None                         # main pot amount
    side_pots: list[SidePotSchema] = Field(default_factory=list)  # side pots (multiway)
    uncalled_bet: float = 0.0                             # chips returned to aggressor
    is_hero: bool
    feedback: ReplayFeedback | None = None
    coaching: ActionCoaching | None = None


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


# ── Session analysis ───────────────────────────────────────────────────────

class SessionAnalysisRequest(BaseModel):
    session_text: str = Field(..., min_length=100, description="Full session text containing multiple hands")
    game_type: str | None = Field(None)
    player_count: int | None = Field(None, ge=1, le=9)


class SessionHandCandidate(BaseModel):
    hand_text: str
    hand_index: int
    stakes: str
    hero_position: str
    positions: str
    pot_bb: float
    street_depth: str
    reason: str
    severity: Literal["high", "medium", "low"]
    effective_stack_bb: float = 0.0
    # Optional tournament-specific fields (defaults keep session analysis unchanged)
    blind_level: str = ""
    tournament_stage: str = ""   # deep / middle / short / push_fold
    is_all_in: bool = False
    big_blind: float = 0.0       # raw BB value; non-zero for tournament hands only


class SessionStats(BaseModel):
    total_hands_found: int
    hands_parsed: int
    avg_pot_bb: float
    biggest_pot_bb: float
    hero_vpip_pct: float
    hero_aggression_pct: float
    ai_summary: str


class SessionAnalysisResponse(BaseModel):
    total_hands_found: int
    hands_parsed: int
    selected_hands: list[SessionHandCandidate]
    all_hands: list[SessionHandCandidate] = []
    session_stats: SessionStats
    saved_id: str | None = None      # set after Supabase persist; None = save failed
    save_error: str | None = None    # exact error detail if save failed


# ── Tournament analysis ────────────────────────────────────────────────────

class TournamentAnalysisRequest(BaseModel):
    tournament_text: str = Field(..., min_length=100, description="Full tournament hand history text")
    tournament_type: str = "MTT"       # MTT, SNG, Bounty, Hyper Turbo, Satellite
    field_size: str = ""               # "< 50", "50–200", "200–1000", "1000+"
    buy_in: str = ""                   # e.g. "$5+$0.50"
    game_type: str | None = None


class TournamentStats(BaseModel):
    total_hands_found: int = 0
    hands_parsed: int = 0
    tournament_type: str = ""
    field_size: str = ""
    buy_in: str = ""
    # Stack analysis
    avg_stack_bb: float = 0.0
    peak_stack_bb: float = 0.0
    starting_stack_bb: float = 0.0
    ending_stack_bb: float = 0.0
    avg_pot_bb: float = 0.0
    biggest_pot_bb: float = 0.0
    # Chip-level equivalents (avg_stack_chips = avg_stack_bb * actual_bb per hand)
    avg_stack_chips: float = 0.0
    biggest_pot_chips: float = 0.0
    avg_big_blind: float = 0.0      # average BB across all hands; ≈1 means parser fallback fired
    # Stage distribution (% of hands at each depth)
    deep_handed_pct: int = 0     # > 50bb
    middle_pct: int = 0          # 25–50bb
    short_stack_pct: int = 0     # 15–25bb
    push_fold_pct: int = 0       # < 15bb
    # Key spots
    all_in_spots: int = 0
    three_bet_count: int = 0
    # Poker stats
    hero_vpip_pct: float = 0.0
    hero_aggression_pct: float = 0.0
    # AI coaching
    ai_summary: str = ""


class TournamentAnalysisResponse(BaseModel):
    total_hands_found: int = 0
    hands_parsed: int = 0
    selected_hands: list[SessionHandCandidate] = Field(default_factory=list)
    all_hands: list[SessionHandCandidate] = Field(default_factory=list)
    tournament_stats: TournamentStats = Field(default_factory=TournamentStats)
    saved_id: str | None = None
    save_error: str | None = None


# ── Player Profile schemas ─────────────────────────────────────────────────

class PositionStat(BaseModel):
    position: str
    hands: int = 0
    avg_score: float = 0.0
    mistakes_per_hand: float = 0.0
    ev_loss_bb: float = 0.0


class StreetMistakes(BaseModel):
    preflop: int = 0
    flop: int = 0
    turn: int = 0
    river: int = 0
    other: int = 0


class ScoreTrendPoint(BaseModel):
    date: str
    score: float
    hand_id: str = ""


class PlayerStats(BaseModel):
    total_hands: int = 0
    avg_score: float = 0.0
    vpip_pct: float = 0.0
    pfr_pct: float = 0.0
    three_bet_pct: float = 0.0
    avg_mistakes_per_hand: float = 0.0
    total_ev_loss_bb: float = 0.0
    position_stats: list[PositionStat] = Field(default_factory=list)
    srp_score: float = 0.0
    three_bet_pot_score: float = 0.0
    four_bet_pot_score: float = 0.0
    deep_score: float = 0.0
    medium_score: float = 0.0
    short_score: float = 0.0
    street_mistakes: StreetMistakes = Field(default_factory=StreetMistakes)
    ip_score: float = 0.0
    oop_score: float = 0.0
    score_trend: list[ScoreTrendPoint] = Field(default_factory=list)
    cash_hands: int = 0
    tournament_hands: int = 0
    cash_avg_score: float = 0.0
    tournament_avg_score: float = 0.0
    pfr_score: float = 0.0
    caller_score: float = 0.0


class PlayerLeak(BaseModel):
    id: str
    category: str
    title: str
    description: str
    severity: Literal["critical", "major", "minor"]
    frequency: int = 0
    ev_loss_bb: float = 0.0
    street: str = "various"
    example_hand_ids: list[str] = Field(default_factory=list)
    coaching_note: str = ""


class CoachingAdvice(BaseModel):
    priority: int
    headline: str
    detail: str
    category: str
    example: str | None = None
    hand_reference: str | None = None


class StudyArticle(BaseModel):
    title: str
    concept: str
    explanation: str
    difficulty: str = "intermediate"


class StudyRecommendation(BaseModel):
    leak_category: str
    leak_title: str
    puzzle_tags: list[str] = Field(default_factory=list)
    puzzle_count_target: int = 5
    drill_description: str = ""
    gto_concept: str = ""
    articles: list[StudyArticle] = Field(default_factory=list)


class PlayerProfile(BaseModel):
    user_id: str
    generated_at: str
    style: str = "Unknown"
    style_description: str = ""
    skill_level: str = "beginner"
    overall_score: float = 0.0
    sample_size: int = 0
    data_quality: str = "insufficient"
    stats: PlayerStats = Field(default_factory=PlayerStats)
    leaks: list[PlayerLeak] = Field(default_factory=list)
    coaching_advice: list[CoachingAdvice] = Field(default_factory=list)
    study_recommendations: list[StudyRecommendation] = Field(default_factory=list)
    strengths: list[str] = Field(default_factory=list)
    weaknesses: list[str] = Field(default_factory=list)
    tilt_indicators: list[str] = Field(default_factory=list)
    ai_summary: str = ""


class PuzzleCompletionRequest(BaseModel):
    puzzle_id: str
    difficulty: str
    category: str
    score: int = Field(..., ge=0, le=100)
    ev_loss_bb: float = 0.0
    tags: list[str] = Field(default_factory=list)
