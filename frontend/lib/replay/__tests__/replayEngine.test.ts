/**
 * replayEngine.test.ts — Deterministic replay engine tests.
 *
 * Tests the ReplayEngine class and validateReplayability function.
 *
 * Engine actionIndex semantics:
 *   actionIndex = -1  → initial state (no voluntary actions applied)
 *   actionIndex = 0   → first voluntary action applied
 *   actionIndex = N   → actions[0..N] applied (N+1 total)
 *
 * Board cards are revealed when the first action of a street is applied.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { ReplayEngine, validateReplayability } from "../replayEngine";
import type { CanonicalHand, CanonicalAction, CanonicalPlayer, CanonicalStreet } from "@/lib/hand-schema";

// ── Fixture factories ─────────────────────────────────────────────────────────

let _seq = 0;
function resetSeq() { _seq = 0; }
function nextSeq() { return ++_seq; }

function makePlayer(
  id: string,
  name: string,
  position: string,
  stack_bb: number,
  is_hero = false,
): CanonicalPlayer {
  return {
    id,
    name,
    seat: 0,
    position,
    stack_bb,
    hole_cards: is_hero ? [{ rank: "A", suit: "h", notation: "Ah" }, { rank: "K", suit: "d", notation: "Kd" }] : [],
    is_hero,
    is_active: true,
  };
}

function makeAction(
  player_id: string,
  player_name: string,
  action: CanonicalAction["action"],
  street: CanonicalAction["street"],
  amount_bb: number,
  stack_before: number,
  pot_before: number,
  is_hero = false,
  is_all_in = false,
): CanonicalAction {
  const stack_after = action === "fold" ? stack_before : stack_before - amount_bb;
  const pot_after   = pot_before + amount_bb;
  return {
    sequence: nextSeq(),
    street,
    player_id,
    player_name,
    action,
    amount_bb,
    total_bet_bb: amount_bb,
    is_hero,
    is_all_in,
    stack_before_bb: stack_before,
    stack_after_bb: stack_after,
    pot_before_bb: pot_before,
    pot_after_bb: pot_after,
  };
}

function makeBlindAction(
  player_id: string,
  player_name: string,
  action: "post_sb" | "post_bb",
  amount_bb: number,
  stack: number,
): CanonicalAction {
  return {
    sequence: nextSeq(),
    street: "preflop",
    player_id,
    player_name,
    action,
    amount_bb,
    total_bet_bb: amount_bb,
    is_hero: false,
    is_all_in: false,
    stack_before_bb: stack,
    stack_after_bb: stack - amount_bb,
    pot_before_bb: 0,
    pot_after_bb: amount_bb,
  };
}

/**
 * Builds a standard 6-max CanonicalHand fixture.
 *
 * Table: UTG=100bb, HJ=100bb, CO=100bb, BTN=Hero=100bb, SB=100bb, BB=100bb
 * Preflop: UTG folds, HJ folds, CO raises 2.5bb, BTN (Hero) calls, SB folds, BB folds
 * Flop [Jh 8d 2c]: BB checks (before fold, just SB and BB), Hero bets 3bb
 * (simplified: only Hero and BB see the flop)
 */
