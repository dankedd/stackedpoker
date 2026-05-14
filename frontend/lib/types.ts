export interface BoardCards {
  flop: string[];
  turn: string[];
  river: string[];
}

export interface PlayerInfo {
  name: string;
  seat: number;
  stack_bb: number;
  position: string;
}

export interface HandAction {
  street: "preflop" | "flop" | "turn" | "river";
  player: string;
  action: "fold" | "check" | "call" | "bet" | "raise";
  size_bb: number | null;
  is_hero: boolean;
}

export interface ParsedHand {
  site: "GGPoker" | "PokerStars" | "Unknown";
  game_type: string;
  stakes: string;
  hand_id: string;
  hero_name: string;
  hero_position: string;
  effective_stack_bb: number;
  hero_cards: string[];
  board: BoardCards;
  players: PlayerInfo[];
  actions: HandAction[];
  pot_size_bb: number;
  big_blind: number;
}

export interface SpotClassification {
  pot_type: "SRP" | "3bet" | "4bet";
  position_matchup: string;
  stack_depth: "deep" | "medium" | "short";
  spot_id: string;
  ip_player: string;
  oop_player: string;
  hero_is_ip: boolean;
  hero_is_pfr: boolean;
}

export interface BoardTexture {
  bucket: string;
  high_card_rank: string;
  connectivity: "disconnected" | "gutshot" | "oesd" | "connected";
  wetness: "dry" | "semi_wet" | "wet";
  suitedness: "rainbow" | "two_tone" | "monotone";
  is_paired: boolean;
  description: string;
  range_advantage: "pfr" | "caller" | "neutral";
}

export interface HeuristicFinding {
  severity: "mistake" | "suboptimal" | "good" | "note";
  street: string;
  action_taken: string;
  recommendation: string;
  explanation: string;
  freq_recommendation: string | null;
}

// ── Replay / vision analysis ─────────────────────────────────────────────

export interface ReplayFeedback {
  rating: "good" | "okay" | "mistake";
  title: string;
  explanation: string;
  gto_note?: string;
}

export interface PreferredAction {
  action: string;
  frequency: number;
}

export interface ActionCoaching {
  score: number;
  quality: "Elite" | "Good" | "Standard" | "Mistake" | "Punt";
  mistake_level: "None" | "Minor" | "Major" | "Critical";
  preferred_actions: PreferredAction[];
  reason_codes: string[];
  explanation: string;
  adjustment: string;
}

export interface ReplayAction {
  id: number;
  street: "preflop" | "flop" | "turn" | "river";
  player: string;
  action: string;
  amount?: string;
  pot_after: number;
  is_hero: boolean;
  feedback?: ReplayFeedback;
  coaching?: ActionCoaching;
}

export interface SeatedPlayer {
  name: string;
  position: string;
  stack_bb?: number;
  hole_cards?: string[];
  is_hero: boolean;
  seat_index: number;   // 0 = hero, 1..N-1 clockwise around table
}

export interface HandSummaryData {
  stakes: string;
  hero_position: string;
  hero_cards: string[];
  villain_position?: string;
  villain_cards?: string[];
  effective_stack_bb: number;
  board: {
    flop: string[];
    turn: string[];
    river: string[];
  };
  big_blind?: number;   // big blind in currency units (1.0 = unknown/bb-native)
  currency?: string;    // "USD", "EUR", "" = unitless
  players?: SeatedPlayer[];   // full clockwise seat topology (hero at index 0)
  player_count?: number;      // table_max_seats — total seats including empty ones
}

export interface OverallVerdict {
  score: number;
  title: string;
  summary: string;
  key_mistakes: string[];
  key_strengths: string[];
}

export interface ReplayAnalysis {
  hand_summary: HandSummaryData;
  actions: ReplayAction[];
  overall_verdict: OverallVerdict;
}

// ── Two-step extraction + confirmation pipeline ────────────────────────────

export interface ExtractedCard {
  card: string;
  confidence: number;
}

export interface ExtractedPlayer {
  name: string;
  position_raw: string;
  position: string;
  position_confidence: number;
  cards: ExtractedCard[];
  stack_text: string | null;
  stack_bb: number | null;
  is_hero: boolean;
  hero_confidence: number;
  hero_signals: string[];
}

