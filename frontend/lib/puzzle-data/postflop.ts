import type { Puzzle } from '../puzzle-types'

// Postflop-focused puzzles: realistic multi-street hands with diverse scenarios.
// Option ordering: always passive → aggressive (Fold/Check < Call/Small-bet < Raise/Large-bet/Jam).
// "perfect" quality is distributed across all three option positions.

export const PUZZLES_POSTFLOP: Puzzle[] = [

  // ── 1 ────────────────────────────────────────────────────────────────────
  {
    id: 'po1-co-vs-btn-cbetting-oop',
    title: 'CO vs BTN — Multi-Street Value with TPTK',
    description: 'You open CO, BTN calls. Navigate a 3-street spot OOP with TPTK, charging draws and extracting river value.',
    difficulty: 'intermediate',
    category: 'SRP',
    gameType: 'cash',
    format: '6-max',
    heroPosition: 'CO',
    villainPosition: 'BTN',
    heroCards: ['Ac', 'Ks'],
    effectiveStack: 100,
    stakes: '$1/$2',
    steps: [
      {
        street: 'flop',
        board: ['Ad', '8h', '5s'],
        context: 'CO opens $5, BTN calls. Pot $11. Flop: Ad8h5s. CO is OOP.',
        prompt: 'TPTK OOP on a semi-dry board. What is your cbet strategy?',
        options: [
          { id: 'check',   label: 'Check',          quality: 'acceptable', evLoss: 1.5, coaching: 'Checking is possible to balance your range, but OOP with TPTK on a board with backdoor draws, betting a small amount is slightly higher EV.' },
          { id: 'bet_33',  label: 'Bet $4 (36%)',   quality: 'perfect',    evLoss: 0,   coaching: 'Small cbet OOP with TPTK is optimal. You keep BTN\'s full range in — 8x, 5x, gutshots — while building the pot. This board benefits from a thin-sizing approach.' },
          { id: 'bet_75',  label: 'Bet $9 (82%)',   quality: 'good',       evLoss: 0.5, coaching: 'Medium bet also works. However, OOP with TPTK on this semi-dry board, smaller sizing keeps more weaker hands in BTN\'s range.' },
        ],
      },
      {
        street: 'turn',
        board: ['Ad', '8h', '5s', 'Jd'],
        context: 'Pot $19. Turn: Jd (diamond draw arrived). BTN calls flop.',
        prompt: 'Turn Jd brings a flush draw. BTN called the flop. You act first OOP — continue betting or take a free card?',
        options: [
          { id: 'check',   label: 'Check',          quality: 'mistake',  evLoss: 3,   coaching: 'Checking with TPTK and a flush draw present is a mistake. You give BTN a free card to hit their diamond draw. Betting is clearly correct to charge the draw.' },
          { id: 'bet_40',  label: 'Bet $11 (58%)',  quality: 'perfect',  evLoss: 0,   coaching: 'Bet for value and protection. Flush draw now present — charge it. TPTK is still strong and betting here extracts from Jx, 8x while denying free cards to diamonds.' },
          { id: 'bet_80',  label: 'Bet $17 (89%)',  quality: 'good',     evLoss: 0.5, coaching: 'Larger bet is also fine but may fold out Jx-type hands you want to keep in. Medium sizing is more efficient with TPTK here.' },
        ],
      },
      {
        street: 'river',
        board: ['Ad', '8h', '5s', 'Jd', '2c'],
        context: 'Pot $41. River: 2c (flush draw bricked). BTN calls turn.',
        prompt: 'Flush bricked. BTN called two streets. You act first OOP — what is your river sizing?',
        options: [
          { id: 'check',   label: 'Check',           quality: 'mistake',  evLoss: 5,   coaching: 'Checking back TPTK on a brick river when villain called two bets is a large EV mistake. Their range is strong enough to call a value bet.' },
          { id: 'bet_50',  label: 'Bet $22 (54%)',   quality: 'good',     evLoss: 1.5, coaching: 'Medium bet extracts value. However, BTN called two streets — their range is Jx, Ax second kicker, or slow-played two-pair. Larger sizing extracts more.' },
          { id: 'bet_80',  label: 'Bet $36 (88%)',   quality: 'perfect',  evLoss: 0,   coaching: 'Large river value bet is correct. BTN called two bets including through a flush draw turn — their range is committed. TPTK on a brick river goes for maximum extraction.' },
        ],
      },
    ],
    summary: 'OOP with TPTK, use small cbets to keep ranges wide but always charge flush draws when they appear on the turn. On brick rivers after two calls, go for large value — villain\'s range is committed and won\'t fold a made hand.',
    tags: ['TPTK', 'OOP', 'SRP', 'flush draw', 'river value'],
  },

  // ── 2 ────────────────────────────────────────────────────────────────────
  {
    id: 'po2-btn-bluff-wet-board',
    title: 'BTN Semi-Bluff on Wet Board — When to Fire',
    description: 'You open BTN, BB defends. Pick up a flush draw on the flop. Decide how to play a multi-street semi-bluff.',
    difficulty: 'intermediate',
    category: 'Semi-Bluff',
    gameType: 'cash',
    format: '6-max',
    heroPosition: 'BTN',
    villainPosition: 'BB',
    heroCards: ['Jh', 'Th'],
    effectiveStack: 100,
    stakes: '$1/$2',
    steps: [
      {
        street: 'flop',
        board: ['Qh', '8h', '3c'],
        context: 'BTN opens $5, BB defends. Pot $11. Flop: Qh8h3c. BB checks.',
        prompt: 'JhTh — flush draw + gutshot to a straight. BB checks. Semi-bluff, check, or overbet?',
        options: [
          { id: 'check',   label: 'Check',          quality: 'acceptable', evLoss: 1.5, coaching: 'Checking takes a free card and is valid, but with ~42% equity (flush draw + gutshot) and fold equity, betting is significantly higher EV in position.' },
          { id: 'bet_55',  label: 'Bet $7 (64%)',   quality: 'perfect',    evLoss: 0,   coaching: 'Bet with strong semi-bluff equity. JTh on Qh8h3c has massive equity — flush draw, gutshot to J-high straight. Betting medium builds the pot and has strong fold equity.' },
          { id: 'bet_110', label: 'Bet $14 (127%)', quality: 'good',       evLoss: 1,   coaching: 'Overbet is valid with a strong draw but over-risks the hand. Medium sizing is more efficient and lets you fire multiple streets.' },
        ],
      },
      {
        street: 'turn',
        board: ['Qh', '8h', '3c', 'As'],
        context: 'Pot $25. Turn: As. BB calls flop and checks.',
        prompt: 'As on the turn. BB called flop and checks. Still have flush draw + gutshot. Fire or check?',
        options: [
          { id: 'check',   label: 'Check',          quality: 'perfect',   evLoss: 0,   coaching: 'Check the turn. The As is a terrible card for your hand — it may have improved BB\'s range significantly (Ax hands). Your fold equity dropped. Take a free river card with your draw.' },
          { id: 'bet_50',  label: 'Bet $13 (52%)',  quality: 'acceptable', evLoss: 2,  coaching: 'Betting into the As is risky. BB called the flop and Ax hands are a large part of their range. Your fold equity is significantly reduced. Checking is higher EV here.' },
          { id: 'jam',     label: 'Jam $95',         quality: 'punt',      evLoss: 8,   coaching: 'Jamming into BB\'s improved range (Ax hands) on the As turn is a punt. You have a draw, not a made hand, and fold equity is minimal after BB called the flop.' },
        ],
      },
      {
        street: 'river',
        board: ['Qh', '8h', '3c', 'As', '7h'],
        context: 'Pot $25. River: 7h — flush hits! BB checks.',
        prompt: 'You made the flush! BB checks. How much to bet for value?',
        options: [
          { id: 'check',   label: 'Check',           quality: 'mistake',  evLoss: 8,   coaching: 'Never check back a flush when you have a strong hand and villain checks the river. Their range includes Ax, Qx, two-pair — all paying you off.' },
          { id: 'bet_55',  label: 'Bet $16 (64%)',   quality: 'good',     evLoss: 1.5, coaching: 'Medium bet extracts value. However, BB showed calling strength on the flop and then checked the As turn (weak) — they may have a hand that pays off a larger bet.' },
          { id: 'bet_85',  label: 'Bet $24 (96%)',   quality: 'perfect',  evLoss: 0,   coaching: 'Large bet for max value. You have a flush and BB has shown calling tendencies. River checks after the scare As indicate they have a made hand but not the nut flush. Extract max value.' },
        ],
      },
    ],
    summary: 'With strong draws in position, bet for semi-bluff equity on the flop. When the turn worsens your fold equity (scare card improves villain\'s range), take a free card with your draw. When the flush hits on the river, go for maximum value — never check back the flush.',
    tags: ['semi-bluff', 'flush draw', 'IP', 'turn check', 'river value'],
  },

  // ── 3 ────────────────────────────────────────────────────────────────────
  {
    id: 'po3-two-pair-wet-board-protection',
    title: 'Two Pair — Protection on Wet Board',
    description: 'You flop two pair in position on a connected board. Protect your hand and build the pot correctly.',
    difficulty: 'intermediate',
    category: 'Value Betting',
    gameType: 'cash',
    format: '6-max',
    heroPosition: 'BTN',
    villainPosition: 'BB',
    heroCards: ['Jc', 'Ts'],
    effectiveStack: 100,
    stakes: '$1/$2',
    steps: [
      {
        street: 'flop',
        board: ['Jd', 'Tc', '6h'],
        context: 'BTN opens $5, BB defends. Pot $11. Flop: Jd Tc 6h. BB checks.',
        prompt: 'You flopped top two pair (JT on JT6). BB checks. Connected board — bet for protection?',
        options: [
          { id: 'check',   label: 'Check',          quality: 'mistake',  evLoss: 3,   coaching: 'Checking top two pair on a connected board (7-8-9 or Q-K-A makes straights) is too passive. You need to charge straight draws now.' },
          { id: 'bet_50',  label: 'Bet $7 (64%)',   quality: 'perfect',  evLoss: 0,   coaching: 'Bet for protection and value. JTc6 is a very connected board — 89, Q8, Q9, 87, 78 all have straight draws. Build the pot now and charge the draws.' },
          { id: 'bet_100', label: 'Bet $13 (118%)', quality: 'good',     evLoss: 0.5, coaching: 'Larger bet is also effective for protection. Slightly risks folding out weaker holdings, but top two pair on this wet board warrants strong sizing.' },
        ],
      },
      {
        street: 'turn',
        board: ['Jd', 'Tc', '6h', '9s'],
        context: 'Pot $25. Turn: 9s — possible gutshot connections. BB calls and checks.',
        prompt: 'Turn 9s: now Q8 has a straight. You still have top two pair. BB checks. Continue?',
        options: [
          { id: 'check',   label: 'Check',          quality: 'mistake',  evLoss: 4,   coaching: 'Checking top two pair after a 9 completed some draws is too passive. You need to keep charging — many hands still have draws and you want to build the pot before a river completes more.' },
          { id: 'bet_50',  label: 'Bet $16 (64%)',  quality: 'perfect',  evLoss: 0,   coaching: 'Continue betting. JT on JT69 board is still strong and you need to charge straight draws that are still present (87, 78, KQ). Bet medium and build toward the river.' },
          { id: 'bet_100', label: 'Bet $28 (112%)', quality: 'good',     evLoss: 1,   coaching: 'Large bet is valid and protects well. Standard sizing achieves the same goal — both are correct. Medium is slightly more efficient in terms of range capture.' },
        ],
      },
      {
        street: 'river',
        board: ['Jd', 'Tc', '6h', '9s', '2d'],
        context: 'Pot $57. River: 2d (blank — no straight completed). BB calls turn and leads $30.',
        prompt: 'BB leads $30 on the river blank. You have top two pair. Fold, call, or raise?',
        options: [
          { id: 'fold',    label: 'Fold',           quality: 'mistake',  evLoss: 7,   coaching: 'Folding top two pair at 2.9:1 pot odds is too tight. BB\'s range includes bluffs with missed draws and weaker made hands that beat you.' },
          { id: 'call',    label: 'Call $30',        quality: 'perfect',  evLoss: 0,   coaching: 'Call. You have top two pair and are getting 2.9:1 pot odds — need to be right ~26% of the time. BB\'s lead range includes missed draws, J6, T6, and bluffs. Calling is clear.' },
          { id: 'raise',   label: 'Raise to $80',    quality: 'acceptable', evLoss: 2,  coaching: 'Raising is possible for thin value but risky — BB\'s lead may include the straight you\'re behind to. Calling is a safer and cleaner play.' },
        ],
      },
    ],
    summary: 'On wet boards with two pair, bet for both value and protection — connected boards have too many draws to check. When draws miss and villain leads the river, pot odds drive your decision. At 2.9:1, calling top two pair is clear even though villain\'s range may include straights.',
    tags: ['two pair', 'wet board', 'protection', 'river call', 'pot odds'],
  },

  // ── 4 ────────────────────────────────────────────────────────────────────
  {
    id: 'po4-turn-barrel-or-give-up',
    title: 'Second Barrel — Know When to Fire and When to Stop',
    description: 'You cbet a dry board with air, pick up a draw on the turn. Decide correctly when to barrel and when to give up.',
    difficulty: 'intermediate',
    category: 'Bluffing',
    gameType: 'cash',
    format: '6-max',
    heroPosition: 'CO',
    villainPosition: 'BB',
    heroCards: ['9s', '8s'],
    effectiveStack: 100,
    stakes: '$1/$2',
    steps: [
      {
        street: 'flop',
        board: ['Kd', '5c', '2h'],
        context: 'CO opens $5, BB defends. Pot $11. Flop: Kd5c2h. BB checks.',
        prompt: '9s8s on a K52 rainbow board. BB checks. Cbet or give up?',
        options: [
          { id: 'check',   label: 'Check',          quality: 'acceptable', evLoss: 1,  coaching: 'Checking is fine to take a free card. However, K-high boards are great for CO\'s range — Kx, AK, KQ are all in your opening range. Cbetting has strong fold equity here.' },
          { id: 'bet_33',  label: 'Bet $4 (36%)',   quality: 'perfect',    evLoss: 0,  coaching: 'Small cbet on this K-high dry board. CO\'s range has significant K-high advantage. A small bet has excellent fold equity — BB folded many K-high hands and pairs pre-flop.' },
          { id: 'bet_75',  label: 'Bet $9 (82%)',   quality: 'good',       evLoss: 0.5, coaching: 'Larger cbet is valid but over-commits with air. Small sizing captures the same fold equity at lower risk with this hand.' },
        ],
      },
      {
        street: 'turn',
        board: ['Kd', '5c', '2h', '7s'],
        context: 'Pot $19. Turn: 7s. BB calls flop and checks.',
        prompt: 'Turn 7s gives you a gutshot (6 makes a straight). BB called and checks. Second barrel or give up?',
        options: [
          { id: 'check',   label: 'Check',           quality: 'perfect',   evLoss: 0,   coaching: 'Check is correct. The 7s didn\'t improve your fold equity and BB called the flop showing some hand strength. Your gutshot gives you 4 outs (~8%) — take a free card and see the river.' },
          { id: 'bet_50',  label: 'Bet $10 (53%)',   quality: 'acceptable', evLoss: 2,  coaching: 'Firing a second barrel with a gutshot is possible but risky. BB called the flop — their range includes 7x, 5x, 2x, backdoor draws. Checking is higher EV with just 4 outs.' },
          { id: 'bet_100', label: 'Bet $20 (105%)',  quality: 'mistake',    evLoss: 4,  coaching: 'Overbetting as a second barrel with only a gutshot into a player who showed calling strength is a significant mistake.' },
        ],
      },
      {
        street: 'river',
        board: ['Kd', '5c', '2h', '7s', '6d'],
        context: 'Pot $19. River: 6d — you made a straight (5-6-7-8-9)! BB checks.',
        prompt: 'The 6d completes your straight (5-6-7-8-9 using 9s8s)! BB checks. Bet for value.',
        options: [
          { id: 'check',   label: 'Check',           quality: 'mistake',  evLoss: 8,   coaching: 'Never check back a straight on a river when villain checks. You picked up the nuts — always value bet here.' },
          { id: 'bet_55',  label: 'Bet $12 (63%)',   quality: 'good',     evLoss: 1,   coaching: 'Medium bet extracts value. However, you have the nuts and BB had enough to call a flop cbet — a larger bet is more appropriate to maximize value.' },
          { id: 'bet_85',  label: 'Bet $18 (95%)',   quality: 'perfect',  evLoss: 0,   coaching: 'Large river value bet with the straight. You checked the turn so BB doesn\'t know you have a straight. They have some hand — go for max value here.' },
        ],
      },
    ],
    summary: 'On K-high boards as the opener, small cbets have excellent fold equity. When a turn card doesn\'t improve your hand or fold equity, take the free card. When you hit your draw on the river and villain checks, always go for maximum value — never check back the nuts.',
    tags: ['bluffing', 'second barrel', 'gutshot', 'straight', 'river value', 'position'],
  },

  // ── 5 ────────────────────────────────────────────────────────────────────
  {
    id: 'po5-check-raise-wet-board',
    title: 'Check-Raise with Draw on Wet Board',
    description: 'You defend BB and flop a strong combo-draw. Decide when to check-raise for maximum equity extraction.',
    difficulty: 'advanced',
    category: 'Semi-Bluff',
    gameType: 'cash',
    format: '6-max',
    heroPosition: 'BB',
    villainPosition: 'BTN',
    heroCards: ['9h', '8h'],
    effectiveStack: 100,
    stakes: '$1/$2',
    steps: [
      {
        street: 'flop',
        board: ['7h', 'Jh', '5c'],
        context: 'BTN opens $5, BB defends. Pot $11. Flop: 7hJh5c. BB checks. BTN bets $7.',
        prompt: '9h8h on 7hJh5c — combo draw: flush draw (4 hearts: Jh,9h,8h,7h = 9 outs) + double gutshot (needs 6 for 56789, or T for 789TJ = 8 outs) = 15+ total. BTN bets $7. Your move?',
        options: [
          { id: 'fold',    label: 'Fold',           quality: 'punt',     evLoss: 12,  coaching: 'Never fold 15+ outs. You have a combo draw (flush draw + double gutshot) — massive equity and strong semi-bluff potential.' },
          { id: 'call',    label: 'Call $7',         quality: 'good',     evLoss: 1,   coaching: 'Calling is valid — see the turn and realize equity. However, you have a combo-draw (flush + double gutshot = 15+ outs) strong enough to check-raise for semi-bluff value and protection.' },
          { id: 'raise',   label: 'Raise to $22',    quality: 'perfect',  evLoss: 0,   coaching: 'Check-raise is the optimal play. 15+ outs (9 flush + 8 straight via double gutshot, minus overlap), fold equity, and pot-building. Raising now with this combo draw is clearly best.' },
        ],
      },
      {
        street: 'turn',
        board: ['7h', 'Jh', '5c', 'Ts'],
        context: 'BTN calls check-raise. Pot $55. Turn: Ts. You check.',
        prompt: 'Turn Ts — you have 6h,4h for straight outs + flush draw. BTN checks back after calling your check-raise. Take a free card or bet?',
        options: [
          { id: 'check',   label: 'Check (already checked)', quality: 'perfect', evLoss: 0, coaching: 'The problem states you already checked. With BTN checking back, you got a free river card. This was optimal — you had your equity and a free card maximises it.' },
          { id: 'bet_50',  label: 'Bet $28 (51%)',   quality: 'good',     evLoss: 1,   coaching: 'Betting is valid to deny BTN equity. However, after a check-raise they checked back — their range is capped. Taking the free card with your draw is slightly higher EV.' },
          { id: 'jam',     label: 'Jam all-in',       quality: 'acceptable', evLoss: 2,  coaching: 'Jamming with a draw is very aggressive. You have equity but this risks your entire stack. Taking the free card or a medium bet are both better options.' },
        ],
      },
      {
        street: 'river',
        board: ['7h', 'Jh', '5c', 'Ts', '6h'],
        context: 'Pot $55. River: 6h — flush hits! Also made a straight.',
        prompt: 'River 6h: you made the flush (9h8h on 7hJh5cTs6h). Also have a straight. You act first OOP — how much?',
        options: [
          { id: 'check',   label: 'Check',           quality: 'mistake',  evLoss: 12,  coaching: 'Never check back a flush on the river. You have a very strong hand — extract maximum value.' },
          { id: 'bet_60',  label: 'Bet $38 (69%)',   quality: 'good',     evLoss: 2,   coaching: 'Medium bet extracts value. However, you check-raised the flop and BTN has been showing strength. A larger bet gets more from their committed holdings.' },
          { id: 'bet_90',  label: 'Bet $55 (100%)',  quality: 'perfect',  evLoss: 0,   coaching: 'Pot-sized bet with the flush. BTN called a check-raise and has a real hand — they are not folding to a pot-size bet on the river. Go for max value.' },
        ],
      },
    ],
    summary: 'With 15+ out combo draws (flush draw + double gutshot), check-raising for semi-bluff value is optimal. The double gutshot on 7hJh5c means you need a 6 (56789) or a T (789TJ) for the straight — two separate 4-out gutshots equal 8 straight outs. After check-raising and villain calling, taking a free card often maximises equity. When the flush hits, go for maximum value.',
    tags: ['check-raise', 'combo draw', 'double gutshot', 'semi-bluff', 'flush', 'OOP', 'BB defense'],
  },

  // ── 6 ────────────────────────────────────────────────────────────────────
  {
    id: 'po6-overbet-river-bluff',
    title: 'River Overbet Bluff — Blocker Theory',
    description: 'You call down with a draw, miss on the river, but hold key blockers. Decide if an overbet bluff makes sense.',
    difficulty: 'expert',
    category: 'Bluffing',
    gameType: 'cash',
    format: '6-max',
    heroPosition: 'BTN',
    villainPosition: 'CO',
    heroCards: ['Ad', 'Qd'],
    effectiveStack: 125,
    stakes: '$2/$5',
    steps: [
      {
        street: 'flop',
        board: ['Kd', '9d', '4h'],
        context: 'CO opens $15, BTN calls. Pot $32. Flop: Kd9d4h. CO bets $22.',
        prompt: 'AdQd on Kd9d4h — nut flush draw + backdoor straight draws. CO bets $22. Call or raise?',
        options: [
          { id: 'fold',    label: 'Fold',            quality: 'mistake',  evLoss: 5,   coaching: 'Folding the nut flush draw getting pot odds is a mistake. You have massive equity — always continue here.' },
          { id: 'call',    label: 'Call $22',         quality: 'perfect',  evLoss: 0,   coaching: 'Calling with the nut flush draw is correct in position. You have ~33% equity and position. Calling and realizing equity is optimal — no need to raise with a non-made hand.' },
          { id: 'raise',   label: 'Raise to $65',     quality: 'good',     evLoss: 1,   coaching: 'Raising for semi-bluff value is also valid with the NFD. Calling is marginally higher EV in position — you don\'t need to raise to realize your equity.' },
        ],
      },
      {
        street: 'turn',
        board: ['Kd', '9d', '4h', '3s'],
        context: 'Pot $76. Turn: 3s (blank). CO checks.',
        prompt: 'Turn 3s — flush draw still active. CO checks. Bet or take a free card?',
        options: [
          { id: 'check',   label: 'Check',            quality: 'perfect',  evLoss: 0,   coaching: 'Check and take the free river card. You have the NFD — ~30% equity. CO checked, indicating weakness. Why bet when you can see a free river? Check maximises equity realization.' },
          { id: 'bet_40',  label: 'Bet $30 (39%)',    quality: 'good',     evLoss: 1,   coaching: 'Betting is valid to deny CO equity and set up a river bet if you miss. Checking is slightly better — free card with a powerful draw.' },
          { id: 'bet_80',  label: 'Bet $65 (86%)',    quality: 'acceptable', evLoss: 2,  coaching: 'Large bet on the turn as a semi-bluff with the NFD over-commits. CO may call with a pair — take the free card instead.' },
        ],
      },
      {
        street: 'river',
        board: ['Kd', '9d', '4h', '3s', '7c'],
        context: 'Pot $76. River: 7c — flush missed. CO bets $45 into $76.',
        prompt: 'Flush missed. CO bets $45 into $76. You have AdQd — ace-high with nut blockers. Fold, call, or raise as a bluff?',
        options: [
          { id: 'fold',    label: 'Fold',             quality: 'perfect',  evLoss: 0,   coaching: 'Fold is correct. CO is now betting the river on a board where draws missed. They have a made hand (Kx, 99, 44, two-pair). You have ace-high and missed draws — folding is correct here.' },
          { id: 'call',    label: 'Call $45',          quality: 'mistake',  evLoss: 3,   coaching: 'Calling with ace-high on the river after CO bets is a mistake. You have no showdown value and are not beating anything CO bets here. Fold.' },
          { id: 'raise',   label: 'Raise overbet $200', quality: 'acceptable', evLoss: 2, coaching: 'Overbet bluffing with Adblocking nut flush is a valid advanced play, but CO bet into you — their range is strong made hands that are unlikely to fold. Folding is the cleaner play.' },
        ],
      },
    ],
    summary: 'With the NFD in position, calling is often better than raising — let equity realize. Take free cards on blanks. When the flush misses and villain bets the river, fold: you have no showdown value and your blockers don\'t make a bluff profitable when villain is betting for value.',
    tags: ['NFD', 'IP', 'free card', 'fold on miss', 'blocker theory', 'advanced'],
  },

  // ── 7 ────────────────────────────────────────────────────────────────────
  {
    id: 'po7-thin-river-value',
    title: 'Thin River Value — Second Pair on Safe Board',
    description: 'You call down with second pair and face a key decision on a safe river: bet thin value or check and showdown.',
    difficulty: 'intermediate',
    category: 'Value Betting',
    gameType: 'cash',
    format: '6-max',
    heroPosition: 'BB',
    villainPosition: 'CO',
    heroCards: ['Kh', 'Tc'],
    effectiveStack: 100,
    stakes: '$1/$2',
    steps: [
      {
        street: 'flop',
        board: ['Ks', 'Th', '7d'],
        context: 'CO opens $5, BB defends. Pot $11. Flop: Ks Th 7d. Hero checks. CO bets $7.',
        prompt: 'KhTc — two pair! But it\'s a strong hand on a connected board. CO bets $7. Call or raise?',
        options: [
          { id: 'fold',    label: 'Fold',            quality: 'punt',    evLoss: 15,  coaching: 'Never fold two pair on the flop. Massive punt.' },
          { id: 'call',    label: 'Call $7',          quality: 'perfect', evLoss: 0,   coaching: 'Call with two pair. This board is connected (J8 and Q9 have straights) — you need to protect, but calling and raising turn is a reasonable trapping line.' },
          { id: 'raise',   label: 'Raise to $22',     quality: 'good',    evLoss: 0.5, coaching: 'Raising is also fine with two pair for protection. However, calling sets up a trapping situation if CO fires again on the turn.' },
        ],
      },
      {
        street: 'turn',
        board: ['Ks', 'Th', '7d', '2c'],
        context: 'Pot $25. Turn: 2c (blank).',
        prompt: 'Blank turn after you called the flop. You act first OOP — start building the pot or check?',
        options: [
          { id: 'check',   label: 'Check',            quality: 'mistake',  evLoss: 3,  coaching: 'Checking back two pair on a blank turn is too passive. You gave CO a free river card. Start building the pot — bet and make them pay.' },
          { id: 'bet_50',  label: 'Bet $14 (56%)',    quality: 'perfect',  evLoss: 0,  coaching: 'Bet for value. CO checked the turn after you called flop — their range is capped at medium-strength hands. Two pair wants to build the pot here.' },
          { id: 'bet_100', label: 'Bet $27 (108%)',   quality: 'good',     evLoss: 1,  coaching: 'Overbet is strong but risky — you want CO to call with their medium-strength hands, not fold them. Standard sizing is more efficient.' },
        ],
      },
      {
        street: 'river',
        board: ['Ks', 'Th', '7d', '2c', 'Jd'],
        context: 'Pot $53. River: Jd. CO calls turn.',
        prompt: 'Jd on the river — possible Q8 straight. CO called the turn. You act first OOP — two pair still strong?',
        options: [
          { id: 'check',   label: 'Check',            quality: 'perfect',  evLoss: 0,   coaching: 'Check back on the river. The Jd completes Q8 and J7 type straights — some hands in CO\'s range just got there. With two pair on a straight-completing river OOP, checking is safer than betting.' },
          { id: 'bet_33',  label: 'Bet $18 (34%)',    quality: 'good',     evLoss: 1,   coaching: 'Small bet for thin value is possible, but the Jd is a meaningful card that improves some of CO\'s range. Checking is slightly cleaner and avoids paying off straights.' },
          { id: 'bet_75',  label: 'Bet $40 (75%)',    quality: 'mistake',  evLoss: 3,   coaching: 'Large bet on a straight-completing river OOP with two pair is risky. CO\'s range post-flop call + turn call can include Q8, J7 now. Don\'t overbet two pair when scare cards hit.' },
        ],
      },
    ],
    summary: 'With two pair, call the flop and build the pot on the turn when villain checks. On rivers that complete straights, check back two pair rather than bet — your hand is still strong but can lose to hands that just hit. Checking protects against paying off straights while still winning at showdown.',
    tags: ['two pair', 'OOP', 'SRP', 'river check', 'scare card', 'protection'],
  },

  // ── 8 ────────────────────────────────────────────────────────────────────
  {
    id: 'po8-delayed-cbet-dry-board',
    title: 'Delayed Cbet — Board Texture Mastery',
    description: 'You 3-bet AK and check the dry flop. When villain checks back, fire the delayed cbet on the turn.',
    difficulty: 'intermediate',
    category: '3-bet Pot',
    gameType: 'cash',
    format: '6-max',
    heroPosition: 'SB',
    villainPosition: 'BTN',
    heroCards: ['As', 'Kh'],
    effectiveStack: 100,
    stakes: '$1/$2',
    steps: [
      {
        street: 'flop',
        board: ['9c', '6d', '3h'],
        context: 'SB 3-bets to $16, BTN calls. Pot $33. Flop: 9c6d3h. SB is OOP.',
        prompt: 'AK on a complete whiff (9-6-3 rainbow). OOP in a 3-bet pot. Bet, check, or bluff large?',
        options: [
          { id: 'check',   label: 'Check',            quality: 'perfect',  evLoss: 0,   coaching: 'Check is correct with AK on a complete miss in a 3-bet pot OOP. You have no made hand. Checking allows you to see BTN\'s response and fire the delayed cbet on a better turn card.' },
          { id: 'bet_33',  label: 'Bet $11 (33%)',    quality: 'good',     evLoss: 0.5, coaching: 'Small cbet on a complete miss is a valid bluff. However OOP with no equity, checking and firing a delayed cbet tends to be more effective.' },
          { id: 'bet_75',  label: 'Bet $25 (76%)',    quality: 'acceptable', evLoss: 2,  coaching: 'Large cbet bluff on a complete miss OOP in a 3-bet pot without any equity is risky. Checking is more efficient.' },
        ],
      },
      {
        street: 'turn',
        board: ['9c', '6d', '3h', 'Ah'],
        context: 'Pot $33. Turn: Ah. BTN checks the flop back. Now you check again or fire the delayed cbet?',
        prompt: 'Turn Ah — you hit top pair! BTN checked the flop back. Delayed cbet now?',
        options: [
          { id: 'check',   label: 'Check',            quality: 'mistake',  evLoss: 4,   coaching: 'Checking twice with TPTK (hit the A!) in a 3-bet pot when BTN showed weakness by checking the flop burns a street of value. Bet now.' },
          { id: 'bet_55',  label: 'Bet $20 (61%)',    quality: 'perfect',  evLoss: 0,   coaching: 'Fire the delayed cbet. You hit top pair and BTN checked the flop back — their range is capped. Betting ~60% builds the pot and extracts value from any pair or medium strength hand.' },
          { id: 'bet_100', label: 'Bet $35 (106%)',   quality: 'good',     evLoss: 0.5, coaching: 'Overbet is also fine — BTN\'s range is weak after checking the flop. However, standard sizing keeps their range wider and extracts more total value across the river.' },
        ],
      },
      {
        street: 'river',
        board: ['9c', '6d', '3h', 'Ah', '5d'],
        context: 'Pot $73. River: 5d (blank). BTN calls turn.',
        prompt: 'River 5d blank. BTN called the turn. You act first OOP. TPTK — lead for value or check?',
        options: [
          { id: 'check',   label: 'Check',            quality: 'good',     evLoss: 2,   coaching: 'Checking is safe but misses value. BTN called a delayed cbet showing some hand — a medium value bet extracts from Ax second kicker and 99/66 type hands.' },
          { id: 'bet_40',  label: 'Bet $32 (44%)',    quality: 'perfect',  evLoss: 0,   coaching: 'Lead for value. BTN called a delayed cbet in a 3-bet pot — they have something. Medium sizing extracts from weaker Ax, 9x, and one-pair hands that call but fold to a large bet.' },
          { id: 'bet_80',  label: 'Bet $65 (89%)',    quality: 'acceptable', evLoss: 2,  coaching: 'Large river bet risks folding out the medium-strength hands you want. TPTK is not the nuts — smaller is better here to extract from a wider range.' },
        ],
      },
    ],
    summary: 'When you miss the flop OOP in a 3-bet pot, check and fire a delayed cbet when a card improves your hand or your range advantage. When you hit top pair on the turn, always fire the delayed cbet. On the river, use medium sizing to extract value from weaker Ax and pairs.',
    tags: ['delayed cbet', 'AK', 'OOP', '3bet pot', 'range advantage', 'turn value'],
  },

]
