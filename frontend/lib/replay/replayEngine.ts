/**
 * replayEngine.ts — Deterministic poker replay state machine.
 *
 * Works exclusively with CanonicalHand (the single source of truth).
 * The render map (SEAT_COORDS) is COMPLETELY SEPARATE from this engine.
 * Action order is determined solely by poker rules, never by seat layout.
 *
 * Action order rules:
 *   Preflop (N >= 3): UTG → HJ → CO → BTN → SB → BB
 *   Preflop (N = 2):  BTN/SB → BB
 *   Postflop:         First active left of BTN (OOP first)
 *     Order: SB → BB → UTG → UTG+1 → UTG+2 → LJ → HJ → CO → BTN
 *
 * State at actionIndex N means actions[0..N] have been applied.
 * State at actionIndex -1 is the initial state (blinds posted, no voluntary actions).
 *
 * Engine output is purely derived from CanonicalAction data —
 * stack_before_bb, stack_after_bb, pot_before_bb, pot_after_bb are authoritative.
 */

import type {
  CanonicalHand,
  CanonicalAction,
  CanonicalCard,
  CanonicalStreetName,
} from "@/lib/hand-schema";

// ── Public types ──────────────────────────────────────────────────────────────

export interface ReplayPlayerState {
  playerId: string;
  playerName: string;
  position: string;
  stack_bb: number;       // current stack after applied actions
  startStack_bb: number;  // stack at hand start (from CanonicalPlayer)
  isFolded: boolean;
  isAllIn: boolean;
  isHero: boolean;
  isActive: boolean;      // false if folded or all-in
  holeCards: CanonicalCard[];
}

export interface ReplayEngineState {
  /** Index of last applied action in flatActions. -1 = initial (no actions applied). */
  actionIndex: number;
  totalActions: number;

  /** Current street derived from the last applied action (or preflop at start). */
  street: CanonicalStreetName;

  /** Board cards visible at this point (flop/turn/river revealed as streets are reached). */
  boardCards: CanonicalCard[];

  /** Pot size in BB after all applied actions. */
  pot_bb: number;

  /** Per-player state after all applied actions. */
  players: ReplayPlayerState[];

  /** Player who acts NEXT (null at end of hand). Determined from flatActions[actionIndex + 1]. */
  activePlayerId: string | null;

  /** The action that was just applied (null at initial state). */
  lastAction: CanonicalAction | null;

  /** True if no actions have been applied yet. */
  isInitial: boolean;

  /** True if all actions have been applied. */
  isFinal: boolean;

  /** Debug info (only populated when engine created with debugMode=true). */
  debug?: ReplayDebugInfo;
}

export interface ReplayDebugInfo {
  actionIndex: number;
  totalActions: number;
  activePlayerId: string | null;
  foldedPlayerIds: string[];
  allInPlayerIds: string[];
  pot_bb: number;
  stacks: Record<string, number>;
  street: CanonicalStreetName;
  lastActionSummary: string | null;
}

export interface ReplayValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// ── Postflop action order (OOP first) ────────────────────────────────────────

const _POSTFLOP_ORDER: readonly string[] = [
  "SB", "BB", "UTG", "UTG+1", "UTG+2", "LJ", "HJ", "CO", "BTN",
] as const;

// ── Engine ────────────────────────────────────────────────────────────────────

export class ReplayEngine {
  private readonly hand: CanonicalHand;
  /**
   * Flat ordered list of all voluntary actions (excludes blind/ante posting).
   * Sorted by sequence number from the canonical hand — the authoritative order.
   */
  readonly flatActions: ReadonlyArray<CanonicalAction>;

  private _actionIndex: number;
  private readonly _debugMode: boolean;

  constructor(hand: CanonicalHand, debugMode = false) {
    this.hand = hand;
    this._debugMode = debugMode;
    this._actionIndex = -1;

    // Flatten all streets' actions, exclude blind posting, sort by sequence.
    // Sequence numbers from the backend normalizer are the authoritative order.
    this.flatActions = hand.streets
      .flatMap(s => s.actions)
      .filter(a => !_isBlindAction(a.action))
      .sort((a, b) => a.sequence - b.sequence);
  }

