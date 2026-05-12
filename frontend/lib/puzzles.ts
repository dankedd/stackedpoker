export type ActionQuality = 'perfect' | 'good' | 'acceptable' | 'mistake' | 'punt'

export interface ActionOption {
  id: string
  label: string
  quality: ActionQuality
  evLoss: number   // in BBs, 0 for perfect
  coaching: string
}

export interface PuzzleStep {
  street: 'preflop' | 'flop' | 'turn' | 'river'
  board: string[]   // cumulative board cards at start of this step
  context: string   // what just happened before hero acts
  prompt: string
  options: ActionOption[]
}

export interface Puzzle {
  id: string
  title: string
  description: string
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  category: string
  gameType: 'cash' | 'tournament'
  format: string
  heroPosition: string
  villainPosition: string
  heroCards: string[]
  effectiveStack: number  // in BB
  stakes: string
  steps: PuzzleStep[]
  summary: string
  tags: string[]
}

export const QUALITY_SCORE: Record<ActionQuality, number> = {
  perfect:    100,
  good:        80,
  acceptable:  60,
  mistake:     30,
  punt:         0,
}

// ─────────────────────────────────────────────────────────────────────────────
// Starter puzzles (all static, no AI calls needed)
// ─────────────────────────────────────────────────────────────────────────────

