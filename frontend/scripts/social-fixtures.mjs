/**
 * Fixtures for scripts/social-screens.mjs, per phase. Each install* adds rows
 * and RPC handlers to the mock Supabase state.
 */

// ── Phase 1: hand sharing ──────────────────────────────────────────────────

const ev = (o) => ({ allIn: false, ...o });

/** A hand as stored for its owner: real (hex) screen names, hand id, table. */
export const NAMED_HAND = {
  site: "ggpoker", handId: "TM6510945691", tournamentId: "316999261", tournamentName: "Daily Special $10", game: "Hold'em No Limit",
  level: 12, smallBlind: 300, bigBlind: 600, ante: 75, playedAt: "2026-10-08T21:40:24", tableName: "132", maxSeats: 6, buttonSeat: 1,
  players: [
    { seat: 1, name: "Hero", stack: 15000, isHero: true, position: "BTN" },
    { seat: 2, name: "7b1c90fe", stack: 9800, isHero: false, position: "SB" },
    { seat: 3, name: "4070ed9d", stack: 21000, isHero: false, position: "BB" },
    { seat: 4, name: "a596eadd", stack: 12400, isHero: false, position: "UTG" },
    { seat: 5, name: "3f0e11c2", stack: 8800, isHero: false, position: "HJ" },
    { seat: 6, name: "c81d55b0", stack: 30100, isHero: false, position: "CO" },
  ],
  heroName: "Hero", heroCards: ["Ah", "Qd"],
  events: [
    ...["Hero", "7b1c90fe", "4070ed9d", "a596eadd", "3f0e11c2", "c81d55b0"].map((p) => ev({ kind: "post", street: "preflop", player: p, post: "ante", amount: 75 })),
    ev({ kind: "post", street: "preflop", player: "7b1c90fe", post: "small_blind", amount: 300 }),
    ev({ kind: "post", street: "preflop", player: "4070ed9d", post: "big_blind", amount: 600 }),
    ev({ kind: "action", street: "preflop", player: "a596eadd", action: "fold", amount: 0 }),
    ev({ kind: "action", street: "preflop", player: "3f0e11c2", action: "fold", amount: 0 }),
    ev({ kind: "action", street: "preflop", player: "c81d55b0", action: "fold", amount: 0 }),
    ev({ kind: "action", street: "preflop", player: "Hero", action: "raise", amount: 1200, toAmount: 1200 }),
    ev({ kind: "action", street: "preflop", player: "7b1c90fe", action: "fold", amount: 0 }),
    ev({ kind: "action", street: "preflop", player: "4070ed9d", action: "call", amount: 600 }),
    { kind: "deal", street: "flop", cards: ["Qh", "8c", "4d"] },
    ev({ kind: "action", street: "flop", player: "4070ed9d", action: "check", amount: 0 }),
    ev({ kind: "action", street: "flop", player: "Hero", action: "bet", amount: 900 }),
    ev({ kind: "action", street: "flop", player: "4070ed9d", action: "raise", amount: 3300, toAmount: 3300 }),
    ev({ kind: "action", street: "flop", player: "Hero", action: "call", amount: 2400 }),
    { kind: "deal", street: "turn", cards: ["2s"] },
    ev({ kind: "action", street: "turn", player: "4070ed9d", action: "bet", amount: 4200 }),
    ev({ kind: "action", street: "turn", player: "Hero", action: "call", amount: 4200 }),
    { kind: "deal", street: "river", cards: ["Jc"] },
    ev({ kind: "action", street: "river", player: "4070ed9d", action: "check", amount: 0 }),
    ev({ kind: "action", street: "river", player: "Hero", action: "check", amount: 0 }),
    { kind: "show", street: "river", player: "4070ed9d", cards: ["8h", "8d"] },
    { kind: "show", street: "river", player: "Hero", cards: ["Ah", "Qd"] },
    { kind: "collect", street: "river", player: "4070ed9d", amount: 18150 },
  ],
  board: { flop: ["Qh", "8c", "4d"], turn: "2s", river: "Jc" },
  shown: { "4070ed9d": ["8h", "8d"], Hero: ["Ah", "Qd"] },
  winners: [{ player: "4070ed9d", amount: 18150 }],
  totalPot: 18150, rake: 0, warnings: [],
};

/** The same hand anonymised (what share_clean_snapshot() stores). */
function anonymous(hand) {
  const pos = Object.fromEntries(hand.players.map((p) => [p.name, p.isHero ? "Hero" : p.position]));
  const out = JSON.parse(JSON.stringify(hand, (_k, v) => (typeof v === "string" && pos[v] ? pos[v] : v)));
  out.shown = Object.fromEntries(Object.entries(hand.shown).map(([k, v]) => [pos[k] ?? k, v]));
  for (const k of ["handId", "tableName", "tournamentId", "tournamentName", "warnings"]) delete out[k];
  out.playedAt = hand.playedAt.slice(0, 10);
  return out;
}