  get currentActionIndex(): number {
    return this._actionIndex;
  }

  get totalActions(): number {
    return this.flatActions.length;
  }

  // ── Navigation ───────────────────────────────────────────────────────────────

  initialize(): ReplayEngineState {
    this._actionIndex = -1;
    return this.getCurrentState();
  }

  getCurrentState(): ReplayEngineState {
    return this._buildState(this._actionIndex);
  }

  nextAction(): ReplayEngineState {
    if (this._actionIndex < this.totalActions - 1) {
      this._actionIndex++;
    }
    return this.getCurrentState();
  }

  previousAction(): ReplayEngineState {
    if (this._actionIndex > -1) {
      this._actionIndex--;
    }
    return this.getCurrentState();
  }

  jumpToAction(index: number): ReplayEngineState {
    this._actionIndex = Math.max(-1, Math.min(index, this.totalActions - 1));
    return this.getCurrentState();
  }

  /**
   * Jump to the state just BEFORE the first action of the given street.
   * Landing here reveals that street's board cards on the next nextAction() call.
   */
  jumpToStreet(street: CanonicalStreetName): ReplayEngineState {
    const firstIdx = this.flatActions.findIndex(a => a.street === street);
    if (firstIdx === -1) {
      // Street not present — jump to end
      this._actionIndex = this.totalActions - 1;
    } else {
      // Land just before the street starts
      this._actionIndex = firstIdx - 1;
    }
    return this.getCurrentState();
  }

  reset(): ReplayEngineState {
    return this.initialize();
  }

  // ── State construction ────────────────────────────────────────────────────────

  private _buildState(actionIndex: number): ReplayEngineState {
    // Actions applied so far: flatActions[0..actionIndex]
    const appliedCount = actionIndex + 1;
    const appliedActions: ReadonlyArray<CanonicalAction> =
      appliedCount > 0 ? this.flatActions.slice(0, appliedCount) : [];

    const lastAction: CanonicalAction | null =
      appliedActions.length > 0
        ? appliedActions[appliedActions.length - 1]
        : null;

    // Street
    const street: CanonicalStreetName = lastAction?.street ?? "preflop";

    // Board cards: reveal all board cards for streets that have been reached
    const boardCards = this._computeBoardCards(street, appliedActions);

    // Pot: authoritative from last applied action, or initial blind pot
    const pot_bb: number = lastAction?.pot_after_bb
      ?? this.hand.streets[0]?.pot_start_bb
      ?? 1.5;

    // Player states derived from applied actions
    const players = this._computePlayerStates(appliedActions);

    // Active player: who acts next
    const nextAction =
      actionIndex < this.totalActions - 1
        ? this.flatActions[actionIndex + 1]
        : null;
    const activePlayerId = nextAction?.player_id ?? null;

    const isInitial = actionIndex === -1;
    const isFinal = actionIndex >= this.totalActions - 1;

    const state: ReplayEngineState = {
      actionIndex,
      totalActions: this.totalActions,
      street,
      boardCards,
      pot_bb,
      players,
      activePlayerId,
      lastAction,
      isInitial,
      isFinal,
    };

    if (this._debugMode) {
      state.debug = this._buildDebugInfo(actionIndex, players, activePlayerId, pot_bb, street, lastAction);
    }

    return state;
  }

  private _computePlayerStates(
    appliedActions: ReadonlyArray<CanonicalAction>,
  ): ReplayPlayerState[] {
    // Build lookup: player_id → most recent stack_after_bb
    const stackMap = new Map<string, number>();
    const foldedSet = new Set<string>();
    const allInSet = new Set<string>();

    // Seed with starting stacks
    for (const p of this.hand.players) {
      stackMap.set(p.id, p.stack_bb);
    }

    // Apply each action in order — later actions overwrite earlier ones per player
    for (const action of appliedActions) {
      stackMap.set(action.player_id, action.stack_after_bb);
      if (action.action === "fold") {
        foldedSet.add(action.player_id);
      }
      if (action.is_all_in) {
        allInSet.add(action.player_id);
      }
    }

    return this.hand.players.map(p => {
      const isFolded = foldedSet.has(p.id);
      const isAllIn = allInSet.has(p.id);
      return {
        playerId: p.id,
        playerName: p.name,
        position: p.position,
        stack_bb: stackMap.get(p.id) ?? p.stack_bb,
        startStack_bb: p.stack_bb,
        isFolded,
        isAllIn,
        isHero: p.is_hero,
        isActive: !isFolded && !isAllIn,
        holeCards: p.hole_cards,
      };
    });
  }

