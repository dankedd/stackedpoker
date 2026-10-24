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

// ── Phase 2: profiles & skill stats ────────────────────────────────────────

const win = (all, d30, p30) => ({ all, d30, p30, d90: all, p90: [0, 0] });

export function installProfileFixtures(state, { uid, ago, userId }) {
  const stats = {
    v: 1, computed_at: ago(0.2),
    preflop: {
      overall: win([412, 331], [160, 133], [140, 108]),
      opens: win([210, 189], [80, 73], [70, 62]),
      defense: win([150, 108], [60, 47], [55, 36]),
      pushfold: win([52, 34], [20, 13], [15, 10]),
    },
    flop_review: { all: { n: 64, good: 35, ok: 17, questionable: 12 }, windows: { overall: win([64, 52], [25, 21], [20, 15]) } },
    flop_trainer: { overall: win([118, 91], [40, 33], [38, 27]) },
    weakest_texture: { category: "monotone", n: 22, ok: 11 },
    trainer: { spots: 530, accuracy: [530, 422], current_streak: 7, best_streak: 31 },
    day_streak: 12,
  };
  const badges = [
    { id: "founding_member", icon: "⭐", title: "Founding member", description: "One of the first 500 Stacked Poker players", tier: "platinum", earned_at: ago(800) },
    { id: "flop_master", icon: "🃏", title: "Flop master", description: "80%+ good answers on 50 flops", tier: "gold", earned_at: ago(100) },
    { id: "streak_7", icon: "🔥", title: "Week Warrior", description: "7-day streak", tier: "silver", earned_at: ago(50) },
    { id: "spots_100", icon: "💯", title: "100 spots", description: "Trained 100 spots", tier: "bronze", earned_at: ago(300) },
    { id: "first_share", icon: "🔗", title: "First share", description: "Shared a hand for the first time", tier: "bronze", earned_at: ago(3) },
  ];
  const profile = {
    id: userId, handle: "riverrat", name: "RiverRat", role: "admin", avatar: null, visible: true, is_owner: false,
    bio: "MTT reg, mostly $11–$55 on GG. Working on my BB defense.", sites: ["ggpoker", "pokerstars", "live"],
    member_since: "2026-03-14T10:00:00Z", profile_visibility: "public", stats_visibility: "public", stats_visible: true,
    stats, stats_refreshed_at: ago(0.2), badges,
    shares: [
      { slug: "Guess01", question: "Flop check-raise at 25 BB. Call, shove or fold?", created_at: ago(3), guess_mode: true, position: "BTN", hero_cards: ["Ah", "Qd"], board: [] },
      { slug: "Link001", question: "Hero call on a wet river?", created_at: ago(40), guess_mode: false, position: "BB", hero_cards: ["Jh", "Ts"], board: ["9h", "8h", "2c", "Kd", "3h"] },
    ],
  };
  Object.assign(state.rpc, {
    get_profile: ({ p_handle }) => {
      const h = String(p_handle).replace(/^@/, "").toLowerCase();
      if (h === "riverrat") return profile;
      if (h === "new_grinder") return { ...profile, id: uid(802), handle: "new_grinder", name: "Player 77c1", bio: null, sites: [], badges: [], shares: [],
        stats: { ...stats, preflop: { overall: win([12, 9], [12, 9], [0, 0]), opens: win([8, 6], [8, 6], [0, 0]) }, flop_review: {}, flop_trainer: {}, weakest_texture: null, trainer: { spots: 12, accuracy: [12, 9], current_streak: 2, best_streak: 4 }, day_streak: 1 } };
      if (h === "quiet_shark") return { id: uid(801), handle: "quiet_shark", name: "QuietShark", role: "user", avatar: null, visible: false, profile_visibility: "friends", badges: [badges[0]], banned: false };
      return null;
    },
    refresh_profile_stats: () => false,
    update_my_profile: () => ({ ok: true }),
  });
  return {
    profile: { path: "/u/riverrat", ready: "[data-skill-card]" },
    "profile-new": { path: "/u/new_grinder", ready: "[data-skill-card]" },
    "profile-hidden": { path: "/u/quiet_shark", ready: "[data-profile-header]" },
    "settings-profile": {
      path: "/settings", ready: "[data-profile-form]", scrollTo: "#profile",
      before: () => {
        state.handle = "riverrat";
      },
    },
  };
}