function makeSixMaxHand(): CanonicalHand {
  resetSeq();

  const players: CanonicalPlayer[] = [
    makePlayer("seat_1", "UTGPlayer", "UTG",  100),
    makePlayer("seat_2", "HJPlayer",  "HJ",   100),
    makePlayer("seat_3", "COPlayer",  "CO",   100),
    makePlayer("seat_4", "Hero",      "BTN",  100, true),
    makePlayer("seat_5", "SBPlayer",  "SB",   100),
    makePlayer("seat_6", "BBPlayer",  "BB",   100),
  ];

  // Preflop street
  const preflopActions: CanonicalAction[] = [
    makeBlindAction("seat_5", "SBPlayer", "post_sb", 0.5, 100),
    makeBlindAction("seat_6", "BBPlayer", "post_bb", 1.0, 100),
    makeAction("seat_1", "UTGPlayer", "fold",  "preflop", 0,   100, 1.5),
    makeAction("seat_2", "HJPlayer",  "fold",  "preflop", 0,   100, 1.5),
    makeAction("seat_3", "COPlayer",  "raise", "preflop", 2.5, 100, 1.5),
    makeAction("seat_4", "Hero",      "call",  "preflop", 2.5,  100, 4.0, true),
    makeAction("seat_5", "SBPlayer",  "fold",  "preflop", 0,   99.5, 6.5),
    makeAction("seat_6", "BBPlayer",  "fold",  "preflop", 0,   99.0, 6.5),
  ];

  // Flop street [Jh 8d 2c]
  const flopActions: CanonicalAction[] = [
    makeAction("seat_3", "COPlayer",  "check", "flop", 0,    97.5, 7.5),
    makeAction("seat_4", "Hero",      "bet",   "flop", 3.0,  97.5, 7.5, true),
    makeAction("seat_3", "COPlayer",  "fold",  "flop", 0,    97.5, 10.5),
  ];

  const preflopStreet: CanonicalStreet = {
    name: "preflop",
    board_cards: [],
    pot_start_bb: 1.5,
    actions: preflopActions,
  };

  const flopStreet: CanonicalStreet = {
    name: "flop",
    board_cards: [
      { rank: "J", suit: "h", notation: "Jh" },
      { rank: "8", suit: "d", notation: "8d" },
      { rank: "2", suit: "c", notation: "2c" },
    ],
    pot_start_bb: 7.5,
    actions: flopActions,
  };

  return {
    schema_version: "1.0",
    hand_id: "test_6max_001",
    site: "PokerStars",
    game_type: "NLHE",
    is_tournament: false,
    stakes: {
      small_blind_bb: 0.5,
      big_blind: 1,
      ante_bb: 0,
      straddle_bb: 0,
      currency: "USD",
      display: "$0.50/$1.00",
    },
    table_name: "Test Table",
    table_max_seats: 6,
    players,
    hero_id: "seat_4",
    streets: [preflopStreet, flopStreet],
    showdown: null,
    effective_stack_bb: 100,
    final_pot_bb: 10.5,
    parse_source: "text_history",
    raw_text: null,
  };
}

// ── Tests: validateReplayability ──────────────────────────────────────────────

describe("validateReplayability", () => {
  it("valid hand passes", () => {
    const result = validateReplayability(makeSixMaxHand());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("empty players array fails", () => {
    const hand = makeSixMaxHand();
    hand.players = [];
    const result = validateReplayability(hand);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("at least 2 players"))).toBe(true);
  });

  it("single player fails", () => {
    const hand = makeSixMaxHand();
    hand.players = [hand.players[0]];
    const result = validateReplayability(hand);
    expect(result.valid).toBe(false);
  });

  it("no streets fails", () => {
    const hand = makeSixMaxHand();
    hand.streets = [];
    const result = validateReplayability(hand);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("no streets"))).toBe(true);
  });

  it("non-monotonic sequences detected", () => {
    const hand = makeSixMaxHand();
    // Swap two action sequences to break monotonicity
    const all = hand.streets.flatMap(s => s.actions);
    if (all.length >= 2) {
      const tmp = all[1].sequence;
      (all[1] as { sequence: number }).sequence = all[0].sequence;
      (all[0] as { sequence: number }).sequence = tmp;
    }
    const result = validateReplayability(hand);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("monotonically"))).toBe(true);
  });

  it("unknown player ID in action fails", () => {
    const hand = makeSixMaxHand();
    const preflopStreet = hand.streets[0];
    // Corrupt the first voluntary action's player_id
    const firstVoluntary = preflopStreet.actions.find(
      a => a.action !== "post_sb" && a.action !== "post_bb"
    );
    if (firstVoluntary) {
      (firstVoluntary as { player_id: string }).player_id = "seat_999";
    }
    const result = validateReplayability(hand);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("seat_999"))).toBe(true);
  });

  it("negative pot produces error", () => {
    const hand = makeSixMaxHand();
    const action = hand.streets[0].actions[2]; // first fold
    (action as { pot_after_bb: number }).pot_after_bb = -1;
    const result = validateReplayability(hand);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("Negative pot"))).toBe(true);
  });

  it("flop with wrong card count is a warning not an error", () => {
    const hand = makeSixMaxHand();
    hand.streets[1].board_cards = [{ rank: "J", suit: "h", notation: "Jh" }]; // only 1 card
    const result = validateReplayability(hand);
    expect(result.warnings.some(w => w.includes("Flop has 1 board cards"))).toBe(true);
    // Should still be valid (warning, not error)
    expect(result.valid).toBe(true);
  });
});