  private _computeBoardCards(
    currentStreet: CanonicalStreetName,
    appliedActions: ReadonlyArray<CanonicalAction>,
  ): CanonicalCard[] {
    const streetOrder: CanonicalStreetName[] = ["preflop", "flop", "turn", "river"];
    const currentStreetIdx = streetOrder.indexOf(currentStreet);

    const cards: CanonicalCard[] = [];
    for (const s of this.hand.streets) {
      if (s.name === "preflop") continue; // No board cards on preflop
      const sIdx = streetOrder.indexOf(s.name);
      if (sIdx > currentStreetIdx) continue; // Future street — don't reveal

      // Reveal this street's cards if we have at least one applied action at or past this street
      const hasReachedStreet = appliedActions.some(a => {
        const aIdx = streetOrder.indexOf(a.street);
        return aIdx >= sIdx;
      });
      if (hasReachedStreet) {
        cards.push(...s.board_cards);
      }
    }
    return cards;
  }

  private _buildDebugInfo(
    actionIndex: number,
    players: ReplayPlayerState[],
    activePlayerId: string | null,
    pot_bb: number,
    street: CanonicalStreetName,
    lastAction: CanonicalAction | null,
  ): ReplayDebugInfo {
    const foldedPlayerIds = players.filter(p => p.isFolded).map(p => p.playerId);
    const allInPlayerIds = players.filter(p => p.isAllIn).map(p => p.playerId);
    const stacks = Object.fromEntries(players.map(p => [p.playerId, p.stack_bb]));

    let lastActionSummary: string | null = null;
    if (lastAction) {
      const amountStr = lastAction.amount_bb > 0
        ? ` ${lastAction.amount_bb.toFixed(2)}bb`
        : "";
      lastActionSummary = `[${lastAction.sequence}] ${lastAction.player_name} ${lastAction.action}${amountStr}`;
    }

    return {
      actionIndex,
      totalActions: this.totalActions,
      activePlayerId,
      foldedPlayerIds,
      allInPlayerIds,
      pot_bb,
      stacks,
      street,
      lastActionSummary,
    };
  }
}

// ── Validation ────────────────────────────────────────────────────────────────

/**
 * Validates a CanonicalHand for replay soundness.
 * Checks structural invariants — does NOT re-run the full canonical validator.
 *
 * Call this before creating a ReplayEngine to surface data quality issues
 * that would produce incorrect replays.
 */
