import type { Puzzle } from '../puzzle-types'

export const PUZZLES_CASH_DYNAMICS: Puzzle[] = [

  // ── dyn-n01: BTN AK double-barrel value on dry board ─────────────────────
  {
    id: 'dyn-n01-btn-ak-double-barrel',
    title: 'BTN Double-Barrel — AK Two Pair on A-K-8-3',
    description: 'You open BTN with AK, BB defends. You flop top two pair on A-K-8. Execute a disciplined double-barrel value line through the turn and river.',
    difficulty: 'beginner',
    category: 'Double Barrel',
    gameType: 'cash',
    format: '6-max',
    heroPosition: 'BTN',
    villainPosition: 'BB',
    heroCards: ['Ac', 'Kd'],
    effectiveStack: 100,
    stakes: '$1/$2',
    summary: '',
    tags: [],
    steps: [
      {
        street: 'preflop',
        board: [],
        context: 'Folds to BTN. You raise to $5. SB folds. BB calls.',
        prompt: 'AcKd on the BTN — standard open, BB defends. What is your plan entering a SRP IP?',
        options: [
          { id: 'continue', label: 'Note: standard open — proceed to flop', quality: 'perfect', evLoss: 0, coaching: 'AKo is a mandatory BTN open. BB defending is standard. Your goal IP is to build the pot when you hit and extract 3 streets of value from BB\'s wide calling range.' },
        ],
      },
      {
        street: 'flop',
        board: ['As', 'Kh', '8d'],
        context: 'BB checks. Pot $10bb. Flop: As Kh 8d. You are IP.',
        prompt: 'You flopped top two pair on a dry A-K-8. BB checks. Do you c-bet for value, check back, or bet large?',
        options: [
          { id: 'check', label: 'Check (slowplay)', quality: 'mistake', evLoss: 2.5, coaching: 'Slowplaying top two pair is a mistake. BB has limited ability to improve and you need to charge 8x, 7x, and medium pairs. Bet now to build the pot.' },
          { id: 'bet-small', label: 'Bet 4bb (40% pot)', quality: 'perfect', evLoss: 0, coaching: 'Small c-bet is optimal on this dry board. Keeps BB\'s range wide (A9, AT, AJ, 8x, pocket pairs). All those hands will call and pay you off across multiple streets.' },
          { id: 'bet-large', label: 'Bet 9bb (90% pot)', quality: 'good', evLoss: 0.8, coaching: 'Large bet folds out too many of BB\'s medium-strength hands on a dry board. Small sizing extracts more EV over multiple streets.' },
        ],
      },
      {
        street: 'turn',
        board: ['As', 'Kh', '8d', '3c'],
        context: 'BB calls flop. Pot $18bb. Turn: 3c — blank. BB checks.',
        prompt: 'BB calls your flop c-bet. Blank 3c turn. BB checks again. Classic double-barrel spot. What is your sizing?',
        options: [
          { id: 'check', label: 'Check back (missed opportunity)', quality: 'mistake', evLoss: 3.8, coaching: 'Checking back with top two pair on a blank turn is a large EV leak. BB checked — they\'re still in the hand with something they\'ll call. A turn bet builds the pot for a river value bet.' },
          { id: 'bet-half', label: 'Bet 9bb (50% pot)', quality: 'good', evLoss: 0.5, coaching: 'Half-pot turn bet is fine. Keeps BB\'s range wide and sets up a river bet. Slightly larger might extract more from top pair hands.' },
          { id: 'bet-large', label: 'Bet 14bb (78% pot)', quality: 'perfect', evLoss: 0, coaching: 'Larger turn sizing is optimal. BB called the flop — they have something. On a dry board (no draws to worry about giving equity), bet large to build the pot for river value.' },
        ],
      },
      {
        street: 'river',
        board: ['As', 'Kh', '8d', '3c', '7s'],
        context: 'BB calls turn. Pot $46bb. River: 7s — blank. BB checks.',
        prompt: 'River 7s is a complete blank. BB called two streets. Your top two pair almost certainly wins. Complete the value triple-barrel?',
        options: [
          { id: 'check', label: 'Check (protect vs rare bluffs)', quality: 'mistake', evLoss: 7.5, coaching: 'Checking river with top two pair after two value bets and two calls is a significant value cut. BB has something that called twice — they will pay one more time. Never check top two pair on a blank river in this line.' },
          { id: 'bet-small', label: 'Bet 18bb (39% pot)', quality: 'good', evLoss: 1.5, coaching: 'Small value bet is fine — extracts from BB\'s Ax and Kx hands. A larger sizing might get equal calls from a committed BB.' },
          { id: 'bet-large', label: 'Bet 32bb (70% pot)', quality: 'perfect', evLoss: 0, coaching: 'Large river value bet. BB called flop and turn — they\'re not folding a reasonable made hand on a blank river. Ax, Kx, 88, 33 all call here. Size for max extraction and complete the triple-barrel value line.' },
        ],
      },
    ],
  },

  // ── dyn-n02: BB probe bet theory — act first when IP didn't bet ──────────
  {
    id: 'dyn-n02-bb-probe-bet',
    title: 'BB Probe Bet — Seize Initiative When BTN Checks Back',
    description: 'You defend BB with KhTh. BTN checks back the flop (showing weakness). Lead the turn with a probe bet to win the pot.',
    difficulty: 'intermediate',
    category: 'Probe Bet',
    gameType: 'cash',
    format: '6-max',
    heroPosition: 'BB',
    villainPosition: 'BTN',
    heroCards: ['Kh', 'Th'],
    effectiveStack: 100,
    stakes: '$1/$2',
    summary: '',
    tags: [],
    steps: [
      {
        street: 'preflop',
        board: [],
        context: 'Folds to BTN who raises to $5. SB folds. BB defends.',
        prompt: 'BB with KhTh vs BTN raise. Standard defend.',
        options: [
          { id: 'continue', label: 'Note: standard defend — proceed to flop', quality: 'perfect', evLoss: 0, coaching: 'KTs is a strong BB defend vs BTN. Flush potential, connectivity, and decent equity vs BTN\'s wide range. Standard call.' },
        ],
      },
      {
        street: 'flop',
        board: ['Kc', '7s', '2d'],
        context: 'Pot $10bb. Flop: Kc7s2d. You check. BTN checks back.',
        prompt: 'You check top pair. BTN checks back. BTN just signaled weakness. What is your turn plan?',
        options: [
          { id: 'wait', label: 'Note: BTN checked back — proceed to turn (probe bet spot)', quality: 'perfect', evLoss: 0, coaching: 'When the preflop aggressor checks back the flop IP, they show weakness. On K72 dry, BTN would c-bet with AK, KQ, and strong draws. Checking back signals medium-strength or air hands. The turn is yours to lead.' },
        ],
      },
      {
        street: 'turn',
        board: ['Kc', '7s', '2d', '9h'],
        context: 'Pot $10bb. Turn: 9h. You act first OOP after BTN\'s flop check-back.',
        prompt: 'BTN checked back the flop. Turn 9h arrives. You have KhTh — top pair + gutshot. Lead as a probe bet or check again?',
        options: [
          { id: 'check', label: 'Check again (give up initiative)', quality: 'mistake', evLoss: 3.5, coaching: 'Checking again after BTN showed weakness is a big mistake. BTN\'s flop check-back capped their range significantly — no sets, no KQ, no AK. Your top pair is ahead of most of their range. Lead now and take control.' },
          { id: 'bet-small', label: 'Probe bet 5bb (50% pot)', quality: 'perfect', evLoss: 0, coaching: 'Lead the turn as a probe bet. You have top pair + a gutshot (J gives a straight). BTN\'s capped range will fold medium pairs and call with 7x, 9x, and hands that improved. You win the pot immediately or extract value.' },
          { id: 'bet-large', label: 'Lead 9bb (90% pot)', quality: 'good', evLoss: 0.8, coaching: 'Large probe bet works but might fold too many of BTN\'s one-pair hands that would have called a smaller bet across multiple streets.' },
        ],
      },
      {
        street: 'river',
        board: ['Kc', '7s', '2d', '9h', '3s'],
        context: 'BTN calls turn probe. Pot $20bb. River: 3s. You act first OOP.',
        prompt: 'BTN called your probe bet. River 3s is a blank. You have top pair. Follow up the probe or check?',
        options: [
          { id: 'check-call', label: 'Check-call (give up initiative again)', quality: 'good', evLoss: 1.2, coaching: 'Check-calling is fine — BTN might bluff with their missed draws. But leading extracts value from the hands that called the turn (medium pairs, 9x, 7x) before they get a free showdown.' },
          { id: 'bet', label: 'Bet 12bb (60% pot)', quality: 'perfect', evLoss: 0, coaching: 'Lead river for thin value. BTN called your probe bet with something. On a blank river, you want to extract one more bet from 7x, 9x, and weak Kx hands. A medium-sized lead is the correct completion of the probe-bet line.' },
          { id: 'check-fold', label: 'Check-fold (scared of river)', quality: 'mistake', evLoss: 4.5, coaching: 'Folding top pair after leading the turn probe is a massive mistake. BTN called the turn — they have something. If they bet the river, it can easily be a bluff or thin value hand you beat. Never check-fold top pair in this spot.' },
        ],
      },
    ],
  },

  // ── dyn-n03: CO delayed cbet — miss flop, hit turn, barrel off ──────────
  {
    id: 'dyn-n03-co-delayed-cbet',
    title: 'CO Delayed C-Bet — Check Flop, Barrel Turn',
    description: 'You open CO with AsJh. BTN calls. You check back a miss on the flop and hit top pair on the turn. Execute the delayed c-bet.',
    difficulty: 'intermediate',
    category: 'Delayed C-Bet',
    gameType: 'cash',
    format: '6-max',
    heroPosition: 'CO',
    villainPosition: 'BTN',
    heroCards: ['As', 'Jh'],
    effectiveStack: 100,
    stakes: '$1/$2',
    summary: '',
    tags: [],
    steps: [
      {
        street: 'preflop',
        board: [],
        context: 'Folds to CO. You raise to $5. BTN calls. Blinds fold. Pot $11bb.',
        prompt: 'AJo from CO — standard open. BTN calls IP. Heading to the flop OOP.',
        options: [
          { id: 'continue', label: 'Note: standard open — proceed to flop', quality: 'perfect', evLoss: 0, coaching: 'AJo is a standard CO open. BTN calling IP is common. You\'ll need to navigate carefully OOP.' },
        ],
      },
      {
        street: 'flop',
        board: ['9d', '7c', '3h'],
        context: 'Pot $11bb. Flop: 9d7c3h. You act first OOP. BTN will check or call.',
        prompt: 'You missed the flop completely — no pair, no draw with AJo on 9-7-3. Do you c-bet or check?',
        options: [
          { id: 'bet', label: 'C-bet 7bb (64% pot)', quality: 'good', evLoss: 0.7, coaching: 'C-betting AJo on this low connected board that hits BTN\'s calling range (suited connectors, pocket pairs) is a higher-risk bluff. Checking back sets up the delayed c-bet line.' },
          { id: 'check', label: 'Check back (set up delayed c-bet)', quality: 'perfect', evLoss: 0, coaching: 'Optimal. 9-7-3 hits BTN\'s range heavily (77-99 sets, 8-6s, 6-5s). Your AJo has nothing here. Check back, take a free card, and attack the turn when BTN also checks.' },
        ],
      },
      {
        street: 'turn',
        board: ['9d', '7c', '3h', 'Ah'],
        context: 'BTN checks turn. Pot $11bb. Turn: Ah. You act first OOP after checking the flop.',
        prompt: 'You hit top pair on the Ah turn. BTN checked (showed continued weakness after your check-back). This is the delayed c-bet spot. How do you bet?',
        options: [
          { id: 'check', label: 'Check again (slowplay)', quality: 'mistake', evLoss: 3.8, coaching: 'Checking twice with TPTK is a significant mistake. BTN has shown weakness on both streets. You must bet now while your hand is likely best and there\'s still value to extract.' },
          { id: 'bet-small', label: 'Bet 5bb (45% pot)', quality: 'good', evLoss: 0.7, coaching: 'Small delayed c-bet fools BTN into thinking the ace missed you. However, a larger sizing extracts more from their 9x, 7x, and pair hands.' },
          { id: 'bet-large', label: 'Bet 9bb (82% pot)', quality: 'perfect', evLoss: 0, coaching: 'Large delayed c-bet. You checked back the flop (BTN thinks you\'re weak), now bet large on an ace. This looks like an ace that just landed and you pounced. BTN will call with 9x and 7x that won\'t believe your turn bet represents a real hand.' },
        ],
      },
      {
        street: 'river',
        board: ['9d', '7c', '3h', 'Ah', '4s'],
        context: 'BTN calls turn. Pot $29bb. River: 4s — blank. BTN checks.',
        prompt: 'BTN called your delayed c-bet. River 4s is a brick. BTN checks. TPTK is likely best. What is your river play?',
        options: [
          { id: 'check', label: 'Check (pot control)', quality: 'mistake', evLoss: 4.5, coaching: 'Checking river after a delayed c-bet that got called is a value mistake. BTN has 9x, 7x, or a stubborn pair — they\'ll call a river bet. You extracted less by checking.' },
          { id: 'bet-small', label: 'Bet 12bb (41% pot)', quality: 'perfect', evLoss: 0, coaching: 'Thin value bet. BTN called your delayed c-bet with something — second pair, pocket pair, or stubborn gut. A medium river lead extracts one final bet before showdown. Complete the delayed c-bet line.' },
          { id: 'bet-large', label: 'Bet 25bb (86% pot)', quality: 'good', evLoss: 1.5, coaching: 'Large river bet might be too big for the range of hands BTN can call with here. A smaller sizing extracts more total EV.' },
        ],
      },
    ],
  },

  // ── dyn-n04: BTN float and steal — call flop, take it away on turn ───────
  {
    id: 'dyn-n04-btn-float-steal',
    title: 'BTN Float and Steal — Call Flop, Take Pot on Turn',
    description: 'BTN opens and you call from the BB. You float a flop c-bet in position with overcards. Take the pot away when BB checks the turn.',
    difficulty: 'intermediate',
    category: 'Float and Steal',
    gameType: 'cash',
    format: '6-max',
    heroPosition: 'BTN',
    villainPosition: 'BB',
    heroCards: ['Qh', 'Jd'],
    effectiveStack: 100,
    stakes: '$1/$2',
    summary: '',
    tags: [],
    steps: [
      {
        street: 'preflop',
        board: [],
        context: 'Folds to BTN. You raise to $5. SB folds. BB calls.',
        prompt: 'QhJd on BTN — open, BB defends. What is your plan entering a SRP IP with a connected hand?',
        options: [
          { id: 'continue', label: 'Note: standard open — proceed to flop', quality: 'perfect', evLoss: 0, coaching: 'QJo is a standard BTN open. The connected nature gives good equity even as a floating candidate.' },
        ],
      },
      {
        street: 'flop',
        board: ['8d', '6s', '2c'],
        context: 'BB checks. Pot $10bb. Flop: 8d6s2c — completely missed you. BB leads 6bb (small donk).',
        prompt: 'BB leads small on a dry 8-6-2 board. You have QJo — two overcards only. Do you raise, call, or fold?',
        options: [
          { id: 'fold', label: 'Fold (missed everything)', quality: 'mistake', evLoss: 1.8, coaching: 'Folding QJo on an 8-6-2 board is too tight. BB is donk-betting small, which is often done with pair+draw or bluffing. You have two overcards and position — floating to see the turn is profitable.' },
          { id: 'raise', label: 'Raise to $18 (bluff raise)', quality: 'good', evLoss: 0.9, coaching: 'Raising the donk bet is aggressive but forces a decision. However, calling and taking the pot on the turn is a more consistent line with QJo.' },
          { id: 'call', label: 'Call $6 (float with position)', quality: 'perfect', evLoss: 0, coaching: 'Call the small donk bet and keep BB\'s range wide. Your plan: if BB checks the turn, bet and take the pot. Your position and range advantage will win this pot often. This is a classic float-and-steal setup.' },
        ],
      },
      {
        street: 'turn',
        board: ['8d', '6s', '2c', 'Ks'],
        context: 'BB checks turn. Pot $22bb. Turn: Ks. You are IP.',
        prompt: 'BB checks after donk-betting the flop. A king arrived. You have QJo (no improvement). The float-and-steal moment has arrived — do you bet?',
        options: [
          { id: 'check', label: 'Check (missed the king too)', quality: 'mistake', evLoss: 4.2, coaching: 'Checking back the turn after floating is a mistake. You called specifically to take the pot when BB shows weakness. BB checked — this is your moment. Bet and take down the pot. QJ with overcards can still catch up too.' },
          { id: 'bet-large', label: 'Bet 18bb (82% pot)', quality: 'perfect', evLoss: 0, coaching: 'Large turn bet. You floated the flop and BB checked the turn — they\'re weak. A large bet on a king card looks like you called the flop with KX and hit. BB will fold most of their one-pair range. Classic float-and-steal execution.' },
          { id: 'bet-small', label: 'Bet 8bb (36% pot)', quality: 'good', evLoss: 1.5, coaching: 'Small bet might not fold out BB\'s weak pairs. With QJ you need fold equity, not just pot odds. A larger sizing works better here.' },
        ],
      },
      {
        street: 'river',
        board: ['8d', '6s', '2c', 'Ks', 'Qd'],
        context: 'BB calls turn. Pot $58bb. River: Qd — you hit middle pair! BTN checks.',
        prompt: 'River Qd gives you middle pair (pair of Queens). BB called the turn but checked the river. Now you have a real hand — what do you do?',
        options: [
          { id: 'check', label: 'Check back (only middle pair)', quality: 'mistake', evLoss: 5.2, coaching: 'Checking back middle pair on the river after the turn bet got called is a value mistake. BB checked the river — they have a weakish hand (maybe 8x, 6x, or a bluff-catcher). Your Qd is ahead of much of that range. Bet.' },
          { id: 'bet-small', label: 'Bet 22bb (38% pot)', quality: 'perfect', evLoss: 0, coaching: 'Thin value bet. You started as a bluff but now have a real hand. BB called the turn and checked — they have second pair or a bluff-catcher. Extract one final bet. The line of float-bluff → value makes your hand look like a missed draw that turned into air, increasing BB\'s call frequency.' },
          { id: 'bet-large', label: 'Bet 50bb (86% pot)', quality: 'good', evLoss: 2.1, coaching: 'Too large for middle pair after the float-and-steal line. BB will only call a huge bet with better hands. A smaller sizing extracts more.' },
        ],
      },
    ],
  },

  // ── dyn-n05: BTN overbet river bluff on paired board ─────────────────────
  {
    id: 'dyn-n05-btn-overbet-bluff',
    title: 'BTN River Overbet Bluff — Paired Board Polarized Bet',
    description: 'You open BTN with AcTc, flop a flush draw, brick the river, and face a check. Execute a river overbet bluff on a paired, scary board.',
    difficulty: 'advanced',
    category: 'River Overbet',
    gameType: 'cash',
    format: '6-max',
    heroPosition: 'BTN',
    villainPosition: 'BB',
    heroCards: ['Ac', 'Tc'],
    effectiveStack: 100,
    stakes: '$1/$2',
    summary: '',
    tags: [],
    steps: [
      {
        street: 'preflop',
        board: [],
        context: 'Folds to BTN. You raise to $5. SB folds. BB calls.',
        prompt: 'AcTc on BTN — open. Standard play, BB calls.',
        options: [
          { id: 'continue', label: 'Note: standard open — proceed to flop', quality: 'perfect', evLoss: 0, coaching: 'ATs is a premium BTN open with nut flush potential. Standard raise.' },
        ],
      },
      {
        street: 'flop',
        board: ['Kc', '7c', '2h'],
        context: 'BB checks. Pot $10bb. Flop: Kc7c2h. You are IP.',
        prompt: 'You have AcTc — nut flush draw (9 outs) + backdoor straight potential on K-7-2. BB checks. How do you play?',
        options: [
          { id: 'check', label: 'Check (free card)', quality: 'good', evLoss: 0.5, coaching: 'Taking a free card is fine here — you have 9 outs and no made hand. However, c-betting as a semi-bluff also builds a pot you could win immediately.' },
          { id: 'bet', label: 'Bet 6bb (60% pot)', quality: 'perfect', evLoss: 0, coaching: 'C-bet the flush draw. You have 9 outs and a nut draw — building the pot now extracts value when you hit. BB will call with medium pairs and you have massive equity against them.' },
        ],
      },
      {
        street: 'turn',
        board: ['Kc', '7c', '2h', '9d'],
        context: 'BB calls flop. Pot $22bb. Turn: 9d — missed. BB checks.',
        prompt: 'You still have 9 outs (flush draw). Turn 9d adds gutshot (JT). BB checks. Continue semi-barreling?',
        options: [
          { id: 'check', label: 'Check (take free river card)', quality: 'good', evLoss: 0.8, coaching: 'Checking gives a free card to hit the flush. Fine play but you miss fold equity. BB might have Kx that folds to a barrel.' },
          { id: 'bet', label: 'Bet 14bb (64% pot)', quality: 'perfect', evLoss: 0, coaching: 'Continue the semi-bluff. Your 9 outs (~18% equity) plus fold equity makes barreling profitable. BB has Kx or a pair — they might fold to two streets of pressure.' },
        ],
      },
      {
        street: 'river',
        board: ['Kc', '7c', '2h', '9d', '9s'],
        context: 'BB calls turn. Pot $50bb. River: 9s — board pairs! Flush missed. BB checks.',
        prompt: 'River 9s pairs the board and your flush bricked. You have only ace-high. BB checked. Do you overbet-bluff or give up?',
        options: [
          { id: 'check', label: 'Check (give up bluff)', quality: 'good', evLoss: 3.5, coaching: 'Checking is fine if you think BB always calls. But on a paired board (9s), BB\'s full house range is mainly 99, 77, 22, 97, 72 — a small portion. Most of their range is Kx that becomes a bluff-catcher. An overbet leverages this perfectly.' },
          { id: 'bet-standard', label: 'Bet 30bb (60% pot)', quality: 'good', evLoss: 1.8, coaching: 'A standard river bet is fine but doesn\'t maximize fold equity. On a paired board, BB\'s range is polarized — they either have a full house (call anything) or Kx (fold to a big enough bet). Standard sizing doesn\'t put maximum pressure on their fold range.' },
          { id: 'overbet', label: 'Overbet jam ~$50bb (100%+ pot)', quality: 'perfect', evLoss: 0, coaching: 'Overbet the river. The 9s pairing the board splits BB\'s range into boats (hands that call anything) and Kx (bluff-catchers). A massive overbet maximizes fold equity on Kx hands while getting paid by the small portion of boats. This is a textbook overbet bluff situation.' },
        ],
      },
    ],
  },

  // ── dyn-n06: BB check-raise turn as a semi-bluff ─────────────────────────
  {
    id: 'dyn-n06-bb-checkraise-turn',
    title: 'BB Check-Raise Turn — Semi-Bluff with Equity',
    description: 'You defend BB and flop a combo draw. BTN c-bets and you call. Turn gives you more equity. Execute a check-raise semi-bluff on the turn.',
    difficulty: 'advanced',
    category: 'Check-Raise',
    gameType: 'cash',
    format: '6-max',
    heroPosition: 'BB',
    villainPosition: 'BTN',
    heroCards: ['7h', '6h'],
    effectiveStack: 100,
    stakes: '$1/$2',
    summary: '',
    tags: [],
    steps: [
      {
        street: 'preflop',
        board: [],
        context: 'Folds to BTN who raises to $5. SB folds. BB (you) defends.',
        prompt: 'BB with 7h6h vs BTN. Defend or fold?',
        options: [
          { id: 'call', label: 'Call $3', quality: 'perfect', evLoss: 0, coaching: '76s is a clear BB defend — suited connector with great implied odds and strong playability on connected boards. Always defend this vs BTN.' },
          { id: 'fold', label: 'Fold', quality: 'mistake', evLoss: 2.2, coaching: 'Folding 76s BB vs BTN is a mistake. The implied odds with a connected suited hand against BTN\'s wide range are excellent. Defend.' },
        ],
      },
      {
        street: 'flop',
        board: ['8d', '5c', '2h'],
        context: 'Pot $10bb. Flop: 8d5c2h. You check. BTN bets 6bb.',
        prompt: 'You have 7h6h — open-ended straight draw (4+4 outs to 9-high and 4-high straight). BTN c-bets. Call or check-raise?',
        options: [
          { id: 'fold', label: 'Fold (only a draw)', quality: 'mistake', evLoss: 3.5, coaching: 'Folding 8 outs OOP is a mistake. Your open-ender has solid equity and the implied odds when you hit are enormous. At minimum call.' },
          { id: 'check-raise', label: 'Check-raise to $18', quality: 'good', evLoss: 0.6, coaching: 'Check-raising the flop is aggressive but valid. Risk: BTN 3-bets and you have to fold your 8-outer. Calling is slightly better EV as it preserves your equity.' },
          { id: 'call', label: 'Call $6', quality: 'perfect', evLoss: 0, coaching: 'Call and preserve your 8 outs. Your plan: if a 4 or 9 comes (or you pick up more equity), you may check-raise the turn. Calling the flop is the standard play with an open-ender.' },
        ],
      },
      {
        street: 'turn',
        board: ['8d', '5c', '2h', '6d'],
        context: 'You called flop. Pot $22bb. Turn: 6d — you made a pair and added a flush draw! BTN bets 14bb.',
        prompt: 'You hit a pair of sixes AND a flush draw (hearts, not diamonds — but you still have 8 outs to the straight). Wait — you have 7h6h: you made middle pair + open-ended straight draw. BTN bets 14bb into $22bb. Check-raise or call?',
        options: [
          { id: 'fold', label: 'Fold', quality: 'mistake', evLoss: 7.2, coaching: 'Folding a pair + 8-out straight draw to one bet on the turn is a big mistake. You have significant equity and are getting a reasonable price. Continue.' },
          { id: 'call', label: 'Call $14 (see river)', quality: 'good', evLoss: 1.5, coaching: 'Calling is fine and preserves your equity. But check-raising leverages your pair + draw into maximum fold equity — you might win the pot immediately.' },
          { id: 'check-raise', label: 'Check-raise to $38', quality: 'perfect', evLoss: 0, coaching: 'Check-raise the turn. You have middle pair + open-ender. This is a powerful semi-bluff position: you have ~30% equity plus fold equity from the raise. BTN\'s barreling range includes many hands that will fold to a raise (AJ, AT, QJ, flush draws). Take the pot down now or see a river with equity.' },
        ],
      },
      {
        street: 'river',
        board: ['8d', '5c', '2h', '6d', '4s'],
        context: 'BTN calls turn check-raise. Pot $98bb. River: 4s — you completed the straight (7-6-5-4-3... wait, you need 3 or 9 for 76 on 8-5-2-6)! Actually 4s gives you 7h6h on 8-5-2-6-4 — gutshot to 3-7 straight doesn\'t complete. You have middle pair. BTN checks.',
        prompt: 'River 4s — your 8-outer (9 or 3) missed. You have only middle pair (6s) and BTN checked. Do you bluff, bet thin value, or check?',
        options: [
          { id: 'check', label: 'Check (showdown value only)', quality: 'good', evLoss: 1.2, coaching: 'Checking is fine if you think BTN always calls. However, BTN\'s range after calling a turn check-raise and checking the river is often a bluff-catcher that might fold to a bet.' },
          { id: 'bet-large', label: 'Bet $60bb (61% pot overbet)', quality: 'perfect', evLoss: 0, coaching: 'Bet large as a river bluff. BTN called a turn check-raise and checked the river — their range is weakened (medium-strength one-pair hands). A big bet here leverages the story you\'ve told (strong two-pair or better) and gets folds from Kx, Jx, and stubborn pocket pairs below 8.' },
          { id: 'bet-small', label: 'Bet $25bb (thin value)', quality: 'good', evLoss: 1.8, coaching: 'Small bet might get called by worse pairs but doesn\'t maximize fold equity. Given the story you\'ve built (check-raise on turn), a larger sizing has better EV.' },
        ],
      },
    ],
  },

  // ── dyn-n07: CO range bet small on connected board ───────────────────────
  {
    id: 'dyn-n07-co-range-bet-small',
    title: 'CO Range Bet — Small Bet on an Uncontested Board',
    description: 'You open CO with KsJs, BTN calls. Flop comes J-high and dry. Learn when to use small "range bets" to extract value while keeping BTN\'s entire range in.',
    difficulty: 'beginner',
    category: 'Range Betting',
    gameType: 'cash',
    format: '6-max',
    heroPosition: 'CO',
    villainPosition: 'BTN',
    heroCards: ['Ks', 'Js'],
    effectiveStack: 100,
    stakes: '$1/$2',
    summary: '',
    tags: [],
    steps: [
      {
        street: 'preflop',
        board: [],
        context: 'Folds to CO. You raise to $5. BTN calls. Pot $11bb.',
        prompt: 'KsJs on CO — standard open. BTN calls IP. Plan for a SRP OOP.',
        options: [
          { id: 'continue', label: 'Note: standard open — proceed to flop', quality: 'perfect', evLoss: 0, coaching: 'KJs is a strong CO open — connected, suited, and good blocker value. Standard raise.' },
        ],
      },
      {
        street: 'flop',
        board: ['Jd', '5c', '2h'],
        context: 'Pot $11bb. Flop: Jd5c2h — dry top pair board. You act first OOP.',
        prompt: 'Jd5c2h — you have top pair with KsJs. The board is extremely dry. Should you bet large to protect, bet small to keep BTN in, or check?',
        options: [
          { id: 'check', label: 'Check (protect range)', quality: 'good', evLoss: 0.5, coaching: 'Checking is fine for range balance. However, on J52 dry, your range advantage is so strong that betting small allows you to bet your entire range for value.' },
          { id: 'bet-large', label: 'Bet 8bb (73% pot)', quality: 'good', evLoss: 0.8, coaching: 'Large bet folds too much of BTN\'s range on a dry board. You want to keep all of BTN\'s pairs in — they\'ll pay you over multiple streets.' },
          { id: 'bet-small', label: 'Bet 3bb (27% pot) — range bet', quality: 'perfect', evLoss: 0, coaching: 'Small range bet. On J52 dry, you have a massive range advantage (all your Jx, 55, 22 combos, etc.). Betting your entire range at a small size keeps BTN\'s whole range in — pocket pairs, backdoor draws, and ace-high all continue. This maximizes EV over 3 streets.' },
        ],
      },
      {
        street: 'turn',
        board: ['Jd', '5c', '2h', '9s'],
        context: 'BTN calls flop. Pot $17bb. Turn: 9s — adds T8 gutshot for BTN. You act first OOP.',
        prompt: '9s turn adds a straight draw for BTN (T8 gutshot to Q or 8). BTN called your small range bet. Adjust sizing or keep betting small?',
        options: [
          { id: 'bet-small', label: 'Bet 7bb (41% pot)', quality: 'good', evLoss: 0.5, coaching: 'Continuing with a small bet is fine. Turn is slightly scarier (9s) so a larger sizing makes sense to charge draws.' },
          { id: 'bet-medium', label: 'Bet 11bb (65% pot)', quality: 'perfect', evLoss: 0, coaching: 'Increase your sizing on the turn. The 9 adds a straight draw. Your top pair is strong but you need to charge BTN\'s T8 gutshot and any combo draws. A medium bet balances value extraction and protection.' },
          { id: 'check', label: 'Check (pot control)', quality: 'mistake', evLoss: 3.2, coaching: 'Checking top pair after a range bet call is a mistake. BTN is in the pot with something. Keep extracting value — the board isn\'t scary enough to give up the initiative.' },
        ],
      },
      {
        street: 'river',
        board: ['Jd', '5c', '2h', '9s', '3d'],
        context: 'BTN calls turn. Pot $39bb. River: 3d — blank. You act first OOP.',
        prompt: 'River 3d bricks all draws. BTN called two streets. Top pair, good kicker, blank river. How do you complete the value line?',
        options: [
          { id: 'check', label: 'Check (scared money)', quality: 'mistake', evLoss: 5.5, coaching: 'Never check top pair after two streets of value bets on a completely blank river. BTN called both streets — they have something and will call a river bet.' },
          { id: 'bet-small', label: 'Bet 14bb (36% pot)', quality: 'good', evLoss: 1.2, coaching: 'Thin value bet is fine. Extracts from BTN\'s calling range.' },
          { id: 'bet-medium', label: 'Bet 22bb (56% pot)', quality: 'perfect', evLoss: 0, coaching: 'Medium river bet for maximum value extraction. BTN called twice — they have a pair or bluff-catcher. A 50-60% river bet is the optimal sizing to get paid while not folding out all of BTN\'s range. Complete the three-street value extraction line.' },
        ],
      },
    ],
  },

  // ── dyn-n08: SB second pair calldown vs BTN aggression ───────────────────
  {
    id: 'dyn-n08-sb-second-pair-calldown',
    title: 'SB Second Pair — Calldown vs BTN Triple Barrel',
    description: 'You defend SB with T8s vs BTN open. Flop gives you second pair. BTN barrels all three streets. Decide when to call and when to fold.',
    difficulty: 'intermediate',
    category: 'Calldown',
    gameType: 'cash',
    format: '6-max',
    heroPosition: 'SB',
    villainPosition: 'BTN',
    heroCards: ['Ts', '8s'],
    effectiveStack: 100,
    stakes: '$1/$2',
    summary: '',
    tags: [],
    steps: [
      {
        street: 'preflop',
        board: [],
        context: 'Folds to BTN who raises to $5. SB (you) defends by calling $4. BB folds.',
        prompt: 'SB with Ts8s facing BTN raise. Defend, 3-bet, or fold?',
        options: [
          { id: 'fold', label: 'Fold', quality: 'good', evLoss: 0.5, coaching: 'Folding T8s OOP from SB is a marginal decision. The hand has decent equity but SB is the worst position at the table. If folding is your default, it\'s fine. Calling is slightly better EV with a suited connector.' },
          { id: 'call', label: 'Call $4', quality: 'perfect', evLoss: 0, coaching: 'T8s from SB has enough equity to defend vs a BTN open. Suited connector playability, implied odds, and ~40% equity vs BTN\'s range makes this a call.' },
          { id: '3bet', label: '3-bet to $18', quality: 'good', evLoss: 0.8, coaching: '3-betting T8s from SB as a bluff is viable but risky — you\'re out of position for the rest of the hand. Calling is preferred.' },
        ],
      },
      {
        street: 'flop',
        board: ['Jh', '8c', '3d'],
        context: 'Pot $11bb. Flop: Jh8c3d. You act first OOP.',
        prompt: 'You flopped second pair (eights) with a gutshot (T8 on J83 — need 9 for a straight). BTN open-raised and called. Do you lead, check-call, or check-fold?',
        options: [
          { id: 'check-fold', label: 'Check-fold', quality: 'mistake', evLoss: 4.5, coaching: 'Folding second pair + gutshot OOP to a c-bet is too tight. You have 8 outs (gutshot + set outs) and a solid made hand vs BTN\'s c-bet range (which includes many bluffs).' },
          { id: 'lead', label: 'Lead 6bb', quality: 'good', evLoss: 0.9, coaching: 'Leading second pair OOP is a bit weak with this hand. Check-calling preserves pot control while keeping BTN\'s bluffs in.' },
          { id: 'check-call', label: 'Check-call BTN\'s c-bet', quality: 'perfect', evLoss: 0, coaching: 'Check-call is correct. BTN will c-bet their wide range on J83. You call with second pair + gutshot, keeping all bluffs in BTN\'s range. Your hand is too strong to fold but too weak to lead.' },
        ],
      },
      {
        street: 'turn',
        board: ['Jh', '8c', '3d', 'Qd'],
        context: 'BTN bets 6bb on flop. You call. Pot $23bb. Turn: Qd. You act first OOP.',
        prompt: 'Qd turn puts a straight (KT) possibility on board. BTN called your flop call (preflop aggressor). You act first. Do you check-call or check-fold the turn?',
        options: [
          { id: 'check-fold', label: 'Check-fold if BTN bets', quality: 'mistake', evLoss: 4.8, coaching: 'Folding second pair on the turn after the flop call is too weak. Your second pair is still likely ahead of a significant portion of BTN\'s barreling range (A9, AK-missed, KT, QX semi-bluffs, pure air). Continue.' },
          { id: 'lead', label: 'Lead 12bb', quality: 'good', evLoss: 1.5, coaching: 'Leading the turn is aggressive — you represent a range that includes Qx, but it\'s hard to credibly do that from SB vs BTN. Checking and calling is a cleaner line.' },
          { id: 'check-call', label: 'Check-call BTN\'s barrel', quality: 'perfect', evLoss: 0, coaching: 'Check-call. Second pair is a solid bluff-catcher here. BTN is barreling their c-bet range — which includes plenty of air and semi-bluffs. You need to catch two streets of betting to determine if BTN is bluffing off.' },
        ],
      },
      {
        street: 'river',
        board: ['Jh', '8c', '3d', 'Qd', '5h'],
        context: 'BTN barrels turn. You call. Pot $55bb. River: 5h — blank. BTN jams $45bb.',
        prompt: 'River 5h is a complete blank. BTN jams $45bb into a $55bb pot. You need ~45% pot odds to call. Second pair (eights). Do you call or fold?',
        options: [
          { id: 'call', label: 'Call $45 (second pair bluff-catcher)', quality: 'perfect', evLoss: 0, coaching: 'Call. You need to win ~45% to break even. After two streets of calling, BTN\'s range consists of value hands (JJ, QQ, AJ, KQ) AND a significant bluff range (busted draws, missed AK, AQs that decided to triple-barrel). Your second pair beats all their bluffs. The math supports calling.' },
          { id: 'fold', label: 'Fold (too many better hands possible)', quality: 'mistake', evLoss: 6.5, coaching: 'Folding after two streets of calling is a major mistake. You called the turn with second pair specifically to be a bluff-catcher on the river. BTN\'s range after three barrels on J-Q-5 runout includes massive bluff frequency. Call.' },
        ],
      },
    ],
  },

]