// ── Tests: ReplayEngine initialization ───────────────────────────────────────

describe("ReplayEngine: initialization", () => {
  let engine: ReplayEngine;

  beforeEach(() => {
    engine = new ReplayEngine(makeSixMaxHand());
    engine.initialize();
  });

  it("starts at actionIndex -1 (initial state)", () => {
    const state = engine.getCurrentState();
    expect(state.actionIndex).toBe(-1);
    expect(state.isInitial).toBe(true);
    expect(state.isFinal).toBe(false);
  });

  it("totalActions excludes blind postings", () => {
    // 6 preflop voluntary + 3 flop = 9 voluntary actions
    // (post_sb and post_bb are excluded)
    expect(engine.totalActions).toBe(9);
  });

  it("initial state has all players at starting stacks", () => {
    const state = engine.getCurrentState();
    for (const p of state.players) {
      expect(p.stack_bb).toBe(p.startStack_bb);
    }
  });

  it("initial state has no folded players", () => {
    const state = engine.getCurrentState();
    expect(state.players.every(p => !p.isFolded)).toBe(true);
  });

  it("initial board cards are empty", () => {
    const state = engine.getCurrentState();
    expect(state.boardCards).toHaveLength(0);
  });

  it("initial street is preflop", () => {
    const state = engine.getCurrentState();
    expect(state.street).toBe("preflop");
  });

  it("lastAction is null at initial state", () => {
    const state = engine.getCurrentState();
    expect(state.lastAction).toBeNull();
  });

  it("activePlayerId points to first voluntary action's player", () => {
    const state = engine.getCurrentState();
    // First voluntary action after blinds is UTG fold
    expect(state.activePlayerId).toBe("seat_1");
  });
});

// ── Tests: Action application ─────────────────────────────────────────────────

describe("ReplayEngine: action application", () => {
  let engine: ReplayEngine;

  beforeEach(() => {
    engine = new ReplayEngine(makeSixMaxHand());
    engine.initialize();
  });

  it("nextAction applies the first action", () => {
    const state = engine.nextAction();
    expect(state.actionIndex).toBe(0);
    expect(state.lastAction).not.toBeNull();
    expect(state.lastAction!.player_name).toBe("UTGPlayer");
    expect(state.lastAction!.action).toBe("fold");
  });

  it("UTG fold: UTGPlayer is folded after first action", () => {
    const state = engine.nextAction();
    const utg = state.players.find(p => p.playerId === "seat_1")!;
    expect(utg.isFolded).toBe(true);
  });

  it("preflop order: UTG → HJ → CO → BTN → SB → BB", () => {
    // Voluntary actions[0..5] are the 6 preflop voluntary actions
    const preflop = [
      { name: "UTGPlayer", action: "fold" },
      { name: "HJPlayer",  action: "fold" },
      { name: "COPlayer",  action: "raise" },
      { name: "Hero",      action: "call" },
      { name: "SBPlayer",  action: "fold" },
      { name: "BBPlayer",  action: "fold" },
    ];

    for (let i = 0; i < preflop.length; i++) {
      const state = engine.nextAction();
      expect(state.lastAction!.player_name).toBe(preflop[i].name);
      expect(state.lastAction!.action).toBe(preflop[i].action);
    }
  });

  it("pot updates after each action", () => {
    engine.nextAction(); // UTG fold (no change to pot)
    engine.nextAction(); // HJ fold
    engine.nextAction(); // CO raise 2.5bb → pot goes from 1.5 to 4.0
    const state = engine.getCurrentState();
    expect(state.pot_bb).toBeCloseTo(4.0, 1);
  });

  it("Hero stack decreases after call", () => {
    // Advance to Hero call (4th voluntary action)
    engine.nextAction(); // UTG fold
    engine.nextAction(); // HJ fold
    engine.nextAction(); // CO raise
    const state = engine.nextAction(); // Hero call 2.5bb
    const hero = state.players.find(p => p.isHero)!;
    expect(hero.stack_bb).toBeCloseTo(97.5, 1);
  });
});

// ── Tests: Navigation ─────────────────────────────────────────────────────────

