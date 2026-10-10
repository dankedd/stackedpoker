/**
 * Every user-facing string of the hand history section, in one place.
 *
 * Components and lib code read text from `t` and never hold copy of their
 * own, so another language is one more object with the same shape (typed by
 * `Strings`) plus a way to pick it. Numbers and dates use LOCALE.
 */

import type { PreflopVerdict } from "./preflop/types";
import type { Street } from "./types";

export const LOCALE = "en-US";

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

const en = {
  section: {
    title: "My hands",
    /** Header nav item. */
    navItem: "Hands",
    navLabel: "My hands",
    overview: "Overview",
    import: "Import",
  },

  street: { preflop: "Preflop", flop: "Flop", turn: "Turn", river: "River" } satisfies Record<Street, string>,

  verdict: {
    correct: "Correct",
    too_loose: "Too loose",
    too_tight: "Too tight",
    wrong_action: "Wrong action",
    mixed: "Mixed",
    not_evaluated: "Not evaluated",
  } satisfies Record<PreflopVerdict, string>,

  // ── Overview ──────────────────────────────────────────────────────────────
  overview: {
    subtitleLoading: "Your imported tournament hands, sorted by pot size.",
    subtitle: (total: string, matching: string) => `${total} hands imported · ${matching} match your filters`,
    importButton: "Import hands",
    rechecking: (n: number) => `Updating preflop check… ${n} hands`,
    recheckFailed: "Couldn't update the preflop check.",
    loading: "Loading hands…",
    noFavoritesYet: "You don't have any favorites yet. Click the star next to a hand to add it.",
    noFavoritesMatch: "No favorites match these filters.",
    noPreflopMatch: "No hands with this preflop label.",
    noMatch: "No hands match these filters. Lower the minimum pot, pick another tournament or turn off ‘Only hands I played’.",
    pagination: "Pagination",
    prevPage: "Previous",
    nextPage: "Next",
    page: (page: number, pages: number) => `Page ${page} of ${pages}`,
    emptyTitle: "No hands imported yet",
    emptyBody: "Export your tournament history from PokerCraft and upload the .zip file. Your biggest pots will show up here.",
  },

  filters: {
    favoritesOnly: "Favorites only",
    favoritesHint:
      "Shows all your favorites, including small pots and folded hands: ‘Only hands I played’ and the minimum pot don't apply.",
    preflopMistakes: "Preflop mistakes",
    preflopGroupLabel: "Filter by preflop check",
    clear: "Clear",
    preflopHint: "This filter overrides ‘Only hands I played’ and the minimum pot, so folded hands show up too.",
    minPot: "Minimum pot",
    minPotAria: "Minimum pot in BB",
    tournament: "Tournament",
    allTournaments: "All tournaments",
    onlyPlayed: "Only hands I played",
    onlyNotes: "Only hands with notes",
    sortBy: "Sort by",
    descending: "Descending",
    ascending: "Ascending",
    descendingAria: "Descending — click for ascending",
    ascendingAria: "Ascending — click for descending",
  },

  sort: {
    pot: "Pot size",
    invested: "My investment (BB)",
    date: "Date",
    result: "Result",
    favorited: "Recently favorited",
  },

  list: {
    favorite: "Favorite",
    date: "Date",
    tournament: "Tournament",
    position: "Pos.",
    cards: "Cards",
    board: "Board",
    pot: "Pot",
    invested: "Invested",
    result: "Result",
    note: "Note",
    hasNote: "Has a note",
    level: (level: number | null) => `Level ${level ?? "?"}`,
    investedShort: (bb: string) => `invested ${bb}`,
  },

  favorite: {
    add: "Add to favorites",
    remove: "Remove from favorites",
    addFailed: "Couldn't add the star.",
    removeFailed: "Couldn't remove the star.",
  },

  // ── Replayer ──────────────────────────────────────────────────────────────
  replayer: {
    notFound: "This hand doesn't exist or isn't yours.",
    loading: "Loading hand…",
    back: "Back to overview",
    prevHand: "Previous hand",
    nextHand: "Next hand",
    tournament: (id: string | null) => `Tournament #${id}`,
    ante: (amount: string) => ` (ante ${amount})`,
    toStart: "To start (Home)",
    prevAction: "Previous action (←)",
    nextAction: "Next action (→)",
    nextStreet: "Next street (↓)",
    streetButton: "Street",
    toEnd: "To end (End)",
    keys: "Keys: ← → action · ↑ ↓ street · Home/End start/end · S star",
    showAmountsIn: "Show amounts in",
    chips: "Chips",
    bb: "BB",
  },

  facts: {
    title: "This hand",
    cards: "Cards",
    board: "Board",
    pot: "Pot",
    invested: "My investment",
    result: "Result",
    splitPot: " (split pot)",
    showdown: "Showdown",
    note: "Note",
    yes: "Yes",
    no: "No",
    handId: "Hand ID",
    table: "Table",
    tableSize: (name: string, max: number) => `${name} · ${max}-max`,
    rawText: "Original text",
    rawLoading: "Loading…",
  },

  /** Seat labels on the table and the one-line step description. */
  step: {
    seat: {
      fold: "Fold",
      check: "Check",
      call: "Call",
      bet: "Bet",
      raise: "Raise",
      small_blind: "SB",
      big_blind: "BB",
      straddle: "Straddle",
      allIn: "All-in",
      wins: "Wins",
    } as Record<string, string>,
    start: "Start of the hand",
    antes: (amount: string) => `Everyone posts the ante (${amount})`,
    post: (player: string, what: string, amount: string, allIn: boolean) => `${player} posts ${what} ${amount}${allIn ? ", all-in" : ""}`,
    postName: { small_blind: "small blind", big_blind: "big blind", straddle: "straddle" } as Record<string, string>,
    fold: (player: string) => `${player} folds`,
    check: (player: string) => `${player} checks`,
    call: (player: string, amount: string, allIn: boolean) => `${player} calls ${amount}${allIn ? ", all-in" : ""}`,
    bet: (player: string, amount: string, allIn: boolean) => `${player} bets ${amount}${allIn ? ", all-in" : ""}`,
    raise: (player: string, amount: string, allIn: boolean) => `${player} raises to ${amount}${allIn ? ", all-in" : ""}`,
    uncalled: (amount: string, player: string) => `${amount} uncalled, returned to ${player}`,
    show: (player: string, cards: string) => `${player} shows ${cards}`,
    collect: (player: string, amount: string) => `${player} wins ${amount}`,
    pot: (amount: string) => `Pot ${amount}`,
    /** Pot plus the bets still in front of the players. */
    total: (amount: string) => ` · total ${amount}`,
  },

  // ── Notes ─────────────────────────────────────────────────────────────────
  notes: {
    title: "Note",
    placeholder: "What went well or wrong in this hand? What would you do differently next time?",
    delete: "Delete",
    confirmDelete: "Delete the note for this hand?",
    saveFailed: "Couldn't save.",
    deleteFailed: "Couldn't delete.",
    loading: "Loading…",
    saving: "Saving…",
    unsaved: "Not saved",
    saved: "Saved",
    savedOn: (date: string) => `Saved ${date}`,
  },

  // ── Preflop check ─────────────────────────────────────────────────────────
  preflop: {
    title: "Preflop check",
    spotKind: "raise first in",
    summarySubtitle: "raise first in, using the trainer's ranges",
    spotsChecked: (n: number) => `${n} ${plural(n, "spot", "spots")} checked`,
    notEvaluatedCount: (n: number) => ` · ${n} not evaluated`,
    correct: "correct",
    showHands: (label: string) => `Show hands: ${label}`,
    showAllMistakes: (n: number) => `Show all ${n} ${plural(n, "mistake", "mistakes")}`,
    position: "Position",
    spots: "Spots",
    positionsNote: "Positions follow the trainer's 9-max ranges: at an 8-handed table, UTG plays the UTG+1 range.",
    action: { fold: "fold", limp: "limp", raise: "open-raise", allin: "all-in", call: "call" } as Record<string, string>,
    yourRange: (pos: string, bucket: number, hand: string, action: string) => `Your range: ${pos}, ${bucket} BB, ${hand} → ${action}.`,
    you: (action: string) => `You: ${action}.`,
    notEvaluated: (reason: string) => `Not evaluated: ${reason}`,
    noMatchingRange: "no matching range.",
    rangeFor: (hand: string, mix: string) => `Range for ${hand}: ${mix}`,
    effStack: (bb: string) => `Effective stack ${bb} BB`,
    bucket: (bb: number) => ` → bucket ${bb} BB`,
    mapped: (table: string, behind: number, pos: string) =>
      ` · ${table} with ${behind} ${plural(behind, "player", "players")} behind you plays the 9-max ${pos} range`,
    pushFoldNote: (hand: string, bb: number) => `Each number is the biggest stack (in BB) at which the hand still goes all-in. ${hand}: ${bb} BB.`,
    reason: {
      no_position: (behind: number) => `no range for a spot with ${behind} ${plural(behind, "player", "players")} behind you.`,
      too_deep: (bb: number) => `effective stack of ${bb} BB is deeper than the trainer's ranges (max. 60 BB).`,
      no_chart: (pos: string) => `the trainer has no range for ${pos}.`,
    },
  },

  // ── Equity and pot odds ───────────────────────────────────────────────────
  equity: {
    title: (villain: string) => `Equity vs ${villain}`,
    editRange: "Villain's range",
    ofHands: (pct: string) => `${pct}% of hands`,
    source: (hr: string, page: number) => `${hr}, p. ${page}`,
    preflopOnly: "The trainer only has preflop ranges: on the flop, turn and river this stays villain's preflop range.",
    failed: "Equity calculation failed.",
    tie: (pct: string) => `tie ${pct}`,
    allBlocked: "— : every hand in the range is blocked by your cards or the board.",
    sparkline: (parts: string) => `Equity by street: ${parts}`,
    potOdds: "Pot odds",
    icmAria: "Chip equity: ICM is not taken into account.",
    icmTooltip: "This is chip equity. ICM (the tournament's payout structure) is not taken into account.",
    heroAction: { call: "you call", fold: "you fold", raise: "you raise" } as Record<string, string>,
    need: (toCall: string, pot: string, required: string) => `You need to call ${toCall} into a pot of ${pot} → you need ${required} equity.`,
    had: (pct: string) => `You had ${pct}.`,
    stillToAct: (n: number, villain: string) =>
      `${n} ${plural(n, "player", "players")} still to act behind you; the pot odds assume heads-up against ${villain}.`,
  },

  coach: {
    title: "Ask the coach",
    intro: "Ask anything about this hand. The coach sees the whole hand, your preflop check, the equity and pot odds, and your notes.",
    quickQuestions: [
      "Was my preflop play right?",
      "How should I play this spot?",
      "Was this call/shove correct?",
      "What would you do differently?",
    ],
    placeholder: "Ask about this hand…",
    newConversation: "New conversation",
    confirmNew: "Start a new conversation? The current one is closed.",
    saveToNotes: "Save to notes",
    savedToNotes: "Saved to notes",
    saveFailed: "Couldn't save to notes.",
    loadFailed: "Couldn't load the conversation. You can still ask a question.",
    signIn: "Sign in to ask the coach.",
    notePrefix: "Coach:",
    chipEv: "Equity numbers are chip EV; ICM is not included.",
    tabNotes: "Notes",
    tabCoach: "Coach",
  },

  range: {
    title: "Villain's range",
    ofCombos: (pct: string) => `${pct}% of combos`,
    resetTo: (label: string) => `Back to ${label}`,
    otherRange: "Another range from the trainer",
    pickRange: "Pick a range…",
    topPct: "Top % of hands",
    rankedBy: "Ranked by exact preflop equity against a random hand.",
    help: "Click a hand to toggle it. Lighter cells are hands villain plays only part of the time (frequency from the trainer).",
    custom: "Custom range",
    top: (pct: number) => `Top ${pct}% of hands`,
    allHands: "All hands",
    groupOpen: "Open",
    groupPushFold: "Push/fold",
    groupVsAction: "Facing an action",
    /** Labels for villain's preflop line; `pos` arguments are display positions. */
    vs4bet: (action: string, pos: string) => `${action} vs 4-bet from ${pos}`,
    as: (pos: string, as: string) => `${pos} as ${as}`,
    openerAs: (pos: string, as: string) => `opener ${pos} as ${as}`,
    threeBetAsShove: "3-bet as shove",
    shoveAsThreeBet: "shove as 3-bet",
    callersIgnored: (n: number) => `${n} ${plural(n, "caller", "callers")} before villain ignored`,
    approx: (notes: string) => `Approximation: ${notes}.`,
    approxNoRange: (why: string) => `Approximation: no matching range in the trainer (${why}); using all hands.`,
    approxOpen: (why: string) => `Approximation: using villain's opening range. Their actual range ${why} is tighter.`,
    why: {
      noVoluntary: "without a voluntary preflop action",
      afterShove: "after a shove",
      after3bet: "after a 3-bet",
      thisOpen: "for this open",
      vsThisOpen: "against this open",
      multipleRaises: "after multiple raises",
      afterLimps: "after limps",
    },
  },

  // ── Import ────────────────────────────────────────────────────────────────
  import: {
    title: "Import hands",
    subtitle: "Upload your PokerCraft export: the .zip file or individual .txt files. Everything is processed in your browser.",
    phase: { reading: "Reading files", parsing: "Processing hands", saving: "Saving hands", done: "Done" },
    notSignedIn: "You're not signed in. Sign in and try again.",
    noHandsFound: "No hands found in these files.",
    failed: "Something went wrong during the import. Please try again.",
    dropHere: "Drag your files here",
    dropHint: ".zip or .txt, several at once",
    chooseFiles: "Choose files",
    howTo: "How do I export my hands from PokerCraft?",
    howTo1: "In PokerCraft, download the hand histories of your tournaments. You'll get a .zip file with one .txt file per tournament.",
    howTo2: "Upload the .zip file here. Uploading the same export again is harmless: duplicate hands are skipped.",
    complete: "Import complete",
    tournaments: "Tournaments",
    imported: "Imported",
    skipped: "Skipped (duplicates)",
    errors: "Errors",
    viewHands: "View your hands",
    unreadableFiles: "Files that couldn't be read",
    failedHands: (n: number) => `${n} ${plural(n, "hand", "hands")} couldn't be processed`,
    unknownHand: "unknown hand",
    andMore: (n: number) => `And ${n} more.`,
  },

  /** Import pipeline, zip reader and parser errors (also stored in hh_imports.failures). */
  errors: {
    zipNoTxt: "This zip file contains no .txt files.",
    zipEntryUnreadable: "Couldn't extract this file from the zip.",
    unsupportedType: "File type not supported. Upload .txt or .zip files from PokerCraft.",
    fileUnreadable: "Couldn't read this file.",
    noGgHands: "No GGPoker hands found in this file.",
    textBeforeFirstHand: "Text before the first hand was skipped.",
    unexpectedParse: "Unexpected error while parsing.",
    saveFailed: (msg: string) => `Couldn't save: ${msg}`,
    zipCorrupt: "This zip file is damaged or incomplete.",
    zip64: "This zip format (ZIP64) isn't supported.",
    zipEncrypted: "Encrypted zip files aren't supported.",
    zipMethod: (method: number, name: string) => `Compression method ${method} in '${name}' isn't supported.`,
    headerUnknown: "Header line not recognized. Only GGPoker (PokerCraft) tournament hands are supported.",
    notGgHand: "Not a GGPoker hand: the first line doesn't start with 'Poker Hand #'.",
    notTournament: "This isn't a tournament hand. Only tournament hands are supported.",
    noTableLine: "Table line ('Table … Seat #… is the button') is missing.",
    noBigBlind: "Big blind is missing or 0.",
    tooFewPlayers: "Fewer than two players found.",
    noSummary: "Hand is incomplete: '*** SUMMARY ***' is missing.",
    noHeroCards: "Hero's cards ('Dealt to Hero [..]') are missing.",
    unknownLine: (line: string) => `Ignored unknown line: ${line}`,
    potMismatch: (putIn: number, total: number) => `Pot doesn't add up: ${putIn} put in, 'Total pot' ${total}.`,
    payoutMismatch: (collected: number, total: number) => `Payout doesn't add up: ${collected} paid out, 'Total pot' ${total}.`,
    db: {
      unknown: "Unknown error.",
      notSetUp: "The database isn't set up for hand history yet (supabase_hand_history.sql hasn't been run).",
      missingUpdate:
        "The database is missing a hand history update (run supabase_hand_history_involved.sql, supabase_hand_history_preflop.sql, supabase_hand_history_favorites.sql and supabase_hand_history_english.sql).",
      noPermission: "Permission denied. Sign in again and retry.",
      offline: "Can't reach the server. Check your connection and try again.",
      generic: (msg: string) => `Database error: ${msg}`,
      unknownDb: "Unknown database error.",
    },
  },
};

export type Strings = typeof en;

export const t: Strings = en;
