import type { Puzzle } from '../puzzle-types'

// Option ordering rule: always passive → aggressive (left to right)
// Fold/Check < Call/Small-bet < Raise/Large-bet/Jam
// Correct answer ("perfect") is distributed across all three positions

export const PUZZLES_STARTER: Puzzle[] = [

  // ── 1 ────────────────────────────────────────────────────────────────────
  {
    id: 's1-bb-defend-calldown',
    title: 'BB Defense — Calling Down Top Pair',
    description: 'BTN fires three streets on a dry ace-high board. Navigate four decisions from defence through thin river value.',
    difficulty: 'beginner',
    category: 'SRP',
    gameType: 'cash',
    format: '6-max',
    heroPosition: 'BB',
    villainPosition: 'BTN',
    heroCards: ['Ah', 'Td'],
    effectiveStack: 100,
    stakes: '$1/$2',
    steps: [
      {
        street: 'preflop',
        board: [],
        context: 'Folds to BTN who raises to $5. SB folds.',
        prompt: 'Action on BB with AhTd. Defend or 3-bet?',
        options: [
          { id: 'fold',  label: 'Fold',         quality: 'mistake',  evLoss: 2.5, coaching: 'ATo is a clear BB defend vs a wide BTN steal range. You are getting 2.5:1 pot odds and hold strong equity. Never fold here.' },
          { id: 'call',  label: 'Call $3',       quality: 'perfect',  evLoss: 0,   coaching: 'Standard defend. ATo vs BTN is a routine call — good pot odds, strong equity, and you close the action. Correct.' },
          { id: '3bet',  label: '3-bet to $16',  quality: 'good',     evLoss: 0.5, coaching: 'ATo can be a light 3-bet but calling is marginally higher EV. OOP in a 3-bet pot with ATo is awkward; flatting keeps the pot smaller and BTN\'s weaker hands in range.' },
        ],
      },
      {
        street: 'flop',
        board: ['Ac', '6s', '3d'],
        context: 'Pot $11. Flop: Ac6s3d. You check. BTN bets $6 (55%).',
        prompt: 'TPTK on a dry rainbow board. BTN cbets $6. Your move?',
        options: [
          { id: 'fold',   label: 'Fold',         quality: 'punt',    evLoss: 12,  coaching: 'Never fold TPTK on a dry board. BTN cbets a very wide range here. This would be a massive punt.' },
          { id: 'call',   label: 'Call $6',       quality: 'perfect', evLoss: 0,   coaching: 'Calling TPTK on a static dry board is optimal. You keep BTN\'s bluffs, 9x, 8x, and second pairs in range. The board needs no protection.' },
          { id: 'raise',  label: 'Raise to $20',  quality: 'good',    evLoss: 1,   coaching: 'Raising is fine but folds out weaker hands you want to keep in. On a dry texture flatting extracts more total value across all streets.' },
        ],
      },
      {
        street: 'turn',
        board: ['Ac', '6s', '3d', '9h'],
        context: 'Pot $23. Turn: 9h (blank). You check. BTN double-barrels $16.',
        prompt: 'Second barrel on a brick turn. TPTK still strong. Continue?',
        options: [
          { id: 'fold',   label: 'Fold',          quality: 'mistake',    evLoss: 7,   coaching: 'Folding TPTK on Ac6s3d9h is way too weak. BTN still holds KQ, KJ, missed floats, 87, etc. The board gives them no reason to suddenly have the nuts.' },
          { id: 'call',   label: 'Call $16',       quality: 'perfect',   evLoss: 0,   coaching: 'Correct. BTN fires again but the board is still static. Call with top pair top kicker and re-evaluate river.' },
          { id: 'raise',  label: 'Raise to $50',   quality: 'acceptable', evLoss: 2.5, coaching: 'Check-raising with just TPTK on a dry board turns your hand into a bluff. You fold out bluffs and get called only by better. Calling is clearly better.' },
        ],
      },
      {
        street: 'river',
        board: ['Ac', '6s', '3d', '9h', '2c'],
        context: 'Pot $55. River: 2c (blank). BTN checks to you.',
        prompt: 'BTN checked the brick river. Extract thin value or play it safe?',
        options: [
          { id: 'check',    label: 'Check',         quality: 'good',     evLoss: 2,   coaching: 'Checking is safe but leaves EV. BTN\'s range is capped — they check their missed draws and medium pairs. A small bet extracts from Ax weaker than yours.' },
          { id: 'bet_33',   label: 'Bet $18 (33%)', quality: 'perfect',  evLoss: 0,   coaching: 'Lead for thin value. BTN\'s range is capped after two barrels and a check. Small sizing extracts from A7, A5, 99, 66 type hands that check-call but fold to a big bet.' },
          { id: 'bet_75',   label: 'Bet $42 (76%)', quality: 'acceptable', evLoss: 2,  coaching: 'Large bet risks folding all the weaker Ax and pairs you want value from. Small sizing extracts more in total from BTN\'s capped calling range.' },
        ],
      },
    ],
    summary: 'In BB vs BTN single-raised pots, call down TPTK on dry boards — BTN\'s range is wide and bluff-heavy. On safe rivers where BTN checks, lead small to extract thin value from their capped range. Never fold or over-raise with top pair on dry textures.',
    tags: ['SRP', 'top pair', 'BB defense', 'call-down', 'river value'],
  },

  // ── 2 ────────────────────────────────────────────────────────────────────
  {
    id: 's2-set-slowplay-extract',
    title: 'Flopped Set — Slowplay and Extract',
    description: 'You open BTN and flop bottom set on a dry board. Decide when to slowplay and when to start building the pot.',
    difficulty: 'beginner',
    category: 'Value Betting',
    gameType: 'cash',
    format: '6-max',
    heroPosition: 'BTN',
    villainPosition: 'BB',
    heroCards: ['7c', '7s'],
    effectiveStack: 100,
    stakes: '$1/$2',
    steps: [
      {
        street: 'preflop',
        board: [],
        context: 'Folds to BTN (hero). BB is the only other player.',
        prompt: 'You have 7c7s on the BTN. Action folds to you.',
        options: [
          { id: 'fold',   label: 'Fold',         quality: 'punt',    evLoss: 6,   coaching: 'Folding 77 on the BTN is a massive punt. Pocket sevens is a strong hand in late position with wide steal equity.' },
          { id: 'raise',  label: 'Raise to $5',  quality: 'perfect', evLoss: 0,   coaching: 'Standard BTN open with 77. You have a strong hand, good position, and steal equity. Always raising here.' },
          { id: 'limp',   label: 'Limp $1',      quality: 'mistake', evLoss: 2,   coaching: 'Limping from BTN gives up fold equity and creates a poorly-defined range. Always open-raise your value hands from late position.' },
        ],
      },
      {
        street: 'flop',
        board: ['7h', '2d', '4c'],
        context: 'BB defends. Pot $11. Flop: 7h2d4c. BB checks.',
        prompt: 'You flopped bottom set on a dry rainbow board. BB checks to you.',
        options: [
          { id: 'check',   label: 'Check',        quality: 'perfect',   evLoss: 0,   coaching: 'Checking is optimal. The board is completely static with no draws. Slow-playing keeps BB\'s entire range in — bluffs, weak pairs, any pocket pair. Sets want wide ranges to continue.' },
          { id: 'bet_33',  label: 'Bet $4 (36%)', quality: 'good',      evLoss: 0.5, coaching: 'Small bet is also fine but you risk thinning BB\'s range unnecessarily. Checking retains more bluffs and weak pairs that will pay you later.' },
          { id: 'bet_75',  label: 'Bet $9 (82%)', quality: 'mistake',   evLoss: 2,   coaching: 'Large sizing on the nuts on a dry board folds out most of BB\'s range. You want to keep them in, not drive them out.' },
        ],
      },
      {
        street: 'turn',
        board: ['7h', '2d', '4c', 'Qs'],
        context: 'Pot $11. Turn: Qs. BB checks again after the free flop.',
        prompt: 'Q arrived on the turn. BB checks. Time to start building?',
        options: [
          { id: 'check',   label: 'Check',         quality: 'mistake',  evLoss: 4,   coaching: 'Checking twice with the nuts burns a street of value. The Qs improves BB\'s range with Qx hands. You need to start building the pot now.' },
          { id: 'bet_55',  label: 'Bet $7 (64%)',  quality: 'perfect',  evLoss: 0,   coaching: 'Bet for value. The Q may have improved BB\'s range (Qx hands, two-pair) — they will now pay you off. Build the pot for a big river value bet.' },
          { id: 'bet_110', label: 'Bet $13 (118%)', quality: 'good',    evLoss: 1,   coaching: 'Overbet is aggressive but risks folding the medium-strength hands you want to extract from. Standard sizing is more efficient here.' },
        ],
      },
      {
        street: 'river',
        board: ['7h', '2d', '4c', 'Qs', 'Kd'],
        context: 'Pot $25. River: Kd. BB calls turn bet and checks again.',
        prompt: 'River Kd. BB called two streets. What is the ideal river sizing?',
        options: [
          { id: 'check',   label: 'Check',         quality: 'mistake',  evLoss: 6,   coaching: 'Never check back the nuts on a river when villain called two streets. BB has Kx or Qx and is not folding. Missing this value bet is a major leak.' },
          { id: 'bet_55',  label: 'Bet $16 (64%)', quality: 'good',     evLoss: 1.5, coaching: 'Medium bet works but undersizes. BB called twice and now the Kd hit their range (KQ, KJ, Kx). A larger bet extracts more.' },
          { id: 'bet_85',  label: 'Bet $24 (96%)', quality: 'perfect',  evLoss: 0,   coaching: 'Large sizing is correct. BB called two streets — their range is strong Kx and Qx hands that don\'t fold. Go for maximum value with the nuts.' },
        ],
      },
    ],
    summary: 'With sets on dry boards, slow-play the flop to keep villain\'s range wide. When turn cards improve villain\'s range, start betting. On rivers with strong calling tendencies shown, go for large value — never check back the nuts facing a calling range.',
    tags: ['set', 'slow play', 'SRP', 'value sizing', 'BTN vs BB'],
  },

  // ── 3 ────────────────────────────────────────────────────────────────────
  {
    id: 's3-3bet-ak-dry-board',
    title: '3-bet Pot IP — AK Top Pair vs Check-Raise',
    description: 'You 3-bet AK from CO, flop top pair, and face a critical check-raise on the turn. Respect the strength.',
    difficulty: 'intermediate',
    category: '3-bet Pot',
    gameType: 'cash',
    format: '6-max',
    heroPosition: 'CO',
    villainPosition: 'BTN',
    heroCards: ['Ah', 'Kd'],
    effectiveStack: 100,
    stakes: '$1/$2',
    steps: [
      {
        street: 'preflop',
        board: [],
        context: 'BTN opens $5. Folds to CO (hero).',
        prompt: 'You have AhKd in the CO. BTN opened $5.',
        options: [
          { id: 'fold',  label: 'Fold',          quality: 'punt',    evLoss: 8,   coaching: 'Folding AKo in CO vs BTN is a massive punt. AKo is one of the strongest hands in poker and is always a 3-bet or call.' },
          { id: 'call',  label: 'Call $5',        quality: 'good',    evLoss: 1,   coaching: 'Calling is fine but suboptimal with AKo. You should be 3-betting to build the pot and gain range advantage.' },
          { id: '3bet',  label: '3-bet to $17',   quality: 'perfect', evLoss: 0,   coaching: '3-betting AKo is standard. You have a premium hand, position, and dominate BTN\'s calling range. Building the pot now is optimal.' },
        ],
      },
      {
        street: 'flop',
        board: ['Ad', '7c', '2h'],
        context: 'BTN calls. Pot $35. Flop: Ad7c2h. BTN checks.',
        prompt: 'TPTK in a 3-bet pot. BTN checks to you. Bet or slowplay?',
        options: [
          { id: 'check',   label: 'Check',         quality: 'acceptable', evLoss: 1.5, coaching: 'Checking is a valid slow-play but gives BTN a free card with overcards and backdoor draws. Small bet is more efficient.' },
          { id: 'bet_33',  label: 'Bet $11 (31%)', quality: 'perfect',    evLoss: 0,   coaching: 'Small cbet is ideal on this dry ace-high board. BTN\'s range is wide but capped — keep it in with a small sizing. You protect against backdoor draws while building the pot.' },
          { id: 'bet_66',  label: 'Bet $23 (66%)', quality: 'good',       evLoss: 0.5, coaching: 'Medium sizing is fine but folds out too many medium-strength hands. This board is so static that a small bet gets called by more of BTN\'s range.' },
        ],
      },
      {
        street: 'turn',
        board: ['Ad', '7c', '2h', 'Jd'],
        context: 'Pot $57. Turn: Jd (diamond draw arrived). BTN calls flop, then check-raises: you bet $19, BTN raises to $55.',
        prompt: 'BTN check-raises your turn bet to $55 on the Jd turn. AK is now TPTK with a backdoor draw. Fold, call, or 4-bet?',
        options: [
          { id: 'fold',    label: 'Fold',          quality: 'perfect',   evLoss: 0,   coaching: 'Folding is correct. BTN called a 3-bet OOP and check-raised the turn when a flush draw arrived. This range is heavily weighted to Jd-x, AJ, KdQd, 77, 22. TPTK is not strong enough to continue vs a check-raise in a 3-bet pot.' },
          { id: 'call',    label: 'Call $36',       quality: 'mistake',   evLoss: 5,   coaching: 'Calling faces a very unfavorable spot — you invest more money with a hand that is likely losing or drawing thin. BTN\'s check-raise range here is extremely strong.' },
          { id: '4bet',    label: '4-bet to $140',  quality: 'punt',      evLoss: 14,  coaching: 'Jamming into a BTN check-raise with just TPTK in a 3-bet pot is a big punt. BTN\'s range is very narrow and strong in this line.' },
        ],
      },
    ],
    summary: 'In 3-bet pots, respect aggressive check-raises on turn cards that hit villain\'s cold-calling range. BTN\'s range vs a 3-bet is tight — a check-raise on a flush-draw turn means significant strength. Fold TPTK without the nut draw and preserve your stack.',
    tags: ['3bet pot', 'AK', 'TPTK', 'fold', 'check-raise'],
  },

  // ── 4 ────────────────────────────────────────────────────────────────────
  {
    id: 's4-bb-float-draw-hit',
    title: 'BB Float — Hit the Flush on the Turn',
    description: 'You defend the BB with suited connectors, float a dry flop, and hit the nut flush on the turn.',
    difficulty: 'intermediate',
    category: 'SRP',
    gameType: 'cash',
    format: '6-max',
    heroPosition: 'BB',
    villainPosition: 'BTN',
    heroCards: ['Kh', 'Jh'],
    effectiveStack: 100,
    stakes: '$1/$2',
    steps: [
      {
        street: 'preflop',
        board: [],
        context: 'BTN raises to $5. SB folds.',
        prompt: 'BB with KhJh facing BTN open. Defend, fold, or 3-bet?',
        options: [
          { id: 'fold',  label: 'Fold',         quality: 'mistake',  evLoss: 2,   coaching: 'Folding KJs in the BB is too tight. You have strong equity, pot odds, and a suited hand that hits many flops. Defending is clearly correct.' },
          { id: 'call',  label: 'Call $3',       quality: 'perfect',  evLoss: 0,   coaching: 'KJs is a standard BB defend. Good equity, suited, and you close the action at a good price. Correct play.' },
          { id: '3bet',  label: '3-bet to $15',  quality: 'good',     evLoss: 0.5, coaching: 'KJs can work as a light 3-bet from BB but calling is marginally better. OOP in a 3-bet pot with KJs is less comfortable than defending and playing post-flop in position.' },
        ],
      },
      {
        street: 'flop',
        board: ['9c', '5d', '2s'],
        context: 'Pot $11. Flop: 9c5d2s (dry). You check. BTN bets $7.',
        prompt: 'BTN cbets a dry board. You have KhJh — two overcards, no pair, no draw. Float or fold?',
        options: [
          { id: 'fold',   label: 'Fold',          quality: 'mistake',  evLoss: 2,   coaching: 'Folding is too tight with KJh here. You have two overcards and significant implied odds if hearts arrive. BTN cbets very wide — floating is profitable.' },
          { id: 'call',   label: 'Call $7',        quality: 'perfect',  evLoss: 0,   coaching: 'Float with two overcards and implied odds. BTN cbets this board heavily. If you hit a K, J, or two hearts you make a strong hand. Calling is correct.' },
          { id: 'raise',  label: 'Raise to $22',   quality: 'mistake',  evLoss: 3,   coaching: 'Check-raising with no pair on a dry board is too aggressive. You fold out weaker hands and only get called by pairs and better. No equity to justify a raise here.' },
        ],
      },
      {
        street: 'turn',
        board: ['9c', '5d', '2s', 'Ah'],
        context: 'Pot $25. Turn: Ah. BTN checks after you called the flop.',
        prompt: 'Turn Ah — you now have the nut flush draw (KhJh on board with Ah). BTN checks. Your action?',
        options: [
          { id: 'check',   label: 'Check',          quality: 'acceptable', evLoss: 2,  coaching: 'Checking takes a free river but burns semi-bluff equity and pot equity. You have a powerful semi-bluff with the NFD + backdoor straight draws.' },
          { id: 'bet_50',  label: 'Bet $13 (52%)',  quality: 'perfect',    evLoss: 0,  coaching: 'Bet with the nut flush draw. You have ~35% equity and significant fold equity. Semi-bluffing with the NFD in position after BTN shows weakness is clearly correct.' },
          { id: 'bet_100', label: 'Bet $26 (104%)', quality: 'good',       evLoss: 1,  coaching: 'Large bet is also valid with the NFD but slightly ambitious. You risk being called by strong hands that don\'t fold, making medium sizing more efficient.' },
        ],
      },
      {
        street: 'river',
        board: ['9c', '5d', '2s', 'Ah', '7h'],
        context: 'Pot $51. River: 7h (nut flush arrives!). BTN calls turn. BTN checks.',
        prompt: 'You made the nut flush (Kh-Jh-Ah on board). BTN checked. How much to bet?',
        options: [
          { id: 'check',   label: 'Check',          quality: 'mistake',  evLoss: 10,  coaching: 'Never check back the nut flush on a river when villain shows calling tendency. BTN called your turn bet — they have something. Extract maximum value.' },
          { id: 'bet_55',  label: 'Bet $30 (59%)',  quality: 'good',     evLoss: 1.5, coaching: 'Medium bet extracts value but undersizes. BTN called the turn showing real hand strength. A larger bet is more appropriate.' },
          { id: 'bet_85',  label: 'Bet $50 (98%)',  quality: 'perfect',  evLoss: 0,   coaching: 'Large bet for max value. BTN called the turn — they have Ax, 9x, or some strong holding. With the nut flush, go for full value. They cannot beat you.' },
        ],
      },
    ],
    summary: 'Float dry cbets with overcards and implied odds. When you pick up the nut flush draw on the turn, semi-bluff aggressively in position. Once the flush hits on the river, go for maximum value — villain\'s calling range cannot beat a nut flush.',
    tags: ['float', 'NFD', 'semi-bluff', 'IP', 'SRP', 'nut flush'],
  },

  // ── 5 ────────────────────────────────────────────────────────────────────
  {
    id: 's5-sb-squeeze-tt',
    title: 'SB Squeeze with Pocket Tens',
    description: 'UTG opens, BTN cold-calls. Squeeze from SB with TT. Navigate a 3-bet pot OOP and make a disciplined fold.',
    difficulty: 'intermediate',
    category: 'Squeeze',
    gameType: 'cash',
    format: '6-max',
    heroPosition: 'SB',
    villainPosition: 'BTN',
    heroCards: ['Tc', 'Td'],
    effectiveStack: 100,
    stakes: '$1/$2',
    steps: [
      {
        street: 'preflop',
        board: [],
        context: 'UTG opens $5. BTN cold-calls. Action on SB with TcTd.',
        prompt: 'TT in SB facing UTG open + BTN cold-call. Squeeze, call, or fold?',
        options: [
          { id: 'fold',    label: 'Fold',          quality: 'mistake',    evLoss: 5,   coaching: 'Folding TT facing open + cold-call from SB is far too tight. TT is strong enough to squeeze, deny equity, and get called by worse.' },
          { id: 'call',    label: 'Call $4',        quality: 'acceptable', evLoss: 2,   coaching: 'Calling plays TT multiway OOP — not ideal. Squeezing is higher EV: you isolate UTG, deny BTN equity, and force definitions from their ranges.' },
          { id: 'squeeze', label: 'Squeeze to $22', quality: 'perfect',   evLoss: 0,   coaching: 'Squeezing is correct with TT. You deny equity to both players, build a pot, and get dominated hands (AJ, KQ, 99) to define themselves. Standard play.' },
        ],
      },
      {
        street: 'flop',
        board: ['Jd', '8c', '3s'],
        context: 'BTN folds. UTG calls squeeze. Pot $47. Flop: Jd8c3s. UTG checks.',
        prompt: 'HU in a 3-bet pot OOP with TcTd. Board: Jd8c3s. UTG checks to you.',
        options: [
          { id: 'check',   label: 'Check',          quality: 'good',     evLoss: 1,   coaching: 'Checking back with TT on a connected board is fine to balance your range. However, TT needs some protection and a small bet accomplishes more.' },
          { id: 'bet_33',  label: 'Bet $16 (34%)',  quality: 'perfect',  evLoss: 0,   coaching: 'Small cbet is optimal. TT on J8-3 needs to charge draws and build the pot. Small sizing keeps UTG\'s entire range (98s, A8, KQ) in while protecting your overpair.' },
          { id: 'bet_75',  label: 'Bet $36 (77%)',  quality: 'acceptable', evLoss: 2,  coaching: 'Large cbet is too big on a connected board with just an overpair. You fold out all the weaker hands you want to keep in and only get called by better.' },
        ],
      },
      {
        street: 'turn',
        board: ['Jd', '8c', '3s', 'As'],
        context: 'Pot $79. Turn: As. UTG calls flop cbet and then check-raises: you bet $27, UTG raises to $80.',
        prompt: 'As falls and UTG check-raises your bet to $80. TT is now just an underpair. Fold, call, or jam?',
        options: [
          { id: 'fold',    label: 'Fold',          quality: 'perfect',   evLoss: 0,   coaching: 'Fold is the only correct play here. UTG flatted a 3-bet OOP and check-raised the turn after an ace appeared. Their range is heavily Ax, JJ, 88, 33, AJ. TT has minimal equity. Fold and move on.' },
          { id: 'call',    label: 'Call $53',       quality: 'mistake',   evLoss: 6,   coaching: 'Calling puts you in a terrible spot investing more money as a significant underdog. UTG\'s range here is almost always beating TT.' },
          { id: 'jam',     label: 'Jam $200',       quality: 'punt',      evLoss: 16,  coaching: 'Jamming TT into a check-raise on Jd8c3sAs is an enormous punt. UTG\'s range is very narrow and almost always has you crushed.' },
        ],
      },
    ],
    summary: 'Squeezing with TT is correct against open + cold-call. Post-flop, use small cbets to protect overpairs on connected boards. When villain check-raises on a turn that significantly improves their range, respect the strength and fold medium-strength hands like TT.',
    tags: ['squeeze', '3bet pot', 'OOP', 'TT', 'fold to check-raise'],
  },

  // ── 6 ────────────────────────────────────────────────────────────────────
  {
    id: 's6-btn-nfd-semibluff-giveup',
    title: 'Nut Flush Draw — Semi-Bluff and Give Up',
    description: 'You have the NFD in position. Fire on the flop, but when the flush misses and villain shows strength, check it back.',
    difficulty: 'intermediate',
    category: 'Semi-Bluff',
    gameType: 'cash',
    format: '6-max',
    heroPosition: 'BTN',
    villainPosition: 'BB',
    heroCards: ['Ah', 'Jh'],
    effectiveStack: 100,
    stakes: '$1/$2',
    steps: [
      {
        street: 'preflop',
        board: [],
        context: 'Folds to BTN (hero). BB is only remaining player.',
        prompt: 'BTN with AhJh. Action folds to you.',
        options: [
          { id: 'fold',   label: 'Fold',         quality: 'punt',    evLoss: 6,   coaching: 'Folding AJs on the BTN is a major punt. You have a premium hand with a nut flush draw component and strong equity.' },
          { id: 'raise',  label: 'Raise to $5',  quality: 'perfect', evLoss: 0,   coaching: 'Standard BTN open with AJs. Premium hand, best position, always raising here.' },
          { id: 'limp',   label: 'Limp $1',      quality: 'mistake', evLoss: 2,   coaching: 'Limping AJs on BTN gives up fold equity and creates a poorly-defined range. Always raise this hand.' },
        ],
      },
      {
        street: 'flop',
        board: ['Qh', '9c', '3h'],
        context: 'BB defends. Pot $11. Flop: Qh9c3h. BB checks.',
        prompt: 'NFD with two overcards on Qh9c3h. BB checks. Semi-bluff, check, or overbet?',
        options: [
          { id: 'check',   label: 'Check',         quality: 'acceptable', evLoss: 2,   coaching: 'Checking is fine to balance your range, but with ~38% equity (NFD + two overcards) and fold equity, betting is significantly higher EV.' },
          { id: 'bet_55',  label: 'Bet $7 (64%)',  quality: 'perfect',    evLoss: 0,   coaching: 'Bet with the NFD. You have strong semi-bluff equity — ~38% against any pair. Fold equity plus draw equity makes this a profitable bet at medium sizing.' },
          { id: 'bet_100', label: 'Bet $12 (109%)', quality: 'good',      evLoss: 1,   coaching: 'Betting large is valid but overkill. Medium sizing captures the same fold equity without over-investing on a draw.' },
        ],
      },
      {
        street: 'turn',
        board: ['Qh', '9c', '3h', 'Kd'],
        context: 'Pot $25. Turn: Kd. BB calls flop and now donk-bets $16 into the pot.',
        prompt: 'BB donk-leads $16 on the Kd turn. You still have the NFD. Fold, call, or raise?',
        options: [
          { id: 'fold',   label: 'Fold',          quality: 'mistake',    evLoss: 4,   coaching: 'Never fold a nut flush draw getting 2.5:1 pot odds. Even if the raise is wrong, calling is always correct with ~30% equity.' },
          { id: 'call',   label: 'Call $16',       quality: 'perfect',   evLoss: 0,   coaching: 'Call. The Kd may have improved BB\'s range (Kx hands). You still have ~30% equity with the NFD and are getting good pot odds. Calling is correct.' },
          { id: 'raise',  label: 'Raise to $48',   quality: 'acceptable', evLoss: 2,   coaching: 'Raising is tempting as a semi-bluff but BB led into you showing strength. Your fold equity is reduced. Calling is marginally higher EV here.' },
        ],
      },
      {
        street: 'river',
        board: ['Qh', '9c', '3h', 'Kd', '2s'],
        context: 'Pot $57. River: 2s. Flush missed. BB checks to you.',
        prompt: 'Flush missed. BB checked after donk-leading the turn. Bluff, or take the free showdown?',
        options: [
          { id: 'check',   label: 'Check',          quality: 'perfect',  evLoss: 0,   coaching: 'Check back and take the free showdown. You have ace-high with no made hand. BB led the turn showing strength then checked the river — your bluff has minimal fold equity. Know when to stop.' },
          { id: 'bluff_50', label: 'Bet $35 (61%)', quality: 'mistake',  evLoss: 3.5, coaching: 'Bluffing into a player who led the turn is low EV. BB has shown a real hand. They checked the river likely to bluff-catch, not because they\'re weak.' },
          { id: 'jam',     label: 'Jam $70',         quality: 'punt',     evLoss: 8,   coaching: 'Jamming after a missed draw vs someone who donk-led the turn is a major punt. BB is not folding a real hand to an overbet bluff here.' },
        ],
      },
    ],
    summary: 'With NFDs in position, bet for semi-bluff value when villain checks. When villain shows strength by donk-betting, call with strong draws. When the flush misses and villain has shown real hand strength, take the free showdown rather than fire a low-equity bluff.',
    tags: ['NFD', 'semi-bluff', 'IP', 'give up', 'missed draw'],
  },

  // ── 7 ────────────────────────────────────────────────────────────────────
  {
    id: 's7-oesd-river-value',
    title: 'Open-Ended Straight Draw — Hit and Extract',
    description: 'Float a flop with OESD, call the turn with strong odds, then hit the straight on the river and raise for max value.',
    difficulty: 'intermediate',
    category: 'SRP',
    gameType: 'cash',
    format: 'Heads-Up',
    heroPosition: 'BTN',
    villainPosition: 'BB',
    heroCards: ['5h', '6h'],
    effectiveStack: 100,
    stakes: '$1/$2',
    steps: [
      {
        street: 'flop',
        board: ['4h', '7c', 'Kd'],
        context: 'BTN (hero) opens $4, BB defends. Pot $8. Flop: 4h7cKd. BB checks.',
        prompt: 'HU. You have 5h6h — OESD (3 or 8 makes a straight). BB checks.',
        options: [
          { id: 'check',   label: 'Check',         quality: 'good',     evLoss: 0.5, coaching: 'Checking is fine and takes a free card, but in HU poker cbetting with 30% equity + fold equity is slightly higher EV.' },
          { id: 'bet_55',  label: 'Bet $5 (63%)',  quality: 'perfect',  evLoss: 0,   coaching: 'Cbet with the OESD in position. HU poker rewards aggression — you have ~30% equity and significant fold equity vs BB\'s wide defending range.' },
          { id: 'overbet', label: 'Bet $11 (138%)', quality: 'acceptable', evLoss: 1.5, coaching: 'Overbetting with just a draw is over-investing. Your OESD isn\'t strong enough to overbet — a standard sizing achieves the same fold equity.' },
        ],
      },
      {
        street: 'turn',
        board: ['4h', '7c', 'Kd', '2s'],
        context: 'Pot $18. Turn: 2s. BB calls flop and donk-leads $12.',
        prompt: 'BB donk-leads $12 on the brick 2s turn. Your OESD still has 8 outs. Fold, call, or raise?',
        options: [
          { id: 'fold',   label: 'Fold',          quality: 'mistake',   evLoss: 4,   coaching: 'Folding an OESD getting 2.5:1 pot odds is incorrect. You have ~17% equity and are getting profitable odds. This is a clear call.' },
          { id: 'call',   label: 'Call $12',       quality: 'perfect',  evLoss: 0,   coaching: 'Call. You have 8 outs to a straight and are getting 2.5:1 pot odds — clearly profitable. A donk-bet doesn\'t always mean enormous strength in HU poker.' },
          { id: 'raise',  label: 'Raise to $36',   quality: 'mistake',  evLoss: 3.5, coaching: 'Raising with a pure draw into a donk-bet is over-aggressive. You fold out weak hands and get called by strong made hands. Take the good odds and see the river.' },
        ],
      },
      {
        street: 'river',
        board: ['4h', '7c', 'Kd', '2s', '3d'],
        context: 'Pot $42. River: 3d. You made a straight (3-4-5-6-7 using 5h6h). BB bets $30 into $42.',
        prompt: 'You hit the straight! BB bets $30 into $42. Raise for max value or just call?',
        options: [
          { id: 'fold',   label: 'Fold',          quality: 'punt',    evLoss: 25,  coaching: 'You have a straight. Never fold.' },
          { id: 'call',   label: 'Call $30',       quality: 'good',    evLoss: 2,   coaching: 'Calling is too passive. BB led into you — they have a real hand that will pay off a raise. Only calling misses significant value.' },
          { id: 'raise',  label: 'Raise to $90',   quality: 'perfect', evLoss: 0,   coaching: 'Raise immediately. You have a straight and BB bet into you — they have a strong holding (K7, 77, 44, KJ, etc.). This is the time to extract maximum value.' },
        ],
      },
    ],
    summary: 'In HU play, cbet frequently with draws for fold equity plus draw equity. When pot odds justify it, call with OESDs even vs donk-bets. When you hit your draw and villain is betting into you, always raise — they have a real hand and will pay you off.',
    tags: ['HU', 'OESD', 'semi-bluff', 'straight', 'value raise'],
  },

  // ── 8 ────────────────────────────────────────────────────────────────────
  {
    id: 's8-river-hero-call',
    title: 'River Hero Call — Top Two Pair vs Polarised Jam',
    description: 'You slowplay top two pair OOP in a 3-bet pot, raise the turn, and face a river jam. Make the math-based call.',
    difficulty: 'advanced',
    category: 'Bluff Catching',
    gameType: 'cash',
    format: '6-max',
    heroPosition: 'BB',
    villainPosition: 'BTN',
    heroCards: ['As', 'Jd'],
    effectiveStack: 125,
    stakes: '$2/$5',
    steps: [
      {
        street: 'flop',
        board: ['Ad', 'Jh', '6c'],
        context: 'BTN opens $15, BB 3-bets to $50, BTN calls. Pot $103. Flop: AdJh6c. BB checks.',
        prompt: 'Top two pair in a 3-bet pot OOP. You check. What is your plan?',
        options: [
          { id: 'check',   label: 'Check (slowplay)', quality: 'perfect',    evLoss: 0,   coaching: 'Checking is optimal. You have top two on a dry board — let BTN stab with air and bluffs. Check-raising the turn or calling down are both profitable from here.' },
          { id: 'bet_33',  label: 'Bet $34 (33%)',    quality: 'good',       evLoss: 0.5, coaching: 'Small cbet is fine — gets money in early. However, checking induces BTN to bluff and provides more information, which may be marginally higher EV.' },
          { id: 'bet_75',  label: 'Bet $77 (75%)',    quality: 'acceptable', evLoss: 2,   coaching: 'Large bet with the nuts on a dry board folds out too many weaker hands. Smaller sizing or checking allows more of BTN\'s range to continue.' },
        ],
      },
      {
        street: 'turn',
        board: ['Ad', 'Jh', '6c', '9d'],
        context: 'Pot $103. Turn: 9d (diamond draw arrived). BTN bets $65 after your check.',
        prompt: 'BTN bets $65 into $103 on a turn that brought a flush draw. You have top two pair.',
        options: [
          { id: 'fold',    label: 'Fold',           quality: 'punt',      evLoss: 30,  coaching: 'Never fold top two pair here. You have a monster hand.' },
          { id: 'call',    label: 'Call $65',        quality: 'good',      evLoss: 1.5, coaching: 'Calling keeps BTN\'s bluffs in but misses protection against diamond draws. Raising is more profitable when a flush draw is present.' },
          { id: 'raise',   label: 'Raise to $180',   quality: 'perfect',   evLoss: 0,   coaching: 'Raise for value and protection. The 9d brings real draws (diamonds, T8, 87). Your two pair is excellent but not the nuts — get money in now. BTN will call with many hands you beat.' },
        ],
      },
      {
        street: 'river',
        board: ['Ad', 'Jh', '6c', '9d', '2h'],
        context: 'BTN calls raise. Pot ~$463. River: 2h (flush draw bricked). BTN jams for $250.',
        prompt: 'River brick. BTN jams $250 into $463 (~2.85:1 pot odds). Call or fold with top two pair?',
        options: [
          { id: 'fold',    label: 'Fold',          quality: 'mistake',   evLoss: 8,   coaching: 'Folding top two pair at 2.85:1 pot odds is too tight. You need to be right only ~26% of the time. BTN can have T8, KdQd, 87, or pure air bluffs. The math heavily favours calling.' },
          { id: 'call',    label: 'Call $250',      quality: 'perfect',  evLoss: 0,   coaching: 'Call. Getting 2.85:1 you need ~26% to be correct. BTN\'s range includes T8 (straight), busted diamond draws, and air bluffs. Top two pair is a clear call at these odds.' },
          { id: 'raise',   label: 'Raise (reraise)', quality: 'punt',    evLoss: 5,   coaching: 'Re-raising into a jam makes no sense — BTN is already all-in. But if they weren\'t: re-raising with just two pair into a polarised jam is never correct.' },
        ],
      },
    ],
    summary: 'With top two pair in 3-bet pots, slowplay dry flops and raise wet turns to charge draws. On brick rivers facing a polarised jam, calculate pot odds and call — top two pair is a strong enough bluff-catcher when you only need to be right ~26% of the time.',
    tags: ['hero call', 'two pair', 'river', 'bluff-catch', 'pot odds', '3bet pot'],
  },

]