describe("ReplayEngine: navigation", () => {
  let engine: ReplayEngine;

  beforeEach(() => {
    engine = new ReplayEngine(makeSixMaxHand());
    engine.initialize();
  });

  it("nextAction at final state does not advance", () => {
    engine.jumpToAction(engine.totalActions - 1);
    const before = engine.getCurrentState();
    const after = engine.nextAction();
    expect(after.actionIndex).toBe(before.actionIndex);
    expect(after.isFinal).toBe(true);
  });

  it("previousAction at initial state does not go below -1", () => {
    engine.initialize();
    const state = engine.previousAction();
    expect(state.actionIndex).toBe(-1);
    expect(state.isInitial).toBe(true);
  });

  it("previousAction undoes last action", () => {
    engine.nextAction(); // UTG fold
    engine.nextAction(); // HJ fold
    const after_two = engine.getCurrentState();
    engine.previousAction();
    const back_one = engine.getCurrentState();
    expect(back_one.actionIndex).toBe(after_two.actionIndex - 1);
    expect(back_one.lastAction!.player_name).toBe("UTGPlayer");
  });

  it("jumpToAction goes to correct index", () => {
    const state = engine.jumpToAction(3);
    expect(state.actionIndex).toBe(3);
  });

  it("jumpToAction clamps at totalActions - 1", () => {
    const state = engine.jumpToAction(9999);
    expect(state.actionIndex).toBe(engine.totalActions - 1);
  });

  it("jumpToAction clamps at -1", () => {
    const state = engine.jumpToAction(-99);
    expect(state.actionIndex).toBe(-1);
  });

  it("reset returns to initial state", () => {
    engine.jumpToAction(5);
    const state = engine.reset();
    expect(state.actionIndex).toBe(-1);
    expect(state.isInitial).toBe(true);
  });

  it("jumpToStreet(flop) lands before first flop action", () => {
    const state = engine.jumpToStreet("flop");
    // Should be at the last preflop action (6 preflop voluntary → index 5)
    expect(state.street).toBe("preflop");
    // Board should NOT yet show flop cards
    expect(state.boardCards).toHaveLength(0);
  });

  it("after jumpToStreet(flop), nextAction shows first flop action", () => {
    engine.jumpToStreet("flop");
    const state = engine.nextAction();
    expect(state.street).toBe("flop");
  });

  it("jumpToStreet non-existent street jumps to end", () => {
    // The hand has no river
    const state = engine.jumpToStreet("river");
    expect(state.isFinal).toBe(true);
  });
});

// ── Tests: Board card revelation ──────────────────────────────────────────────

describe("ReplayEngine: board card revelation", () => {
  let engine: ReplayEngine;

  beforeEach(() => {
    engine = new ReplayEngine(makeSixMaxHand());
    engine.initialize();
  });

  it("board is empty during preflop", () => {
    engine.nextAction(); // first preflop action
    expect(engine.getCurrentState().boardCards).toHaveLength(0);
  });

  it("all preflop actions: board still empty", () => {
    for (let i = 0; i < 6; i++) engine.nextAction();
    // All 6 preflop voluntary actions applied
    expect(engine.getCurrentState().boardCards).toHaveLength(0);
  });

  it("first flop action: 3 flop cards revealed", () => {
    for (let i = 0; i < 7; i++) engine.nextAction(); // 6 preflop + 1 flop
    const state = engine.getCurrentState();
    expect(state.boardCards).toHaveLength(3);
    expect(state.boardCards[0].notation).toBe("Jh");
    expect(state.boardCards[1].notation).toBe("8d");
    expect(state.boardCards[2].notation).toBe("2c");
  });
});

// ── Tests: Folding and player state ──────────────────────────────────────────

describe("ReplayEngine: player state after folds", () => {
  let engine: ReplayEngine;

  beforeEach(() => {
    engine = new ReplayEngine(makeSixMaxHand());
    engine.initialize();
  });

  it("folded player remains folded through entire replay", () => {
    // UTG folds at action 0
    engine.jumpToAction(engine.totalActions - 1);
    const finalState = engine.getCurrentState();
    const utg = finalState.players.find(p => p.playerId === "seat_1")!;
    expect(utg.isFolded).toBe(true);
  });

  it("unfolded players are not marked folded", () => {
    // After all preflop actions: CO and Hero are still in the hand going to flop
    engine.jumpToAction(5); // after 6 preflop actions (index 0..5)
    const state = engine.getCurrentState();
    const co   = state.players.find(p => p.playerId === "seat_3")!;
    const hero = state.players.find(p => p.playerId === "seat_4")!;
    expect(co.isFolded).toBe(false);
    expect(hero.isFolded).toBe(false);
  });

  it("CO folds on flop at action index 8", () => {
    engine.jumpToAction(8); // last action (CO fold on flop)
    const state = engine.getCurrentState();
    const co = state.players.find(p => p.playerId === "seat_3")!;
    expect(co.isFolded).toBe(true);
  });
});