export const PUZZLES: Puzzle[] = [

  // ── 1 ────────────────────────────────────────────────────────────────────
  {
    id: 'p1-bb-defend-tptk',
    title: 'BB Defense — Flopped Top Pair',
    description: 'BTN steals, you defend from the big blind with a suited ace and navigate all four streets with top pair.',
    difficulty: 'beginner',
    category: 'SRP',
    gameType: 'cash',
    format: '6-max',
    heroPosition: 'BB',
    villainPosition: 'BTN',
    heroCards: ['Ah', '8h'],
    effectiveStack: 100,
    stakes: '$1/$2',
    steps: [
      {
        street: 'preflop',
        board: [],
        context: 'Folds to BTN who raises to $5 (2.5BB). SB folds.',
        prompt: 'Action on you in the BB with Ah8h.',
        options: [
          { id: 'call',   label: 'Call $3',      quality: 'perfect',    evLoss: 0,   coaching: 'A8s is a clear defend vs a wide BTN open. You have 2.5:1 pot odds, solid equity, a suited ace, and blockers to the nut flush. Calling is standard — you are never folding here.' },
          { id: '3bet',   label: '3-bet to $16', quality: 'good',       evLoss: 0.5, coaching: 'A8s can work as a light 3-bet from the BB. However, your more polarised 3-bet bluffs should be A2s–A5s (better blocker combos). Calling is marginally higher EV but this is fine.' },
          { id: 'fold',   label: 'Fold',         quality: 'mistake',    evLoss: 3.5, coaching: 'Folding A8s in the BB facing a BTN steal is way too tight. You have 1BB already invested, strong equity, and the BTN opens very wide. Never fold this hand here.' },
        ],
      },
      {
        street: 'flop',
        board: ['Ac', '6s', '3d'],
        context: 'Pot $11. Flop: Ac 6s 3d. You check. BTN bets $6.',
        prompt: 'BTN fires a $6 cbet (~55%) on the dry ace-high flop.',
        options: [
          { id: 'call',   label: 'Call $6',     quality: 'perfect',    evLoss: 0,  coaching: 'Calling TPTK on a dry board keeps BTN\'s full range in — bluffs, second pairs, backdoor draws. The board is too static to need protection, so slow-playing top pair is optimal here.' },
          { id: 'raise',  label: 'Raise to $20',quality: 'good',       evLoss: 1,  coaching: 'Raising is defensible — you have top pair and can build the pot. But on this dry texture you mainly fold out weaker hands and get called by better. Flatting is marginally higher EV.' },
          { id: 'fold',   label: 'Fold',        quality: 'punt',       evLoss: 14, coaching: 'Massive punt. You have TPTK on a dry board — one of the strongest hands in your range. BTN cbets very wide here. Never fold.' },
        ],
      },
      {
        street: 'turn',
        board: ['Ac', '6s', '3d', '9h'],
        context: 'Pot $23. Turn: 9h. You check. BTN double-barrels $16.',
        prompt: 'Facing a second barrel on the brick 9h turn.',
        options: [
          { id: 'call',   label: 'Call $16',    quality: 'perfect',    evLoss: 0,  coaching: 'Stay in the hand. BTN still has plenty of bluffs — KQ, KJ, QJ, missed floats — and you have top pair. Calling is correct; there\'s no reason to fold TPTK vs two bets on a dry board.' },
          { id: 'raise',  label: 'Raise to $48', quality: 'acceptable', evLoss: 2.5, coaching: 'Check-raising the turn is too aggressive with A8. You fold out all bluffs and only get called or jammed by better hands (AK, AQ, AA, sets). Your hand plays better as a call.' },
          { id: 'fold',   label: 'Fold',        quality: 'mistake',    evLoss: 7,  coaching: 'Folding TPTK vs a turn barrel on Ac6s3d9h is too weak. The board is still dry and BTN holds many bluffs even on the turn. Hold your ground.' },
        ],
      },
      {
        street: 'river',
        board: ['Ac', '6s', '3d', '9h', '2c'],
        context: 'Pot $55. River: 2c (blank). BTN checks to you.',
        prompt: 'BTN has checked the river. You are first to act.',
        options: [
          { id: 'bet_small', label: 'Bet $18 (33%)', quality: 'perfect',    evLoss: 0,  coaching: 'Lead for thin value. BTN checked the river — their range is capped to missed draws and medium pairs. A small bet extracts value from A5, A7, 99 and similar hands that check-call.' },
          { id: 'check',     label: 'Check',         quality: 'good',       evLoss: 2,  coaching: 'Checking back is safe and reasonable, but leaves significant EV on the table. BTN\'s capped river range can rarely fold to a small value bet, so leading is slightly higher EV.' },
          { id: 'bet_big',   label: 'Bet $40 (73%)', quality: 'acceptable', evLoss: 3,  coaching: 'Large bet size is risky with a non-nut hand. Most worse Ax hands in BTN\'s range fold to a big bet. A smaller sizing extracts more total value here.' },
        ],
      },
    ],
    summary: 'In BB vs BTN single-raised pots, defend top pair by calling down on dry boards. BTN\'s range is wide and bluff-heavy. Save check-raises for when you have sets or two-pair and need to build the pot. On safe rivers, lead small to extract value from BTN\'s capped range.',
    tags: ['SRP', 'top pair', 'BB defense', 'river value'],
  },

  // ── 2 ────────────────────────────────────────────────────────────────────
  {
    id: 'p2-set-value-slow',
    title: 'Flopped the Bottom Set',
    description: 'You hit bottom set on a dry flop and must decide how to extract maximum value across three streets.',
    difficulty: 'beginner',
    category: 'Value Betting',
    gameType: 'cash',
    format: '6-max',
    heroPosition: 'CO',
    villainPosition: 'BB',
    heroCards: ['7c', '7s'],
    effectiveStack: 100,
    stakes: '$1/$2',
    steps: [
      {
        street: 'flop',
        board: ['7h', '2d', '4c'],
        context: 'CO (hero) raises to $6, BB defends. Pot $13. Flop: 7h 2d 4c. BB checks.',
        prompt: 'You have flopped bottom set on a dry rainbow board. BB checks to you.',
        options: [
          { id: 'bet_25',  label: 'Bet $4 (30%)',  quality: 'perfect',    evLoss: 0,  coaching: 'Small cbet is ideal. You have the nuts and want to keep BB\'s entire range in — bluffs, weak pairs, gutshots. A small sizing allows worse hands to continue and sets up future streets.' },
          { id: 'bet_66',  label: 'Bet $9 (66%)',  quality: 'good',       evLoss: 0.5, coaching: 'Medium sizing works too, but you risk folding out too many weak hands. Sets prefer small bets to build a pot slowly and keep villain\'s air in their range.' },
          { id: 'check',   label: 'Check',         quality: 'acceptable', evLoss: 1.5, coaching: 'Checking is a valid slow-play, but the board is dry and villain may check back two streets. Betting small now ensures pot is bigger when you extract on later streets.' },
        ],
      },
      {
        street: 'turn',
        board: ['7h', '2d', '4c', 'Qs'],
        context: 'Pot now $21 after flop. Turn: Qs. BB calls flop and checks again.',
        prompt: 'BB called the flop and checked the turn. The Qs completes some backdoor draws and gives villain some floating hands a pair.',
        options: [
          { id: 'bet_50',  label: 'Bet $14 (66%)', quality: 'perfect',    evLoss: 0,  coaching: 'Bet for value now. The Qs gave villain some Qx hands that will pay off. Your set beats everything villain can have. Build the pot for a big river bet.' },
          { id: 'bet_25',  label: 'Bet $7 (33%)',  quality: 'good',       evLoss: 1,  coaching: 'Small bet is okay but leaves money on the table. The Qs may have improved villain\'s range — time to start sizing up and build toward a large river pot.' },
          { id: 'check',   label: 'Check',         quality: 'mistake',    evLoss: 4,  coaching: 'Checking twice with the nuts is too passive. You\'re missing a street of value. Villain will check back rivers they would have called a bet on, costing you significant EV.' },
        ],
      },
      {
        street: 'river',
        board: ['7h', '2d', '4c', 'Qs', 'Kd'],
        context: 'Pot $49. River: Kd. BB calls turn and checks again.',
        prompt: 'River Kd. BB has called two bets and checks to you. What is the optimal river bet sizing?',
        options: [
          { id: 'bet_75',  label: 'Bet $38 (75%)', quality: 'perfect',    evLoss: 0,  coaching: 'Large sizing is correct on the river. BB has shown a lot of calling tendency — they likely have QQ, KK (unlikely), Kx, or Qx hands. Go for max value with a pot-sized-ish bet.' },
          { id: 'bet_50',  label: 'Bet $25 (50%)', quality: 'good',       evLoss: 1.5, coaching: 'Half-pot is fine but you leave value on the table. BB has called two streets and the river improved their range. A bigger bet extracts more from Kx and Qx hands.' },
          { id: 'check',   label: 'Check',         quality: 'mistake',    evLoss: 6,  coaching: 'Never check back the nuts on a river when villain is capped and has shown calling willingness across all streets. This is a major missed value spot.' },
        ],
      },
    ],
    summary: 'With sets on dry boards, prefer small cbets to keep villain\'s range wide. As draws don\'t exist, you can afford to go slower preflop and build naturally. On later streets as the board develops and villain\'s range strengthens, increase sizing to extract maximum value.',
    tags: ['set', 'value betting', 'SRP', 'sizing'],
  },

  // ── 3 ────────────────────────────────────────────────────────────────────
  {
    id: 'p3-3bet-pot-ak',
    title: '3-bet Pot IP — Top Pair Top Kicker',
    description: 'You 3-bet from the CO and flop top pair top kicker in a 3-bet pot. Navigate three streets in position.',
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
        street: 'flop',
        board: ['Ad', '7c', '2h'],
        context: 'CO 3bets BTN\'s open to $27. BTN calls. Pot $55. Flop: Ad 7c 2h. BTN checks.',
        prompt: 'You have TPTK in position in a 3-bet pot. BTN checks.',
        options: [
          { id: 'bet_33',  label: 'Bet $18 (33%)', quality: 'perfect',    evLoss: 0,  coaching: 'Small cbet is ideal on this dry ace-high board. BTN\'s range is wide but has many medium-pair hands that call small. You build the pot in position and protect against backdoor draws.' },
          { id: 'bet_66',  label: 'Bet $37 (66%)', quality: 'good',       evLoss: 0.5, coaching: 'Medium sizing is also fine — you polarize more. However, this board is so dry that BTN\'s calling range is narrow and a small bet gets called by more of their range.' },
          { id: 'check',   label: 'Check',         quality: 'acceptable', evLoss: 2,  coaching: 'Checking back is a valid trap, but you may give BTN a free card with KJ, K9, or backdoor draws. In position with AK on a dry board, betting small is typically higher EV.' },
        ],
      },
      {
        street: 'turn',
        board: ['Ad', '7c', '2h', 'Jd'],
        context: 'Pot $91 (after flop). Turn: Jd. BTN check-calls the flop bet and now checks again.',
        prompt: 'Turn Jd — a diamond appeared. BTN check-calls flop and checks turn. What now?',
        options: [
          { id: 'bet_50',  label: 'Bet $50 (55%)', quality: 'perfect',    evLoss: 0,  coaching: 'Continue betting. BTN check-called the flop, showing some strength or a draw. The Jd is a scare card for Jx hands but a flush draw arrived. Bet for value and protection against diamond draws.' },
          { id: 'bet_33',  label: 'Bet $30 (33%)', quality: 'good',       evLoss: 1,  coaching: 'Small turn bet keeps the pot manageable but may not charge draws sufficiently. Medium sizing is better on a board that developed a flush draw.' },
          { id: 'check',   label: 'Check',         quality: 'mistake',    evLoss: 4.5, coaching: 'Checking the turn with AK on a board that developed a flush draw is too passive. You give flush draws a free card and miss a street of value from Jx, A7, A2 type hands.' },
        ],
      },
      {
        street: 'river',
        board: ['Ad', '7c', '2h', 'Jd', '4s'],
        context: 'Pot ~$191. River: 4s (flush draw missed). BTN calls turn and checks river.',
        prompt: 'River 4s — all draws bricked. BTN has called two bets and checks. Optimal river sizing?',
        options: [
          { id: 'bet_66',  label: 'Bet $100 (52%)', quality: 'perfect',    evLoss: 0,  coaching: 'Go for value. BTN called twice and the flush draw missed — they likely have Jx, A-low kicker, or 77/22. Your AK beats everything except A7, AJ, or AA. Bet large; BTN is calling off here.' },
          { id: 'bet_33',  label: 'Bet $60 (31%)',  quality: 'good',       evLoss: 2,  coaching: 'This works but undersizes the pot. BTN has shown significant calling strength and the draws missed — a larger sizing extracts more value from their range.' },
          { id: 'check',   label: 'Check',          quality: 'mistake',    evLoss: 8,  coaching: 'Never check back AK on a board where BTN called two big bets and the flush draw bricked. You leave a massive amount of EV on the table. BTN\'s range is too strong to check behind.' },
        ],
      },
    ],
    summary: 'In 3-bet pots with top pair in position, use small cbets to keep villain\'s range wide. As the hand develops, escalate sizing when draws appear. On brick rivers after villain calls two bets, go for large value — their range is committed and can rarely fold.',
    tags: ['3bet pot', 'TPTK', 'IP', 'value sizing'],
  },

  // ── 4 ────────────────────────────────────────────────────────────────────
  {
    id: 'p4-gutshot-to-straight',
    title: 'Float Flop, Hit Turn — Nut Straight',
    description: 'You float a flop cbet with two overcards and hit the nut straight on the turn. Navigate the exploitation.',
    difficulty: 'intermediate',
    category: 'SRP',
    gameType: 'cash',
    format: '6-max',
    heroPosition: 'BTN',
    villainPosition: 'CO',
    heroCards: ['Kh', 'Qh'],
    effectiveStack: 100,
    stakes: '$1/$2',
    steps: [
      {
        street: 'flop',
        board: ['Jc', '9d', '4s'],
        context: 'CO opens $5, BTN calls. Pot $12. Flop: Jc 9d 4s. CO bets $7.',
        prompt: 'CO cbets $7 (~58%) on Jc9d4s. You have KhQh — two overcards, no pair, backdoor flush draws.',
        options: [
          { id: 'call',   label: 'Call $7',     quality: 'perfect',    evLoss: 0,  coaching: 'Floating is the correct play. KQ has two overcards, gutshot to Broadway, and backdoor nut flush equity. You also have position throughout. Calling with these draws and blockers is standard.' },
          { id: 'raise',  label: 'Raise to $22',quality: 'mistake',    evLoss: 3,  coaching: 'Raising with no pair on this connected board is too aggressive. You fold out CO\'s weak holdings but get called by stronger hands. Your equity doesn\'t justify a raise here.' },
          { id: 'fold',   label: 'Fold',        quality: 'acceptable', evLoss: 2.5, coaching: 'Folding is too tight. KQo has strong implied odds — if a T or K falls you make a big hand. Your two overcards and backdoor draws make this a profitable float in position.' },
        ],
      },
      {
        street: 'turn',
        board: ['Jc', '9d', '4s', 'Td'],
        context: 'Pot $26. Turn: Td. CO bets $18 into $26.',
        prompt: 'The Td gives you the nut straight (K-Q-J-T-9). CO fires $18. What is your best play?',
        options: [
          { id: 'raise',  label: 'Raise to $55', quality: 'perfect',    evLoss: 0,  coaching: 'Raise for value and build the pot. You have the absolute nuts on a very wet board — flush draws and lower straights are possible. Getting money in now is critical before a scary river card.' },
          { id: 'call',   label: 'Call $18',     quality: 'good',       evLoss: 1.5, coaching: 'Calling is reasonable to keep CO\'s bluffs in and let them barrel rivers. However, the board is so wet that raising is better — you need to extract value now, not hope for a safe river.' },
          { id: 'fold',   label: 'Fold',         quality: 'punt',       evLoss: 20, coaching: 'You have THE NUTS. Do not fold the best possible hand. Ever.' },
        ],
      },
      {
        street: 'river',
        board: ['Jc', '9d', '4s', 'Td', '2c'],
        context: 'CO calls the raise. Pot ~$136. River: 2c (flush and straight draws missed). CO checks.',
        prompt: 'River 2c — all draws bricked. CO calls the turn raise and checks. You have the nut straight.',
        options: [
          { id: 'bet_75',  label: 'Bet $90 (66%)', quality: 'perfect',    evLoss: 0,  coaching: 'Value bet large. CO called a turn raise and checked a brick river — they likely have a set, two-pair, a weaker straight, or Jx that wants to see a showdown. Go for maximum value.' },
          { id: 'bet_40',  label: 'Bet $50 (37%)', quality: 'good',       evLoss: 2,  coaching: 'Smaller sizing works but underextracts. CO demonstrated significant hand strength by calling your turn raise. A larger bet is more appropriate on this river.' },
          { id: 'check',   label: 'Check',         quality: 'mistake',    evLoss: 10, coaching: 'Never check back the nut straight on a brick river when villain is capped and pot is large. This is a massive missed value spot.' },
        ],
      },
    ],
    summary: 'With overcards and gutshots, floating in position is often correct when you have implied odds and position. Once you make the nut straight on a wet board, raise immediately — don\'t slow-play when draws are present. Then extract full value on brick rivers.',
    tags: ['float', 'nut straight', 'IP', 'implied odds'],
  },

  // ── 5 ────────────────────────────────────────────────────────────────────
  {
    id: 'p5-turn-barrel-nfd',
    title: 'Nut Flush Draw — Barrel or Bail?',
    description: 'You cbet a flop with the nut flush draw, then face a critical decision when the turn brings a scare card.',
    difficulty: 'intermediate',
    category: 'Turn Barrel',
    gameType: 'cash',
    format: '6-max',
    heroPosition: 'BTN',
    villainPosition: 'BB',
    heroCards: ['Ah', 'Jh'],
    effectiveStack: 100,
    stakes: '$1/$2',
    steps: [
      {
        street: 'flop',
        board: ['Qh', '9c', '3h'],
        context: 'BTN opens $5, BB defends. Pot $11. Flop: Qh 9c 3h. BB checks.',
        prompt: 'You have AhJh — nut flush draw (A♥ + J♥, board has Q♥ 3♥). BB checks to you.',
        options: [
          { id: 'bet_50',  label: 'Bet $7 (63%)',  quality: 'perfect',    evLoss: 0,  coaching: 'Bet with your nut flush draw plus two overcards. You have ~40% equity with the NFD + gutshot + overcards. A cbet here has both fold equity and strong draw equity when called.' },
          { id: 'bet_33',  label: 'Bet $4 (36%)',  quality: 'good',       evLoss: 0.5, coaching: 'Small bet also works, but with a strong semi-bluff you can size up to build the pot and protect your equity.' },
          { id: 'check',   label: 'Check',         quality: 'acceptable', evLoss: 2,  coaching: 'Checking is fine to induce, but in position with the NFD and two overcards, betting is higher EV — you have both fold equity and strong drawing equity.' },
        ],
      },
      {
        street: 'turn',
        board: ['Qh', '9c', '3h', 'Kd'],
        context: 'Pot $25. Turn: Kd. BB calls flop and donk-leads $16 into you.',
        prompt: 'BB called your flop bet and now donk-leads $16 on the Kd turn. You still have your nut flush draw.',
        options: [
          { id: 'call',    label: 'Call $16',    quality: 'perfect',    evLoss: 0,  coaching: 'Calling is correct. The Kd improved some of BB\'s range (Kx hands). You still have ~30% equity with the NFD. Calling with nut flush draw getting good pot odds is standard; raise is too thin without equity to fall back on.' },
          { id: 'raise',   label: 'Raise to $45',quality: 'acceptable', evLoss: 2,  coaching: 'Raising has some merit as a semi-bluff since you have the NFD, but BB led into you showing strength — your fold equity is lower. A call is marginally higher EV.' },
          { id: 'fold',    label: 'Fold',        quality: 'mistake',    evLoss: 5,  coaching: 'Never fold the nut flush draw getting 2.5:1 pot odds. Even if the raise is wrong, calling with a strong draw is always correct here.' },
        ],
      },
      {
        street: 'river',
        board: ['Qh', '9c', '3h', 'Kd', '2s'],
        context: 'Pot $57. River: 2s. NFD misses. BB checks to you.',
        prompt: 'River 2s — flush draw missed. BB checks. You have ace-high with no made hand.',
        options: [
          { id: 'check',   label: 'Check',       quality: 'perfect',    evLoss: 0,  coaching: 'Check back and take the free showdown. You have no made hand. BB led the turn showing strength, then checked river — your bluff has minimal fold equity and checking is correct.' },
          { id: 'bluff_50', label: 'Bet $35 (61%)',quality: 'mistake',   evLoss: 3.5, coaching: 'Bluffing into a player who donk-led the turn is low EV. BB checked after showing strength, but they likely have a showdown-worthy hand. Your Ah is a blocker to the flush you missed, not a great bluff card here.' },
          { id: 'bluff_90', label: 'Jam $70',     quality: 'punt',      evLoss: 8,  coaching: 'Jamming into a polarised range on a missed draw with no showdown equity is a major punt. BB is rarely folding a made hand after leading the turn.' },
        ],
      },
    ],
    summary: 'With nut flush draws in position, betting for semi-bluff value is correct. When the flush misses on the river and villain has shown strength, take the free showdown rather than fire a low-equity bluff. Know when to stop the story.',
    tags: ['semi-bluff', 'NFD', 'turn barrel', 'IP'],
  },

  // ── 6 ────────────────────────────────────────────────────────────────────
  {
    id: 'p6-3bet-qq-ace-board',
    title: 'Pocket Queens — Ace on the Flop',
    description: 'You 3-bet from the SB with QQ and face the most uncomfortable flop: an ace. How do you proceed OOP?',
    difficulty: 'intermediate',
    category: '3-bet Pot',
    gameType: 'cash',
    format: '6-max',
    heroPosition: 'SB',
    villainPosition: 'BTN',
    heroCards: ['Qh', 'Qd'],
    effectiveStack: 100,
    stakes: '$1/$2',
    steps: [
      {
        street: 'flop',
        board: ['Ah', '7c', '2d'],
        context: 'SB 3bets BTN\'s $5 open to $16. BTN calls. Pot $33. Flop: Ah 7c 2d.',
        prompt: 'You 3-bet and hit the nightmare flop — an ace. You are out of position. Check or bet?',
        options: [
          { id: 'check',   label: 'Check',       quality: 'perfect',    evLoss: 0,  coaching: 'Checking is the optimal play with QQ on an ace-high flop OOP. Your hand is now a bluff-catcher. Checking induces BTN\'s bluffs and avoids building the pot when you\'re beat by any Ax hand.' },
          { id: 'bet_33',  label: 'Bet $11 (33%)',quality: 'mistake',    evLoss: 3.5, coaching: 'Betting here is a bluff — BTN called a 3-bet and hit an ace often enough. You rarely get called by worse, and you commit more money in a bad spot. Check and reassess.' },
          { id: 'bet_66',  label: 'Bet $22 (66%)',quality: 'punt',       evLoss: 7,  coaching: 'Large bet OOP on an ace-high board in a 3-bet pot is very poor. You have no protection and no fold equity against BTN\'s Ax hands. Never do this with QQ here.' },
        ],
      },
      {
        street: 'turn',
        board: ['Ah', '7c', '2d', 'Jd'],
        context: 'Pot $33. Turn: Jd. You checked flop. BTN bets $20.',
        prompt: 'BTN bets $20 (~60%) on the Jd turn after you checked. Call, fold, or raise?',
        options: [
          { id: 'call',    label: 'Call $20',    quality: 'perfect',    evLoss: 0,  coaching: 'Calling is correct. BTN\'s range includes plenty of bluffs (KQ, KT, QJ, missed 3bets). You have a solid bluff-catcher with QQ. Don\'t raise — you have no fold equity against Ax, and don\'t fold — your hand beats too much of BTN\'s bluffing range.' },
          { id: 'fold',    label: 'Fold',        quality: 'mistake',    evLoss: 5,  coaching: 'Folding QQ on Ah7c2dJd vs one bet is too weak. BTN has many bluffs and semi-bluffs in their range. You\'re getting 2.65:1 pot odds and have QQ — call.' },
          { id: 'raise',   label: 'Raise to $55',quality: 'mistake',    evLoss: 4,  coaching: 'Raising turns your QQ into a bluff — you only get called by Ax or better, and you fold out the bluffs you want to keep in. Calling is significantly better.' },
        ],
      },
      {
        street: 'river',
        board: ['Ah', '7c', '2d', 'Jd', '5c'],
        context: 'Pot $73. River: 5c. You call the turn. BTN jams all-in for $64.',
        prompt: 'BTN jams the river for $64 into $73. Hero call or fold with QQ?',
        options: [
          { id: 'call',    label: 'Call $64',    quality: 'perfect',    evLoss: 0,  coaching: 'Call. You are getting ~2.15:1 pot odds and need to be right about 32% of the time. BTN\'s range on this board has plenty of bluffs and missed draws. QQ is a strong enough bluff-catcher to call here.' },
          { id: 'fold',    label: 'Fold',        quality: 'mistake',    evLoss: 6,  coaching: 'Folding QQ vs a river jam at this pot odds is too tight. BTN can easily have KJ, KQ, QJ, 98, 86 type missed draws or air. You\'re laying great odds to catch a bluff.' },
        ],
      },
    ],
    summary: 'With QQ on ace-high boards in 3-bet pots OOP, check and use your hand as a bluff-catcher. Don\'t build the pot when you have no fold equity. Calling down vs aggressive lines is often correct when you have the right pot odds and villain\'s range is bluff-heavy.',
    tags: ['3bet pot', 'bluff-catch', 'OOP', 'QQ'],
  },

  // ── 7 ────────────────────────────────────────────────────────────────────
  {
    id: 'p7-sb-squeeze',
    title: 'SB Squeeze with Pocket Tens',
    description: 'UTG opens, BTN calls — should you squeeze from the SB with TT? Then navigate the flop OOP.',
    difficulty: 'intermediate',
    category: 'Preflop',
    gameType: 'cash',
    format: '6-max',
    heroPosition: 'SB',
    villainPosition: 'UTG',
    heroCards: ['Tc', 'Td'],
    effectiveStack: 100,
    stakes: '$1/$2',
    steps: [
      {
        street: 'preflop',
        board: [],
        context: 'UTG opens $5. BTN calls. Action on SB with TcTd.',
        prompt: 'UTG opens $5, BTN cold-calls. You are in the SB with pocket tens. What is your action?',
        options: [
          { id: '3bet',    label: '3-bet to $22', quality: 'perfect',    evLoss: 0,  coaching: 'Squeezing is correct with TT. You isolate UTG\'s range, deny BTN\'s equity, and get better hands (JJ, QQ, AK, AQ) to define themselves. TT plays well as a squeeze in this spot.' },
          { id: 'call',    label: 'Call $4',      quality: 'acceptable', evLoss: 2,  coaching: 'Calling is valid but you play multiway OOP with a medium pair — not ideal. Squeezing wins the pot more often pre-flop and builds a bigger pot when you connect. 3bet is higher EV.' },
          { id: 'fold',    label: 'Fold',         quality: 'mistake',    evLoss: 5,  coaching: 'Folding TT in the SB facing one open and one cold-call is far too tight. TT is a strong hand; at minimum call, ideally squeeze.' },
        ],
      },
      {
        street: 'flop',
        board: ['Jd', '8c', '3s'],
        context: 'You 3-bet to $22. BTN folds, UTG calls. Pot $47. Flop: Jd 8c 3s. UTG checks.',
        prompt: 'HU in a 3-bet pot. You have an overpair (TT) on a Jd8c3s flop. UTG checks.',
        options: [
          { id: 'bet_33',  label: 'Bet $16 (33%)', quality: 'perfect',    evLoss: 0,  coaching: 'Bet small with your overpair. You need to protect TT from overcards and charge draws. Small sizing keeps UTG\'s wide range in (pocket pairs, 98, AQ all peel small bets). The J is a scare card but you still have an overpair.' },
          { id: 'check',   label: 'Check',          quality: 'good',       evLoss: 1,  coaching: 'Checking back is also fine to induce and protect your range. However, TT needs some protection on this board and betting is marginally better.' },
          { id: 'bet_75',  label: 'Bet $36 (75%)', quality: 'acceptable', evLoss: 2,  coaching: 'Large cbet is a bit much with TT on a connected board. You risk folding out worse hands that would call a smaller bet. Smaller sizing is more appropriate.' },
        ],
      },
      {
        street: 'turn',
        board: ['Jd', '8c', '3s', 'As'],
        context: 'Pot $79. Turn: As. UTG calls flop and check-raises to $60 after you bet $16.',
        prompt: 'The As arrives. You bet $16. UTG check-raises to $60. Your action with TT (below top pair)?',
        options: [
          { id: 'fold',    label: 'Fold',        quality: 'perfect',    evLoss: 0,  coaching: 'Fold is correct here. UTG flatted a 3-bet OOP and check-raised the turn after an ace appeared. This range is heavily weighted to Ax, sets (JJ, 88), and two-pair. TT is not strong enough to continue.' },
          { id: 'call',    label: 'Call $44',    quality: 'mistake',    evLoss: 5,  coaching: 'Calling faces a very unfavorable situation. UTG check-raised this board facing a 3-bet OOP — their range is extremely strong. You\'d be investing significantly more with what is effectively a bluff-catcher here.' },
          { id: 'raise',   label: 'Re-raise jam',quality: 'punt',       evLoss: 15, coaching: 'Jamming with TT into UTG\'s check-raise on AJs3 is a major punt. UTG\'s range is extremely narrow and strong here. You are almost certainly crushed.' },
        ],
      },
    ],
    summary: 'Squeezing with TT is correct against open + cold-call situations. Post-flop, bet small with overpairs on connected boards to protect equity. When villain check-raises on a turn that improves their range significantly, respect the strength and fold medium hands like TT.',
    tags: ['squeeze', '3bet pot', 'OOP', 'preflop', 'TT'],
  },

  // ── 8 ────────────────────────────────────────────────────────────────────
  {
    id: 'p8-river-hero-call',
    title: 'River Hero Call — Polarised Jam',
    description: 'You hold top two pair and face a massive river overbet. Is this a bluff or the nuts? Make the call or fold.',
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
        context: 'BTN opens $15, BB (hero) 3-bets to $50. BTN calls. Pot $103. Flop: Ad Jh 6c. Hero checks.',
        prompt: 'You have top two pair in a 3-bet pot OOP. Flopped the dream — Ad Jh 6c. You check.',
        options: [
          { id: 'check',   label: 'Check (slowplay)',quality: 'perfect',    evLoss: 0,  coaching: 'Checking is excellent here. You have top two pair on a dry board. Let BTN stab with their air and build the pot organically. Check-calling or check-raising turn are both good lines.' },
          { id: 'bet_33',  label: 'Bet $34 (33%)',   quality: 'good',       evLoss: 0.5, coaching: 'Small cbet also works — gets money in and keeps BTN\'s range wide. However, checking gives BTN the opportunity to bluff, which may be higher EV here.' },
          { id: 'bet_75',  label: 'Bet $77 (75%)',   quality: 'acceptable', evLoss: 2,  coaching: 'Too large with the nuts. On a dry board, this folds out hands you want to keep in. Small or check is better.' },
        ],
      },
      {
        street: 'turn',
        board: ['Ad', 'Jh', '6c', '9d'],
        context: 'Pot $103. Turn: 9d. BTN bets $65 after you checked flop.',
        prompt: 'Turn 9d — a diamond draw arrived. BTN bets $65 into $103. You have top two pair.',
        options: [
          { id: 'raise',   label: 'Raise to $180',  quality: 'perfect',    evLoss: 0,  coaching: 'Raise for value and protection. The 9d brings diamond draws — you need to charge them. Your two pair is not the nuts; KK/QQ that turned backdoor draws, T8 (OESD), and KdQd are all out there. Get money in now.' },
          { id: 'call',    label: 'Call $65',        quality: 'good',       evLoss: 1.5, coaching: 'Calling keeps BTN\'s wider range in and is reasonable. However, the diamond draw makes raising preferable — you want to deny free equity and build a bigger pot.' },
          { id: 'fold',    label: 'Fold',            quality: 'punt',       evLoss: 30, coaching: 'You have top two pair. Never fold this hand on the turn.' },
        ],
      },
      {
        street: 'river',
        board: ['Ad', 'Jh', '6c', '9d', '2h'],
        context: 'BTN calls your raise. Pot ~$463. River: 2h. BTN jams for $250.',
        prompt: 'River 2h — diamond draw bricked. BTN jams $250 into $463. Getting ~2.85:1 pot odds. Hero call or fold with top two pair?',
        options: [
          { id: 'call',    label: 'Call $250',   quality: 'perfect',    evLoss: 0,  coaching: 'Call. You need to be correct ~26% of the time. BTN can have T8, KQ of diamonds, 87, or pure air bluffs here. Their range is polarised — jamming sets or 99 makes less sense given your 3-bet sizing. Top two pair is a clear call at these pot odds.' },
          { id: 'fold',    label: 'Fold',        quality: 'mistake',    evLoss: 8,  coaching: 'Folding top two pair at 2.85:1 pot odds is too tight. BTN jammed into you after calling a 3-bet — their range has many bluffs (missed draws, KQ, T8, AK) and you only need to be right 26% of the time.' },
        ],
      },
    ],
    summary: 'With top two pair in 3-bet pots, slowplay dry flops and raise wet turns to charge draws. On brick rivers facing a polarised jam, calculate pot odds and call — top two pair is strong enough to be a hero call when you\'re getting over 2.5:1.',
    tags: ['hero call', 'two pair', 'river', 'bluff-catch', 'pot odds'],
  },

  // ── 9 ────────────────────────────────────────────────────────────────────
  {
    id: 'p9-hu-aggression',
    title: 'Heads-Up Aggression — Semi-Bluff Spots',
    description: 'In heads-up play on a wet board, decide when to fire semi-bluffs and when to give up with missed equity.',
    difficulty: 'advanced',
    category: 'SRP',
    gameType: 'cash',
    format: 'heads-up',
    heroPosition: 'BTN',
    villainPosition: 'BB',
    heroCards: ['5h', '6h'],
    effectiveStack: 100,
    stakes: '$1/$2',
    steps: [
      {
        street: 'flop',
        board: ['4h', '7c', 'Kd'],
        context: 'BTN opens $4, BB defends. Pot $8. Flop: 4h 7c Kd. BB checks.',
        prompt: 'HU. You have 5h6h — open-ended straight draw (3 or 8 completes). Board: 4h 7c Kd. BB checks.',
        options: [
          { id: 'bet_50',  label: 'Bet $5 (62%)',  quality: 'perfect',    evLoss: 0,  coaching: 'Cbet with your OESD. You have ~30% equity (8 outs x 4 rule = ~32%). In HU play, cbetting vs BB is highly profitable with any equity + fold equity combination. This is a clear cbet.' },
          { id: 'check',   label: 'Check',         quality: 'good',       evLoss: 0.5, coaching: 'Checking is fine to balance range and see a free turn, but your OESD has strong equity and fold equity on the cbet — betting is slightly higher EV in HU.' },
          { id: 'overbet', label: 'Bet $11 (137%)',quality: 'acceptable', evLoss: 1.5, coaching: 'Overbetting the flop is too ambitious. This is a solid draw, not a value hand. Normal sizing captures the same fold equity without over-risking.' },
        ],
      },
      {
        street: 'turn',
        board: ['4h', '7c', 'Kd', '2s'],
        context: 'Pot $18. Turn: 2s. BB calls flop and donk-leads $12.',
        prompt: 'BB donk-leads $12 on the 2s turn. Your straight draw missed and the 2s is a blank. Call, raise, or fold?',
        options: [
          { id: 'call',    label: 'Call $12',     quality: 'perfect',    evLoss: 0,  coaching: 'Call. You still have 8 outs to a straight on the river and you\'re getting 2.5:1 pot odds. A donk-bet doesn\'t always represent huge strength in HU — calling with your draw is profitable here.' },
          { id: 'raise',   label: 'Raise to $36', quality: 'mistake',    evLoss: 3.5, coaching: 'Raising into a donk-bet with a draw is too aggressive. You fold out weaker hands but get called or jammed by stronger made hands. Call and see the river.' },
          { id: 'fold',    label: 'Fold',         quality: 'mistake',    evLoss: 4,  coaching: 'Folding an open-ended straight draw getting 2.5:1 pot odds is incorrect. You have ~17% equity and are getting profitable odds. Call.' },
        ],
      },
      {
        street: 'river',
        board: ['4h', '7c', 'Kd', '2s', '3d'],
        context: 'Pot $42. River: 3d. You made a straight with 3-4-5-6-7! BB bets $30 into $42.',
        prompt: 'You hit a straight on the river (3-4-5-6-7 using your 5h6h)! BB bets $30. Raise or call?',
        options: [
          { id: 'raise',   label: 'Raise to $85', quality: 'perfect',    evLoss: 0,  coaching: 'Raise for value immediately. You have a straight and BB has bet into you — they have a real hand. Raising extracts maximum value from their strong holdings (KK, 77, 44, K7). This is the time to go for maximum value.' },
          { id: 'call',    label: 'Call $30',     quality: 'good',       evLoss: 2,  coaching: 'Calling is too passive with a straight. BB has shown strength by leading into you — they are unlikely to fold to a raise and you should extract max value. Raise.' },
          { id: 'fold',    label: 'Fold',         quality: 'punt',       evLoss: 25, coaching: 'You have a straight. Never fold.' },
        ],
      },
    ],
    summary: 'In HU play, cbet frequently with draws and semi-bluffs. When you hit your draw on the river against a betting villain, always look to raise for maximum value. HU ranges are wider — both villain\'s value range and your value hands are good for raises.',
    tags: ['HU', 'OESD', 'semi-bluff', 'straight', 'aggression'],
  },

  // ── 10 ───────────────────────────────────────────────────────────────────
  {
    id: 'p10-mtt-push-fold',
    title: 'MTT — Short Stack Push/Fold',
    description: 'You\'re on the tournament bubble with 14BB. Understand push/fold ICM concepts and stack preservation.',
    difficulty: 'beginner',
    category: 'ICM',
    gameType: 'tournament',
    format: '6-max MTT',
    heroPosition: 'BTN',
    villainPosition: 'BB',
    heroCards: ['Kd', 'Js'],
    effectiveStack: 14,
    stakes: 'MTT — bubble',
    steps: [
      {
        street: 'preflop',
        board: [],
        context: 'MTT bubble. 14BB effective. Folds to BTN (hero). BB has 40BB. ICM pressure is moderate.',
        prompt: 'You have KdJs with 14BB on the BTN. Folds to you. Push or fold?',
        options: [
          { id: 'push',    label: 'Push all-in',  quality: 'perfect',    evLoss: 0,  coaching: 'KJs with 14BB on the BTN is a clear shove. Using ICM-aware push/fold charts, KJs is a profitable push at any stack depth under 20BB from the BTN. You have solid equity vs calling ranges and excellent fold equity.' },
          { id: 'fold',    label: 'Fold',         quality: 'mistake',    evLoss: 2.5, coaching: 'Folding KJs 14BB on the BTN is too tight. Your hand has good equity and you have fold equity vs the BB. Waiting for a "better spot" while blinding down is a significant ICM leak.' },
          { id: 'limp',    label: 'Limp $1BB',    quality: 'punt',       evLoss: 5,  coaching: 'Limping with 14BB is the worst option. You give up your fold equity, play a poorly-defined range, and set up awkward post-flop spots. Always push or fold at 14BB — never limp.' },
        ],
      },
      {
        street: 'flop',
        board: ['Kh', '8c', '3d'],
        context: 'BB calls your shove with A9o. You are ahead. Pot committed. Flop: Kh 8c 3d.',
        prompt: 'You\'re ahead with KJ vs A9 — flopped top pair. Just one street to go. Are you happy with your push?',
        options: [
          { id: 'confident', label: 'Yes — correct push', quality: 'perfect',    evLoss: 0,  coaching: 'Exactly right. KJs was a +EV push here and you flopped top pair vs an Ax hand. Even if you lose this hand, the decision was correct — poker is about making good decisions, not results.' },
          { id: 'regret',    label: 'Worried — should\'ve folded', quality: 'mistake', evLoss: 2,  coaching: 'Results-oriented thinking is the enemy of good poker. Your push with KJs was correct by ICM calculations. Whether you win or lose this hand has no bearing on whether the push was correct.' },
          { id: 'unsure',    label: 'Not sure about the push', quality: 'acceptable', evLoss: 0.5, coaching: 'Uncertainty is fine — ICM is complex. But KJs at 14BB on the BTN is a clear shove by any standard push/fold chart. Study ICM push/fold tables to improve your tournament game.' },
        ],
      },
    ],
    summary: 'In tournament short-stack play, memorise push/fold charts for sub-20BB stacks. At 14BB, hands like KJs, QJs, KQo, and any pair are profitable shoves from late position. Never limp or min-raise short-stacked — it wastes fold equity. Focus on decisions, not outcomes.',
    tags: ['MTT', 'ICM', 'push-fold', 'tournament', 'short stack'],
  },
]
