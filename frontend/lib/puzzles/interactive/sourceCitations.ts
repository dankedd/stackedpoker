/**
 * Where each entry in ./sources.ts comes from: work, page, the table/diagram
 * locator and, where it pins the claim down, the source's verbatim wording.
 *
 * TEST AND AUDIT ONLY. Nothing the site renders may import this file: the
 * site never names the source, and the build fails if it ships
 * (scripts/check-no-source-refs.mjs). __tests__/puzzleContent.test.ts checks
 * that every source id has an entry here and that no app module imports it.
 *
 * PAGE NUMBERS are taken from the page markers in docs/mpt_fulltext.txt, using
 * the convention cross-validated in lib/learn/bbDefenseComplete.ts.
 */

export interface SourceCitation {
  /** Bibliographic work. */
  work: string
  page: number
  /** Table/Diagram/section identifier as the source prints it. */
  locator: string
  /** Verbatim source wording, where a short quote pins the claim down better than a paraphrase. */
  quote?: string
}

const WORK = 'Modern Poker Theory (Acevedo, 2019)'

export const SOURCE_CITATIONS: Record<string, SourceCitation> = {
  'donk.definition': {
    work: WORK,
    page: 631,
    locator: 'Ch. "The Flop Donk Bet (DK)"',
    quote:
      'When the player in the BB doesn’t check and instead takes the lead by making a bet, the poker regulars would call this a donk bet, because it’s a bet that goes against the norm.',
  },
  'donk.baseline-frequencies': {
    work: WORK,
    page: 632,
    locator: 'Table 100: BB and IP stats (20bb/30bb/40bb)',
    quote:
      'The results show that the overall BB donk bet frequency is only 2% (for 1/4 and 2/3 bet-sizes) and the average IP c-betting frequency is 84%.',
  },
  'donk.654r-is-highest': {
    work: WORK,
    page: 632,
    locator: 'Table 100: BB and IP stats (20bb/30bb/40bb)',
    quote:
      'On average, the highest frequency donk betting flop is 654r (67%), and one of the lowest donk betting flops is A76r (0.3%).',
  },
  'preflop.bn-open-bb-call-30bb': {
    work: WORK,
    page: 651,
    locator: 'Section "The Power of Position" — setup for Table 105',
    quote:
      'Hero is on the BN and opens a standard GTO 49% opening range and the action folds to the Villain in the BB who calls with a standard 64% GTO range.',
  },
  'eq.654r-vs-a76r': {
    work: WORK,
    page: 633,
    locator: 'Prose accompanying Table 100',
    quote:
      'on 654r, the BB has the equity advantage with 51% equity vs IP’s 49%, making the BB’s bets more profitable on this flop texture.',
  },
  'buckets.654r': {
    work: WORK,
    page: 634,
    locator: 'Diagram 25: Average BB vs IP Equity Buckets for 20bb/30bb/40bb Stacks',
    quote:
      'On 654r, the BB has 7% strong hands, and IP has only 4% … On 654r, the BB’s good hands increase from 17% to 40% and the trash hands reduce from 49% to 18% when compared to A76r.',
  },
  'buckets.654r-ax-devalued': {
    work: WORK,
    page: 634,
    locator: 'Prose accompanying Diagram 25',
    quote:
      'on 654r, all of IP’s Ax will have an average of 49% equity, effectively turning them into weak hands.',
  },
  'donk.654r-denies-eqr': {
    work: WORK,
    page: 634,
    locator: 'Prose accompanying Diagram 25',
    quote:
      'The BB reacts to this by donk betting many hands, forcing IP to either fold or put more money into the pot with the hands that would have been happy to check behind and see a free turn. Donk betting makes sense on 654r because it denies IP EQR, and also helps BB realize equity by leveraging the informational advantage of leading out with a well-balanced range that cannot be easily attacked by IP.',
  },
  'donk.654r-ip-raise-frequency': {
    work: WORK,
    page: 634,
    locator: 'Prose accompanying Diagram 25',
    quote:
      'resulting in IP having an overall low raising frequency of 20% on 654r, whereas IP has a raising frequency on A76r of 53% (GTO frequencies vs a donk bet-size of 1/4-pot).',
  },
  'family.high-donk-flops': {
    work: WORK,
    page: 636,
    locator: 'Section "High Donk Bet Frequency Flops (50%+)"',
    quote:
      'There are about 34 distinct flops that result in an average donk bet over 50% of the time against both the BN and UTG. They are in ranks 7-x-x and 6-x-x with one to three possible flopped straights. The higher the number of flopped straights, the smaller the donk bet-size and the higher the donk bet frequency used. Rainbow flops are donked at a higher frequency than two-tone flops and, in general, monotone flops get donked a lot less frequently.',
  },
  'family.high-donk-eqr': {
    work: WORK,
    page: 638,
    locator: 'Table 103: High Donk Bet Frequency Flops',
    quote:
      'On the high donk frequency flops, the BB has an average of 50% equity and is able to over-realize that equity (103% EQR), capturing an average of 52% of the pot.',
  },
  'family.high-donk-polarity': {
    work: WORK,
    page: 638,
    locator: 'Diagram 26: EQB on High Donk Bet Frequency Flops',
    quote:
      'Here, the BB’s range is more polarized than IP’s range. The BB has the advantage in both strong and good hands, while 50% of IP’s range are weak hands that will have a more difficult time realizing equity and will therefore benefit from playing passively. This range construction resembles the Clairvoyance Toy game, with the IP having the more depolarized range, which makes the BB want to take the betting lead.',
  },
  'family.high-donk-bucket-frequencies': {
    work: WORK,
    page: 639,
    locator: 'Diagram 27',
    quote:
      'With stack depths between 30-40bb, the BB wants to bet strong hands 73% of the time, good hands 64%, weak hands 59%, and trash hands are bet 49%. The most used donk bet-size is 1/4-pot, with 2/3-pot size bets used on average 5%.',
  },
  'sizing.stack-depth': {
    work: WORK,
    page: 640,
    locator: 'Prose accompanying Diagram 28',
    quote:
      'With a 20bb effective stack, the 2/3-pot size donk bet is preferred… When stacks are deeper, there aren’t many hands that are happy to get all-in on the flop so, instead, a smaller donk bet-size allows the BB to call a re-raise and see the turn without having to get all the money in on the flop.',
  },
  'donk.frequency-by-opener': {
    work: WORK,
    page: 640,
    locator: 'Prose closing the High Donk Bet Frequency Flops section',
    quote:
      'Donk betting also happens on average more often vs UTG (67% of the time) than vs the BN (53% of the time). This is because the high donk betting boards are missed a lot more often by UTG ranges.',
  },
  'checking.range-protection': {
    work: WORK,
    page: 640,
    locator: 'Prose accompanying Diagram 28',
    quote:
      'Strong and good hands are also an important part of the checking ranges. The more checking happens, the more important it becomes to have strong and good hands in the checking range so the range remains balanced and protected.',
  },
  'example.654r-utg-buckets': {
    work: WORK,
    page: 641,
    locator: 'Section "Donk Betting Range Example" — BB vs UTG on 654r (30bb effective stacks)',
    quote: 'Strong hands are bet 77% of the time… Good hands are bet 70% of the time… Weak hands are bet 61% of the time',
  },
  'example.654r-utg-straights': {
    work: WORK,
    page: 641,
    locator: 'Section "Donk Betting Range Example" — Strong hands',
    quote:
      'Straights are the strongest hands the BB can have on this flop. The lowest straight 32 is the most vulnerable and it unblocks IP’s continuing range, so it gets bet 91%, while the other straights 87 get bet 80% and 73 only gets bet 50%.',
  },
  'example.654r-utg-top-pair': {
    work: WORK,
    page: 641,
    locator: 'Section "Donk Betting Range Example" — Good hands',
    quote:
      'Top Pairs are bet 78% of the time. The ones with the highest kickers and the ones that have an OESD betting the highest frequency. The middle kickers are checked more frequently.',
  },
  'example.654r-utg-draws': {
    work: WORK,
    page: 642,
    locator: 'Section "Donk Betting Range Example" — Weak hands',
    quote: 'OESD are bet 67% of the time. 7x hands are bet more often than 3x.',
  },
  'value.table-104': {
    work: WORK,
    page: 650,
    locator: 'Table 104: 654r BB vs BN 30bbs Stats',
    quote:
      '654r is one of the highest donk bet flops. When the BB loses the ability to lead out on this board, they lose 1.1% of the pot or 6.5bb/100 and the EQR decreases by 2.25%.',
  },
  'value.difficulty-caveat': {
    work: WORK,
    page: 650,
    locator: 'Section "The Value of Donk Betting"',
    quote:
      'Donk betting only happens at a high frequency on a small number of flops that are also low frequency flops, so the impact of the EV loss of choosing a simpler strategy that always checks when OOP will not be significant in the grand scheme of things. Additionally, implementing donk betting strategies correctly can be difficult in-game.',
  },
  'position.654r-ip-cbet': {
    work: WORK,
    page: 652,
    locator: 'Prose accompanying Table 105',
    quote:
      'On 654r, Hero has a range disadvantage so, unlike on A76r, betting the entire range isn’t advisable because the risk of the check-raise (which would destroy Hero’s equity) increases drastically. So, with position, Hero can only bet about 48% of the time after the BB checks.',
  },
  'position.654r-bn-weak-hands': {
    work: WORK,
    page: 652,
    locator: 'Prose accompanying Table 105',
    quote:
      'Weak hands make up 51% of Hero’s range. When in position these would be checked back most of the time to realize equity and would prefer to play a small pot, so as not to risk being x/r and blown off their equity.',
  },
  'contrast.a76r': {
    work: WORK,
    page: 633,
    locator: 'Prose accompanying Table 100',
    quote:
      'Clearly IP has the equity advantage with 62% equity vs the BB’s 38% on A76r, which will of course reduce the profitability of the BB’s bets',
  },
  'contrast.no-donk-flops': {
    work: WORK,
    page: 648,
    locator: 'Section "No Donk Bet Flops (0%-10%)"',
    quote:
      'In general, this means trips, monotone, high card paired, disconnected two-tone, HXX and AXX flops are bad donk betting flops… Playing a 100% checking frequency is recommended.',
  },
  'preflop.bb-call-composition-100bb': {
    work: WORK,
    page: 243,
    locator: 'Prose describing Hand Range 82: BB vs BN Open',
    quote:
      'the BB can call many more hands compared to all the other positions… while calling with most suited hands, offsuit Ax, connectors and broadways.',
  },
  'preflop.bb-3bet-composition-25bb': {
    work: WORK,
    page: 386,
    locator: 'Prose describing Hand Ranges 159-166 — Defending the BB Versus IP (25bb)',
    quote:
      'The non-all-in 3-betting range is polarized, made of JJ+, the strongest Axs, some of the best premium suited connectors, and a small frequency of offsuit hands with a blocker, including A8o-A2o, K6o-K2o, Qxo and Jxo.',
  },
  'preflop.bb-vs-bn-25bb-chart': {
    work: WORK,
    page: 387,
    locator: 'Hand Range 159: BB vs BN (25bb)',
    quote: 'BB vs BN (25bb) • All-in 11.4% / • 3-bet 8.2% / • Call 65.9% / • Fold 14.6%',
  },
  'preflop.bb-vs-bn-40bb-chart': {
    work: WORK,
    page: 396,
    locator: 'Hand Range 167: BB vs BN (40bb)',
    quote: 'BB vs BN (40bb) • All-in 3% / • 3-bet 14.1% / • Call 58.6% / • Fold 24.2%',
  },
  'bb25.four-branch-strategy': {
    work: WORK,
    page: 386,
    locator: 'Prose accompanying Table 60: BB vs IP Action Frequencies (25bb)',
    quote:
      'With 25bb, the average BB fold vs a min-raise is 22.54%, increasing from 14.6% vs the BN to 27.2% vs UTG. The BB all-in frequency drops as the opener’s range gets stronger, from 11.4% vs the BN to only 2.1% vs UTG, but the non all-in 3-bet frequency remains fairly constant at around 5%, except vs the BN, which is the highest at 8.20%.',
  },
  'bb25.pairs-and-axo-jam': {
    work: WORK,
    page: 386,
    locator: 'Prose describing Hand Ranges 159-166 — composition of the BB’s all-in range at 25bb',
    quote:
      'Pocket pairs and Axo really like getting all-in. As the opener’s range widens, the weaker pairs and Ax get to shove.',
  },
  'bb25.fold-range-grows': {
    work: WORK,
    page: 386,
    locator: 'Prose describing Hand Ranges 159-166 — the BB’s folding range at 25bb',
    quote:
      'The folding range increases drastically as the opener’s range gets stronger, from 14.6% up to 28% vs EP. This is because, at 25bb, stacks are deep enough that weak hands start having difficulty realizing their equity post-flop from OOP.',
  },
  'mtt.solver-environment': {
    work: WORK,
    page: 293,
    locator:
      'Ch.7 "MTT Equilibrium Strategies: Playing First In" — opening statement of assumptions (the sentence begins on p.292 and the ante clause falls on p.293)',
    quote:
      'The equilibrium strategies presented in this chapter were generated with modern solvers and super-computers, based on cEV for 9-max tables with a 12.5% ante.',
  },
  'mtt.ante-pot-size': {
    work: WORK,
    page: 163,
    locator: 'Section "The Size of the Pot"',
    quote:
      'in a 9-max MTT with 12.5% antes, the size of the pot is 2.625bb. If the action gets folded to the BN, they can push 10 big blinds with 46% of hands, but without antes, the pot size is only 1.5bb',
  },
  'defence.chapter-depths': {
    work: WORK,
    page: 360,
    locator: 'Ch.8 "MTT Equilibrium Strategies: Defense" — scope of the chapter',
    quote:
      'We will first discuss some general considerations and then examine the specific strategy recommended by solvers for all positions at stacks depths of 15bb, 25bb, 40bb and 60bb.',
  },
  'ex3.preflop-bb-vs-utg-40bb': {
    work: WORK,
    page: 402,
    locator: 'Hand Range 173: BB vs UTG (40bb)',
    quote: 'BB vs UTG (40bb) • 3-bet 5.8% / • Call 49.1% / • Fold 45%',
  },
  'ex3.utg-cbet-big': {
    work: WORK,
    page: 687,
    locator: 'Diagram 61 / Table 115: UTG C-betting Range Breakdown on 9♥8♥4♦',
    quote: 'Mid c-bet % and big bet-size: BB vs UTG on 9♥8♥4♦ (40bbs)',
  },
  'ex3.bb-few-strong-hands': {
    work: WORK,
    page: 742,
    locator: 'Flop Strategy Example 3 — BB vs 2/3-pot c-bet on 9♥8♥4♦ (40bbs)',
    quote:
      'On 9♥8♥4♦, the BB’s range only has about 4% strong hands against UTG. This results in UTG using a large bet-size and the BB having a low x/r frequency of about 4%. The BB’s strategy consists of waiting until the turn to start splitting their range, depending on the runout. This avoids revealing information about their range on the flop.',
  },
  'ex3.bb-compensates-on-turn': {
    work: WORK,
    page: 743,
    locator: 'Table 124: BB Strategy Breakdown vs UTG 2/3-pot c-bet on 9♥8♥4♦',
    quote:
      'In this situation, the BB compensates for the lack of flop aggression with an aggressive turn donking strategy on favorable runouts.',
  },
  'qjt.oesd-nut-straight-only': {
    work: WORK,
    page: 741,
    locator: 'C-bet Defense, Flop Strategy Example 2 — BB vs Min-bet on Q♥J♥T♥',
    quote: 'OESD will only continue if they are drawing to the nut straight.',
  },
  'ex3.oesd-check-call': {
    work: WORK,
    page: 744,
    locator: 'C-bet Defense, Flop Strategy Example 3 — BB vs 2/3-pot c-bet on 9♥8♥4♦',
    quote:
      'OESD are x/c every time. These combos have good equity vs IP’s c-bet range but are too weak against IP’s flop 3-betting range as they will often be dominated by overpairs or flush draws.',
  },
  'ex3.turn-donk-best-cards': {
    work: WORK,
    page: 768,
    locator: 'Diagrams 121-122 — Turn Play after Flop C-bet and Call (x/b/c)',
    quote:
      'The best cards for OOP to donk bet the turn are 9, 8 and 4 that pair the board, 7, 6, 5 that complete straights, and blank low offsuit cards. The worst cards to donk bet are the ones that connect well with IP’s range, which are aces, high cards, and diamonds that would give the IP player a BDFD.',
  },
  'ex3.turn-best-card-is-five': {
    work: WORK,
    page: 769,
    locator: 'Tables 138-141: OOP/IP EQ and EV heatmaps by turn card on 9♥8♥4♦ (x/b/c)',
    quote:
      'The worst cards for OOP are offsuit kings, such as K♣/K♠, and the best cards are offsuit 5s, such as 5♣/5♠.',
  },
  'ex3.turn-equity-runs-close': {
    work: WORK,
    page: 766,
    locator: 'Diagrams 119-120 — Turn Play after Flop C-bet and Call (x/b/c)',
    quote:
      'After OOP x/b/c the flop, both players’ equities will run very close on the average turn card. In fact, OOP has higher EQ (51.65%), but under-realizes it, capturing only 48.6% of the pot, while IP, with 46.6% EQ, captures 51.4% of the pot. Similarly to the flop donk bet, on the turn OOP chooses to donk bet when IP does not have as many dominant strong hands in their range and, instead, has many weaker hands that will benefit from checking back the turn.',
  },
  'ex3.ip-punishes-a-check': {
    work: WORK,
    page: 771,
    locator: 'Diagrams 124-125 — IP vs Check (x/b/c/x)',
    quote:
      'Typically, the IP player will have a substantial polarization advantage after OOP has checked twice… IP will c-bet over 65% of the time and will mostly use a 2/3-pot bet-size.',
  },
  'ex3.flop-combo-draws-jhth': {
    work: WORK,
    page: 744,
    locator: 'Table 124: BB Strategy Breakdown vs UTG 2/3-pot c-bet on 9♥8♥4♦ — Combo draws',
    quote:
      'Combo draws are x/r 1/3 of the time and x/c 2/3 of the time. Q♥J♥ and Q♥T♥ are x/r 100%. J♥T♥ and J♥7♥ are x/r about 1/3 and lower combo draws are mostly x/c.',
  },
  'ex3.turn-second-barrel-oop': {
    work: WORK,
    page: 775,
    locator: 'Diagrams 128-129 — OOP vs Turn 2/3-pot C-bet: BB vs UTG on 9♥8♥4♦ (40bb) (x/b/c/x/b)',
    quote:
      'Facing the second barrel is not great for OOP. At this point, both players have split their ranges several times. IP would be checking back a lot of medium strength hands and is now betting with a very polarized range. OOP would have bet or raised many strong hands by now, so their range is weak against IP’s turn c-betting range, resulting in OOP folding, on average, over 40% vs a turn c-bet. Most strong hands will be x/r on the turn, but some will still be slowplayed, leaving OOP’s x/c range protected, even on brick runouts.',
  },
  'ex3.turn-xr-all-in': {
    work: WORK,
    page: 777,
    locator: 'Diagrams 130-131 — OOP vs Turn 2/3-pot C-bet (x/b/c/x/b67); Tables 146-149 name the node’s bet-size',
    quote:
      'On average, OOP will x/r the turn 14% of the time and will be mostly going all-in, as a smaller raise size would commit too many chips. In general, their weaker x/r hands are semi-bluffs that will have the equity to call an all-in bet and thus be committed.',
  },
  'ex3.turn-facing-cbet-eqr': {
    work: WORK,
    page: 778,
    locator: 'Closing metrics for Tables 146-149: OOP/IP EQ and EV heatmaps on 9♥8♥4♦ (x/b/c/x/b67)',
    quote:
      'OOP has on average 45% EQ when facing a turn c-bet, but will only be able to realize 77% of it, for a total EV of 21% of the pot. IP has an average EQ of 55%, and will over-realize it by a large margin with an EQR factor of 144%, capturing 79% of the pot.',
  },
  'turn.categories': {
    work: WORK,
    page: 760,
    locator: 'Section "Turn Categories"',
    quote:
      'Paired Board: Turn cards that pair the board. Flush: Turn cards that complete a flush. Straight: Turn cards that complete an OESD. Ace: The ace is a special card and it often has a significant effect. Overcard: Turn cards higher than top pair. Brick/Blank: Turn card that doesn’t connect with the board in a meaningful way.',
  },
  'turn.why-groups': {
    work: WORK,
    page: 759,
    locator: 'Section "Turn Categories" — opening paragraphs',
    quote:
      'There are 49 possible turn cards for every single flop, and each turn will impact the ranges in play in some way. This will consequently affect the players’ GTO strategies… Studying each individual turn for every single flop would also be highly inefficient. For this reason, we will need some sort of turn groupings in a similar way to how we previously created the flop groupings. Most turn cards can be categorized as being in one or more of the following groups:',
  },
  'turn.category-subdivision': {
    work: WORK,
    page: 760,
    locator: 'Section "Turn Categories" — closing line',
    quote:
      'The overcard and undercard categories can be subdivided into cards that bring a backdoor flush draw and cards that don’t.',
  },
  'turn.984-xx-setup': {
    work: WORK,
    page: 760,
    locator: 'Section heading "Flop Strategy 1: Turn Play after Flop Checks Back (x/x)"',
    quote:
      'Flop Strategy 1: Turn Play after Flop Checks Back (x/x) / OOP First Action: BB vs UTG on 9♥8♥4♦ (40bb)',
  },
  'turn.984-good-cards-xx': {
    work: WORK,
    page: 763,
    locator: 'Prose accompanying Diagrams 116-117 — turn cards on 9♥8♥4♦ (x/x)',
    quote:
      'In general, low cards that complete straights, a 9, 8 or 4 pairing the board, and hearts are good turns for OOP (Diagram 116). Overcards to the board that don’t complete many straights, and particularly the aces, are good for IP.',
  },
  'turn.984-worst-card-xx': {
    work: WORK,
    page: 764,
    locator: 'Tables 134-137: OOP/IP EQ and EV heatmaps by turn card on 9♥8♥4♦ (x/x)',
    quote:
      'OOP does well on the average turn card, with 48% equity, and over-realizes it to win 53% of the pot. The worst possible turn cards for OOP are offsuit aces such as A♠/A♣ where their EV decreases to 25.8%. The best possible turn cards are offsuit 5x such as 5♠/5♣ where their EV increases to 64.17% of the pot.',
  },
  'river.polar-jams-nuts': {
    work: WORK,
    page: 782,
    locator: 'Section "Setting up a River Abstract Model"',
    quote:
      'if you can recognize the river situation as being polar vs bluff-catcher, you will know that the GTO strategy for the polar player is to always go all-in with their nut hands and the Alpha % of their bluffs. and the bluff-catching player has to call with 1-Alpha of their range.',
  },
  'river.defend-1-alpha': {
    work: WORK,
    page: 809,
    locator: 'Section "River Call Decision Points"',
    quote: 'Defending close to 1-Alpha is a good approximation in most river spots.',
  },
  'river.blockers': {
    work: WORK,
    page: 808,
    locator: 'Section "River Calling Strategies" — Blockers',
    quote:
      'On the river, all bluff-catchers are equal except in how they block value hands and don’t block bluffs. When you block the opponent’s value range, call more often. When you block the opponent’s bluffing range, fold more often.',
  },
  'theory.alpha-mdf': {
    work: WORK,
    page: 108,
    locator: 'Section "Minimum Defense Frequency (MDF)"',
    quote:
      'work 33% (Alpha) of the time to instantly profit. Your opponent must defend 67% (1-Alpha) of the time',
  },
  'bb100.bb-vs-btn-aggregates': {
    work: WORK,
    page: 244,
    locator: 'Hand Range 82: BB vs BN Open',
    quote: 'BB vs BN Open — 3-bet 13.4% / Call 43.4% / Fold 43.2%',
  },
  'bb100.why-bb-calls-wider': {
    work: WORK,
    page: 243,
    locator: 'Prose describing Hand Range 82: BB vs BN Open',
    quote:
      'The BN range is wide enough that now the BB can call many more hands compared to all the other positions, as the BN’s ability to barrel and overbet very aggressively is downgraded due to the strong hands being diluted.',
  },
  'bb100.linear-3bet': {
    work: WORK,
    page: 243,
    locator: 'Prose describing Hand Range 82: BB vs BN Open',
    quote:
      'Against the BN, the BB 3-bets a very linear range… The BB now 3-bets 13.4% hands while calling with most suited hands, offsuit Ax, connectors and broadways.',
  },
  'position.ch12-sim-scope': {
    work: WORK,
    page: 655,
    locator: 'Ch. 12, opening of the flop c-bet section',
    quote:
      'for this section we will use the aggregated data from thousands of GTO solutions with stack depths 20bb, 30bb and 40bb with standard GTO MTT starting ranges.',
  },
  'position.ip-over-realizes': {
    work: WORK,
    page: 656,
    locator: 'Table 110: IP vs BB Overall Metrics',
    quote:
      'Both the BN and UTG over-realize their equity by 15%, but since UTG’s range has higher equity, they are able to capture a bigger portion of the pot than the BN (Table 110).',
  },
  'position.ip-range-advantage': {
    work: WORK,
    page: 657,
    locator: 'Diagram 38: BB vs IP Equity Buckets',
    quote:
      'Clearly IP has the overall range advantage. As expected, UTG’s ~15% range is much stronger than the BN’s ~44% range (Diagram 38).',
  },
  'ex4.j66-headline': {
    work: WORK,
    page: 690,
    locator: 'Flop Strategy Example 4 / Diagram 63 — heading',
    quote: 'Mid c-bet % and small bet-size: BB vs BN on J♠6♥6♦ (40bbs)',
  },
  'ex4.j66-range-comparison': {
    work: WORK,
    page: 690,
    locator: 'Flop Strategy Example 4 — prose accompanying Diagram 63',
    quote:
      'On this flop, the BB’s range is very polar and has a healthy number of strong hands at 14%, not too far away from the BN’s 23%. More specifically, the BB’s range has 8.9% trip sixes, while the BN only has 5%.',
  },
  'ex4.j66-cbet-72': {
    work: WORK,
    page: 690,
    locator: 'Flop Strategy Example 4 — prose accompanying Diagram 63',
    quote:
      'For this reason, the BN cannot use a large sizing, but the BB still has 52% trash hands that will struggle to continue against even a min-bet. This allows the BN to have a high overall c-bet frequency of 72%.',
  },
  'ex4.j66-check-28': {
    work: WORK,
    page: 690,
    locator: 'Flop Strategy Example 4 — complement of the 72% printed with Diagram 63',
    quote: 'This allows the BN to have a high overall c-bet frequency of 72%.',
  },
  'ex4.paired-boards-min-bet': {
    work: WORK,
    page: 663,
    locator: 'Diagram 45 — IP flop bet-size by flop texture',
    quote: 'Clearly, paired boards should be frequently min-bet.',
  },
  'ex4.why-paired-boards-small': {
    work: WORK,
    page: 663,
    locator: 'Section "Flop C-betting by Structure"',
    quote:
      'Paired boards, on the other hand, give the BB a lot of strong hands, polarizing their range and allowing them some counterplay. This range polarization is one of the main reasons why betting very small is optimal on paired boards. Small bets force the BB to reveal a lot of information about their holding, as there are a lot of trash and weak hands the BB has to fold, regardless of IP’s bet-size, and IP loses the minimum when having to bet/fold the flop with the bottom of their range.',
  },
  'cbet.by-top-card': {
    work: WORK,
    page: 661,
    locator: 'Diagram 44 and accompanying prose — flop c-bet frequency by the flop’s highest card',
    quote:
      'The only 2xx flop is 222 and it is c-bet 100% of the time. Axx flops are the second most c-bet flops, with a 96% c-bet frequency. 3xx flops are only 333, 322 or 332 and are c-bet 93% of the time. Kxx flops are c-bet 88%, Qxx and Txx are c-bet 85% and, as expected, middle and low flops are c-bet at the lowest frequencies, with 6xx being the lowest at only 62% (Diagram 44).',
  },
  'cbet.check-share-derived': {
    work: WORK,
    page: 661,
    locator: 'Diagram 44 prose — arithmetic complement of the printed c-bet frequencies',
    quote: 'Axx flops … with a 96% c-bet frequency … with 6xx being the lowest at only 62%.',
  },
  'cbet.checking-back-costs-ip': {
    work: WORK,
    page: 656,
    locator: 'Table 109: Result of IP Playing 100% Check Back',
    quote:
      'If IP plays a strategy that always checks back the flop, they will have an EV loss of 26bb/100, so c-betting the flop is of massive importance to IP.',
  },
  'cbet.analysis-after-bb-checks': {
    work: WORK,
    page: 656,
    locator: 'Ch. 12, "Overall Flop Metrics"',
    quote: 'This analysis starts on IP’s decision point after the BB checks.',
  },
  'cbet.range-strength-drives-frequency': {
    work: WORK,
    page: 659,
    locator: 'Diagram 40 and accompanying prose (sentence continues onto p.660)',
    quote:
      'UTG’s c-bet frequency and bet-sizes are bigger than the BN because the UTG range is stronger than that of the BN. In general, the more strong hands your range has compared to your opponent’s, the more frequently you can bet.',
  },
  'cbet.straights-favor-bb': {
    work: WORK,
    page: 661,
    locator: 'Diagram 42 and accompanying prose — c-bet frequency by number of possible flopped straights',
    quote:
      'Since the BB has more offsuit connectors than IP, flops with more possible flopped straights will, as expected, favor the BB. So, the c-bet frequency decreases as there are more straights possible on the flop. Flops with zero flopped straights are the highest c-bet ones.',
  },
  'cbet.sizes-by-stack-depth': {
    work: WORK,
    page: 660,
    locator: 'Diagram 41 and accompanying prose',
    quote:
      'The bigger sizes are generally used less often when stacks are shallower, and the use of bigger bets (and even overbets) becomes more relevant when stacks are deeper.',
  },
  'flip.experiment-definition': {
    work: WORK,
    page: 651,
    locator: 'Section "The Power of Position" — definitions preceding Table 105',
    quote:
      'GTO: Modified GTO Solution with new flop bet-sizings for both players: 1.25-pot, 2/3-pot, 1/4-pot. Positions Flipped: Modified solution where the players’ ranges are flipped, so now OOP has the BN range and the IP Player has the BB range.',
  },
  'flip.hero-oop-with-bn-range': {
    work: WORK,
    page: 651,
    locator: 'Table 105: Result of Flipping BN and BB Ranges from BN Perspective',
    quote:
      'Now imagine the positions are flipped on the flop, but both players keep their original ranges. Now Hero is OOP with a 49% BN range, and the Villain is IP with a 64% BB calling range (Table 105).',
  },
  'flip.654r-oop-frequency': {
    work: WORK,
    page: 652,
    locator: 'Prose accompanying Table 105 — 654r',
    quote:
      'When Hero is OOP with the BN’s range on this flop, the total betting frequency drops down to 9.23% and the most used bet-size is the 125% overbet. Again, Hero aims to play a two street game and go all-in on the turn with a reasonably high frequency.',
  },
  'flip.654r-checking-range-protection': {
    work: WORK,
    page: 652,
    locator: 'Prose accompanying Table 105 — 654r',
    quote:
      'Unfortunately, when checking OOP, Hero is not guaranteed to see a turn card and will instead often face a bet and be forced to give up equity with many hands that would benefit from seeing a free turn card. For this reason, when OOP, Hero has to check many strong hands that can x/r the flop, forcing the Villain to bet less often, and thus allowing Hero’s weak hands to realize equity. If Hero does not protect the checking range, Villain will bet at a higher frequency, costing Hero a lot of EV. For this reason, Hero’s checking frequency is even higher when OOP with a range disadvantage.',
  },
  'flip.654r-oop-eqr': {
    work: WORK,
    page: 652,
    locator: 'Prose accompanying Table 105 — 654r',
    quote: 'When OOP on 654r, Hero’s EQR decreases from 100% to 79%, costing 9.7% of the pot!',
  },
  'flip.a76r-oop-cost': {
    work: WORK,
    page: 651,
    locator: 'Prose accompanying Table 105 — A76r',
    quote:
      'On A76r, Hero’s range is so strong compared to the Villain’s that Hero still over-realizes equity, but not as much as with position. Hero’s EV reduces from capturing 75% to only being able to capture 68.3% of the pot, costing Hero 6.7% of the pot.',
  },
  'flip.two-street-game': {
    work: WORK,
    page: 651,
    locator: 'Prose accompanying Table 105 — why the sizings change when position is removed',
    quote:
      'When playing IP, Hero’s strategy is almost always aimed to bet across three streets. For this reason, the 67% size is used more often as it allows an effective triple barrel. When we flip the positions, some elements of Hero’s range only want to play a two street game.',
  },
  'flip.value-of-position-general': {
    work: WORK,
    page: 653,
    locator: 'Tables 107-108: Symmetric Ranges from IP / OOP Perspective',
    quote:
      'Despite having identical ranges, the IP player captures on average 5% more of the pot than 50% equity, for a total EQR of 110%. Meanwhile OOP only realizes 90% of their equity, capturing on average only 45% of the pot… Different experiments that use different sample flops, or even a large subset of flops, give results that are consistent with the value of position being between 5-10% of the pot.',
  },
  'flops.straight-count': {
    work: WORK,
    page: 627,
    locator: 'Section "Flopped Straights" — Table 98',
    quote:
      'Flops can also be categorized by the number of possible flopped straights (Table 98). For example, on the flop AQ7 there are zero possible flopped straights. On KT9 there is one possible flopped straight (with QJ). On 875 there are two possible flopped straights (96 and 64). Finally, on JT9 there are three possible flopped straights (KQ, Q8 and 87).',
  },
  'flops.oesd-subcategory-limits': {
    work: WORK,
    page: 628,
    locator: 'Section "Flopped Straights", closing sentence',
    quote:
      'Flops that have zero flopped straights can also be subcategorized according to the number of possible OESDs, but for the scope of this book we will only focus on the number of straights.',
  },
  'cbet.oesd-subcategory': {
    work: WORK,
    page: 661,
    locator: 'Prose introducing Diagram 42',
    quote:
      'Within the flops with zero possible straights, we can create a subcategory for the number of possible open-ended straight draws (Diagram 42).',
  },
  'cbet.three-oesd-lowest': {
    work: WORK,
    page: 661,
    locator: 'Prose accompanying Diagram 43',
    quote:
      'Not surprisingly, the flops with three OESDs are the ones with the lowest c-bet frequency and with the larger bet-sizes, as the BB will have more possible straight draws and IP’s strong hands need more protection.',
  },
  'cbet.straight-count-figures-elsewhere': {
    work: WORK,
    page: 673,
    locator: 'Prose accompanying Diagram 54 — Flop C-betting by Texture (Unpaired Flops)',
  },
  'eqb.definitions': {
    work: WORK,
    page: 596,
    locator: 'Section "Equity Buckets (EQB)"',
    quote:
      'Strong Hands: Hands with a hand vs range equity greater or equal to 75% • Good Hands: Hands with a hand vs range equity greater or equal to 50% but lower than 75% • Weak Hands: Hands with a hand vs range equity greater or equal to 33% but lower than 50% • Trash Hands: Hands with a hand vs range equity lower than 33%',
  },
  'cbet.polarity-drives-size': {
    work: WORK,
    page: 663,
    locator: 'Section "Flop C-betting by Structure" (sentence completes on p.664)',
    quote:
      'In general, small bets are preferred when IP’s range has this type of depolarized distribution with the bulk of hands being good, but not great, and a low frequency of trash and weak hands. In situations where IP’s range distribution is more polarized with a bigger proportion of strong, weak and trash hands, bigger bet-sizes are used more often.',
  },
  'cbet.example-matrix': {
    work: WORK,
    page: 682,
    locator: 'Section "IP C-bet Examples" — Flop Strategy Examples 1-6 (pp.682-696)',
    quote:
      'Example 1: High c-bet % and big bet-size: BB vs UTG on A♥Q♦3♠ (40bb) • Example 2: High c-bet % and small bet-size: BB vs UTG on Q♥J♥T♥ (40bb) • Example 3: Mid c-bet % and big bet-size: BB vs UTG on 9♥8♥4♦ (40bbs) • Example 4: Mid c-bet % and small bet-size: BB vs BN on J♠6♥6♦ (40bbs) • Example 5: Low c-bet % and big bet-size: BB vs BN on 8♥6♦2♠ (40bbs) • Example 6: Low c-bet % and small bet-size: BB vs BN on 5♥5♦4♥ (40bbs)',
  },
  'ex5.low-freq-big-size': {
    work: WORK,
    page: 692,
    locator: 'Flop Strategy Example 5 — heading (Diagram 65 on p.693)',
    quote: 'Low c-bet % and big bet-size: BB vs BN on 8♥6♦2♠ (40bbs)',
  },
  'ex5.range-distribution': {
    work: WORK,
    page: 693,
    locator: 'Prose accompanying Diagrams 65-66',
    quote:
      'On 862r, the BB has few strong hands compared to the BN. This incentivizes the BN to use a big bet-size. However, the BN also has many good and weak hands that benefit from playing a small pot and taking a free turn card. These range distributions results in a more polarized big bet-size with a low c-bet frequency.',
  },
  'ex5.strong-hands-check-back': {
    work: WORK,
    page: 694,
    locator: 'Table 117: BN C-betting Range Breakdown on 8♥6♦2♠ — Strong hands',
    quote:
      'some strong hands such as top set and top pair weak kicker get checked back with some frequency. In fact, top set wants to check back or bet small. Since I advocate one bet-size by flop, I think a good strategy would be to simply always check back top set in this spot.',
  },
  'ex5.dont-cbet-all-value': {
    work: WORK,
    page: 694,
    locator: 'Table 117 breakdown — Strong hands, closing remark',
    quote:
      'A trend that typically loses a lot of EV to IP that I see all the time is to c-bet all strong and good hands on the flop and checking back an unbalanced and capped range that can be attacked by the BB on future streets.',
  },
  'ex5.good-hands-check-back': {
    work: WORK,
    page: 694,
    locator: 'Table 117 breakdown — Good hands',
    quote:
      'Good hands really want to check back a lot and realize equity instead of being raised off the pot. Middle and low pocket pairs mostly want to check back the flop, except 77, which can be bet half the time, as it can get value from middle pair.',
  },
  'ex5.middle-pair-a6': {
    work: WORK,
    page: 694,
    locator: 'Table 117 breakdown — Good hands (sentence completes on p.695)',
    quote:
      'The strongest middle pairs such as A6 and K6 are mostly c-bet and the weaker ones are typically checked back. Bottom pair top kicker is mostly c-bet, and the rest are checked back.',
  },
  'ex5.weak-hands': {
    work: WORK,
    page: 695,
    locator: 'Table 117 breakdown — Weak hands',
    quote:
      'Weak hands are c-bet reverse linearly when they cannot call a flop x/r. For example, K6o gets c-bet more often than K9o, which also gets c-bet more often than KQo. So, the strongest Kx that will do well on many turns can be checked back, while the weaker ones better serve as bet/folds. OESDs are mostly checked back, while gutshots and Q-high with two overcards are mostly c-bet.',
  },
  'ex5.trash-hands': {
    work: WORK,
    page: 695,
    locator: 'Table 117 breakdown — Trash hands',
    quote:
      'Weak Q-high, J-high and T-high with no draws are c-bet more often than not, but you have to give up and check back some of them because c-betting all your trash would make your c-betting range too weak.',
  },
  'ex5.xr-frequency': {
    work: WORK,
    page: 695,
    locator: 'Table 117 breakdown — "Facing a 50% Pot x/r"',
    quote:
      'On 862r, the BB’s range does not have many strong hands, thus the equilibrium flop x/r frequency is low, at ~8%. The x/r range mostly includes hands such as top pair good kicker, some OESD, some weak hands like gutshot plus BDFD and some random overcards.',
  },
  'ex5.bn-vs-xr-response': {
    work: WORK,
    page: 695,
    locator: 'Table 117 breakdown — "Facing a 50% Pot x/r", BN’s response',
    quote:
      'The BN’s equilibrium response is to fold 43% of the time, call 34% and 3-bet all-in 23%. The BN’s 3-betting range includes hands such as QQ-99, top pair good kicker+… The calling range is pretty much any pair, any gutshot or better draw',
  },
  'a76r.buckets': {
    work: WORK,
    page: 634,
    locator: 'Diagram 25: Average BB vs IP Equity Buckets for 20bb/30bb/40bb Stacks — the A76r figures',
    quote:
      'on A76r, the BB has 8% strong hands and IP has a staggering 31% strong hands! What happens is that, on A76r, IP’s top pairs (any Ax) have on average 85% equity vs the BB’s range, while a top pair on 654 will average about 65% equity.',
  },
  'a76r.bb-good-and-trash': {
    work: WORK,
    page: 634,
    locator: 'Prose accompanying Diagram 25',
    quote:
      'On 654r, the BB’s good hands increase from 17% to 40% and the trash hands reduce from 49% to 18% when compared to A76r.',
  },
  'a76r.donk-reverses-eqr': {
    work: WORK,
    page: 634,
    locator: 'Prose accompanying Diagram 25',
    quote:
      'Donk betting on A76r doesn’t make sense because it does not help the BB deny IP EQR. In this case, the opposite actually occurs, because IP’s range is so strong on this board that a donk bet can get raised with such a high frequency that the effect would be reversed. It would be the BB who is forced to continue putting more money into the pot with hands that would rather see a cheap turn card or fold, reducing their equity and resulting in a lower EQR and EV loss for OOP.',
  },
  'a76r.ip-cbets-100': {
    work: WORK,
    page: 635,
    locator: 'Prose accompanying Table 101: A76r BB vs BN 30bb Stats for Different BB Strategies',
    quote:
      'A76r is so good for IP that they get to c-bet 100% of their range and not worry about being x/r too often. For this reason, the BB doesn’t need to lead out with their strongest hands to get value as IP will keep putting money into the pot with their entire range when checked to. If the BB starts leading strong hands on A76r, it would only help IP as they could then choose to fold weak hands that would have continued putting money into the pot in the form of a c-bet and only continue when it is profitable to do so.',
  },
  'a76r.top-pair-lock-ev': {
    work: WORK,
    page: 635,
    locator: 'Table 101: A76r BB vs BN 30bb Stats for Different BB Strategies',
    quote:
      'If we force the BB to donk every time they have top pair or better (10%), their total EV reduces from 25 to 13, as this strategy is highly exploitable. In the GTO solution, the checking range is well protected because the BB is never leading out but, in the locked strategy, the BB is donking their strongest hands, leaving their checking range vulnerable. This makes their EV after checking decline to 5.6.',
  },
  'a76r.bb-ev-share-of-pot': {
    work: WORK,
    page: 652,
    locator: 'Prose accompanying Table 106: Result of Flipping BN and BB Ranges from BB Perspective',
    quote: 'This results in a huge EV increase from 25% when OOP to 37.8% when IP for a total gain of 12.8%!',
  },
  'a76r.check-100': {
    work: WORK,
    page: 635,
    locator: 'Prose closing the Table 101 discussion',
    quote:
      'If the BB tries a strategy of leading only with weak hands, the result is even worse as now IP will be able to raise 100% of the time, making the BB not only lose the entire pot when betting, but also their 1/4-pot size bet. For this reason, it works better for OOP to not split their range and simply check 100% on A76r.',
  },
  'a76r.donk-option-worthless': {
    work: WORK,
    page: 650,
    locator: 'Section "The Value of Donk Betting"',
    quote:
      'For example, on the A76r flop, OOP should donk bet about 0.4% of the time and, if we remove the BB’s option to donk bet, their overall EV remains the same.',
  },
  'no-donk.family-metrics': {
    work: WORK,
    page: 648,
    locator: 'Section "No Donk Bet Flops (0%-10%)"',
    quote:
      'In general, this group of flops are bad for the BB, providing an average of 39% equity and low EQR of 76%, for an average EV of 30% of the pot. On these boards, IP’s range is so strong that OOP is forced to check with a high frequency, for an average donk bet frequency of about 1%. OOP’s range is so weak that it doesn’t have enough strong hands compared to IP to be able to split this range so, for the most part, removing the option to donk bet on these kinds of flops does not reduce BB’s EV too significantly.',
  },
  'ex2.heading-high-freq-small-size': {
    work: WORK,
    page: 684,
    locator: 'Flop Strategy Example 2 — section heading',
    quote: 'High c-bet % and small bet-size: BB vs UTG on Q♥J♥T♥ (40bb)',
  },
  'ex2.range-advantage-but-small': {
    work: WORK,
    page: 685,
    locator: 'Flop Strategy Example 2 — prose accompanying Diagram 59',
    quote:
      'On Q♥J♥T♥, UTG has a substantial range advantage, so they would like to c-bet at a high frequency, but the BB’s range is too polarized, with many hands that would not be able to continue on the flop if UTG used a big bet-size. At the same time, BB has many strong hands that will be happy to continue vs a big bet-size.',
  },
  'ex2.big-bet-helps-bb': {
    work: WORK,
    page: 686,
    locator: 'Flop Strategy Example 2 — prose continuing from the foot of p.685',
    quote:
      'So, by betting big UTG would be making the BB’s life easier, allowing them to correctly fold weak hands and continue with a very strong range. If instead, UTG bets the minimum, this will lure the BB in with many weak hands that UTG dominates, keeping their range wider on future streets.',
  },
  'ex2.min-bet-100-no-ev-loss': {
    work: WORK,
    page: 686,
    locator: 'Flop Strategy Example 2 — prose accompanying Table 114',
    quote:
      'The strategy on this flop can be simplified to min-bet 100% with no EV loss. Many times, when people see all the small frequencies being used, they freak out, thinking that playing with that level of detail is impossible, and they are right. Only a solver would be capable of that kind of mixing but, as we saw in the post-flop bet-sizing section, we don’t need to use multiple bet-sizes, as a single bet-size will retain virtually all the strategy’s EV.',
  },
  'ex2.table-114': {
    work: WORK,
    page: 686,
    locator: 'Table 114: UTG c-betting Range Breakdown on Q♥J♥T♥',
    quote: 'Table 114: UTG c-betting Range Breakdown on Q♥J♥T♥',
  },
  'ex2.ip-almost-never-checks-back': {
    work: WORK,
    page: 750,
    locator: 'Turn chapter, "OOP First Action" — prose accompanying Table 126',
    quote:
      'Checking back almost never happens at equilibrium on A♠Q♦3♠ and Q♥J♥T♥. For this reason, IP’s range on the turn contains only 1.4 and 1 combos, respectively.',
  },
  'ex2.bb-36-equity': {
    work: WORK,
    page: 739,
    locator: 'Flop Strategy Example 2 (BB side) — prose accompanying Diagram 101',
    quote:
      'On QJT monotone, the BB has a substantial equity disadvantage, with only 36% equity. They are also only able to realize 79% of their equity, capturing 28% of the pot and folding, on average, 38.26% of the time against a flop min-bet, looking to x/r 18% and x/c 43%.',
  },
  'ex2.utg-equity-derived': {
    work: WORK,
    page: 739,
    locator: 'Derived from the BB figures printed with Diagram 101',
    quote: 'the BB has a substantial equity disadvantage, with only 36% equity … capturing 28% of the pot',
  },
  'ex1.aq3-high-freq-big-size': {
    work: WORK,
    page: 684,
    locator: 'Flop Strategy Example 1 — prose accompanying Table 113 (example heading on p.682)',
    quote:
      'This lack of nutted hands in the BB’s range allows IP to bet big across multiple streets, over-realizing the 72% equity and capturing 85% of the pot.',
  },
  'texture.monotone-most-cbet-smallest-size': {
    work: WORK,
    page: 671,
    locator: 'Section on IP metrics by flop texture — prose accompanying Table 112 and Diagram 52',
    quote:
      'Monotone flops are the most c-bet but they also have the lowest EV for IP. On this texture, IP’s strong hand percentage diminishes by a large margin, while the BB’s strong hand percentage increases… This range distribution creates a similar situation as on paired boards, with the BB having a polarized distribution, while IP is more depolarized. For this reason, using smaller bet-sizes is preferred as they will get a lot of folds from the BB’s hands that have terrible equity while not overcommitting with all of IP’s good, but not great hands.',
  },
  'texture.monotone-betting-big-mistake': {
    work: WORK,
    page: 672,
    locator: 'Section on IP metrics by flop texture — the author’s note on monotone bet-sizing',
    quote:
      'I often see players making the mistake of betting large on monotone flops, thinking that they need to protect their good hands and make the BB fold. The problem with that is that if your bet-size is too large, you force the BB to fold the weak hands that would continue against a smaller bet and will be isolating yourself against the top of their range that will either have you beat or have a ton of equity.',
  },
  'texture.monotone-simplify-min-bet': {
    work: WORK,
    page: 673,
    locator: 'Section on IP metrics by flop texture — simplification guidance for monotone flops',
    quote:
      'We could easily simplify our strategy on monotone flops to use only 1/3-pot bet-sizes or min-bets without suffering a significant EV loss.',
  },
  'texture.qxx-category-average': {
    work: WORK,
    page: 661,
    locator: 'Section on IP c-bet frequency by flop rank — prose accompanying Diagram 44',
    quote:
      'Kxx flops are c-bet 88%, Qxx and Txx are c-bet 85% and, as expected, middle and low flops are c-bet at the lowest frequencies, with 6xx being the lowest at only 62%.',
  },
  'texture.straights-reduce-cbet': {
    work: WORK,
    page: 673,
    locator: 'Section on IP c-bet frequency by connectedness — prose accompanying Diagram 54',
    quote:
      'Flops with three possible flopped straights are checked 31% of the time, flops with two straights are checked 28%, flops with one straight are checked 17% and flops with zero straights are checked only 10% of the time.',
  },
  'xx.ip-checkback-capped': {
    work: WORK,
    page: 749,
    locator: 'Section "Turn Play After Flop Check Back (x/x)" — IP Range',
    quote:
      'If IP is checking back a GTO strategy, then their range will have the right board coverage and be fairly balanced on most runouts. Still, IP’s checking back range will be somewhat capped and a lot more depolarized than their c-betting range as they would have c-bet most of their strong hands on the flop.',
  },
  'xx.oop-range-uncapped': {
    work: WORK,
    page: 749,
    locator: 'Section "Turn Play After Flop Check Back (x/x)" — OOP Range',
    quote:
      'If OOP doesn’t have a donk betting range, then they have exactly the same range with which they called the pre-flop raise. This means two things. First, this range is very wide compared to IP’s range, and second, that this range is still uncapped.',
  },
  'xx.ranges-invert': {
    work: WORK,
    page: 749,
    locator: 'Section "Turn Play After Flop Check Back (x/x)"',
    quote:
      'The way the ranges are constructed is somewhat reverse of the flop situation, making OOP’s range more polarized than IP’s and IP’s range more condensed than OOP’s. This range distribution generally results in OOP developing a turn betting strategy.',
  },
  'xx.oop-turn-bet-sizes': {
    work: WORK,
    page: 751,
    locator: 'Diagram 107 — OOP First Action (x/x/?), Table 126 Turn Decision Point Stats',
    quote: 'OOP has three different bet-sizes to choose from: 1.2x-pot, 2/3-pot and 1/3-pot.',
  },
  'xx.984-condensed-vs-j66': {
    work: WORK,
    page: 752,
    locator: 'Diagram 108 — IP vs Bet (x/x/b/?)',
    quote:
      'On 9♥8♥4♦, IP raises a 1/3-pot bet 19% of the time and never raises an OOP overbet on J♠6♥6♦… on 9♥8♥4♦, OOP’s betting frequency and bet-size are smaller than on J♠6♥6♦ because the polarization of the ranges is different in both cases. On 9♥8♥4♦, OOP’s betting range is more condensed and IP has more strong hands, allowing IP to have a raising range.',
  },
  'xx.984-polarization-advantage': {
    work: WORK,
    page: 761,
    locator:
      'Diagram 115 — "Flop Strategy 1: Turn Play after Flop Checks Back (x/x)", OOP First Action: BB vs UTG on 9♥8♥4♦ (40bb)',
    quote:
      'On 9♥8♥4♦, OOP has the polarization advantage on many turn cards, resulting in a high betting frequency (Diagram 115).',
  },
  'ex3.utg-checkback-composition': {
    work: WORK,
    page: 689,
    locator: 'Table 115: UTG C-betting Range Breakdown on 9♥8♥4♦',
    quote:
      'Strong hands are bet most of the time. Hands such as AA, top set and middle set get checked back ~8%… Good hands are played passively, with made hands such as middle pairs mostly being checked. Good draws such as combo draws and flush draws are mostly c-bet, while weaker draws such as OESD mostly get checked. Top pair wants to check back 24% of the time.',
  },
  'preflop.bb-3bet-value-40bb': {
    work: WORK,
    page: 395,
    locator: 'Prose describing Hand Ranges 167-174',
    quote:
      'if we compare the BB 3-betting ranges, it is very clear how the value range shrinks from 99+, ATs+, and AJ+ vs the BN to TT+ and AK vs UTG.',
  },
  'aq3.example-header': {
    work: WORK,
    page: 682,
    locator: 'IP C-bet Examples — Flop Strategy Example 1 (Diagram 58)',
    quote: 'High c-bet % and big bet-size: BB vs UTG on A♥Q♦3♠ (40bb)',
  },
  'aq3.simplification-ev': {
    work: WORK,
    page: 683,
    locator: 'Prose under Diagram 58 — Flop Strategy Example 1',
    quote:
      'If we give IP the option to use a 120% overbet, the solver will use it 14.45% of the time, although this does not generate any extra EV to IP. On the other hand, simplifying the strategy to c-bet 100% for 1/3-pot bet-size loses 1.07% of the pot, or 6.6bb/100. Simplifying the strategy to c-bet 100% using the 2/3-pot bet-size retains all of IP’s EV.',
  },
  'aq3.no-nutted-hands': {
    work: WORK,
    page: 684,
    locator: 'Table 113: UTG C-betting Range Breakdown on A♥Q♦3♠',
    quote:
      'On A♥Q♦3♠, UTG has all very strong hands, such as AA, QQ and AK, while the BB would 3-bet AA and QQ all the time and AK most of the time. This lack of nutted hands in the BB’s range allows IP to bet big across multiple streets, over-realizing the 72% equity and capturing 85% of the pot.',
  },
  'aq3.xr-frequency': {
    work: WORK,
    page: 684,
    locator: 'Flop Strategy Example 1 — “Facing a Min x/r”',
    quote:
      'On this flop, IP has a massive range advantage and, at equilibrium, should only face a flop x/r about 5% of the time.',
  },
  'aq3.bb-trash-16-equity': {
    work: WORK,
    page: 726,
    locator: 'Ch. “C-bet Defense” — worked MDF counter-example on AQ3r',
    quote:
      'on a flop such as AQ3r, the BB’s range has 70% trash hands and 10% weak hands. On average, the BB’s trash hands have 16% equity against UTG, but the pot odds laid by UTG’s bet-size are 20%. So even against the 1/3-pot bet-size, calling many of those hands will be -EV.',
  },
  'aq3.bb-defends-42': {
    work: WORK,
    page: 726,
    locator: 'Ch. “C-bet Defense” — BB’s GTO response to a 1/3-pot c-bet on AQ3r',
    quote:
      'the BB’s GTO defense strategy vs the 1/3-pot bet-size has them folding 58% and defending only 42% of the time, which is nowhere near the 75% MDF. On this flop, the UTG can get away with c-betting their entire range and there is nothing the BB can do to stop them from having a profitable bet with any two cards.',
  },
  'cbet.axx-96': {
    work: WORK,
    page: 661,
    locator: 'Diagram 44 — flop c-bet frequency by high card',
    quote:
      'Axx flops are the second most c-bet flops, with a 96% c-bet frequency.',
  },
  'cbet.check-back-costs': {
    work: WORK,
    page: 656,
    locator: 'Table 109: Result of IP Playing 100% Check Back',
    quote:
      'If IP plays a strategy that always checks back the flop, they will have an EV loss of 26bb/100, so c-betting the flop is of massive importance to IP.',
  },
  'cbet.size-up-vs-trash': {
    work: WORK,
    page: 680,
    locator: 'General IP C-bet Guidelines',
    quote:
      'If your opponent has a lot of trash in their range, you should c-bet at a high frequency and expect to get many folds. If they have very few strong hands compared to you, you should size up!',
  },
  'cbet.default-third-pot': {
    work: WORK,
    page: 681,
    locator: 'General IP C-bet Guidelines',
    quote:
      'If you are unsure about the flop strategy with your range, you can default to c-betting 1/3-pot in most short and middle stack situations.',
  },
  'bb40.fold-jumps-by-seat': {
    work: WORK,
    page: 395,
    locator: 'Prose accompanying Table 61: BB Action Frequencies (40bb)',
    quote:
      'The folding frequency also increases drastically as Villain’s range gets stronger, from 24.2% vs the BN to 45% vs UTG.',
  },
  'bb40.defend-tighter-vs-ep': {
    work: WORK,
    page: 395,
    locator: 'Prose accompanying Table 61: BB Action Frequencies (40bb)',
    quote:
      'Against a non-all-in polarized range from an early position player, you should defend tighter and should use better hands as bluffs, while keeping your 3-betting frequency low.',
  },
  'bb40.bluffs-shrink-with-value': {
    work: WORK,
    page: 395,
    locator: 'Prose describing Hand Ranges 167-174',
    quote:
      'When the value range shrinks, the bluffing range must also shrink, to the point that bluffs vs BN are made with completely different hands than vs EP',
  },
  'bb40.no-rejam-vs-ep': {
    work: WORK,
    page: 395,
    locator: 'Prose accompanying Table 61: BB Action Frequencies (40bb)',
    quote:
      'With 40bb, the BB is now too deep to 3-bet all-in against most positions. In fact, the earlier the opener’s position, the less often the BB can rejam all-in due to the lack of pre-flop fold equity vs narrow ranges.',
  },
  'depth.bb-vs-bn-15bb-chart': {
    work: WORK,
    page: 382,
    locator: 'Hand Range 155: BB vs BN (15bb)',
    quote: 'BB vs BN (15bb) • All-in 18% / • Call 58.2% / • Fold 23.8%',
  },
  'depth.15bb-no-non-allin-3bet': {
    work: WORK,
    page: 381,
    locator: 'Section "Defending the BB Versus IP (15bb)" — prose accompanying Table 59',
    quote:
      'With 15bb, the average BB fold vs a min-raise is 22.56%. At this stack depth, the BB is too shallow to have a non-all-in 3-betting range.',
  },
  'depth.15bb-who-jams': {
    work: WORK,
    page: 381,
    locator: 'Section "Defending the BB Versus IP (15bb)" — composition of the BB’s all-in range',
    quote:
      'The solver likes going all-in pre-flop at this stack depth with hands that are ahead of the opener’s range but have bad post-flop equity realization and thus perform better by getting the money in pre-flop. Most pocket pairs make great rejamming hands except AA and KK, which get slowplayed vs LP, and the smaller pairs are played using a mixed strategy vs EP.',
  },
  'depth.bn-response-to-15bb-jam': {
    work: WORK,
    page: 516,
    locator: 'Hand Range 267: BN 15bb (2x vs BB All-in)',
    quote: 'BN 15bb (2x vs BB All-in) • Call All-in 42.6% / • Fold 57.4%',
  },
  'depth.bn-response-to-40bb-3bet': {
    work: WORK,
    page: 548,
    locator: 'Hand Range 297: BN 40bb (2.3x vs BB 3.5x 3-bet)',
    quote: 'BN 40bb (2.3x vs BB 3.5x 3-bet) • All-in 8.8% / • Call 45.4% / • Fold 45.7%',
  },
  'depth.only-4bet-is-all-in': {
    work: WORK,
    page: 545,
    locator: 'Prose accompanying Table 85: Action Frequencies by Stack Depth',
    quote: 'When facing a non-all-in 3-bet with 25-40bb stacks, the solver’s only 4-bet-size is all-in.',
  },
  'preflop.rfi-sweet-spot': {
    work: WORK,
    page: 294,
    locator: 'Ch.7 "Playing First In" — section "Bet-sizing"',
    quote:
      'The sweet spot for RFI bet-size seems to be somewhere between 2bb and 2.5bb from BN to UTG, and 2.5bb to 3.5bb in blind vs blind battles… I recommend min-raising when stack depths are in the rejam region (less than 25bb)',
  },
  'qjtdef.table-123': {
    work: WORK,
    page: 740,
    locator: 'Table 123: BB Strategy Breakdown vs UTG Min-bet on Q♥J♥T♥',
    quote: 'Table 123: BB Strategy Breakdown vs UTG Min-bet on Q♥J♥T♥',
  },
  'qjtdef.bottom-pair': {
    work: WORK,
    page: 741,
    locator: 'Table 123 breakdown — bottom pair bullet',
    quote:
      'Weak bottom pairs (T8-T2) are almost always folded. T8 can get x/r a small frequency, and T9 can be x/r half the time. Bottom pair with a higher kicker is always called.',
  },
  'qjtdef.middle-pair': {
    work: WORK,
    page: 741,
    locator: 'Table 123 breakdown — middle pair bullet',
    quote:
      'Weaker middle pair combos can be x/f most of the time and occasionally x/r. J9 and better can also be x/r with some frequency, and any Jx with a higher kicker plays a 100% call strategy.',
  },
  'qjtdef.top-pair-44': {
    work: WORK,
    page: 741,
    locator: 'Table 123 breakdown — top pair bullet',
    quote:
      'Top pair averages 44% equity on a board as connected as this one with so many flush, straight, set and two pair combinations. Top pair is simply not a strong hand on this texture.',
  },
  'qjtdef.flushes-xr': {
    work: WORK,
    page: 740,
    locator: 'Table 123 breakdown — flush combos bullet',
    quote:
      'Flush combos get x/r most of the time. A-high and K-high flushes get x/r about 1/3 of the time, reverse linearly with the highest kickers being x/r less often than the low kicker. For example, A9s never gets x/r, A5s gets x/r 57% and A2s gets x/r about 88% of the time. Lower flush combos are x/r about 88% of the time.',
  },
  'qjtdef.straight-flush-slowplay': {
    work: WORK,
    page: 740,
    locator: 'Table 123 breakdown — straight flush bullet',
    quote:
      'The straight flush makes only a tiny portion of the BB’s range but, when having it, the BB’s EV is more than 3x the size of the pot! … For this reason, Hero will mostly slowplay the nuts.',
  },
  'qjtdef.made-hands-xr': {
    work: WORK,
    page: 741,
    locator: 'Table 123 breakdown — straights, sets and two pair bullets',
    quote:
      'Straights are rarely x/r unless they have a flush draw, averaging a x/r frequency of 20%. … The BB never has top set. Middle and bottom set are x/r about 22% of the time. … Two pair is x/r about 17%.',
  },
  'qjtdef.draws-xr-third': {
    work: WORK,
    page: 741,
    locator: 'Table 123 breakdown — combo draws and flush draws bullets',
    quote:
      'Combo draws are x/r about 1/3 of the time and x/c 2/3. The ones with showdown value such as AT or KJ with a heart are mostly called and the ones without showdown value can be x/r about half the time. … This leaves the flush draw category with mostly weak flush draws such as 76o and 55 type hands. This category gets x/r about 1/3 of the time and called 2/3.',
  },
  'qjtdef.oesd': {
    work: WORK,
    page: 741,
    locator: 'Table 123 breakdown — OESD bullet',
    quote:
      'OESD will only continue if they are drawing to the nut straight. All 9x except 99 are folded 100%, A8o also gets folded 100%, Kx and A9 without a heart can be x/r about half the time and x/c the other half.',
  },
  'qjtdef.folds': {
    work: WORK,
    page: 741,
    locator: 'Table 123 breakdown — underpairs, gutshots and air bullets',
    quote:
      'Underpairs are always folded unless they have a flush draw. … All gutshots are folded unless they have a pair. … Air hands such as 7-high no draw are simply always folded.',
  },
  'qjtdef.a-high-gutshot': {
    work: WORK,
    page: 741,
    locator: 'Table 123 breakdown — closing observation on the board texture',
    quote: 'A-high and K-high hands always have at least a gutshot.',
  },
  'qjtdef.alpha-mdf': {
    work: WORK,
    page: 108,
    locator:
      'Section "Minimum Defense Frequency (MDF)" — the clairvoyance toy game. MDF is named on p.108; the b/(b + p) formula and the name Alpha follow on p.109.',
    quote:
      'This number is known as Minimum Defense Frequency (MDF). … Notice that this result, b/(b + p), is the same as P1’s bluff-to-value ratio. This number is also known as Alpha. It represents how often a bluff has to work for it to break even.',
  },
  'qjtdef.mdf-ignores-equities': {
    work: WORK,
    page: 726,
    locator: 'Ch. "C-bet Defense" — opening warning about MDF',
    quote:
      'Some players like using MDF as pseudo-GTO strategy, but as we have already pointed out, while this number could in some instances serve as a rough guideline, it does not take equities and range distribution into account. Basing your entire strategy on MDF will be highly detrimental.',
  },
  'qjtdef.min-bet-pot-odds': {
    work: WORK,
    page: 726,
    locator: 'Ch. "C-bet Defense" — closing paragraph on bet-size and range composition',
    quote:
      'When facing a bet, it is of vital importance to always consider the Villain’s range that will take that specific line. For example, when facing a min-bet, your pot odds will be amazing, but the Villain will use a different range composition compared to when they bet the size of the pot. This will have an effect on your strategy because your hands will have different equities depending on how the Villain constructs their various betting ranges.',
  },
  'preflop.sizing-guidelines': {
    work: WORK,
    page: 175,
    locator: 'Section "General Guidelines for Pre-flop Bet-sizing"',
    quote:
      'The earlier your position, the smaller your bet-sizing should be because the threat of opponents waking up with re-raising hands increases… Using solvers to test pre-flop bet-sizing, I found that for similar bet-sizes, the differences in EV are quite small and even indifferent in many situations.',
  },
  'ex6.example-header': {
    work: WORK,
    page: 695,
    locator: 'Section header, "Flop Strategy Example 6"',
    quote: 'Low c-bet % and small bet-size: BB vs BN on 5♥5♦4♥ (40bbs)',
  },
  'ex6.depolarized-distribution': {
    work: WORK,
    page: 696,
    locator: 'Prose accompanying Diagrams 67 and 68',
    quote:
      'On this flop, the BN doesn’t have a significant range advantage, hence the preference for the smaller bet-sizes. In fact, most of the BN range is made of good hands, giving a depolarized distribution that will result in a low c-bet frequency, as many good and weak hands in the BN’s range will benefit from checking back the flop.',
  },
  'ex6.bn-eqb-554': {
    work: WORK,
    page: 696,
    locator: 'Diagram 67: Low c-bet % and Small Bet-size: BB vs BN on 5♥5♦4♥ (40bbs) — "BN EQB" pie',
    quote: 'BN EQB — Strong 10% • Good 57% • Weak 24% • Trash 9%',
  },
  'ex6.bb-eqb-554': {
    work: WORK,
    page: 696,
    locator: 'Diagram 67: Low c-bet % and Small Bet-size: BB vs BN on 5♥5♦4♥ (40bbs) — "BB EQB" pie',
    quote: 'BB EQB — Strong 8% • Good 24% • Weak 33% • Trash 35%',
  },
  'ex6.cbet-by-eqb-554': {
    work: WORK,
    page: 696,
    locator: 'Diagram 68: IP Cbet Frequency by EQB (5♥5♦4♥, 40bbs)',
    quote:
      'Good: Bet 1/3 31% • Bet MIN 23% • Check 45% || Weak: Bet 1/3 39% • Bet MIN 20% • Check 40% || Trash: Bet 1/3 49% • Bet MIN 20% • Check 28% || Strong: Bet 1/3 41% • Bet MIN 29% • Check 28%',
  },
  'ex6.table118-gutshot': {
    work: WORK,
    page: 697,
    locator: 'Table 118, "Gutshot" row',
    quote:
      'Gutshot — % of Range 5.7% • Equity 58% • EV 57% • EQR 98% • C-bet 2/3 0.4% • C-bet 1/2 0.5% • C-bet 1/3 25.2% • C-bet Min 21.3% • Check 52.7%',
  },
  'ex6.table118-full-range': {
    work: WORK,
    page: 697,
    locator: 'Table 118, "Full Range" row',
    quote:
      'Full Range — % of Range 100% • Equity 55% • EV 59% • EQR 107% • C-bet 2/3 0.5% • C-bet 1/2 0.8% • C-bet 1/3 35.3% • C-bet Min 22.8% • Check 40.6%',
  },
  'ex6.good-hands-gutshots-check': {
    work: WORK,
    page: 697,
    locator: 'Section "Good hands", in the IP strategy breakdown for 5♥5♦4♥',
    quote:
      'Good hands are c-bet ~59% of the time. Mid pairs 66-99 are c-bet almost 100%, OESD gets mostly c-bet, gutshots mostly like to check back and A-high flush draws are c-bet linearly, with the strongest kickers being c-bet more often than the ones with weak kicker.',
  },
  'ex6.bb-less-polarized-lowers-cbet': {
    work: WORK,
    page: 698,
    locator: 'Section "Facing a 25% Pot x/r"',
    quote:
      'On 5♥5♦4♥, the BB isn’t as polarized as it was on J66r because, on 5♥5♦4♥, many of the BB’s hands that would be trash on J66 now have a flush draw, OESD or some sort of gutshot. This makes the BN c-bet the flop less frequently on 5♥5♦4♥.',
  },
  'ex6.small-bets-when-depolarized': {
    work: WORK,
    page: 663,
    locator: 'Section "Flop C-betting by Structure"',
    quote:
      'In general, small bets are preferred when IP’s range has this type of depolarized distribution with the bulk of hands being good, but not great, and a low frequency of trash and weak hands. In situations where IP’s range distribution is more polarized with a bigger proportion of strong, weak and trash hands, bigger bet-sizes are used more often.',
  },
  'ex6.depolarized-definition': {
    work: WORK,
    page: 78,
    locator: 'Ch. 1, section "Depolarized/Condensed Range"',
    quote:
      'A condensed or depolarized range is the opposite of a polar range. It has the top and bottom hands removed and is comprised of middle equity hands.',
  },
  'mdf.definition-toy-game': {
    work: WORK,
    page: 108,
    locator: 'Section "Minimum Defense Frequency (MDF)" — Clairvoyance Toy Game',
    quote: 'This number is known as Minimum Defense Frequency (MDF).',
  },
  'mdf.alpha-definition': {
    work: WORK,
    page: 109,
    locator: 'Section "Minimum Defense Frequency (MDF)" — Alpha',
    quote:
      'Notice that this result, b/(b + p), is the same as P1’s bluff-to-value ratio. This number is also known as Alpha. It represents how often a bluff has to work for it to break even.',
  },
  'mdf.complement-of-alpha': {
    work: WORK,
    page: 110,
    locator: 'Section "Minimum Defense Frequency (MDF)" — folding and calling frequencies',
    quote:
      'Since folding frequency and calling frequency are complementary numbers, they should add up to 1. So, if you know one, you can always easily calculate the other.',
  },
  'sizing.pot-fraction-convention': {
    work: WORK,
    page: 135,
    locator: 'Section "Poker Math Everyone Should Know" — introducing Table 14',
    quote:
      'Normalizing the size of the pot to 1 and all bets as a fraction of the pot makes calculations easier. For example, if the pot is $60 and a player bets $20, his bet-size as a fraction of the pot is 1/3-pot or 0.33 pot (Table 14).',
  },
  'sizing.alpha-worked-example': {
    work: WORK,
    page: 136,
    locator: 'Table 14: Bet-sizing and Alpha — worked example',
    quote:
      'Your bet needs to work 33% (Alpha) of the time to instantly profit. Your opponent must defend 67% (1-Alpha) of his range to make your zero equity bluffs indifferent.',
  },
  'mdf.one-third-pot-is-75': {
    work: WORK,
    page: 726,
    locator: 'Section "C-bet Defense" — MDF applied to a 1/3-pot bet',
    quote: 'if UTG bets 1/3-pot then, according to MDF, the BB is supposed to defend 75% of the time.',
  },
  'mdf.alpha-one-third-derived': {
    work: WORK,
    page: 109,
    locator: 'b/(b + p) from p.109, applied to a 1/3-pot bet',
  },
  'mdf.limits-ev-assumptions': {
    work: WORK,
    page: 602,
    locator: 'Section "Alpha and MDF Revisited"',
    quote:
      'They are derived from the EV equation. They assume that the EV of checking back your hand is 0 and that every time you are called and hold a bluff that you lose the pot and your bet. However, on the flop most poker hands will almost always have some equity as even the worst hands can improve on future streets. For this reason, the Alpha and MDF numbers are misleading. In reality, the BB does not have to defend nearly as many hands as MDF suggests…',
  },
  'mdf.limits-rough-guide': {
    work: WORK,
    page: 603,
    locator: 'Section "Alpha and MDF Revisited" — closing statement',
    quote:
      'Alpha and MDF can be used as a rough guide, but you cannot build your core strategy based solely on them and think it is GTO.',
  },
  'mdf.aq3r-critique': {
    work: WORK,
    page: 726,
    locator: 'Section "C-bet Defense" — opening paragraph',
    quote:
      'In no-limit hold’em, c-bet defense is highly susceptible to bet-sizing. Some players like using MDF as pseudo-GTO strategy, but as we have already pointed out, while this number could in some instances serve as a rough guideline, it does not take equities and range distribution into account. Basing your entire strategy on MDF will be highly detrimental.',
  },
  'mdf.aq3r-raising-worse': {
    work: WORK,
    page: 726,
    locator: 'Section "C-bet Defense" — the AQ3r example',
    quote:
      'Raising would be even worse, as that puts even more money into the pot vs a strong range that will not fold enough to make the bluff profitable.',
  },
  'mdf.aq3r-fold-these-hands': {
    work: WORK,
    page: 726,
    locator: 'Section "C-bet Defense" — the AQ3r example, hand-level instruction',
    quote:
      'So, if you are holding something like a 96s with a BDFD, a weak king-high or a small pocket pair and have about 10-20% equity, you should simply fold even if the Villain is betting ATC.',
  },
  'mdf.aq3r-fold-is-zero-ev': {
    work: WORK,
    page: 726,
    locator: 'Section "C-bet Defense" — the AQ3r example, closing rule',
    quote:
      'Your goal is not to try to win every hand you play, but to play each hand in the most profitable way. If calling and raising are -EV plays, then folding, which is always 0 EV, will be the highest EV play.',
  },
  'mdf.aq3r-other-flops-exist': {
    work: WORK,
    page: 726,
    locator: 'Section "C-bet Defense" — the AQ3r example, after the fold instruction',
    quote:
      'Your pre-flop call was profitable and there will be other flops where your range will be much stronger and you will either connect a strong hand, have a better bluffing opportunity, or your opponent will simply check back more often, allowing you to realize more equity.',
  },
  'guideline.trash-heavy-range-folds': {
    work: WORK,
    page: 735,
    locator: 'Section "General BB C-bet Defense Guidelines"',
    quote:
      'If your range has a lot of trash hands, you should fold a lot of it vs a c-bet, regardless of your opponent’s bet-size and the MDF.',
  },
  'ch14.hand-values-fixed': {
    work: WORK,
    page: 779,
    locator: 'Ch.14 "GTO River Strategies" — the river’s unique characteristics',
    quote:
      'On the river there are no more cards to come, so the values of the hands are fixed. There are no draws, resulting in each hand having either 100% or 0% equity vs another hand.',
  },
  'ch14.hand-vs-range-equity': {
    work: WORK,
    page: 779,
    locator: 'Ch.14 "GTO River Strategies" — the river’s unique characteristics',
    quote:
      'The hand vs range equity is simply the fraction of the opponent’s range the hand beats plus half of the hands it ties with, if there are any. For example, if a hand has 50% equity vs the Villain’s range, that means it is ahead of 50% of the Villain’s range and behind against the other half.',
  },
  'ch14.linear-ordering': {
    work: WORK,
    page: 779,
    locator: 'Ch.14 "GTO River Strategies" — the river’s unique characteristics',
    quote:
      'There is a linear ordering of hands in terms of strength that is history independent. This means that the ranking of all possible river hands from strongest to weakest is the same no matter how they got there.',
  },
  'ch14.structure-not-history': {
    work: WORK,
    page: 781,
    locator: 'Ch.14 — prose following Table 151 (Hypothetical Blocker Relationship Matrix)',
    quote:
      'It doesn’t matter how the players got to the specific river situation. As long as they arrive to the overall same structure, the GTO strategy pair in that situation will be equivalent.',
  },
  'ch14.nuts-identity-irrelevant': {
    work: WORK,
    page: 782,
    locator: 'Ch.14 — prose following Table 152 (Ranges Composition: Polar vs Bluff-catcher)',
    quote:
      'It doesn’t really matter if the nuts are a full house, flush, straight or any combination of those hands. The only important thing would be the overall ranges composition where one player’s range is 50% nuts and 50% air, and the other player’s range consists of 100% bluff-catchers.',
  },
  'ch14.abstract-models-are-heuristics': {
    work: WORK,
    page: 782,
    locator: 'Ch.14, section heading "River Abstract Models"',
    quote:
      'In this section, we will look at several river abstract models, compute them in a GTO solver and generate heuristics on how to approach the most typical river situations players can expect to face.',
  },
  'ch14.bluffcatcher-calls-1-alpha': {
    work: WORK,
    page: 784,
    locator: 'Ch.14, section "Perfectly Polarized vs Bluff-catcher" — prose with Table 154',
    quote:
      'The effective stack size does not affect the general strategy. In this set-up, the polarized player’s EV increases with bet-size, and so their equilibrium strategy is to always go all-in with nut hands (KK-QQ) and bluff the air hands (77-66) with an Alpha frequency. Position also doesn’t matter. P2 will never bet, and their strategy when facing a bet is to call 1-Alpha of the time with all hands (JJ-88)',
  },
  'ch14.bluffcatcher-never-bets': {
    work: WORK,
    page: 789,
    locator: 'Ch.14, section "P1’s Range is Polarized but Has More Air Than Nuts" — prose with Table 158',
    quote:
      'P2 has P1 beat 90% of the time, but their equilibrium strategy is still to always check. P2 cannot bet because P1’s range is polarized. P1 knows when they have the best hand and can choose to only call when this is the case.',
  },
  'ch14.no-blockers-irrelevant': {
    work: WORK,
    page: 809,
    locator: 'Ch.14, section "River Calling Strategies" — Blockers, closing bullet',
    quote: 'When you have no blockers, it is irrelevant, or slightly negative.',
  },
  'ch14.value-range-starting-point': {
    work: WORK,
    page: 809,
    locator: 'Ch.14, section "River Call Decision Points"',
    quote:
      'Use their value range as a starting point. Even against very tight players, always call hands in their value range. Never call with bluff-catchers if the Villain doesn’t have enough bluffs. If there is a lot of air in the Villain’s range, they will be more likely to be bluffing.',
  },
  'alpha.mdf-definition': {
    work: WORK,
    page: 108,
    locator: 'Ch.2, Clairvoyance Toy Game — the MDF derivation',
    quote:
      'This number is known as Minimum Defense Frequency (MDF). P2 has to call 50% of the time with KK to make P1 indifferent to bluffing or checking with QQ.',
  },
  'alpha.formula': {
    work: WORK,
    page: 109,
    locator: 'Ch.2, Clairvoyance Toy Game — the Alpha derivation',
    quote:
      'Notice that this result, b/(b + p), is the same as P1’s bluff-to-value ratio. This number is also known as Alpha. It represents how often a bluff has to work for it to break even.',
  },
  'alpha.half-pot-river-example': {
    work: WORK,
    page: 136,
    locator: 'Ch.2, "Poker Math Everyone Should Know" — worked example under Table 14: Bet-sizing and Alpha',
    quote:
      'If you bet half-pot with a polarized range on the river, you are giving your opponent 25% odds to call (3-to-1). Your range should have 75% value-bets and 25% bluffs (3-to-1). Your bet needs to work 33% (Alpha) of the time to instantly profit. Your opponent must defend 67% (1-Alpha) of his range to make your zero equity bluffs indifferent.',
  },
  'alpha.river-relevance': {
    work: WORK,
    page: 603,
    locator: 'Ch.11, section "Alpha and MDF Revisited"',
    quote:
      'These numbers become more relevant on the river when there are no more cards to come and you know if your hand has some equity in the pot or not… Alpha and MDF can be used as a rough guide, but you cannot build your core strategy based solely on them and think it is GTO.',
  },
  'bands.classification-purpose': {
    work: WORK,
    page: 625,
    locator: 'Ch.12, opening of the flop classification scheme',
    quote:
      'Classification is the process of grouping things based on their similarities to make them easier to identify or study. Flops that share common characteristics tend to be played in a similar fashion.',
  },
  'bands.flop-rank': {
    work: WORK,
    page: 626,
    locator: 'Section "Flop Rank" (Table 97)',
    quote:
      'The flop rank will depend on its highest card. For example, Kxx represents all flops that contain a king and two other cards that are a king or lower.',
  },
  'bands.flop-textures': {
    work: WORK,
    page: 626,
    locator: 'Section "Flop Textures"',
    quote:
      'Monotone: A monotone flop is a flop that contains all cards of a single suit, for example A♥K♥T♥ or J♠6♠5♠… Two-tone: A two-tone flop is a flop that contains two cards of a single suit and a third card of another suit… Rainbow: A rainbow flop is a flop that contains all three cards of different suits, for example Q♥9♠7♦, 6♦4♣2♠ or K♣J♦7♥.',
  },
  'bands.straight-count': {
    work: WORK,
    page: 627,
    locator: 'Section "Flopped Straights" (Table 98)',
    quote:
      'For example, on the flop AQ7 there are zero possible flopped straights. On KT9 there is one possible flopped straight (with QJ). On 875 there are two possible flopped straights (96 and 64). Finally, on JT9 there are three possible flopped straights (KQ, Q8 and 87).',
  },
  'bands.rank-letters': {
    work: WORK,
    page: 628,
    locator: 'Section "Flop Families" (Table 99)',
    quote:
      'High Card (H): Any card K, Q, J, T. Mid Card (M): Any card 9, 8, 7, 6. Low Card (L): Any card 5, 4, 3, 2. Ace (A): The lonely A',
  },
  'bands.distinct-flops': {
    work: WORK,
    page: 629,
    locator: 'Section "Flop Subsets"',
    quote:
      'there are 22,100 possible flops in hold’em and, using suit isomorphism, we can reduce that number to 1,755 strategically different flops.',
  },
  'bands.dataset': {
    work: WORK,
    page: 631,
    locator: 'Ch.12, "The Flop Donk Bet (DK)" — statement of the dataset',
    quote:
      'I aggregated the data of GTO solutions across all possible flops in BB vs BN and BB vs UTG situations in single raised pots with stack depths 20bb, 30bb and 40bb. The BN and UTG were used because they represent the widest and tightest ranges, while strategies from other positions will fall somewhere in between.',
  },
  'bands.effect-not-cause': {
    work: WORK,
    page: 635,
    locator: 'Prose introducing Table 102: BB Stats by Donk Bet Frequency',
    quote:
      'it is important to understand that the high donk betting frequencies are an effect and not a cause. As we will see in this section, the main cause of the BB having higher equity and EV on some flops is the way the ranges are distributed which in turn results in higher donk betting frequencies.',
  },
  'bands.a76r-buckets': {
    work: WORK,
    page: 634,
    locator: 'Diagram 25: Average BB vs IP Equity Buckets for 20bb/30bb/40bb Stacks',
    quote:
      'on A76r, the BB has 8% strong hands and IP has a staggering 31% strong hands! What happens is that, on A76r, IP’s top pairs (any Ax) have on average 85% equity vs the BB’s range, while a top pair on 654 will average about 65% equity.',
  },
  'bands.a76r-check-100': {
    work: WORK,
    page: 635,
    locator: 'Prose accompanying Table 101: A76r BB vs BN 30bb Stats for Different BB Strategies',
    quote:
      'A76r is so good for IP that they get to c-bet 100% of their range and not worry about being x/r too often… If the BB starts to include many bluffs in the leading range, then IP would start calling wider and frequently raising the donk bets. If the BB tries a strategy of leading only with weak hands, the result is even worse as now IP will be able to raise 100% of the time… For this reason, it works better for OOP to not split their range and simply check 100% on A76r.',
  },
  'bands.a76r-locked-strategy': {
    work: WORK,
    page: 635,
    locator: 'Table 101: A76r BB vs BN 30bb Stats for Different BB Strategies',
    quote:
      'If we force the BB to donk every time they have top pair or better (10%), their total EV reduces from 25 to 13, as this strategy is highly exploitable… This makes their EV after checking decline to 5.6.',
  },
  'bands.none-metrics': {
    work: WORK,
    page: 648,
    locator: 'Section "No Donk Bet Flops (0%-10%)"',
    quote:
      'The vast majority of flops belong to this category. Pretty much all flops that were not included in any of the other groups… In general, this group of flops are bad for the BB, providing an average of 39% equity and low EQR of 76%, for an average EV of 30% of the pot. On these boards, IP’s range is so strong that OOP is forced to check with a high frequency, for an average donk bet frequency of about 1%.',
  },
  'bands.mid-flops': {
    work: WORK,
    page: 642,
    locator: 'Section "Mid Donk Bet Frequency Flops (25%-50%)" (Diagram 29)',
    quote:
      'There are about 100 Flops that get donk bet 25-50% of the time. The main examples of flops that can generally be donk bet 25-50% of the time are: unpaired subfamilies 8MM, 8ML, 8LL, 7ML, 7LL, 6LL, and 5LL with one to three possible flopped straights. The only monotone flop is 764, and the paired flops are 766, 755, 655.',
  },
  'bands.mid-frequency': {
    work: WORK,
    page: 643,
    locator: 'Prose accompanying Diagram 29',
    quote:
      'Donk betting happens with the same frequency against UTG and the BN, roughly 35% of the time and checking happens 65% of the time, as the equity distribution doesn’t change too much in either case.',
  },
  'bands.mid-equity': {
    work: WORK,
    page: 644,
    locator: 'Diagram 30: EQB on Mid Donk Bet Frequency Flops',
    quote:
      'On the mid donk bet flops, equities run very close. IP has a slight equity advantage, 52% compared to the BB’s 48%. However, the BB’s range is more polarized with the bulk of the range being strong, good and trash hands, while IP still has a lot of weak hands that benefit from playing passively and seeing free cards in order to realize equity.',
  },
  'bands.mid-strategy': {
    work: WORK,
    page: 644,
    locator: 'Diagram 31 — mid-band donking strategy at 30-40bb',
    quote:
      'With 30-40bb, strong hands prefer using the bigger bet-size on paired boards and a smaller size on unpaired boards. Hands are bet linearly according to their equity with the highest equity hands being bet more often than low equity hands. The structure of the betting ranges is similar to what we saw previously in the High Donk Bet frequency flops, betting the same type of hands, but doing so with a lower frequency, checking everything more often so the checking range is more protected.',
  },
  'bands.mid-20bb': {
    work: WORK,
    page: 645,
    locator: 'Diagram 32 — mid-band donking strategy at 20bb',
    quote:
      'With 20bbs, the donking strategy is extremely polarized, betting mostly strong, good and trash hands. For this reason, a bigger bet-size is preferred, with the smaller size being used in the opposite way, mostly with weak hands, but also with some frequency of strong, good and trash hands in order to make the strategy well balanced.',
  },
  'bands.low-flops': {
    work: WORK,
    page: 645,
    locator: 'Section "Low Donk Bet Frequency Flops (10%-25%)" (Diagram 33)',
    quote:
      'Approximately 181 distinct flops get donk bet with 10% to 25% frequency… The unpaired donked flops subfamilies are: ALL, 9MM, 8MM, 8ML, 8LL, 7ML, 7LL, 6LL, 5LL, and 4LL. The paired families are: 99A, 88A, 77H, 77M, 77L, 66A, 66H, 66M, 66L, 55A, 55H, 55M, 55L, 44H, 44M, 44L, 33M',
  },
  'bands.low-frequency': {
    work: WORK,
    page: 645,
    locator: 'Section "Low Donk Bet Frequency Flops (10%-25%)"',
    quote:
      'In this situation the 67%-pot size bet is preferred (9%) over the 25%-pot size bet (7%). The BB donks slightly more frequently against the BN (16%) than against UTG (14%).',
  },
  'bands.low-equity': {
    work: WORK,
    page: 646,
    locator: 'Diagram 34: EQB on Low Donk Bet Frequency Flops',
    quote:
      'In low donk bet frequency flops, IP’s range dominance is clear. OOP’s equity drops to 45% and under-realizes by 6%, capturing only 43% of the pot. The number of OOP trash hands finally outweighs the number of weak hands.',
  },
  'bands.low-polarity': {
    work: WORK,
    page: 647,
    locator: 'Prose accompanying Diagrams 35-36',
    quote:
      'On low frequency donk bet flops, the donk betting ranges are a little more polarized and, for this reason, a larger bet-size is preferred. Donk betting does not seem to be too affected by stack depth and so the frequencies are similar with 20bb, 30bb and 40bb effective stacks.',
  },
  'bands.study-your-own-runouts': {
    work: WORK,
    page: 649,
    locator: 'Closing recommendation of the donk-bet section (Diagram 37)',
    quote:
      'Flop families that have similar structures and textures tend to be played in a similar fashion. So if you want to dig deeper into donk betting range composition, I recommend running sample flops from each donk bet frequency group in a GTO solver to familiarize yourself with the different spots, how to react to flop raises and how to follow through on future streets.',
  },
}

/** One line of attribution, for audits. */
export function citation(id: string): string {
  const c = SOURCE_CITATIONS[id]
  return `${c.locator} — ${c.work}, p.${c.page}.`
}
