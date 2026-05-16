import type { Puzzle } from '../puzzle-types'

// Preflop-focused puzzles that continue through multiple post-flop streets.
// Option ordering: always passive → aggressive (Fold < Call < Raise, Check < Small Bet < Large Bet).
// "perfect" quality is distributed across all three option positions.

export const PUZZLES_PREFLOP: Puzzle[] = [

  // ── 1 ────────────────────────────────────────────────────────────────────
  {
    id: 'pf1-qq-3bet-then-fold',
    title: 'Pocket Queens — 3-bet Then Face Reality',
    description: 'You 3-bet QQ from CO, flop an overpair, but villain\'s check-raise screams strength. Make the correct fold.',
    difficulty: 'intermediate',
    category: '3-bet Pot',
    gameType: 'cash',
    format: '6-max',
    heroPosition: 'CO',
    villainPosition: 'BTN',
    heroCards: ['Qh', 'Qd'],
    effectiveStack: 100,
    stakes: '$1/$2',
    steps: [
      {
        street: 'preflop',
        board: [],
        context: 'BTN opens $5. Folds to CO (hero).',
        prompt: 'CO with QhQd facing BTN open. Fold, call, or 3-bet?',
        options: [
          { id: 'fold',  label: 'Fold',         quality: 'punt',    evLoss: 12,  coaching: 'Folding QQ to a BTN open is an enormous punt. QQ is the second-strongest hand in poker and is always a 3-bet.' },
          { id: 'call',  label: 'Call $5',       quality: 'good',    evLoss: 1,   coaching: 'Calling is fine but suboptimal. QQ should be building the pot pre-flop. 3-betting dominates BTN\'s range and creates a situation where QQ plays very well.' },
          { id: '3bet',  label: '3-bet to $17',  quality: 'perfect', evLoss: 0,   coaching: '3-betting QQ is mandatory. You have a premium hand, position, and want to get value from BTN\'s wide opening range.' },
        ],
      },
      {
        street: 'flop',
        board: ['9s', '5d', '2h'],
        context: 'BTN calls. Pot $35. Flop: 9s5d2h. CO is OOP.',
        prompt: 'QQ as an overpair on a dry 952 board. You act first OOP. Bet or slowplay?',
        options: [
          { id: 'check',   label: 'Check',          quality: 'good',     evLoss: 0.5, coaching: 'Checking to slowplay is valid — the board is dry. However a small bet protects against backdoor draws and builds the pot efficiently.' },
          { id: 'bet_33',  label: 'Bet $11 (31%)',  quality: 'perfect',  evLoss: 0,   coaching: 'Small cbet is optimal. QQ on 952 is strong but not the nuts — charge draws and pairs while keeping BTN\'s range wide.' },
          { id: 'bet_75',  label: 'Bet $26 (74%)',  quality: 'acceptable', evLoss: 1.5, coaching: 'Large cbet on a dry board with an overpair folds out all the medium-strength hands you want value from.' },
        ],
      },
      {
        street: 'turn',
        board: ['9s', '5d', '2h', 'Ah'],
        context: 'Pot $57. Turn: Ah. BTN calls flop, then check-raises: you bet $19, BTN raises to $65.',
        prompt: 'As arrives and BTN check-raises your bet to $65. QQ is now an underpair. Fold, call, or jam?',
        options: [
          { id: 'fold',   label: 'Fold',          quality: 'perfect', evLoss: 0,   coaching: 'Fold is correct. BTN called a 3-bet OOP and check-raised a turn ace. Their range is AA, AK, A9, A5, A2, 99, 55, 22. QQ has minimal equity vs this range. Fold.' },
          { id: 'call',   label: 'Call $46',       quality: 'mistake', evLoss: 6,   coaching: 'Calling faces a very unfavourable river situation. You are investing more money with an underpair on an ace board vs a check-raise from a tight range.' },
          { id: 'jam',    label: 'Jam ~$200',      quality: 'punt',    evLoss: 16,  coaching: 'Jamming QQ into a check-raise on an ace board is a pure punt. You are dominated by virtually everything in BTN\'s range here.' },
        ],
      },
    ],
    summary: 'QQ plays well as a 3-bet but fails when an ace appears and villain check-raises. In 3-bet pots, villain\'s OOP check-raise on a turn ace is one of the highest-strength lines available. Folding an overpair here is correct, disciplined poker.',
    tags: ['QQ', '3bet pot', 'overpair', 'fold vs check-raise', 'IP'],
  },

  // ── 2 ────────────────────────────────────────────────────────────────────
  {
    id: 'pf2-btn-bb-blind-battle',
    title: 'BTN vs BB — Top Two Pair Navigation',
    description: 'BTN opens KQo and hits top two pair. Navigate four streets including a river lead from BB.',
    difficulty: 'beginner',
    category: 'Blind Battle',
    gameType: 'cash',
    format: '6-max',
    heroPosition: 'BTN',
    villainPosition: 'BB',
    heroCards: ['Kd', 'Qs'],
    effectiveStack: 100,
    stakes: '$1/$2',
    steps: [
      {
        street: 'preflop',
        board: [],
        context: 'Folds to BTN (hero).',
        prompt: 'BTN with KdQs. Action folds to you.',
        options: [
          { id: 'fold',   label: 'Fold',        quality: 'mistake', evLoss: 3,   coaching: 'Folding KQo from BTN is a significant error. Strong hand in best position — always open.' },
          { id: 'raise',  label: 'Raise $4.5',  quality: 'perfect', evLoss: 0,   coaching: 'Standard BTN open. KQo has strong equity and excellent steal potential from late position.' },
          { id: 'limp',   label: 'Limp $1',     quality: 'mistake', evLoss: 2,   coaching: 'Limping KQo gives up fold equity. Always raise strong hands in late position.' },
        ],
      },
      {
        street: 'flop',
        board: ['Kh', '7c', '2d'],
        context: 'BB defends. Pot $10. Flop: Kh7c2d. BB checks.',
        prompt: 'TPTK on a dry board. BB checks to you. Check or bet?',
        options: [
          { id: 'check',   label: 'Check',         quality: 'perfect',    evLoss: 0,   coaching: 'Check is optimal on this completely dry board. No draws exist — let BB bluff into you. Checking doesn\'t give up equity and keeps their range wide.' },
          { id: 'bet_33',  label: 'Bet $4 (40%)',  quality: 'good',       evLoss: 0.5, coaching: 'Small bet is reasonable. However, checking on a static dry board slightly outperforms by capturing BB\'s bluffing tendencies.' },
          { id: 'bet_75',  label: 'Bet $8 (80%)',  quality: 'acceptable', evLoss: 1.5, coaching: 'Large sizing folds out the medium-strength hands you want value from. Overkill on this static board.' },
        ],
      },
      {
        street: 'turn',
        board: ['Kh', '7c', '2d', 'Qs'],
        context: 'Pot $10. Turn: Qs. BB checks again.',
        prompt: 'You hit top two pair (KQ on KhQs board). BB checks. Start building the pot.',
        options: [
          { id: 'check',   label: 'Check',          quality: 'mistake',  evLoss: 4,   coaching: 'Checking twice with top two burns a street of value. The Qs improved your hand and may have improved BB\'s range too. Bet now.' },
          { id: 'bet_50',  label: 'Bet $7 (70%)',   quality: 'perfect',  evLoss: 0,   coaching: 'Bet for value. Top two pair on Kh7c2dQs — BB\'s range can now include Qx, Kx, 77, or two-pair hands that will pay you off.' },
          { id: 'bet_100', label: 'Bet $12 (120%)', quality: 'good',     evLoss: 1,   coaching: 'Overbet is aggressive but risks losing the medium-strength hands you want to keep in. Standard sizing is more efficient.' },
        ],
      },
      {
        street: 'river',
        board: ['Kh', '7c', '2d', 'Qs', 'Ac'],
        context: 'Pot $24. River: Ac. BB calls turn and leads out $18.',
        prompt: 'BB leads the river $18 into $24 on the Ac. You have top two pair (KQ). The Ac is a scare card.',
        options: [
          { id: 'fold',    label: 'Fold',          quality: 'mistake',    evLoss: 5,   coaching: 'Folding top two pair at 2.3:1 pot odds is too tight. BB\'s lead range includes bluffs and weaker made hands. The math says call.' },
          { id: 'call',    label: 'Call $18',       quality: 'perfect',   evLoss: 0,   coaching: 'Call. Getting 2.3:1 pot odds you need to be right ~30% of the time. BB\'s river lead range includes many bluffs and weaker made hands that can\'t beat two pair.' },
          { id: 'raise',   label: 'Raise to $55',   quality: 'acceptable', evLoss: 2,  coaching: 'Raising for value is possible but risky — BB\'s lead on an ace does include Ax hands that beat you. Calling is a much cleaner play here.' },
        ],
      },
    ],
    summary: 'In BTN vs BB battles, check TPTK on dry boards to let villain bluff. When you hit two pair on the turn, start betting. On the river when pot odds are favourable and villain\'s lead range includes bluffs, calling with two pair is mathematically correct.',
    tags: ['blind battle', 'BTN vs BB', 'top two', 'pot odds', 'river call'],
  },

  // ── 3 ────────────────────────────────────────────────────────────────────
  {
    id: 'pf3-4bet-kk-wet-board',
    title: '4-Bet Pot with KK — Top Set on Wet Board',
    description: 'You 4-bet KK and hit top set on a very wet board. Navigate a low-SPR spot and get all the chips in.',
    difficulty: 'advanced',
    category: '4-bet Pot',
    gameType: 'cash',
    format: '6-max',
    heroPosition: 'BTN',
    villainPosition: 'UTG',
    heroCards: ['Kh', 'Kd'],
    effectiveStack: 100,
    stakes: '$2/$5',
    steps: [
      {
        street: 'preflop',
        board: [],
        context: 'UTG opens $15. Folds to BTN (hero).',
        prompt: 'BTN with KhKd. UTG opens $15. 3-bet or flat?',
        options: [
          { id: 'fold',  label: 'Fold',          quality: 'punt',    evLoss: 15,  coaching: 'Folding KK is an enormous punt regardless of opener position.' },
          { id: 'call',  label: 'Call $15',       quality: 'good',    evLoss: 1,   coaching: 'Flatting KK in position is occasionally done to keep weaker hands in, but 3-betting builds the pot and is standard.' },
          { id: '3bet',  label: '3-bet to $42',   quality: 'perfect', evLoss: 0,   coaching: 'Standard 3-bet with KK. Build the pot with a premium hand and force UTG to define their range.' },
        ],
      },
      {
        street: 'flop',
        board: ['Ks', '9d', '8d'],
        context: 'UTG 4-bets to $100. Hero calls. Pot $205. Flop: Ks9d8d. UTG checks.',
        prompt: 'Top set in a 4-bet pot on a very wet board. UTG checks. Bet large or check?',
        options: [
          { id: 'check',   label: 'Check',          quality: 'mistake',  evLoss: 6,   coaching: 'Checking top set on a wet board is too passive. Flush draws and straight draws present — charge them now.' },
          { id: 'bet_33',  label: 'Bet $65 (32%)',  quality: 'good',     evLoss: 1,   coaching: 'Small bet builds pot but under-charges the many draws. Board is wet — a larger sizing is appropriate.' },
          { id: 'bet_66',  label: 'Bet $130 (63%)', quality: 'perfect',  evLoss: 0,   coaching: 'Large bet for value and protection. Top set on Ks9d8d — many draws, connected board. Charge them correctly and build toward a stack-off.' },
        ],
      },
      {
        street: 'turn',
        board: ['Ks', '9d', '8d', '2c'],
        context: 'UTG calls flop. Pot ~$465. Turn: 2c (blank). UTG checks. SPR is now very low.',
        prompt: 'Blank turn, very low SPR. UTG checks. Jam all-in or bet smaller?',
        options: [
          { id: 'check',   label: 'Check',          quality: 'acceptable', evLoss: 3,  coaching: 'Checking is possible to induce, but with a very low SPR and the nuts, getting all in is optimal.' },
          { id: 'bet_50',  label: 'Bet $175 (38%)', quality: 'good',      evLoss: 1,   coaching: 'Betting is correct. Sizing up to a jam would be better — UTG has called a 4-bet and a large flop bet, they are pot-committed.' },
          { id: 'jam',     label: 'Jam all-in',      quality: 'perfect',   evLoss: 0,   coaching: 'Jam all-in. Very low SPR, top set, wet board. UTG is committed — get the money in and don\'t give free cards.' },
        ],
      },
    ],
    summary: 'In 4-bet pots with sets on wet boards, bet large on the flop to charge draws and build the pot. With a very low SPR on the turn, jamming is correct — villain is committed and giving free cards vs strong draws is too costly.',
    tags: ['4bet pot', 'KK', 'set', 'wet board', 'SPR', 'jam'],
  },

  // ── 4 ────────────────────────────────────────────────────────────────────
  {
    id: 'pf4-co-oop-check-strategy',
    title: 'CO OOP — Checking Strategy with TPTK',
    description: 'Open from CO, BTN calls. Navigate a single-raised pot OOP with TPTK using checking as a weapon.',
    difficulty: 'intermediate',
    category: 'SRP',
    gameType: 'cash',
    format: '6-max',
    heroPosition: 'CO',
    villainPosition: 'BTN',
    heroCards: ['Ah', 'Qd'],
    effectiveStack: 100,
    stakes: '$1/$2',
    steps: [
      {
        street: 'preflop',
        board: [],
        context: 'Folds to CO (hero).',
        prompt: 'CO with AhQd. Open, fold, or limp?',
        options: [
          { id: 'fold',   label: 'Fold',        quality: 'punt',    evLoss: 7,   coaching: 'Folding AQo from CO is a massive punt. Always play premium hands.' },
          { id: 'raise',  label: 'Raise to $5', quality: 'perfect', evLoss: 0,   coaching: 'Standard CO open. AQo is a strong hand in any position and should always be raised.' },
          { id: 'limp',   label: 'Limp $1',     quality: 'mistake', evLoss: 2,   coaching: 'Limping strong hands gives up fold equity and creates a poorly-defined range. Always raise AQo.' },
        ],
      },
      {
        street: 'flop',
        board: ['As', '8c', '4d'],
        context: 'BTN calls. Pot $11. Flop: As8c4d. CO is OOP.',
        prompt: 'TPTK on a dry board, OOP. Check or bet?',
        options: [
          { id: 'check',   label: 'Check',          quality: 'perfect',    evLoss: 0,   coaching: 'Checking is best OOP with TPTK on a static board. BTN has a wide range — checking induces bluffs and keeps their weak holdings alive for future streets.' },
          { id: 'bet_33',  label: 'Bet $4 (36%)',   quality: 'good',       evLoss: 0.5, coaching: 'Small bet is fine but OOP checking typically outperforms by capturing BTN\'s bluffing equity on dry boards.' },
          { id: 'bet_75',  label: 'Bet $8 (73%)',   quality: 'acceptable', evLoss: 1.5, coaching: 'Large bet OOP on a dry board is inefficient. You fold out weaker hands you want value from.' },
        ],
      },
      {
        street: 'turn',
        board: ['As', '8c', '4d', 'Kh'],
        context: 'Pot $11. Turn: Kh. Both checked flop.',
        prompt: 'Both players checked the flop. Kh came. You act first OOP — start betting or check again?',
        options: [
          { id: 'check',   label: 'Check',          quality: 'mistake',  evLoss: 3,   coaching: 'Checking twice with TPTK misses a full street of value. BTN has shown weakness — start betting now.' },
          { id: 'bet_50',  label: 'Bet $7 (64%)',   quality: 'perfect',  evLoss: 0,   coaching: 'Bet for value. BTN double-checked, capping their range. The Kh may have improved their hand (Kx) — extract value now across two streets.' },
          { id: 'bet_100', label: 'Bet $13 (118%)', quality: 'good',     evLoss: 1,   coaching: 'Overbet is ambitious. Standard sizing keeps more of BTN\'s range in and extracts more total value.' },
        ],
      },
      {
        street: 'river',
        board: ['As', '8c', '4d', 'Kh', '3s'],
        context: 'Pot $25. River: 3s blank. BTN calls turn.',
        prompt: 'BTN called the turn. Blank river — you act first OOP. Extract thin value?',
        options: [
          { id: 'check',   label: 'Check',           quality: 'good',     evLoss: 1.5, coaching: 'Checking is safe but leaves EV. A small bet extracts from Kx and weaker Ax that will call.' },
          { id: 'bet_33',  label: 'Bet $9 (36%)',    quality: 'perfect',  evLoss: 0,   coaching: 'Lead for thin value. BTN showed calling willingness. Small sizing extracts from Kx, 8x and weaker Ax hands that call the river but fold to a big bet.' },
          { id: 'bet_75',  label: 'Bet $20 (80%)',   quality: 'acceptable', evLoss: 2, coaching: 'Large sizing risks folding the hands you want to extract from. With TPTK on a safe board, smaller is better.' },
        ],
      },
    ],
    summary: 'OOP in SRPs with TPTK, check the flop to induce bluffs. When both players check and BTN shows weakness on the turn, start betting. Extract thin river value with small sizing against a capped calling range.',
    tags: ['TPTK', 'OOP', 'SRP', 'checking strategy', 'thin value'],
  },

  // ── 5 ────────────────────────────────────────────────────────────────────
  {
    id: 'pf5-sb-qq-bluffcatch',
    title: 'SB 3-bet — QQ as Bluff-Catcher on Ace Board',
    description: 'You 3-bet QQ from SB, flop the nightmare ace, and use queens as a bluff-catcher through four streets.',
    difficulty: 'intermediate',
    category: 'Bluff Catching',
    gameType: 'cash',
    format: '6-max',
    heroPosition: 'SB',
    villainPosition: 'BTN',
    heroCards: ['Qh', 'Qc'],
    effectiveStack: 100,
    stakes: '$1/$2',
    steps: [
      {
        street: 'preflop',
        board: [],
        context: 'BTN opens $5. SB (hero) with QhQc.',
        prompt: 'QQ in SB facing BTN open. Fold, call, or 3-bet?',
        options: [
          { id: 'fold',  label: 'Fold',        quality: 'punt',    evLoss: 12,  coaching: 'Never fold QQ. Premium hand — always re-raising.' },
          { id: 'call',  label: 'Call $4',      quality: 'good',    evLoss: 1,   coaching: 'Calling is fine but suboptimal. 3-betting QQ makes dominated hands pay.' },
          { id: '3bet',  label: '3-bet to $17', quality: 'perfect', evLoss: 0,   coaching: '3-betting QQ is correct. Build the pot, isolate BTN, and get value from dominated hands.' },
        ],
      },
      {
        street: 'flop',
        board: ['Ah', '7c', '2d'],
        context: 'BTN calls. Pot $35. Flop: Ah7c2d.',
        prompt: 'You 3-bet QQ and hit the nightmare flop: ace high. OOP in a 3-bet pot. Check or bet?',
        options: [
          { id: 'check',   label: 'Check',          quality: 'perfect',    evLoss: 0,   coaching: 'Check is the only correct play. QQ is a bluff-catcher on an ace-high board OOP. Betting folds out weaker hands and only gets called by Ax.' },
          { id: 'bet_33',  label: 'Bet $11 (31%)',  quality: 'mistake',    evLoss: 3.5, coaching: 'Betting QQ on an ace board OOP turns your hand into a bluff. BTN only continues with Ax.' },
          { id: 'bet_66',  label: 'Bet $23 (66%)',  quality: 'punt',       evLoss: 7,   coaching: 'Large bet OOP with QQ on an ace board is a significant punt. You have no fold equity and are giving away money.' },
        ],
      },
      {
        street: 'turn',
        board: ['Ah', '7c', '2d', 'Jd'],
        context: 'Pot $35. Turn: Jd. You checked flop. BTN bets $20.',
        prompt: 'BTN bets $20 on the Jd turn after you checked flop. QQ is a bluff-catcher. Call or fold?',
        options: [
          { id: 'fold',    label: 'Fold',          quality: 'mistake',  evLoss: 5,   coaching: 'Folding QQ after one bet at 2.75:1 pot odds is too tight. BTN has KQ, KT, QJ, 98 type hands. Call and see the river.' },
          { id: 'call',    label: 'Call $20',       quality: 'perfect',  evLoss: 0,   coaching: 'Call. Getting 2.75:1 pot odds — you need to be right only 27% of the time. BTN\'s range has enough bluffs to make this a profitable call.' },
          { id: 'raise',   label: 'Raise to $60',   quality: 'mistake',  evLoss: 4,   coaching: 'Raising QQ on an ace-board is terrible. You fold out all bluffs and get called only by Ax or better. Never raise your bluff-catchers.' },
        ],
      },
      {
        street: 'river',
        board: ['Ah', '7c', '2d', 'Jd', '5c'],
        context: 'Pot $75. River: 5c blank. BTN jams for $63.',
        prompt: 'BTN jams the river $63 into $75 (~2.2:1 pot odds). Call or fold with QQ?',
        options: [
          { id: 'fold',    label: 'Fold',         quality: 'mistake',  evLoss: 6,   coaching: 'Folding QQ at 2.2:1 odds is too tight. You need to be right only ~31% of the time. BTN can easily have KQ, QJ, 98, or missed draws. Call.' },
          { id: 'call',    label: 'Call $63',      quality: 'perfect',  evLoss: 0,   coaching: 'Call. At 2.2:1 pot odds you need 31% equity. BTN\'s jamming range includes KQ, QJ, and any missed draw — QQ is clearly worth a call here.' },
          { id: 'raise',   label: 'Re-raise jam',  quality: 'punt',     evLoss: 5,   coaching: 'BTN is already all-in. You can\'t re-raise. Even if you could: re-raising a bluff-catching hand into a polar jam is wrong.' },
        ],
      },
    ],
    summary: 'With QQ on ace boards in 3-bet pots, check flop and use as a bluff-catcher. Call down with good pot odds — never raise. On the river at 2.2:1 odds facing a jam, calling with QQ is mathematically correct. Pot odds, not hand strength, drives river decisions.',
    tags: ['3bet pot', 'QQ', 'bluff-catch', 'OOP', 'pot odds', 'ace board'],
  },

  // ── 6 ────────────────────────────────────────────────────────────────────
  {
    id: 'pf6-utg-ajoff-fold-to-3bet',
    title: 'UTG Opens AJo — Fold to 3-bet',
    description: 'Open UTG with AJo, then face a CO 3-bet. Recognise when AJo is dominated and fold.',
    difficulty: 'intermediate',
    category: 'Preflop Decision',
    gameType: 'cash',
    format: '6-max',
    heroPosition: 'UTG',
    villainPosition: 'CO',
    heroCards: ['Ah', 'Jc'],
    effectiveStack: 100,
    stakes: '$1/$2',
    steps: [
      {
        street: 'preflop',
        board: [],
        context: 'Hero is UTG. Action to you.',
        prompt: 'UTG with AhJc. Open, fold, or limp?',
        options: [
          { id: 'fold',   label: 'Fold',        quality: 'mistake',  evLoss: 3,   coaching: 'Folding AJo UTG is too tight in 6-max. AJo is in UTG\'s opening range — raise it.' },
          { id: 'raise',  label: 'Raise to $5', quality: 'perfect',  evLoss: 0,   coaching: 'Standard UTG open with AJo. In 6-max, AJo is a clear open from any position.' },
          { id: 'limp',   label: 'Limp $1',     quality: 'mistake',  evLoss: 2,   coaching: 'Limping AJo gives up fold equity. Always raise your value range.' },
        ],
      },
      {
        street: 'preflop',
        board: [],
        context: 'UTG raises $5. CO 3-bets to $16. Folds back to UTG (hero).',
        prompt: 'CO 3-bets to $16. You have AhJc in UTG. Fold, call, or 4-bet?',
        options: [
          { id: 'fold',    label: 'Fold',         quality: 'perfect',    evLoss: 0,   coaching: 'Folding is correct. CO\'s 3-bet range (AA, KK, QQ, AK, AQ) dominates AJo — you are outkicked by every value combo. OOP vs a tight 3-bet with a dominated hand, fold.' },
          { id: 'call',    label: 'Call $11',      quality: 'acceptable', evLoss: 2.5, coaching: 'Calling is viable with implied odds, but OOP against a tight 3-bet range with AJo is difficult. Folding is slightly higher EV.' },
          { id: '4bet',    label: '4-bet to $42',  quality: 'mistake',    evLoss: 5,   coaching: '4-betting AJo into CO\'s 3-bet range is a big mistake. You are crushed by AA, KK, QQ, AK, and AQ — all of CO\'s value hands.' },
        ],
      },
    ],
    summary: 'AJo is a standard UTG open in 6-max, but becomes a fold facing a CO 3-bet. CO\'s 3-bet range dominates AJo entirely (AA, KK, QQ, AK, AQ). Recognising when strong-looking hands are dominated by 3-bet ranges is a key intermediate skill.',
    tags: ['UTG open', 'AJo', 'fold to 3-bet', 'range dominance', 'preflop'],
  },

  // ── 7 ────────────────────────────────────────────────────────────────────
  {
    id: 'pf7-bb-squeeze-set-then-jam',
    title: 'BB vs Squeeze — Hit a Set and Get Stacks In',
    description: 'UTG opens, BTN cold-calls, SB squeezes. You defend BB with 88. Hit top set on the flop.',
    difficulty: 'advanced',
    category: 'Squeeze',
    gameType: 'cash',
    format: '6-max',
    heroPosition: 'BB',
    villainPosition: 'SB',
    heroCards: ['8h', '8d'],
    effectiveStack: 100,
    stakes: '$1/$2',
    steps: [
      {
        street: 'preflop',
        board: [],
        context: 'UTG opens $5. BTN cold-calls. SB squeezes to $22. Action on BB (hero) with 8h8d.',
        prompt: 'BB with 88 vs squeeze. Fold, call, or 4-bet?',
        options: [
          { id: 'fold',    label: 'Fold',          quality: 'perfect',   evLoss: 0,   coaching: 'Folding is the cleanest play. SB squeezes a tight range (TT+, AK, AQs). You\'d play OOP multiway against strong ranges. Even with implied odds from setmining, this is marginal at best and fold is fine.' },
          { id: 'call',    label: 'Call $20',       quality: 'acceptable', evLoss: 2,  coaching: 'Calling has merit with implied odds for setmining. Marginally worse than folding against a tight squeeze range while OOP multiway.' },
          { id: '4bet',    label: '4-bet to $65',   quality: 'punt',      evLoss: 8,   coaching: '4-betting 88 into SB\'s tight squeeze range is a punt. Their value range (TT+, AK) dominates 88.' },
        ],
      },
      {
        street: 'flop',
        board: ['8c', '5d', '2h'],
        context: 'Hero calls squeeze. UTG + BTN fold. SB and BB HU. Pot $46. Flop: 8c5d2h. SB cbets $28.',
        prompt: 'Top set on a dry board! SB cbets $28. Call or raise?',
        options: [
          { id: 'fold',    label: 'Fold',           quality: 'punt',     evLoss: 30,  coaching: 'Never fold the nuts.' },
          { id: 'call',    label: 'Call $28',        quality: 'perfect',  evLoss: 0,   coaching: 'Slow-play the flop. Top set on a dry board with SB having a tight squeeze range — they may have AK, QQ, JJ that fire again. Keep their range wide by calling.' },
          { id: 'raise',   label: 'Raise to $75',    quality: 'good',     evLoss: 1,   coaching: 'Raising is fine but may fold out SB\'s weak value hands. Calling retains more of their bluffing/weak range for later streets.' },
        ],
      },
      {
        street: 'turn',
        board: ['8c', '5d', '2h', 'Qd'],
        context: 'Pot $102. Turn: Qd. SB fires $65 after you called flop.',
        prompt: 'SB double-barrels $65 on Qd turn. Top set still. Raise now or call again?',
        options: [
          { id: 'fold',    label: 'Fold',           quality: 'punt',    evLoss: 35,  coaching: 'You have top set. Never fold.' },
          { id: 'call',    label: 'Call $65',        quality: 'good',    evLoss: 1,   coaching: 'Calling one more time keeps SB\'s range wide. But the Qd improved SB\'s range — raising now extracts more value.' },
          { id: 'raise',   label: 'Raise to $180',   quality: 'perfect', evLoss: 0,   coaching: 'Raise now. The Qd likely improved SB\'s range (QQ, KQ, KdJd) and they have pot-committed themselves. Top set needs to build toward a stack-off. Raise and get the money in.' },
        ],
      },
    ],
    summary: 'Against tight squeeze ranges, folding 88 OOP multiway is defensible, but if you call and hit a set, slow-play the flop to keep their range wide. When the turn improves villain\'s range and they keep firing, raise for value and build toward a stack-off with the nuts.',
    tags: ['88', 'set', 'squeeze', 'OOP', 'slow play', 'turn raise'],
  },

]
