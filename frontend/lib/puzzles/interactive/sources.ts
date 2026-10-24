import type { ChartProvenance } from '@/lib/learn/bbDefenseComplete'

/**
 * The citation registry for interactive puzzles.
 *
 * Every poker claim a puzzle makes — a frequency, a range percentage, a sizing,
 * a board classification, a "why A beats B" — resolves to one or more entries in
 * here. `validate.ts` enforces that: a puzzle with an unsourced claim does not
 * load. There is deliberately no escape hatch for "general poker knowledge".
 *
 * DERIVATION reuses `ChartProvenance['derivation']` from bbDefenseComplete.ts
 * rather than inventing a parallel vocabulary, exactly as
 * lib/tools/handAnalysis/rangeSource.ts does. One vocabulary, one meaning.
 *
 * SCOPE is the field that does the real anti-hallucination work, and it is why
 * this module exists at all instead of a bare page number. Modern Poker Theory's
 * donk-bet chapter prints numbers from several DIFFERENT simulations that all
 * concern the 654r flop:
 *
 *   - aggregates over ALL high-donk-frequency flops, averaged across BN and UTG;
 *   - a per-hand-category walkthrough that is BB vs UTG only;
 *   - a BB vs BN 30bb table for this one flop.
 *
 * Those are not interchangeable, and quietly presenting a BB-vs-UTG frequency as
 * the answer to a BB-vs-BN spot would be exactly the kind of fabrication this
 * product cannot afford. `scope` states, in the words of the source, which sim a
 * number came from; the UI renders it next to the number every time.
 *
 * PAGE NUMBERS are taken from the page markers in docs/mpt_fulltext.txt, using
 * the same convention already cross-validated by
 * BB_DEFENSE_COMPLETE_100BB_PROVENANCE (e.g. "Hand Range 76: BB vs LJ Open"
 * resolves to p.238 there, and to p.238 under this convention). Per CLAUDE.md, a
 * page number that could not be established this way would be omitted rather
 * than guessed. None had to be omitted here.
 */

export type Derivation = ChartProvenance['derivation']

/**
 * What the site shows about a source: how the number was obtained and which
 * setup it describes. Work, page, locator and verbatim quote live in
 * ./sourceCitations.ts, which only tests import — the site never names the source.
 */
export interface SourceRef {
  id: string
  derivation: Derivation
  /** EXACTLY which simulation/setup the numbers describe. Rendered next to the claim. */
  scope: string
}

function ref(r: SourceRef): SourceRef {
  return r
}

