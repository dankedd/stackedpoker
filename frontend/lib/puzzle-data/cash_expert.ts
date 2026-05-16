import type { Puzzle } from '../puzzle-types'

export const PUZZLES_CASH_EXPERT: Puzzle[] = [

  // ── exp-n01: Blocker theory — KQs bluff-raise with K blocker ─────────────
  {
    id: 'exp-n01-blocker-theory-kqs',
    title: 'Blocker Theory — KQs River Bluff-Raise',
    description: 'BTN vs BB SRP. You check-call two streets with KhQh. The river gives you a missed draw. Use the K blocker to construct a credible river bluff-raise.',
    difficulty: 'expert',
    category: 'Blocker Theory',
    gameType: 'cash',
    format: '6-max',
    heroPosition: 'BB',
    villainPosition: 'BTN',
    heroCards: ['Kh', 'Qh'],
    effectiveStack: 100,
    stakes: '$1/$2',
    summary: '',
    tags: [],
    steps: [
      {
        street: 'preflop',
        board: [],
        context: 'Folds to BTN who raises to $5. SB folds. BB defends.',
        prompt: 'BB with KhQh vs BTN open — standard defend. Proceed to flop.',
        options: [
          { id: 'continue', label: 'Defend — proceed to flop', quality: 'perfect', evLoss: 0, coaching: 'KQs is a clear BB defend vs BTN. Strong hand with flush potential.' },
        ],
      },
      {
        street: 'flop',
        board: ['Ah', '7h', '3d'],
        context: 'Pot $10bb. Flop: Ah7h3d. You act first OOP.',
        prompt: 'KhQh on Ah7h3d — you have a nut flush draw (9 outs) but no pair. You check. BTN bets 6bb.',
        options: [
          { id: 'fold', label: 'Fold the flush draw', quality: 'mistake', evLoss: 3.5, coaching: 'Folding a nut flush draw to a half-pot bet is a mistake. You have 9 outs (~35%) plus implied odds when you hit the flush. Call.' },
          { id: 'check-raise', label: 'Check-raise to $22', quality: 'good', evLoss: 0.8, coaching: 'Check-raising the NFD is aggressive but valid. Risk: BTN calls with top pair and you\'re a coin flip. Calling preserves your equity more efficiently.' },
          { id: 'call', label: 'Call $6', quality: 'perfect', evLoss: 0, coaching: 'Call with NFD. 9 outs plus implied odds makes calling clearly correct. You\'re floating to hit the flush and potentially check-raise or lead the turn.' },
        ],
      },
      {
        street: 'turn',
        board: ['Ah', '7h', '3d', 'Jc'],
        context: 'BTN bets 6bb. You call. Pot $22bb. Turn: Jc — miss. BTN bets 14bb.',
        prompt: 'Turn Jc misses your flush. BTN barrels again. You have KhQh — 9 outs (hearts). Continue or fold?',
        options: [
          { id: 'fold', label: 'Fold (two streets of pressure)', quality: 'good', evLoss: 1.5, coaching: 'Folding the turn is fine if BTN is polar-value heavy. However, calling with 9 outs gets you to a profitable river bluff spot with the K blocker. Calling is slightly better.' },
          { id: 'call', label: 'Call $14', quality: 'perfect', evLoss: 0, coaching: 'Call. You have 9 outs (~18%) and you\'re setting up the most important part of this hand — the K blocker river play. If the flush misses, you can bluff-raise the river leveraging the K blocker to represent AK or KK.' },
        ],
      },
      {
        street: 'river',
        board: ['Ah', '7h', '3d', 'Jc', '6s'],
        context: 'BTN bets 14bb on turn. You call. Pot $50bb. River: 6s — flush missed. BTN bets $30bb.',
        prompt: 'The flush missed. BTN bets $30bb on the river. You have only K-high. But consider: your K blocks AK (the nuts for BTN) — BTN can\'t have AK if you hold K. And BTN\'s river value range is mainly AX. How does the K blocker change your decision?',
        options: [
          { id: 'fold', label: 'Fold K-high (just a missed draw)', quality: 'good', evLoss: 2.8, coaching: 'Folding is reasonable — you have K-high on a paired board. But consider the blocker: your K reduces the combos of AK BTN can hold, meaning BTN\'s value range is thinner. A bluff-raise leverages this.' },
          { id: 'call', label: 'Call $30 (K-high showdown)', quality: 'mistake', evLoss: 5.5, coaching: 'Calling river with K-high is a mistake. You lose to all of BTN\'s value hands and gain nothing except catching a bluff. The risk/reward of calling with no showdown value is terrible.' },
          { id: 'raise', label: 'Raise to $80 (bluff-raise leveraging K blocker)', quality: 'perfect', evLoss: 0, coaching: 'Bluff-raise the river. Your K blocks AK (BTN\'s most likely value hand on an ace-high board). The K blocker reduces BTN\'s value combos significantly. When you raise, you represent AA, KK, or a slow-played set — and BTN holding AQ, AT, AJ must fold because they\'re not ahead of your "value" range.' },
        ],
      },
    ],
  },

  // ── exp-n02: Polarized vs merged sizing — river bet selection ────────────
  {
    id: 'exp-n02-polarized-vs-merged-sizing',
    title: 'River Sizing Theory — Polarized vs Merged Bets',
    description: 'Navigate a river where your hand strength determines whether to use a polarized (large) or merged (small) sizing. The correct size is the primary decision point.',
    difficulty: 'expert',
    category: 'Bet Sizing',
    gameType: 'cash',
    format: '6-max',
    heroPosition: 'BTN',
    villainPosition: 'BB',
    heroCards: ['Jh', 'Td'],
    effectiveStack: 100,
    stakes: '$1/$2',
    summary: '',
    tags: [],
    steps: [
      {
        street: 'preflop',
        board: [],
        context: 'Folds to BTN. You raise to $5. SB folds. BB calls.',
        prompt: 'JTo on BTN — standard open. BB defends. Plan: play a SRP IP.',
        options: [
          { id: 'continue', label: 'Note: standard open — proceed to flop', quality: 'perfect', evLoss: 0, coaching: 'JTo is a standard BTN open. Connected and playable IP.' },
        ],
      },
      {
        street: 'flop',
        board: ['Jd', '9h', '4s'],
        context: 'BB checks. Pot $10bb. Flop: Jd9h4s. You are IP.',
        prompt: 'Top pair with JhTd on Jd9h4s. You also have a gutshot (8 gives straight). BB checks. C-bet sizing?',
        options: [
          { id: 'check', label: 'Check (protect range)', quality: 'good', evLoss: 0.5, coaching: 'Checking back TPTK is fine for range balance. But you have a strong hand and a draw — betting extracts value and charges BB\'s draws.' },
          { id: 'bet-small', label: 'Bet 4bb (40% pot)', quality: 'perfect', evLoss: 0, coaching: 'Small bet is optimal. Keeps BB\'s wide range in (Jx, 9x, 4x, pocket pairs). You want to extract 3 streets from BB\'s one-pair hands.' },
        ],
      },
      {
        street: 'turn',
        board: ['Jd', '9h', '4s', '7c'],
        context: 'BB calls flop. Pot $18bb. Turn: 7c. BB checks.',
        prompt: '7c turn adds a straight draw (T8 for a straight, which YOU also have as part of your gutshot range). BB checked. Continue value barreling?',
        options: [
          { id: 'check', label: 'Check back', quality: 'mistake', evLoss: 3.1, coaching: 'Checking back TPTK+gutshot with initiative is a mistake. BB checked — extract more value.' },
          { id: 'bet', label: 'Bet 12bb (67% pot)', quality: 'perfect', evLoss: 0, coaching: 'Medium turn bet continues the value line. TPTK + gutshot is a strong hand. Set up the river decision.' },
        ],
      },
      {
        street: 'river',
        board: ['Jd', '9h', '4s', '7c', '5d'],
        context: 'BB calls turn. Pot $42bb. River: 5d. BB checks.',
        prompt: 'River 5d — a blank. But wait: your JhTd on J-9-4-7-5 gives you top pair AND a straight (9-8-7... no. J-T: does 5 complete anything? J954 board — you have JT for a pair.) You have exactly top pair + missed gutshot. BB checked. This is a pure sizing decision. Do you use a polarized (large) or merged (small) river sizing?',
        options: [
          { id: 'check', label: 'Check (give up value)', quality: 'mistake', evLoss: 6.5, coaching: 'Checking top pair on a blank river after two value bets is a significant leak. BB called twice — they have a hand that will call a river bet.' },
          { id: 'bet-small', label: 'Bet 14bb (33% pot) — merged sizing', quality: 'perfect', evLoss: 0, coaching: 'Merged (small) sizing is correct here. You have top pair — a medium-strength value hand, not the nuts. A merged bet targets BB\'s entire range (9x, 7x, 5x) without scaring them off. Small bets keep the full range in and extract maximum expected value from a wide calling distribution.' },
          { id: 'bet-large', label: 'Bet 38bb (90% pot) — polarized sizing', quality: 'good', evLoss: 2.5, coaching: 'Polarized sizing is used with the nuts or complete air. Top pair is neither. A large bet folds out the medium-strength hands you beat (9x, 5x) while getting called only by better hands. Merged sizing extracts more EV with a medium-strength hand.' },
        ],
      },
    ],
  },

  // ── exp-n03: Multiway pot — navigate three-way action ────────────────────
  {
    id: 'exp-n03-multiway-pot',
    title: 'Multiway Pot — Navigate Three-Way Action',
    description: 'You open CO with AhKh, BTN calls, BB calls. Three-way to the flop. Flopping top pair in a multiway pot requires different strategy than heads-up.',
    difficulty: 'expert',
    category: 'Multiway',
    gameType: 'cash',
    format: '6-max',
    heroPosition: 'CO',
    villainPosition: 'BTN',
    heroCards: ['Ah', 'Kh'],
    effectiveStack: 100,
    stakes: '$1/$2',
    summary: '',
    tags: [],
    steps: [
      {
        street: 'preflop',
        board: [],
        context: 'Folds to CO. You raise to $5. BTN calls. BB calls. Pot $16bb.',
        prompt: 'AhKh in CO — three-way to the flop. How does multiway action affect your flop strategy?',
        options: [
          { id: 'continue', label: 'Note: proceed to flop (multiway dynamics)', quality: 'perfect', evLoss: 0, coaching: 'Multiway pots require tighter c-betting ranges — you face more opponents with stronger distributions. Top pair or better is generally required to bet for value.' },
        ],
      },
      {
        street: 'flop',
        board: ['Ac', '8d', '3h'],
        context: 'BB checks. Pot $16bb. Flop: Ac8d3h. You act after BB, before BTN.',
        prompt: 'You have AhKh — TPTK on an Ac8d3h dry board. Two opponents. What is your bet strategy?',
        options: [
          { id: 'check', label: 'Check (multiway caution)', quality: 'good', evLoss: 1.2, coaching: 'Checking TPTK multiway is overly cautious here. The board is dry and your hand is strong. Betting extracts value from both opponents.' },
          { id: 'bet-small', label: 'Bet 8bb (50% pot)', quality: 'perfect', evLoss: 0, coaching: 'Medium bet for value in multiway pot. In multiway, bet sizing should generally be smaller to get called by a wider range of hands from two opponents. Both BB and BTN may have 8x, 3x, or pair hands that call.' },
          { id: 'bet-large', label: 'Bet 14bb (88% pot)', quality: 'good', evLoss: 1.5, coaching: 'Large bet in multiway is aggressive — you risk folding both opponents and losing value. In multiway, smaller bets extract more total EV by getting two calls instead of zero.' },
        ],
      },
      {
        street: 'turn',
        board: ['Ac', '8d', '3h', 'Qd'],
        context: 'BB folds. BTN calls flop. Pot $32bb. Turn: Qd. You act first OOP (vs BTN).',
        prompt: 'BB folded, it\'s now HU. Qd turn adds diamond flush draw possibility. BTN is IP. Your TPTK is still likely ahead. Continue?',
        options: [
          { id: 'check-fold', label: 'Check-fold (Qd scared me)', quality: 'mistake', evLoss: 7.5, coaching: 'Folding TPTK to a turn scare card that the opponent hasn\'t even bet is a huge mistake. You check, then fold if bet? That\'s give up money. At minimum check-call.' },
          { id: 'check-call', label: 'Check-call any BTN bet', quality: 'good', evLoss: 0.8, coaching: 'Check-calling is reasonable — let BTN decide with their range. Your TPTK is strong and you\'re OOP vs BTN\'s wide calling range.' },
          { id: 'bet', label: 'Bet 20bb (62% pot)', quality: 'perfect', evLoss: 0, coaching: 'Lead the turn. You have TPTK and a flush draw. BTN called the flop — they have something. Betting keeps pressure on BTN\'s 8x, 3x, and AX-worse hands. OOP aggression with strong hands is the correct strategy.' },
        ],
      },
      {
        street: 'river',
        board: ['Ac', '8d', '3h', 'Qd', '2s'],
        context: 'BTN calls turn. Pot $72bb. River: 2s — blank. You act first OOP.',
        prompt: 'River 2s is a blank. BTN called two streets in this multiway scenario. Your TPTK is strong. What is your river bet size?',
        options: [
          { id: 'check', label: 'Check (give BTN free showdown)', quality: 'mistake', evLoss: 8.2, coaching: 'Checking river with TPTK after two streets of calls is a significant value cut. BTN has shown a willingness to call — they will call a river bet. Extract maximum value.' },
          { id: 'bet-medium', label: 'Bet 35bb (49% pot)', quality: 'perfect', evLoss: 0, coaching: 'Medium river value bet. BTN called two streets — their range includes AJ, AT, 88, 33, QJ, and worse Ax. A medium sizing extracts from all those hands without over-betting a non-nut hand. Complete the value line.' },
          { id: 'bet-large', label: 'Bet 65bb (90% pot)', quality: 'good', evLoss: 2.5, coaching: 'Large bet with TPTK on a blank river is thin. BTN can fold Ax worse and QJ to a large sizing. Medium bet captures more total EV.' },
        ],
      },
    ],
  },

  // ── exp-n04: GTO calling frequency — river spot with math ───────────────
  {
    id: 'exp-n04-gto-calling-frequency',
    title: 'GTO Calling Frequency — River Pot Odds vs Bluff Frequency',
    description: 'You face a river bet and must calculate whether pot odds justify calling. Understand the relationship between pot odds and your opponent\'s required bluff frequency.',
    difficulty: 'expert',
    category: 'GTO Fundamentals',
    gameType: 'cash',
    format: '6-max',
    heroPosition: 'BB',
    villainPosition: 'BTN',
    heroCards: ['Jh', 'Jd'],
    effectiveStack: 100,
    stakes: '$1/$2',
    summary: '',
    tags: [],
    steps: [
      {
        street: 'preflop',
        board: [],
        context: 'BTN raises to $5. SB folds. BB defends.',
        prompt: 'JJ in BB vs BTN open. How do you play this premium hand?',
        options: [
          { id: 'call', label: 'Call $3', quality: 'good', evLoss: 0.6, coaching: 'Calling JJ is fine but surrenders initiative. 3-betting builds the pot while ahead of BTN\'s range.' },
          { id: '3bet', label: '3-bet to $16', quality: 'perfect', evLoss: 0, coaching: '3-bet JJ for value. You\'re ahead of BTN\'s opening range massively. Build the pot preflop.' },
        ],
      },
      {
        street: 'flop',
        board: ['9h', '7d', '2c'],
        context: 'BTN calls 3-bet. Pot $33bb. Flop: 9h7d2c. You act first OOP.',
        prompt: 'JJ is an overpair on 9-7-2. A classic overpair protection spot. How do you play?',
        options: [
          { id: 'check', label: 'Check (pot control)', quality: 'good', evLoss: 0.9, coaching: 'Checking JJ OOP on 972 is fine for balance. But betting extracts value from BTN\'s underpairs, 7x, and 9x.' },
          { id: 'bet', label: 'Bet 18bb (55% pot)', quality: 'perfect', evLoss: 0, coaching: 'Bet the overpair. On 972, your JJ is a massive favorite. BTN called a 3-bet — they have TT, 99, 88, 77, AK, AQ. All of those call or call and are beaten. Build the pot.' },
        ],
      },
      {
        street: 'turn',
        board: ['9h', '7d', '2c', 'Qh'],
        context: 'BTN calls flop. Pot $69bb. Turn: Qh — overcard and flush draw arrives. BTN checks.',
        prompt: 'Qh turn is a scare card — adds a heart flush draw and overcard. BTN checked. Your JJ is still likely ahead. Bet or give free card?',
        options: [
          { id: 'check', label: 'Check (scared of Q, flush)', quality: 'good', evLoss: 1.5, coaching: 'Checking is fine for pot control on a scare card. But JJ is still strong — BTN would bet with QQ if they had it. Betting charges flush draws.' },
          { id: 'bet', label: 'Bet 35bb (51% pot)', quality: 'perfect', evLoss: 0, coaching: 'Bet the turn. Your JJ is still likely ahead. BTN checking indicates they don\'t have QQ (they would bet). Charge the flush draw and continue extracting value.' },
        ],
      },
      {
        street: 'river',
        board: ['9h', '7d', '2c', 'Qh', '6h'],
        context: 'BTN calls turn. Pot $139bb. River: 6h — flush completes. BTN jams all-in ~$17bb.',
        prompt: 'Flush completes. BTN jams $17bb into a $139bb pot. You need $17 to win $156 — pot odds 9.2:1 (you need only 10.9% equity to call). Apply GTO calling frequency: how often must BTN be bluffing for this call to be profitable?',
        options: [
          { id: 'fold', label: 'Fold JJ (flush hit)', quality: 'mistake', evLoss: 8.5, coaching: 'Folding getting 9:1 pot odds is a massive mistake. At 9:1 odds, you only need to be right ~10% of the time. BTN is bluffing far more than 10% of the time when jamming $17 into $139. Even with the flush, call.' },
          { id: 'call', label: 'Call $17 (9:1 pot odds)', quality: 'perfect', evLoss: 0, coaching: 'Call. GTO analysis: at 9:1 pot odds, BTN needs to be bluffing at least 10% of the time for your call to be profitable. With the short jam sizing, BTN\'s range includes all their missed flush draws, bricked straight draws, and any air hand that decided to jam. They are bluffing far more than 10%. Auto-call at these odds.' },
          { id: 'raise', label: 'Raise all-in', quality: 'good', evLoss: 0.1, coaching: 'Raising is essentially the same as calling since BTN is already all-in. Just call.' },
        ],
      },
    ],
  },

  // ── exp-n05: SPR commitment threshold — TT in 3-bet pot ─────────────────
  {
    id: 'exp-n05-spr-commitment',
    title: 'SPR Commitment — TT in 3-Bet Pot vs C-Bet',
    description: 'Understand Stack-to-Pot Ratio (SPR) and commitment thresholds. Navigate TT in a 3-bet pot where SPR forces a commitment decision on the flop.',
    difficulty: 'expert',
    category: 'SPR Theory',
    gameType: 'cash',
    format: '6-max',
    heroPosition: 'CO',
    villainPosition: 'BTN',
    heroCards: ['Th', 'Tc'],
    effectiveStack: 100,
    stakes: '$1/$2',
    summary: '',
    tags: [],
    steps: [
      {
        street: 'preflop',
        board: [],
        context: 'Folds to CO. You raise to $5. BTN 3-bets to $16. Blinds fold.',
        prompt: 'TT in CO vs BTN 3-bet. Call or 4-bet?',
        options: [
          { id: 'fold', label: 'Fold', quality: 'mistake', evLoss: 8.5, coaching: 'Folding TT to a BTN 3-bet is a massive mistake. TT is a top-10 hand and dominates BTN\'s 3-bet range extensively.' },
          { id: 'call', label: 'Call $11', quality: 'perfect', evLoss: 0, coaching: 'Call the 3-bet with TT. You keep the pot manageable OOP and realize equity on most flops. 4-betting bloats the pot against BTN\'s value range (AA, KK, QQ).' },
          { id: '4bet', label: '4-bet to $40', quality: 'good', evLoss: 1.5, coaching: '4-betting TT is marginal. You build a pot where BTN\'s 5-bet range demolishes you (AA, KK, QQ). Calling is preferred.' },
        ],
      },
      {
        street: 'flop',
        board: ['9s', '7h', '3c'],
        context: 'Pot $34bb. Flop: 9s7h3c. BTN c-bets $22bb. You act OOP.',
        prompt: 'TT is an overpair on 9-7-3. BTN c-bets $22bb (65% pot). SPR = remaining_stack / pot = $73 / $34 = ~2.1. What does SPR 2.1 tell you about your commitment threshold?',
        options: [
          { id: 'fold', label: 'Fold TT (overpair in 3-bet pot)', quality: 'mistake', evLoss: 11, coaching: 'Folding an overpair on a dry 973 board in a 3-bet pot is catastrophic. SPR of 2.1 means you\'re committed to this pot. Folding gives up $17bb of EV.' },
          { id: 'call', label: 'Call $22 (see turn)', quality: 'good', evLoss: 1.8, coaching: 'Calling is fine but you\'re pot-committed. SPR under 3 means TT should be going to showdown. A call followed by a fold later is worse than jamming now.' },
          { id: 'jam', label: 'Jam all-in ($73bb)', quality: 'perfect', evLoss: 0, coaching: 'Jam. SPR 2.1 means you\'re committed with an overpair. At SPR under 3, hands like TT on 973 should stack off. Jamming now maximizes fold equity vs BTN\'s semi-bluffs while committing when behind vs 99, 77, 33. The math and commitment threshold clearly indicate this is a jam.' },
        ],
      },
    ],
  },

  // ── exp-n06: Population exploits — adjust vs recreational player ──────────
  {
    id: 'exp-n06-population-exploits',
    title: 'Population Exploits — Adjust Strategy vs Recreational Player',
    description: 'A recreational player has shown a clear population tendency (always cbets, never bluffs rivers). Exploit their tendencies across three streets.',
    difficulty: 'expert',
    category: 'Exploitative Play',
    gameType: 'cash',
    format: '6-max',
    heroPosition: 'BB',
    villainPosition: 'BTN',
    heroCards: ['Kd', '9h'],
    effectiveStack: 100,
    stakes: '$1/$2',
    summary: '',
    tags: [],
    steps: [
      {
        street: 'preflop',
        board: [],
        context: 'Villain (recreational player) opens BTN every time, always c-bets, never bluffs rivers. BTN raises to $5.',
        prompt: 'Note: villain is a recreational player who always c-bets but never bluffs rivers. BB with K9o — defend or exploit?',
        options: [
          { id: 'fold', label: 'Fold (K9o out of position)', quality: 'mistake', evLoss: 1.2, coaching: 'Against a recreational who opens wide, K9o becomes a solid defend — their range is weak and you can out-play them postflop with knowledge of their tendencies.' },
          { id: 'call', label: 'Call $3', quality: 'perfect', evLoss: 0, coaching: 'Defend. Against a recreational with wide opens, K9o has strong equity. You know their tendencies and can exploit them on multiple streets.' },
        ],
      },
      {
        street: 'flop',
        board: ['Kh', '7d', '3s'],
        context: 'Pot $10bb. Flop: Kh7d3s. You check. BTN c-bets $7bb (as expected — they always c-bet).',
        prompt: 'You top-paired. BTN c-bets as expected. Against a player who ALWAYS c-bets, your call frequency should be higher. How do you exploit this tendency?',
        options: [
          { id: 'fold', label: 'Fold (scared of BTN having something)', quality: 'mistake', evLoss: 6.5, coaching: 'Folding top pair to a player who always c-bets regardless of hand strength is a massive exploit fail. You need to call more, not less, when BTN\'s c-bet means nothing about their hand strength.' },
          { id: 'call', label: 'Call $7 (wait for turn)', quality: 'perfect', evLoss: 0, coaching: 'Call. Against an always-c-bet player, their bet has zero information value. You have top pair and should flat-call, planning to check-raise the turn if they barrel again — or lead the turn when they check (showing they don\'t want to barrel twice).' },
          { id: 'check-raise', label: 'Check-raise to $24', quality: 'good', evLoss: 0.8, coaching: 'Check-raising is aggressive and might fold out BTN\'s entire range. Calling is better — extract more value over multiple streets from a player who over-bets.' },
        ],
      },
      {
        street: 'turn',
        board: ['Kh', '7d', '3s', 'Jc'],
        context: 'You call flop. Pot $24bb. Turn: Jc. BTN checks (unusual — they deviated from pattern).',
        prompt: 'BTN CHECKED the turn — very unusual for this player who always c-bets. This signals genuine weakness. You act OOP. Exploit this with a lead?',
        options: [
          { id: 'check', label: 'Check back (wait for river)', quality: 'mistake', evLoss: 4.8, coaching: 'Checking when BTN showed massive weakness (they always bet) is a exploit fail. Their check signals air — they have nothing. Lead now and take the pot.' },
          { id: 'bet', label: 'Lead $14bb (58% pot)', quality: 'perfect', evLoss: 0, coaching: 'Lead the turn. Against a player who always c-bets, a check is a massive signal — they have nothing. Your K9 is ahead. A turn lead forces BTN to make a decision with a range that is very weak given their check on the turn.' },
        ],
      },
      {
        street: 'river',
        board: ['Kh', '7d', '3s', 'Jc', '2h'],
        context: 'BTN calls turn lead. Pot $52bb. River: 2h — blank. You act OOP. You know: villain NEVER bluffs rivers.',
        prompt: 'River blank. BTN called your turn lead. Recall: this player NEVER bluffs rivers. If they bet the river, they have a real hand. If they check, they have a weak hand. They check. What do you do?',
        options: [
          { id: 'check', label: 'Check (give up value)', quality: 'mistake', evLoss: 6.2, coaching: 'Against a player who never bluffs rivers, their check on the river means they have nothing — they would always bet their good hands. Checking here gives a free showdown to a player who would have bet their good hands.' },
          { id: 'bet', label: 'Lead $28bb (54% pot)', quality: 'perfect', evLoss: 0, coaching: 'Lead for value. Against a never-bluff-river player, their check means total weakness. Your K9 top pair is far ahead of their range. A 54% river lead gets called by any pair or worse Kx they have, and you lose only to a slowplayed set (rare from a recreational who always bets).' },
          { id: 'fold', label: 'Fold (confused about dynamics)', quality: 'mistake', evLoss: 10, coaching: 'There is no reason to fold top pair OOP when the player checked the river. They showed weakness. Bet.' },
        ],
      },
    ],
  },

  // ── exp-n07: Protection vs thin value — J9s on coordinated board ─────────
  {
    id: 'exp-n07-protection-vs-thin-value',
    title: 'Protection vs Thin Value — J9s OOP on Wet Board',
    description: 'You have top pair with backdoor draws on a wet board. Decide when betting is for protection, when it\'s for value, and when the two purposes diverge.',
    difficulty: 'expert',
    category: 'Protection',
    gameType: 'cash',
    format: '6-max',
    heroPosition: 'CO',
    villainPosition: 'BTN',
    heroCards: ['Jc', '9c'],
    effectiveStack: 100,
    stakes: '$1/$2',
    summary: '',
    tags: [],
    steps: [
      {
        street: 'preflop',
        board: [],
        context: 'Folds to CO. You raise to $5. BTN calls. Pot $11bb.',
        prompt: 'J9s from CO — standard open. BTN calls IP. Proceed to flop OOP.',
        options: [
          { id: 'continue', label: 'Note: standard open — proceed to flop', quality: 'perfect', evLoss: 0, coaching: 'J9s is a reasonable CO open. Suited connector with implied odds and good board coverage.' },
        ],
      },
      {
        street: 'flop',
        board: ['Jd', '8h', '7c'],
        context: 'Pot $11bb. Flop: Jd8h7c — very connected. You act first OOP.',
        prompt: 'Top pair on a very connected board (J-8-7 — four-card straight possible with T-9, 6-9). You have JcTc with a gutshot to the straight... wait, JcTc is top pair + open-ender (9 makes straight). How large do you bet for protection AND value?',
        options: [
          { id: 'check', label: 'Check (it\'s too coordinated to bet)', quality: 'mistake', evLoss: 4.5, coaching: 'Checking top pair on a very coordinated board is a mistake. You\'re giving free equity to BTN\'s many draw combinations (T9, T9s, 65, 96, etc.). Protection and value betting are the same action here — bet.' },
          { id: 'bet-small', label: 'Bet 4bb (36% pot) — just value', quality: 'good', evLoss: 1.8, coaching: 'Small bet is OK but doesn\'t charge draws enough. On J87 you need a larger sizing to protect against the plethora of straight draws BTN holds.' },
          { id: 'bet-large', label: 'Bet 9bb (82% pot) — protection sizing', quality: 'perfect', evLoss: 0, coaching: 'Large bet. On J87 two-tone, BTN has an enormous draw range: T9, T6, 96, 65, 86, plus flush draws. You need to charge all of those. Top pair + your own gutshot means you want to build the pot while protecting. Large is correct.' },
        ],
      },
      {
        street: 'turn',
        board: ['Jd', '8h', '7c', 'Tc'],
        context: 'BTN calls flop. Pot $29bb. Turn: Tc — adds clubs flush draw and completes T-9 straight, T-6 straight. You act first OOP.',
        prompt: 'Turn Tc is a disaster card — T9 now has a straight, T6 has a straight, and clubs are a flush draw. BTN called your large flop bet. Your top pair is in trouble. How do you proceed?',
        options: [
          { id: 'barrel', label: 'Barrel $20bb (protection barrel)', quality: 'good', evLoss: 1.2, coaching: 'Barreling is aggressive and might fold out BTN\'s one-pair hands. However, BTN may have connected and called the flop specifically to hit a straight. Betting is fine but check-calling manages risk better.' },
          { id: 'check-fold', label: 'Check-fold', quality: 'mistake', evLoss: 6.8, coaching: 'Folding top pair to a turn scare card without a bet is a mistake. BTN hasn\'t done anything yet — check first, then decide based on their action.' },
          { id: 'check-call', label: 'Check, then call a medium bet', quality: 'perfect', evLoss: 0, coaching: 'Check-call. The Tc is dangerous. By checking, you keep BTN\'s range wide (they might check back with their draw or medium pairs). If BTN bets, you have information — a large bet likely means a made straight, while a small bet might be a draw. Respond appropriately and see the river.' },
        ],
      },
      {
        street: 'river',
        board: ['Jd', '8h', '7c', 'Tc', '2s'],
        context: 'BTN checks turn back. Pot $29bb. River: 2s — blank. You act first OOP.',
        prompt: 'BTN checked the turn! The scare card didn\'t hit them. River 2s is a blank. Your top pair is likely good. Lead for value now?',
        options: [
          { id: 'check', label: 'Check (protect missed draws, induce)', quality: 'good', evLoss: 1.5, coaching: 'Checking to induce a bluff is fine. BTN might bet their missed draws if you check. But leading is slightly more profitable given your top pair is very likely best.' },
          { id: 'bet', label: 'Lead $18bb (62% pot)', quality: 'perfect', evLoss: 0, coaching: 'Lead for value. BTN checked back the scary Tc turn — they have a medium-strength hand (8x, 9x, or a draw that checked for equity). Your top pair is almost certainly best. A medium river lead extracts from their calling range and completes the hand profitably.' },
          { id: 'bet-large', label: 'Bet $28bb (97% pot overbet)', quality: 'mistake', evLoss: 3.2, coaching: 'Overbetting with top pair on a scary board is too aggressive. BTN\'s range after checking the turn is medium-strength — they don\'t call large river bets. Thin value sizing is correct.' },
        ],
      },
    ],
  },

  // ── exp-n08: Equity realization — offsuit hand in bad spot ───────────────
  {
    id: 'exp-n08-equity-realization',
    title: 'Equity Realization — When NOT to Chase',
    description: 'You have a hand with decent raw equity but terrible equity realization. Learn when the EV of continuing is negative despite holding cards that "should" have value.',
    difficulty: 'expert',
    category: 'Equity Realization',
    gameType: 'cash',
    format: '6-max',
    heroPosition: 'BB',
    villainPosition: 'CO',
    heroCards: ['8d', '6c'],
    effectiveStack: 100,
    stakes: '$1/$2',
    summary: '',
    tags: [],
    steps: [
      {
        street: 'preflop',
        board: [],
        context: 'Folds to CO who raises to $5. BTN folds. SB folds. BB (you) with 8d6c.',
        prompt: 'BB with 8d6c offsuit vs CO open. Defend or fold?',
        options: [
          { id: 'fold', label: 'Fold 86o', quality: 'good', evLoss: 0.3, coaching: '86o from BB is a marginal call. It has some equity but very poor equity realization OOP vs CO. Folding is acceptable — it\'s close.' },
          { id: 'call', label: 'Call $3', quality: 'perfect', evLoss: 0, coaching: 'Calling 86o from BB is marginally profitable at good pot odds. You have enough equity in the BB price, but you need to play carefully OOP.' },
          { id: '3bet', label: '3-bet to $16', quality: 'mistake', evLoss: 3.5, coaching: '3-betting 86o OOP from BB is a mistake. The hand doesn\'t have the blocker equity or showdown value to bluff-3-bet effectively against a CO opener.' },
        ],
      },
      {
        street: 'flop',
        board: ['Kh', 'Qd', '7s'],
        context: 'Pot $11bb. Flop: Kh Qd 7s. You check. CO bets $7bb.',
        prompt: 'KQ7 rainbow — you have 86o, a gutshot only (9 for... wait: 8-6 on K-Q-7 — you need 9-5 or 9 for a straight). Actually you have no draw. Your hand is just two undercards with no connection to this board. CO bets. What do you do?',
        options: [
          { id: 'check-raise', label: 'Check-raise bluff $22', quality: 'mistake', evLoss: 8.5, coaching: 'Check-raising with 86o with no equity on KQ7 is a horrible play. You have no outs, no draw, and CO has position and likely a strong hand. This is a massive EV loss.' },
          { id: 'call', label: 'Call $7 (hoping to improve)', quality: 'mistake', evLoss: 4.2, coaching: 'Calling with 86o on KQ7 with no equity is a mistake. You have no draws and the board doesn\'t help you. Every turn card except a 9 leaves you no better off. This is a clear fold — stop paying to see cards when you have no outs.' },
          { id: 'fold', label: 'Fold (no equity, bad spot)', quality: 'perfect', evLoss: 0, coaching: 'Fold immediately. This is the core of equity realization: raw equity matters less than realized equity. 86o on KQ7 has ~6% equity — almost zero. You have no outs and are OOP against a CO who bets. Every call here burns chips. Folding protects your stack for spots where you have genuine equity.' },
        ],
      },
      {
        street: 'turn',
        board: ['Kh', 'Qd', '7s', '5c'],
        context: 'You folded the flop — CORRECT. Now imagine you had called. Pot $25bb. Turn: 5c. You check. CO bets $16bb.',
        prompt: 'If you had floated the flop: turn 5c gives you a gutshot (4 makes a straight with 8-6-5). But you\'re deep in a spot with poor equity realization. CO bets $16bb. What is the correct decision?',
        options: [
          { id: 'call', label: 'Call the turn too (chasing gutshot)', quality: 'mistake', evLoss: 8.2, coaching: 'Calling a turn barrel with a gutshot (4 outs = ~9%) OOP is a big mistake. You need 4 to fill it, and even if you hit, the 4 might not be the best hand. The pot odds (16 to win 57 ≈ 22% needed) don\'t justify calling with only 9% equity. Fold.' },
          { id: 'check-raise', label: 'Check-raise semi-bluff', quality: 'mistake', evLoss: 14, coaching: 'Semi-bluff check-raising with a gutshot OOP vs CO is a disaster. You have 4 outs and CO has position. Even with fold equity, this spot doesn\'t generate enough EV. This is a clear fold.' },
          { id: 'fold', label: 'Fold the gutshot (cut losses)', quality: 'perfect', evLoss: 0, coaching: 'Fold. This is the essence of equity realization: 4 outs at ~9% equity doesn\'t meet the 22% pot odds requirement (16 to win 57). You can\'t realize this equity profitably OOP vs a competent CO. The lesson: avoid bad flop calls to prevent turn equity-chase situations like this.' },
        ],
      },
    ],
  },

]