/** Mirrors share_view_hand() with a cut. */
function cut(hand, n) {
  const events = hand.events.slice(0, n);
  const deal = (st) => events.find((e) => e.kind === "deal" && e.street === st);
  return {
    ...hand, events, winners: [], shown: {}, totalPot: 0, rake: 0, truncated: true, resultHidden: true,
    board: { flop: deal("flop")?.cards ?? [], turn: deal("turn")?.cards[0] ?? null, river: deal("river")?.cards[0] ?? null },
  };
}

/** Hero facing the flop check-raise. */
const DECISION = 18;

export function installShareFixtures(state, { uid, ago, userId }) {
  const handId = uid(700);
  const anon = anonymous(NAMED_HAND);
  let voted = null;
  const payload = (slug, o = {}) => ({
    slug, visibility: "link", question: "Flop check-raise at 25 BB. Call, shove or fold?", created_at: ago(3),
    owner: { handle: "riverrat", name: "RiverRat", role: "admin", deleted: false }, is_owner: false, revoked: false, hidden: false,
    show_hero_cards: true, show_result: true, guess_mode: false, decision_options: null, decision_index: null,
    my_guess: null, actual_choice: null, distribution: null, view_count: null, hand: anon, ...o,
  });
  const guess = { guess_mode: true, decision_options: ["fold", "call", "raise"], decision_index: DECISION };

  state.tables.hh_hands = [{
    id: handId, user_id: userId, hand_id: NAMED_HAND.handId, tournament_id: "316999261", played_at: NAMED_HAND.playedAt, level: 12,
    big_blind: 600, hero_position: "BTN", hero_cards: ["Ah", "Qd"], board: ["Qh", "8c", "4d", "2s", "Jc"], pot_bb: 30.3,
    hero_net_bb: -14, hero_invested_bb: 14, hero_involved: true, preflop_check: "good", preflop_position: "BTN", hero_won: false,
    hero_all_in: false, went_to_showdown: true, has_note: false, favorited_at: null, source: "import", flop_check: null,
    hh_tournaments: { name: "Daily Special $10" }, data: NAMED_HAND,
  }];
  state.tables.hh_tournaments = [{ id: uid(701), site: "ggpoker", tournament_id: "316999261", name: "Daily Special $10", hand_count: 1, user_id: userId }];

  Object.assign(state.rpc, {
    my_hand_shares: () => [
      { slug: "Guess01", hand_id: handId, visibility: "link", show_hero_cards: true, show_result: true, guess_mode: true,
        question: "Flop check-raise at 25 BB. Call, shove or fold?", created_at: ago(3), view_count: 41, guesses: 17, revoked_at: null, hidden_at: null },
      { slug: "Old0001", hand_id: handId, visibility: "friends", show_hero_cards: true, show_result: false, guess_mode: false,
        question: null, created_at: ago(30), view_count: 3, guesses: 0, revoked_at: ago(20), hidden_at: null },
    ],
    record_share_view: () => null,
    get_shared_hand: ({ p_slug }) => {
      if (p_slug === "Guess01") {
        return voted
          ? payload("Guess01", { ...guess, my_guess: voted, actual_choice: "call", distribution: { fold: 4, call: 9, raise: 5 } })
          : payload("Guess01", { ...guess, hand: cut(anon, DECISION) });
      }
      return p_slug === "Link001" ? payload("Link001") : null;
    },
    submit_hand_guess: ({ p_choice }) => {
      voted = p_choice;
      return state.rpc.get_shared_hand({ p_slug: "Guess01" });
    },
  });

  return {
    "hands-list": { path: "/hands", ready: `[data-share-hand="${handId}"] >> visible=true` },
    "share-dialog": {
      path: `/hands/${handId}`, ready: `[data-share-hand="${handId}"] >> visible=true`,
      prepare: async (page) => {
        await page.click(`[data-share-hand="${handId}"] >> visible=true`);
        await page.getByText("/h/Guess01").click();
        await page.waitForTimeout(500);
      },
    },
    "shared-guess": {
      path: "/h/Guess01", ready: "[data-guess-panel]",
      before: () => { voted = null; },
      prepare: async (page) => {
        await page.getByRole("button", { name: "Last action" }).click().catch(() => {});
      },
    },
    "shared-result": {
      path: "/h/Guess01", ready: "[data-guess-panel]",
      before: () => { voted = null; },
      prepare: async (page) => {
        await page.click('[data-guess="call"]');
        await page.waitForSelector("[data-guess-result]");
        await page.locator("[data-guess-result]").scrollIntoViewIfNeeded();
      },
    },
    "shared-link": { path: "/h/Link001", ready: "header h1" },
    embed: { path: "/embed/h/Link001", ready: "header h1" },
    og: { path: "/h/Link001/opengraph-image", ready: "img", raw: true },
    "og-guess": { path: "/h/Guess01/opengraph-image", ready: "img", raw: true, before: () => { voted = null; } },
  };
}