export const SOURCES: Record<string, SourceRef> = {
  /* ── The spot itself ─────────────────────────────────────────────────── */

  'donk.definition': ref({
    id: 'donk.definition',
    derivation: 'exact_transcription',
    scope: 'BB vs IP in a single raised pot — the general setup for the whole donk-bet chapter.',
  }),

  'donk.baseline-frequencies': ref({
    id: 'donk.baseline-frequencies',
    derivation: 'exact_transcription',
    scope:
      'Aggregated GTO solutions across ALL flops, BB vs BN and BB vs UTG, single raised pots, 20bb/30bb/40bb.',
  }),

  'donk.654r-is-highest': ref({
    id: 'donk.654r-is-highest',
    derivation: 'exact_transcription',
    scope: 'Average across the BB vs BN and BB vs UTG sims at 20bb/30bb/40bb.',
  }),

  'preflop.bn-open-bb-call-30bb': ref({
    id: 'preflop.bn-open-bb-call-30bb',
    derivation: 'exact_transcription',
    scope: 'BB vs BN, single raised pot, 30bb effective — the exact preflop setup this puzzle uses.',
  }),

  /* ── Why 654r favours the BB ─────────────────────────────────────────── */

  'eq.654r-vs-a76r': ref({
    id: 'eq.654r-vs-a76r',
    derivation: 'exact_transcription',
    scope: 'BB vs IP range-vs-range equity on 654r, contrasted with A76r.',
  }),

  'buckets.654r': ref({
    id: 'buckets.654r',
    derivation: 'exact_transcription',
    scope: 'BB vs IP equity-bucket distribution on 654r, averaged over 20bb/30bb/40bb stacks.',
  }),

  'buckets.654r-ax-devalued': ref({
    id: 'buckets.654r-ax-devalued',
    derivation: 'exact_transcription',
    scope: 'BB vs IP on 654r — what happens to IP’s ace-high holdings specifically.',
  }),

  'donk.654r-denies-eqr': ref({
    id: 'donk.654r-denies-eqr',
    derivation: 'exact_transcription',
    scope: 'BB vs IP on 654r — the causal explanation for the high donk frequency.',
  }),

  'donk.654r-ip-raise-frequency': ref({
    id: 'donk.654r-ip-raise-frequency',
    derivation: 'exact_transcription',
    scope: 'IP’s response frequency to a 1/4-pot donk bet, 654r vs A76r.',
  }),

  /* ── The high-donk-frequency board family ────────────────────────────── */

  'family.high-donk-flops': ref({
    id: 'family.high-donk-flops',
    derivation: 'exact_transcription',
    scope: 'The ~34 flops donked over 50% of the time against both the BN and UTG.',
  }),

  'family.high-donk-eqr': ref({
    id: 'family.high-donk-eqr',
    derivation: 'exact_transcription',
    scope: 'Averages across ALL high-donk-frequency flops — not 654r specifically.',
  }),

  'family.high-donk-polarity': ref({
    id: 'family.high-donk-polarity',
    derivation: 'exact_transcription',
    scope: 'Range-shape comparison across all high-donk-frequency flops.',
  }),

  'family.high-donk-bucket-frequencies': ref({
    id: 'family.high-donk-bucket-frequencies',
    derivation: 'exact_transcription',
    scope:
      'GENERAL strategy across high-donk-frequency boards at 30-40bb — NOT a per-hand or per-combo frequency, and not 654r-specific.',
  }),

  'sizing.stack-depth': ref({
    id: 'sizing.stack-depth',
    derivation: 'exact_transcription',
    scope: 'How the preferred donk bet-size on high-donk boards changes with stack depth.',
  }),

  'donk.frequency-by-opener': ref({
    id: 'donk.frequency-by-opener',
    derivation: 'exact_transcription',
    scope: 'High-donk-frequency boards, BB vs UTG compared with BB vs BN.',
  }),

  'checking.range-protection': ref({
    id: 'checking.range-protection',
    derivation: 'exact_transcription',
    scope: 'Why the BB’s checking range on high-donk boards still needs strong and good hands.',
  }),

  /* ── The 654r per-category walkthrough — BB vs UTG, NOT BB vs BN ─────── */

  'example.654r-utg-buckets': ref({
    id: 'example.654r-utg-buckets',
    derivation: 'exact_transcription',
    scope:
      'BB vs UTG on 654r at 30bb. The source’s only per-category walkthrough of this flop — it is NOT the BB vs BN sim.',
  }),

  'example.654r-utg-straights': ref({
    id: 'example.654r-utg-straights',
    derivation: 'exact_transcription',
    scope: 'BB vs UTG on 654r at 30bb — which holdings actually make a straight on this flop.',
  }),

  'example.654r-utg-top-pair': ref({
    id: 'example.654r-utg-top-pair',
    derivation: 'exact_transcription',
    scope:
      'BB vs UTG on 654r at 30bb. Top pair on 654r means a pair of sixes; this is the category 7♠6♠ belongs to.',
  }),

  'example.654r-utg-draws': ref({
    id: 'example.654r-utg-draws',
    derivation: 'exact_transcription',
    scope: 'BB vs UTG on 654r at 30bb — the no-pair open-ended straight draws, a different bucket from top pair + OESD.',
  }),

  /* ── What leading is actually worth, BB vs BN 30bb ───────────────────── */

  'value.table-104': ref({
    id: 'value.table-104',
    derivation: 'exact_transcription',
    scope:
      'BB vs BN, 654r, 30bb effective — the GTO solution compared against a forced 100%-check simulation. This is the puzzle’s exact spot.',
  }),

  'value.difficulty-caveat': ref({
    id: 'value.difficulty-caveat',
    derivation: 'exact_transcription',
    scope: 'The author’s own framing of how much donk betting is worth in practice.',
  }),

  'position.654r-ip-cbet': ref({
    id: 'position.654r-ip-cbet',
    derivation: 'exact_transcription',
    scope: 'BB vs BN on 654r at 30bb — what the BN does after the BB checks.',
  }),

  'position.654r-bn-weak-hands': ref({
    id: 'position.654r-bn-weak-hands',
    derivation: 'exact_transcription',
    scope: 'BB vs BN on 654r at 30bb — the composition of the BN’s range from the BN’s perspective.',
  }),

  /* ── Contrast: boards where leading is wrong ─────────────────────────── */

  'contrast.a76r': ref({
    id: 'contrast.a76r',
    derivation: 'exact_transcription',
    scope: 'A76r, the chapter’s worked counter-example to 654r.',
  }),

  'contrast.no-donk-flops': ref({
    id: 'contrast.no-donk-flops',
    derivation: 'exact_transcription',
    scope: 'The large majority of flops — the group where leading is not part of the strategy.',
  }),

  /* ── Preflop range composition (different stack depths — labelled) ───── */

  'preflop.bb-call-composition-100bb': ref({
    id: 'preflop.bb-call-composition-100bb',
    derivation: 'exact_transcription',
    scope:
      'BB vs BN at 100bb, NOT 30bb. Cited only for the SHAPE of the BB’s calling range (which hand types call), never for a frequency at 30bb.',
  }),

  'preflop.bb-3bet-composition-25bb': ref({
    id: 'preflop.bb-3bet-composition-25bb',
    derivation: 'exact_transcription',
    scope:
      'BB vs IP at 25bb — which hand TYPES make up the NON-ALL-IN 3-betting range, as distinct from the separate all-in range at the same depth. A composition stated in words; it names classes, never individual combos or their frequencies. Belongs to the 25bb solutions only.',
  }),

  'preflop.bb-vs-bn-25bb-chart': ref({
    id: 'preflop.bb-vs-bn-25bb-chart',
    derivation: 'exact_transcription',
    scope:
      'BB defending against a BN min-raise at 25bb, in the source’s MTT defence chapter. These four percentages are the whole-range aggregates printed with the chart — NOT the frequency of any individual hand, and four separate branches that the source never adds together. The chart itself is a colour-coded image; no per-combo figure is printed in text. (The table configuration behind it, 9-max, 12.5% ante, not here, see `mtt.solver-environment`.)',
  }),

  'preflop.bb-vs-bn-40bb-chart': ref({
    id: 'preflop.bb-vs-bn-40bb-chart',
    derivation: 'exact_transcription',
    /* Scope de-puzzled: this was phrased as "the other chart bracketing this
     * puzzle's 30bb depth", which is true of puzzle 1 and confusing everywhere
     * else, since `scope` is rendered verbatim next to the number in whichever
     * puzzle cites it. Matches how 'preflop.bb-vs-bn-25bb-chart' now reads. */
    scope:
      'BB defending against a BN open at 40bb, 9-max MTT with a 12.5% ante. Whole-range aggregates printed with the chart, not the frequency of any individual hand. FOUR branches are printed here, including a non-all-in 3-bet — which the 15bb solution of the same matchup does not have.',
  }),

  /* ── BB defence at 25bb — the four-branch strategy ────────────────────
   *
   * These sit next to `preflop.bb-vs-bn-25bb-chart` and
   * `preflop.bb-3bet-composition-25bb`, which are the other half of the same
   * two pages. The distinction they all turn on, and the one this chapter is
   * easiest to get wrong: at 25bb "3-bet" and "all-in" are TWO DIFFERENT
   * BRANCHES with their own frequencies and their own hand classes. Collapsing
   * them into a single "raise" number — 8.2% + 11.4% = 19.6% — would produce a
   * figure the book never prints and would erase the thing the section is about.
   */

  'bb25.four-branch-strategy': ref({
    id: 'bb25.four-branch-strategy',
    derivation: 'exact_transcription',
    scope:
      'BB defending against a min-raise at 25bb, across ALL four in-position openers. Every figure here is a whole-range aggregate for one opener, at 25bb only — the same numbers do not hold at 15bb, 40bb or 60bb, which the source solves separately.',
  }),

  'bb25.pairs-and-axo-jam': ref({
    id: 'bb25.pairs-and-axo-jam',
    derivation: 'exact_transcription',
    scope:
      'BB vs IP at 25bb — which hand CLASSES go into the all-in branch, stated in words. It names classes ("pocket pairs", "Axo"), never individual combos, and attaches no frequency to any one hand.',
  }),

  'bb25.fold-range-grows': ref({
    id: 'bb25.fold-range-grows',
    derivation: 'exact_transcription',
    scope:
      'BB vs IP at 25bb — how big the fold branch is by opener, and the reason the source gives for it. The 14.6% figure is the BB’s fold frequency against a BN min-raise specifically.',
  }),

  'mtt.solver-environment': ref({
    id: 'mtt.solver-environment',
    derivation: 'exact_transcription',
    scope:
      'The game the source’s MTT equilibrium strategies were solved. Stated at the head; the defence chapter does not restate it. Cited for the TABLE CONFIGURATION — 9 seats, 12.5% ante — never for a strategy figure.',
  }),

  'mtt.ante-pot-size': ref({
    id: 'mtt.ante-pot-size',
    derivation: 'exact_transcription',
    scope:
      'What a 12.5% ante is worth in dead money at a 9-max table, before any voluntary action. Pure pot arithmetic, independent of stack depth or position.',
  }),

  'defence.chapter-depths': ref({
    id: 'defence.chapter-depths',
    derivation: 'exact_transcription',
    scope:
      'The four stack depths the defence chapter solves separately. The boundary that stops a 15bb or 40bb figure being carried into a 25bb spot.',
  }),

  /* ── Puzzle 2: BB vs UTG on 9♥8♥4♦ (40bb) — the book's own worked line ── */

  'ex3.preflop-bb-vs-utg-40bb': ref({
    id: 'ex3.preflop-bb-vs-utg-40bb',
    derivation: 'exact_transcription',
    scope: 'BB defending against an UTG open at 40bb — the preflop setup for the source’s Flop Strategy Example 3.',
  }),

  'ex3.utg-cbet-big': ref({
    id: 'ex3.utg-cbet-big',
    derivation: 'exact_transcription',
    scope: 'UTG’s flop c-betting strategy on 9♥8♥4♦ at 40bb — a mid c-bet frequency with a big bet-size.',
  }),

  'ex3.bb-few-strong-hands': ref({
    id: 'ex3.bb-few-strong-hands',
    derivation: 'exact_transcription',
    scope: 'BB’s flop strategy facing a 2/3-pot c-bet from UTG on 9♥8♥4♦ at 40bb.',
  }),

  'ex3.bb-compensates-on-turn': ref({
    id: 'ex3.bb-compensates-on-turn',
    derivation: 'exact_transcription',
    scope: 'Why the BB plays the flop passively on this board — the plan is explicitly deferred to the turn.',
  }),

  /**
   * CORRECTED SCOPE. This quote was originally filed here as the 9♥8♥4♦ rule and
   * cited as such by the 984 puzzle. It is not: the sentence sits between the
   * "Flop Strategy Example 2" header (Q♥J♥T♥ vs a MIN-BET) and the Example 3
   * header, so it belongs to the former. The book's own continuation settles it —
   * "All 9x except 99 are folded 100%" is only coherent on Q♥J♥T♥, where a 9
   * makes a draw. On 9♥8♥4♦ a nine is top pair and is never folded outright.
   * Example 3 states its own, different open-ender rule; see
   * `ex3.oesd-check-call` below, which is what the 984 puzzle now cites.
   */
  'qjt.oesd-nut-straight-only': ref({
    id: 'qjt.oesd-nut-straight-only',
    derivation: 'exact_transcription',
    scope:
      'BB vs UTG on Q♥J♥T♥ at 40bb, facing a MIN-BET. Not 9♥8♥4♦, and not a 2/3-pot bet.',
  }),

  'ex3.oesd-check-call': ref({
    id: 'ex3.oesd-check-call',
    derivation: 'exact_transcription',
    scope:
      'BB vs UTG on 9♥8♥4♦ at 40bb, facing a 2/3-pot c-bet. The source’s own open-ender rule for this exact board and bet-size.',
  }),

  'ex3.turn-donk-best-cards': ref({
    id: 'ex3.turn-donk-best-cards',
    derivation: 'exact_transcription',
    scope: 'BB vs UTG on 9♥8♥4♦ at 40bb, after the flop went check / c-bet / call. Which turn cards the BB leads.',
  }),

  'ex3.turn-best-card-is-five': ref({
    id: 'ex3.turn-best-card-is-five',
    derivation: 'exact_transcription',
    scope: 'BB vs UTG on 9♥8♥4♦ at 40bb after x/b/c — the single best and worst turn cards for the BB by EV.',
  }),

  'ex3.turn-equity-runs-close': ref({
    id: 'ex3.turn-equity-runs-close',
    derivation: 'exact_transcription',
    scope: 'BB vs UTG on 9♥8♥4♦ at 40bb — average turn equity and equity realization after the flop went x/b/c.',
  }),

  'ex3.ip-punishes-a-check': ref({
    id: 'ex3.ip-punishes-a-check',
    derivation: 'exact_transcription',
    scope: 'BB vs UTG on 9♥8♥4♦ at 40bb — what UTG does when the BB checks the turn as well as the flop.',
  }),

  /* ── Puzzle 4: the same hand, one node deeper — OOP facing the second barrel ─
   *
   * These four refs are the whole of the puzzle. Three of them are the x/b/c/x/b
   * node the book solves in sequence (pp.775-778); the fourth is a flop bullet
   * that happens to name the hero hand by name, which is why that hand was
   * chosen. Note what the page numbers do NOT include: p.779 onwards is the
   * river chapter, and it contains no solution for this line.
   */

  'ex3.flop-combo-draws-jhth': ref({
    id: 'ex3.flop-combo-draws-jhth',
    derivation: 'exact_transcription',
    scope:
      'BB vs UTG on 9♥8♥4♦ at 40bb, facing a 2/3-pot FLOP c-bet. A per-combo figure for the FLOP node only — it says nothing about any later street, and must not be carried onto the turn.',
  }),

  'ex3.turn-second-barrel-oop': ref({
    id: 'ex3.turn-second-barrel-oop',
    derivation: 'exact_transcription',
    scope:
      'BB vs UTG on 9♥8♥4♦ at 40bb, after the flop went check / c-bet / call and the BB checked the turn as well. WHOLE-RANGE averages across turn cards — "on average, over 40%" is a property of the range, never of one hand.',
  }),

  'ex3.turn-xr-all-in': ref({
    id: 'ex3.turn-xr-all-in',
    derivation: 'exact_transcription',
    scope:
      'Same node as — BB vs UTG on 9♥8♥4♦ at 40bb facing a 2/3-pot turn c-bet. The 14% is a WHOLE-RANGE average across turn cards; no per-combo turn frequency is printed anywhere in this section.',
  }),

  'ex3.turn-facing-cbet-eqr': ref({
    id: 'ex3.turn-facing-cbet-eqr',
    derivation: 'exact_transcription',
    scope:
      'Same node again — what OOP’s position facing the second barrel is actually worth, averaged over turn cards. Not an equity figure for any particular hand.',
  }),

  'turn.categories': ref({
    id: 'turn.categories',
    derivation: 'exact_transcription',
    scope: 'The source’s general scheme for classifying any turn card, independent of board or matchup.',
  }),

  'turn.why-groups': ref({
    id: 'turn.why-groups',
    derivation: 'exact_transcription',
    scope:
      'The author’s own reason for grouping turn cards at all, and the sentence establishing that the groups OVERLAP rather than exclude one another. General — it is about every flop in the deck, not any one board or matchup.',
  }),

  'turn.category-subdivision': ref({
    id: 'turn.category-subdivision',
    derivation: 'exact_transcription',
    scope:
      'The one refinement the source adds to the six turn groups, and the sentence establishing that a card can belong to more than one of them. General, not board-specific.',
  }),

  /* ── Puzzle: reading the turn on 9♥8♥4♦ after the flop checks back ────
   *
   * These two are the book's own worked example of the SAME board puzzle 2 uses,
   * but on a different line — x/x, not x/b/c. They are not interchangeable with
   * the `ex3.turn-*` refs above, which are all measured after the flop went
   * check / c-bet / call. Same board, same seats, different node. */

  'turn.984-xx-setup': ref({
    id: 'turn.984-xx-setup',
    derivation: 'exact_transcription',
    scope:
      'The setup for the source’s first worked turn example: BB vs UTG on 9♥8♥4♦ at 40bb, the big blind first to act on the turn after the flop checked through.',
  }),

  'turn.984-good-cards-xx': ref({
    id: 'turn.984-good-cards-xx',
    derivation: 'exact_transcription',
    scope:
      'BB vs UTG on 9♥8♥4♦ at 40bb, after the flop checked through (x/x). Which turn cards favour which player ON THIS BOARD — a statement about two specific ranges, not a property of a turn category in general, and not a betting frequency.',
  }),

  'turn.984-worst-card-xx': ref({
    id: 'turn.984-worst-card-xx',
    derivation: 'exact_transcription',
    scope:
      'BB vs UTG on 9♥8♥4♦ at 40bb after the flop checked through (x/x) — the best and worst single turn cards for the big blind, by EV. One card on one board on one line; it is not an EV for the "ace" category anywhere else. Every percentage here belongs to the WHOLE OOP RANGE, as a share of the pot: 25.8% and 64.17% are what the big blind’s entire range is worth on that turn card, never what one holding is worth.',
  }),

  /* ── River principles (abstract models, not node solutions) ──────────── */

  'river.polar-jams-nuts': ref({
    id: 'river.polar-jams-nuts',
    derivation: 'exact_transcription',
    scope:
      'The polar-versus-bluff-catcher river model. A general model the source says applies whenever the range STRUCTURE matches — it is not a solved output for any particular board.',
  }),

  'river.defend-1-alpha': ref({
    id: 'river.defend-1-alpha',
    derivation: 'exact_transcription',
    scope: 'General river calling heuristics, applicable across spots rather than solved for one board.',
  }),

  'river.blockers': ref({
    id: 'river.blockers',
    derivation: 'exact_transcription',
    scope: 'General river blocker heuristics for choosing between bluff-catchers.',
  }),

  'theory.alpha-mdf': ref({
    id: 'theory.alpha-mdf',
    derivation: 'exact_transcription',
    scope: 'The definition of Alpha and MDF, from the Clairvoyance Toy Game. Pure arithmetic of bet size versus pot.',
  }),

  /* ── Puzzle 3: BB vs BN open at 100bb — why the BB defends widest ────── */

  'bb100.bb-vs-btn-aggregates': ref({
    id: 'bb100.bb-vs-btn-aggregates',
    derivation: 'exact_transcription',
    scope:
      'BB defending against a BN open, 6-max cash, 100bb effective. These are the whole-range percentages printed with the chart — NOT the frequency of any individual hand. The chart itself is a colour-coded image; no per-combo figure is printed in text.',
  }),

  'bb100.why-bb-calls-wider': ref({
    id: 'bb100.why-bb-calls-wider',
    derivation: 'exact_transcription',
    scope:
      'BB vs BN at 100bb — the source’s own stated reason why the BB’s calling range against a button is wider than against any other position.',
  }),

  'bb100.linear-3bet': ref({
    id: 'bb100.linear-3bet',
    derivation: 'exact_transcription',
    scope:
      'BB vs BN at 100bb — which hand TYPES go into the 3-betting range and which into the calling range. A composition stated in words; it names classes, never individual combos or their frequencies.',
  }),

  /*
   * The three refs below are Chapter 12, and they are the reason `scope` exists.
   * Their figures look like they belong next to Hand Range 82 — same book, same
   * BB-vs-BN matchup — and they do not. p.655 states plainly that the whole
   * section is aggregated from 20bb/30bb/40bb solutions using MTT starting
   * ranges, so the "~44% BN range" printed on p.657 is NOT the 100bb 6-max cash
   * opening range this puzzle's spot uses. Lifting it would be the single
   * easiest fabrication available in this chapter.
   */

  'position.ch12-sim-scope': ref({
    id: 'position.ch12-sim-scope',
    derivation: 'exact_transcription',
    scope:
      'The source’s own statement of what the whole flop c-bet dataset is — the boundary that keeps its numbers out of a 100bb cash spot.',
  }),

  'position.ip-over-realizes': ref({
    id: 'position.ip-over-realizes',
    derivation: 'exact_transcription',
    scope:
      'Aggregated GTO solutions at 20bb/30bb/40bb with MTT starting ranges, IP vs BB on the flop after the BB checks — NOT the 100bb 6-max cash configuration of the chart. Cited for the direction position pushes equity realization, never as a figure for a 100bb cash spot.',
  }),

  'position.ip-range-advantage': ref({
    id: 'position.ip-range-advantage',
    derivation: 'exact_transcription',
    scope:
      'Same 20bb/30bb/40bb MTT-range aggregate as Table 110. The "~44%" and "~15%" are the BN and UTG opening ranges IN THAT dataset — they are not the 100bb 6-max cash opening sizes, and must not be presented as the button’s open in a 100bb spot.',
  }),

  /* ── Puzzle 4: BN c-bets J♠6♥6♦ (40bb) — the paired-board min-bet ─────
   *
   * Two pages, and only two. p.690 is the node itself; p.663 is the texture
   * rule the node is an instance of. The trap here is the mirror image of the
   * one guarded above: p.690 prints exactly one strategy number — a 72% OVERALL
   * c-bet frequency for the BN's whole range — and it sits three lines away from
   * a set of range-composition percentages (14, 23, 8.9, 5, 52) that are not
   * strategy numbers at all. Reading any of them as "how often this hand bets"
   * would be a fabrication, so every scope below says which kind of figure it is.
   */

  'ex4.j66-headline': ref({
    id: 'ex4.j66-headline',
    derivation: 'exact_transcription',
    scope:
      'The source’s own one-line classification of this exact node: BN c-betting on J♠6♥6♦ at 40bb effective after the BB checks. "Mid c-bet %" and "small bet-size" are the two labels the source puts on it.',
  }),

  'ex4.j66-range-comparison': ref({
    id: 'ex4.j66-range-comparison',
    derivation: 'exact_transcription',
    scope:
      'Range COMPOSITION for both players on J♠6♥6♦ at 40bb, BB vs BN. Every figure is a share of a whole range — 14% / 23% strong hands, 8.9% / 5% trip sixes — and none of them is the frequency of any individual hand or a strategy percentage. This is the rare passage where the source prints both sides of the same flop.',
  }),

  'ex4.j66-cbet-72': ref({
    id: 'ex4.j66-cbet-72',
    derivation: 'exact_transcription',
    scope:
      'The BN’s OVERALL c-bet frequency across its ENTIRE range on J♠6♥6♦ at 40bb after the BB checks — 72%. It is not the frequency of any single hand or hand class, and it is not a per-sizing figure. The same sentence states why the sizing must stay small, and gives the BB’s 52% trash share.',
  }),

  'ex4.j66-check-28': ref({
    id: 'ex4.j66-check-28',
    derivation: 'exact_derived',
    scope:
      'The remaining 28% of the BN’s whole range on J♠6♥6♦ at 40bb — the part not bet after the BB checks. A whole-range figure, not a per-hand frequency. The source prints the 72%; this is 100 − 72 and nothing more.',
  }),

  'ex4.paired-boards-min-bet': ref({
    id: 'ex4.paired-boards-min-bet',
    derivation: 'exact_transcription',
    scope:
      'PAIRED BOARDS AS A CLASS, across the chapter’s whole flop dataset — not J♠6♥6♦ specifically. The general texture rule that this puzzle’s spot is one instance of.',
  }),

  'ex4.why-paired-boards-small': ref({
    id: 'ex4.why-paired-boards-small',
    derivation: 'exact_transcription',
    scope:
      'The stated MECHANISM behind small bets on paired boards, again as a class rather than for J♠6♥6♦ alone. Cited for the causal chain — the pair hands the BB strong hands, which polarizes the BB, which caps IP’s sizing — never for a number in this spot.',
  }),

  /* ── Puzzle 4: flop c-bet frequency sorted by the flop's highest card ──
   *
   * All five refs below come from the SAME dataset as the three `position.*`
   * refs above — the Ch.12 flop c-bet section, aggregated from 20bb/30bb/40bb
   * solutions with MTT starting ranges and blended over BN and UTG openers
   * (p.655). Two consequences the puzzle has to keep visible, because both are
   * easy to lose:
   *
   *   1. Every top-card percentage is a CATEGORY AVERAGE over all flops sharing
   *      that top card. It is not the frequency for one flop, and it is not the
   *      frequency for one hand on that flop.
   *   2. It is also an average over two different openers. The book states on
   *      p.659 that UTG c-bets more often than the BN, so neither seat's own
   *      figure for a given top card is the printed number — and no per-opener
   *      split by top card is printed anywhere.
   */

  'cbet.by-top-card': ref({
    id: 'cbet.by-top-card',
    derivation: 'exact_transcription',
    scope:
      'IP’s flop c-bet frequency after the BB checks, aggregated from thousands of GTO solutions at 20bb/30bb/40bb with MTT starting ranges, blended over BN and UTG openers. Each figure is the AVERAGE over every flop sharing that highest card — not the frequency for one specific flop, and not the frequency for one specific hand.',
  }),

  'cbet.check-share-derived': ref({
    id: 'cbet.check-share-derived',
    derivation: 'exact_derived',
    scope:
      'What is left when IP does not c-bet: 100% − 96% = 4% on Axx, 100% − 62% = 38% on 6xx. Same dataset and same category-average scope as the printed figures; the subtraction adds no new information and no new source.',
  }),

  'cbet.checking-back-costs-ip': ref({
    id: 'cbet.checking-back-costs-ip',
    derivation: 'exact_transcription',
    scope:
      'IP vs BB on the flop in a single raised pot, same 20bb/30bb/40bb MTT-range aggregate. Measures what IP gives up by never c-betting at all — across all flops, not on any one board.',
  }),

  'cbet.analysis-after-bb-checks': ref({
    id: 'cbet.analysis-after-bb-checks',
    derivation: 'exact_transcription',
    scope:
      'The exact decision node every figure in this section describes — IP acting after the BB has checked the flop in a single raised pot. This is the node this puzzle asks about.',
  }),

  'cbet.range-strength-drives-frequency': ref({
    id: 'cbet.range-strength-drives-frequency',
    derivation: 'exact_transcription',
    scope:
      'The source’s stated mechanism linking range strength to c-bet frequency, given for the UTG-versus-BN comparison and then generalized. Same 20bb/30bb/40bb MTT-range dataset.',
  }),

  'cbet.straights-favor-bb': ref({
    id: 'cbet.straights-favor-bb',
    derivation: 'exact_transcription',
    scope:
      'A DIFFERENT way of sorting the same flops — by how many straights they allow rather than by their highest card. Cited so the top-card ranking is not presented as the only feature the source measures. Same aggregated dataset as every figure in this section: thousands of GTO solutions at 20bb/30bb/40bb with standard GTO MTT starting ranges. The DIRECTION of the effect is stated in words and shown in the diagram; no c-bet frequency per straight-count bucket is printed alongside it.',
  }),

  'cbet.sizes-by-stack-depth': ref({
    id: 'cbet.sizes-by-stack-depth',
    derivation: 'exact_transcription',
    scope:
      'How IP’s c-bet SIZE varies with stack depth — not with the flop’s highest card. The source prints no size split for the top-card categories, so this is the nearest statement about sizing and is cited only as that.',
  }),

  /* ── Puzzle 4: "The Power of Position" — the book's own flipped simulation ──
   *
   * Everything in this group comes from a MODIFIED, hypothetical solve. p.651
   * defines it outright: the two players keep their preflop ranges but swap who
   * acts first on the flop, so Hero holds the BN's 49% range while playing out
   * of position. That configuration cannot occur at a real table, and every
   * scope line below says so. The fabrication these refs exist to prevent is the
   * quiet one: reading 9.23% as "how often a button c-bets 654r".
   */

  'flip.experiment-definition': ref({
    id: 'flip.experiment-definition',
    derivation: 'exact_transcription',
    scope:
      'A MODIFIED hypothetical simulation, not a spot that can occur at a real table. It also fixes the three flop bet-sizes available to both players in this experiment — 1.25-pot, 2/3-pot and 1/4-pot — which is where this puzzle’s answer choices come from.',
  }),

  'flip.hero-oop-with-bn-range': ref({
    id: 'flip.hero-oop-with-bn-range',
    derivation: 'exact_transcription',
    scope:
      'The MODIFIED "positions flipped" solve, BB vs BN on 654r/A76r at 30bb: ranges unchanged from the real preflop, but who acts first on the flop is swapped. A hypothetical configuration that cannot be dealt — this is the sentence that defines what "you hold the button’s range out of position" means.',
  }),

  'flip.654r-oop-frequency': ref({
    id: 'flip.654r-oop-frequency',
    derivation: 'exact_transcription',
    scope:
      'The FLIPPED simulation on 654r at 30bb: Hero holding the BN’s 49% range but acting first. 9.23% is a whole-range betting frequency in a hypothetical solve — it is NOT how often a button c-bets this flop, which is the 48% figure from the same paragraph.',
  }),

  'flip.654r-checking-range-protection': ref({
    id: 'flip.654r-checking-range-protection',
    derivation: 'exact_transcription',
    scope:
      'The FLIPPED simulation on 654r at 30bb — the source’s own causal explanation for why the OOP betting frequency collapses and the checking frequency rises.',
  }),

  'flip.654r-oop-eqr': ref({
    id: 'flip.654r-oop-eqr',
    derivation: 'exact_transcription',
    scope:
      'The FLIPPED simulation on 654r at 30bb, measured against the same range played in position. The price of the seat, holding the range constant.',
  }),

  'flip.a76r-oop-cost': ref({
    id: 'flip.a76r-oop-cost',
    derivation: 'exact_transcription',
    scope:
      'The same FLIPPED experiment run on A76r at 30bb — the board where the BN’s range is strong. Cited as the contrast that shows the cost of position is not a constant.',
  }),

  'flip.two-street-game': ref({
    id: 'flip.two-street-game',
    derivation: 'exact_transcription',
    scope:
      'Written in the A76r paragraph of the flipped experiment, and explicitly carried over to 654r on the next page ("Again, Hero aims to play a two street game"). Cited for WHY the 2/3-pot size loses its job once position is gone, never for a frequency.',
  }),

  'flip.value-of-position-general': ref({
    id: 'flip.value-of-position-general',
    derivation: 'exact_transcription',
    scope:
      'A THIRD modified experiment — both players dealt identical ranges — run across sample flops. It isolates position with range differences removed entirely, which is why it can be cited as the general size of the effect rather than a 654r number.',
  }),

  /* ── Puzzle 4: why connected boards suppress IP's c-bet ──────────────── */

  'flops.straight-count': ref({
    id: 'flops.straight-count',
    derivation: 'exact_transcription',
    scope:
      'The source’s own definition of a flop’s straight count, with four worked examples. Pure board classification — no strategy, no matchup, no stack depth attached.',
  }),

  'flops.oesd-subcategory-limits': ref({
    id: 'flops.oesd-subcategory-limits',
    derivation: 'exact_transcription',
    scope:
      'The source stating the limit of his own classification chapter: the OESD subcategory exists but is not developed there. It is why no worked example of an OESD count appears in the source, and why this puzzle enumerates its board’s open-enders card by card instead of asserting a bucket label.',
  }),

  'cbet.oesd-subcategory': ref({
    id: 'cbet.oesd-subcategory',
    derivation: 'exact_transcription',
    scope:
      'The nesting that decides how this puzzle’s two boards relate: the OESD count is a subcategory INSIDE the zero-straight flops, not a separate axis. Both of this puzzle’s flops therefore have zero flopped straights.',
  }),

  'cbet.three-oesd-lowest': ref({
    id: 'cbet.three-oesd-lowest',
    derivation: 'exact_transcription',
    scope:
      'IP’s flop c-bet frequency and bet-size on zero-straight flops broken down by OESD count, same aggregated 20bb/30bb/40bb MTT-range dataset. States both halves of the effect — lower frequency, larger sizes — and the reason, but prints no figure for either bucket.',
  }),

  /*
   * The one place the book puts numbers on a straight-count bucket. It is NOT
   * the Diagram 42/43 comparison above: it sits in the unpaired-flops-by-texture
   * section and is expressed as check frequencies. This puzzle cites it to mark
   * where those figures live and deliberately does not import them, because
   * "the flops in Diagram 42's buckets are c-bet at X%" is not something the
   * source says. No `quote` for the same reason — the chip UI renders quotes,
   * and quoting this one would put the numbers on screen by the back door.
   */
  'cbet.straight-count-figures-elsewhere': ref({
    id: 'cbet.straight-count-figures-elsewhere',
    derivation: 'exact_transcription',
    scope:
      'Unpaired flops in the aggregate. The source’s only printed figures per straight-count bucket, given as how often the flop is CHECKED, inside the flop-texture section — not as c-bet frequencies for the diagram/43 comparison this puzzle teaches. Cited to locate them, not to import them.',
  }),

  /* ── Puzzle 4: BN c-bet on 8♥6♦2♠ (40bb) — Flop Strategy Example 5 ────── */

  'eqb.definitions': ref({
    id: 'eqb.definitions',
    derivation: 'exact_transcription',
    scope:
      'The source’s definition of the four equity buckets. Hand-vs-RANGE equity, so a hand’s bucket is relative to the ranges in play and the board — it is not a fixed property of the two cards.',
  }),

  /*
   * Four refs this puzzle needs are already in the registry above and are NOT
   * duplicated here — reusing them keeps one id per claim, which is what makes
   * a scope statement worth trusting:
   *   range strength → c-bet FREQUENCY  ... 'cbet.range-strength-drives-frequency' (p.659)
   *   stack depth → bet SIZE            ... 'cbet.sizes-by-stack-depth'            (p.660)
   *   c-bet frequency by top card       ... 'cbet.by-top-card'                     (p.661)
   *   OESD count → lower freq, bigger   ... 'cbet.three-oesd-lowest'               (p.661)
   */

  'cbet.polarity-drives-size': ref({
    id: 'cbet.polarity-drives-size',
    derivation: 'exact_transcription',
    scope:
      'The source flop c-bet section, 20bb/30bb/40bb MTT-range aggregate — the general rule linking IP’s range SHAPE to bet-SIZE. Says nothing about how often IP bets.',
  }),

  'cbet.example-matrix': ref({
    id: 'cbet.example-matrix',
    derivation: 'exact_transcription',
    scope:
      'The six worked IP c-bet examples, all at 40bb. Cited for the section’s own ORGANISATION — frequency and bet-size are varied independently across the six headings — not for any number.',
  }),

  'ex5.low-freq-big-size': ref({
    id: 'ex5.low-freq-big-size',
    derivation: 'exact_transcription',
    scope:
      'BN’s flop c-betting strategy on 8♥6♦2♠ at 40bb after the BB checks. This puzzle’s exact spot. The heading names the strategy’s two axes; the numbers behind it live in the diagram, which is an image.',
  }),

  'ex5.range-distribution': ref({
    id: 'ex5.range-distribution',
    derivation: 'exact_transcription',
    scope:
      'BN vs BB on 8♥6♦2♠ at 40bb — the source’s own causal explanation for this flop’s strategy. Qualitative: no equity-bucket percentages are printed for this board.',
  }),

  'ex5.strong-hands-check-back': ref({
    id: 'ex5.strong-hands-check-back',
    derivation: 'exact_transcription',
    scope: 'BN vs BB on 8♥6♦2♠ at 40bb — what the BN does with the top of its range.',
  }),

  'ex5.dont-cbet-all-value': ref({
    id: 'ex5.dont-cbet-all-value',
    derivation: 'exact_transcription',
    scope:
      'BN vs BB on 8♥6♦2♠ at 40bb — the author’s named leak, stated for this spot. Explains why a low c-bet frequency is not timidity.',
  }),

  'ex5.good-hands-check-back': ref({
    id: 'ex5.good-hands-check-back',
    derivation: 'exact_transcription',
    scope: 'BN vs BB on 8♥6♦2♠ at 40bb — the default for the BN’s good hands as a group.',
  }),

  'ex5.middle-pair-a6': ref({
    id: 'ex5.middle-pair-a6',
    derivation: 'exact_transcription',
    scope:
      'BN vs BB on 8♥6♦2♠ at 40bb. The source names A6 by hand and places it in the GOOD bucket. It says "mostly c-bet" — a direction, not a printed frequency.',
  }),

  'ex5.weak-hands': ref({
    id: 'ex5.weak-hands',
    derivation: 'exact_transcription',
    scope:
      'BN vs BB on 8♥6♦2♠ at 40bb — how the BN selects bluffs, and the criterion it uses (can this hand call a check-raise?).',
  }),

  'ex5.trash-hands': ref({
    id: 'ex5.trash-hands',
    derivation: 'exact_transcription',
    scope:
      'BN vs BB on 8♥6♦2♠ at 40bb — why even the bottom of the range is not bet at 100%, which is part of what holds the overall frequency down.',
  }),

  'ex5.xr-frequency': ref({
    id: 'ex5.xr-frequency',
    derivation: 'exact_transcription',
    scope:
      'BB’s equilibrium check-raise frequency on 8♥6♦2♠ at 40bb, against the BN. One of only two numeric frequencies the source prints for this board.',
  }),

  'ex5.bn-vs-xr-response': ref({
    id: 'ex5.bn-vs-xr-response',
    derivation: 'exact_transcription',
    scope:
      'BN’s equilibrium response to a 50%-pot check-raise on 8♥6♦2♠ at 40bb. A three-way split of the BN’s c-betting range only — not of its whole range.',
  }),

  /* ── Puzzle 4: A76r, the flop the BB should never lead ────────────────
   *
   * The mirror of the 654r material above, and it comes from the same pages —
   * which is exactly why each ref below is scoped tightly. The chapter prints
   * A76r figures from three different places: the 20/30/40bb BN+UTG average
   * (p.632), the 20/30/40bb equity-bucket diagram (p.634), and a BB vs BN 30bb
   * table for this one flop (Table 101, p.635). Only the last is this puzzle's
   * exact spot.
   */

  'a76r.buckets': ref({
    id: 'a76r.buckets',
    derivation: 'exact_transcription',
    scope:
      'BB vs IP equity-bucket distribution on A76r, averaged over 20bb/30bb/40bb stacks. The 85% and 65% are IP’s top-pair equity against the BB’s RANGE — not the equity of any particular holding.',
  }),

  'a76r.bb-good-and-trash': ref({
    id: 'a76r.bb-good-and-trash',
    derivation: 'exact_derived',
    scope:
      'The BB’s good and trash buckets on A76r, read out of the comparison the source prints: the 17% and the 49% ARE the A76r values, stated as the baseline the 654r figures move away. Same 20bb/30bb/40bb average as the rest of the diagram.',
  }),

  'a76r.donk-reverses-eqr': ref({
    id: 'a76r.donk-reverses-eqr',
    derivation: 'exact_transcription',
    scope: 'A76r, BB vs IP — the causal explanation for the near-zero donk frequency, stated as the exact reversal of the 654r case.',
  }),

  'a76r.ip-cbets-100': ref({
    id: 'a76r.ip-cbets-100',
    derivation: 'exact_transcription',
    scope:
      'BB vs BN on A76r at 30bb — this puzzle’s exact spot. What IP does once the BB checks, and what leading costs the BB’s strongest hands.',
  }),

  'a76r.top-pair-lock-ev': ref({
    id: 'a76r.top-pair-lock-ev',
    derivation: 'exact_transcription',
    scope:
      'BB vs BN on A76r at 30bb — the GTO solution against a LOCKED strategy that donks every top pair or better. This puzzle’s exact spot and exactly the temptation it is about. The figures are printed without a unit in the prose; see the exhibit note.',
  }),

  'a76r.bb-ev-share-of-pot': ref({
    id: 'a76r.bb-ev-share-of-pot',
    derivation: 'exact_transcription',
    scope:
      'A76r BB vs BN at 30bb — the BB’s EV as a SHARE OF THE POT out of position (25%), compared with a hypothetical sim where the BB has position. Cited here for one narrow purpose: it is what establishes that Table 101’s bare "25" is 25% of the pot.',
  }),

  'a76r.check-100': ref({
    id: 'a76r.check-100',
    derivation: 'exact_transcription',
    scope: 'BB vs BN on A76r at 30bb — the source’s explicit strategic recommendation for the BB on this flop.',
  }),

  'a76r.donk-option-worthless': ref({
    id: 'a76r.donk-option-worthless',
    derivation: 'exact_transcription',
    scope:
      'A76r specifically — the flop’s own donk frequency and the EV cost of removing the option, printed alongside the 654r figures of the table. This is an A76r figure, not the 20/30/40bb BN+UTG average.',
  }),

  'no-donk.family-metrics': ref({
    id: 'no-donk.family-metrics',
    derivation: 'exact_transcription',
    scope:
      'Averages across the ENTIRE no-donk-bet flop group — the vast majority of flops, of which AXX boards are named members. Not an A76r-specific figure.',
  }),

  /* ── Puzzle 4: BB vs UTG on Q♥J♥T♥ (40bb) — Flop Strategy Example 2 ─────
   *
   * The whole point of this spot is a distinction the book makes structurally
   * and most players collapse: it files its four IP c-bet examples on a 2x2 of
   * FREQUENCY x SIZE. Q♥J♥T♥ is "high c-bet % and small bet-size" and A♥Q♦3♠
   * is "high c-bet % and big bet-size" — same frequency cell, opposite size
   * cell. Any ref below that talks about size must not be read as a statement
   * about frequency, or vice versa.
   *
   * The fabrication hazard here is unusually specific, which is why
   * `texture.qxx-category-average` and `texture.straights-reduce-cbet` are in
   * the registry at all: the book prints NO c-bet frequency for this flop, and
   * two different cuts of a DIFFERENT dataset (the Ch.12 20/30/40bb aggregate,
   * see `position.ch12-sim-scope`) sit close enough to be mistaken for one —
   * 85% for Qxx by rank, and 31% CHECKED for three-flopped-straight boards.
   * They contradict each other and neither is this board. Both are cited only
   * inside the unsourced note that rules them out.
   */

  'ex2.heading-high-freq-small-size': ref({
    id: 'ex2.heading-high-freq-small-size',
    derivation: 'exact_transcription',
    scope:
      'UTG’s flop c-betting strategy on Q♥J♥T♥ at 40bb. The source’s own two-part classification of this node: the frequency is high AND the size is small, named independently of one another.',
  }),

  'ex2.range-advantage-but-small': ref({
    id: 'ex2.range-advantage-but-small',
    derivation: 'exact_transcription',
    scope:
      'BB vs UTG on Q♥J♥T♥ at 40bb — the source’s own causal explanation for why a substantial range advantage still cannot be bet big. A specific 40bb solve, not a category average.',
  }),

  'ex2.big-bet-helps-bb': ref({
    id: 'ex2.big-bet-helps-bb',
    derivation: 'exact_transcription',
    scope:
      'BB vs UTG on Q♥J♥T♥ at 40bb — what each of the two candidate sizes does to the BB’s range. The second half of the passage; the sentence begins and completes here.',
  }),

  'ex2.min-bet-100-no-ev-loss': ref({
    id: 'ex2.min-bet-100-no-ev-loss',
    derivation: 'exact_transcription',
    scope:
      'UTG on Q♥J♥T♥ at 40bb — the simplification the author endorses for this exact flop. It is a WHOLE-RANGE statement: it covers every hand UTG can hold, and is the reason no per-combo figure is needed or claimed.',
  }),

  'ex2.table-114': ref({
    id: 'ex2.table-114',
    derivation: 'exact_transcription',
    scope:
      'UTG’s c-betting breakdown on Q♥J♥T♥ at 40bb. Printed as a table image — no c-bet frequency, bet-size split or per-combo figure from it appears anywhere in the running text. Cited to establish that the gap is a gap, never as a number.',
  }),

  'ex2.ip-almost-never-checks-back': ref({
    id: 'ex2.ip-almost-never-checks-back',
    derivation: 'exact_transcription',
    scope:
      'IP’s flop strategy on A♠Q♦3♠ and Q♥J♥T♥ at 40bb. A qualitative statement about how rarely IP checks back this flop — the source gives no percentage, and this ref must not be rendered as one.',
  }),

  'ex2.bb-36-equity': ref({
    id: 'ex2.bb-36-equity',
    derivation: 'exact_transcription',
    scope:
      'BB vs UTG on Q♥J♥T♥ at 40bb, facing UTG’s flop MIN-BET. The source’s own analysis of this exact node from the defender’s side — the response frequencies are to the min-bet specifically, not to any bet.',
  }),

  'ex2.utg-equity-derived': ref({
    id: 'ex2.utg-equity-derived',
    derivation: 'exact_derived',
    scope:
      'UTG on Q♥J♥T♥ at 40bb. The source prints only the BB’s side: 36% equity and 28% of the pot captured. Heads-up range-vs-range equity and pot share each sum to 100%, so UTG has 64% equity and captures 72% of the pot. Subtraction only — no solver output is being reconstructed.',
  }),

  'ex1.aq3-high-freq-big-size': ref({
    id: 'ex1.aq3-high-freq-big-size',
    derivation: 'exact_transcription',
    scope:
      'BB vs UTG on A♥Q♦3♠ at 40bb — the source’s other HIGH-frequency c-bet example, and the one where the size is big. Cited only as the contrast case; none of its figures describe Q♥J♥T♥.',
  }),

  /* ── Why monotone texture behaves this way (Ch.12 aggregate — labelled) ── */

  'texture.monotone-most-cbet-smallest-size': ref({
    id: 'texture.monotone-most-cbet-smallest-size',
    derivation: 'exact_transcription',
    scope:
      'The aggregate over thousands of GTO solutions at 20bb/30bb/40bb with MTT starting ranges (see position.ch12-sim-scope), cut by flop SUIT texture. A category average across all monotone flops — the general mechanism behind Q♥J♥T♥, never a figure for it.',
  }),

  'texture.monotone-betting-big-mistake': ref({
    id: 'texture.monotone-betting-big-mistake',
    derivation: 'exact_transcription',
    scope:
      'The author’s own statement of the error this puzzle is built around, general to monotone flops rather than specific to Q♥J♥T♥.',
  }),

  'texture.monotone-simplify-min-bet': ref({
    id: 'texture.monotone-simplify-min-bet',
    derivation: 'exact_transcription',
    scope:
      'General simplification advice for monotone flops in the 20bb/30bb/40bb MTT-range aggregate. Consistent with the Q♥J♥T♥ solve, but stated for the category.',
  }),

  /*
   * The two refs below exist to be RULED OUT. They are the nearest-looking
   * numbers to "how often does UTG c-bet Q♥J♥T♥" and neither answers it: both
   * are cuts of the Ch.12 20/30/40bb MTT aggregate rather than this 40bb solve,
   * and they point in opposite directions. They appear in this puzzle only
   * inside the unsourced note that disqualifies them.
   */

  'texture.qxx-category-average': ref({
    id: 'texture.qxx-category-average',
    derivation: 'exact_transcription',
    scope:
      'A RANK-category average across ALL Qxx flops in the 20bb/30bb/40bb MTT-range aggregate — connected and disconnected, monotone and rainbow, straights possible and not. It is NOT the c-bet frequency for Q♥J♥T♥ and must never be presented as one.',
  }),

  'texture.straights-reduce-cbet': ref({
    id: 'texture.straights-reduce-cbet',
    derivation: 'exact_transcription',
    scope:
      'A CONNECTEDNESS cut of the same 20bb/30bb/40bb MTT-range aggregate. Q♥J♥T♥ has three flopped straights (AK, K9, 98), so this cut would put it in the 31%-checked group — which contradicts the 85% Qxx cut. Cited to show the aggregates cannot settle this board, never as this board’s figure.',
  }),

  /* The p.596 equity-bucket definitions this puzzle needs are already in the
   * registry as `eqb.definitions` — reused rather than re-cited, so one page
   * does not end up with two ids. */

  /*
   * PAGE CORRECTION: this quote is printed in full on p.395; only the closing
   * "(Hand Ranges 167-174)" of its paragraph carries over onto p.396, which is
   * where this ref used to point. Verified by extracting p.395 and p.396 from
   * docs/Modern Poker Theory.pdf directly. Puzzle 1 cites it for the same claim,
   * so the fix improves that citation too rather than forking a second ref.
   */
  /* ── Puzzle 4: the SAME board, the OTHER flop line — x/x, not x/b/c ─────
   *
   * This is the sharpest scope trap in the book, and the reason every ref below
   * carries "(x/x)" in its scope. Modern Poker Theory studies 9♥8♥4♦ at 40bb
   * down TWO separate turn lines and prints a full set of EQ/EV heatmaps for
   * each:
   *
   *   x/x    — the flop checks through   (pp.760-764, Tables 134-137)
   *   x/b/c  — UTG c-bets and BB calls   (pp.765-771, Tables 138-141)
   *
   * The two produce different numbers from the same flop, and the sentences read
   * almost identically. The `ex3.turn-*` refs above are the x/b/c line and belong
   * to puzzle 2; the `xx.*` refs below are the x/x line and belong to puzzle 4.
   * Quoting one at the other's node would be a fabrication that no reader could
   * catch, because the page would exist and the board would match.
   */

  'xx.ip-checkback-capped': ref({
    id: 'xx.ip-checkback-capped',
    derivation: 'exact_transcription',
    scope:
      'The general shape of IP’s range on any turn after IP checks back the flop (x/x). A statement about range structure, not a frequency for any board.',
  }),

  'xx.oop-range-uncapped': ref({
    id: 'xx.oop-range-uncapped',
    derivation: 'exact_transcription',
    scope:
      'OOP’s range on any turn after the flop checks through (x/x). Stated CONDITIONALLY — it holds only where OOP has no donk betting range on that flop.',
  }),

  'xx.ranges-invert': ref({
    id: 'xx.ranges-invert',
    derivation: 'exact_transcription',
    scope:
      'The conclusion the source draws from the two range descriptions above, for the x/x line generally — this is the sentence the whole puzzle turns.',
  }),

  'xx.oop-turn-bet-sizes': ref({
    id: 'xx.oop-turn-bet-sizes',
    derivation: 'exact_transcription',
    scope:
      'Which bet-sizes exist in the solution at OOP’s first turn action after a check-back, across the source’s four flop strategy examples. It names the sizes; it prints no split between them for any single turn card.',
  }),

  'xx.984-condensed-vs-j66': ref({
    id: 'xx.984-condensed-vs-j66',
    derivation: 'exact_transcription',
    scope:
      'BB vs UTG on 9♥8♥4♦ at 40bb in the x/x line, COMPARED with J♠6♥6♦. Every claim here is relative to that other board, not an absolute statement about this one.',
  }),

  'xx.984-polarization-advantage': ref({
    id: 'xx.984-polarization-advantage',
    derivation: 'exact_transcription',
    scope:
      'BB vs UTG on 9♥8♥4♦ at 40bb, turn, after the flop CHECKED THROUGH. Not the x/b/c line, which the source solves separately.',
  }),

  /*
   * Three more refs this line needs are already in the registry above, added for
   * the board-reading puzzle, and are deliberately NOT duplicated here:
   *   the x/x heading and setup ......... 'turn.984-xx-setup'      (p.760)
   *   which turn cards favour whom ...... 'turn.984-good-cards-xx' (p.763)
   *   the EQ/EV extremes by turn card ... 'turn.984-worst-card-xx' (p.764)
   * One id per claim is what makes a scope statement worth trusting: a second id
   * quoting the same sentence is a second place for that scope to drift.
   */

  'ex3.utg-checkback-composition': ref({
    id: 'ex3.utg-checkback-composition',
    derivation: 'exact_transcription',
    scope:
      'UTG’s FLOP c-betting strategy on 9♥8♥4♦ at 40bb, read for what it leaves behind: these are per-hand-class check-back frequencies, not slices of one range and not turn figures.',
  }),

  /* The bucket definitions this puzzle names its hand with are 'eqb.definitions'
   * (p.596), already in the registry — not restated here for the same reason. */

  'preflop.bb-3bet-value-40bb': ref({
    id: 'preflop.bb-3bet-value-40bb',
    derivation: 'exact_transcription',
    scope:
      'BB vs BN compared with BB vs UTG at 40bb — the composition of the BB’s 3-betting VALUE range, and how it changes when only the opener’s seat changes. States hand CLASSES; never a combo or a per-combo frequency.',
  }),

  /* ── Flop Strategy Example 1: A♥Q♦3♠, BB vs UTG, 40bb ─────────────────
   *
   * The trap in this example is a units trap rather than a scope trap. The
   * headline numbers — 1.07% of the pot, 6.6bb/100 — are the cost of applying a
   * SIMPLIFICATION to IP's whole range. They are not the EV of a hand, and a
   * puzzle that attaches them to the two cards on screen would be teaching a
   * confident falsehood with a real page number under it. Every scope below
   * says which of the two it is, and `puzzleContent.test.ts` pins it.
   */

  'aq3.example-header': ref({
    id: 'aq3.example-header',
    derivation: 'exact_transcription',
    scope:
      'The source’s own worked example: BB vs UTG, single raised pot, A♥Q♦3♠, 40bb effective — the exact spot this puzzle uses. The source files it under high c-bet % AND big bet-size, which is the whole lesson in the title.',
  }),

  'aq3.simplification-ev': ref({
    id: 'aq3.simplification-ev',
    derivation: 'exact_transcription',
    scope:
      'IP’s EV on A♥Q♦3♠ at 40bb vs the BB. Every figure here measures a SIMPLIFICATION applied across IP’s ENTIRE RANGE — 1.07% of the pot and 6.6bb/100 are what the range gives up by standardising on the 1/3-pot size, and are NOT the EV loss of any individual hand. The 14.45% is how often the solver uses an option that earns it nothing.',
  }),

  'aq3.no-nutted-hands': ref({
    id: 'aq3.no-nutted-hands',
    derivation: 'exact_transcription',
    scope:
      'Range-vs-range on A♥Q♦3♠, BB vs UTG at 40bb — the mechanism behind the big bet-size. The 72% and 85% are whole-range figures for UTG on this flop, not per-hand numbers.',
  }),

  'aq3.xr-frequency': ref({
    id: 'aq3.xr-frequency',
    derivation: 'exact_transcription',
    scope:
      'Equilibrium check-raise frequency the BB uses against UTG on A♥Q♦3♠ at 40bb. Cited only to answer “won’t betting everything get me raised?” — this puzzle does not play the x/r branch.',
  }),

  'aq3.bb-trash-16-equity': ref({
    id: 'aq3.bb-trash-16-equity',
    derivation: 'exact_transcription',
    scope:
      'The BB’s range composition on AQ3r vs UTG at 40bb, and the equity of its trash hands against UTG’s range. Same match-up and depth as Flop Strategy Example 1, reached from the defender’s side of the chapter.',
  }),

  'aq3.bb-defends-42': ref({
    id: 'aq3.bb-defends-42',
    derivation: 'exact_transcription',
    scope:
      'BB vs UTG on AQ3r at 40bb, facing the 1/3-pot c-bet specifically. The 58/42 split is the BB’s whole-range defence against that one size — not against the 2/3-pot size this puzzle answers with.',
  }),

  /* ── Chapter-level c-bet facts, aggregated over many flops ───────────── */

  'cbet.axx-96': ref({
    id: 'cbet.axx-96',
    derivation: 'exact_transcription',
    scope:
      'An aggregate over ALL Axx flops in the dataset — thousands of GTO solutions at 20bb/30bb/40bb with MTT starting ranges. It is the frequency for the Axx FAMILY, not a measurement of A♥Q♦3♠, and not the frequency of any one hand.',
  }),

  'cbet.check-back-costs': ref({
    id: 'cbet.check-back-costs',
    derivation: 'exact_transcription',
    scope:
      'IP’s EV loss from checking back EVERY flop, across the whole dataset (20bb/30bb/40bb, MTT ranges). A statement about the checking strategy in general — not a figure for A♥Q♦3♠ and not the cost of checking one hand once.',
  }),

  'cbet.size-up-vs-trash': ref({
    id: 'cbet.size-up-vs-trash',
    derivation: 'exact_transcription',
    scope:
      'A general IP c-betting principle the author states for all flops. It is the rule that connects the BB’s 70% trash on this board to the choice of the bigger size.',
  }),

  'cbet.default-third-pot': ref({
    id: 'cbet.default-third-pot',
    derivation: 'exact_transcription',
    scope:
      'The author’s fallback advice when a player does not know the flop strategy for their range. It is why 1/3-pot is graded a defensible answer here rather than a blunder — and it is general advice, not a recommendation for A♥Q♦3♠.',
  }),

  /* ── "One hand, two openers": what changes when only the seat changes ───
   *
   * All four refs below are the prose around Table 61 on p.395 — the one page
   * where the book explains IN WORDS, rather than as a chart image, why the BB's
   * 40bb defence against a button and against UTG differ. The two aggregates
   * being compared are already registered above: Hand Range 167 at p.396
   * ('preflop.bb-vs-bn-40bb-chart') and Hand Range 173 at p.402
   * ('ex3.preflop-bb-vs-utg-40bb').
   *
   * Every one of these is a WHOLE-RANGE statement or a hand-CLASS statement.
   * None is a per-combo frequency, and the charts they describe are colour-coded
   * images whose per-hand colours are printed nowhere in text — so the scopes
   * below say that explicitly, because the obvious fabrication in this spot is
   * turning "the value range shrinks to TT+ and AK" into a decimal for a combo.
   */

  'bb40.fold-jumps-by-seat': ref({
    id: 'bb40.fold-jumps-by-seat',
    derivation: 'exact_transcription',
    scope:
      'BB defending an IP open at 40bb with MTT ranges. A WHOLE-RANGE folding frequency at each of two openers — it states how much of the range folds, never which hands do.',
  }),

  'bb40.defend-tighter-vs-ep': ref({
    id: 'bb40.defend-tighter-vs-ep',
    derivation: 'exact_transcription',
    scope:
      'The BB’s defence against an early-position opener at 40bb — the source’s own instruction for how the strategy should change, stated as a direction rather than as a hand list.',
  }),

  'bb40.bluffs-shrink-with-value': ref({
    id: 'bb40.bluffs-shrink-with-value',
    derivation: 'exact_transcription',
    scope:
      'BB 3-betting ranges at 40bb, BN compared with UTG — why the 3-bet branch narrows at BOTH ends against an early-position opener. Names no replacement bluffs; the source leaves those to the chart images.',
  }),

  'bb40.no-rejam-vs-ep': ref({
    id: 'bb40.no-rejam-vs-ep',
    derivation: 'exact_transcription',
    scope:
      'BB at 40bb — why the all-in re-raise branch shrinks as the opener’s position gets earlier. This is the source’s own explanation for why the chart prints an all-in branch (3%) and the chart prints none at all.',
  }),

  /* ── "One hand, two stack depths": 15bb vs 40bb, same matchup ────────────
   *
   * The refs below complete the BB-vs-BN ladder. The 25bb and 40bb rungs were
   * already registered above ('preflop.bb-vs-bn-25bb-chart',
   * 'preflop.bb-vs-bn-40bb-chart', 'bb40.no-rejam-vs-ep',
   * 'preflop.bb-3bet-value-40bb'); what was missing was the 15bb rung and the
   * two nodes on the OPENER's side of the same tree that print this matchup's
   * bet-sizes.
   *
   * The structural fact these exist to protect is that the 15bb chart has THREE
   * branches and the 40bb chart has FOUR. There is no non-all-in 3-bet in the
   * 15bb solution at all — not a small one, none — and p.381 says why in the
   * author's own words. Any puzzle that offers "3-bet" as a choice at 15bb is
   * therefore offering an action the source does not price, and the honest
   * feedback is to say so rather than to attach a plausible-looking size to it.
   *
   * Every figure here is a WHOLE-RANGE aggregate or a hand-CLASS statement. The
   * charts themselves are colour-coded images; no per-combo frequency for any
   * hand at any of these depths is printed in text anywhere in the book.
   */

  'depth.bb-vs-bn-15bb-chart': ref({
    id: 'depth.bb-vs-bn-15bb-chart',
    derivation: 'exact_transcription',
    scope:
      'BB defending against a BN min-raise at 15bb, 9-max MTT with a 12.5% ante. Whole-range aggregates printed with the chart, not the frequency of any individual hand. Note what is absent: THREE branches are printed, and a non-all-in 3-bet is not one of them.',
  }),

  'depth.15bb-no-non-allin-3bet': ref({
    id: 'depth.15bb-no-non-allin-3bet',
    derivation: 'exact_transcription',
    scope:
      'BB defending against a min-raise at 15bb, across ALL four in-position openers. The author’s own statement of why every 15bb chart in this section prints no 3-bet branch — the reason is the stack depth, and nothing about any particular hand.',
  }),

  'depth.15bb-who-jams': ref({
    id: 'depth.15bb-who-jams',
    derivation: 'exact_transcription',
    scope:
      'BB vs IP at 15bb — which hand CLASSES the solver rejams, and the reason it prefers getting the money in pre-flop with them. It names classes and its own exceptions (AA and KK, and small pairs vs EP); it attaches no frequency to any individual hand.',
  }),

  'depth.bn-response-to-15bb-jam': ref({
    id: 'depth.bn-response-to-15bb-jam',
    derivation: 'exact_transcription',
    scope:
      'The OPENER’s side of this puzzle’s 15bb node: how a BN who min-raised to 2bb responds when the BB jams 15bb, 9-max MTT with a 12.5% ante. Two things come from here — the fold equity the jam actually generates, and the 2bb open size, which the node’s own label prints.',
  }),

  'depth.bn-response-to-40bb-3bet': ref({
    id: 'depth.bn-response-to-40bb-3bet',
    derivation: 'exact_transcription',
    scope:
      'The OPENER’s side of this puzzle’s 40bb node, 9-max MTT with a 12.5% ante. This is the only place the source prints the two bet-sizes of the 40bb BB-vs-BN tree, and it prints them in the node’s own label: the BN opens to 2.3x and the BB’s non-all-in 3-bet is 3.5x. The source prose around the chart does not restate either size, so the sizes are read from here — the opener’s branch of the same 40bb solution — and never assumed.',
  }),

  'depth.only-4bet-is-all-in': ref({
    id: 'depth.only-4bet-is-all-in',
    derivation: 'exact_transcription',
    scope:
      'The opener facing a non-all-in 3-bet at 25-40bb, across positions. Cited for what a 40bb 3-bet is risking — the counter-raise it can face has exactly one size — never as a frequency for any seat.',
  }),

  'preflop.rfi-sweet-spot': ref({
    id: 'preflop.rfi-sweet-spot',
    derivation: 'exact_transcription',
    scope:
      'The author’s recommended OPEN-RAISE sizing band for MTT play, and when to prefer a min-raise instead. It is NOT the size printed with any opening chart — those print no size at all. Cited to justify a puzzle’s fixed open-size assumption as reasonable, never as the size a chart was solved at.',
  }),

  /* ── Puzzle 16: BB vs UTG's MIN-BET on Q♥J♥T♥ (40bb) ──────────────────
   *
   * Flop Strategy Example 2 of the C-bet Defense section, pp.739-741. Every
   * `qjtdef.*` ref below is a hand-class rule for ONE board and ONE bet-size,
   * and the book prints a separate breakdown for each pairing of those two on
   * purpose — Table 122 is AQ3r vs 2/3-pot, Table 123 is Q♥J♥T♥ vs a min-bet,
   * Table 124 is 9♥8♥4♦ vs 2/3-pot, Table 125 is J♠6♥6♦ vs a min-bet. The rules
   * genuinely disagree across them: OESD on Q♥J♥T♥ "will only continue if they
   * are drawing to the nut straight", while on 9♥8♥4♦ OESD "are x/c every time".
   * So no `qjtdef.*` ref may be cited for any board but Q♥J♥T♥, and none of them
   * describes the BB's response to any size other than the min-bet.
   */

  'qjtdef.table-123': ref({
    id: 'qjtdef.table-123',
    derivation: 'exact_transcription',
    scope:
      'The BB’s hand-class breakdown on Q♥J♥T♥ at 40bb facing UTG’s flop MIN-BET. The table itself is printed as an image — every figure this puzzle uses comes from the running-text bullets beneath it, and no per-combo number appears anywhere in that text. Cited to establish where the gap is, never as a number. The 38.26 / 18 / 43 sentence begins and completes on this page.',
  }),

  'qjtdef.bottom-pair': ref({
    id: 'qjtdef.bottom-pair',
    derivation: 'exact_transcription',
    scope:
      'BB vs UTG on Q♥J♥T♥ at 40bb facing a MIN-BET. The rule that splits bottom pair by kicker on this board against this size. It is the class A♠T♦ belongs to, and it is stated as a rule rather than a frequency.',
  }),

  'qjtdef.middle-pair': ref({
    id: 'qjtdef.middle-pair',
    derivation: 'exact_transcription',
    scope:
      'BB vs UTG on Q♥J♥T♥ at 40bb facing a MIN-BET. The class one rank above the hero hand, cited to show that the source draws the same kicker line twice rather than once.',
  }),

  'qjtdef.top-pair-44': ref({
    id: 'qjtdef.top-pair-44',
    derivation: 'exact_transcription',
    scope:
      'BB vs UTG on Q♥J♥T♥ at 40bb. An EQUITY figure and a qualitative judgement — the bullet prints no fold, call or raise frequency for top pair, and must not be rendered as one.',
  }),

  'qjtdef.flushes-xr': ref({
    id: 'qjtdef.flushes-xr',
    derivation: 'exact_transcription',
    scope:
      'BB vs UTG on Q♥J♥T♥ at 40bb facing a MIN-BET — the top of the BB’s check-raising range on a monotone board.',
  }),

  'qjtdef.straight-flush-slowplay': ref({
    id: 'qjtdef.straight-flush-slowplay',
    derivation: 'exact_transcription',
    scope: 'BB vs UTG on Q♥J♥T♥ at 40bb facing a MIN-BET — the nuts, and why they are not the hand that raises.',
  }),

  'qjtdef.made-hands-xr': ref({
    id: 'qjtdef.made-hands-xr',
    derivation: 'exact_transcription',
    scope:
      'BB vs UTG on Q♥J♥T♥ at 40bb facing a MIN-BET. Check-RAISE frequencies for three classes; what is not raised is not thereby folded, and the bullets say nothing about the fold branch.',
  }),

  'qjtdef.draws-xr-third': ref({
    id: 'qjtdef.draws-xr-third',
    derivation: 'exact_transcription',
    scope:
      'BB vs UTG on Q♥J♥T♥ at 40bb facing a MIN-BET. Note the second sentence: on a monotone board the same two ranks change class depending on whether they hold a heart, which is why A♠T♦ is not a combo draw.',
  }),

  'qjtdef.oesd': ref({
    id: 'qjtdef.oesd',
    derivation: 'exact_transcription',
    scope:
      'BB vs UTG on Q♥J♥T♥ at 40bb facing a MIN-BET. This is the QJT-monotone rule ONLY. The source’s breakdown for 9♥8♥4♦ says the opposite for the same class — "OESD are x/c every time" — which is why this ref must never travel to another board.',
  }),

  'qjtdef.folds': ref({
    id: 'qjtdef.folds',
    derivation: 'exact_transcription',
    scope:
      'BB vs UTG on Q♥J♥T♥ at 40bb facing a MIN-BET — the classes that fold even at this price. The boundary that makes "defend wide" a roster rather than a licence.',
  }),

  'qjtdef.a-high-gutshot': ref({
    id: 'qjtdef.a-high-gutshot',
    derivation: 'exact_transcription',
    scope:
      'BB vs UTG on Q♥J♥T♥ — a statement about what this board does to every ace-high and king-high holding. A texture fact, not a strategy frequency.',
  }),

  'qjtdef.alpha-mdf': ref({
    id: 'qjtdef.alpha-mdf',
    derivation: 'exact_transcription',
    scope:
      'The definition of MDF and Alpha, derived in a two-hand toy game. Pure arithmetic of bet size against pot — no board, no range and no equity enters it, which is exactly the limitation goes on to spell out.',
  }),

  'qjtdef.mdf-ignores-equities': ref({
    id: 'qjtdef.mdf-ignores-equities',
    derivation: 'exact_transcription',
    scope:
      'The author’s own statement of what MDF is worth as a defence strategy. General to the whole c-bet defence chapter, not tied to any board.',
  }),

  'qjtdef.min-bet-pot-odds': ref({
    id: 'qjtdef.min-bet-pot-odds',
    derivation: 'exact_transcription',
    scope:
      'The source’s general rule for reading a bet-size, stated with the min-bet as its worked case. It is the reason a breakdown is printed per size as well as per board.',
  }),

  'preflop.sizing-guidelines': ref({
    id: 'preflop.sizing-guidelines',
    derivation: 'exact_transcription',
    scope:
      'GENERAL pre-flop sizing guidance from the strategy chapter. It is NOT the open size used in the 40bb BB-defence simulations — the source prints no size for those. Cited only to disclose, and argue against, a puzzle’s own fixed open-size assumption.',
  }),

  /* ── Puzzle 10: recognising a depolarized range (Flop Strategy Example 6) ──
   *
   * The book's Flop Strategy Example 6 runs from p.695 to p.698 and is one of
   * the better-evidenced spots in the chapter: it prints TWO charts and a full
   * per-hand-class table for this one flop. Three scoping facts have to travel
   * with every number below, because each one is a place the evidence could be
   * over-read:
   *
   * 1. TABLE 118's CAPTION SAYS "UTG". The section header (p.695), Diagram 67's
   *    own caption (p.696) and the prose on pp.696 and 698 all say BB vs BN, and
   *    p.698 discusses "the BN's GTO strategy vs a flop x/r" from this very
   *    table. The caption is the odd one out — the preceding table, Table 117, is
   *    the BN's breakdown on 8♥6♦2♠, so "UTG" in 118's caption reads as a
   *    carried-over misprint. This repo treats Table 118 as the BN table on the
   *    strength of the example it belongs to, and says so wherever it is used
   *    rather than silently picking one reading.
   *
   * 2. THE TABLE'S ROWS ARE CLASSES, NOT COMBOS. "Gutshot" is 5.7% of the BN's
   *    range averaged together; it is not a figure for one specific holding.
   *
   * 3. THE TABLE AND THE PROSE DISAGREE SLIGHTLY. p.697 says good hands are
   *    c-bet "~59%" of the time; Diagram 68's labelled Good-bucket segments sum
   *    to ~55% betting / 45% checking. Both are printed, so both are quoted, and
   *    neither is smoothed into the other.
   */

  'ex6.example-header': ref({
    id: 'ex6.example-header',
    derivation: 'exact_transcription',
    scope:
      'The exact spot this puzzle plays: BB vs BN, single raised pot, 40bb effective, flop 5♥5♦4♥. The header also states the example’s two conclusions up front — low c-bet frequency and a small size.',
  }),

  'ex6.depolarized-distribution': ref({
    id: 'ex6.depolarized-distribution',
    derivation: 'exact_transcription',
    scope:
      'The source’s own causal chain for this exact flop, stated about the BN’s WHOLE range: no significant range advantage → smaller sizes preferred; most of the range is good hands → depolarized distribution → low c-bet frequency. Every clause is about the range, not about any one hand.',
  }),

  'ex6.bn-eqb-554': ref({
    id: 'ex6.bn-eqb-554',
    derivation: 'exact_transcription',
    scope:
      'The BN’s equity-bucket split on 5♥5♦4♥ at 40bb. These are the chart’s own printed data labels, not a measurement of pie slices. Whole-range percentages — 57% is how much of the range sits in the Good bucket, not how often any hand does anything.',
  }),

  'ex6.bb-eqb-554': ref({
    id: 'ex6.bb-eqb-554',
    derivation: 'exact_transcription',
    scope:
      'The BB’s equity-bucket split on the same flop, from the same diagram’s printed data labels. Cited only as the other half of the comparison the diagram draws — the two pies are what "no significant range advantage" looks like in numbers.',
  }),

  'ex6.cbet-by-eqb-554': ref({
    id: 'ex6.cbet-by-eqb-554',
    derivation: 'exact_transcription',
    scope:
      'How the BN plays each EQUITY BUCKET on this flop — bucket averages, never a single hand. Only the Bet 1/3, Bet MIN and Check segments carry printed data labels; the Bet 2/3 and Bet 1/2 slivers are drawn without numbers, so the two big sizes are taken from the table rather than estimated off the chart. The labelled Good-bucket segments sum to ~55% betting, against the "~59%" the prose states for the same bucket; both figures are printed and neither is adjusted here.',
  }),

  'ex6.table118-gutshot': ref({
    id: 'ex6.table118-gutshot',
    derivation: 'exact_transcription',
    scope:
      'The GUTSHOT CLASS on 5♥5♦4♥ — every gutshot combo in the BN’s range averaged together, 5.7% of that range. It is not a frequency for one specific holding, and the 58% equity is the class average. The table’s caption reads "UTG C-betting Range Breakdown", but the example it belongs to, the diagram’s caption and the prose and 698 are all BB vs BN, and the source reads the BN’s x/r response off this same table — so it is used here as the BN table, with the caption discrepancy disclosed in the puzzle.',
  }),

  'ex6.table118-full-range': ref({
    id: 'ex6.table118-full-range',
    derivation: 'exact_transcription',
    scope:
      'The BN’s ENTIRE range on 5♥5♦4♥ at 40bb — the aggregate the phrase "low c-bet frequency" refers to, and the 55% equity that makes "no significant range advantage" a number. Not the frequency of any hand or class. Same caption caveat as the Gutshot row: the table is captioned UTG and belongs to a BB-vs-BN example.',
  }),

  'ex6.good-hands-gutshots-check': ref({
    id: 'ex6.good-hands-gutshots-check',
    derivation: 'exact_transcription',
    scope:
      'The source’s hand-type notes INSIDE the Good bucket on this flop. This is the only place the source separates gutshots from the rest of the bucket, and the reason this puzzle deals a gutshot rather than a mid pair: the same sentence sends 66-99 the opposite way.',
  }),

  'ex6.bb-less-polarized-lowers-cbet': ref({
    id: 'ex6.bb-less-polarized-lowers-cbet',
    derivation: 'exact_transcription',
    scope:
      'The BB-side half of why the frequency is low on this flop, stated as a contrast with J66r. Cited for the mechanism only — the puzzle’s answer rests on the BN-side depolarization, not on this sentence.',
  }),

  'ex6.small-bets-when-depolarized': ref({
    id: 'ex6.small-bets-when-depolarized',
    derivation: 'exact_transcription',
    scope:
      'The GENERAL rule that links range shape to bet-size, stated across the chapter’s whole flop dataset rather than for 5♥5♦4♥ alone. It is the sentence that defines what "this type of depolarized distribution" means in practice — bulk of hands good but not great, few trash and weak — and it names the opposite case too.',
  }),

  'ex6.depolarized-definition': ref({
    id: 'ex6.depolarized-definition',
    derivation: 'exact_transcription',
    scope:
      'The source’s definition of the word, from the range-morphology section — general, not about any board. Cited so the puzzle explains "depolarized" in the source’s own terms before applying it to this flop.',
  }),

  /* ── MDF: where the number comes from, and what it is a statement about ──
   *
   * These refs exist to keep apart two things a learner merges by default.
   *
   *   `mdf.definition-toy-game` / `mdf.alpha-definition` / `mdf.complement-of-alpha`
   *      are Chapter 2. They are ARITHMETIC — b/(b + p) and its complement,
   *      derived inside a toy game on a static board with one clairvoyant
   *      player. Their only inputs are a bet and a pot. No hand, board or range
   *      appears anywhere in them, which is exactly why the number is portable
   *      and exactly why it cannot answer a question about a range.
   *
   *   `mdf.limits-*` are the author's own account of what that arithmetic
   *      assumes (pp.602-603), and therefore of what it cannot see.
   *
   * The distinction is worth stating in the registry because the failure mode
   * here is not a wrong number — MDF's number is right — it is a right number
   * answering a question nobody asked.
   */

  'mdf.definition-toy-game': ref({
    id: 'mdf.definition-toy-game',
    derivation: 'exact_transcription',
    scope:
      'The definition itself, derived inside a two-player toy game on a static board (3♠3♥3♣ 2♦ 2♠) where one player is clairvoyant and no cards are left to come. A definition, not a strategy for any real flop.',
  }),

  'mdf.alpha-definition': ref({
    id: 'mdf.alpha-definition',
    derivation: 'exact_transcription',
    scope:
      'What Alpha is a statement ABOUT: how often a bluff must work to break even, as b/(b + p). Its only inputs are the bet and the pot — no board, no hand and no range enters the expression.',
  }),

  'mdf.complement-of-alpha': ref({
    id: 'mdf.complement-of-alpha',
    derivation: 'exact_transcription',
    scope:
      'The arithmetic relationship between Alpha and MDF. True for any bet-size in any spot by construction, which is both its strength and its limit.',
  }),

  'sizing.pot-fraction-convention': ref({
    id: 'sizing.pot-fraction-convention',
    derivation: 'exact_transcription',
    scope:
      'The source’s own convention for reading a bet as a fraction of the pot — the "1/3-pot" notation used throughout.',
  }),

  'sizing.alpha-worked-example': ref({
    id: 'sizing.alpha-worked-example',
    derivation: 'exact_transcription',
    scope:
      'The source’s worked Alpha example, for a HALF-POT RIVER bet. Cited for the shape of the calculation and for the phrase naming what MDF is built to do — make "zero equity bluffs" indifferent — never as a figure for a 1/3-pot flop bet.',
  }),

  'mdf.one-third-pot-is-75': ref({
    id: 'mdf.one-third-pot-is-75',
    derivation: 'exact_transcription',
    scope:
      'The MDF figure for a 1/3-pot bet, as the source states it for this example. It follows from the bet-size alone: the same 75% would come out on this flop, on any other flop, and against any range whatsoever.',
  }),

  'mdf.alpha-one-third-derived': ref({
    id: 'mdf.alpha-one-third-derived',
    derivation: 'exact_derived',
    scope:
      'Alpha for a 1/3-pot bet, from the source’s own formula with the source’s own normalization: 0.33/(0.33 + 1) = 25%, so MDF = 1 − 0.25 = 75%. The derivation is confirmed by the source, which prints that same 75% for a 1/3-pot bet. Nothing about the board or either range enters the calculation — that is the point being made, not a caveat on it.',
  }),

  'mdf.limits-ev-assumptions': ref({
    id: 'mdf.limits-ev-assumptions',
    derivation: 'exact_transcription',
    scope:
      'The source’s own statement of the two assumptions built into Alpha and MDF, and why they misfire on a flop. This is the passage that makes "correct arithmetic, wrong question" the source’s position rather than an interpretation of it.',
  }),

  'mdf.limits-rough-guide': ref({
    id: 'mdf.limits-rough-guide',
    derivation: 'exact_transcription',
    scope:
      'The source’s verdict on MDF’s standing, stated in general rather than for any one board. It is why this puzzle offers no replacement frequency as a rule.',
  }),

  'mdf.aq3r-critique': ref({
    id: 'mdf.aq3r-critique',
    derivation: 'exact_transcription',
    scope:
      'The general claim the AQ3r example exists to demonstrate: which two things MDF leaves out. Stated for c-bet defence as a whole, not for one flop.',
  }),

  'mdf.aq3r-raising-worse': ref({
    id: 'mdf.aq3r-raising-worse',
    derivation: 'exact_transcription',
    scope:
      'Why the aggressive route out of an unprofitable call is worse rather than better, in this BB vs UTG 40bb spot on AQ3r. No raise SIZE is printed for this node anywhere on the page.',
  }),

  'mdf.aq3r-fold-these-hands': ref({
    id: 'mdf.aq3r-fold-these-hands',
    derivation: 'exact_transcription',
    scope:
      'The source’s instruction for this spot, naming hand types by class rather than by combo. "96s with a BDFD" is one of the three examples it prints, which is why it is the hand this puzzle deals. The 10-20% equity band is stated for those classes; it is not a figure for one specific combo.',
  }),

  'mdf.aq3r-fold-is-zero-ev': ref({
    id: 'mdf.aq3r-fold-is-zero-ev',
    derivation: 'exact_transcription',
    scope:
      'The comparison rule that settles the hand once both other actions are -EV. Stated generally, inside this example.',
  }),

  'mdf.aq3r-other-flops-exist': ref({
    id: 'mdf.aq3r-other-flops-exist',
    derivation: 'exact_transcription',
    scope:
      'What the source says folding here does and does not cost you. Written about this flop, but the argument is about the whole distribution of flops behind a profitable pre-flop call.',
  }),

  'guideline.trash-heavy-range-folds': ref({
    id: 'guideline.trash-heavy-range-folds',
    derivation: 'exact_transcription',
    scope:
      'A general BB c-bet defence guideline from the same chapter, stated across boards rather than for AQ3r — the rule the AQ3r example is one instance of. Note that it names MDF explicitly as the thing to override.',
  }),

  /* ── Puzzle 20: the river as a structure — Chapter 14's abstract models ──
   *
   * Every ref below is from Chapter 14 (or from the Alpha/MDF arithmetic the
   * chapter leans on), and the whole group shares one property that the `scope`
   * fields repeat because it is the single thing a reader must not miss:
   * CHAPTER 14 SOLVES NO CONCRETE BOARD. It builds abstract models on a quartz
   * board (2♠2♣2♥2♦3♣, p.783) and generates heuristics from them. There is
   * therefore no such thing as "the solver output for 9♠6♠2♥K♠4♠" in this book,
   * and a puzzle on a real river board can only be the model applied to a
   * matching structure. p.781 is the sentence that licenses doing that at all.
   *
   * Alpha itself is the exception: it is arithmetic, not a solver result, so it
   * may be computed for any bet-size. p.109 gives the formula, p.136 works it
   * through for the half-pot river case this puzzle uses, and p.603 states when
   * the number is and is not to be trusted. */

  'ch14.hand-values-fixed': ref({
    id: 'ch14.hand-values-fixed',
    derivation: 'exact_transcription',
    scope:
      'A property of every river in poker, not of any board. It is why a river hand can be sorted into "beats their bluffs" or "loses to their value" with no third category.',
  }),

  'ch14.hand-vs-range-equity': ref({
    id: 'ch14.hand-vs-range-equity',
    derivation: 'exact_transcription',
    scope:
      'The definition of hand-vs-range equity on a river. General arithmetic — it converts a range composition into an equity, and asserts nothing about what any particular Villain holds.',
  }),

  'ch14.linear-ordering': ref({
    id: 'ch14.linear-ordering',
    derivation: 'exact_transcription',
    scope:
      'General property of river hand strength. Cited for the ordering of hands only — it says nothing about which of them a given player calls with.',
  }),

  'ch14.structure-not-history': ref({
    id: 'ch14.structure-not-history',
    derivation: 'exact_transcription',
    scope:
      'The chapter’s central claim of equivalence between river situations. It is what makes an abstract model transferable to a real board at all — and, read the other way, it is why the board itself carries no information the structure does not already carry.',
  }),

  'ch14.nuts-identity-irrelevant': ref({
    id: 'ch14.nuts-identity-irrelevant',
    derivation: 'exact_transcription',
    scope:
      'The polar-vs-bluff-catcher model specifically: what does and does not define it. Cited to establish that the identity of the nuts — flush, straight, full house — is not an input to the model.',
  }),

  'ch14.abstract-models-are-heuristics': ref({
    id: 'ch14.abstract-models-are-heuristics',
    derivation: 'exact_transcription',
    scope:
      'The source’s own statement of what produces: heuristics generated from abstract models, not solved strategies for real boards. This is the boundary a river puzzle has to respect.',
  }),

  'ch14.bluffcatcher-calls-1-alpha': ref({
    id: 'ch14.bluffcatcher-calls-1-alpha',
    derivation: 'exact_transcription',
    scope:
      'The equilibrium strategy pair in the perfectly polarized (nuts/air) vs bluff-catcher model, played on the chapter’s abstract board 2♠2♣2♥2♦3♣. Not a solution for any real board: the hands named (KK-QQ, 77-66, JJ-88) are the model’s labels for nuts, air and bluff-catchers, not actual holdings.',
  }),

  'ch14.bluffcatcher-never-bets': ref({
    id: 'ch14.bluffcatcher-never-bets',
    derivation: 'exact_transcription',
    scope:
      'The same abstract model with the polar player weighted toward air. Cited for one thing only: why the bluff-catching player never takes the betting or raising line, whatever the exact weights turn out to be.',
  }),

  'ch14.no-blockers-irrelevant': ref({
    id: 'ch14.no-blockers-irrelevant',
    derivation: 'exact_transcription',
    scope:
      'The fourth case of the general river blocker rule — a bluff-catcher that blocks neither side. A general heuristic, not a board solution.',
  }),

  'ch14.value-range-starting-point': ref({
    id: 'ch14.value-range-starting-point',
    derivation: 'exact_transcription',
    scope:
      'General river calling heuristics. The second bullet carries the condition that decides whether a 1-Alpha defence applies at all: it is contingent on the Villain actually having bluffs.',
  }),

  'alpha.mdf-definition': ref({
    id: 'alpha.mdf-definition',
    derivation: 'exact_transcription',
    scope:
      'The definition of MDF, derived from the EV equation in the two-hand clairvoyance game. Pure arithmetic; the 50% belongs to that game’s pot-size bet and to no other spot.',
  }),

  'alpha.formula': ref({
    id: 'alpha.formula',
    derivation: 'exact_transcription',
    scope:
      'The definition of Alpha and the formula b/(b + p). Arithmetic that holds for any bet and any pot — this is the one quantity in a river puzzle that may legitimately be computed rather than quoted.',
  }),

  'alpha.half-pot-river-example': ref({
    id: 'alpha.half-pot-river-example',
    derivation: 'exact_transcription',
    scope:
      'The source’s own worked case of a half-pot river bet made with a polarized range. It fixes every number this puzzle needs at that size — the price laid, the value-to-bluff ratio, Alpha and 1-Alpha — and it is arithmetic about a bet-size, not a solution for a board.',
  }),

  'alpha.river-relevance': ref({
    id: 'alpha.river-relevance',
    derivation: 'exact_transcription',
    scope:
      'The author’s own limit on how far Alpha and MDF can be pushed, together with his statement of the one street where they are at their most reliable. Cited both to justify using Alpha here and to cap what it is allowed to prove.',
  }),

  /* ══════════════════════════════════════════════════════════════════════
   * Puzzle 13: the four donk-bet frequency bands, read off the board.
   *
   * Two groups of refs, and the difference between them is the whole point.
   *
   * The `bands.flop-*` refs (pp.625-629) are BOARD FACTS: what a flop's rank
   * is, how a flopped straight is counted, what monotone means, what the
   * letters A/H/M/L stand for. They describe cards on a table and depend on no
   * simulation, no position and no stack depth, which is why a puzzle can use
   * them to classify a flop before anyone has been dealt a hand.
   *
   * The `bands.*` band refs (pp.631-648) are SIMULATION OUTPUT, and every one
   * of them carries the same dataset in its scope: BB vs BN and BB vs UTG,
   * single raised pots, 20bb/30bb/40bb, aggregated (bands.dataset, p.631).
   * They are averages over a BAND — tens or hundreds of flops at once — and
   * emphatically not the frequency of any single flop inside it. The one flop
   * the chapter attaches a donk-bet percentage to by name is 654r at 67%
   * (donk.654r-is-highest, p.632), which is why that is the only per-flop
   * percentage puzzle 13 states.
   * ══════════════════════════════════════════════════════════════════════ */

  'bands.classification-purpose': ref({
    id: 'bands.classification-purpose',
    derivation: 'exact_transcription',
    scope:
      'The author’s stated reason for classifying flops at all. A statement about method, independent of any matchup, position or stack depth.',
  }),

  'bands.flop-rank': ref({
    id: 'bands.flop-rank',
    derivation: 'exact_transcription',
    scope:
      'Definition of a flop’s rank. A property of the three cards alone — no simulation, position or stack depth involved.',
  }),

  'bands.flop-textures': ref({
    id: 'bands.flop-textures',
    derivation: 'exact_transcription',
    scope:
      'Definitions of the three flop textures. A property of the three cards alone — no simulation, position or stack depth involved.',
  }),

  'bands.straight-count': ref({
    id: 'bands.straight-count',
    derivation: 'exact_transcription',
    scope:
      'How the source counts the straights a flop makes, given as four worked boards. A property of the three cards alone. Note that a flopped straight uses all three board cards plus two hole cards.',
  }),

  'bands.rank-letters': ref({
    id: 'bands.rank-letters',
    derivation: 'exact_transcription',
    scope:
      'The rank-letter vocabulary that the donk-bet subfamily lists (8MM, 7ML, 6LL, ALL…) are written in. A naming scheme for cards, not a strategy claim.',
  }),

  'bands.distinct-flops': ref({
    id: 'bands.distinct-flops',
    derivation: 'exact_transcription',
    scope:
      'The size of the problem the bands are dividing up: how many strategically distinct flops exist in hold’em. A counting fact about the game.',
  }),

  'bands.dataset': ref({
    id: 'bands.dataset',
    derivation: 'exact_transcription',
    scope:
      'The dataset behind EVERY donk-bet band figure in this chapter, stated by the author: BB vs BN and BB vs UTG, single raised pots, 20bb/30bb/40bb, aggregated across all possible flops. Not a single-position solve and not a single-depth one.',
  }),

  'bands.effect-not-cause': ref({
    id: 'bands.effect-not-cause',
    derivation: 'exact_transcription',
    scope:
      'The author’s own warning about how to read the bands — the direction of causation between range distribution and donk frequency. Applies to all four bands.',
  }),

  /* ── The no-donk band, and A76r as its worked example ────────────────── */

  'bands.a76r-buckets': ref({
    id: 'bands.a76r-buckets',
    derivation: 'exact_transcription',
    scope:
      'BB vs IP equity buckets on A76r, averaged over 20bb/30bb/40bb stacks. The chapter’s worked example of a flop the BB must not lead.',
  }),

  'bands.a76r-check-100': ref({
    id: 'bands.a76r-check-100',
    derivation: 'exact_transcription',
    scope:
      'BB vs BN on A76r at 30bb — the chapter’s conclusion for this specific flop, reached by testing each way the BB could split its range and finding all of them worse.',
  }),

  'bands.a76r-locked-strategy': ref({
    id: 'bands.a76r-locked-strategy',
    derivation: 'exact_transcription',
    scope:
      'BB vs BN on A76r at 30bb — the GTO solution compared against a locked strategy that forces the BB to lead top pair or better. An EV comparison, not a donk-bet frequency.',
  }),

  'bands.none-metrics': ref({
    id: 'bands.none-metrics',
    derivation: 'exact_transcription',
    scope:
      'Averages across the WHOLE no-donk group — the vast majority of the 1,755 distinct flops — from the BB vs BN and BB vs UTG 20-40bb aggregate. Not the frequency of any single flop in the group.',
  }),

  /* ── The mid band (25-50%) ───────────────────────────────────────────── */

  'bands.mid-flops': ref({
    id: 'bands.mid-flops',
    derivation: 'exact_transcription',
    scope:
      'The ~100 flops donked 25-50% of the time in the BB vs BN and BB vs UTG 20-40bb aggregate. Names three paired flops and ONE monotone flop individually; everything else is given only as a subfamily.',
  }),

  'bands.mid-frequency': ref({
    id: 'bands.mid-frequency',
    derivation: 'exact_transcription',
    scope:
      'The mid band’s average donk frequency across the whole band, given separately for the two openers. Not the frequency of any individual flop in it.',
  }),

  'bands.mid-equity': ref({
    id: 'bands.mid-equity',
    derivation: 'exact_transcription',
    scope: 'Average equity and range shape across ALL mid-band flops — not any one of them.',
  }),

  'bands.mid-strategy': ref({
    id: 'bands.mid-strategy',
    derivation: 'exact_transcription',
    scope:
      'How the mid band’s betting range is built at 30-40bb, stated by comparison with the high band. A band-wide description, not a per-flop strategy.',
  }),

  'bands.mid-20bb': ref({
    id: 'bands.mid-20bb',
    derivation: 'exact_transcription',
    scope: 'The mid band at 20bb specifically, where the strategy differs from the 30-40bb case above.',
  }),

  /* ── The low band (10-25%) ───────────────────────────────────────────── */

  'bands.low-flops': ref({
    id: 'bands.low-flops',
    derivation: 'exact_transcription',
    scope:
      'The ~181 flops donked 10-25% of the time. Given ONLY as subfamilies — no individual flop is named anywhere in this band, and seven of its unpaired subfamilies also appear in the mid band’s list.',
  }),

  'bands.low-frequency': ref({
    id: 'bands.low-frequency',
    derivation: 'exact_transcription',
    scope:
      'The low band’s preferred bet-size and its average donk frequency against each opener, across the whole band. Not the frequency of any individual flop in it.',
  }),

  'bands.low-equity': ref({
    id: 'bands.low-equity',
    derivation: 'exact_transcription',
    scope: 'Average equity, equity realization and range shape across ALL low-band flops — not any one of them.',
  }),

  'bands.low-polarity': ref({
    id: 'bands.low-polarity',
    derivation: 'exact_transcription',
    scope:
      'Why the low band prefers a larger size, and its stability across stack depths. A band-wide statement covering 20bb, 30bb and 40bb.',
  }),

  'bands.study-your-own-runouts': ref({
    id: 'bands.study-your-own-runouts',
    derivation: 'exact_transcription',
    scope:
      'The author’s own statement of where this chapter’s analysis stops — the reason a band puzzle has no turn or river to play.',
  }),
}

export function source(id: string): SourceRef {
  const found = SOURCES[id]
  if (!found) throw new Error(`Unknown source id: "${id}". Add it to lib/puzzles/interactive/sources.ts.`)
  return found
}

/** How much weight a reader should give the number, in a sentence. */
export function derivationNote(derivation: Derivation): string {
  switch (derivation) {
    case 'exact_transcription':
      return 'Stated directly in the source.'
    case 'exact_derived':
      return 'Computed from the source’s own numbers by unambiguous arithmetic.'
    case 'reconstructed':
      return 'Read from a source diagram by documented measurement, cross-validated against the aggregate the source prints.'
    case 'pedagogical_model':
      return 'A teaching simplification, not solver output.'
  }
}

export const DERIVATION_LABEL: Record<Derivation, string> = {
  exact_transcription: 'Exact transcription',
  exact_derived: 'Exact derivation',
  reconstructed: 'Source reconstruction',
  pedagogical_model: 'Pedagogical model',
}