// ── Tests: isFinal ───────────────────────────────────────────────────────────

describe("ReplayEngine: isFinal flag", () => {
  let engine: ReplayEngine;

  beforeEach(() => {
    engine = new ReplayEngine(makeSixMaxHand());
    engine.initialize();
  });

  it("isFinal is false at initial state", () => {
    expect(engine.getCurrentState().isFinal).toBe(false);
  });

  it("isFinal is false before last action", () => {
    engine.jumpToAction(engine.totalActions - 2);
    expect(engine.getCurrentState().isFinal).toBe(false);
  });

  it("isFinal is true at last action", () => {
    engine.jumpToAction(engine.totalActions - 1);
    expect(engine.getCurrentState().isFinal).toBe(true);
  });

  it("activePlayerId is null at final state", () => {
    engine.jumpToAction(engine.totalActions - 1);
    expect(engine.getCurrentState().activePlayerId).toBeNull();
  });
});

// ── Tests: Debug mode ─────────────────────────────────────────────────────────

describe("ReplayEngine: debug mode", () => {
  it("debug info is null when debugMode=false", () => {
    const engine = new ReplayEngine(makeSixMaxHand(), false);
    engine.initialize();
    engine.nextAction();
    expect(engine.getCurrentState().debug).toBeUndefined();
  });

  it("debug info is populated when debugMode=true", () => {
    const engine = new ReplayEngine(makeSixMaxHand(), true);
    engine.initialize();
    engine.nextAction(); // UTG fold
    const debug = engine.getCurrentState().debug!;
    expect(debug).toBeDefined();
    expect(debug.actionIndex).toBe(0);
    expect(debug.foldedPlayerIds).toContain("seat_1");
    expect(debug.lastActionSummary).toContain("UTGPlayer");
    expect(debug.lastActionSummary).toContain("fold");
  });

  it("debug stacks reflect current state", () => {
    const engine = new ReplayEngine(makeSixMaxHand(), true);
    engine.initialize();
    // Advance to Hero call (action index 3: UTG fold, HJ fold, CO raise, Hero call)
    for (let i = 0; i < 4; i++) engine.nextAction();
    const debug = engine.getCurrentState().debug!;
    // Hero called 2.5bb from 100bb → stack = 97.5
    expect(debug.stacks["seat_4"]).toBeCloseTo(97.5, 1);
  });
});

// ── Tests: HU edge case ───────────────────────────────────────────────────────