export function validateReplayability(hand: CanonicalHand): ReplayValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // ── Structural requirements ──────────────────────────────────────────────────

  if (!hand.players || hand.players.length < 2) {
    errors.push(`Hand must have at least 2 players (got ${hand.players?.length ?? 0})`);
  }

  if (!hand.streets || hand.streets.length === 0) {
    errors.push("Hand has no streets");
    return { valid: false, errors, warnings };
  }

  const allActions = hand.streets.flatMap(s => s.actions);
  if (allActions.length === 0) {
    errors.push("Hand has no actions");
    return { valid: false, errors, warnings };
  }

  // ── Hero check ───────────────────────────────────────────────────────────────

  const heroPlayer = hand.players.find(p => p.id === hand.hero_id);
  if (!heroPlayer) {
    warnings.push("No hero player identified — replay will proceed without hero highlighting");
  }

  // ── Sequence monotonicity ────────────────────────────────────────────────────

  const sequences = allActions.map(a => a.sequence);
  for (let i = 1; i < sequences.length; i++) {
    if (sequences[i] <= sequences[i - 1]) {
      errors.push(
        `Action sequences not monotonically increasing: ${sequences[i - 1]} → ${sequences[i]} at index ${i}`,
      );
      break; // Report first occurrence only
    }
  }

  // ── All action player IDs exist ───────────────────────────────────────────────

  const playerIds = new Set(hand.players.map(p => p.id));
  const unknownPlayers = new Set<string>();
  for (const action of allActions) {
    if (!playerIds.has(action.player_id) && !unknownPlayers.has(action.player_id)) {
      errors.push(`Action #${action.sequence} references unknown player: ${action.player_id}`);
      unknownPlayers.add(action.player_id);
    }
  }

  // ── No action by folded player ────────────────────────────────────────────────

  const foldedSet = new Set<string>();
  for (const action of allActions) {
    if (
      foldedSet.has(action.player_id) &&
      !_isBlindAction(action.action) &&
      action.action !== "fold"
    ) {
      errors.push(
        `Player ${action.player_name} acted (${action.action}) after folding at sequence ${action.sequence}`,
      );
    }
    if (action.action === "fold") {
      foldedSet.add(action.player_id);
    }
  }

  // ── Pot and stack sanity ──────────────────────────────────────────────────────

  for (const action of allActions) {
    if (action.pot_after_bb < 0) {
      errors.push(
        `Negative pot at sequence ${action.sequence}: ${action.pot_after_bb.toFixed(2)}bb`,
      );
    }
    if (action.stack_after_bb < -0.01) {
      warnings.push(
        `Negative stack for ${action.player_name} at sequence ${action.sequence}: ` +
        `${action.stack_after_bb.toFixed(2)}bb`,
      );
    }
  }

  // ── Board card counts ────────────────────────────────────────────────────────

  for (const street of hand.streets) {
    if (street.name === "flop" && street.board_cards.length !== 3) {
      warnings.push(
        `Flop has ${street.board_cards.length} board cards (expected 3)`,
      );
    }
    if (street.name === "turn" && street.board_cards.length !== 1) {
      warnings.push(
        `Turn has ${street.board_cards.length} board cards (expected 1)`,
      );
    }
    if (street.name === "river" && street.board_cards.length !== 1) {
      warnings.push(
        `River has ${street.board_cards.length} board cards (expected 1)`,
      );
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function _isBlindAction(action: string): boolean {
  return (
    action === "post_sb" ||
    action === "post_bb" ||
    action === "post_ante" ||
    action === "post_straddle"
  );
}

/**
 * Returns the expected postflop action order for the given positions and table size.
 * Useful for validating whether the hand's postflop action sequence is correct.
 */
export function getExpectedPostflopOrder(positions: string[]): string[] {
  const result: string[] = [];
  for (const pos of _POSTFLOP_ORDER) {
    if (positions.includes(pos)) result.push(pos);
  }
  // Any positions not in the known order go last
  for (const pos of positions) {
    if (!result.includes(pos)) result.push(pos);
  }
  return result;
}

/**
 * Returns the expected preflop action order for N players at a standard table.
 * For N >= 3: UTG first, then clockwise to BTN, then SB, then BB.
 * For N = 2 (HU): BTN/SB acts first.
 */
export function getExpectedPreflopOrder(positions: string[], N: number): string[] {
  if (N <= 2) {
    const result: string[] = [];
    if (positions.includes("BTN")) result.push("BTN");
    if (positions.includes("BB")) result.push("BB");
    for (const p of positions) {
      if (!result.includes(p)) result.push(p);
    }
    return result;
  }

  // UTG-first order for N >= 3
  const UTG_FIRST_ORDER = ["UTG", "UTG+1", "UTG+2", "LJ", "HJ", "CO", "BTN", "SB", "BB"];
  const result: string[] = [];
  for (const pos of UTG_FIRST_ORDER) {
    if (positions.includes(pos)) result.push(pos);
  }
  for (const pos of positions) {
    if (!result.includes(pos)) result.push(pos);
  }
  return result;
}