export interface ExtractedAction {
  player_name: string;
  action: string;
  amount_text: string | null;    // raw OCR text: "$1.23", "3bb", "100"
  amount_usd?: number | null;    // currency value (null if amount was already in bb)
  amount_bb: number | null;      // normalized big-blind value (always correct)
  street: "preflop" | "flop" | "turn" | "river";
  sequence_idx: number;
}

export interface ExtractionResult {
  players: ExtractedPlayer[];
  actions: ExtractedAction[];
  board: { flop: string[]; turn: string[]; river: string[] };
  pot_text: string | null;
  stakes: string | null;
  big_blind: number | null;     // parsed big blind in currency units
  currency: string;             // "USD", "EUR", "" = unitless
  effective_stack_bb: number;
  overall_confidence: number;
  hero_detected_by: string;
  warnings: string[];
  errors: string[];
  ocr_available: boolean;
  preprocessing_applied: string[];
}

export interface ConfirmedPokerState {
  hero_name: string;
  hero_position: string;
  hero_cards: string[];
  hero_stack_bb: number;
  villain_name: string | null;
  villain_position: string | null;
  villain_cards: string[];
  board: { flop: string[]; turn: string[]; river: string[] };
  stakes: string | null;
  effective_stack_bb: number;
  actions: ExtractedAction[];
}

export interface ValidationInfo {
  confidence: number;         // 0.0–1.0
  hero_detected_by: string;   // detection method used
  warnings: string[];
  errors: string[];
  is_valid: boolean;
}

export interface VisionAnalysisResponse {
  filename: string;
  mime_type: string;
  file_size_bytes: number;
  analysis: ReplayAnalysis;
  validation: ValidationInfo;
}

// ── Session analysis ──────────────────────────────────────────────────────

export interface SessionHandCandidate {
  hand_text: string;
  hand_index: number;
  stakes: string;
  hero_position: string;
  positions: string;
  pot_bb: number;
  street_depth: string;
  reason: string;
  severity: "high" | "medium" | "low";
  effective_stack_bb: number;
  // Optional tournament fields
  blind_level?: string;
  tournament_stage?: string;   // "deep" | "middle" | "short" | "push_fold"
  is_all_in?: boolean;
  big_blind?: number;          // raw BB value; non-zero for tournament hands
}

export interface SessionStats {
  total_hands_found: number;
  hands_parsed: number;
  avg_pot_bb: number;
  biggest_pot_bb: number;
  hero_vpip_pct: number;
  hero_aggression_pct: number;
  ai_summary: string;
}

export interface SessionAnalysisResponse {
  total_hands_found: number;
  hands_parsed: number;
  selected_hands: SessionHandCandidate[];
  all_hands: SessionHandCandidate[];
  session_stats: SessionStats;
  saved_id?: string | null;
  save_error?: string | null;
}

// ── Tournament analysis ───────────────────────────────────────────────────

export interface TournamentStats {
  total_hands_found: number;
  hands_parsed: number;
  tournament_type: string;
  field_size: string;
  buy_in: string;
  avg_stack_bb: number;
  peak_stack_bb: number;
  starting_stack_bb: number;
  ending_stack_bb: number;
  avg_pot_bb: number;
  biggest_pot_bb: number;
  // Chip-level equivalents; only meaningful when avg_big_blind > 1
  avg_stack_chips?: number;
  biggest_pot_chips?: number;
  avg_big_blind?: number;
  deep_handed_pct: number;
  middle_pct: number;
  short_stack_pct: number;
  push_fold_pct: number;
  all_in_spots: number;
  three_bet_count: number;
  hero_vpip_pct: number;
  hero_aggression_pct: number;
  ai_summary: string;
}

export interface TournamentAnalysisResponse {
  total_hands_found: number;
  hands_parsed: number;
  selected_hands: SessionHandCandidate[];
  all_hands: SessionHandCandidate[];
  tournament_stats: TournamentStats;
  saved_id?: string | null;
  save_error?: string | null;
}

export interface AnalysisResponse {
  parsed_hand: ParsedHand;
  spot_classification: SpotClassification;
  board_texture: BoardTexture;
  findings: HeuristicFinding[];
  overall_score: number;
  ai_coaching: string;
  mistakes_count: number;
  recommendations: string[];
  replay?: ReplayAnalysis;
  saved_id?: string | null;
  save_error?: string | null;
}