describe("ReplayEngine: HU (2-player) hand", () => {
  function makeHUHand(): CanonicalHand {
    resetSeq();
    const players: CanonicalPlayer[] = [
      makePlayer("seat_1", "Hero",    "BTN",  100, true),
      makePlayer("seat_2", "Villain", "BB",   100, false),
    ];

    const actions: CanonicalAction[] = [
      makeBlindAction("seat_1", "Hero",    "post_sb", 0.5, 100),
      makeBlindAction("seat_2", "Villain", "post_bb", 1.0, 100),
      makeAction("seat_1", "Hero",    "raise", "preflop", 3.0, 99.5, 1.5, true),
      makeAction("seat_2", "Villain", "call",  "preflop", 2.5, 99.0, 4.5),
    ];

    const flop: CanonicalStreet = {
      name: "flop",
      board_cards: [
        { rank: "A", suit: "h", notation: "Ah" },
        { rank: "K", suit: "d", notation: "Kd" },
        { rank: "2", suit: "c", notation: "2c" },
      ],
      pot_start_bb: 7.0,
      actions: [
        makeAction("seat_2", "Villain", "check", "flop", 0,    97.5, 7.0),
        makeAction("seat_1", "Hero",    "bet",   "flop", 4.0,  96.5, 7.0, true),
        makeAction("seat_2", "Villain", "fold",  "flop", 0,    97.5, 11.0),
      ],
    };

    return {
      schema_version: "1.0",
      hand_id: "test_hu_001",
      site: "GGPoker",
      game_type: "NLHE",
      is_tournament: false,
      stakes: {
        small_blind_bb: 0.5,
        big_blind: 1,
        ante_bb: 0,
        straddle_bb: 0,
        currency: "USD",
        display: "$0.50/$1.00",
      },
      table_name: "HU Table",
      table_max_seats: 2,
      players,
      hero_id: "seat_1",
      streets: [
        { name: "preflop", board_cards: [], pot_start_bb: 1.5, actions },
        flop,
      ],
      showdown: null,
      effective_stack_bb: 100,
      final_pot_bb: 11.0,
      parse_source: "text_history",
      raw_text: null,
    };
  }

  it("HU hand passes replayability validation", () => {
    const result = validateReplayability(makeHUHand());
    expect(result.valid).toBe(true);
  });

  it("HU preflop: BTN/SB acts first", () => {
    const engine = new ReplayEngine(makeHUHand());
    engine.initialize();
    const state = engine.nextAction();
    expect(state.lastAction!.player_name).toBe("Hero");
    expect(state.lastAction!.action).toBe("raise");
  });

  it("HU flop: Villain checks first (OOP)", () => {
    const engine = new ReplayEngine(makeHUHand());
    engine.initialize();
    // Skip preflop (2 voluntary actions)
    engine.jumpToStreet("flop");
    const state = engine.nextAction();
    expect(state.lastAction!.player_name).toBe("Villain");
    expect(state.lastAction!.action).toBe("check");
  });
});

// ── Tests: All-in tracking ────────────────────────────────────────────────────

describe("ReplayEngine: all-in tracking", () => {
  function makeAllInHand(): CanonicalHand {
    resetSeq();
    const players: CanonicalPlayer[] = [
      makePlayer("seat_1", "Hero",    "BTN",  50, true),
      makePlayer("seat_2", "Villain", "BB",   100),
    ];

    const allInAction: CanonicalAction = {
      sequence: nextSeq(),
      street: "preflop",
      player_id: "seat_1",
      player_name: "Hero",
      action: "raise",
      amount_bb: 50,
      total_bet_bb: 50,
      is_hero: true,
      is_all_in: true,
      stack_before_bb: 50,
      stack_after_bb: 0,
      pot_before_bb: 1.5,
      pot_after_bb: 51.5,
    };

    const callAction: CanonicalAction = {
      sequence: nextSeq(),
      street: "preflop",
      player_id: "seat_2",
      player_name: "Villain",
      action: "call",
      amount_bb: 49,
      total_bet_bb: 50,
      is_hero: false,
      is_all_in: false,
      stack_before_bb: 99,
      stack_after_bb: 50,
      pot_before_bb: 51.5,
      pot_after_bb: 100.5,
    };

    return {
      schema_version: "1.0",
      hand_id: "test_allin_001",
      site: "PokerStars",
      game_type: "NLHE",
      is_tournament: false,
      stakes: {
        small_blind_bb: 0.5,
        big_blind: 1,
        ante_bb: 0,
        straddle_bb: 0,
        currency: "USD",
        display: "$0.50/$1.00",
      },
      table_name: "All-in Table",
      table_max_seats: 2,
      players,
      hero_id: "seat_1",
      streets: [
        {
          name: "preflop",
          board_cards: [],
          pot_start_bb: 1.5,
          actions: [allInAction, callAction],
        },
      ],
      showdown: null,
      effective_stack_bb: 50,
      final_pot_bb: 100,
      parse_source: "text_history",
      raw_text: null,
    };
  }

  it("all-in player is marked isAllIn", () => {
    const engine = new ReplayEngine(makeAllInHand());
    engine.initialize();
    engine.nextAction(); // Hero all-in raise
    const state = engine.getCurrentState();
    const hero = state.players.find(p => p.isHero)!;
    expect(hero.isAllIn).toBe(true);
    expect(hero.isActive).toBe(false);
  });

  it("all-in player stack is 0", () => {
    const engine = new ReplayEngine(makeAllInHand());
    engine.initialize();
    engine.nextAction();
    const hero = engine.getCurrentState().players.find(p => p.isHero)!;
    expect(hero.stack_bb).toBeCloseTo(0, 2);
  });
});
