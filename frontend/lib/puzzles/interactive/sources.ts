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

export interface SourceRef {
  id: string
  /** Bibliographic work. One constant today; a field so a second source can be added without a schema change. */
  work: string
  page: number
  /** Table/Diagram/section identifier as the source prints it. */
  locator: string
  derivation: Derivation
  /** EXACTLY which simulation/setup the numbers describe. Rendered next to the claim. */
  scope: string
  /** Verbatim source wording, where a short quote pins the claim down better than a paraphrase. */
  quote?: string
}

const MPT = 'Modern Poker Theory (Acevedo, 2019)'

function ref(r: Omit<SourceRef, 'work'>): SourceRef {
  return { ...r, work: MPT }
}

export const SOURCES: Record<string, SourceRef> = {
  /* ── The spot itself ─────────────────────────────────────────────────── */

  'donk.definition': ref({
    id: 'donk.definition',
    page: 631,
    locator: 'Ch. "The Flop Donk Bet (DK)"',
    derivation: 'exact_transcription',
    scope: 'BB vs IP in a single raised pot — the general setup for the whole donk-bet chapter.',
    quote:
      'When the player in the BB doesn’t check and instead takes the lead by making a bet, the poker regulars would call this a donk bet, because it’s a bet that goes against the norm.',
  }),

  'donk.baseline-frequencies': ref({
    id: 'donk.baseline-frequencies',
    page: 632,
    locator: 'Table 100: BB and IP stats (20bb/30bb/40bb)',
    derivation: 'exact_transcription',
    scope:
      'Aggregated GTO solutions across ALL flops, BB vs BN and BB vs UTG, single raised pots, 20bb/30bb/40bb.',
    quote:
      'The results show that the overall BB donk bet frequency is only 2% (for 1/4 and 2/3 bet-sizes) and the average IP c-betting frequency is 84%.',
  }),

  'donk.654r-is-highest': ref({
    id: 'donk.654r-is-highest',
    page: 632,
    locator: 'Table 100: BB and IP stats (20bb/30bb/40bb)',
    derivation: 'exact_transcription',
    scope: 'Average across the BB vs BN and BB vs UTG sims at 20bb/30bb/40bb.',
    quote:
      'On average, the highest frequency donk betting flop is 654r (67%), and one of the lowest donk betting flops is A76r (0.3%).',
  }),

  'preflop.bn-open-bb-call-30bb': ref({
    id: 'preflop.bn-open-bb-call-30bb',
    page: 651,
    locator: 'Section "The Power of Position" — setup for Table 105',
    derivation: 'exact_transcription',
    scope: 'BB vs BN, single raised pot, 30bb effective — the exact preflop setup this puzzle uses.',
    quote:
      'Hero is on the BN and opens a standard GTO 49% opening range and the action folds to the Villain in the BB who calls with a standard 64% GTO range.',
  }),

  /* ── Why 654r favours the BB ─────────────────────────────────────────── */

  'eq.654r-vs-a76r': ref({
    id: 'eq.654r-vs-a76r',
    page: 633,
    locator: 'Prose accompanying Table 100',
    derivation: 'exact_transcription',
    scope: 'BB vs IP range-vs-range equity on 654r, contrasted with A76r.',
    quote:
      'on 654r, the BB has the equity advantage with 51% equity vs IP’s 49%, making the BB’s bets more profitable on this flop texture.',
  }),

  'buckets.654r': ref({
    id: 'buckets.654r',
    page: 634,
    locator: 'Diagram 25: Average BB vs IP Equity Buckets for 20bb/30bb/40bb Stacks',
    derivation: 'exact_transcription',
    scope: 'BB vs IP equity-bucket distribution on 654r, averaged over 20bb/30bb/40bb stacks.',
    quote:
      'On 654r, the BB has 7% strong hands, and IP has only 4% … On 654r, the BB’s good hands increase from 17% to 40% and the trash hands reduce from 49% to 18% when compared to A76r.',
  }),

  'buckets.654r-ax-devalued': ref({
    id: 'buckets.654r-ax-devalued',
    page: 634,
    locator: 'Prose accompanying Diagram 25',
    derivation: 'exact_transcription',
    scope: 'BB vs IP on 654r — what happens to IP’s ace-high holdings specifically.',
    quote:
      'on 654r, all of IP’s Ax will have an average of 49% equity, effectively turning them into weak hands.',
  }),

  'donk.654r-denies-eqr': ref({
    id: 'donk.654r-denies-eqr',
    page: 634,
    locator: 'Prose accompanying Diagram 25',
    derivation: 'exact_transcription',
    scope: 'BB vs IP on 654r — the causal explanation for the high donk frequency.',
    quote:
      'The BB reacts to this by donk betting many hands, forcing IP to either fold or put more money into the pot with the hands that would have been happy to check behind and see a free turn. Donk betting makes sense on 654r because it denies IP EQR, and also helps BB realize equity by leveraging the informational advantage of leading out with a well-balanced range that cannot be easily attacked by IP.',
  }),

  'donk.654r-ip-raise-frequency': ref({
    id: 'donk.654r-ip-raise-frequency',
    page: 634,
    locator: 'Prose accompanying Diagram 25',
    derivation: 'exact_transcription',
    scope: 'IP’s response frequency to a 1/4-pot donk bet, 654r vs A76r.',
    quote:
      'resulting in IP having an overall low raising frequency of 20% on 654r, whereas IP has a raising frequency on A76r of 53% (GTO frequencies vs a donk bet-size of 1/4-pot).',
  }),

  /* ── The high-donk-frequency board family ────────────────────────────── */

  'family.high-donk-flops': ref({
    id: 'family.high-donk-flops',
    page: 636,
    locator: 'Section "High Donk Bet Frequency Flops (50%+)"',
    derivation: 'exact_transcription',
    scope: 'The ~34 flops donked over 50% of the time against both the BN and UTG.',
    quote:
      'There are about 34 distinct flops that result in an average donk bet over 50% of the time against both the BN and UTG. They are in ranks 7-x-x and 6-x-x with one to three possible flopped straights. The higher the number of flopped straights, the smaller the donk bet-size and the higher the donk bet frequency used. Rainbow flops are donked at a higher frequency than two-tone flops and, in general, monotone flops get donked a lot less frequently.',
  }),

  'family.high-donk-eqr': ref({
    id: 'family.high-donk-eqr',
    page: 638,
    locator: 'Table 103: High Donk Bet Frequency Flops',
    derivation: 'exact_transcription',
    scope: 'Averages across ALL high-donk-frequency flops — not 654r specifically.',
    quote:
      'On the high donk frequency flops, the BB has an average of 50% equity and is able to over-realize that equity (103% EQR), capturing an average of 52% of the pot.',
  }),

  'family.high-donk-polarity': ref({
    id: 'family.high-donk-polarity',
    page: 638,
    locator: 'Diagram 26: EQB on High Donk Bet Frequency Flops',
    derivation: 'exact_transcription',
    scope: 'Range-shape comparison across all high-donk-frequency flops.',
    quote:
      'Here, the BB’s range is more polarized than IP’s range. The BB has the advantage in both strong and good hands, while 50% of IP’s range are weak hands that will have a more difficult time realizing equity and will therefore benefit from playing passively. This range construction resembles the Clairvoyance Toy game, with the IP having the more depolarized range, which makes the BB want to take the betting lead.',
  }),

  'family.high-donk-bucket-frequencies': ref({
    id: 'family.high-donk-bucket-frequencies',
    page: 639,
    locator: 'Diagram 27',
    derivation: 'exact_transcription',
    scope:
      'GENERAL strategy across high-donk-frequency boards at 30-40bb — NOT a per-hand or per-combo frequency, and not 654r-specific.',
    quote:
      'With stack depths between 30-40bb, the BB wants to bet strong hands 73% of the time, good hands 64%, weak hands 59%, and trash hands are bet 49%. The most used donk bet-size is 1/4-pot, with 2/3-pot size bets used on average 5%.',
  }),

  'sizing.stack-depth': ref({
    id: 'sizing.stack-depth',
    page: 640,
    locator: 'Prose accompanying Diagram 28',
    derivation: 'exact_transcription',
    scope: 'How the preferred donk bet-size on high-donk boards changes with stack depth.',
    quote:
      'With a 20bb effective stack, the 2/3-pot size donk bet is preferred… When stacks are deeper, there aren’t many hands that are happy to get all-in on the flop so, instead, a smaller donk bet-size allows the BB to call a re-raise and see the turn without having to get all the money in on the flop.',
  }),

  'donk.frequency-by-opener': ref({
    id: 'donk.frequency-by-opener',
    page: 640,
    locator: 'Prose closing the High Donk Bet Frequency Flops section',
    derivation: 'exact_transcription',
    scope: 'High-donk-frequency boards, BB vs UTG compared with BB vs BN.',
    quote:
      'Donk betting also happens on average more often vs UTG (67% of the time) than vs the BN (53% of the time). This is because the high donk betting boards are missed a lot more often by UTG ranges.',
  }),

  'checking.range-protection': ref({
    id: 'checking.range-protection',
    page: 640,
    locator: 'Prose accompanying Diagram 28',
    derivation: 'exact_transcription',
    scope: 'Why the BB’s checking range on high-donk boards still needs strong and good hands.',
    quote:
      'Strong and good hands are also an important part of the checking ranges. The more checking happens, the more important it becomes to have strong and good hands in the checking range so the range remains balanced and protected.',
  }),

  /* ── The 654r per-category walkthrough — BB vs UTG, NOT BB vs BN ─────── */

  'example.654r-utg-buckets': ref({
    id: 'example.654r-utg-buckets',
    page: 641,
    locator: 'Section "Donk Betting Range Example" — BB vs UTG on 654r (30bb effective stacks)',
    derivation: 'exact_transcription',
    scope:
      'BB vs UTG on 654r at 30bb. The book’s only per-category walkthrough of this flop — it is NOT the BB vs BN sim.',
    quote: 'Strong hands are bet 77% of the time… Good hands are bet 70% of the time… Weak hands are bet 61% of the time',
  }),

  'example.654r-utg-straights': ref({
    id: 'example.654r-utg-straights',
    page: 641,
    locator: 'Section "Donk Betting Range Example" — Strong hands',
    derivation: 'exact_transcription',
    scope: 'BB vs UTG on 654r at 30bb — which holdings actually make a straight on this flop.',
    quote:
      'Straights are the strongest hands the BB can have on this flop. The lowest straight 32 is the most vulnerable and it unblocks IP’s continuing range, so it gets bet 91%, while the other straights 87 get bet 80% and 73 only gets bet 50%.',
  }),

  'example.654r-utg-top-pair': ref({
    id: 'example.654r-utg-top-pair',
    page: 641,
    locator: 'Section "Donk Betting Range Example" — Good hands',
    derivation: 'exact_transcription',
    scope:
      'BB vs UTG on 654r at 30bb. Top pair on 654r means a pair of sixes; this is the category 7♠6♠ belongs to.',
    quote:
      'Top Pairs are bet 78% of the time. The ones with the highest kickers and the ones that have an OESD betting the highest frequency. The middle kickers are checked more frequently.',
  }),

  'example.654r-utg-draws': ref({
    id: 'example.654r-utg-draws',
    page: 642,
    locator: 'Section "Donk Betting Range Example" — Weak hands',
    derivation: 'exact_transcription',
    scope: 'BB vs UTG on 654r at 30bb — the no-pair open-ended straight draws, a different bucket from top pair + OESD.',
    quote: 'OESD are bet 67% of the time. 7x hands are bet more often than 3x.',
  }),

  /* ── What leading is actually worth, BB vs BN 30bb ───────────────────── */

  'value.table-104': ref({
    id: 'value.table-104',
    page: 650,
    locator: 'Table 104: 654r BB vs BN 30bbs Stats',
    derivation: 'exact_transcription',
    scope:
      'BB vs BN, 654r, 30bb effective — the GTO solution compared against a forced 100%-check simulation. This is the puzzle’s exact spot.',
    quote:
      '654r is one of the highest donk bet flops. When the BB loses the ability to lead out on this board, they lose 1.1% of the pot or 6.5bb/100 and the EQR decreases by 2.25%.',
  }),

  'value.difficulty-caveat': ref({
    id: 'value.difficulty-caveat',
    page: 650,
    locator: 'Section "The Value of Donk Betting"',
    derivation: 'exact_transcription',
    scope: 'The author’s own framing of how much donk betting is worth in practice.',
    quote:
      'Donk betting only happens at a high frequency on a small number of flops that are also low frequency flops, so the impact of the EV loss of choosing a simpler strategy that always checks when OOP will not be significant in the grand scheme of things. Additionally, implementing donk betting strategies correctly can be difficult in-game.',
  }),

  'position.654r-ip-cbet': ref({
    id: 'position.654r-ip-cbet',
    page: 652,
    locator: 'Prose accompanying Table 105',
    derivation: 'exact_transcription',
    scope: 'BB vs BN on 654r at 30bb — what the BN does after the BB checks.',
    quote:
      'On 654r, Hero has a range disadvantage so, unlike on A76r, betting the entire range isn’t advisable because the risk of the check-raise (which would destroy Hero’s equity) increases drastically. So, with position, Hero can only bet about 48% of the time after the BB checks.',
  }),

  'position.654r-bn-weak-hands': ref({
    id: 'position.654r-bn-weak-hands',
    page: 652,
    locator: 'Prose accompanying Table 105',
    derivation: 'exact_transcription',
    scope: 'BB vs BN on 654r at 30bb — the composition of the BN’s range from the BN’s perspective.',
    quote:
      'Weak hands make up 51% of Hero’s range. When in position these would be checked back most of the time to realize equity and would prefer to play a small pot, so as not to risk being x/r and blown off their equity.',
  }),

  /* ── Contrast: boards where leading is wrong ─────────────────────────── */

  'contrast.a76r': ref({
    id: 'contrast.a76r',
    page: 633,
    locator: 'Prose accompanying Table 100',
    derivation: 'exact_transcription',
    scope: 'A76r, the chapter’s worked counter-example to 654r.',
    quote:
      'Clearly IP has the equity advantage with 62% equity vs the BB’s 38% on A76r, which will of course reduce the profitability of the BB’s bets',
  }),

  'contrast.no-donk-flops': ref({
    id: 'contrast.no-donk-flops',
    page: 648,
    locator: 'Section "No Donk Bet Flops (0%-10%)"',
    derivation: 'exact_transcription',
    scope: 'The large majority of flops — the group where leading is not part of the strategy.',
    quote:
      'In general, this means trips, monotone, high card paired, disconnected two-tone, HXX and AXX flops are bad donk betting flops… Playing a 100% checking frequency is recommended.',
  }),

  /* ── Preflop range composition (different stack depths — labelled) ───── */

  'preflop.bb-call-composition-100bb': ref({
    id: 'preflop.bb-call-composition-100bb',
    page: 243,
    locator: 'Prose describing Hand Range 82: BB vs BN Open',
    derivation: 'exact_transcription',
    scope:
      'BB vs BN at 100bb, NOT 30bb. Cited only for the SHAPE of the BB’s calling range (which hand types call), never for a frequency at 30bb.',
    quote:
      'the BB can call many more hands compared to all the other positions… while calling with most suited hands, offsuit Ax, connectors and broadways.',
  }),

  'preflop.bb-3bet-composition-25bb': ref({
    id: 'preflop.bb-3bet-composition-25bb',
    page: 386,
    locator: 'Prose describing Hand Ranges 159-166 — Defending the BB Versus IP (25bb)',
    derivation: 'exact_transcription',
    scope:
      'BB vs IP at 25bb — which hand TYPES make up the NON-ALL-IN 3-betting range, as distinct from the separate all-in range at the same depth. A composition stated in words; it names classes, never individual combos or their frequencies. Belongs to the 25bb solutions only.',
    quote:
      'The non-all-in 3-betting range is polarized, made of JJ+, the strongest Axs, some of the best premium suited connectors, and a small frequency of offsuit hands with a blocker, including A8o-A2o, K6o-K2o, Qxo and Jxo.',
  }),

  'preflop.bb-vs-bn-25bb-chart': ref({
    id: 'preflop.bb-vs-bn-25bb-chart',
    page: 387,
    locator: 'Hand Range 159: BB vs BN (25bb)',
    derivation: 'exact_transcription',
    scope:
      'BB defending against a BN min-raise at 25bb, in the book’s MTT defence chapter. These four percentages are the whole-range aggregates printed with the chart — NOT the frequency of any individual hand, and four separate branches that the book never adds together. The chart itself is a colour-coded image; no per-combo figure is printed in text. (The table configuration behind it — 9-max, 12.5% ante — is stated in Ch.7, not here; see `mtt.solver-environment`.)',
    quote: 'BB vs BN (25bb) • All-in 11.4% / • 3-bet 8.2% / • Call 65.9% / • Fold 14.6%',
  }),

  'preflop.bb-vs-bn-40bb-chart': ref({
    id: 'preflop.bb-vs-bn-40bb-chart',
    page: 396,
    locator: 'Hand Range 167: BB vs BN (40bb)',
    derivation: 'exact_transcription',
    /* Scope de-puzzled: this was phrased as "the other chart bracketing this
     * puzzle's 30bb depth", which is true of puzzle 1 and confusing everywhere
     * else, since `scope` is rendered verbatim next to the number in whichever
     * puzzle cites it. Matches how 'preflop.bb-vs-bn-25bb-chart' now reads. */
    scope:
      'BB defending against a BN open at 40bb, 9-max MTT with a 12.5% ante. Whole-range aggregates printed with the chart, not the frequency of any individual hand. FOUR branches are printed here, including a non-all-in 3-bet — which the 15bb solution of the same matchup does not have.',
    quote: 'BB vs BN (40bb) • All-in 3% / • 3-bet 14.1% / • Call 58.6% / • Fold 24.2%',
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
    page: 386,
    locator: 'Prose accompanying Table 60: BB vs IP Action Frequencies (25bb)',
    derivation: 'exact_transcription',
    scope:
      'BB defending against a min-raise at 25bb, across ALL four in-position openers. Every figure here is a whole-range aggregate for one opener, at 25bb only — the same numbers do not hold at 15bb, 40bb or 60bb, which the book solves separately.',
    quote:
      'With 25bb, the average BB fold vs a min-raise is 22.54%, increasing from 14.6% vs the BN to 27.2% vs UTG. The BB all-in frequency drops as the opener’s range gets stronger, from 11.4% vs the BN to only 2.1% vs UTG, but the non all-in 3-bet frequency remains fairly constant at around 5%, except vs the BN, which is the highest at 8.20%.',
  }),

  'bb25.pairs-and-axo-jam': ref({
    id: 'bb25.pairs-and-axo-jam',
    page: 386,
    locator: 'Prose describing Hand Ranges 159-166 — composition of the BB’s all-in range at 25bb',
    derivation: 'exact_transcription',
    scope:
      'BB vs IP at 25bb — which hand CLASSES go into the all-in branch, stated in words. It names classes ("pocket pairs", "Axo"), never individual combos, and attaches no frequency to any one hand.',
    quote:
      'Pocket pairs and Axo really like getting all-in. As the opener’s range widens, the weaker pairs and Ax get to shove.',
  }),

  'bb25.fold-range-grows': ref({
    id: 'bb25.fold-range-grows',
    page: 386,
    locator: 'Prose describing Hand Ranges 159-166 — the BB’s folding range at 25bb',
    derivation: 'exact_transcription',
    scope:
      'BB vs IP at 25bb — how big the fold branch is by opener, and the reason the book gives for it. The 14.6% figure is the BB’s fold frequency against a BN min-raise specifically.',
    quote:
      'The folding range increases drastically as the opener’s range gets stronger, from 14.6% up to 28% vs EP. This is because, at 25bb, stacks are deep enough that weak hands start having difficulty realizing their equity post-flop from OOP.',
  }),

  'mtt.solver-environment': ref({
    id: 'mtt.solver-environment',
    page: 293,
    locator:
      'Ch.7 "MTT Equilibrium Strategies: Playing First In" — opening statement of assumptions (the sentence begins on p.292 and the ante clause falls on p.293)',
    derivation: 'exact_transcription',
    scope:
      'The game the book’s MTT equilibrium strategies were solved in. Stated at the head of Ch.7; the defence chapter (Ch.8) does not restate it. Cited for the TABLE CONFIGURATION — 9 seats, 12.5% ante — never for a strategy figure.',
    quote:
      'The equilibrium strategies presented in this chapter were generated with modern solvers and super-computers, based on cEV for 9-max tables with a 12.5% ante.',
  }),

  'mtt.ante-pot-size': ref({
    id: 'mtt.ante-pot-size',
    page: 163,
    locator: 'Section "The Size of the Pot"',
    derivation: 'exact_transcription',
    scope:
      'What a 12.5% ante is worth in dead money at a 9-max table, before any voluntary action. Pure pot arithmetic, independent of stack depth or position.',
    quote:
      'in a 9-max MTT with 12.5% antes, the size of the pot is 2.625bb. If the action gets folded to the BN, they can push 10 big blinds with 46% of hands, but without antes, the pot size is only 1.5bb',
  }),

  'defence.chapter-depths': ref({
    id: 'defence.chapter-depths',
    page: 360,
    locator: 'Ch.8 "MTT Equilibrium Strategies: Defense" — scope of the chapter',
    derivation: 'exact_transcription',
    scope:
      'The four stack depths the defence chapter solves separately. The boundary that stops a 15bb or 40bb figure being carried into a 25bb spot.',
    quote:
      'We will first discuss some general considerations and then examine the specific strategy recommended by solvers for all positions at stacks depths of 15bb, 25bb, 40bb and 60bb.',
  }),

  /* ── Puzzle 2: BB vs UTG on 9♥8♥4♦ (40bb) — the book's own worked line ── */

  'ex3.preflop-bb-vs-utg-40bb': ref({
    id: 'ex3.preflop-bb-vs-utg-40bb',
    page: 402,
    locator: 'Hand Range 173: BB vs UTG (40bb)',
    derivation: 'exact_transcription',
    scope: 'BB defending against an UTG open at 40bb — the preflop setup for the book’s Flop Strategy Example 3.',
    quote: 'BB vs UTG (40bb) • 3-bet 5.8% / • Call 49.1% / • Fold 45%',
  }),

  'ex3.utg-cbet-big': ref({
    id: 'ex3.utg-cbet-big',
    page: 687,
    locator: 'Diagram 61 / Table 115: UTG C-betting Range Breakdown on 9♥8♥4♦',
    derivation: 'exact_transcription',
    scope: 'UTG’s flop c-betting strategy on 9♥8♥4♦ at 40bb — a mid c-bet frequency with a big bet-size.',
    quote: 'Mid c-bet % and big bet-size: BB vs UTG on 9♥8♥4♦ (40bbs)',
  }),

  'ex3.bb-few-strong-hands': ref({
    id: 'ex3.bb-few-strong-hands',
    page: 742,
    locator: 'Flop Strategy Example 3 — BB vs 2/3-pot c-bet on 9♥8♥4♦ (40bbs)',
    derivation: 'exact_transcription',
    scope: 'BB’s flop strategy facing a 2/3-pot c-bet from UTG on 9♥8♥4♦ at 40bb.',
    quote:
      'On 9♥8♥4♦, the BB’s range only has about 4% strong hands against UTG. This results in UTG using a large bet-size and the BB having a low x/r frequency of about 4%. The BB’s strategy consists of waiting until the turn to start splitting their range, depending on the runout. This avoids revealing information about their range on the flop.',
  }),

  'ex3.bb-compensates-on-turn': ref({
    id: 'ex3.bb-compensates-on-turn',
    page: 743,
    locator: 'Table 124: BB Strategy Breakdown vs UTG 2/3-pot c-bet on 9♥8♥4♦',
    derivation: 'exact_transcription',
    scope: 'Why the BB plays the flop passively on this board — the plan is explicitly deferred to the turn.',
    quote:
      'In this situation, the BB compensates for the lack of flop aggression with an aggressive turn donking strategy on favorable runouts.',
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
    page: 741,
    locator: 'C-bet Defense, Flop Strategy Example 2 — BB vs Min-bet on Q♥J♥T♥',
    derivation: 'exact_transcription',
    scope:
      'BB vs UTG on Q♥J♥T♥ at 40bb, facing a MIN-BET. Not 9♥8♥4♦, and not a 2/3-pot bet.',
    quote: 'OESD will only continue if they are drawing to the nut straight.',
  }),

  'ex3.oesd-check-call': ref({
    id: 'ex3.oesd-check-call',
    page: 744,
    locator: 'C-bet Defense, Flop Strategy Example 3 — BB vs 2/3-pot c-bet on 9♥8♥4♦',
    derivation: 'exact_transcription',
    scope:
      'BB vs UTG on 9♥8♥4♦ at 40bb, facing a 2/3-pot c-bet. The book’s own open-ender rule for this exact board and bet-size.',
    quote:
      'OESD are x/c every time. These combos have good equity vs IP’s c-bet range but are too weak against IP’s flop 3-betting range as they will often be dominated by overpairs or flush draws.',
  }),

  'ex3.turn-donk-best-cards': ref({
    id: 'ex3.turn-donk-best-cards',
    page: 768,
    locator: 'Diagrams 121-122 — Turn Play after Flop C-bet and Call (x/b/c)',
    derivation: 'exact_transcription',
    scope: 'BB vs UTG on 9♥8♥4♦ at 40bb, after the flop went check / c-bet / call. Which turn cards the BB leads.',
    quote:
      'The best cards for OOP to donk bet the turn are 9, 8 and 4 that pair the board, 7, 6, 5 that complete straights, and blank low offsuit cards. The worst cards to donk bet are the ones that connect well with IP’s range, which are aces, high cards, and diamonds that would give the IP player a BDFD.',
  }),

  'ex3.turn-best-card-is-five': ref({
    id: 'ex3.turn-best-card-is-five',
    page: 769,
    locator: 'Tables 138-141: OOP/IP EQ and EV heatmaps by turn card on 9♥8♥4♦ (x/b/c)',
    derivation: 'exact_transcription',
    scope: 'BB vs UTG on 9♥8♥4♦ at 40bb after x/b/c — the single best and worst turn cards for the BB by EV.',
    quote:
      'The worst cards for OOP are offsuit kings, such as K♣/K♠, and the best cards are offsuit 5s, such as 5♣/5♠.',
  }),

  'ex3.turn-equity-runs-close': ref({
    id: 'ex3.turn-equity-runs-close',
    page: 766,
    locator: 'Diagrams 119-120 — Turn Play after Flop C-bet and Call (x/b/c)',
    derivation: 'exact_transcription',
    scope: 'BB vs UTG on 9♥8♥4♦ at 40bb — average turn equity and equity realization after the flop went x/b/c.',
    quote:
      'After OOP x/b/c the flop, both players’ equities will run very close on the average turn card. In fact, OOP has higher EQ (51.65%), but under-realizes it, capturing only 48.6% of the pot, while IP, with 46.6% EQ, captures 51.4% of the pot. Similarly to the flop donk bet, on the turn OOP chooses to donk bet when IP does not have as many dominant strong hands in their range and, instead, has many weaker hands that will benefit from checking back the turn.',
  }),

  'ex3.ip-punishes-a-check': ref({
    id: 'ex3.ip-punishes-a-check',
    page: 771,
    locator: 'Diagrams 124-125 — IP vs Check (x/b/c/x)',
    derivation: 'exact_transcription',
    scope: 'BB vs UTG on 9♥8♥4♦ at 40bb — what UTG does when the BB checks the turn as well as the flop.',
    quote:
      'Typically, the IP player will have a substantial polarization advantage after OOP has checked twice… IP will c-bet over 65% of the time and will mostly use a 2/3-pot bet-size.',
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
    page: 744,
    locator: 'Table 124: BB Strategy Breakdown vs UTG 2/3-pot c-bet on 9♥8♥4♦ — Combo draws',
    derivation: 'exact_transcription',
    scope:
      'BB vs UTG on 9♥8♥4♦ at 40bb, facing a 2/3-pot FLOP c-bet. A per-combo figure for the FLOP node only — it says nothing about any later street, and must not be carried onto the turn.',
    quote:
      'Combo draws are x/r 1/3 of the time and x/c 2/3 of the time. Q♥J♥ and Q♥T♥ are x/r 100%. J♥T♥ and J♥7♥ are x/r about 1/3 and lower combo draws are mostly x/c.',
  }),

  'ex3.turn-second-barrel-oop': ref({
    id: 'ex3.turn-second-barrel-oop',
    page: 775,
    locator: 'Diagrams 128-129 — OOP vs Turn 2/3-pot C-bet: BB vs UTG on 9♥8♥4♦ (40bb) (x/b/c/x/b)',
    derivation: 'exact_transcription',
    scope:
      'BB vs UTG on 9♥8♥4♦ at 40bb, after the flop went check / c-bet / call and the BB checked the turn as well. WHOLE-RANGE averages across turn cards — "on average, over 40%" is a property of the range, never of one hand.',
    quote:
      'Facing the second barrel is not great for OOP. At this point, both players have split their ranges several times. IP would be checking back a lot of medium strength hands and is now betting with a very polarized range. OOP would have bet or raised many strong hands by now, so their range is weak against IP’s turn c-betting range, resulting in OOP folding, on average, over 40% vs a turn c-bet. Most strong hands will be x/r on the turn, but some will still be slowplayed, leaving OOP’s x/c range protected, even on brick runouts.',
  }),

  'ex3.turn-xr-all-in': ref({
    id: 'ex3.turn-xr-all-in',
    page: 777,
    locator: 'Diagrams 130-131 — OOP vs Turn 2/3-pot C-bet (x/b/c/x/b67); Tables 146-149 name the node’s bet-size',
    derivation: 'exact_transcription',
    scope:
      'Same node as p.775 — BB vs UTG on 9♥8♥4♦ at 40bb facing a 2/3-pot turn c-bet. The 14% is a WHOLE-RANGE average across turn cards; no per-combo turn frequency is printed anywhere in this section.',
    quote:
      'On average, OOP will x/r the turn 14% of the time and will be mostly going all-in, as a smaller raise size would commit too many chips. In general, their weaker x/r hands are semi-bluffs that will have the equity to call an all-in bet and thus be committed.',
  }),

  'ex3.turn-facing-cbet-eqr': ref({
    id: 'ex3.turn-facing-cbet-eqr',
    page: 778,
    locator: 'Closing metrics for Tables 146-149: OOP/IP EQ and EV heatmaps on 9♥8♥4♦ (x/b/c/x/b67)',
    derivation: 'exact_transcription',
    scope:
      'Same node again — what OOP’s position facing the second barrel is actually worth, averaged over turn cards. Not an equity figure for any particular hand.',
    quote:
      'OOP has on average 45% EQ when facing a turn c-bet, but will only be able to realize 77% of it, for a total EV of 21% of the pot. IP has an average EQ of 55%, and will over-realize it by a large margin with an EQR factor of 144%, capturing 79% of the pot.',
  }),

  'turn.categories': ref({
    id: 'turn.categories',
    page: 760,
    locator: 'Section "Turn Categories"',
    derivation: 'exact_transcription',
    scope: 'The book’s general scheme for classifying any turn card, independent of board or matchup.',
    quote:
      'Paired Board: Turn cards that pair the board. Flush: Turn cards that complete a flush. Straight: Turn cards that complete an OESD. Ace: The ace is a special card and it often has a significant effect. Overcard: Turn cards higher than top pair. Brick/Blank: Turn card that doesn’t connect with the board in a meaningful way.',
  }),

  'turn.why-groups': ref({
    id: 'turn.why-groups',
    page: 759,
    locator: 'Section "Turn Categories" — opening paragraphs',
    derivation: 'exact_transcription',
    scope:
      'The author’s own reason for grouping turn cards at all, and the sentence establishing that the groups OVERLAP rather than exclude one another. General — it is about every flop in the deck, not any one board or matchup.',
    quote:
      'There are 49 possible turn cards for every single flop, and each turn will impact the ranges in play in some way. This will consequently affect the players’ GTO strategies… Studying each individual turn for every single flop would also be highly inefficient. For this reason, we will need some sort of turn groupings in a similar way to how we previously created the flop groupings. Most turn cards can be categorized as being in one or more of the following groups:',
  }),

  'turn.category-subdivision': ref({
    id: 'turn.category-subdivision',
    page: 760,
    locator: 'Section "Turn Categories" — closing line',
    derivation: 'exact_transcription',
    scope:
      'The one refinement the book adds to the six turn groups, and the sentence establishing that a card can belong to more than one of them. General, not board-specific.',
    quote:
      'The overcard and undercard categories can be subdivided into cards that bring a backdoor flush draw and cards that don’t.',
  }),

  /* ── Puzzle: reading the turn on 9♥8♥4♦ after the flop checks back ────
   *
   * These two are the book's own worked example of the SAME board puzzle 2 uses,
   * but on a different line — x/x, not x/b/c. They are not interchangeable with
   * the `ex3.turn-*` refs above, which are all measured after the flop went
   * check / c-bet / call. Same board, same seats, different node. */

  'turn.984-xx-setup': ref({
    id: 'turn.984-xx-setup',
    page: 760,
    locator: 'Section heading "Flop Strategy 1: Turn Play after Flop Checks Back (x/x)"',
    derivation: 'exact_transcription',
    scope:
      'The setup for the book’s first worked turn example: BB vs UTG on 9♥8♥4♦ at 40bb, the big blind first to act on the turn after the flop checked through.',
    quote:
      'Flop Strategy 1: Turn Play after Flop Checks Back (x/x) / OOP First Action: BB vs UTG on 9♥8♥4♦ (40bb)',
  }),

  'turn.984-good-cards-xx': ref({
    id: 'turn.984-good-cards-xx',
    page: 763,
    locator: 'Prose accompanying Diagrams 116-117 — turn cards on 9♥8♥4♦ (x/x)',
    derivation: 'exact_transcription',
    scope:
      'BB vs UTG on 9♥8♥4♦ at 40bb, after the flop checked through (x/x). Which turn cards favour which player ON THIS BOARD — a statement about two specific ranges, not a property of a turn category in general, and not a betting frequency.',
    quote:
      'In general, low cards that complete straights, a 9, 8 or 4 pairing the board, and hearts are good turns for OOP (Diagram 116). Overcards to the board that don’t complete many straights, and particularly the aces, are good for IP.',
  }),

  'turn.984-worst-card-xx': ref({
    id: 'turn.984-worst-card-xx',
    page: 764,
    locator: 'Tables 134-137: OOP/IP EQ and EV heatmaps by turn card on 9♥8♥4♦ (x/x)',
    derivation: 'exact_transcription',
    scope:
      'BB vs UTG on 9♥8♥4♦ at 40bb after the flop checked through (x/x) — the best and worst single turn cards for the big blind, by EV. One card on one board on one line; it is not an EV for the "ace" category anywhere else. Every percentage here belongs to the WHOLE OOP RANGE, as a share of the pot: 25.8% and 64.17% are what the big blind’s entire range is worth on that turn card, never what one holding is worth.',
    quote:
      'OOP does well on the average turn card, with 48% equity, and over-realizes it to win 53% of the pot. The worst possible turn cards for OOP are offsuit aces such as A♠/A♣ where their EV decreases to 25.8%. The best possible turn cards are offsuit 5x such as 5♠/5♣ where their EV increases to 64.17% of the pot.',
  }),

  /* ── River principles (abstract models, not node solutions) ──────────── */

  'river.polar-jams-nuts': ref({
    id: 'river.polar-jams-nuts',
    page: 782,
    locator: 'Section "Setting up a River Abstract Model"',
    derivation: 'exact_transcription',
    scope:
      'The polar-versus-bluff-catcher river model. A general model the book says applies whenever the range STRUCTURE matches — it is not a solved output for any particular board.',
    quote:
      'if you can recognize the river situation as being polar vs bluff-catcher, you will know that the GTO strategy for the polar player is to always go all-in with their nut hands and the Alpha % of their bluffs. and the bluff-catching player has to call with 1-Alpha of their range.',
  }),

  'river.defend-1-alpha': ref({
    id: 'river.defend-1-alpha',
    page: 809,
    locator: 'Section "River Call Decision Points"',
    derivation: 'exact_transcription',
    scope: 'General river calling heuristics, applicable across spots rather than solved for one board.',
    quote: 'Defending close to 1-Alpha is a good approximation in most river spots.',
  }),

  'river.blockers': ref({
    id: 'river.blockers',
    page: 808,
    locator: 'Section "River Calling Strategies" — Blockers',
    derivation: 'exact_transcription',
    scope: 'General river blocker heuristics for choosing between bluff-catchers.',
    quote:
      'On the river, all bluff-catchers are equal except in how they block value hands and don’t block bluffs. When you block the opponent’s value range, call more often. When you block the opponent’s bluffing range, fold more often.',
  }),

  'theory.alpha-mdf': ref({
    id: 'theory.alpha-mdf',
    page: 108,
    locator: 'Section "Minimum Defense Frequency (MDF)"',
    derivation: 'exact_transcription',
    scope: 'The definition of Alpha and MDF, from the Clairvoyance Toy Game. Pure arithmetic of bet size versus pot.',
    quote:
      'work 33% (Alpha) of the time to instantly profit. Your opponent must defend 67% (1-Alpha) of the time',
  }),

  /* ── Puzzle 3: BB vs BN open at 100bb — why the BB defends widest ────── */

  'bb100.hr82-aggregates': ref({
    id: 'bb100.hr82-aggregates',
    page: 244,
    locator: 'Hand Range 82: BB vs BN Open',
    derivation: 'exact_transcription',
    scope:
      'BB defending against a BN open, 6-max cash, 100bb effective. These are the whole-range percentages printed with the chart — NOT the frequency of any individual hand. The chart itself is a colour-coded image; no per-combo figure is printed in text.',
    quote: 'BB vs BN Open — 3-bet 13.4% / Call 43.4% / Fold 43.2%',
  }),

  'bb100.why-bb-calls-wider': ref({
    id: 'bb100.why-bb-calls-wider',
    page: 243,
    locator: 'Prose describing Hand Range 82: BB vs BN Open',
    derivation: 'exact_transcription',
    scope:
      'BB vs BN at 100bb — the source’s own stated reason why the BB’s calling range against a button is wider than against any other position.',
    quote:
      'The BN range is wide enough that now the BB can call many more hands compared to all the other positions, as the BN’s ability to barrel and overbet very aggressively is downgraded due to the strong hands being diluted.',
  }),

  'bb100.linear-3bet': ref({
    id: 'bb100.linear-3bet',
    page: 243,
    locator: 'Prose describing Hand Range 82: BB vs BN Open',
    derivation: 'exact_transcription',
    scope:
      'BB vs BN at 100bb — which hand TYPES go into the 3-betting range and which into the calling range. A composition stated in words; it names classes, never individual combos or their frequencies.',
    quote:
      'Against the BN, the BB 3-bets a very linear range… The BB now 3-bets 13.4% hands while calling with most suited hands, offsuit Ax, connectors and broadways.',
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
    page: 655,
    locator: 'Ch. 12, opening of the flop c-bet section',
    derivation: 'exact_transcription',
    scope:
      'The author’s own statement of what the whole Ch.12 flop c-bet dataset is — the boundary that keeps its numbers out of a 100bb cash spot.',
    quote:
      'for this section we will use the aggregated data from thousands of GTO solutions with stack depths 20bb, 30bb and 40bb with standard GTO MTT starting ranges.',
  }),

  'position.ip-over-realizes': ref({
    id: 'position.ip-over-realizes',
    page: 656,
    locator: 'Table 110: IP vs BB Overall Metrics',
    derivation: 'exact_transcription',
    scope:
      'Aggregated GTO solutions at 20bb/30bb/40bb with MTT starting ranges, IP vs BB on the flop after the BB checks — NOT the 100bb 6-max cash configuration of Hand Range 82. Cited for the direction position pushes equity realization, never as a figure for a 100bb cash spot.',
    quote:
      'Both the BN and UTG over-realize their equity by 15%, but since UTG’s range has higher equity, they are able to capture a bigger portion of the pot than the BN (Table 110).',
  }),

  'position.ip-range-advantage': ref({
    id: 'position.ip-range-advantage',
    page: 657,
    locator: 'Diagram 38: BB vs IP Equity Buckets',
    derivation: 'exact_transcription',
    scope:
      'Same 20bb/30bb/40bb MTT-range aggregate as Table 110. The "~44%" and "~15%" are the BN and UTG opening ranges IN THAT dataset — they are not the 100bb 6-max cash opening sizes, and must not be presented as the button’s open in a 100bb spot.',
    quote:
      'Clearly IP has the overall range advantage. As expected, UTG’s ~15% range is much stronger than the BN’s ~44% range (Diagram 38).',
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
    page: 690,
    locator: 'Flop Strategy Example 4 / Diagram 63 — heading',
    derivation: 'exact_transcription',
    scope:
      'The book’s own one-line classification of this exact node: BN c-betting on J♠6♥6♦ at 40bb effective after the BB checks. "Mid c-bet %" and "small bet-size" are the two labels the author puts on it.',
    quote: 'Mid c-bet % and small bet-size: BB vs BN on J♠6♥6♦ (40bbs)',
  }),

  'ex4.j66-range-comparison': ref({
    id: 'ex4.j66-range-comparison',
    page: 690,
    locator: 'Flop Strategy Example 4 — prose accompanying Diagram 63',
    derivation: 'exact_transcription',
    scope:
      'Range COMPOSITION for both players on J♠6♥6♦ at 40bb, BB vs BN. Every figure is a share of a whole range — 14% / 23% strong hands, 8.9% / 5% trip sixes — and none of them is the frequency of any individual hand or a strategy percentage. This is the rare passage where the book prints both sides of the same flop.',
    quote:
      'On this flop, the BB’s range is very polar and has a healthy number of strong hands at 14%, not too far away from the BN’s 23%. More specifically, the BB’s range has 8.9% trip sixes, while the BN only has 5%.',
  }),

  'ex4.j66-cbet-72': ref({
    id: 'ex4.j66-cbet-72',
    page: 690,
    locator: 'Flop Strategy Example 4 — prose accompanying Diagram 63',
    derivation: 'exact_transcription',
    scope:
      'The BN’s OVERALL c-bet frequency across its ENTIRE range on J♠6♥6♦ at 40bb after the BB checks — 72%. It is not the frequency of any single hand or hand class, and it is not a per-sizing figure. The same sentence states why the sizing must stay small, and gives the BB’s 52% trash share.',
    quote:
      'For this reason, the BN cannot use a large sizing, but the BB still has 52% trash hands that will struggle to continue against even a min-bet. This allows the BN to have a high overall c-bet frequency of 72%.',
  }),

  'ex4.j66-check-28': ref({
    id: 'ex4.j66-check-28',
    page: 690,
    locator: 'Flop Strategy Example 4 — complement of the 72% printed with Diagram 63',
    derivation: 'exact_derived',
    scope:
      'The remaining 28% of the BN’s whole range on J♠6♥6♦ at 40bb — the part not bet after the BB checks. A whole-range figure, not a per-hand frequency. The book prints the 72%; this is 100 − 72 and nothing more.',
    quote: 'This allows the BN to have a high overall c-bet frequency of 72%.',
  }),

  'ex4.paired-boards-min-bet': ref({
    id: 'ex4.paired-boards-min-bet',
    page: 663,
    locator: 'Diagram 45 — IP flop bet-size by flop texture',
    derivation: 'exact_transcription',
    scope:
      'PAIRED BOARDS AS A CLASS, across the chapter’s whole flop dataset — not J♠6♥6♦ specifically. The general texture rule that this puzzle’s spot is one instance of.',
    quote: 'Clearly, paired boards should be frequently min-bet.',
  }),

  'ex4.why-paired-boards-small': ref({
    id: 'ex4.why-paired-boards-small',
    page: 663,
    locator: 'Section "Flop C-betting by Structure"',
    derivation: 'exact_transcription',
    scope:
      'The stated MECHANISM behind small bets on paired boards, again as a class rather than for J♠6♥6♦ alone. Cited for the causal chain — the pair hands the BB strong hands, which polarizes the BB, which caps IP’s sizing — never for a number in this spot.',
    quote:
      'Paired boards, on the other hand, give the BB a lot of strong hands, polarizing their range and allowing them some counterplay. This range polarization is one of the main reasons why betting very small is optimal on paired boards. Small bets force the BB to reveal a lot of information about their holding, as there are a lot of trash and weak hands the BB has to fold, regardless of IP’s bet-size, and IP loses the minimum when having to bet/fold the flop with the bottom of their range.',
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
    page: 661,
    locator: 'Diagram 44 and accompanying prose — flop c-bet frequency by the flop’s highest card',
    derivation: 'exact_transcription',
    scope:
      'IP’s flop c-bet frequency after the BB checks, aggregated from thousands of GTO solutions at 20bb/30bb/40bb with MTT starting ranges, blended over BN and UTG openers (p.655). Each figure is the AVERAGE over every flop sharing that highest card — not the frequency for one specific flop, and not the frequency for one specific hand.',
    quote:
      'The only 2xx flop is 222 and it is c-bet 100% of the time. Axx flops are the second most c-bet flops, with a 96% c-bet frequency. 3xx flops are only 333, 322 or 332 and are c-bet 93% of the time. Kxx flops are c-bet 88%, Qxx and Txx are c-bet 85% and, as expected, middle and low flops are c-bet at the lowest frequencies, with 6xx being the lowest at only 62% (Diagram 44).',
  }),

  'cbet.check-share-derived': ref({
    id: 'cbet.check-share-derived',
    page: 661,
    locator: 'Diagram 44 prose — arithmetic complement of the printed c-bet frequencies',
    derivation: 'exact_derived',
    scope:
      'What is left when IP does not c-bet: 100% − 96% = 4% on Axx, 100% − 62% = 38% on 6xx. Same dataset and same category-average scope as the printed figures; the subtraction adds no new information and no new source.',
    quote: 'Axx flops … with a 96% c-bet frequency … with 6xx being the lowest at only 62%.',
  }),

  'cbet.checking-back-costs-ip': ref({
    id: 'cbet.checking-back-costs-ip',
    page: 656,
    locator: 'Table 109: Result of IP Playing 100% Check Back',
    derivation: 'exact_transcription',
    scope:
      'IP vs BB on the flop in a single raised pot, same 20bb/30bb/40bb MTT-range aggregate. Measures what IP gives up by never c-betting at all — across all flops, not on any one board.',
    quote:
      'If IP plays a strategy that always checks back the flop, they will have an EV loss of 26bb/100, so c-betting the flop is of massive importance to IP.',
  }),

  'cbet.analysis-after-bb-checks': ref({
    id: 'cbet.analysis-after-bb-checks',
    page: 656,
    locator: 'Ch. 12, "Overall Flop Metrics"',
    derivation: 'exact_transcription',
    scope:
      'The exact decision node every figure in this section describes — IP acting after the BB has checked the flop in a single raised pot. This is the node this puzzle asks about.',
    quote: 'This analysis starts on IP’s decision point after the BB checks.',
  }),

  'cbet.range-strength-drives-frequency': ref({
    id: 'cbet.range-strength-drives-frequency',
    page: 659,
    locator: 'Diagram 40 and accompanying prose (sentence continues onto p.660)',
    derivation: 'exact_transcription',
    scope:
      'The book’s stated mechanism linking range strength to c-bet frequency, given for the UTG-versus-BN comparison and then generalized. Same 20bb/30bb/40bb MTT-range dataset.',
    quote:
      'UTG’s c-bet frequency and bet-sizes are bigger than the BN because the UTG range is stronger than that of the BN. In general, the more strong hands your range has compared to your opponent’s, the more frequently you can bet.',
  }),

  'cbet.straights-favor-bb': ref({
    id: 'cbet.straights-favor-bb',
    page: 661,
    locator: 'Diagram 42 and accompanying prose — c-bet frequency by number of possible flopped straights',
    derivation: 'exact_transcription',
    scope:
      'A DIFFERENT way of sorting the same flops — by how many straights they allow rather than by their highest card. Cited so the top-card ranking is not presented as the only feature the book measures. Same aggregated Ch.12 dataset as every figure in this section: thousands of GTO solutions at 20bb/30bb/40bb with standard GTO MTT starting ranges (p.655). The DIRECTION of the effect is stated in words and shown in Diagram 42; no c-bet frequency per straight-count bucket is printed alongside it.',
    quote:
      'Since the BB has more offsuit connectors than IP, flops with more possible flopped straights will, as expected, favor the BB. So, the c-bet frequency decreases as there are more straights possible on the flop. Flops with zero flopped straights are the highest c-bet ones.',
  }),

  'cbet.sizes-by-stack-depth': ref({
    id: 'cbet.sizes-by-stack-depth',
    page: 660,
    locator: 'Diagram 41 and accompanying prose',
    derivation: 'exact_transcription',
    scope:
      'How IP’s c-bet SIZE varies with stack depth — not with the flop’s highest card. The book prints no size split for the top-card categories, so this is the nearest statement about sizing and is cited only as that.',
    quote:
      'The bigger sizes are generally used less often when stacks are shallower, and the use of bigger bets (and even overbets) becomes more relevant when stacks are deeper.',
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
    page: 651,
    locator: 'Section "The Power of Position" — definitions preceding Table 105',
    derivation: 'exact_transcription',
    scope:
      'A MODIFIED hypothetical simulation, not a spot that can occur at a real table. It also fixes the three flop bet-sizes available to both players in this experiment — 1.25-pot, 2/3-pot and 1/4-pot — which is where this puzzle’s answer choices come from.',
    quote:
      'GTO: Modified GTO Solution with new flop bet-sizings for both players: 1.25-pot, 2/3-pot, 1/4-pot. Positions Flipped: Modified solution where the players’ ranges are flipped, so now OOP has the BN range and the IP Player has the BB range.',
  }),

  'flip.hero-oop-with-bn-range': ref({
    id: 'flip.hero-oop-with-bn-range',
    page: 651,
    locator: 'Table 105: Result of Flipping BN and BB Ranges from BN Perspective',
    derivation: 'exact_transcription',
    scope:
      'The MODIFIED "positions flipped" solve, BB vs BN on 654r/A76r at 30bb: ranges unchanged from the real preflop, but who acts first on the flop is swapped. A hypothetical configuration that cannot be dealt — this is the sentence that defines what "you hold the button’s range out of position" means.',
    quote:
      'Now imagine the positions are flipped on the flop, but both players keep their original ranges. Now Hero is OOP with a 49% BN range, and the Villain is IP with a 64% BB calling range (Table 105).',
  }),

  'flip.654r-oop-frequency': ref({
    id: 'flip.654r-oop-frequency',
    page: 652,
    locator: 'Prose accompanying Table 105 — 654r',
    derivation: 'exact_transcription',
    scope:
      'The FLIPPED simulation on 654r at 30bb: Hero holding the BN’s 49% range but acting first. 9.23% is a whole-range betting frequency in a hypothetical solve — it is NOT how often a button c-bets this flop, which is the 48% figure from the same paragraph.',
    quote:
      'When Hero is OOP with the BN’s range on this flop, the total betting frequency drops down to 9.23% and the most used bet-size is the 125% overbet. Again, Hero aims to play a two street game and go all-in on the turn with a reasonably high frequency.',
  }),

  'flip.654r-checking-range-protection': ref({
    id: 'flip.654r-checking-range-protection',
    page: 652,
    locator: 'Prose accompanying Table 105 — 654r',
    derivation: 'exact_transcription',
    scope:
      'The FLIPPED simulation on 654r at 30bb — the source’s own causal explanation for why the OOP betting frequency collapses and the checking frequency rises.',
    quote:
      'Unfortunately, when checking OOP, Hero is not guaranteed to see a turn card and will instead often face a bet and be forced to give up equity with many hands that would benefit from seeing a free turn card. For this reason, when OOP, Hero has to check many strong hands that can x/r the flop, forcing the Villain to bet less often, and thus allowing Hero’s weak hands to realize equity. If Hero does not protect the checking range, Villain will bet at a higher frequency, costing Hero a lot of EV. For this reason, Hero’s checking frequency is even higher when OOP with a range disadvantage.',
  }),

  'flip.654r-oop-eqr': ref({
    id: 'flip.654r-oop-eqr',
    page: 652,
    locator: 'Prose accompanying Table 105 — 654r',
    derivation: 'exact_transcription',
    scope:
      'The FLIPPED simulation on 654r at 30bb, measured against the same range played in position. The price of the seat, holding the range constant.',
    quote: 'When OOP on 654r, Hero’s EQR decreases from 100% to 79%, costing 9.7% of the pot!',
  }),

  'flip.a76r-oop-cost': ref({
    id: 'flip.a76r-oop-cost',
    page: 651,
    locator: 'Prose accompanying Table 105 — A76r',
    derivation: 'exact_transcription',
    scope:
      'The same FLIPPED experiment run on A76r at 30bb — the board where the BN’s range is strong. Cited as the contrast that shows the cost of position is not a constant.',
    quote:
      'On A76r, Hero’s range is so strong compared to the Villain’s that Hero still over-realizes equity, but not as much as with position. Hero’s EV reduces from capturing 75% to only being able to capture 68.3% of the pot, costing Hero 6.7% of the pot.',
  }),

  'flip.two-street-game': ref({
    id: 'flip.two-street-game',
    page: 651,
    locator: 'Prose accompanying Table 105 — why the sizings change when position is removed',
    derivation: 'exact_transcription',
    scope:
      'Written in the A76r paragraph of the flipped experiment, and explicitly carried over to 654r on the next page ("Again, Hero aims to play a two street game"). Cited for WHY the 2/3-pot size loses its job once position is gone, never for a frequency.',
    quote:
      'When playing IP, Hero’s strategy is almost always aimed to bet across three streets. For this reason, the 67% size is used more often as it allows an effective triple barrel. When we flip the positions, some elements of Hero’s range only want to play a two street game.',
  }),

  'flip.value-of-position-general': ref({
    id: 'flip.value-of-position-general',
    page: 653,
    locator: 'Tables 107-108: Symmetric Ranges from IP / OOP Perspective',
    derivation: 'exact_transcription',
    scope:
      'A THIRD modified experiment — both players dealt identical ranges — run across sample flops. It isolates position with range differences removed entirely, which is why it can be cited as the general size of the effect rather than a 654r number.',
    quote:
      'Despite having identical ranges, the IP player captures on average 5% more of the pot than 50% equity, for a total EQR of 110%. Meanwhile OOP only realizes 90% of their equity, capturing on average only 45% of the pot… Different experiments that use different sample flops, or even a large subset of flops, give results that are consistent with the value of position being between 5-10% of the pot.',
  }),

  /* ── Puzzle 4: why connected boards suppress IP's c-bet ──────────────── */

  'flops.straight-count': ref({
    id: 'flops.straight-count',
    page: 627,
    locator: 'Section "Flopped Straights" — Table 98',
    derivation: 'exact_transcription',
    scope:
      'The book’s own definition of a flop’s straight count, with four worked examples. Pure board classification — no strategy, no matchup, no stack depth attached.',
    quote:
      'Flops can also be categorized by the number of possible flopped straights (Table 98). For example, on the flop AQ7 there are zero possible flopped straights. On KT9 there is one possible flopped straight (with QJ). On 875 there are two possible flopped straights (96 and 64). Finally, on JT9 there are three possible flopped straights (KQ, Q8 and 87).',
  }),

  'flops.oesd-subcategory-limits': ref({
    id: 'flops.oesd-subcategory-limits',
    page: 628,
    locator: 'Section "Flopped Straights", closing sentence',
    derivation: 'exact_transcription',
    scope:
      'The author stating the limit of his own classification chapter: the OESD subcategory exists but is not developed there. It is why no worked example of an OESD count appears in the book, and why this puzzle enumerates its board’s open-enders card by card instead of asserting a bucket label.',
    quote:
      'Flops that have zero flopped straights can also be subcategorized according to the number of possible OESDs, but for the scope of this book we will only focus on the number of straights.',
  }),

  'cbet.oesd-subcategory': ref({
    id: 'cbet.oesd-subcategory',
    page: 661,
    locator: 'Prose introducing Diagram 42',
    derivation: 'exact_transcription',
    scope:
      'The nesting that decides how this puzzle’s two boards relate: the OESD count is a subcategory INSIDE the zero-straight flops, not a separate axis. Both of this puzzle’s flops therefore have zero flopped straights.',
    quote:
      'Within the flops with zero possible straights, we can create a subcategory for the number of possible open-ended straight draws (Diagram 42).',
  }),

  'cbet.three-oesd-lowest': ref({
    id: 'cbet.three-oesd-lowest',
    page: 661,
    locator: 'Prose accompanying Diagram 43',
    derivation: 'exact_transcription',
    scope:
      'IP’s flop c-bet frequency and bet-size on zero-straight flops broken down by OESD count, same aggregated 20bb/30bb/40bb MTT-range dataset. States both halves of the effect — lower frequency, larger sizes — and the reason, but prints no figure for either bucket.',
    quote:
      'Not surprisingly, the flops with three OESDs are the ones with the lowest c-bet frequency and with the larger bet-sizes, as the BB will have more possible straight draws and IP’s strong hands need more protection.',
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
    page: 673,
    locator: 'Prose accompanying Diagram 54 — Flop C-betting by Texture (Unpaired Flops)',
    derivation: 'exact_transcription',
    scope:
      'Unpaired flops in the Ch.12 aggregate. The book’s only printed figures per straight-count bucket, given as how often the flop is CHECKED, inside the flop-texture section — not as c-bet frequencies for the Diagram 42/43 comparison this puzzle teaches. Cited to locate them, not to import them.',
  }),

  /* ── Puzzle 4: BN c-bet on 8♥6♦2♠ (40bb) — Flop Strategy Example 5 ────── */

  'eqb.definitions': ref({
    id: 'eqb.definitions',
    page: 596,
    locator: 'Section "Equity Buckets (EQB)"',
    derivation: 'exact_transcription',
    scope:
      'The book’s definition of the four equity buckets. Hand-vs-RANGE equity, so a hand’s bucket is relative to the ranges in play and the board — it is not a fixed property of the two cards.',
    quote:
      'Strong Hands: Hands with a hand vs range equity greater or equal to 75% • Good Hands: Hands with a hand vs range equity greater or equal to 50% but lower than 75% • Weak Hands: Hands with a hand vs range equity greater or equal to 33% but lower than 50% • Trash Hands: Hands with a hand vs range equity lower than 33%',
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
    page: 663,
    locator: 'Section "Flop C-betting by Structure" (sentence completes on p.664)',
    derivation: 'exact_transcription',
    scope:
      'Ch.12 flop c-bet section, 20bb/30bb/40bb MTT-range aggregate — the general rule linking IP’s range SHAPE to bet-SIZE. Says nothing about how often IP bets.',
    quote:
      'In general, small bets are preferred when IP’s range has this type of depolarized distribution with the bulk of hands being good, but not great, and a low frequency of trash and weak hands. In situations where IP’s range distribution is more polarized with a bigger proportion of strong, weak and trash hands, bigger bet-sizes are used more often.',
  }),

  'cbet.example-matrix': ref({
    id: 'cbet.example-matrix',
    page: 682,
    locator: 'Section "IP C-bet Examples" — Flop Strategy Examples 1-6 (pp.682-696)',
    derivation: 'exact_transcription',
    scope:
      'The six worked IP c-bet examples, all at 40bb. Cited for the section’s own ORGANISATION — frequency and bet-size are varied independently across the six headings — not for any number.',
    quote:
      'Example 1: High c-bet % and big bet-size: BB vs UTG on A♥Q♦3♠ (40bb) • Example 2: High c-bet % and small bet-size: BB vs UTG on Q♥J♥T♥ (40bb) • Example 3: Mid c-bet % and big bet-size: BB vs UTG on 9♥8♥4♦ (40bbs) • Example 4: Mid c-bet % and small bet-size: BB vs BN on J♠6♥6♦ (40bbs) • Example 5: Low c-bet % and big bet-size: BB vs BN on 8♥6♦2♠ (40bbs) • Example 6: Low c-bet % and small bet-size: BB vs BN on 5♥5♦4♥ (40bbs)',
  }),

  'ex5.low-freq-big-size': ref({
    id: 'ex5.low-freq-big-size',
    page: 692,
    locator: 'Flop Strategy Example 5 — heading (Diagram 65 on p.693)',
    derivation: 'exact_transcription',
    scope:
      'BN’s flop c-betting strategy on 8♥6♦2♠ at 40bb after the BB checks. This puzzle’s exact spot. The heading names the strategy’s two axes; the numbers behind it live in Diagram 65, which is an image.',
    quote: 'Low c-bet % and big bet-size: BB vs BN on 8♥6♦2♠ (40bbs)',
  }),

  'ex5.range-distribution': ref({
    id: 'ex5.range-distribution',
    page: 693,
    locator: 'Prose accompanying Diagrams 65-66',
    derivation: 'exact_transcription',
    scope:
      'BN vs BB on 8♥6♦2♠ at 40bb — the source’s own causal explanation for this flop’s strategy. Qualitative: no equity-bucket percentages are printed for this board.',
    quote:
      'On 862r, the BB has few strong hands compared to the BN. This incentivizes the BN to use a big bet-size. However, the BN also has many good and weak hands that benefit from playing a small pot and taking a free turn card. These range distributions results in a more polarized big bet-size with a low c-bet frequency.',
  }),

  'ex5.strong-hands-check-back': ref({
    id: 'ex5.strong-hands-check-back',
    page: 694,
    locator: 'Table 117: BN C-betting Range Breakdown on 8♥6♦2♠ — Strong hands',
    derivation: 'exact_transcription',
    scope: 'BN vs BB on 8♥6♦2♠ at 40bb — what the BN does with the top of its range.',
    quote:
      'some strong hands such as top set and top pair weak kicker get checked back with some frequency. In fact, top set wants to check back or bet small. Since I advocate one bet-size by flop, I think a good strategy would be to simply always check back top set in this spot.',
  }),

  'ex5.dont-cbet-all-value': ref({
    id: 'ex5.dont-cbet-all-value',
    page: 694,
    locator: 'Table 117 breakdown — Strong hands, closing remark',
    derivation: 'exact_transcription',
    scope:
      'BN vs BB on 8♥6♦2♠ at 40bb — the author’s named leak, stated for this spot. Explains why a low c-bet frequency is not timidity.',
    quote:
      'A trend that typically loses a lot of EV to IP that I see all the time is to c-bet all strong and good hands on the flop and checking back an unbalanced and capped range that can be attacked by the BB on future streets.',
  }),

  'ex5.good-hands-check-back': ref({
    id: 'ex5.good-hands-check-back',
    page: 694,
    locator: 'Table 117 breakdown — Good hands',
    derivation: 'exact_transcription',
    scope: 'BN vs BB on 8♥6♦2♠ at 40bb — the default for the BN’s good hands as a group.',
    quote:
      'Good hands really want to check back a lot and realize equity instead of being raised off the pot. Middle and low pocket pairs mostly want to check back the flop, except 77, which can be bet half the time, as it can get value from middle pair.',
  }),

  'ex5.middle-pair-a6': ref({
    id: 'ex5.middle-pair-a6',
    page: 694,
    locator: 'Table 117 breakdown — Good hands (sentence completes on p.695)',
    derivation: 'exact_transcription',
    scope:
      'BN vs BB on 8♥6♦2♠ at 40bb. The source names A6 by hand and places it in the GOOD bucket. It says "mostly c-bet" — a direction, not a printed frequency.',
    quote:
      'The strongest middle pairs such as A6 and K6 are mostly c-bet and the weaker ones are typically checked back. Bottom pair top kicker is mostly c-bet, and the rest are checked back.',
  }),

  'ex5.weak-hands': ref({
    id: 'ex5.weak-hands',
    page: 695,
    locator: 'Table 117 breakdown — Weak hands',
    derivation: 'exact_transcription',
    scope:
      'BN vs BB on 8♥6♦2♠ at 40bb — how the BN selects bluffs, and the criterion it uses (can this hand call a check-raise?).',
    quote:
      'Weak hands are c-bet reverse linearly when they cannot call a flop x/r. For example, K6o gets c-bet more often than K9o, which also gets c-bet more often than KQo. So, the strongest Kx that will do well on many turns can be checked back, while the weaker ones better serve as bet/folds. OESDs are mostly checked back, while gutshots and Q-high with two overcards are mostly c-bet.',
  }),

  'ex5.trash-hands': ref({
    id: 'ex5.trash-hands',
    page: 695,
    locator: 'Table 117 breakdown — Trash hands',
    derivation: 'exact_transcription',
    scope:
      'BN vs BB on 8♥6♦2♠ at 40bb — why even the bottom of the range is not bet at 100%, which is part of what holds the overall frequency down.',
    quote:
      'Weak Q-high, J-high and T-high with no draws are c-bet more often than not, but you have to give up and check back some of them because c-betting all your trash would make your c-betting range too weak.',
  }),

  'ex5.xr-frequency': ref({
    id: 'ex5.xr-frequency',
    page: 695,
    locator: 'Table 117 breakdown — "Facing a 50% Pot x/r"',
    derivation: 'exact_transcription',
    scope:
      'BB’s equilibrium check-raise frequency on 8♥6♦2♠ at 40bb, against the BN. One of only two numeric frequencies the source prints for this board.',
    quote:
      'On 862r, the BB’s range does not have many strong hands, thus the equilibrium flop x/r frequency is low, at ~8%. The x/r range mostly includes hands such as top pair good kicker, some OESD, some weak hands like gutshot plus BDFD and some random overcards.',
  }),

  'ex5.bn-vs-xr-response': ref({
    id: 'ex5.bn-vs-xr-response',
    page: 695,
    locator: 'Table 117 breakdown — "Facing a 50% Pot x/r", BN’s response',
    derivation: 'exact_transcription',
    scope:
      'BN’s equilibrium response to a 50%-pot check-raise on 8♥6♦2♠ at 40bb. A three-way split of the BN’s c-betting range only — not of its whole range.',
    quote:
      'The BN’s equilibrium response is to fold 43% of the time, call 34% and 3-bet all-in 23%. The BN’s 3-betting range includes hands such as QQ-99, top pair good kicker+… The calling range is pretty much any pair, any gutshot or better draw',
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
    page: 634,
    locator: 'Diagram 25: Average BB vs IP Equity Buckets for 20bb/30bb/40bb Stacks — the A76r figures',
    derivation: 'exact_transcription',
    scope:
      'BB vs IP equity-bucket distribution on A76r, averaged over 20bb/30bb/40bb stacks. The 85% and 65% are IP’s top-pair equity against the BB’s RANGE — not the equity of any particular holding.',
    quote:
      'on A76r, the BB has 8% strong hands and IP has a staggering 31% strong hands! What happens is that, on A76r, IP’s top pairs (any Ax) have on average 85% equity vs the BB’s range, while a top pair on 654 will average about 65% equity.',
  }),

  'a76r.bb-good-and-trash': ref({
    id: 'a76r.bb-good-and-trash',
    page: 634,
    locator: 'Prose accompanying Diagram 25',
    derivation: 'exact_derived',
    scope:
      'The BB’s good and trash buckets on A76r, read out of the comparison the source prints: the 17% and the 49% ARE the A76r values, stated as the baseline the 654r figures move away from. Same 20bb/30bb/40bb average as the rest of Diagram 25.',
    quote:
      'On 654r, the BB’s good hands increase from 17% to 40% and the trash hands reduce from 49% to 18% when compared to A76r.',
  }),

  'a76r.donk-reverses-eqr': ref({
    id: 'a76r.donk-reverses-eqr',
    page: 634,
    locator: 'Prose accompanying Diagram 25',
    derivation: 'exact_transcription',
    scope: 'A76r, BB vs IP — the causal explanation for the near-zero donk frequency, stated as the exact reversal of the 654r case.',
    quote:
      'Donk betting on A76r doesn’t make sense because it does not help the BB deny IP EQR. In this case, the opposite actually occurs, because IP’s range is so strong on this board that a donk bet can get raised with such a high frequency that the effect would be reversed. It would be the BB who is forced to continue putting more money into the pot with hands that would rather see a cheap turn card or fold, reducing their equity and resulting in a lower EQR and EV loss for OOP.',
  }),

  'a76r.ip-cbets-100': ref({
    id: 'a76r.ip-cbets-100',
    page: 635,
    locator: 'Prose accompanying Table 101: A76r BB vs BN 30bb Stats for Different BB Strategies',
    derivation: 'exact_transcription',
    scope:
      'BB vs BN on A76r at 30bb — this puzzle’s exact spot. What IP does once the BB checks, and what leading costs the BB’s strongest hands.',
    quote:
      'A76r is so good for IP that they get to c-bet 100% of their range and not worry about being x/r too often. For this reason, the BB doesn’t need to lead out with their strongest hands to get value as IP will keep putting money into the pot with their entire range when checked to. If the BB starts leading strong hands on A76r, it would only help IP as they could then choose to fold weak hands that would have continued putting money into the pot in the form of a c-bet and only continue when it is profitable to do so.',
  }),

  'a76r.top-pair-lock-ev': ref({
    id: 'a76r.top-pair-lock-ev',
    page: 635,
    locator: 'Table 101: A76r BB vs BN 30bb Stats for Different BB Strategies',
    derivation: 'exact_transcription',
    scope:
      'BB vs BN on A76r at 30bb — the GTO solution against a LOCKED strategy that donks every top pair or better. This puzzle’s exact spot and exactly the temptation it is about. The figures are printed without a unit in the prose; see the exhibit note.',
    quote:
      'If we force the BB to donk every time they have top pair or better (10%), their total EV reduces from 25 to 13, as this strategy is highly exploitable. In the GTO solution, the checking range is well protected because the BB is never leading out but, in the locked strategy, the BB is donking their strongest hands, leaving their checking range vulnerable. This makes their EV after checking decline to 5.6.',
  }),

  'a76r.bb-ev-share-of-pot': ref({
    id: 'a76r.bb-ev-share-of-pot',
    page: 652,
    locator: 'Prose accompanying Table 106: Result of Flipping BN and BB Ranges from BB Perspective',
    derivation: 'exact_transcription',
    scope:
      'A76r BB vs BN at 30bb — the BB’s EV as a SHARE OF THE POT out of position (25%), compared with a hypothetical sim where the BB has position. Cited here for one narrow purpose: it is what establishes that Table 101’s bare "25" is 25% of the pot.',
    quote: 'This results in a huge EV increase from 25% when OOP to 37.8% when IP for a total gain of 12.8%!',
  }),

  'a76r.check-100': ref({
    id: 'a76r.check-100',
    page: 635,
    locator: 'Prose closing the Table 101 discussion',
    derivation: 'exact_transcription',
    scope: 'BB vs BN on A76r at 30bb — the source’s explicit strategic recommendation for the BB on this flop.',
    quote:
      'If the BB tries a strategy of leading only with weak hands, the result is even worse as now IP will be able to raise 100% of the time, making the BB not only lose the entire pot when betting, but also their 1/4-pot size bet. For this reason, it works better for OOP to not split their range and simply check 100% on A76r.',
  }),

  'a76r.donk-option-worthless': ref({
    id: 'a76r.donk-option-worthless',
    page: 650,
    locator: 'Section "The Value of Donk Betting"',
    derivation: 'exact_transcription',
    scope:
      'A76r specifically — the flop’s own donk frequency and the EV cost of removing the option, printed alongside the 654r figures of Table 104. This is an A76r figure, not the 20/30/40bb BN+UTG average of p.632.',
    quote:
      'For example, on the A76r flop, OOP should donk bet about 0.4% of the time and, if we remove the BB’s option to donk bet, their overall EV remains the same.',
  }),

  'no-donk.family-metrics': ref({
    id: 'no-donk.family-metrics',
    page: 648,
    locator: 'Section "No Donk Bet Flops (0%-10%)"',
    derivation: 'exact_transcription',
    scope:
      'Averages across the ENTIRE no-donk-bet flop group — the vast majority of flops, of which AXX boards are named members. Not an A76r-specific figure.',
    quote:
      'In general, this group of flops are bad for the BB, providing an average of 39% equity and low EQR of 76%, for an average EV of 30% of the pot. On these boards, IP’s range is so strong that OOP is forced to check with a high frequency, for an average donk bet frequency of about 1%. OOP’s range is so weak that it doesn’t have enough strong hands compared to IP to be able to split this range so, for the most part, removing the option to donk bet on these kinds of flops does not reduce BB’s EV too significantly.',
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
    page: 684,
    locator: 'Flop Strategy Example 2 — section heading',
    derivation: 'exact_transcription',
    scope:
      'UTG’s flop c-betting strategy on Q♥J♥T♥ at 40bb. The book’s own two-part classification of this node: the frequency is high AND the size is small, named independently of one another.',
    quote: 'High c-bet % and small bet-size: BB vs UTG on Q♥J♥T♥ (40bb)',
  }),

  'ex2.range-advantage-but-small': ref({
    id: 'ex2.range-advantage-but-small',
    page: 685,
    locator: 'Flop Strategy Example 2 — prose accompanying Diagram 59',
    derivation: 'exact_transcription',
    scope:
      'BB vs UTG on Q♥J♥T♥ at 40bb — the source’s own causal explanation for why a substantial range advantage still cannot be bet big. A specific 40bb solve, not a category average.',
    quote:
      'On Q♥J♥T♥, UTG has a substantial range advantage, so they would like to c-bet at a high frequency, but the BB’s range is too polarized, with many hands that would not be able to continue on the flop if UTG used a big bet-size. At the same time, BB has many strong hands that will be happy to continue vs a big bet-size.',
  }),

  'ex2.big-bet-helps-bb': ref({
    id: 'ex2.big-bet-helps-bb',
    page: 686,
    locator: 'Flop Strategy Example 2 — prose continuing from the foot of p.685',
    derivation: 'exact_transcription',
    scope:
      'BB vs UTG on Q♥J♥T♥ at 40bb — what each of the two candidate sizes does to the BB’s range. The second half of the p.685 passage; the sentence begins on p.685 and completes here.',
    quote:
      'So, by betting big UTG would be making the BB’s life easier, allowing them to correctly fold weak hands and continue with a very strong range. If instead, UTG bets the minimum, this will lure the BB in with many weak hands that UTG dominates, keeping their range wider on future streets.',
  }),

  'ex2.min-bet-100-no-ev-loss': ref({
    id: 'ex2.min-bet-100-no-ev-loss',
    page: 686,
    locator: 'Flop Strategy Example 2 — prose accompanying Table 114',
    derivation: 'exact_transcription',
    scope:
      'UTG on Q♥J♥T♥ at 40bb — the simplification the author endorses for this exact flop. It is a WHOLE-RANGE statement: it covers every hand UTG can hold, and is the reason no per-combo figure is needed or claimed.',
    quote:
      'The strategy on this flop can be simplified to min-bet 100% with no EV loss. Many times, when people see all the small frequencies being used, they freak out, thinking that playing with that level of detail is impossible, and they are right. Only a solver would be capable of that kind of mixing but, as we saw in the post-flop bet-sizing section, we don’t need to use multiple bet-sizes, as a single bet-size will retain virtually all the strategy’s EV.',
  }),

  'ex2.table-114': ref({
    id: 'ex2.table-114',
    page: 686,
    locator: 'Table 114: UTG c-betting Range Breakdown on Q♥J♥T♥',
    derivation: 'exact_transcription',
    scope:
      'UTG’s c-betting breakdown on Q♥J♥T♥ at 40bb. Printed as a table image — no c-bet frequency, bet-size split or per-combo figure from it appears anywhere in the running text. Cited to establish that the gap is a gap, never as a number.',
    quote: 'Table 114: UTG c-betting Range Breakdown on Q♥J♥T♥',
  }),

  'ex2.ip-almost-never-checks-back': ref({
    id: 'ex2.ip-almost-never-checks-back',
    page: 750,
    locator: 'Turn chapter, "OOP First Action" — prose accompanying Table 126',
    derivation: 'exact_transcription',
    scope:
      'IP’s flop strategy on A♠Q♦3♠ and Q♥J♥T♥ at 40bb. A qualitative statement about how rarely IP checks back this flop — the book gives no percentage, and this ref must not be rendered as one.',
    quote:
      'Checking back almost never happens at equilibrium on A♠Q♦3♠ and Q♥J♥T♥. For this reason, IP’s range on the turn contains only 1.4 and 1 combos, respectively.',
  }),

  'ex2.bb-36-equity': ref({
    id: 'ex2.bb-36-equity',
    page: 739,
    locator: 'Flop Strategy Example 2 (BB side) — prose accompanying Diagram 101',
    derivation: 'exact_transcription',
    scope:
      'BB vs UTG on Q♥J♥T♥ at 40bb, facing UTG’s flop MIN-BET. The book’s own analysis of this exact node from the defender’s side — the response frequencies are to the min-bet specifically, not to any bet.',
    quote:
      'On QJT monotone, the BB has a substantial equity disadvantage, with only 36% equity. They are also only able to realize 79% of their equity, capturing 28% of the pot and folding, on average, 38.26% of the time against a flop min-bet, looking to x/r 18% and x/c 43%.',
  }),

  'ex2.utg-equity-derived': ref({
    id: 'ex2.utg-equity-derived',
    page: 739,
    locator: 'Derived from the BB figures printed with Diagram 101',
    derivation: 'exact_derived',
    scope:
      'UTG on Q♥J♥T♥ at 40bb. The book prints only the BB’s side: 36% equity and 28% of the pot captured. Heads-up range-vs-range equity and pot share each sum to 100%, so UTG has 64% equity and captures 72% of the pot. Subtraction only — no solver output is being reconstructed.',
    quote: 'the BB has a substantial equity disadvantage, with only 36% equity … capturing 28% of the pot',
  }),

  'ex1.aq3-high-freq-big-size': ref({
    id: 'ex1.aq3-high-freq-big-size',
    page: 684,
    locator: 'Flop Strategy Example 1 — prose accompanying Table 113 (example heading on p.682)',
    derivation: 'exact_transcription',
    scope:
      'BB vs UTG on A♥Q♦3♠ at 40bb — the book’s other HIGH-frequency c-bet example, and the one where the size is big. Cited only as the contrast case; none of its figures describe Q♥J♥T♥.',
    quote:
      'This lack of nutted hands in the BB’s range allows IP to bet big across multiple streets, over-realizing the 72% equity and capturing 85% of the pot.',
  }),

  /* ── Why monotone texture behaves this way (Ch.12 aggregate — labelled) ── */

  'texture.monotone-most-cbet-smallest-size': ref({
    id: 'texture.monotone-most-cbet-smallest-size',
    page: 671,
    locator: 'Section on IP metrics by flop texture — prose accompanying Table 112 and Diagram 52',
    derivation: 'exact_transcription',
    scope:
      'The Ch.12 aggregate over thousands of GTO solutions at 20bb/30bb/40bb with MTT starting ranges (see position.ch12-sim-scope), cut by flop SUIT texture. A category average across all monotone flops — the general mechanism behind Q♥J♥T♥, never a figure for it.',
    quote:
      'Monotone flops are the most c-bet but they also have the lowest EV for IP. On this texture, IP’s strong hand percentage diminishes by a large margin, while the BB’s strong hand percentage increases… This range distribution creates a similar situation as on paired boards, with the BB having a polarized distribution, while IP is more depolarized. For this reason, using smaller bet-sizes is preferred as they will get a lot of folds from the BB’s hands that have terrible equity while not overcommitting with all of IP’s good, but not great hands.',
  }),

  'texture.monotone-betting-big-mistake': ref({
    id: 'texture.monotone-betting-big-mistake',
    page: 672,
    locator: 'Section on IP metrics by flop texture — the author’s note on monotone bet-sizing',
    derivation: 'exact_transcription',
    scope:
      'The author’s own statement of the error this puzzle is built around, general to monotone flops rather than specific to Q♥J♥T♥.',
    quote:
      'I often see players making the mistake of betting large on monotone flops, thinking that they need to protect their good hands and make the BB fold. The problem with that is that if your bet-size is too large, you force the BB to fold the weak hands that would continue against a smaller bet and will be isolating yourself against the top of their range that will either have you beat or have a ton of equity.',
  }),

  'texture.monotone-simplify-min-bet': ref({
    id: 'texture.monotone-simplify-min-bet',
    page: 673,
    locator: 'Section on IP metrics by flop texture — simplification guidance for monotone flops',
    derivation: 'exact_transcription',
    scope:
      'General simplification advice for monotone flops in the Ch.12 20bb/30bb/40bb MTT-range aggregate. Consistent with the Q♥J♥T♥ solve, but stated for the category.',
    quote:
      'We could easily simplify our strategy on monotone flops to use only 1/3-pot bet-sizes or min-bets without suffering a significant EV loss.',
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
    page: 661,
    locator: 'Section on IP c-bet frequency by flop rank — prose accompanying Diagram 44',
    derivation: 'exact_transcription',
    scope:
      'A RANK-category average across ALL Qxx flops in the Ch.12 20bb/30bb/40bb MTT-range aggregate — connected and disconnected, monotone and rainbow, straights possible and not. It is NOT the c-bet frequency for Q♥J♥T♥ and must never be presented as one.',
    quote:
      'Kxx flops are c-bet 88%, Qxx and Txx are c-bet 85% and, as expected, middle and low flops are c-bet at the lowest frequencies, with 6xx being the lowest at only 62%.',
  }),

  'texture.straights-reduce-cbet': ref({
    id: 'texture.straights-reduce-cbet',
    page: 673,
    locator: 'Section on IP c-bet frequency by connectedness — prose accompanying Diagram 54',
    derivation: 'exact_transcription',
    scope:
      'A CONNECTEDNESS cut of the same Ch.12 20bb/30bb/40bb MTT-range aggregate. Q♥J♥T♥ has three flopped straights (AK, K9, 98), so this cut would put it in the 31%-checked group — which contradicts the 85% Qxx cut. Cited to show the aggregates cannot settle this board, never as this board’s figure.',
    quote:
      'Flops with three possible flopped straights are checked 31% of the time, flops with two straights are checked 28%, flops with one straight are checked 17% and flops with zero straights are checked only 10% of the time.',
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
    page: 749,
    locator: 'Section "Turn Play After Flop Check Back (x/x)" — IP Range',
    derivation: 'exact_transcription',
    scope:
      'The general shape of IP’s range on any turn after IP checks back the flop (x/x). A statement about range structure, not a frequency for any board.',
    quote:
      'If IP is checking back a GTO strategy, then their range will have the right board coverage and be fairly balanced on most runouts. Still, IP’s checking back range will be somewhat capped and a lot more depolarized than their c-betting range as they would have c-bet most of their strong hands on the flop.',
  }),

  'xx.oop-range-uncapped': ref({
    id: 'xx.oop-range-uncapped',
    page: 749,
    locator: 'Section "Turn Play After Flop Check Back (x/x)" — OOP Range',
    derivation: 'exact_transcription',
    scope:
      'OOP’s range on any turn after the flop checks through (x/x). Stated CONDITIONALLY — it holds only where OOP has no donk betting range on that flop.',
    quote:
      'If OOP doesn’t have a donk betting range, then they have exactly the same range with which they called the pre-flop raise. This means two things. First, this range is very wide compared to IP’s range, and second, that this range is still uncapped.',
  }),

  'xx.ranges-invert': ref({
    id: 'xx.ranges-invert',
    page: 749,
    locator: 'Section "Turn Play After Flop Check Back (x/x)"',
    derivation: 'exact_transcription',
    scope:
      'The conclusion the book draws from the two range descriptions above, for the x/x line generally — this is the sentence the whole puzzle turns on.',
    quote:
      'The way the ranges are constructed is somewhat reverse of the flop situation, making OOP’s range more polarized than IP’s and IP’s range more condensed than OOP’s. This range distribution generally results in OOP developing a turn betting strategy.',
  }),

  'xx.oop-turn-bet-sizes': ref({
    id: 'xx.oop-turn-bet-sizes',
    page: 751,
    locator: 'Diagram 107 — OOP First Action (x/x/?), Table 126 Turn Decision Point Stats',
    derivation: 'exact_transcription',
    scope:
      'Which bet-sizes exist in the solution at OOP’s first turn action after a check-back, across the book’s four flop strategy examples. It names the sizes; it prints no split between them for any single turn card.',
    quote: 'OOP has three different bet-sizes to choose from: 1.2x-pot, 2/3-pot and 1/3-pot.',
  }),

  'xx.984-condensed-vs-j66': ref({
    id: 'xx.984-condensed-vs-j66',
    page: 752,
    locator: 'Diagram 108 — IP vs Bet (x/x/b/?)',
    derivation: 'exact_transcription',
    scope:
      'BB vs UTG on 9♥8♥4♦ at 40bb in the x/x line, COMPARED with J♠6♥6♦. Every claim here is relative to that other board, not an absolute statement about this one.',
    quote:
      'On 9♥8♥4♦, IP raises a 1/3-pot bet 19% of the time and never raises an OOP overbet on J♠6♥6♦… on 9♥8♥4♦, OOP’s betting frequency and bet-size are smaller than on J♠6♥6♦ because the polarization of the ranges is different in both cases. On 9♥8♥4♦, OOP’s betting range is more condensed and IP has more strong hands, allowing IP to have a raising range.',
  }),

  'xx.984-polarization-advantage': ref({
    id: 'xx.984-polarization-advantage',
    page: 761,
    locator:
      'Diagram 115 — "Flop Strategy 1: Turn Play after Flop Checks Back (x/x)", OOP First Action: BB vs UTG on 9♥8♥4♦ (40bb)',
    derivation: 'exact_transcription',
    scope:
      'BB vs UTG on 9♥8♥4♦ at 40bb, turn, after the flop CHECKED THROUGH. Not the x/b/c line, which the book solves separately from p.765.',
    quote:
      'On 9♥8♥4♦, OOP has the polarization advantage on many turn cards, resulting in a high betting frequency (Diagram 115).',
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
    page: 689,
    locator: 'Table 115: UTG C-betting Range Breakdown on 9♥8♥4♦',
    derivation: 'exact_transcription',
    scope:
      'UTG’s FLOP c-betting strategy on 9♥8♥4♦ at 40bb, read for what it leaves behind: these are per-hand-class check-back frequencies, not slices of one range and not turn figures.',
    quote:
      'Strong hands are bet most of the time. Hands such as AA, top set and middle set get checked back ~8%… Good hands are played passively, with made hands such as middle pairs mostly being checked. Good draws such as combo draws and flush draws are mostly c-bet, while weaker draws such as OESD mostly get checked. Top pair wants to check back 24% of the time.',
  }),

  /* The bucket definitions this puzzle names its hand with are 'eqb.definitions'
   * (p.596), already in the registry — not restated here for the same reason. */

  'preflop.bb-3bet-value-40bb': ref({
    id: 'preflop.bb-3bet-value-40bb',
    page: 395,
    locator: 'Prose describing Hand Ranges 167-174',
    derivation: 'exact_transcription',
    scope:
      'BB vs BN compared with BB vs UTG at 40bb — the composition of the BB’s 3-betting VALUE range, and how it changes when only the opener’s seat changes. States hand CLASSES; never a combo or a per-combo frequency.',
    quote:
      'if we compare the BB 3-betting ranges, it is very clear how the value range shrinks from 99+, ATs+, and AJ+ vs the BN to TT+ and AK vs UTG.',
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
    page: 682,
    locator: 'IP C-bet Examples — Flop Strategy Example 1 (Diagram 58)',
    derivation: 'exact_transcription',
    scope:
      'The book’s own worked example: BB vs UTG, single raised pot, A♥Q♦3♠, 40bb effective — the exact spot this puzzle uses. The author files it under high c-bet % AND big bet-size, which is the whole lesson in the title.',
    quote: 'High c-bet % and big bet-size: BB vs UTG on A♥Q♦3♠ (40bb)',
  }),

  'aq3.simplification-ev': ref({
    id: 'aq3.simplification-ev',
    page: 683,
    locator: 'Prose under Diagram 58 — Flop Strategy Example 1',
    derivation: 'exact_transcription',
    scope:
      'IP’s EV on A♥Q♦3♠ at 40bb vs the BB. Every figure here measures a SIMPLIFICATION applied across IP’s ENTIRE RANGE — 1.07% of the pot and 6.6bb/100 are what the range gives up by standardising on the 1/3-pot size, and are NOT the EV loss of any individual hand. The 14.45% is how often the solver uses an option that earns it nothing.',
    quote:
      'If we give IP the option to use a 120% overbet, the solver will use it 14.45% of the time, although this does not generate any extra EV to IP. On the other hand, simplifying the strategy to c-bet 100% for 1/3-pot bet-size loses 1.07% of the pot, or 6.6bb/100. Simplifying the strategy to c-bet 100% using the 2/3-pot bet-size retains all of IP’s EV.',
  }),

  'aq3.no-nutted-hands': ref({
    id: 'aq3.no-nutted-hands',
    page: 684,
    locator: 'Table 113: UTG C-betting Range Breakdown on A♥Q♦3♠',
    derivation: 'exact_transcription',
    scope:
      'Range-vs-range on A♥Q♦3♠, BB vs UTG at 40bb — the mechanism behind the big bet-size. The 72% and 85% are whole-range figures for UTG on this flop, not per-hand numbers.',
    quote:
      'On A♥Q♦3♠, UTG has all very strong hands, such as AA, QQ and AK, while the BB would 3-bet AA and QQ all the time and AK most of the time. This lack of nutted hands in the BB’s range allows IP to bet big across multiple streets, over-realizing the 72% equity and capturing 85% of the pot.',
  }),

  'aq3.xr-frequency': ref({
    id: 'aq3.xr-frequency',
    page: 684,
    locator: 'Flop Strategy Example 1 — “Facing a Min x/r”',
    derivation: 'exact_transcription',
    scope:
      'Equilibrium check-raise frequency the BB uses against UTG on A♥Q♦3♠ at 40bb. Cited only to answer “won’t betting everything get me raised?” — this puzzle does not play the x/r branch.',
    quote:
      'On this flop, IP has a massive range advantage and, at equilibrium, should only face a flop x/r about 5% of the time.',
  }),

  'aq3.bb-trash-16-equity': ref({
    id: 'aq3.bb-trash-16-equity',
    page: 726,
    locator: 'Ch. “C-bet Defense” — worked MDF counter-example on AQ3r',
    derivation: 'exact_transcription',
    scope:
      'The BB’s range composition on AQ3r vs UTG at 40bb, and the equity of its trash hands against UTG’s range. Same match-up and depth as Flop Strategy Example 1, reached from the defender’s side of the chapter.',
    quote:
      'on a flop such as AQ3r, the BB’s range has 70% trash hands and 10% weak hands. On average, the BB’s trash hands have 16% equity against UTG, but the pot odds laid by UTG’s bet-size are 20%. So even against the 1/3-pot bet-size, calling many of those hands will be -EV.',
  }),

  'aq3.bb-defends-42': ref({
    id: 'aq3.bb-defends-42',
    page: 726,
    locator: 'Ch. “C-bet Defense” — BB’s GTO response to a 1/3-pot c-bet on AQ3r',
    derivation: 'exact_transcription',
    scope:
      'BB vs UTG on AQ3r at 40bb, facing the 1/3-pot c-bet specifically. The 58/42 split is the BB’s whole-range defence against that one size — not against the 2/3-pot size this puzzle answers with.',
    quote:
      'the BB’s GTO defense strategy vs the 1/3-pot bet-size has them folding 58% and defending only 42% of the time, which is nowhere near the 75% MDF. On this flop, the UTG can get away with c-betting their entire range and there is nothing the BB can do to stop them from having a profitable bet with any two cards.',
  }),

  /* ── Chapter-level c-bet facts, aggregated over many flops ───────────── */

  'cbet.axx-96': ref({
    id: 'cbet.axx-96',
    page: 661,
    locator: 'Diagram 44 — flop c-bet frequency by high card',
    derivation: 'exact_transcription',
    scope:
      'An aggregate over ALL Axx flops in the Ch.12 dataset — thousands of GTO solutions at 20bb/30bb/40bb with MTT starting ranges (p.655). It is the frequency for the Axx FAMILY, not a measurement of A♥Q♦3♠, and not the frequency of any one hand.',
    quote:
      'Axx flops are the second most c-bet flops, with a 96% c-bet frequency.',
  }),

  'cbet.check-back-costs': ref({
    id: 'cbet.check-back-costs',
    page: 656,
    locator: 'Table 109: Result of IP Playing 100% Check Back',
    derivation: 'exact_transcription',
    scope:
      'IP’s EV loss from checking back EVERY flop, across the whole Ch.12 dataset (20bb/30bb/40bb, MTT ranges). A statement about the checking strategy in general — not a figure for A♥Q♦3♠ and not the cost of checking one hand once.',
    quote:
      'If IP plays a strategy that always checks back the flop, they will have an EV loss of 26bb/100, so c-betting the flop is of massive importance to IP.',
  }),

  'cbet.size-up-vs-trash': ref({
    id: 'cbet.size-up-vs-trash',
    page: 680,
    locator: 'General IP C-bet Guidelines',
    derivation: 'exact_transcription',
    scope:
      'A general IP c-betting principle the author states for all flops. It is the rule that connects the BB’s 70% trash on this board to the choice of the bigger size.',
    quote:
      'If your opponent has a lot of trash in their range, you should c-bet at a high frequency and expect to get many folds. If they have very few strong hands compared to you, you should size up!',
  }),

  'cbet.default-third-pot': ref({
    id: 'cbet.default-third-pot',
    page: 681,
    locator: 'General IP C-bet Guidelines',
    derivation: 'exact_transcription',
    scope:
      'The author’s fallback advice when a player does not know the flop strategy for their range. It is why 1/3-pot is graded a defensible answer here rather than a blunder — and it is general advice, not a recommendation for A♥Q♦3♠.',
    quote:
      'If you are unsure about the flop strategy with your range, you can default to c-betting 1/3-pot in most short and middle stack situations.',
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
    page: 395,
    locator: 'Prose accompanying Table 61: BB Action Frequencies (40bb)',
    derivation: 'exact_transcription',
    scope:
      'BB defending an IP open at 40bb with MTT ranges. A WHOLE-RANGE folding frequency at each of two openers — it states how much of the range folds, never which hands do.',
    quote:
      'The folding frequency also increases drastically as Villain’s range gets stronger, from 24.2% vs the BN to 45% vs UTG.',
  }),

  'bb40.defend-tighter-vs-ep': ref({
    id: 'bb40.defend-tighter-vs-ep',
    page: 395,
    locator: 'Prose accompanying Table 61: BB Action Frequencies (40bb)',
    derivation: 'exact_transcription',
    scope:
      'The BB’s defence against an early-position opener at 40bb — the source’s own instruction for how the strategy should change, stated as a direction rather than as a hand list.',
    quote:
      'Against a non-all-in polarized range from an early position player, you should defend tighter and should use better hands as bluffs, while keeping your 3-betting frequency low.',
  }),

  'bb40.bluffs-shrink-with-value': ref({
    id: 'bb40.bluffs-shrink-with-value',
    page: 395,
    locator: 'Prose describing Hand Ranges 167-174',
    derivation: 'exact_transcription',
    scope:
      'BB 3-betting ranges at 40bb, BN compared with UTG — why the 3-bet branch narrows at BOTH ends against an early-position opener. Names no replacement bluffs; the book leaves those to the chart images.',
    quote:
      'When the value range shrinks, the bluffing range must also shrink, to the point that bluffs vs BN are made with completely different hands than vs EP',
  }),

  'bb40.no-rejam-vs-ep': ref({
    id: 'bb40.no-rejam-vs-ep',
    page: 395,
    locator: 'Prose accompanying Table 61: BB Action Frequencies (40bb)',
    derivation: 'exact_transcription',
    scope:
      'BB at 40bb — why the all-in re-raise branch shrinks as the opener’s position gets earlier. This is the book’s own explanation for why Hand Range 167 prints an all-in branch (3%) and Hand Range 173 prints none at all.',
    quote:
      'With 40bb, the BB is now too deep to 3-bet all-in against most positions. In fact, the earlier the opener’s position, the less often the BB can rejam all-in due to the lack of pre-flop fold equity vs narrow ranges.',
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
    page: 382,
    locator: 'Hand Range 155: BB vs BN (15bb)',
    derivation: 'exact_transcription',
    scope:
      'BB defending against a BN min-raise at 15bb, 9-max MTT with a 12.5% ante. Whole-range aggregates printed with the chart, not the frequency of any individual hand. Note what is absent: THREE branches are printed, and a non-all-in 3-bet is not one of them.',
    quote: 'BB vs BN (15bb) • All-in 18% / • Call 58.2% / • Fold 23.8%',
  }),

  'depth.15bb-no-non-allin-3bet': ref({
    id: 'depth.15bb-no-non-allin-3bet',
    page: 381,
    locator: 'Section "Defending the BB Versus IP (15bb)" — prose accompanying Table 59',
    derivation: 'exact_transcription',
    scope:
      'BB defending against a min-raise at 15bb, across ALL four in-position openers. The author’s own statement of why every 15bb chart in this section prints no 3-bet branch — the reason is the stack depth, and nothing about any particular hand.',
    quote:
      'With 15bb, the average BB fold vs a min-raise is 22.56%. At this stack depth, the BB is too shallow to have a non-all-in 3-betting range.',
  }),

  'depth.15bb-who-jams': ref({
    id: 'depth.15bb-who-jams',
    page: 381,
    locator: 'Section "Defending the BB Versus IP (15bb)" — composition of the BB’s all-in range',
    derivation: 'exact_transcription',
    scope:
      'BB vs IP at 15bb — which hand CLASSES the solver rejams, and the reason it prefers getting the money in pre-flop with them. It names classes and its own exceptions (AA and KK, and small pairs vs EP); it attaches no frequency to any individual hand.',
    quote:
      'The solver likes going all-in pre-flop at this stack depth with hands that are ahead of the opener’s range but have bad post-flop equity realization and thus perform better by getting the money in pre-flop. Most pocket pairs make great rejamming hands except AA and KK, which get slowplayed vs LP, and the smaller pairs are played using a mixed strategy vs EP.',
  }),

  'depth.bn-response-to-15bb-jam': ref({
    id: 'depth.bn-response-to-15bb-jam',
    page: 516,
    locator: 'Hand Range 267: BN 15bb (2x vs BB All-in)',
    derivation: 'exact_transcription',
    scope:
      'The OPENER’s side of this puzzle’s 15bb node: how a BN who min-raised to 2bb responds when the BB jams 15bb, 9-max MTT with a 12.5% ante. Two things come from here — the fold equity the jam actually generates, and the 2bb open size, which the node’s own label prints.',
    quote: 'BN 15bb (2x vs BB All-in) • Call All-in 42.6% / • Fold 57.4%',
  }),

  'depth.bn-response-to-40bb-3bet': ref({
    id: 'depth.bn-response-to-40bb-3bet',
    page: 548,
    locator: 'Hand Range 297: BN 40bb (2.3x vs BB 3.5x 3-bet)',
    derivation: 'exact_transcription',
    scope:
      'The OPENER’s side of this puzzle’s 40bb node, 9-max MTT with a 12.5% ante. This is the only place the book prints the two bet-sizes of the 40bb BB-vs-BN tree, and it prints them in the node’s own label: the BN opens to 2.3x and the BB’s non-all-in 3-bet is 3.5x. Ch.8’s prose around Hand Range 167 does not restate either size, so the sizes are read from here — the opener’s branch of the same 40bb solution — and never assumed.',
    quote: 'BN 40bb (2.3x vs BB 3.5x 3-bet) • All-in 8.8% / • Call 45.4% / • Fold 45.7%',
  }),

  'depth.only-4bet-is-all-in': ref({
    id: 'depth.only-4bet-is-all-in',
    page: 545,
    locator: 'Prose accompanying Table 85: Action Frequencies by Stack Depth',
    derivation: 'exact_transcription',
    scope:
      'The opener facing a non-all-in 3-bet at 25-40bb, across positions. Cited for what a 40bb 3-bet is risking — the counter-raise it can face has exactly one size — never as a frequency for any seat.',
    quote: 'When facing a non-all-in 3-bet with 25-40bb stacks, the solver’s only 4-bet-size is all-in.',
  }),

  'preflop.rfi-sweet-spot': ref({
    id: 'preflop.rfi-sweet-spot',
    page: 294,
    locator: 'Ch.7 "Playing First In" — section "Bet-sizing"',
    derivation: 'exact_transcription',
    scope:
      'The author’s recommended OPEN-RAISE sizing band for MTT play, and when to prefer a min-raise instead. It is NOT the size printed with any Hand Range chart — those print no size at all. Cited to justify a puzzle’s fixed open-size assumption as reasonable, never as the size a chart was solved at.',
    quote:
      'The sweet spot for RFI bet-size seems to be somewhere between 2bb and 2.5bb from BN to UTG, and 2.5bb to 3.5bb in blind vs blind battles… I recommend min-raising when stack depths are in the rejam region (less than 25bb)',
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
    page: 740,
    locator: 'Table 123: BB Strategy Breakdown vs UTG Min-bet on Q♥J♥T♥',
    derivation: 'exact_transcription',
    scope:
      'The BB’s hand-class breakdown on Q♥J♥T♥ at 40bb facing UTG’s flop MIN-BET. The table itself is printed as an image — every figure this puzzle uses comes from the running-text bullets beneath it, and no per-combo number appears anywhere in that text. Cited to establish where the gap is, never as a number. The 38.26 / 18 / 43 sentence begins on p.739 and completes on this page.',
    quote: 'Table 123: BB Strategy Breakdown vs UTG Min-bet on Q♥J♥T♥',
  }),

  'qjtdef.bottom-pair': ref({
    id: 'qjtdef.bottom-pair',
    page: 741,
    locator: 'Table 123 breakdown — bottom pair bullet',
    derivation: 'exact_transcription',
    scope:
      'BB vs UTG on Q♥J♥T♥ at 40bb facing a MIN-BET. The rule that splits bottom pair by kicker on this board against this size. It is the class A♠T♦ belongs to, and it is stated as a rule rather than a frequency.',
    quote:
      'Weak bottom pairs (T8-T2) are almost always folded. T8 can get x/r a small frequency, and T9 can be x/r half the time. Bottom pair with a higher kicker is always called.',
  }),

  'qjtdef.middle-pair': ref({
    id: 'qjtdef.middle-pair',
    page: 741,
    locator: 'Table 123 breakdown — middle pair bullet',
    derivation: 'exact_transcription',
    scope:
      'BB vs UTG on Q♥J♥T♥ at 40bb facing a MIN-BET. The class one rank above the hero hand, cited to show that the source draws the same kicker line twice rather than once.',
    quote:
      'Weaker middle pair combos can be x/f most of the time and occasionally x/r. J9 and better can also be x/r with some frequency, and any Jx with a higher kicker plays a 100% call strategy.',
  }),

  'qjtdef.top-pair-44': ref({
    id: 'qjtdef.top-pair-44',
    page: 741,
    locator: 'Table 123 breakdown — top pair bullet',
    derivation: 'exact_transcription',
    scope:
      'BB vs UTG on Q♥J♥T♥ at 40bb. An EQUITY figure and a qualitative judgement — the bullet prints no fold, call or raise frequency for top pair, and must not be rendered as one.',
    quote:
      'Top pair averages 44% equity on a board as connected as this one with so many flush, straight, set and two pair combinations. Top pair is simply not a strong hand on this texture.',
  }),

  'qjtdef.flushes-xr': ref({
    id: 'qjtdef.flushes-xr',
    page: 740,
    locator: 'Table 123 breakdown — flush combos bullet',
    derivation: 'exact_transcription',
    scope:
      'BB vs UTG on Q♥J♥T♥ at 40bb facing a MIN-BET — the top of the BB’s check-raising range on a monotone board.',
    quote:
      'Flush combos get x/r most of the time. A-high and K-high flushes get x/r about 1/3 of the time, reverse linearly with the highest kickers being x/r less often than the low kicker. For example, A9s never gets x/r, A5s gets x/r 57% and A2s gets x/r about 88% of the time. Lower flush combos are x/r about 88% of the time.',
  }),

  'qjtdef.straight-flush-slowplay': ref({
    id: 'qjtdef.straight-flush-slowplay',
    page: 740,
    locator: 'Table 123 breakdown — straight flush bullet',
    derivation: 'exact_transcription',
    scope: 'BB vs UTG on Q♥J♥T♥ at 40bb facing a MIN-BET — the nuts, and why they are not the hand that raises.',
    quote:
      'The straight flush makes only a tiny portion of the BB’s range but, when having it, the BB’s EV is more than 3x the size of the pot! … For this reason, Hero will mostly slowplay the nuts.',
  }),

  'qjtdef.made-hands-xr': ref({
    id: 'qjtdef.made-hands-xr',
    page: 741,
    locator: 'Table 123 breakdown — straights, sets and two pair bullets',
    derivation: 'exact_transcription',
    scope:
      'BB vs UTG on Q♥J♥T♥ at 40bb facing a MIN-BET. Check-RAISE frequencies for three classes; what is not raised is not thereby folded, and the bullets say nothing about the fold branch.',
    quote:
      'Straights are rarely x/r unless they have a flush draw, averaging a x/r frequency of 20%. … The BB never has top set. Middle and bottom set are x/r about 22% of the time. … Two pair is x/r about 17%.',
  }),

  'qjtdef.draws-xr-third': ref({
    id: 'qjtdef.draws-xr-third',
    page: 741,
    locator: 'Table 123 breakdown — combo draws and flush draws bullets',
    derivation: 'exact_transcription',
    scope:
      'BB vs UTG on Q♥J♥T♥ at 40bb facing a MIN-BET. Note the second sentence: on a monotone board the same two ranks change class depending on whether they hold a heart, which is why A♠T♦ is not a combo draw.',
    quote:
      'Combo draws are x/r about 1/3 of the time and x/c 2/3. The ones with showdown value such as AT or KJ with a heart are mostly called and the ones without showdown value can be x/r about half the time. … This leaves the flush draw category with mostly weak flush draws such as 76o and 55 type hands. This category gets x/r about 1/3 of the time and called 2/3.',
  }),

  'qjtdef.oesd': ref({
    id: 'qjtdef.oesd',
    page: 741,
    locator: 'Table 123 breakdown — OESD bullet',
    derivation: 'exact_transcription',
    scope:
      'BB vs UTG on Q♥J♥T♥ at 40bb facing a MIN-BET. This is the QJT-monotone rule ONLY. The book’s breakdown for 9♥8♥4♦ says the opposite for the same class — "OESD are x/c every time" (p.744) — which is why this ref must never travel to another board.',
    quote:
      'OESD will only continue if they are drawing to the nut straight. All 9x except 99 are folded 100%, A8o also gets folded 100%, Kx and A9 without a heart can be x/r about half the time and x/c the other half.',
  }),

  'qjtdef.folds': ref({
    id: 'qjtdef.folds',
    page: 741,
    locator: 'Table 123 breakdown — underpairs, gutshots and air bullets',
    derivation: 'exact_transcription',
    scope:
      'BB vs UTG on Q♥J♥T♥ at 40bb facing a MIN-BET — the classes that fold even at this price. The boundary that makes "defend wide" a roster rather than a licence.',
    quote:
      'Underpairs are always folded unless they have a flush draw. … All gutshots are folded unless they have a pair. … Air hands such as 7-high no draw are simply always folded.',
  }),

  'qjtdef.a-high-gutshot': ref({
    id: 'qjtdef.a-high-gutshot',
    page: 741,
    locator: 'Table 123 breakdown — closing observation on the board texture',
    derivation: 'exact_transcription',
    scope:
      'BB vs UTG on Q♥J♥T♥ — a statement about what this board does to every ace-high and king-high holding. A texture fact, not a strategy frequency.',
    quote: 'A-high and K-high hands always have at least a gutshot.',
  }),

  'qjtdef.alpha-mdf': ref({
    id: 'qjtdef.alpha-mdf',
    page: 108,
    locator:
      'Section "Minimum Defense Frequency (MDF)" — the clairvoyance toy game. MDF is named on p.108; the b/(b + p) formula and the name Alpha follow on p.109.',
    derivation: 'exact_transcription',
    scope:
      'The definition of MDF and Alpha, derived in a two-hand toy game. Pure arithmetic of bet size against pot — no board, no range and no equity enters it, which is exactly the limitation p.726 goes on to spell out.',
    quote:
      'This number is known as Minimum Defense Frequency (MDF). … Notice that this result, b/(b + p), is the same as P1’s bluff-to-value ratio. This number is also known as Alpha. It represents how often a bluff has to work for it to break even.',
  }),

  'qjtdef.mdf-ignores-equities': ref({
    id: 'qjtdef.mdf-ignores-equities',
    page: 726,
    locator: 'Ch. "C-bet Defense" — opening warning about MDF',
    derivation: 'exact_transcription',
    scope:
      'The author’s own statement of what MDF is worth as a defence strategy. General to the whole c-bet defence chapter, not tied to any board.',
    quote:
      'Some players like using MDF as pseudo-GTO strategy, but as we have already pointed out, while this number could in some instances serve as a rough guideline, it does not take equities and range distribution into account. Basing your entire strategy on MDF will be highly detrimental.',
  }),

  'qjtdef.min-bet-pot-odds': ref({
    id: 'qjtdef.min-bet-pot-odds',
    page: 726,
    locator: 'Ch. "C-bet Defense" — closing paragraph on bet-size and range composition',
    derivation: 'exact_transcription',
    scope:
      'The book’s general rule for reading a bet-size, stated with the min-bet as its worked case. It is the reason a breakdown is printed per size as well as per board.',
    quote:
      'When facing a bet, it is of vital importance to always consider the Villain’s range that will take that specific line. For example, when facing a min-bet, your pot odds will be amazing, but the Villain will use a different range composition compared to when they bet the size of the pot. This will have an effect on your strategy because your hands will have different equities depending on how the Villain constructs their various betting ranges.',
  }),

  'preflop.sizing-guidelines': ref({
    id: 'preflop.sizing-guidelines',
    page: 175,
    locator: 'Section "General Guidelines for Pre-flop Bet-sizing"',
    derivation: 'exact_transcription',
    scope:
      'GENERAL pre-flop sizing guidance from the strategy chapter. It is NOT the open size used in the 40bb BB-defence simulations — the book prints no size for those. Cited only to disclose, and argue against, a puzzle’s own fixed open-size assumption.',
    quote:
      'The earlier your position, the smaller your bet-sizing should be because the threat of opponents waking up with re-raising hands increases… Using solvers to test pre-flop bet-sizing, I found that for similar bet-sizes, the differences in EV are quite small and even indifferent in many situations.',
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
    page: 695,
    locator: 'Section header, "Flop Strategy Example 6"',
    derivation: 'exact_transcription',
    scope:
      'The exact spot this puzzle plays: BB vs BN, single raised pot, 40bb effective, flop 5♥5♦4♥. The header also states the example’s two conclusions up front — low c-bet frequency and a small size.',
    quote: 'Low c-bet % and small bet-size: BB vs BN on 5♥5♦4♥ (40bbs)',
  }),

  'ex6.depolarized-distribution': ref({
    id: 'ex6.depolarized-distribution',
    page: 696,
    locator: 'Prose accompanying Diagrams 67 and 68',
    derivation: 'exact_transcription',
    scope:
      'The book’s own causal chain for this exact flop, stated about the BN’s WHOLE range: no significant range advantage → smaller sizes preferred; most of the range is good hands → depolarized distribution → low c-bet frequency. Every clause is about the range, not about any one hand.',
    quote:
      'On this flop, the BN doesn’t have a significant range advantage, hence the preference for the smaller bet-sizes. In fact, most of the BN range is made of good hands, giving a depolarized distribution that will result in a low c-bet frequency, as many good and weak hands in the BN’s range will benefit from checking back the flop.',
  }),

  'ex6.bn-eqb-554': ref({
    id: 'ex6.bn-eqb-554',
    page: 696,
    locator: 'Diagram 67: Low c-bet % and Small Bet-size: BB vs BN on 5♥5♦4♥ (40bbs) — "BN EQB" pie',
    derivation: 'exact_transcription',
    scope:
      'The BN’s equity-bucket split on 5♥5♦4♥ at 40bb. These are the chart’s own printed data labels, not a measurement of pie slices. Whole-range percentages — 57% is how much of the range sits in the Good bucket, not how often any hand does anything.',
    quote: 'BN EQB — Strong 10% • Good 57% • Weak 24% • Trash 9%',
  }),

  'ex6.bb-eqb-554': ref({
    id: 'ex6.bb-eqb-554',
    page: 696,
    locator: 'Diagram 67: Low c-bet % and Small Bet-size: BB vs BN on 5♥5♦4♥ (40bbs) — "BB EQB" pie',
    derivation: 'exact_transcription',
    scope:
      'The BB’s equity-bucket split on the same flop, from the same diagram’s printed data labels. Cited only as the other half of the comparison Diagram 67 draws — the two pies are what "no significant range advantage" looks like in numbers.',
    quote: 'BB EQB — Strong 8% • Good 24% • Weak 33% • Trash 35%',
  }),

  'ex6.cbet-by-eqb-554': ref({
    id: 'ex6.cbet-by-eqb-554',
    page: 696,
    locator: 'Diagram 68: IP Cbet Frequency by EQB (5♥5♦4♥, 40bbs)',
    derivation: 'exact_transcription',
    scope:
      'How the BN plays each EQUITY BUCKET on this flop — bucket averages, never a single hand. Only the Bet 1/3, Bet MIN and Check segments carry printed data labels; the Bet 2/3 and Bet 1/2 slivers are drawn without numbers, so the two big sizes are taken from Table 118 (p.697) rather than estimated off the chart. The labelled Good-bucket segments sum to ~55% betting, against the "~59%" the p.697 prose states for the same bucket; both figures are printed and neither is adjusted here.',
    quote:
      'Good: Bet 1/3 31% • Bet MIN 23% • Check 45% || Weak: Bet 1/3 39% • Bet MIN 20% • Check 40% || Trash: Bet 1/3 49% • Bet MIN 20% • Check 28% || Strong: Bet 1/3 41% • Bet MIN 29% • Check 28%',
  }),

  'ex6.table118-gutshot': ref({
    id: 'ex6.table118-gutshot',
    page: 697,
    locator: 'Table 118, "Gutshot" row',
    derivation: 'exact_transcription',
    scope:
      'The GUTSHOT CLASS on 5♥5♦4♥ — every gutshot combo in the BN’s range averaged together, 5.7% of that range. It is not a frequency for one specific holding, and the 58% equity is the class average. Table 118’s caption reads "UTG C-betting Range Breakdown", but the example it belongs to (p.695), Diagram 67’s caption (p.696) and the prose on pp.696 and 698 are all BB vs BN, and p.698 reads the BN’s x/r response off this same table — so it is used here as the BN table, with the caption discrepancy disclosed in the puzzle.',
    quote:
      'Gutshot — % of Range 5.7% • Equity 58% • EV 57% • EQR 98% • C-bet 2/3 0.4% • C-bet 1/2 0.5% • C-bet 1/3 25.2% • C-bet Min 21.3% • Check 52.7%',
  }),

  'ex6.table118-full-range': ref({
    id: 'ex6.table118-full-range',
    page: 697,
    locator: 'Table 118, "Full Range" row',
    derivation: 'exact_transcription',
    scope:
      'The BN’s ENTIRE range on 5♥5♦4♥ at 40bb — the aggregate the phrase "low c-bet frequency" refers to, and the 55% equity that makes "no significant range advantage" a number. Not the frequency of any hand or class. Same caption caveat as the Gutshot row: the table is captioned UTG and belongs to a BB-vs-BN example.',
    quote:
      'Full Range — % of Range 100% • Equity 55% • EV 59% • EQR 107% • C-bet 2/3 0.5% • C-bet 1/2 0.8% • C-bet 1/3 35.3% • C-bet Min 22.8% • Check 40.6%',
  }),

  'ex6.good-hands-gutshots-check': ref({
    id: 'ex6.good-hands-gutshots-check',
    page: 697,
    locator: 'Section "Good hands", in the IP strategy breakdown for 5♥5♦4♥',
    derivation: 'exact_transcription',
    scope:
      'The book’s hand-type notes INSIDE the Good bucket on this flop. This is the only place the source separates gutshots from the rest of the bucket, and the reason this puzzle deals a gutshot rather than a mid pair: the same sentence sends 66-99 the opposite way.',
    quote:
      'Good hands are c-bet ~59% of the time. Mid pairs 66-99 are c-bet almost 100%, OESD gets mostly c-bet, gutshots mostly like to check back and A-high flush draws are c-bet linearly, with the strongest kickers being c-bet more often than the ones with weak kicker.',
  }),

  'ex6.bb-less-polarized-lowers-cbet': ref({
    id: 'ex6.bb-less-polarized-lowers-cbet',
    page: 698,
    locator: 'Section "Facing a 25% Pot x/r"',
    derivation: 'exact_transcription',
    scope:
      'The BB-side half of why the frequency is low on this flop, stated as a contrast with J66r. Cited for the mechanism only — the puzzle’s answer rests on the BN-side depolarization from p.696, not on this sentence.',
    quote:
      'On 5♥5♦4♥, the BB isn’t as polarized as it was on J66r because, on 5♥5♦4♥, many of the BB’s hands that would be trash on J66 now have a flush draw, OESD or some sort of gutshot. This makes the BN c-bet the flop less frequently on 5♥5♦4♥.',
  }),

  'ex6.small-bets-when-depolarized': ref({
    id: 'ex6.small-bets-when-depolarized',
    page: 663,
    locator: 'Section "Flop C-betting by Structure"',
    derivation: 'exact_transcription',
    scope:
      'The GENERAL rule that links range shape to bet-size, stated across the chapter’s whole flop dataset rather than for 5♥5♦4♥ alone. It is the sentence that defines what "this type of depolarized distribution" means in practice — bulk of hands good but not great, few trash and weak — and it names the opposite case too.',
    quote:
      'In general, small bets are preferred when IP’s range has this type of depolarized distribution with the bulk of hands being good, but not great, and a low frequency of trash and weak hands. In situations where IP’s range distribution is more polarized with a bigger proportion of strong, weak and trash hands, bigger bet-sizes are used more often.',
  }),

  'ex6.depolarized-definition': ref({
    id: 'ex6.depolarized-definition',
    page: 78,
    locator: 'Ch. 1, section "Depolarized/Condensed Range"',
    derivation: 'exact_transcription',
    scope:
      'The book’s definition of the word, from the range-morphology section — general, not about any board. Cited so the puzzle explains "depolarized" in the source’s own terms before applying it to this flop.',
    quote:
      'A condensed or depolarized range is the opposite of a polar range. It has the top and bottom hands removed and is comprised of middle equity hands.',
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
    page: 108,
    locator: 'Section "Minimum Defense Frequency (MDF)" — Clairvoyance Toy Game',
    derivation: 'exact_transcription',
    scope:
      'The definition itself, derived inside a two-player toy game on a static board (3♠3♥3♣ 2♦ 2♠) where one player is clairvoyant and no cards are left to come. A definition, not a strategy for any real flop.',
    quote: 'This number is known as Minimum Defense Frequency (MDF).',
  }),

  'mdf.alpha-definition': ref({
    id: 'mdf.alpha-definition',
    page: 109,
    locator: 'Section "Minimum Defense Frequency (MDF)" — Alpha',
    derivation: 'exact_transcription',
    scope:
      'What Alpha is a statement ABOUT: how often a bluff must work to break even, as b/(b + p). Its only inputs are the bet and the pot — no board, no hand and no range enters the expression.',
    quote:
      'Notice that this result, b/(b + p), is the same as P1’s bluff-to-value ratio. This number is also known as Alpha. It represents how often a bluff has to work for it to break even.',
  }),

  'mdf.complement-of-alpha': ref({
    id: 'mdf.complement-of-alpha',
    page: 110,
    locator: 'Section "Minimum Defense Frequency (MDF)" — folding and calling frequencies',
    derivation: 'exact_transcription',
    scope:
      'The arithmetic relationship between Alpha and MDF. True for any bet-size in any spot by construction, which is both its strength and its limit.',
    quote:
      'Since folding frequency and calling frequency are complementary numbers, they should add up to 1. So, if you know one, you can always easily calculate the other.',
  }),

  'sizing.pot-fraction-convention': ref({
    id: 'sizing.pot-fraction-convention',
    page: 135,
    locator: 'Section "Poker Math Everyone Should Know" — introducing Table 14',
    derivation: 'exact_transcription',
    scope:
      'The book’s own convention for reading a bet as a fraction of the pot — the "1/3-pot" notation used throughout.',
    quote:
      'Normalizing the size of the pot to 1 and all bets as a fraction of the pot makes calculations easier. For example, if the pot is $60 and a player bets $20, his bet-size as a fraction of the pot is 1/3-pot or 0.33 pot (Table 14).',
  }),

  'sizing.alpha-worked-example': ref({
    id: 'sizing.alpha-worked-example',
    page: 136,
    locator: 'Table 14: Bet-sizing and Alpha — worked example',
    derivation: 'exact_transcription',
    scope:
      'The book’s worked Alpha example, for a HALF-POT RIVER bet. Cited for the shape of the calculation and for the phrase naming what MDF is built to do — make "zero equity bluffs" indifferent — never as a figure for a 1/3-pot flop bet.',
    quote:
      'Your bet needs to work 33% (Alpha) of the time to instantly profit. Your opponent must defend 67% (1-Alpha) of his range to make your zero equity bluffs indifferent.',
  }),

  'mdf.one-third-pot-is-75': ref({
    id: 'mdf.one-third-pot-is-75',
    page: 726,
    locator: 'Section "C-bet Defense" — MDF applied to a 1/3-pot bet',
    derivation: 'exact_transcription',
    scope:
      'The MDF figure for a 1/3-pot bet, as the book states it for this example. It follows from the bet-size alone: the same 75% would come out on this flop, on any other flop, and against any range whatsoever.',
    quote: 'if UTG bets 1/3-pot then, according to MDF, the BB is supposed to defend 75% of the time.',
  }),

  'mdf.alpha-one-third-derived': ref({
    id: 'mdf.alpha-one-third-derived',
    page: 109,
    locator: 'b/(b + p) from p.109, applied to a 1/3-pot bet',
    derivation: 'exact_derived',
    scope:
      'Alpha for a 1/3-pot bet, from the book’s own formula with the book’s own normalization: 0.33/(0.33 + 1) = 25%, so MDF = 1 − 0.25 = 75%. The derivation is confirmed by the source, which prints that same 75% for a 1/3-pot bet on p.726. Nothing about the board or either range enters the calculation — that is the point being made, not a caveat on it.',
  }),

  'mdf.limits-ev-assumptions': ref({
    id: 'mdf.limits-ev-assumptions',
    page: 602,
    locator: 'Section "Alpha and MDF Revisited"',
    derivation: 'exact_transcription',
    scope:
      'The author’s own statement of the two assumptions built into Alpha and MDF, and why they misfire on a flop. This is the passage that makes "correct arithmetic, wrong question" the book’s position rather than an interpretation of it.',
    quote:
      'They are derived from the EV equation. They assume that the EV of checking back your hand is 0 and that every time you are called and hold a bluff that you lose the pot and your bet. However, on the flop most poker hands will almost always have some equity as even the worst hands can improve on future streets. For this reason, the Alpha and MDF numbers are misleading. In reality, the BB does not have to defend nearly as many hands as MDF suggests…',
  }),

  'mdf.limits-rough-guide': ref({
    id: 'mdf.limits-rough-guide',
    page: 603,
    locator: 'Section "Alpha and MDF Revisited" — closing statement',
    derivation: 'exact_transcription',
    scope:
      'The book’s verdict on MDF’s standing, stated in general rather than for any one board. It is why this puzzle offers no replacement frequency as a rule.',
    quote:
      'Alpha and MDF can be used as a rough guide, but you cannot build your core strategy based solely on them and think it is GTO.',
  }),

  'mdf.aq3r-critique': ref({
    id: 'mdf.aq3r-critique',
    page: 726,
    locator: 'Section "C-bet Defense" — opening paragraph',
    derivation: 'exact_transcription',
    scope:
      'The general claim the AQ3r example exists to demonstrate: which two things MDF leaves out. Stated for c-bet defence as a whole, not for one flop.',
    quote:
      'In no-limit hold’em, c-bet defense is highly susceptible to bet-sizing. Some players like using MDF as pseudo-GTO strategy, but as we have already pointed out, while this number could in some instances serve as a rough guideline, it does not take equities and range distribution into account. Basing your entire strategy on MDF will be highly detrimental.',
  }),

  'mdf.aq3r-raising-worse': ref({
    id: 'mdf.aq3r-raising-worse',
    page: 726,
    locator: 'Section "C-bet Defense" — the AQ3r example',
    derivation: 'exact_transcription',
    scope:
      'Why the aggressive route out of an unprofitable call is worse rather than better, in this BB vs UTG 40bb spot on AQ3r. No raise SIZE is printed for this node anywhere on the page.',
    quote:
      'Raising would be even worse, as that puts even more money into the pot vs a strong range that will not fold enough to make the bluff profitable.',
  }),

  'mdf.aq3r-fold-these-hands': ref({
    id: 'mdf.aq3r-fold-these-hands',
    page: 726,
    locator: 'Section "C-bet Defense" — the AQ3r example, hand-level instruction',
    derivation: 'exact_transcription',
    scope:
      'The book’s instruction for this spot, naming hand types by class rather than by combo. "96s with a BDFD" is one of the three examples it prints, which is why it is the hand this puzzle deals. The 10-20% equity band is stated for those classes; it is not a figure for one specific combo.',
    quote:
      'So, if you are holding something like a 96s with a BDFD, a weak king-high or a small pocket pair and have about 10-20% equity, you should simply fold even if the Villain is betting ATC.',
  }),

  'mdf.aq3r-fold-is-zero-ev': ref({
    id: 'mdf.aq3r-fold-is-zero-ev',
    page: 726,
    locator: 'Section "C-bet Defense" — the AQ3r example, closing rule',
    derivation: 'exact_transcription',
    scope:
      'The comparison rule that settles the hand once both other actions are -EV. Stated generally, inside this example.',
    quote:
      'Your goal is not to try to win every hand you play, but to play each hand in the most profitable way. If calling and raising are -EV plays, then folding, which is always 0 EV, will be the highest EV play.',
  }),

  'mdf.aq3r-other-flops-exist': ref({
    id: 'mdf.aq3r-other-flops-exist',
    page: 726,
    locator: 'Section "C-bet Defense" — the AQ3r example, after the fold instruction',
    derivation: 'exact_transcription',
    scope:
      'What the book says folding here does and does not cost you. Written about this flop, but the argument is about the whole distribution of flops behind a profitable pre-flop call.',
    quote:
      'Your pre-flop call was profitable and there will be other flops where your range will be much stronger and you will either connect a strong hand, have a better bluffing opportunity, or your opponent will simply check back more often, allowing you to realize more equity.',
  }),

  'guideline.trash-heavy-range-folds': ref({
    id: 'guideline.trash-heavy-range-folds',
    page: 735,
    locator: 'Section "General BB C-bet Defense Guidelines"',
    derivation: 'exact_transcription',
    scope:
      'A general BB c-bet defence guideline from the same chapter, stated across boards rather than for AQ3r — the rule the AQ3r example is one instance of. Note that it names MDF explicitly as the thing to override.',
    quote:
      'If your range has a lot of trash hands, you should fold a lot of it vs a c-bet, regardless of your opponent’s bet-size and the MDF.',
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
    page: 779,
    locator: 'Ch.14 "GTO River Strategies" — the river’s unique characteristics',
    derivation: 'exact_transcription',
    scope:
      'A property of every river in poker, not of any board. It is why a river hand can be sorted into "beats their bluffs" or "loses to their value" with no third category.',
    quote:
      'On the river there are no more cards to come, so the values of the hands are fixed. There are no draws, resulting in each hand having either 100% or 0% equity vs another hand.',
  }),

  'ch14.hand-vs-range-equity': ref({
    id: 'ch14.hand-vs-range-equity',
    page: 779,
    locator: 'Ch.14 "GTO River Strategies" — the river’s unique characteristics',
    derivation: 'exact_transcription',
    scope:
      'The definition of hand-vs-range equity on a river. General arithmetic — it converts a range composition into an equity, and asserts nothing about what any particular Villain holds.',
    quote:
      'The hand vs range equity is simply the fraction of the opponent’s range the hand beats plus half of the hands it ties with, if there are any. For example, if a hand has 50% equity vs the Villain’s range, that means it is ahead of 50% of the Villain’s range and behind against the other half.',
  }),

  'ch14.linear-ordering': ref({
    id: 'ch14.linear-ordering',
    page: 779,
    locator: 'Ch.14 "GTO River Strategies" — the river’s unique characteristics',
    derivation: 'exact_transcription',
    scope:
      'General property of river hand strength. Cited for the ordering of hands only — it says nothing about which of them a given player calls with.',
    quote:
      'There is a linear ordering of hands in terms of strength that is history independent. This means that the ranking of all possible river hands from strongest to weakest is the same no matter how they got there.',
  }),

  'ch14.structure-not-history': ref({
    id: 'ch14.structure-not-history',
    page: 781,
    locator: 'Ch.14 — prose following Table 151 (Hypothetical Blocker Relationship Matrix)',
    derivation: 'exact_transcription',
    scope:
      'The chapter’s central claim of equivalence between river situations. It is what makes an abstract model transferable to a real board at all — and, read the other way, it is why the board itself carries no information the structure does not already carry.',
    quote:
      'It doesn’t matter how the players got to the specific river situation. As long as they arrive to the overall same structure, the GTO strategy pair in that situation will be equivalent.',
  }),

  'ch14.nuts-identity-irrelevant': ref({
    id: 'ch14.nuts-identity-irrelevant',
    page: 782,
    locator: 'Ch.14 — prose following Table 152 (Ranges Composition: Polar vs Bluff-catcher)',
    derivation: 'exact_transcription',
    scope:
      'The polar-vs-bluff-catcher model specifically: what does and does not define it. Cited to establish that the identity of the nuts — flush, straight, full house — is not an input to the model.',
    quote:
      'It doesn’t really matter if the nuts are a full house, flush, straight or any combination of those hands. The only important thing would be the overall ranges composition where one player’s range is 50% nuts and 50% air, and the other player’s range consists of 100% bluff-catchers.',
  }),

  'ch14.abstract-models-are-heuristics': ref({
    id: 'ch14.abstract-models-are-heuristics',
    page: 782,
    locator: 'Ch.14, section heading "River Abstract Models"',
    derivation: 'exact_transcription',
    scope:
      'The author’s own statement of what Chapter 14 produces: heuristics generated from abstract models, not solved strategies for real boards. This is the boundary a river puzzle has to respect.',
    quote:
      'In this section, we will look at several river abstract models, compute them in a GTO solver and generate heuristics on how to approach the most typical river situations players can expect to face.',
  }),

  'ch14.bluffcatcher-calls-1-alpha': ref({
    id: 'ch14.bluffcatcher-calls-1-alpha',
    page: 784,
    locator: 'Ch.14, section "Perfectly Polarized vs Bluff-catcher" — prose with Table 154',
    derivation: 'exact_transcription',
    scope:
      'The equilibrium strategy pair in the perfectly polarized (nuts/air) vs bluff-catcher model, played on the chapter’s abstract board 2♠2♣2♥2♦3♣ (p.783). Not a solution for any real board: the hands named (KK-QQ, 77-66, JJ-88) are the model’s labels for nuts, air and bluff-catchers, not actual holdings.',
    quote:
      'The effective stack size does not affect the general strategy. In this set-up, the polarized player’s EV increases with bet-size, and so their equilibrium strategy is to always go all-in with nut hands (KK-QQ) and bluff the air hands (77-66) with an Alpha frequency. Position also doesn’t matter. P2 will never bet, and their strategy when facing a bet is to call 1-Alpha of the time with all hands (JJ-88)',
  }),

  'ch14.bluffcatcher-never-bets': ref({
    id: 'ch14.bluffcatcher-never-bets',
    page: 789,
    locator: 'Ch.14, section "P1’s Range is Polarized but Has More Air Than Nuts" — prose with Table 158',
    derivation: 'exact_transcription',
    scope:
      'The same abstract model with the polar player weighted toward air. Cited for one thing only: why the bluff-catching player never takes the betting or raising line, whatever the exact weights turn out to be.',
    quote:
      'P2 has P1 beat 90% of the time, but their equilibrium strategy is still to always check. P2 cannot bet because P1’s range is polarized. P1 knows when they have the best hand and can choose to only call when this is the case.',
  }),

  'ch14.no-blockers-irrelevant': ref({
    id: 'ch14.no-blockers-irrelevant',
    page: 809,
    locator: 'Ch.14, section "River Calling Strategies" — Blockers, closing bullet',
    derivation: 'exact_transcription',
    scope:
      'The fourth case of the general river blocker rule — a bluff-catcher that blocks neither side. A general heuristic, not a board solution.',
    quote: 'When you have no blockers, it is irrelevant, or slightly negative.',
  }),

  'ch14.value-range-starting-point': ref({
    id: 'ch14.value-range-starting-point',
    page: 809,
    locator: 'Ch.14, section "River Call Decision Points"',
    derivation: 'exact_transcription',
    scope:
      'General river calling heuristics. The second bullet carries the condition that decides whether a 1-Alpha defence applies at all: it is contingent on the Villain actually having bluffs.',
    quote:
      'Use their value range as a starting point. Even against very tight players, always call hands in their value range. Never call with bluff-catchers if the Villain doesn’t have enough bluffs. If there is a lot of air in the Villain’s range, they will be more likely to be bluffing.',
  }),

  'alpha.mdf-definition': ref({
    id: 'alpha.mdf-definition',
    page: 108,
    locator: 'Ch.2, Clairvoyance Toy Game — the MDF derivation',
    derivation: 'exact_transcription',
    scope:
      'The definition of MDF, derived from the EV equation in the two-hand clairvoyance game. Pure arithmetic; the 50% belongs to that game’s pot-size bet and to no other spot.',
    quote:
      'This number is known as Minimum Defense Frequency (MDF). P2 has to call 50% of the time with KK to make P1 indifferent to bluffing or checking with QQ.',
  }),

  'alpha.formula': ref({
    id: 'alpha.formula',
    page: 109,
    locator: 'Ch.2, Clairvoyance Toy Game — the Alpha derivation',
    derivation: 'exact_transcription',
    scope:
      'The definition of Alpha and the formula b/(b + p). Arithmetic that holds for any bet and any pot — this is the one quantity in a river puzzle that may legitimately be computed rather than quoted.',
    quote:
      'Notice that this result, b/(b + p), is the same as P1’s bluff-to-value ratio. This number is also known as Alpha. It represents how often a bluff has to work for it to break even.',
  }),

  'alpha.half-pot-river-example': ref({
    id: 'alpha.half-pot-river-example',
    page: 136,
    locator: 'Ch.2, "Poker Math Everyone Should Know" — worked example under Table 14: Bet-sizing and Alpha',
    derivation: 'exact_transcription',
    scope:
      'The book’s own worked case of a half-pot river bet made with a polarized range. It fixes every number this puzzle needs at that size — the price laid, the value-to-bluff ratio, Alpha and 1-Alpha — and it is arithmetic about a bet-size, not a solution for a board.',
    quote:
      'If you bet half-pot with a polarized range on the river, you are giving your opponent 25% odds to call (3-to-1). Your range should have 75% value-bets and 25% bluffs (3-to-1). Your bet needs to work 33% (Alpha) of the time to instantly profit. Your opponent must defend 67% (1-Alpha) of his range to make your zero equity bluffs indifferent.',
  }),

  'alpha.river-relevance': ref({
    id: 'alpha.river-relevance',
    page: 603,
    locator: 'Ch.11, section "Alpha and MDF Revisited"',
    derivation: 'exact_transcription',
    scope:
      'The author’s own limit on how far Alpha and MDF can be pushed, together with his statement of the one street where they are at their most reliable. Cited both to justify using Alpha here and to cap what it is allowed to prove.',
    quote:
      'These numbers become more relevant on the river when there are no more cards to come and you know if your hand has some equity in the pot or not… Alpha and MDF can be used as a rough guide, but you cannot build your core strategy based solely on them and think it is GTO.',
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
    page: 625,
    locator: 'Ch.12, opening of the flop classification scheme',
    derivation: 'exact_transcription',
    scope:
      'The author’s stated reason for classifying flops at all. A statement about method, independent of any matchup, position or stack depth.',
    quote:
      'Classification is the process of grouping things based on their similarities to make them easier to identify or study. Flops that share common characteristics tend to be played in a similar fashion.',
  }),

  'bands.flop-rank': ref({
    id: 'bands.flop-rank',
    page: 626,
    locator: 'Section "Flop Rank" (Table 97)',
    derivation: 'exact_transcription',
    scope:
      'Definition of a flop’s rank. A property of the three cards alone — no simulation, position or stack depth involved.',
    quote:
      'The flop rank will depend on its highest card. For example, Kxx represents all flops that contain a king and two other cards that are a king or lower.',
  }),

  'bands.flop-textures': ref({
    id: 'bands.flop-textures',
    page: 626,
    locator: 'Section "Flop Textures"',
    derivation: 'exact_transcription',
    scope:
      'Definitions of the three flop textures. A property of the three cards alone — no simulation, position or stack depth involved.',
    quote:
      'Monotone: A monotone flop is a flop that contains all cards of a single suit, for example A♥K♥T♥ or J♠6♠5♠… Two-tone: A two-tone flop is a flop that contains two cards of a single suit and a third card of another suit… Rainbow: A rainbow flop is a flop that contains all three cards of different suits, for example Q♥9♠7♦, 6♦4♣2♠ or K♣J♦7♥.',
  }),

  'bands.straight-count': ref({
    id: 'bands.straight-count',
    page: 627,
    locator: 'Section "Flopped Straights" (Table 98)',
    derivation: 'exact_transcription',
    scope:
      'How the book counts the straights a flop makes, given as four worked boards. A property of the three cards alone. Note that a flopped straight uses all three board cards plus two hole cards.',
    quote:
      'For example, on the flop AQ7 there are zero possible flopped straights. On KT9 there is one possible flopped straight (with QJ). On 875 there are two possible flopped straights (96 and 64). Finally, on JT9 there are three possible flopped straights (KQ, Q8 and 87).',
  }),

  'bands.rank-letters': ref({
    id: 'bands.rank-letters',
    page: 628,
    locator: 'Section "Flop Families" (Table 99)',
    derivation: 'exact_transcription',
    scope:
      'The rank-letter vocabulary that the donk-bet subfamily lists (8MM, 7ML, 6LL, ALL…) are written in. A naming scheme for cards, not a strategy claim.',
    quote:
      'High Card (H): Any card K, Q, J, T. Mid Card (M): Any card 9, 8, 7, 6. Low Card (L): Any card 5, 4, 3, 2. Ace (A): The lonely A',
  }),

  'bands.distinct-flops': ref({
    id: 'bands.distinct-flops',
    page: 629,
    locator: 'Section "Flop Subsets"',
    derivation: 'exact_transcription',
    scope:
      'The size of the problem the bands are dividing up: how many strategically distinct flops exist in hold’em. A counting fact about the game.',
    quote:
      'there are 22,100 possible flops in hold’em and, using suit isomorphism, we can reduce that number to 1,755 strategically different flops.',
  }),

  'bands.dataset': ref({
    id: 'bands.dataset',
    page: 631,
    locator: 'Ch.12, "The Flop Donk Bet (DK)" — statement of the dataset',
    derivation: 'exact_transcription',
    scope:
      'The dataset behind EVERY donk-bet band figure in this chapter, stated by the author: BB vs BN and BB vs UTG, single raised pots, 20bb/30bb/40bb, aggregated across all possible flops. Not a single-position solve and not a single-depth one.',
    quote:
      'I aggregated the data of GTO solutions across all possible flops in BB vs BN and BB vs UTG situations in single raised pots with stack depths 20bb, 30bb and 40bb. The BN and UTG were used because they represent the widest and tightest ranges, while strategies from other positions will fall somewhere in between.',
  }),

  'bands.effect-not-cause': ref({
    id: 'bands.effect-not-cause',
    page: 635,
    locator: 'Prose introducing Table 102: BB Stats by Donk Bet Frequency',
    derivation: 'exact_transcription',
    scope:
      'The author’s own warning about how to read the bands — the direction of causation between range distribution and donk frequency. Applies to all four bands.',
    quote:
      'it is important to understand that the high donk betting frequencies are an effect and not a cause. As we will see in this section, the main cause of the BB having higher equity and EV on some flops is the way the ranges are distributed which in turn results in higher donk betting frequencies.',
  }),

  /* ── The no-donk band, and A76r as its worked example ────────────────── */

  'bands.a76r-buckets': ref({
    id: 'bands.a76r-buckets',
    page: 634,
    locator: 'Diagram 25: Average BB vs IP Equity Buckets for 20bb/30bb/40bb Stacks',
    derivation: 'exact_transcription',
    scope:
      'BB vs IP equity buckets on A76r, averaged over 20bb/30bb/40bb stacks. The chapter’s worked example of a flop the BB must not lead.',
    quote:
      'on A76r, the BB has 8% strong hands and IP has a staggering 31% strong hands! What happens is that, on A76r, IP’s top pairs (any Ax) have on average 85% equity vs the BB’s range, while a top pair on 654 will average about 65% equity.',
  }),

  'bands.a76r-check-100': ref({
    id: 'bands.a76r-check-100',
    page: 635,
    locator: 'Prose accompanying Table 101: A76r BB vs BN 30bb Stats for Different BB Strategies',
    derivation: 'exact_transcription',
    scope:
      'BB vs BN on A76r at 30bb — the chapter’s conclusion for this specific flop, reached by testing each way the BB could split its range and finding all of them worse.',
    quote:
      'A76r is so good for IP that they get to c-bet 100% of their range and not worry about being x/r too often… If the BB starts to include many bluffs in the leading range, then IP would start calling wider and frequently raising the donk bets. If the BB tries a strategy of leading only with weak hands, the result is even worse as now IP will be able to raise 100% of the time… For this reason, it works better for OOP to not split their range and simply check 100% on A76r.',
  }),

  'bands.a76r-locked-strategy': ref({
    id: 'bands.a76r-locked-strategy',
    page: 635,
    locator: 'Table 101: A76r BB vs BN 30bb Stats for Different BB Strategies',
    derivation: 'exact_transcription',
    scope:
      'BB vs BN on A76r at 30bb — the GTO solution compared against a locked strategy that forces the BB to lead top pair or better. An EV comparison, not a donk-bet frequency.',
    quote:
      'If we force the BB to donk every time they have top pair or better (10%), their total EV reduces from 25 to 13, as this strategy is highly exploitable… This makes their EV after checking decline to 5.6.',
  }),

  'bands.none-metrics': ref({
    id: 'bands.none-metrics',
    page: 648,
    locator: 'Section "No Donk Bet Flops (0%-10%)"',
    derivation: 'exact_transcription',
    scope:
      'Averages across the WHOLE no-donk group — the vast majority of the 1,755 distinct flops — from the BB vs BN and BB vs UTG 20-40bb aggregate. Not the frequency of any single flop in the group.',
    quote:
      'The vast majority of flops belong to this category. Pretty much all flops that were not included in any of the other groups… In general, this group of flops are bad for the BB, providing an average of 39% equity and low EQR of 76%, for an average EV of 30% of the pot. On these boards, IP’s range is so strong that OOP is forced to check with a high frequency, for an average donk bet frequency of about 1%.',
  }),

  /* ── The mid band (25-50%) ───────────────────────────────────────────── */

  'bands.mid-flops': ref({
    id: 'bands.mid-flops',
    page: 642,
    locator: 'Section "Mid Donk Bet Frequency Flops (25%-50%)" (Diagram 29)',
    derivation: 'exact_transcription',
    scope:
      'The ~100 flops donked 25-50% of the time in the BB vs BN and BB vs UTG 20-40bb aggregate. Names three paired flops and ONE monotone flop individually; everything else is given only as a subfamily.',
    quote:
      'There are about 100 Flops that get donk bet 25-50% of the time. The main examples of flops that can generally be donk bet 25-50% of the time are: unpaired subfamilies 8MM, 8ML, 8LL, 7ML, 7LL, 6LL, and 5LL with one to three possible flopped straights. The only monotone flop is 764, and the paired flops are 766, 755, 655.',
  }),

  'bands.mid-frequency': ref({
    id: 'bands.mid-frequency',
    page: 643,
    locator: 'Prose accompanying Diagram 29',
    derivation: 'exact_transcription',
    scope:
      'The mid band’s average donk frequency across the whole band, given separately for the two openers. Not the frequency of any individual flop in it.',
    quote:
      'Donk betting happens with the same frequency against UTG and the BN, roughly 35% of the time and checking happens 65% of the time, as the equity distribution doesn’t change too much in either case.',
  }),

  'bands.mid-equity': ref({
    id: 'bands.mid-equity',
    page: 644,
    locator: 'Diagram 30: EQB on Mid Donk Bet Frequency Flops',
    derivation: 'exact_transcription',
    scope: 'Average equity and range shape across ALL mid-band flops — not any one of them.',
    quote:
      'On the mid donk bet flops, equities run very close. IP has a slight equity advantage, 52% compared to the BB’s 48%. However, the BB’s range is more polarized with the bulk of the range being strong, good and trash hands, while IP still has a lot of weak hands that benefit from playing passively and seeing free cards in order to realize equity.',
  }),

  'bands.mid-strategy': ref({
    id: 'bands.mid-strategy',
    page: 644,
    locator: 'Diagram 31 — mid-band donking strategy at 30-40bb',
    derivation: 'exact_transcription',
    scope:
      'How the mid band’s betting range is built at 30-40bb, stated by comparison with the high band. A band-wide description, not a per-flop strategy.',
    quote:
      'With 30-40bb, strong hands prefer using the bigger bet-size on paired boards and a smaller size on unpaired boards. Hands are bet linearly according to their equity with the highest equity hands being bet more often than low equity hands. The structure of the betting ranges is similar to what we saw previously in the High Donk Bet frequency flops, betting the same type of hands, but doing so with a lower frequency, checking everything more often so the checking range is more protected.',
  }),

  'bands.mid-20bb': ref({
    id: 'bands.mid-20bb',
    page: 645,
    locator: 'Diagram 32 — mid-band donking strategy at 20bb',
    derivation: 'exact_transcription',
    scope: 'The mid band at 20bb specifically, where the strategy differs from the 30-40bb case above.',
    quote:
      'With 20bbs, the donking strategy is extremely polarized, betting mostly strong, good and trash hands. For this reason, a bigger bet-size is preferred, with the smaller size being used in the opposite way, mostly with weak hands, but also with some frequency of strong, good and trash hands in order to make the strategy well balanced.',
  }),

  /* ── The low band (10-25%) ───────────────────────────────────────────── */

  'bands.low-flops': ref({
    id: 'bands.low-flops',
    page: 645,
    locator: 'Section "Low Donk Bet Frequency Flops (10%-25%)" (Diagram 33)',
    derivation: 'exact_transcription',
    scope:
      'The ~181 flops donked 10-25% of the time. Given ONLY as subfamilies — no individual flop is named anywhere in this band, and seven of its unpaired subfamilies also appear in the mid band’s list.',
    quote:
      'Approximately 181 distinct flops get donk bet with 10% to 25% frequency… The unpaired donked flops subfamilies are: ALL, 9MM, 8MM, 8ML, 8LL, 7ML, 7LL, 6LL, 5LL, and 4LL. The paired families are: 99A, 88A, 77H, 77M, 77L, 66A, 66H, 66M, 66L, 55A, 55H, 55M, 55L, 44H, 44M, 44L, 33M',
  }),

  'bands.low-frequency': ref({
    id: 'bands.low-frequency',
    page: 645,
    locator: 'Section "Low Donk Bet Frequency Flops (10%-25%)"',
    derivation: 'exact_transcription',
    scope:
      'The low band’s preferred bet-size and its average donk frequency against each opener, across the whole band. Not the frequency of any individual flop in it.',
    quote:
      'In this situation the 67%-pot size bet is preferred (9%) over the 25%-pot size bet (7%). The BB donks slightly more frequently against the BN (16%) than against UTG (14%).',
  }),

  'bands.low-equity': ref({
    id: 'bands.low-equity',
    page: 646,
    locator: 'Diagram 34: EQB on Low Donk Bet Frequency Flops',
    derivation: 'exact_transcription',
    scope: 'Average equity, equity realization and range shape across ALL low-band flops — not any one of them.',
    quote:
      'In low donk bet frequency flops, IP’s range dominance is clear. OOP’s equity drops to 45% and under-realizes by 6%, capturing only 43% of the pot. The number of OOP trash hands finally outweighs the number of weak hands.',
  }),

  'bands.low-polarity': ref({
    id: 'bands.low-polarity',
    page: 647,
    locator: 'Prose accompanying Diagrams 35-36',
    derivation: 'exact_transcription',
    scope:
      'Why the low band prefers a larger size, and its stability across stack depths. A band-wide statement covering 20bb, 30bb and 40bb.',
    quote:
      'On low frequency donk bet flops, the donk betting ranges are a little more polarized and, for this reason, a larger bet-size is preferred. Donk betting does not seem to be too affected by stack depth and so the frequencies are similar with 20bb, 30bb and 40bb effective stacks.',
  }),

  'bands.study-your-own-runouts': ref({
    id: 'bands.study-your-own-runouts',
    page: 649,
    locator: 'Closing recommendation of the donk-bet section (Diagram 37)',
    derivation: 'exact_transcription',
    scope:
      'The author’s own statement of where this chapter’s analysis stops — the reason a band puzzle has no turn or river to play.',
    quote:
      'Flop families that have similar structures and textures tend to be played in a similar fashion. So if you want to dig deeper into donk betting range composition, I recommend running sample flops from each donk bet frequency group in a GTO solver to familiarize yourself with the different spots, how to react to flop raises and how to follow through on future streets.',
  }),
}

export function source(id: string): SourceRef {
  const found = SOURCES[id]
  if (!found) throw new Error(`Unknown source id: "${id}". Add it to lib/puzzles/interactive/sources.ts.`)
  return found
}

/** One line of attribution. Mirrors `citation()` in lib/tools/handAnalysis/rangeSource.ts. */
export function citation(ref: SourceRef): string {
  return `${ref.locator} — ${ref.work}, p.${ref.page}.`
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
