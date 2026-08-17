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
    scope: 'BB vs IP at 25bb, the nearest shorter depth to this puzzle’s 30bb. Composition of the non-all-in 3-betting range.',
    quote:
      'The non-all-in 3-betting range is polarized, made of JJ+, the strongest Axs, some of the best premium suited connectors, and a small frequency of offsuit hands with a blocker',
  }),

  'preflop.bb-vs-bn-25bb-chart': ref({
    id: 'preflop.bb-vs-bn-25bb-chart',
    page: 387,
    locator: 'Hand Range 159: BB vs BN (25bb)',
    derivation: 'exact_transcription',
    scope: 'BB vs BN at 25bb — one of the two printed per-hand charts that bracket this puzzle’s 30bb depth.',
    quote: 'BB vs BN (25bb) • All-in 11.4% / • 3-bet 8.2% / • Call 65.9% / • Fold 14.6%',
  }),

  'preflop.bb-vs-bn-40bb-chart': ref({
    id: 'preflop.bb-vs-bn-40bb-chart',
    page: 396,
    locator: 'Hand Range 167: BB vs BN (40bb)',
    derivation: 'exact_transcription',
    scope: 'BB vs BN at 40bb — the other printed per-hand chart bracketing this puzzle’s 30bb depth.',
    quote: 'BB vs BN (40bb) • All-in 3% / • 3-bet 14.1% / • Call 58.6% / • Fold 24.2%',
  }),

  'preflop.bb-3bet-value-40bb': ref({
    id: 'preflop.bb-3bet-value-40bb',
    page: 396,
    locator: 'Prose describing Hand Ranges 167-174',
    derivation: 'exact_transcription',
    scope: 'BB vs BN at 40bb — the composition of the BB’s 3-betting VALUE range.',
    quote:
      'if we compare the BB 3-betting ranges, it is very clear how the value range shrinks from 99+, ATs+, and AJ+ vs the BN to TT+ and AK vs UTG.',
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
