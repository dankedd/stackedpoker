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


  // ── dyn-n09: BTN AK double-barrel blank turn on dry board ────────────────
  {
    id: 'dyn-n09-btn-ak-double-barrel-blank',
    title: 'BTN Double-Barrel — AK Extracts Value on Blank Turn',
    description: 'You open BTN with AsKs, c-bet a top-pair flop, and the turn bricks. Execute a second barrel to extract maximum value from BB\'s wide calling range.',
    difficulty: 'beginner',
    category: 'Double Barrel',
    gameType: 'cash',
    format: '6-max',
    heroPosition: 'BTN',
    villainPosition: 'BB',
    heroCards: ['As', 'Ks'],
    effectiveStack: 100,
    stakes: '$1/$2',
    summary: '',
    tags: [],
    steps: [
      {
        street: 'preflop',
        board: [],
        context: 'Folds to BTN. You raise to $5. SB folds. BB calls.',
        prompt: 'AsKs on BTN — premium suited hand. BB defends. What is your plan for the flop?',
        options: [
          { id: 'continue', label: 'Note: standard open — proceed to flop', quality: 'perfect', evLoss: 0, coaching: 'AKs is the second-best starting hand. Opening BTN and c-betting a K-high flop for value is straightforward. Plan to extract three streets when you flop top pair.' },
        ],
      },
      {
        street: 'flop',
        board: ['Kh', '7c', '2d'],
        context: 'BB checks. Pot $10bb. Flop: Kh 7c 2d — dry top pair board.',
        prompt: 'You flopped top pair top kicker on a dry K-7-2 rainbow. BB checks. How do you c-bet?',
        options: [
          { id: 'check', label: 'Check back (slowplay)', quality: 'mistake', evLoss: 2.5, coaching: 'Checking TPTK on a dry board is a mistake. BB has Kx, 7x, and pocket pairs that will call a small bet. Slowplaying gives BB a free card and reduces the pot you can extract on later streets.' },
          { id: 'bet-small', label: 'Bet 4bb (40% pot)', quality: 'perfect', evLoss: 0, coaching: 'Small c-bet is optimal on this dry K-7-2 board. You keep BB\'s entire range in — all their Kx, 7x, pocket pairs, and ace-high draws. They call with a wide range and you extract over multiple streets.' },
          { id: 'bet-large', label: 'Bet 8bb (80% pot)', quality: 'good', evLoss: 0.9, coaching: 'Large bet folds too much of BB\'s range on this dry board. Small sizing is better — TPTK doesn\'t need protection here, just value.' },
        ],
      },
      {
        street: 'turn',
        board: ['Kh', '7c', '2d', '4s'],
        context: 'BB calls flop. Pot $18bb. Turn: 4s — complete brick. BB checks.',
        prompt: 'BB called your flop c-bet. The 4s turn is a perfect blank — no draws, no improvements for BB. BB checks again. Fire the second barrel?',
        options: [
          { id: 'check', label: 'Check back (missed opportunity)', quality: 'mistake', evLoss: 3.5, coaching: 'Checking back TPTK on a blank turn is a costly value error. BB called the flop with something — they\'ll call again. A turn check gives them a free river card and shrinks the pot you can extract from on the river.' },
          { id: 'bet-half', label: 'Bet 9bb (50% pot)', quality: 'good', evLoss: 0.5, coaching: 'Half-pot turn bet is fine. Sets up a river value bet and keeps BB\'s range wide.' },
          { id: 'bet-large', label: 'Bet 14bb (78% pot)', quality: 'perfect', evLoss: 0, coaching: 'Larger turn bet is optimal. BB called the flop — they have Kx, 7x, or a pocket pair. On a completely blank board with no draws, bet large to build the pot. You want to get stacks in by the river with TPTK.' },
        ],
      },
      {
        street: 'river',
        board: ['Kh', '7c', '2d', '4s', '9h'],
        context: 'BB calls turn. Pot $46bb. River: 9h — near-blank. BB checks.',
        prompt: 'River 9h is mostly a blank (adds T8 backdoor straight but unlikely BB has it). BB called two streets and checks. Complete the triple-barrel?',
        options: [
          { id: 'check', label: 'Check (protect river EV)', quality: 'mistake', evLoss: 7.0, coaching: 'Checking river after two value bets on a board with no draws is a large EV mistake. BB called twice — they have something. TPTK is almost certainly best. Bet for maximum value.' },
          { id: 'bet-small', label: 'Bet 18bb (39% pot)', quality: 'good', evLoss: 1.5, coaching: 'Small river bet extracts from BB\'s Kx and 7x hands. Fine play.' },
          { id: 'bet-large', label: 'Bet 32bb (70% pot)', quality: 'perfect', evLoss: 0, coaching: 'Large triple-barrel. BB called the flop and turn on a board with no draws — their range is capped at one-pair hands. They are pot-committed emotionally and will call a river bet with all their Kx and better pairs. Size up for maximum extraction.' },
        ],
      },
    ],
  },

  // ── dyn-n10: BB top set slow-play flop, charge draws on turn ─────────────
  {
    id: 'dyn-n10-bb-top-set-turn-bet',
    title: 'BB Top Set — Slow-Played Flop, Now Charge Draws on Turn',
    description: 'You flop top set with QQ on Q-9-4 and slow-play the flop. The 8h turn adds flush and straight draws. Now bet to charge those draws.',
    difficulty: 'beginner',
    category: 'Set Mining',
    gameType: 'cash',
    format: '6-max',
    heroPosition: 'BB',
    villainPosition: 'BTN',
    heroCards: ['Qh', 'Qd'],
    effectiveStack: 100,
    stakes: '$1/$2',
    summary: '',
    tags: [],
    steps: [
      {
        street: 'preflop',
        board: [],
        context: 'Folds to BTN who raises to $5. SB folds. BB (you) calls.',
        prompt: 'QhQd in BB vs BTN open. Call or 3-bet?',
        options: [
          { id: 'call', label: 'Call $3 (trap)', quality: 'good', evLoss: 0.5, coaching: 'Calling with QQ from BB is a valid trapping line — BTN will c-bet most flops and you can check-raise or call down.' },
          { id: '3bet', label: '3-bet to $16', quality: 'perfect', evLoss: 0, coaching: '3-betting QQ for value is the standard play. However, calling is also acceptable as a trapping device. Either play is fine.' },
        ],
      },
      {
        street: 'flop',
        board: ['Qc', '9c', '4d'],
        context: 'Pot $10bb. Flop: Qc 9c 4d. You flopped top set. BTN c-bets 6bb.',
        prompt: 'You flopped top set on Q-9-4 (one club draw possible). BTN c-bets. Do you slow-play by calling, or raise immediately?',
        options: [
          { id: 'raise', label: 'Check-raise to $20', quality: 'good', evLoss: 0.5, coaching: 'Check-raising immediately is fine — you protect vs the club flush draw and build the pot. However, calling keeps BTN\'s bluffs and semi-bluffs in range.' },
          { id: 'call', label: 'Call $6 (slow-play)', quality: 'perfect', evLoss: 0, coaching: 'Call and slow-play. You have top set — invulnerable to most cards. Keep BTN\'s entire range in (bluffs, 9x, pairs). The turn is where you start building the pot.' },
          { id: 'fold', label: 'Fold', quality: 'mistake', evLoss: 15.0, coaching: 'Folding top set is a catastrophic mistake. You have the best possible hand on this flop.' },
        ],
      },
      {
        street: 'turn',
        board: ['Qc', '9c', '4d', '8h'],
        context: 'You called flop. Pot $22bb. Turn: 8h — adds flush draw AND straight draws (T7, JT). BTN bets 14bb.',
        prompt: 'The 8h turn significantly improves draw potential (flush draw completes if another club comes; straight draws for T7, 76). BTN bets 14bb. You have top set. Now what?',
        options: [
          { id: 'call', label: 'Call $14 (see river)', quality: 'good', evLoss: 1.0, coaching: 'Calling is fine but you miss the opportunity to charge draws right now. With two streets of draws to fade, raising the turn is better EV.' },
          { id: 'raise', label: 'Raise to $38', quality: 'perfect', evLoss: 0, coaching: 'Raise the turn! You slow-played the flop — now is the time to charge draws. The 8h added serious draw equity to BTN\'s range (flush draws, 76, T7). Raise to deny free cards and build the pot with the best hand.' },
          { id: 'fold', label: 'Fold', quality: 'mistake', evLoss: 18.0, coaching: 'Folding top set on the turn is an enormous mistake.' },
        ],
      },
      {
        street: 'river',
        board: ['Qc', '9c', '4d', '8h', '2s'],
        context: 'BTN calls turn raise. Pot $98bb. River: 2s — blank (no flush, no straight). BTN checks.',
        prompt: 'River 2s bricks all draws. BTN called your turn raise and checked. You have top set. How do you extract maximum value?',
        options: [
          { id: 'check', label: 'Check (pot control)', quality: 'mistake', evLoss: 8.0, coaching: 'Checking top set on a blank river after two streets of value is a major mistake. BTN called your turn raise — they have a made hand or missed draw. Either way, you need to bet for value.' },
          { id: 'bet-small', label: 'Bet 28bb (29% pot)', quality: 'good', evLoss: 2.0, coaching: 'Small bet extracts some value but doesn\'t maximize with top set on a blank river.' },
          { id: 'bet-large', label: 'Bet 60bb (61% pot)', quality: 'perfect', evLoss: 0, coaching: 'Large river bet. BTN called your turn raise — they\'re committed with a real hand (9x, 8x, straight draw that missed, or worse Q). Push for maximum value with your monster. The pot is $98bb and your set needs to extract all remaining value.' },
        ],
      },
    ],
  },

  // ── dyn-n11: CO JT flop top pair check-raised, continue on turn ──────────
  {
    id: 'dyn-n11-co-jt-checkraised-continue',
    title: 'CO Top Pair Check-Raised — Continue Aggression on Turn',
    description: 'You open CO with JhTd, flop top pair on J-8-6 rainbow, get check-raised, and the turn comes 2. Decide whether to continue or slow down.',
    difficulty: 'beginner',
    category: 'Facing Aggression',
    gameType: 'cash',
    format: '6-max',
    heroPosition: 'CO',
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
        context: 'Folds to CO. You raise to $5. BTN and SB fold. BB calls.',
        prompt: 'JhTd on CO — standard open. BB defends. Plan for a SRP OOP.',
        options: [
          { id: 'continue', label: 'Note: standard open — proceed to flop', quality: 'perfect', evLoss: 0, coaching: 'JTo is a standard CO open. Connected and has strong playability on high-card boards.' },
        ],
      },
      {
        street: 'flop',
        board: ['Jc', '8s', '6d'],
        context: 'BB checks. Pot $10bb. Flop: Jc 8s 6d — top pair for hero. You c-bet 6bb. BB check-raises to $18.',
        prompt: 'You flopped top pair with JhTd on J-8-6 rainbow. You c-bet, BB check-raises to $18. Do you 3-bet, call, or fold?',
        options: [
          { id: 'fold', label: 'Fold (scared of check-raise)', quality: 'mistake', evLoss: 4.5, coaching: 'Folding top pair to a check-raise on J-8-6 is too tight. BB\'s check-raise range includes many semi-bluffs: 97 (OESD), 75 (OESD), 79, T9, and draws. You have top pair — continue.' },
          { id: '3bet', label: '3-bet to $45', quality: 'good', evLoss: 1.0, coaching: '3-betting is aggressive with top pair, weak kicker (T). You risk a lot vs the top of BB\'s check-raise range (88, 66, 87, J8). Calling is better EV.' },
          { id: 'call', label: 'Call $12', quality: 'perfect', evLoss: 0, coaching: 'Call and see the turn. BB\'s check-raise range has many draws on J-8-6 (OESD, gut-shots). You have top pair and position (effectively — you\'ll act after BB). If BB checks the turn, bet and take control.' },
        ],
      },
      {
        street: 'turn',
        board: ['Jc', '8s', '6d', '2c'],
        context: 'You called the flop check-raise. Pot $36bb. Turn: 2c — total blank. BB checks.',
        prompt: 'The 2c turn is a complete brick. BB check-raised the flop but checked the turn. What does this tell you, and how do you respond?',
        options: [
          { id: 'check', label: 'Check back (cautious)', quality: 'mistake', evLoss: 4.0, coaching: 'Checking back after BB check-raised flop but then checked the turn is a big mistake. BB\'s check on the turn shows they either have a draw (missed so far) or a medium-strength made hand. Your top pair is ahead of much of that range — bet now.' },
          { id: 'bet-small', label: 'Bet 14bb (39% pot)', quality: 'good', evLoss: 0.8, coaching: 'Small turn bet is fine — extracts from BB\'s pair hands and keeps draws in. A slightly larger size adds protection.' },
          { id: 'bet-large', label: 'Bet 26bb (72% pot)', quality: 'perfect', evLoss: 0, coaching: 'Fire the turn. BB checked after a check-raise — their range is polarized toward draws (that missed) or weak made hands. Your top pair is best here. A large turn bet charges draws and extracts value from made hands while asserting dominance over the pot.' },
        ],
      },
    ],
  },

  // ── dyn-n12: BTN 99 flops set, turn Kh — protect vs flush draw ───────────
  {
    id: 'dyn-n12-btn-99-set-protect-turn',
    title: 'BTN Bottom Set — Protect vs Flush Draw on Turn',
    description: 'You open BTN with 9h9d and flop bottom set on 9c-5d-3h. The Kh turn adds a potential flush draw. Bet turn to protect your set.',
    difficulty: 'beginner',
    category: 'Set Mining',
    gameType: 'cash',
    format: '6-max',
    heroPosition: 'BTN',
    villainPosition: 'BB',
    heroCards: ['9h', '9d'],
    effectiveStack: 100,
    stakes: '$1/$2',
    summary: '',
    tags: [],
    steps: [
      {
        street: 'preflop',
        board: [],
        context: 'Folds to BTN. You raise to $5. SB folds. BB calls.',
        prompt: '9h9d on BTN — standard open. BB defends.',
        options: [
          { id: 'continue', label: 'Note: standard open — proceed to flop', quality: 'perfect', evLoss: 0, coaching: '99 is a premium BTN open. Your implied odds when you flop a set are enormous.' },
        ],
      },
      {
        street: 'flop',
        board: ['9c', '5d', '3h'],
        context: 'BB checks. Pot $10bb. Flop: 9c 5d 3h — you flopped top set.',
        prompt: 'You flopped top set on a dry 9-5-3 rainbow board. BB checks. How do you build the pot?',
        options: [
          { id: 'check', label: 'Check (slow-play)', quality: 'good', evLoss: 0.5, coaching: 'Slow-playing bottom set on a very dry board is fine — BB won\'t hit many turn cards. However, c-betting builds the pot and keeps BB\'s draws in.' },
          { id: 'bet-small', label: 'Bet 4bb (40% pot)', quality: 'perfect', evLoss: 0, coaching: 'Small range bet with your set. You want BB to call with all their pairs and overcards. A small sizing keeps the whole range in and sets up larger bets on later streets.' },
          { id: 'bet-large', label: 'Bet 8bb (80% pot)', quality: 'good', evLoss: 0.7, coaching: 'Large bet with the set is fine but may fold out too much of BB\'s range on a dry board.' },
        ],
      },
      {
        street: 'turn',
        board: ['9c', '5d', '3h', 'Kh'],
        context: 'BB calls flop. Pot $18bb. Turn: Kh — now two hearts on board (Kh + 3h... wait: 3h was on flop, Kh is turn = two hearts). BB checks.',
        prompt: 'Kh turn adds a potential heart flush draw (two hearts visible: 3h and Kh). BB called your small flop bet and now checks. How do you charge the flush draw?',
        options: [
          { id: 'check', label: 'Check (give flush draw free card)', quality: 'mistake', evLoss: 3.5, coaching: 'Checking top set on a turn that just opened a flush draw is a mistake. BB may have two hearts in their hand. Give them a free card and they complete the flush on the river for free. Bet now and charge the draw.' },
          { id: 'bet-medium', label: 'Bet 12bb (67% pot)', quality: 'perfect', evLoss: 0, coaching: 'Solid turn bet with your set. You charge the flush draw (9 outs for BB if they have two hearts) and extract value from BB\'s Kx hands that just improved. This is the right sizing to balance protection and value.' },
          { id: 'bet-small', label: 'Bet 6bb (33% pot)', quality: 'good', evLoss: 1.2, coaching: 'Small turn bet is too cheap for flush draws — they get great odds to chase. Size up to deny correct odds.' },
        ],
      },
      {
        street: 'river',
        board: ['9c', '5d', '3h', 'Kh', '7d'],
        context: 'BB calls turn. Pot $42bb. River: 7d — no flush completed. BB checks.',
        prompt: 'River 7d bricks the flush draw. BB called two streets and now checks. You have top set. Finish the hand.',
        options: [
          { id: 'check', label: 'Check (protect against rare straights)', quality: 'mistake', evLoss: 6.0, coaching: 'Never check top set on a blank river after two streets of value. BB called twice — they have a made hand. Extract the final street of value.' },
          { id: 'bet-large', label: 'Bet 28bb (67% pot)', quality: 'perfect', evLoss: 0, coaching: 'Large river value bet with top set. BB called two streets — they likely have Kx, a pocket pair, or missed flush draw. Any Kx hand is going to call here. Extract maximum value.' },
          { id: 'bet-small', label: 'Bet 12bb (29% pot)', quality: 'good', evLoss: 2.5, coaching: 'Small river bet leaves value on the table with top set. Size up — BB called twice and won\'t fold a K.' },
        ],
      },
    ],
  },

  // ── dyn-n13: BB AJ TPTK calldown on A-K-7-2 board ───────────────────────
  {
    id: 'dyn-n13-bb-aj-tptk-calldown',
    title: 'BB TPTK Calldown — AJ on A-K-7-2 vs BTN Double Barrel',
    description: 'You defend BB with AcJd and flop top pair on A-K-7. The turn is a blank 2. BTN fires a second barrel. Is TPTK still good?',
    difficulty: 'beginner',
    category: 'Calldown',
    gameType: 'cash',
    format: '6-max',
    heroPosition: 'BB',
    villainPosition: 'BTN',
    heroCards: ['Ac', 'Jd'],
    effectiveStack: 100,
    stakes: '$1/$2',
    summary: '',
    tags: [],
    steps: [
      {
        street: 'preflop',
        board: [],
        context: 'Folds to BTN who raises to $5. SB folds. BB (you) calls.',
        prompt: 'AcJd in BB vs BTN open. Defend or 3-bet?',
        options: [
          { id: 'call', label: 'Call $3', quality: 'perfect', evLoss: 0, coaching: 'AJo is a clear BB defend vs BTN. You have top-pair potential with good kicker value.' },
          { id: '3bet', label: '3-bet to $16', quality: 'good', evLoss: 0.4, coaching: '3-betting AJo from BB vs BTN is a marginal play — fine in an exploitative spot but calling is the default.' },
        ],
      },
      {
        street: 'flop',
        board: ['Ah', 'Ks', '7c'],
        context: 'Pot $10bb. Flop: Ah Ks 7c. You check. BTN c-bets 6bb.',
        prompt: 'You flopped top pair on A-K-7. BTN c-bets 6bb. You have TPTK (J kicker). Call or raise?',
        options: [
          { id: 'fold', label: 'Fold', quality: 'mistake', evLoss: 5.0, coaching: 'Folding top pair on the flop vs a c-bet is a catastrophic mistake.' },
          { id: 'raise', label: 'Check-raise to $20', quality: 'good', evLoss: 0.8, coaching: 'Check-raising TPTK on A-K-7 is aggressive but risks running into AK, KK, AA, 77. Calling keeps a wider range of BTN\'s c-bets in.' },
          { id: 'call', label: 'Call $6', quality: 'perfect', evLoss: 0, coaching: 'Call with TPTK. BTN c-bets wide on A-K-7 (AQs, ATs, Kx, bluffs). Calling and re-evaluating the turn is the best line — you don\'t want to bloat the pot and get check-raised off your hand.' },
        ],
      },
      {
        street: 'turn',
        board: ['Ah', 'Ks', '7c', '2d'],
        context: 'You called flop. Pot $22bb. Turn: 2d — complete blank. BTN fires 14bb.',
        prompt: 'Blank 2d turn. BTN fires a second barrel of 14bb. Your TPTK (AJ on A-K-7-2). Call or fold?',
        options: [
          { id: 'fold', label: 'Fold (AK/KK/AA too scary)', quality: 'mistake', evLoss: 5.5, coaching: 'Folding TPTK to a double barrel on A-K-7-2 is too tight. BTN barrels this board with all of AQs, ATs, A9s, KQs, KJs, and pure bluffs. Your AJ beats the majority of that range. Call.' },
          { id: 'raise', label: 'Check-raise to $40', quality: 'good', evLoss: 1.5, coaching: 'Check-raising the turn with TPTK is aggressive. You risk over-bluffing or building a big pot vs a dominated range.' },
          { id: 'call', label: 'Call $14', quality: 'perfect', evLoss: 0, coaching: 'Call the second barrel. TPTK is a strong bluff-catcher. BTN\'s double-barrel range includes all their Kx semi-bluffs and air. On a blank turn (2d), no draws completed and nothing changed — BTN is still barreling their preflop range.' },
        ],
      },
    ],
  },

  // ── dyn-n14: CO 56 two pair on straight-completing turn ──────────────────
  {
    id: 'dyn-n14-co-56-two-pair-straight-turn',
    title: 'CO Two Pair — Straight Completes on Turn, How to React',
    description: 'You have 5d6d on a 4h-5c-6h flop (two pair), and the 7h turn completes a straight on the board. You need to figure out whether to value-bet or play defensively.',
    difficulty: 'beginner',
    category: 'Board Texture',
    gameType: 'cash',
    format: '6-max',
    heroPosition: 'CO',
    villainPosition: 'BB',
    heroCards: ['5d', '6d'],
    effectiveStack: 100,
    stakes: '$1/$2',
    summary: '',
    tags: [],
    steps: [
      {
        street: 'preflop',
        board: [],
        context: 'Folds to CO. You raise to $5. BTN and SB fold. BB calls.',
        prompt: '5d6d on CO — a suited connector. BB defends. Plan entering a SRP OOP.',
        options: [
          { id: 'continue', label: 'Note: standard open — proceed to flop', quality: 'perfect', evLoss: 0, coaching: '56s is a standard CO open. You have implied odds and strong connectivity. Hope to flop a draw or two pair.' },
        ],
      },
      {
        street: 'flop',
        board: ['4h', '5c', '6h'],
        context: 'BB checks. Pot $10bb. Flop: 4h 5c 6h. You flopped two pair (5 and 6) + straight draw + flush draw.',
        prompt: 'You have two pair on a very wet 4-5-6 board with heart flush draw. BB checks. Do you bet, and if so, how much?',
        options: [
          { id: 'check', label: 'Check (slow-play)', quality: 'mistake', evLoss: 3.5, coaching: 'Slow-playing two pair on an extremely wet board (flush draw + straight draw everywhere) is a mistake. Many turns will kill your hand. Bet now while you\'re ahead.' },
          { id: 'bet-large', label: 'Bet 8bb (80% pot)', quality: 'perfect', evLoss: 0, coaching: 'Bet large. This board is incredibly wet — BB has 3-2, 7-8, flush draws, straight draws. You need to charge all of those. Your two pair is strong but vulnerable. Large flop bet is correct.' },
          { id: 'bet-small', label: 'Bet 4bb (40% pot)', quality: 'good', evLoss: 1.2, coaching: 'Small bet is too weak on this wet board. Every draw gets great odds. Size up to charge draws properly.' },
        ],
      },
      {
        street: 'turn',
        board: ['4h', '5c', '6h', '7h'],
        context: 'BB calls flop. Pot $26bb. Turn: 7h — completes 3-7 straight AND brings third heart for flush draw. BB checks.',
        prompt: 'The 7h turn is scary — 3-7 is now a straight on board, hearts have three cards (flush possible). BB checked. You have two pair (5-6). Beat the straight? No — 5-6 with 4-5-6-7 means any 3 or 8 in opponent\'s hand beats you. Do you check or bet?',
        options: [
          { id: 'check', label: 'Check (board too scary)', quality: 'good', evLoss: 1.0, coaching: 'Checking with two pair on this turn is reasonable — 3-8, 8-9, and heart flush draws all beat or have strong equity against you. Taking a free card is prudent.' },
          { id: 'bet-small', label: 'Bet 10bb (38% pot) for information', quality: 'perfect', evLoss: 0, coaching: 'Small bet serves multiple purposes: extracts value from BB\'s hands that didn\'t improve, denies free cards to backdoor draws, and gains information. If BB raises, you can fold knowing they have the straight or flush. A small bet here is the balanced play.' },
          { id: 'bet-large', label: 'Bet 22bb (85% pot)', quality: 'mistake', evLoss: 2.5, coaching: 'Large bet on this board is a mistake — you\'re behind many of BB\'s calling hands. 3-8 straight, flush draws, and sets all beat or are ahead of two pair. Don\'t bloat the pot.' },
        ],
      },
    ],
  },

  // ── dyn-n15: BTN KK top set, turn Q — extract more ───────────────────────
  {
    id: 'dyn-n15-btn-kk-top-set-turn-q',
    title: 'BTN Top Set KK — Turn Queen Improves Villain Range, Extract More',
    description: 'You open BTN with KdKh and flop top set on K-8-3. The turn comes Q, which improves QQ and KQ hands in villain\'s range. Exploit the improved calling range.',
    difficulty: 'beginner',
    category: 'Set Mining',
    gameType: 'cash',
    format: '6-max',
    heroPosition: 'BTN',
    villainPosition: 'BB',
    heroCards: ['Kd', 'Kh'],
    effectiveStack: 100,
    stakes: '$1/$2',
    summary: '',
    tags: [],
    steps: [
      {
        street: 'preflop',
        board: [],
        context: 'Folds to BTN. You raise to $5. SB folds. BB calls.',
        prompt: 'KdKh on BTN — premium hand. BB defends. What is your plan?',
        options: [
          { id: 'continue', label: 'Note: standard open — proceed to flop', quality: 'perfect', evLoss: 0, coaching: 'KK is the second-best starting hand. Standard BTN open, hope to flop a set or top pair and extract three streets.' },
        ],
      },
      {
        street: 'flop',
        board: ['Kc', '8d', '3s'],
        context: 'BB checks. Pot $10bb. Flop: Kc 8d 3s — dry rainbow. You flopped top set.',
        prompt: 'Top set on a dry K-8-3 rainbow board. BB checks. Small bet to keep their range wide?',
        options: [
          { id: 'check', label: 'Check (slow-play)', quality: 'good', evLoss: 0.5, coaching: 'Slow-play on a very dry board is acceptable since BB has few turn-improving draws. But c-betting keeps the pot growing.' },
          { id: 'bet-small', label: 'Bet 4bb (40% pot)', quality: 'perfect', evLoss: 0, coaching: 'Small range bet. On K-8-3 dry, your entire range bets small. This keeps BB\'s whole range in — pocket pairs, 8x, Kx all call a small bet and will pay you across multiple streets.' },
          { id: 'bet-large', label: 'Bet 8bb (80% pot)', quality: 'good', evLoss: 0.7, coaching: 'Large bet folds out too much of BB\'s range on this dry board. Small sizing is correct.' },
        ],
      },
      {
        street: 'turn',
        board: ['Kc', '8d', '3s', 'Qh'],
        context: 'BB calls flop. Pot $18bb. Turn: Qh — BB\'s QQ and KQ hands just improved significantly. BB checks.',
        prompt: 'The Qh turn improves BB\'s QQ (two pair) and KQ (two pair) hands. These hands will now call larger bets. This is a perfect turn to size up. BB checks. How do you bet?',
        options: [
          { id: 'check', label: 'Check (worried about QQ)', quality: 'mistake', evLoss: 3.0, coaching: 'Checking top set because you\'re scared of QQ is a mistake. Even if BB has QQ, you still have top set — you\'re still a favorite on most runouts. And QQ just became a big calling hand, so you want to extract from it!' },
          { id: 'bet-medium', label: 'Bet 12bb (67% pot)', quality: 'perfect', evLoss: 0, coaching: 'Size up on the turn. The Q improved BB\'s QQ, KQ, and Q-8 range — these hands will now call a larger bet comfortably. Your top set is still the best hand. Bet bigger to extract maximum value from the improved calling range.' },
          { id: 'bet-small', label: 'Bet 6bb (33% pot)', quality: 'good', evLoss: 1.5, coaching: 'Small turn bet leaves value on the table. The Q improved BB\'s range — now is the time to size up, not down.' },
        ],
      },
      {
        street: 'river',
        board: ['Kc', '8d', '3s', 'Qh', '2c'],
        context: 'BB calls turn. Pot $42bb. River: 2c — blank. BB checks.',
        prompt: 'River 2c is a blank. BB called two streets. You have top set. Complete the value extraction.',
        options: [
          { id: 'check', label: 'Check (scared of rare bluffs)', quality: 'mistake', evLoss: 7.0, coaching: 'Checking top set after two streets of value on a blank river is a large EV error. BB has QQ, KQ, or 8x — they will call a river bet.' },
          { id: 'bet-large', label: 'Bet 28bb (67% pot)', quality: 'perfect', evLoss: 0, coaching: 'Large river bet. BB called flop and turn on a board where the queen improved their range. They have QQ, KQ, or better — hands that will call a big river bet comfortably. Complete the triple-barrel and extract maximum EV with top set.' },
          { id: 'bet-small', label: 'Bet 12bb (29% pot)', quality: 'good', evLoss: 2.5, coaching: 'Small bet extracts something but leaves significant value on the table. Size up — BB is committed.' },
        ],
      },
    ],
  },

  // ── dyn-n16: BTN delayed c-bet — check AhTh flop, fire Ah turn ───────────
  {
    id: 'dyn-n16-btn-delayed-cbet-ah-turn',
    title: 'BTN Delayed C-Bet — Check Flop, Fire Ace Turn',
    description: 'You open BTN with AhTh, check back a 9-5-2 flop, and spike top pair on the Ah turn. Execute a delayed c-bet to take down the pot or extract value.',
    difficulty: 'intermediate',
    category: 'Delayed C-Bet',
    gameType: 'cash',
    format: '6-max',
    heroPosition: 'BTN',
    villainPosition: 'BB',
    heroCards: ['Ah', 'Th'],
    effectiveStack: 100,
    stakes: '$1/$2',
    summary: '',
    tags: [],
    steps: [
      {
        street: 'preflop',
        board: [],
        context: 'Folds to BTN. You raise to $5. SB folds. BB calls.',
        prompt: 'AhTh on BTN — suited ace. BB defends. Plan for the hand.',
        options: [
          { id: 'continue', label: 'Note: standard open — proceed to flop', quality: 'perfect', evLoss: 0, coaching: 'ATs is a premium BTN open with flush potential and top-pair equity. Standard raise.' },
        ],
      },
      {
        street: 'flop',
        board: ['9c', '5d', '2h'],
        context: 'BB checks. Pot $10bb. Flop: 9c 5d 2h. You are IP.',
        prompt: 'You missed entirely on 9-5-2 — a low connected board that hits BB\'s range (55, 99, 22, 87, 76, 64). Do you c-bet or check back?',
        options: [
          { id: 'bet', label: 'C-bet 6bb (60% pot)', quality: 'good', evLoss: 0.8, coaching: 'C-betting ATo on this low board is a higher-variance play. You have no equity if called and are bluffing into a board that hits BB\'s defending range heavily.' },
          { id: 'check', label: 'Check back (set up delayed c-bet)', quality: 'perfect', evLoss: 0, coaching: 'Check back the flop. 9-5-2 hits BB\'s range hard — 77, 88, 55, 22, and suited connectors all connect. Your ATo has nothing. Take a free card and fire the turn if an ace comes, if BB checks again, or both.' },
        ],
      },
      {
        street: 'turn',
        board: ['9c', '5d', '2h', 'Ah'],
        context: 'BB checks turn. Pot $10bb. Turn: Ah — you hit top pair! BB checked (showed continued weakness after your check-back).',
        prompt: 'You hit top pair on the Ah turn. BB checked, showing weakness on both streets. The delayed c-bet spot has arrived. How do you size?',
        options: [
          { id: 'check', label: 'Check (trapping)', quality: 'mistake', evLoss: 3.5, coaching: 'Checking top pair on the turn after checking the flop is a mistake. You gave BB a free card on the flop — don\'t give another. BB is weak (checked twice) and TPTK needs to extract value now.' },
          { id: 'bet-small', label: 'Bet 5bb (50% pot)', quality: 'good', evLoss: 0.7, coaching: 'Small delayed c-bet is fine. Extracts from BB\'s 9x, 5x, and pairs.' },
          { id: 'bet-large', label: 'Bet 8bb (80% pot)', quality: 'perfect', evLoss: 0, coaching: 'Large delayed c-bet is optimal here. You checked back the flop (BB thinks you missed), then a scary ace lands and you bet big. BB will believe you have an ace — but also, your story is TRUE. You have TPTK. Extract from BB\'s pairs and 9x hands that will stubbornly call.' },
        ],
      },
      {
        street: 'river',
        board: ['9c', '5d', '2h', 'Ah', '6s'],
        context: 'BB calls turn. Pot $26bb. River: 6s — blank. BB checks.',
        prompt: 'River 6s is a blank. BB called your delayed c-bet. BB checks. TPTK (Ah Th on A-9-5-2-6). Complete the value line?',
        options: [
          { id: 'check', label: 'Check (pot control)', quality: 'mistake', evLoss: 4.5, coaching: 'Checking river with TPTK after a delayed c-bet that got called is a value error. BB called the turn — they have 9x or a stubborn pair. They will call a river bet.' },
          { id: 'bet-medium', label: 'Bet 14bb (54% pot)', quality: 'perfect', evLoss: 0, coaching: 'Medium river value bet. BB called your delayed c-bet — they have a made hand (9x, 5x, or pocket pair). Extract one final bet from these hands on the blank river.' },
          { id: 'bet-large', label: 'Bet 22bb (85% pot)', quality: 'good', evLoss: 1.5, coaching: 'Large river bet might fold out some of BB\'s thinner calls. Medium sizing extracts more across BB\'s entire calling range.' },
        ],
      },
    ],
  },

  // ── dyn-n17: BB TPWK vs BTN double barrel on K-J-7 ───────────────────────
  {
    id: 'dyn-n17-bb-tpwk-vs-double-barrel',
    title: 'BB Top Pair Weak Kicker — Call or Fold vs BTN Double Barrel?',
    description: 'You defend BB with Kd9d. Flop K-J-7 and BTN c-bets. The blank 2c turn brings a second barrel. TPWK as a bluff-catcher.',
    difficulty: 'intermediate',
    category: 'Calldown',
    gameType: 'cash',
    format: '6-max',
    heroPosition: 'BB',
    villainPosition: 'BTN',
    heroCards: ['Kd', '9d'],
    effectiveStack: 100,
    stakes: '$1/$2',
    summary: '',
    tags: [],
    steps: [
      {
        street: 'preflop',
        board: [],
        context: 'Folds to BTN who raises to $5. SB folds. BB (you) calls.',
        prompt: 'Kd9d in BB vs BTN open. Defend?',
        options: [
          { id: 'call', label: 'Call $3', quality: 'perfect', evLoss: 0, coaching: 'K9s is a fine BB defend — top pair potential, flush draw potential, and reasonable equity vs BTN\'s wide range.' },
        ],
      },
      {
        street: 'flop',
        board: ['Kh', 'Jc', '7s'],
        context: 'Pot $10bb. Flop: Kh Jc 7s. You check. BTN c-bets 6bb.',
        prompt: 'You have top pair (K) with a 9 kicker — TPWK. Board has KJ7 — a connected board where BTN has many value hands (KQ, KJ, JJ, 77). BTN c-bets 6bb. Call?',
        options: [
          { id: 'fold', label: 'Fold (weak kicker)', quality: 'mistake', evLoss: 3.5, coaching: 'Folding top pair on the flop is too tight. BTN c-bets wide on K-J-7 with many bluffs and semi-bluffs. Call and use TPWK as a bluff-catcher.' },
          { id: 'raise', label: 'Check-raise to $20', quality: 'good', evLoss: 1.5, coaching: 'Check-raising TPWK is too aggressive. You\'re behind KQ, KJ, JJ, 77 — a significant portion of BTN\'s range. Call and keep the pot smaller.' },
          { id: 'call', label: 'Call $6', quality: 'perfect', evLoss: 0, coaching: 'Call with TPWK. You\'re a bluff-catcher against BTN\'s wide c-bet range. Many of BTN\'s c-bet hands are QT, AT, A9, and pure bluffs — hands you beat. Call and re-evaluate the turn.' },
        ],
      },
      {
        street: 'turn',
        board: ['Kh', 'Jc', '7s', '2c'],
        context: 'You called flop. Pot $22bb. Turn: 2c — blank. BTN fires 14bb.',
        prompt: 'Blank 2c turn. BTN fires a second barrel of 14bb into $22bb. Your Kd9d TPWK. Fold, call, or raise?',
        options: [
          { id: 'fold', label: 'Fold (second barrel is too much)', quality: 'mistake', evLoss: 4.5, coaching: 'Folding TPWK to a second barrel on a blank turn is a significant mistake. BTN\'s double-barrel range on K-J-7-2 includes QT (gutshot), AT (overcards), A-high bluffs, and Q8/98 combo draws. You beat all of those. Call.' },
          { id: 'raise', label: 'Check-raise to $42', quality: 'good', evLoss: 2.0, coaching: 'Check-raising the turn with TPWK is too aggressive. You might run into KQ, KJ, or 77 and be in a tough spot. Call is cleaner.' },
          { id: 'call', label: 'Call $14', quality: 'perfect', evLoss: 0, coaching: 'Call the second barrel. On a blank K-J-7-2 board, BTN is barreling their preflop range (which includes many missed hands). Your TPWK beats all bluffs. The 2c doesn\'t change anything — call and see the river.' },
        ],
      },
    ],
  },

  // ── dyn-n18: CO QJ on Q63 OOP — flush draw turn, size up ─────────────────
  {
    id: 'dyn-n18-co-qj-flush-draw-turn-size-up',
    title: 'CO Top Pair OOP — Flush Draw Turn Demands Larger Sizing',
    description: 'You open CO with QhJh and c-bet Qd-6c-3h. The 9h turn adds a heart flush draw. Should you keep the same sizing or size up to charge the draw?',
    difficulty: 'intermediate',
    category: 'Bet Sizing',
    gameType: 'cash',
    format: '6-max',
    heroPosition: 'CO',
    villainPosition: 'BTN',
    heroCards: ['Qh', 'Jh'],
    effectiveStack: 100,
    stakes: '$1/$2',
    summary: '',
    tags: [],
    steps: [
      {
        street: 'preflop',
        board: [],
        context: 'Folds to CO. You raise to $5. BTN calls. Blinds fold. Pot $11bb.',
        prompt: 'QhJh on CO — strong suited broadway. BTN calls IP. OOP for the hand.',
        options: [
          { id: 'continue', label: 'Note: standard open — proceed to flop', quality: 'perfect', evLoss: 0, coaching: 'QJs is a premium CO open. You have top pair equity and a flush draw nut potential.' },
        ],
      },
      {
        street: 'flop',
        board: ['Qd', '6c', '3h'],
        context: 'Pot $11bb. Flop: Qd 6c 3h. You act first OOP. BTN will respond.',
        prompt: 'You flopped top pair with QhJh on Q-6-3 (one heart). BTN is IP. Small c-bet or larger to protect?',
        options: [
          { id: 'check', label: 'Check (balance range)', quality: 'good', evLoss: 0.5, coaching: 'Checking top pair OOP is fine for balance. But you have value and no draw vulnerability yet — betting extracts value.' },
          { id: 'bet-small', label: 'Bet 5bb (45% pot)', quality: 'perfect', evLoss: 0, coaching: 'Small c-bet OOP with top pair. The board is fairly dry — one possible heart draw but no immediate flush. Keep BTN\'s range wide with a small bet and reassess the turn.' },
          { id: 'bet-large', label: 'Bet 9bb (82% pot)', quality: 'good', evLoss: 0.7, coaching: 'Large bet is fine but folds too much of BTN\'s range on a relatively dry board. Small sizing is better EV here.' },
        ],
      },
      {
        street: 'turn',
        board: ['Qd', '6c', '3h', '9h'],
        context: 'BTN calls flop. Pot $21bb. Turn: 9h — now two hearts on board (3h and 9h). Flush draw is now live. You act first OOP.',
        prompt: 'The 9h turn adds a heart flush draw (two hearts visible). BTN is also in range for QhXh or other heart hands. You still have top pair but now face a draw. How do you size your turn bet?',
        options: [
          { id: 'check', label: 'Check (give free card to draw)', quality: 'mistake', evLoss: 3.0, coaching: 'Checking top pair OOP when a flush draw just appeared is a mistake. BTN could have a flush draw and you\'re giving them a free card. Bet to charge the draw and protect your hand.' },
          { id: 'bet-same', label: 'Bet 5bb (24% pot — same as flop)', quality: 'mistake', evLoss: 2.5, coaching: 'Keeping the same small sizing when a flush draw arrives is wrong. The draw now has 9 outs. At 24% pot, you\'re giving the draw correct odds to call. Size up to deny equity.' },
          { id: 'bet-larger', label: 'Bet 14bb (67% pot)', quality: 'perfect', evLoss: 0, coaching: 'Size up on the turn. The heart flush draw adds significant risk. By betting ~67% pot, you deny correct odds to the flush draw (they need ~26% equity — getting just over 25% here). Extract value from BTN\'s Qx hands while charging the draw.' },
        ],
      },
    ],
  },

  // ── dyn-n19: BTN 89 two pair on 7-8-9 flush board, overbet? ─────────────
  {
    id: 'dyn-n19-btn-89-two-pair-wet-board',
    title: 'BTN Two Pair on 7-8-9 Flush Board — Overbet or Standard?',
    description: 'You open BTN with 8h9c and flop two pair on 7c-8d-9d — a very wet board with flush draw and straight draws everywhere. The 5d turn adds a straight. How do you size?',
    difficulty: 'intermediate',
    category: 'Wet Board Play',
    gameType: 'cash',
    format: '6-max',
    heroPosition: 'BTN',
    villainPosition: 'BB',
    heroCards: ['8h', '9c'],
    effectiveStack: 100,
    stakes: '$1/$2',
    summary: '',
    tags: [],
    steps: [
      {
        street: 'preflop',
        board: [],
        context: 'Folds to BTN. You raise to $5. SB folds. BB calls.',
        prompt: '8h9c on BTN — connected hand. BB defends. Plan for a wet flop.',
        options: [
          { id: 'continue', label: 'Note: standard open — proceed to flop', quality: 'perfect', evLoss: 0, coaching: '89o is a standard BTN open — connected hand with strong implied odds on dynamic boards.' },
        ],
      },
      {
        street: 'flop',
        board: ['7c', '8d', '9d'],
        context: 'BB checks. Pot $10bb. Flop: 7c 8d 9d — you flopped top two pair on an extremely wet board.',
        prompt: 'Two pair on 7-8-9 with diamond flush draw possible (2 diamonds), plus straight draws (JT makes straight, 56 makes straight). BB checks. How do you protect your equity?',
        options: [
          { id: 'check', label: 'Check (pot control)', quality: 'mistake', evLoss: 4.0, coaching: 'Checking two pair on an ultra-wet board is a serious mistake. Flush draws (9 outs), straight draws (JT, T6, 56 = 8 outs), and combo draws all have huge equity against you. Bet now to charge every draw.' },
          { id: 'bet-standard', label: 'Bet 7bb (70% pot)', quality: 'good', evLoss: 0.8, coaching: 'Standard bet charges draws but a larger sizing extracts more from made hands (pocket pairs, 8x, 7x) and denies even more equity to draws.' },
          { id: 'bet-large', label: 'Bet 9bb (90% pot)', quality: 'perfect', evLoss: 0, coaching: 'Bet close to pot. You have two pair on the most dangerous possible board. Flush draws, straight draws, combo draws — every draw has massive equity. Charge them all the maximum and extract value from made hands simultaneously.' },
        ],
      },
      {
        street: 'turn',
        board: ['7c', '8d', '9d', '5d'],
        context: 'BB calls flop. Pot $28bb. Turn: 5d — three diamonds now! Plus 5-6-7-8-9 means 6 completes a straight. BB checks.',
        prompt: 'Turn 5d puts three diamonds on board (flush draw even closer) and any 6 now makes a 5-6-7-8-9 straight. BB called the wet flop and checked. Your two pair is still the best hand but the board is extremely dangerous. What do you do?',
        options: [
          { id: 'check', label: 'Check (too many dangers)', quality: 'mistake', evLoss: 5.0, coaching: 'Checking two pair on this turn is a mistake. You give BB free equity with draws. You have two pair — you need to charge every card in BB\'s range that has equity against you.' },
          { id: 'bet-standard', label: 'Bet 18bb (64% pot)', quality: 'good', evLoss: 1.0, coaching: 'Standard bet charges draws and extracts value. Valid play.' },
          { id: 'overbet', label: 'Overbet 32bb (114% pot)', quality: 'perfect', evLoss: 0, coaching: 'Overbet the turn. Three diamonds visible, straight possible — your two pair may be best now but is under massive pressure. By overbetting, you put maximum pressure on all draws (flush draws now need 19% equity to call — they have ~18%). Maximize fold equity and extract from the top of BB\'s range (made hands that call regardless).' },
        ],
      },
    ],
  },

  // ── dyn-n20: BB AQ on A-9-3, turn K — BTN fires big ─────────────────────
  {
    id: 'dyn-n20-bb-aq-turn-k-facing-barrel',
    title: 'BB AQ — Turn King Brings BTN\'s Big Barrel. Call or Fold?',
    description: 'You defend BB with AhQh. Flop A-9-3 and call BTN\'s c-bet. The King turn improves BTN\'s KK, AK, and KJ range significantly. BTN fires a large turn bet.',
    difficulty: 'intermediate',
    category: 'Calldown',
    gameType: 'cash',
    format: '6-max',
    heroPosition: 'BB',
    villainPosition: 'BTN',
    heroCards: ['Ah', 'Qh'],
    effectiveStack: 100,
    stakes: '$1/$2',
    summary: '',
    tags: [],
    steps: [
      {
        street: 'preflop',
        board: [],
        context: 'Folds to BTN who raises to $5. SB folds. BB (you) calls.',
        prompt: 'AhQh in BB — strong hand. Call or 3-bet vs BTN?',
        options: [
          { id: 'call', label: 'Call $3', quality: 'good', evLoss: 0.4, coaching: 'Calling AQs is fine — you trap BTN\'s worse aces and Broadway combos.' },
          { id: '3bet', label: '3-bet to $16', quality: 'perfect', evLoss: 0, coaching: '3-betting AQs from BB vs BTN is optimal — it builds the pot when ahead, denies BTN equity with worse hands, and represents a strong range.' },
        ],
      },
      {
        street: 'flop',
        board: ['As', '9d', '3c'],
        context: 'Pot $10bb. Flop: As 9d 3c. You check. BTN c-bets 6bb.',
        prompt: 'You have top pair, top kicker (TPTK) with AhQh on A-9-3. BTN c-bets. Call?',
        options: [
          { id: 'call', label: 'Call $6', quality: 'perfect', evLoss: 0, coaching: 'Call TPTK on the flop. BTN is c-betting their entire range on this dry board. You beat all bluffs and are only behind AA, 99, 33, and A9. Check-calling is the optimal line.' },
          { id: 'raise', label: 'Check-raise to $20', quality: 'good', evLoss: 0.7, coaching: 'Check-raising is aggressive — fine if you suspect BTN c-bets very wide. But calling controls the pot and keeps BTN\'s bluff range in.' },
        ],
      },
      {
        street: 'turn',
        board: ['As', '9d', '3c', 'Kh'],
        context: 'You called flop. Pot $22bb. Turn: Kh — BTN\'s AK, KK, and KJ hands just improved. BTN fires 16bb (73% pot).',
        prompt: 'King turn helps BTN\'s AK (top two pair) and KK (set). BTN fires 73% pot — a big bet. Your AhQh is TPTK but now potentially second-best. Fold or call?',
        options: [
          { id: 'fold', label: 'Fold (KK and AK improved)', quality: 'mistake', evLoss: 4.5, coaching: 'Folding TPTK on A-9-3-K to a turn barrel is too tight. BTN\'s turn-barreling range includes all of their A-high bluffs, KJ, KT, QJ (gutshots), and missed hands. You beat the majority. TPTK is still a bluff-catcher here.' },
          { id: 'raise', label: 'Check-raise to $45', quality: 'mistake', evLoss: 3.0, coaching: 'Check-raising the turn vs a large sizing into a K-improved board is a mistake. You\'re putting in too much vs the top of BTN\'s range (AK, KK).' },
          { id: 'call', label: 'Call $16', quality: 'perfect', evLoss: 0, coaching: 'Call the turn barrel. Yes, BTN can have AK and KK, but their range also includes KJ, KT, QJ, and A-high bluffs. TPTK is a solid bluff-catcher. Call and reassess the river — if BTN fires a third barrel, you can fold or call based on the river card and sizing.' },
        ],
      },
    ],
  },


  // ── dyn-n21: CO 67 OESD flop, flush draw added on turn ───────────────────
  {
    id: 'dyn-n21-co-67-oesd-flush-turn',
    title: 'CO Combo Draw — OESD Flop + Flush Draw Turn',
    description: 'You open CO with 6h7h on a 5h-8c-4d flop — a perfect OESD (needs 3 or 9 for straight). The 2h turn adds a heart flush draw. Monster equity hand.',
    difficulty: 'intermediate',
    category: 'Draw Play',
    gameType: 'cash',
    format: '6-max',
    heroPosition: 'CO',
    villainPosition: 'BB',
    heroCards: ['6h', '7h'],
    effectiveStack: 100,
    stakes: '$1/$2',
    summary: '',
    tags: [],
    steps: [
      {
        street: 'preflop',
        board: [],
        context: 'Folds to CO. You raise to $5. BTN and SB fold. BB calls.',
        prompt: '6h7h on CO — suited connector. BB defends. Plan for implied-odds play.',
        options: [
          { id: 'continue', label: 'Note: standard open — proceed to flop', quality: 'perfect', evLoss: 0, coaching: '67s is a standard CO open. Suited connectors thrive in single-raised pots with position.' },
        ],
      },
      {
        street: 'flop',
        board: ['5h', '8c', '4d'],
        context: 'BB checks. Pot $10bb. Flop: 5h 8c 4d — you have OESD (6-7-8 needs 9 for high end, 5-6-7 needs 3 for low end = 8 outs).',
        prompt: 'You have an open-ended straight draw (needs 3 or 9). The board is 4-5-8 with one heart. BB checks. Do you semi-bluff or take the free card?',
        options: [
          { id: 'check', label: 'Check (take free card)', quality: 'good', evLoss: 0.5, coaching: 'Taking a free card with 8 outs is fine — you preserve your equity and see the turn for free.' },
          { id: 'bet', label: 'Bet 6bb (60% pot)', quality: 'perfect', evLoss: 0, coaching: 'Semi-bluff with the OESD. You have 8 outs (~32% equity) plus fold equity from BB. A 60% pot semi-bluff is profitable and builds a pot you can win two ways: by BB folding or by making the straight.' },
          { id: 'jam', label: 'Jam $95bb', quality: 'mistake', evLoss: 3.5, coaching: 'Jamming with only a draw (no pair) is far too aggressive. You have ~32% equity but need fold equity to justify over-investing. A normal semi-bluff size is correct.' },
        ],
      },
      {
        street: 'turn',
        board: ['5h', '8c', '4d', '2h'],
        context: 'BB calls flop. Pot $22bb. Turn: 2h — adds heart flush draw! Now you have 8 outs (straight) + 9 outs (flush) = 17 combined outs (some overlap). BB checks.',
        prompt: 'The 2h gives you a flush draw ON TOP of your OESD. You now have approximately 15 clean outs — a massive combo draw. BB checks. How do you bet?',
        options: [
          { id: 'check', label: 'Check (wait for river)', quality: 'mistake', evLoss: 4.5, coaching: 'Checking with a 15-out combo draw is a large mistake. You have ~60% equity on the turn — you\'re a FAVORITE to win this hand. Bet and also deny BB any free cards.' },
          { id: 'bet-standard', label: 'Bet 14bb (64% pot)', quality: 'good', evLoss: 0.8, coaching: 'Standard semi-bluff is solid. You have massive equity and fold equity.' },
          { id: 'overbet', label: 'Bet 22bb (100% pot)', quality: 'perfect', evLoss: 0, coaching: 'Overbet the turn with your combo draw. With ~60% equity, you want to maximize the pot when you\'re the favorite. BB checking after calling the flop means they have a made hand that\'s often behind your equity. An overbet creates the most EV with this monster draw.' },
        ],
      },
    ],
  },

  // ── dyn-n22: BTN QJ second pair OOP, straight turn — bet/check/fold? ─────
  {
    id: 'dyn-n22-btn-qj-second-pair-straight-turn',
    title: 'BTN Second Pair OOP — Straight Turn Complicates Value/Defense',
    description: 'You open BTN with QcJc on Kh-Qd-5c. You have second pair OOP. The turn T gives you a gutshot but also completes some straights. Should you bet, check, or fold to action?',
    difficulty: 'intermediate',
    category: 'Board Texture',
    gameType: 'cash',
    format: '6-max',
    heroPosition: 'BTN',
    villainPosition: 'BB',
    heroCards: ['Qc', 'Jc'],
    effectiveStack: 100,
    stakes: '$1/$2',
    summary: '',
    tags: [],
    steps: [
      {
        street: 'preflop',
        board: [],
        context: 'Folds to BTN. You raise to $5. SB folds. BB calls.',
        prompt: 'QcJc on BTN — suited broadway. BB defends. Plan for the hand.',
        options: [
          { id: 'continue', label: 'Note: standard open — proceed to flop', quality: 'perfect', evLoss: 0, coaching: 'QJs is a premium BTN open with flush potential and strong connectivity.' },
        ],
      },
      {
        street: 'flop',
        board: ['Kh', 'Qd', '5c'],
        context: 'BB checks. Pot $10bb. Flop: Kh Qd 5c. You act first (we\'re treating this as BTN OOP for scenario purposes — BB acts first, BTN checks back or bets). BB checks. You have second pair (Qs).',
        prompt: 'You have second pair (QcJc on K-Q-5). BB checked. Do you c-bet or check back for pot control?',
        options: [
          { id: 'check', label: 'Check back (pot control)', quality: 'good', evLoss: 0.5, coaching: 'Checking back second pair on K-Q-5 controls pot size — you\'re vulnerable to Kx hands. Fine play.' },
          { id: 'bet-small', label: 'Bet 5bb (50% pot)', quality: 'perfect', evLoss: 0, coaching: 'Small c-bet with second pair. You have showdown value and can extract from BB\'s pair range. If raised, you can fold cleanly. Small sizing is the right balance of value and protection.' },
          { id: 'bet-large', label: 'Bet 9bb (90% pot)', quality: 'mistake', evLoss: 2.0, coaching: 'Betting large with second pair on a King-high board is a mistake. You\'re bloating the pot in a bad spot. Keep it small or check.' },
        ],
      },
      {
        street: 'turn',
        board: ['Kh', 'Qd', '5c', 'Td'],
        context: 'BB calls flop. Pot $20bb. Turn: Td — gives you a gutshot (QJ on KQT needs A for Broadway). Also completes AJ straight. BB checks.',
        prompt: 'Td turn: you now have second pair + gutshot to Broadway. BB called your flop bet and checked. Continue betting or check for pot control?',
        options: [
          { id: 'check', label: 'Check (pot control — 2nd pair)', quality: 'perfect', evLoss: 0, coaching: 'Check the turn for pot control. You have second pair + gutshot but you\'re on a K-Q-T board where BB can have many strong hands (KT, QT, JJ, AJ). Taking a free card and seeing the river is correct.' },
          { id: 'bet-small', label: 'Bet 8bb (40% pot)', quality: 'good', evLoss: 0.8, coaching: 'Small turn bet is fine — extracts thin value from BB\'s pairs. However, the board texture is dangerous enough that checking is slightly better EV.' },
          { id: 'bet-large', label: 'Bet 16bb (80% pot)', quality: 'mistake', evLoss: 2.5, coaching: 'Large turn bet with second pair on a connected K-Q-T board is a mistake. BB has many strong hands here. Save chips and check.' },
        ],
      },
    ],
  },

  // ── dyn-n23: BB TT top set, turn J — straight completes ──────────────────
  {
    id: 'dyn-n23-bb-tt-set-straight-turn',
    title: 'BB Top Set — Turn Jack Completes Straights. How to Respond?',
    description: 'You defend BB with TsTd and flop top set on T-8-6. The turn J completes Q-J-T-9-8 and J-T-9-8-7 straights. How does top set navigate?',
    difficulty: 'intermediate',
    category: 'Set Mining',
    gameType: 'cash',
    format: '6-max',
    heroPosition: 'BB',
    villainPosition: 'BTN',
    heroCards: ['Ts', 'Td'],
    effectiveStack: 100,
    stakes: '$1/$2',
    summary: '',
    tags: [],
    steps: [
      {
        street: 'preflop',
        board: [],
        context: 'Folds to BTN who raises to $5. SB folds. BB (you) calls.',
        prompt: 'TsTd in BB — premium pocket pair. Call or 3-bet?',
        options: [
          { id: 'call', label: 'Call $3', quality: 'good', evLoss: 0.4, coaching: 'Calling TT is a trapping play. Valid against an aggressive BTN.' },
          { id: '3bet', label: '3-bet to $16', quality: 'perfect', evLoss: 0, coaching: '3-betting TT from BB for value is standard — it builds the pot when ahead and denies equity to overcards.' },
        ],
      },
      {
        street: 'flop',
        board: ['Tc', '8h', '6d'],
        context: 'Pot $10bb. Flop: Tc 8h 6d — two-tone board. You check. BTN c-bets 6bb.',
        prompt: 'You flopped top set on T-8-6. The board has straight draw potential (97, 79, 75 etc.). BTN c-bets. Check-raise or call?',
        options: [
          { id: 'call', label: 'Call $6 (slow-play)', quality: 'good', evLoss: 0.7, coaching: 'Calling keeps BTN\'s entire range in. However, check-raising builds the pot and charges draws now.' },
          { id: 'check-raise', label: 'Check-raise to $20', quality: 'perfect', evLoss: 0, coaching: 'Check-raise the flop. T-8-6 is a wet board — 97, 75, 79, and flush draws have big equity. Charge them immediately. Your top set is the best hand and needs to protect on this board.' },
          { id: 'fold', label: 'Fold', quality: 'mistake', evLoss: 18.0, coaching: 'Folding top set is never correct.' },
        ],
      },
      {
        street: 'turn',
        board: ['Tc', '8h', '6d', 'Jd'],
        context: 'BTN calls flop check-raise. Pot $40bb. Turn: Jd — completes Q-J-T-9-8 straight (any Q9 in BTN\'s range) and J-T-9-8-7 straight (any 97 in BTN\'s range). BTN checks.',
        prompt: 'The Jd turn completes straights for Q9 and 97 hands. BTN called your check-raise but now checks. You still have top set. What do you do?',
        options: [
          { id: 'check', label: 'Check (scared of straights)', quality: 'mistake', evLoss: 5.0, coaching: 'Checking top set because some straights completed is a mistake. Top set still beats most of BTN\'s range (77, 88, 99, 8x, 6x, all bluffs). Bet and charge remaining draws (flush draws, combo draws).' },
          { id: 'bet-standard', label: 'Bet 24bb (60% pot)', quality: 'perfect', evLoss: 0, coaching: 'Fire the turn with top set. Yes, Q9 and 97 complete straights — but those are a small fraction of BTN\'s range. You beat everything else and need to charge remaining draws. Bet for value and protection.' },
          { id: 'bet-small', label: 'Bet 12bb (30% pot)', quality: 'good', evLoss: 1.5, coaching: 'Small turn bet is too cheap. With a straight on board, you\'re giving draws incorrect odds but also losing value from BTN\'s worse made hands. Size up.' },
        ],
      },
    ],
  },

  // ── dyn-n24: CO AK on A-Q-7, blank turn — villain probes ────────────────
  {
    id: 'dyn-n24-co-ak-villain-probes-turn',
    title: 'CO AK Two Pair — Villain Probes Blank Turn. Call or Raise?',
    description: 'You open CO with AcKd, flop top two pair on A-Q-7 rainbow. The blank 6 turn brings a villain probe bet OOP. Do you call or raise?',
    difficulty: 'intermediate',
    category: 'Facing Aggression',
    gameType: 'cash',
    format: '6-max',
    heroPosition: 'CO',
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
        context: 'Folds to CO. You raise to $5. BTN and SB fold. BB calls.',
        prompt: 'AcKd on CO — premium hand. BB defends. Plan for a value-heavy hand.',
        options: [
          { id: 'continue', label: 'Note: standard open — proceed to flop', quality: 'perfect', evLoss: 0, coaching: 'AKo is one of the best starting hands. Standard open, plan to extract maximum value if you flop top pair or better.' },
        ],
      },
      {
        street: 'flop',
        board: ['Ad', 'Qh', '7c'],
        context: 'BB checks. Pot $10bb. Flop: Ad Qh 7c. You c-bet 6bb. BB calls.',
        prompt: 'You flopped top two pair (AK on A-Q-7 rainbow). You c-bet, BB calls. Solid spot — what hands does BB call with here?',
        options: [
          { id: 'continue', label: 'Note: BB called — proceed to turn', quality: 'perfect', evLoss: 0, coaching: 'BB calls with Ax (weaker kicker), Qx, 77, and pair+draw combos. Your top two pair is the best hand. Turn strategy: bet for value again or react to BB\'s action.' },
        ],
      },
      {
        street: 'turn',
        board: ['Ad', 'Qh', '7c', '6s'],
        context: 'Pot $22bb. Turn: 6s — blank. BB leads out for 12bb (probe bet).',
        prompt: 'BB leads the turn for 12bb after calling your flop c-bet. You have top two pair (AcKd on A-Q-7-6). What does BB\'s probe represent, and how do you respond?',
        options: [
          { id: 'fold', label: 'Fold (BB has strong hand)', quality: 'mistake', evLoss: 8.0, coaching: 'Folding top two pair to a probe bet is a catastrophic mistake. BB probes with many hands here: 7x (two pair), Q6, 76, and even bluffs. You have the second-best possible two pair.' },
          { id: 'call', label: 'Call $12', quality: 'good', evLoss: 1.0, coaching: 'Calling the probe is fine — keeps BB\'s bluffs in and controls the pot. You can raise the river if checked to.' },
          { id: 'raise', label: 'Raise to $32', quality: 'perfect', evLoss: 0, coaching: 'Raise the probe bet. Top two pair is a strong value hand. BB is probing with their entire range (some value, some bluffs). By raising, you extract from weaker two-pair hands (Q7, A6), charge draws, and take control of the pot.' },
        ],
      },
    ],
  },

  // ── dyn-n25: BTN JT top pair + flush draw turn — fire or check ───────────
  {
    id: 'dyn-n25-btn-jt-top-pair-flush-draw-turn',
    title: 'BTN Top Pair + Flush Draw — When to Fire vs Check the Turn',
    description: 'You open BTN with JcTc on Jd-7h-3c. You have top pair + BDFD. The 9c turn gives you a flush draw. Optimal betting decision with strong equity.',
    difficulty: 'intermediate',
    category: 'Draw Play',
    gameType: 'cash',
    format: '6-max',
    heroPosition: 'BTN',
    villainPosition: 'BB',
    heroCards: ['Jc', 'Tc'],
    effectiveStack: 100,
    stakes: '$1/$2',
    summary: '',
    tags: [],
    steps: [
      {
        street: 'preflop',
        board: [],
        context: 'Folds to BTN. You raise to $5. SB folds. BB calls.',
        prompt: 'JcTc on BTN — suited broadway. BB defends. Plan for a connected flop.',
        options: [
          { id: 'continue', label: 'Note: standard open — proceed to flop', quality: 'perfect', evLoss: 0, coaching: 'JTs is a premium BTN open with flush potential and straight potential.' },
        ],
      },
      {
        street: 'flop',
        board: ['Jd', '7h', '3c'],
        context: 'BB checks. Pot $10bb. Flop: Jd 7h 3c. You have top pair + backdoor clubs (BDFD). You c-bet 5bb. BB calls.',
        prompt: 'You c-bet top pair on a dry J-7-3 board. BB calls. What hands does BB call with here, and what is your plan for the turn?',
        options: [
          { id: 'continue', label: 'Note: BB called — proceed to turn', quality: 'perfect', evLoss: 0, coaching: 'BB calls with 7x, 3x, underpairs (55, 66, 88, 99), and Jx with a worse kicker. Your top pair is likely best.' },
        ],
      },
      {
        street: 'turn',
        board: ['Jd', '7h', '3c', '9c'],
        context: 'Pot $20bb. Turn: 9c — gives you a flush draw (Jc Tc on board with 3c and 9c = 4 clubs visible for hero\'s hand → wait: hero has Jc Tc, board has 3c 9c → hero has 2 club cards + board has 2 clubs = flush draw for hero). BB checks.',
        prompt: 'The 9c gives you a flush draw on top of top pair (Jc Tc with 3c-9c on board). You now have 9 outs to the flush + your top pair. BB checked. When do you fire this turn?',
        options: [
          { id: 'check', label: 'Check (protect range, get free card)', quality: 'good', evLoss: 0.7, coaching: 'Checking back the turn with top pair + flush draw is a valid pot-control play. You take a free river card where you can improve.' },
          { id: 'bet-small', label: 'Bet 8bb (40% pot)', quality: 'good', evLoss: 0.5, coaching: 'Small turn bet extracts value from BB\'s pair hands and charges the 9 outs if they have flush draws.' },
          { id: 'bet-large', label: 'Bet 14bb (70% pot)', quality: 'perfect', evLoss: 0, coaching: 'Fire a full value bet on the turn. You have top pair + 9 flush outs = ~18% additional equity on top of your made hand. Bet large to extract value from BB\'s 7x, 9x, and weaker Jx. Your hand is strong enough to size up here.' },
        ],
      },
    ],
  },

  // ── dyn-n26: BB 34 straight completes on turn — value or slow-play ────────
  {
    id: 'dyn-n26-bb-34-straight-completes-turn',
    title: 'BB Flopped OESD — Straight Completes on Turn. Value or Slow-Play?',
    description: 'You defend BB with 3h4h on 5h-6c-Ah — OESD (needs 2 or 7). The 2d turn completes your straight. Do you lead for value or slow-play?',
    difficulty: 'intermediate',
    category: 'Draw Play',
    gameType: 'cash',
    format: '6-max',
    heroPosition: 'BB',
    villainPosition: 'BTN',
    heroCards: ['3h', '4h'],
    effectiveStack: 100,
    stakes: '$1/$2',
    summary: '',
    tags: [],
    steps: [
      {
        street: 'preflop',
        board: [],
        context: 'Folds to BTN who raises to $5. SB folds. BB (you) calls.',
        prompt: '3h4h in BB — small suited connector. Defend vs BTN?',
        options: [
          { id: 'call', label: 'Call $3', quality: 'perfect', evLoss: 0, coaching: '34s is a BB defend — you have the best position in the hand (BB) and suited connectors have great implied odds.' },
          { id: 'fold', label: 'Fold', quality: 'mistake', evLoss: 1.5, coaching: 'Folding 34s from BB at a favorable price is a mistake. You have enough implied odds with a suited connector.' },
        ],
      },
      {
        street: 'flop',
        board: ['5h', '6c', 'Ah'],
        context: 'Pot $10bb. Flop: 5h 6c Ah. You check. BTN c-bets 6bb. You have OESD (3-4-5-6 needs 2 or 7).',
        prompt: 'You flopped an OESD on 5-6-A (needs 2 or 7 for straight). You also have 2 hearts (backdoor flush draw). BTN c-bets 6bb. Call or fold?',
        options: [
          { id: 'fold', label: 'Fold (only a draw)', quality: 'mistake', evLoss: 2.5, coaching: 'Folding 8 outs (OESD) + BDFD to a single c-bet is a mistake. You have significant equity. Call.' },
          { id: 'call', label: 'Call $6', quality: 'perfect', evLoss: 0, coaching: 'Call with your OESD. 8 outs (~32%) gives you strong equity. If you hit the turn, you have a straight and can extract enormous value. If you miss, you can re-evaluate.' },
          { id: 'raise', label: 'Check-raise to $20', quality: 'good', evLoss: 0.8, coaching: 'Semi-bluff raising is aggressive but valid. Risk is getting 3-bet off your draw. Calling is safer.' },
        ],
      },
      {
        street: 'turn',
        board: ['5h', '6c', 'Ah', '2d'],
        context: 'You called flop. Pot $22bb. Turn: 2d — you completed your straight (A-2-3-4-5? No: 3-4-5-6 with 2 = 2-3-4-5-6 straight). BTN checks.',
        prompt: 'The 2d completes your straight (2-3-4-5-6 using your 3h4h). BTN checked. Do you lead for value immediately or slow-play to the river?',
        options: [
          { id: 'check', label: 'Check (slow-play the straight)', quality: 'good', evLoss: 0.8, coaching: 'Slow-playing a straight on an A-high board is risky — BTN might check behind and you miss a street of value. Leading is better EV.' },
          { id: 'bet-large', label: 'Lead 16bb (73% pot)', quality: 'perfect', evLoss: 0, coaching: 'Lead for value. You completed the nut straight. BTN has Ax hands (which love the ace on board), and they\'ll call your lead. Don\'t slow-play — lead big and set up a river jam.' },
          { id: 'bet-small', label: 'Lead 8bb (36% pot)', quality: 'good', evLoss: 1.2, coaching: 'Small lead extracts some value but leaves money on the table. With the nut straight, you want to build the pot. Lead larger.' },
        ],
      },
    ],
  },

  // ── dyn-n27: CO ATs — top two pair after turn K, villain probes ──────────
  {
    id: 'dyn-n27-co-ats-top-two-pair-turn',
    title: 'CO — Turned Top Two Pair (AT on A-8-4-K). Villain Probes. Raise?',
    description: 'You open CO with AsTs. Flop A-8-4 (TPTK). Turn K gives you top two pair (A and K? No: hero has As Ts with board A-8-4-K: hero pairs A (top pair) with T kicker. The K doesn\'t pair hero\'s cards. Actually hero has As-Ts on board A-8-4-K: top pair with T kicker only. Villain probes. Call or raise?',
    difficulty: 'intermediate',
    category: 'Facing Aggression',
    gameType: 'cash',
    format: '6-max',
    heroPosition: 'CO',
    villainPosition: 'BB',
    heroCards: ['As', 'Ts'],
    effectiveStack: 100,
    stakes: '$1/$2',
    summary: '',
    tags: [],
    steps: [
      {
        street: 'preflop',
        board: [],
        context: 'Folds to CO. You raise to $5. BTN and SB fold. BB calls.',
        prompt: 'AsTs on CO — suited ace. BB defends. Plan for top-pair value.',
        options: [
          { id: 'continue', label: 'Note: standard open — proceed to flop', quality: 'perfect', evLoss: 0, coaching: 'ATs is a premium CO open with flush potential and top-pair equity.' },
        ],
      },
      {
        street: 'flop',
        board: ['Ah', '8c', '4d'],
        context: 'BB checks. Pot $10bb. Flop: Ah 8c 4d. You c-bet 6bb. BB calls.',
        prompt: 'You flopped TPTK (AsTs on A-8-4). BB calls your c-bet. What range of hands does BB have, and what is your turn plan?',
        options: [
          { id: 'continue', label: 'Note: BB called — proceed to turn', quality: 'perfect', evLoss: 0, coaching: 'BB calls with Ax (weaker kicker), 8x, 4x, and pair hands. Your TPTK is best against most of that range.' },
        ],
      },
      {
        street: 'turn',
        board: ['Ah', '8c', '4d', 'Kh'],
        context: 'Pot $22bb. Turn: Kh. BB leads out for 14bb (probe bet). You have AsTs — TPTK (A with T kicker on A-8-4-K board).',
        prompt: 'BB probes the turn with 14bb after calling your flop c-bet. The Kh is a significant card — BB can have KK (slow-played), AK (now two pair), and K8 (two pair). How do you react with TPTK?',
        options: [
          { id: 'fold', label: 'Fold (King improved villain)', quality: 'mistake', evLoss: 5.0, coaching: 'Folding TPTK to a probe bet is too tight. Yes, BB can have AK or KK — but their probe range also includes Kx draws, 8x, and bluffs. You have TPTK and need to continue.' },
          { id: 'call', label: 'Call $14', quality: 'perfect', evLoss: 0, coaching: 'Call the probe bet. TPTK is a bluff-catcher against BB\'s range. The Kh improved some of BB\'s hands (AK, KK, K8) but also gave them bluffing candidates (KhXh flush draws). Call and see the river before making a bigger commitment.' },
          { id: 'raise', label: 'Raise to $40', quality: 'good', evLoss: 1.5, coaching: 'Raising the probe is aggressive — you put in a lot vs the top of BB\'s range (AK, KK). Calling is better EV in this spot.' },
        ],
      },
    ],
  },

  // ── dyn-n28: BTN K8 TPWK on K-9-4, turn J — check or bet ────────────────
  {
    id: 'dyn-n28-btn-k8-tpwk-connected-turn',
    title: 'BTN TPWK on Connected Turn — Protect or Check?',
    description: 'You open BTN with Kh8h on K-9-4. You have TPWK. The turn J adds QT draws. Should you bet to protect or check for pot control?',
    difficulty: 'intermediate',
    category: 'Bet Sizing',
    gameType: 'cash',
    format: '6-max',
    heroPosition: 'BTN',
    villainPosition: 'BB',
    heroCards: ['Kh', '8h'],
    effectiveStack: 100,
    stakes: '$1/$2',
    summary: '',
    tags: [],
    steps: [
      {
        street: 'preflop',
        board: [],
        context: 'Folds to BTN. You raise to $5. SB folds. BB calls.',
        prompt: 'Kh8h on BTN — suited king. BB defends.',
        options: [
          { id: 'continue', label: 'Note: standard open — proceed to flop', quality: 'perfect', evLoss: 0, coaching: 'K8s is a standard BTN open with top-pair potential and a flush draw.' },
        ],
      },
      {
        street: 'flop',
        board: ['Kd', '9c', '4s'],
        context: 'BB checks. Pot $10bb. Flop: Kd 9c 4s. You c-bet 5bb. BB calls.',
        prompt: 'You flopped top pair (K) with a weak kicker (8). BB calls your c-bet. What hands is BB calling with, and how do you feel about your kicker?',
        options: [
          { id: 'continue', label: 'Note: BB called — proceed to turn', quality: 'perfect', evLoss: 0, coaching: 'BB calls with 9x, 4x, underpairs, and draws. Your Kh8h has TPWK — good hand but kicker weakness is a concern vs BB\'s Kx combos.' },
        ],
      },
      {
        street: 'turn',
        board: ['Kd', '9c', '4s', 'Jh'],
        context: 'Pot $20bb. Turn: Jh — now QT and T8 gutshots are live. BB checks.',
        prompt: 'The Jh turn opens straight draws (QT makes QJK9... no: board is K-9-4-J, QT has QJ? no). Jh adds JT and QT gutshot draws. BB checked after calling flop. With TPWK, do you bet to protect or check?',
        options: [
          { id: 'check', label: 'Check (pot control with TPWK)', quality: 'good', evLoss: 0.8, coaching: 'Checking back TPWK on a somewhat connected turn is a reasonable pot control play. You limit the pot size given your kicker is weak.' },
          { id: 'bet-small', label: 'Bet 8bb (40% pot)', quality: 'perfect', evLoss: 0, coaching: 'Bet small for protection and value. The Jh turn added draws (QT gutshot for straight). You need to charge those draws while extracting from BB\'s 9x and weaker pairs. Small bet is correct — doesn\'t over-bloat the pot but still charges.' },
          { id: 'bet-large', label: 'Bet 16bb (80% pot)', quality: 'mistake', evLoss: 2.0, coaching: 'Large bet with TPWK on a connected turn is a mistake. If BB raises, you\'re in a bad spot. Keep it small or check.' },
        ],
      },
    ],
  },

  // ── dyn-n29: BB QQ checked flop, turn 8 — start building pot ─────────────
  {
    id: 'dyn-n29-bb-qq-checked-flop-turn-bet',
    title: 'BB Overpair — Checked Flop, Now Build Pot on Turn',
    description: 'You defend BB with QhQd. Flop 7h-4c-2d — you have an overpair and check back. The 8d turn arrives. Time to start building the pot.',
    difficulty: 'intermediate',
    category: 'Overpair',
    gameType: 'cash',
    format: '6-max',
    heroPosition: 'BB',
    villainPosition: 'BTN',
    heroCards: ['Qh', 'Qd'],
    effectiveStack: 100,
    stakes: '$1/$2',
    summary: '',
    tags: [],
    steps: [
      {
        street: 'preflop',
        board: [],
        context: 'Folds to BTN who raises to $5. SB folds. BB (you) calls.',
        prompt: 'QhQd in BB vs BTN open. Call or 3-bet?',
        options: [
          { id: 'call', label: 'Call $3 (trap)', quality: 'good', evLoss: 0.4, coaching: 'Trapping with QQ can work but 3-betting for value is the standard play.' },
          { id: '3bet', label: '3-bet to $16', quality: 'perfect', evLoss: 0, coaching: '3-betting QQ builds the pot and denies equity to BTN\'s hands with two overcards. Standard play.' },
        ],
      },
      {
        street: 'flop',
        board: ['7h', '4c', '2d'],
        context: 'Pot $10bb. Flop: 7h 4c 2d — dry low board. BTN checks. You checked back (slow-play).',
        prompt: 'BTN checked the dry 7-4-2 flop. You checked back with QQ (overpair slow-play). Turn is coming.',
        options: [
          { id: 'continue', label: 'Note: checked back — proceed to turn', quality: 'perfect', evLoss: 0, coaching: 'Slow-playing QQ on a dry 7-4-2 board is acceptable. BTN rarely has anything strong here. The turn is where you start building the pot.' },
        ],
      },
      {
        street: 'turn',
        board: ['7h', '4c', '2d', '8d'],
        context: 'Pot $10bb. Turn: 8d — adds a diamond draw and a gutshot (A5 for wheel, 69 for 6-7-8-9). BTN checks again.',
        prompt: 'BTN checked both streets. Turn 8d adds some draws. You have an overpair (QhQd). Both players checked the flop — you have initiative to lead the turn. Do you bet?',
        options: [
          { id: 'check', label: 'Check again (allow bluffs)', quality: 'mistake', evLoss: 3.5, coaching: 'Checking your overpair twice in a row is a mistake. You\'re giving BTN free cards to outdraw your QQ. On an increasingly connected board, bet now to extract value and deny equity.' },
          { id: 'bet-medium', label: 'Bet 7bb (70% pot)', quality: 'perfect', evLoss: 0, coaching: 'Lead the turn. QQ on 7-4-2-8 is still an overpair to the board. BTN has checked twice — they have medium-strength hands that will call a bet. Fire for value and protection.' },
          { id: 'bet-small', label: 'Bet 3bb (30% pot)', quality: 'good', evLoss: 1.0, coaching: 'Small bet is fine but leaves value on the table with an overpair. Size up to extract more from BTN\'s pair hands.' },
        ],
      },
    ],
  },

  // ── dyn-n30: CO 98 top pair + monster combo draw turn — overbet ───────────
  {
    id: 'dyn-n30-co-98-top-pair-combo-draw-overbet',
    title: 'CO Combo Draw Monster — Top Pair + Flush + OESD on Turn',
    description: 'You open CO with 9c8c on 9h-6d-2c. The 7c turn gives you top pair + flush draw + open-ended straight draw. Massive equity — consider overbetting.',
    difficulty: 'intermediate',
    category: 'Draw Play',
    gameType: 'cash',
    format: '6-max',
    heroPosition: 'CO',
    villainPosition: 'BB',
    heroCards: ['9c', '8c'],
    effectiveStack: 100,
    stakes: '$1/$2',
    summary: '',
    tags: [],
    steps: [
      {
        street: 'preflop',
        board: [],
        context: 'Folds to CO. You raise to $5. BTN and SB fold. BB calls.',
        prompt: '9c8c on CO — suited connector. BB defends.',
        options: [
          { id: 'continue', label: 'Note: standard open — proceed to flop', quality: 'perfect', evLoss: 0, coaching: '98s is a standard CO open with strong connectivity and flush potential.' },
        ],
      },
      {
        street: 'flop',
        board: ['9h', '6d', '2c'],
        context: 'BB checks. Pot $10bb. Flop: 9h 6d 2c. You have top pair (9) + BDFD (clubs). You c-bet 6bb. BB calls.',
        prompt: 'You flopped top pair with a backdoor club flush draw. Standard c-bet, BB calls. Proceed to turn.',
        options: [
          { id: 'continue', label: 'Note: BB called flop — proceed to turn', quality: 'perfect', evLoss: 0, coaching: 'BB calls with 6x, 2x, 9x, and pocket pairs. Your top pair is likely best.' },
        ],
      },
      {
        street: 'turn',
        board: ['9h', '6d', '2c', '7c'],
        context: 'Pot $22bb. Turn: 7c — you now have top pair (9) + club flush draw (9c8c on board with 2c7c = 4 clubs for your hand) + OESD (6-7-8-9 needs 5 or T = 8 outs). Approximately 9+8=17 outs (some overlap). BB checks.',
        prompt: 'The 7c gives you top pair + 9 flush outs + 8 straight outs ≈ 15 clean outs. You have ~60% equity. BB checked. This is a monster combo draw situation. Should you overbet?',
        options: [
          { id: 'check', label: 'Check (protect)', quality: 'mistake', evLoss: 6.0, coaching: 'Checking when you have ~60% equity is a major mistake. You\'re the favorite — maximize EV by betting. You win two ways: by making the flush/straight, or by making BB fold now.' },
          { id: 'bet-standard', label: 'Bet 14bb (64% pot)', quality: 'good', evLoss: 1.5, coaching: 'Standard bet is solid. However, with this much equity, you want to build a larger pot. The overbet maximizes your EV edge.' },
          { id: 'overbet', label: 'Overbet 28bb (127% pot)', quality: 'perfect', evLoss: 0, coaching: 'Overbet the turn with your monster combo draw. You\'re a ~60% equity favorite — put maximum money in the pot. An overbet forces BB to put in a lot vs your dominant equity hand. Whether they call or fold, your EV is maximized with the largest possible sizing.' },
        ],
      },
    ],
  },

  // ── dyn-n31: BTN AQ two pair river — what sizing ─────────────────────────
  {
    id: 'dyn-n31-btn-aq-river-value-sizing',
    title: 'BTN River Value — AQ Two Pair on A-K-8-3-J. What Size?',
    description: 'You open BTN with AdQd. The board runs out A-K-8-3-J. You have top pair (A) with Q kicker — not two pair since Q is in your hand, not on the board. Thin value river decision.',
    difficulty: 'intermediate',
    category: 'River Betting',
    gameType: 'cash',
    format: '6-max',
    heroPosition: 'BTN',
    villainPosition: 'BB',
    heroCards: ['Ad', 'Qd'],
    effectiveStack: 100,
    stakes: '$1/$2',
    summary: '',
    tags: [],
    steps: [
      {
        street: 'preflop',
        board: [],
        context: 'Folds to BTN. You raise to $5. SB folds. BB calls.',
        prompt: 'AdQd on BTN — suited ace. BB defends.',
        options: [
          { id: 'continue', label: 'Note: standard open — proceed to flop', quality: 'perfect', evLoss: 0, coaching: 'AQs is a premium BTN open with top-pair equity and nut flush potential.' },
        ],
      },
      {
        street: 'flop',
        board: ['As', 'Kh', '8c'],
        context: 'BB checks. Pot $10bb. Flop: As Kh 8c. You c-bet 6bb. BB calls.',
        prompt: 'Top pair, good kicker (Q) on A-K-8. BB calls. Proceed to turn.',
        options: [
          { id: 'continue', label: 'Note: BB called flop — proceed to turn', quality: 'perfect', evLoss: 0, coaching: 'BB has Kx, 8x, and weaker Ax. Your TPTK is strong here.' },
        ],
      },
      {
        street: 'turn',
        board: ['As', 'Kh', '8c', '3d'],
        context: 'Pot $22bb. Turn: 3d — blank. You bet 14bb. BB calls.',
        prompt: 'Blank turn, you bet for value, BB calls. River coming.',
        options: [
          { id: 'continue', label: 'Note: BB called turn — proceed to river', quality: 'perfect', evLoss: 0, coaching: 'BB called two streets — they have a made hand (Kx, 8x, or stubborn Ax with worse kicker).' },
        ],
      },
      {
        street: 'river',
        board: ['As', 'Kh', '8c', '3d', 'Jd'],
        context: 'Pot $50bb. River: Jd. BB checks. You have AdQd — top pair (A) with Q kicker on A-K-8-3-J.',
        prompt: 'River Jd. BB called two streets and checks. You have top pair with Q kicker. The J is a scare card (gives KQ a straight? K-Q-J... not quite). Your hand is TPTK (Ace-Queen). Do you value bet the river?',
        options: [
          { id: 'check', label: 'Check (only TPTK, J scary)', quality: 'mistake', evLoss: 5.5, coaching: 'Checking TPTK on the river after two streets of value is a mistake. BB called twice — they have something. The Jd is a minor scare card but doesn\'t change much. Bet for value.' },
          { id: 'bet-small', label: 'Bet 18bb (36% pot)', quality: 'perfect', evLoss: 0, coaching: 'Thin value bet with TPTK. BB called two streets — they have Kx, 8x, or a weaker Ax. A small river bet extracts one more street of value from all those hands. This is the optimal sizing for thin value after two barrels.' },
          { id: 'bet-large', label: 'Bet 40bb (80% pot)', quality: 'good', evLoss: 2.0, coaching: 'Large river bet might be too much for the thin value range here. BB\'s calling range on the river is mostly medium-strength — a large bet folds many of those hands.' },
        ],
      },
    ],
  },

  // ── dyn-n32: BB bluff-catch river with QJ on missed board ────────────────
  {
    id: 'dyn-n32-bb-bluffcatch-river-qj',
    title: 'BB River Bluff-Catch — QJ on K-9-4-2-7. Fold to BTN\'s River Bet?',
    description: 'You defend BB with QhJh. The board runs K-9-4-2-7 — you missed everything. BTN fires 60% pot on the river. Is this a fold or a hero-call?',
    difficulty: 'intermediate',
    category: 'River Defense',
    gameType: 'cash',
    format: '6-max',
    heroPosition: 'BB',
    villainPosition: 'BTN',
    heroCards: ['Qh', 'Jh'],
    effectiveStack: 100,
    stakes: '$1/$2',
    summary: '',
    tags: [],
    steps: [
      {
        street: 'preflop',
        board: [],
        context: 'Folds to BTN who raises to $5. SB folds. BB (you) calls.',
        prompt: 'QhJh in BB — strong suited hand. Defend vs BTN.',
        options: [
          { id: 'call', label: 'Call $3', quality: 'perfect', evLoss: 0, coaching: 'QJs is a clear BB defend with straight, flush, and top-pair potential.' },
        ],
      },
      {
        street: 'flop',
        board: ['Kc', '9s', '4h'],
        context: 'Pot $10bb. Flop: Kc 9s 4h. You check. BTN c-bets 6bb. You call (backdoor straight draw, two overcards).',
        prompt: 'You have two overcards and a backdoor draw on K-9-4. BTN c-bets. Fold or call?',
        options: [
          { id: 'call', label: 'Call $6', quality: 'perfect', evLoss: 0, coaching: 'Calling with QJ on K-9-4 is fine — you have two overcards plus backdoor outs. You\'re floating to see if the turn gives you something to work with.' },
          { id: 'fold', label: 'Fold', quality: 'good', evLoss: 0.5, coaching: 'Folding QJ on K-9-4 is also fine — you have few immediate outs. This is a borderline call.' },
        ],
      },
      {
        street: 'turn',
        board: ['Kc', '9s', '4h', '2d'],
        context: 'Pot $22bb. Turn: 2d — complete brick. BTN bets 14bb. You call (pot odds + hope for river).',
        prompt: 'Blank turn, BTN barrels. You still have QhJh with nothing made. Call or fold?',
        options: [
          { id: 'call', label: 'Call $14 (bluff-catcher)', quality: 'good', evLoss: 0.5, coaching: 'Calling the turn with pure overcards is a thin call. You need BTN to bluff the river frequently.' },
          { id: 'fold', label: 'Fold', quality: 'perfect', evLoss: 0, coaching: 'Folding on the turn with no pair on K-9-4-2 is the correct decision. You have no equity to speak of and are likely drawing dead to kicker pairs.' },
        ],
      },
      {
        street: 'river',
        board: ['Kc', '9s', '4h', '2d', '7h'],
        context: 'You called the turn. Pot $50bb. River: 7h — you missed everything. BTN bets 30bb (60% pot). You have QhJh — just Queen high.',
        prompt: 'River 7h — you have nothing (Queen-high). BTN bets 60% pot. The pot odds require you to win ~37.5% of the time. Do you hero-call or fold?',
        options: [
          { id: 'call', label: 'Hero-call (catch BTN bluffing)', quality: 'good', evLoss: 1.0, coaching: 'Calling is a marginal hero-call. BTN could be bluffing missed draws or Ax that gave up. But with no pair on K-9-4-2-7, you only beat bluffs. This is a high-variance play.' },
          { id: 'fold', label: 'Fold (Queen-high loses to everything)', quality: 'perfect', evLoss: 0, coaching: 'Fold. Queen-high with a completely missed hand on K-9-4-2-7 can only beat bluffs, and BTN\'s betting range on the river has many value hands (Kx, 9x, and pairs). The math might be close but folding is correct with no equity.' },
        ],
      },
    ],
  },

  // ── dyn-n33: CO river bluff with A-blocker ───────────────────────────────
  {
    id: 'dyn-n33-co-river-bluff-blocker',
    title: 'CO River Bluff — Holding the A-Blocker on a Missed Board',
    description: 'You open CO with Ac4d. The board runs A-Q-8-2-3 — you have top pair but missed all draws. Your Ac blocks the nut flush and nut straight. River bluff decision.',
    difficulty: 'intermediate',
    category: 'River Bluffing',
    gameType: 'cash',
    format: '6-max',
    heroPosition: 'CO',
    villainPosition: 'BB',
    heroCards: ['Ac', '4d'],
    effectiveStack: 100,
    stakes: '$1/$2',
    summary: '',
    tags: [],
    steps: [
      {
        street: 'preflop',
        board: [],
        context: 'Folds to CO. You raise to $5. BTN and SB fold. BB calls.',
        prompt: 'Ac4d on CO — ace-rag. Marginal open but standard in CO.',
        options: [
          { id: 'continue', label: 'Note: standard open — proceed to flop', quality: 'perfect', evLoss: 0, coaching: 'A4o is a standard CO open — you have an ace and position. Flop top pair or set up bluffs.' },
        ],
      },
      {
        street: 'flop',
        board: ['Ah', 'Qc', '8d'],
        context: 'BB checks. Pot $10bb. Flop: Ah Qc 8d. You c-bet 6bb. BB calls.',
        prompt: 'You flopped top pair (Ah Qc 8d with Ac4d). BB calls. Proceed to turn.',
        options: [
          { id: 'continue', label: 'Note: BB called flop — proceed to turn', quality: 'perfect', evLoss: 0, coaching: 'BB called with Qx, 8x, and Ax hands. Your top pair (A with 4 kicker) is TPWK.' },
        ],
      },
      {
        street: 'turn',
        board: ['Ah', 'Qc', '8d', '2s'],
        context: 'Pot $22bb. Turn: 2s — blank. You bet 12bb. BB calls.',
        prompt: 'Blank turn, second barrel. BB calls again. River coming.',
        options: [
          { id: 'continue', label: 'Note: BB called turn — proceed to river', quality: 'perfect', evLoss: 0, coaching: 'BB called two streets — they have a real hand (Qx, strong Ax, or 8x). Your TPWK might be behind.' },
        ],
      },
      {
        street: 'river',
        board: ['Ah', 'Qc', '8d', '2s', '3c'],
        context: 'Pot $46bb. River: 3c. BB checks. You have Ac4d — top pair (A) with 4 kicker. Your Ac blocks the club flush (if a club flush draw was possible — the board has Ah, Qc, 8d, 2s, 3c = only 2 clubs). Value bet or bluff?',
        prompt: 'River 3c is a near-blank. BB checked after calling two streets. You have TPWK (Ace with 4 kicker). Your Ac is a blocker. Do you thin value bet, bluff big, or check?',
        options: [
          { id: 'check', label: 'Check (showdown with TPWK)', quality: 'good', evLoss: 0.5, coaching: 'Checking TPWK on a blank river is fine — you take a showdown and might win vs BB\'s bluff-catchers.' },
          { id: 'bet-small', label: 'Bet 16bb (35% pot) for thin value', quality: 'perfect', evLoss: 0, coaching: 'Thin value bet with TPWK. BB called two streets — they have a made hand (Qx, 8x, or weaker Ax). A small river bet extracts from those hands. Your A kicker is decent but the 4 makes this a thin spot — small sizing is correct.' },
          { id: 'bet-large', label: 'Bluff 40bb (87% pot)', quality: 'mistake', evLoss: 3.0, coaching: 'Large river bluff with TPWK is incorrect. You have showdown value — you don\'t need to bluff. And BB called two streets, so they likely call your big river bet too.' },
        ],
      },
    ],
  },

  // ── dyn-n34: BTN KQ TPTK on K-J-8-5 — OOP probe, call or raise? ──────────
  {
    id: 'dyn-n34-btn-kq-tptk-facing-probe',
    title: 'BTN TPTK — Facing OOP Probe on Turn. Call or Raise?',
    description: 'You open BTN with KhQh on K-J-8. BB calls your flop c-bet. The 5 turn brings a BB probe bet. TPTK facing aggression.',
    difficulty: 'intermediate',
    category: 'Facing Aggression',
    gameType: 'cash',
    format: '6-max',
    heroPosition: 'BTN',
    villainPosition: 'BB',
    heroCards: ['Kh', 'Qh'],
    effectiveStack: 100,
    stakes: '$1/$2',
    summary: '',
    tags: [],
    steps: [
      {
        street: 'preflop',
        board: [],
        context: 'Folds to BTN. You raise to $5. SB folds. BB calls.',
        prompt: 'KhQh on BTN — suited king-queen. BB defends.',
        options: [
          { id: 'continue', label: 'Note: standard open — proceed to flop', quality: 'perfect', evLoss: 0, coaching: 'KQs is a premium BTN open with top-pair potential and nut flush draw potential.' },
        ],
      },
      {
        street: 'flop',
        board: ['Kc', 'Jd', '8s'],
        context: 'BB checks. Pot $10bb. Flop: Kc Jd 8s. You c-bet 6bb. BB calls.',
        prompt: 'TPTK on K-J-8 — connected board with straight draws (T9, 79). BB calls your c-bet. Proceed to turn.',
        options: [
          { id: 'continue', label: 'Note: BB called flop — proceed to turn', quality: 'perfect', evLoss: 0, coaching: 'BB calls with Kx, Jx, 8x, and straight draws (T9, 79). K-J-8 is a connected board — BB has many draws.' },
        ],
      },
      {
        street: 'turn',
        board: ['Kc', 'Jd', '8s', '5h'],
        context: 'Pot $22bb. Turn: 5h — mostly blank but gives T-9-8-7 straight draws more cards to work with. BB leads 14bb.',
        prompt: 'BB leads the turn (probe bet) for 14bb after calling your flop c-bet. You have TPTK (KhQh). Does this probe mean BB has a made hand or a semi-bluff? Call or raise?',
        options: [
          { id: 'fold', label: 'Fold (BB has sets/two pair)', quality: 'mistake', evLoss: 5.5, coaching: 'Folding TPTK to a single probe bet is far too tight. BB is probing with their entire range here — sets, two pair, AND draws and semi-bluffs. TPTK is a clear continue.' },
          { id: 'call', label: 'Call $14', quality: 'perfect', evLoss: 0, coaching: 'Call the probe bet. TPTK is a strong bluff-catcher. BB is probing with draws (T9, 79) and made hands. You beat most of the draws and are ahead of BB\'s pure bluffs. Call and re-evaluate the river.' },
          { id: 'raise', label: 'Raise to $40', quality: 'good', evLoss: 1.5, coaching: 'Raising is possible with TPTK but risks over-investing vs the top of BB\'s probe range (K8, J8, KJ two-pair). Calling is safer EV.' },
        ],
      },
    ],
  },

  // ── dyn-n35: BB flopped set, slow-played to river, check-raise ───────────
  {
    id: 'dyn-n35-bb-set-river-checkraise',
    title: 'BB Flopped Set — Slow-Played All Streets, Check-Raise River',
    description: 'You defend BB with 7c7d. You flop a set on 7h-9-Q-K runout. You slow-played through the turn. Now river 2 arrives — check-raise for maximum value.',
    difficulty: 'intermediate',
    category: 'River Betting',
    gameType: 'cash',
    format: '6-max',
    heroPosition: 'BB',
    villainPosition: 'BTN',
    heroCards: ['7c', '7d'],
    effectiveStack: 100,
    stakes: '$1/$2',
    summary: '',
    tags: [],
    steps: [
      {
        street: 'preflop',
        board: [],
        context: 'Folds to BTN who raises to $5. SB folds. BB (you) calls.',
        prompt: '7c7d in BB vs BTN. Call or 3-bet?',
        options: [
          { id: 'call', label: 'Call $3', quality: 'perfect', evLoss: 0, coaching: 'Calling with 77 from BB is standard — you have set mining implied odds and a reasonable pair.' },
        ],
      },
      {
        street: 'flop',
        board: ['7h', '9c', 'Qd'],
        context: 'Pot $10bb. Flop: 7h 9c Qd. You check. BTN c-bets 6bb. You call (flopped bottom set).',
        prompt: 'You flopped bottom set on Q-9-7. BTN c-bets. Do you check-raise or slow-play?',
        options: [
          { id: 'call', label: 'Call $6 (slow-play)', quality: 'perfect', evLoss: 0, coaching: 'Slow-playing bottom set on Q-9-7 is valid — you keep BTN\'s wide c-bet range in, including all bluffs and pair hands. Check-raising might fold out too much.' },
          { id: 'check-raise', label: 'Check-raise to $20', quality: 'good', evLoss: 0.7, coaching: 'Check-raising is fine — builds the pot and charges straight draws (T8, J8, 86). Both are valid. Slow-play is slightly better to keep BTN\'s range wide.' },
        ],
      },
      {
        street: 'turn',
        board: ['7h', '9c', 'Qd', 'Kh'],
        context: 'You called flop. Pot $22bb. Turn: Kh. BTN bets 14bb. You call.',
        prompt: 'Turn Kh — BTN continues betting. You still have the set. Call or raise?',
        options: [
          { id: 'call', label: 'Call $14 (continue slow-play)', quality: 'perfect', evLoss: 0, coaching: 'Keep slow-playing. The Kh improved BTN\'s KQ, K9, and AK hands — they have more to call with on the river. Set up the river check-raise.' },
          { id: 'raise', label: 'Raise to $40', quality: 'good', evLoss: 0.8, coaching: 'Raising the turn is fine — build the pot now. Calling to set up a river check-raise is also valid.' },
        ],
      },
      {
        street: 'river',
        board: ['7h', '9c', 'Qd', 'Kh', '2s'],
        context: 'Pot $50bb. River: 2s — blank. BTN bets 28bb. You have 7c7d — flopped set.',
        prompt: 'BTN bets the river after three streets of aggression. You slow-played your set throughout. Now is the moment — check-raise for maximum value or just call?',
        options: [
          { id: 'call', label: 'Call $28 (showdown value)', quality: 'good', evLoss: 3.0, coaching: 'Calling wins the hand but misses a massive check-raise opportunity. BTN bet into you three streets — they have a real hand that will call a raise.' },
          { id: 'raise', label: 'Raise to $90 (check-raise jam)', quality: 'perfect', evLoss: 0, coaching: 'Check-raise jam the river. You slow-played your set specifically to trap BTN into building a big pot. They bet three streets on Q-9-7-K-2 — they have KQ, AK, KK, QQ, or 99. All those hands call a river raise. This is the payoff for your slow-play — maximize by jamming.' },
          { id: 'fold', label: 'Fold', quality: 'mistake', evLoss: 35.0, coaching: 'Folding a set on the river is never correct.' },
        ],
      },
    ],
  },


  // ── dyn-n36: CO JT river thin value bet ──────────────────────────────────
  {
    id: 'dyn-n36-co-jt-river-thin-value',
    title: 'CO Thin River Value — JT Top Pair on J-8-3-2-Q Board',
    description: 'You open CO with JhTd and the board runs J-8-3-2-Q. You have top pair (J) with T kicker throughout. River Q arrives and BTN checks — thin value bet decision.',
    difficulty: 'intermediate',
    category: 'River Betting',
    gameType: 'cash',
    format: '6-max',
    heroPosition: 'CO',
    villainPosition: 'BTN',
    heroCards: ['Jh', 'Td'],
    effectiveStack: 100,
    stakes: '$1/$2',
    summary: '',
    tags: [],
    steps: [
      {
        street: 'preflop',
        board: [],
        context: 'Folds to CO. You raise to $5. BTN calls. Blinds fold. Pot $11bb.',
        prompt: 'JhTd on CO — connected broadway. BTN calls IP.',
        options: [
          { id: 'continue', label: 'Note: standard open — proceed to flop', quality: 'perfect', evLoss: 0, coaching: 'JTo is a standard CO open with connectivity and top-pair potential.' },
        ],
      },
      {
        street: 'flop',
        board: ['Jc', '8d', '3s'],
        context: 'Pot $11bb. Flop: Jc 8d 3s. You act first OOP. You c-bet 6bb. BTN calls.',
        prompt: 'Top pair on J-8-3 rainbow. You c-bet, BTN calls. Proceed to turn.',
        options: [
          { id: 'continue', label: 'Note: BTN called flop — proceed to turn', quality: 'perfect', evLoss: 0, coaching: 'BTN calls with 8x, J9, and draws. Your top pair is likely best.' },
        ],
      },
      {
        street: 'turn',
        board: ['Jc', '8d', '3s', '2h'],
        context: 'Pot $23bb. Turn: 2h — blank. You bet 14bb. BTN calls.',
        prompt: 'Blank turn, you value bet. BTN calls. River coming.',
        options: [
          { id: 'continue', label: 'Note: BTN called turn — proceed to river', quality: 'perfect', evLoss: 0, coaching: 'BTN called twice — they have a made hand (8x, Jx worse kicker, or draws).' },
        ],
      },
      {
        street: 'river',
        board: ['Jc', '8d', '3s', '2h', 'Qh'],
        context: 'Pot $51bb. River: Qh. BTN checks. You have JhTd — top pair (J) with T kicker on J-8-3-2-Q.',
        prompt: 'River Qh — you still have top pair (Jacks) with T kicker. The Q doesn\'t improve your hand but doesn\'t hurt it much either. BTN checked after calling two streets. Do you bet for thin value?',
        options: [
          { id: 'check', label: 'Check (Qh might have improved BTN)', quality: 'good', evLoss: 1.0, coaching: 'Checking with top pair after two value streets on a non-threatening river is slightly passive. BTN checked — they have a hand that lost confidence on the Q. You can still extract value.' },
          { id: 'bet-small', label: 'Bet 18bb (35% pot)', quality: 'perfect', evLoss: 0, coaching: 'Thin value bet. BTN called two streets and checked — they have 8x, J9, or a stubborn hand they won\'t fold for a small bet. A small river lead extracts value from all of BTN\'s bluff-catchers. Optimal play.' },
          { id: 'bet-large', label: 'Bet 40bb (78% pot)', quality: 'mistake', evLoss: 3.0, coaching: 'Large river bet with top pair, T kicker is a mistake. You\'re not getting called by worse hands for this sizing on a Queen-river after two streets. Size down for thin value.' },
        ],
      },
    ],
  },

  // ── dyn-n37: BTN A8 top two pair — blank river overbet ───────────────────
  {
    id: 'dyn-n37-btn-a8-top-two-pair-overbet-river',
    title: 'BTN Top Two Pair — Overbet River for Maximum Value',
    description: 'You open BTN with Ah8h and flop top two pair on A-8-5 rainbow. The turn 2 is a blank. River K is also blank. Execute a river overbet with your strong two pair.',
    difficulty: 'intermediate',
    category: 'River Betting',
    gameType: 'cash',
    format: '6-max',
    heroPosition: 'BTN',
    villainPosition: 'BB',
    heroCards: ['Ah', '8h'],
    effectiveStack: 100,
    stakes: '$1/$2',
    summary: '',
    tags: [],
    steps: [
      {
        street: 'preflop',
        board: [],
        context: 'Folds to BTN. You raise to $5. SB folds. BB calls.',
        prompt: 'Ah8h on BTN — suited ace. BB defends.',
        options: [
          { id: 'continue', label: 'Note: standard open — proceed to flop', quality: 'perfect', evLoss: 0, coaching: 'A8s is a standard BTN open with flush potential and two-pair possibility.' },
        ],
      },
      {
        street: 'flop',
        board: ['As', '8d', '5c'],
        context: 'BB checks. Pot $10bb. Flop: As 8d 5c — dry board. You c-bet 6bb. BB calls.',
        prompt: 'You flopped top two pair on A-8-5 dry rainbow. BB calls your c-bet. Plan for the rest of the hand.',
        options: [
          { id: 'continue', label: 'Note: BB called flop — proceed to turn', quality: 'perfect', evLoss: 0, coaching: 'BB calls with Ax, 8x, 5x, and pair hands. Your top two pair is the best possible two-pair combination here.' },
        ],
      },
      {
        street: 'turn',
        board: ['As', '8d', '5c', '2h'],
        context: 'Pot $22bb. Turn: 2h — blank. You bet 14bb. BB calls.',
        prompt: 'Blank turn, you barrel. BB calls. Heading to the river with a big pot.',
        options: [
          { id: 'continue', label: 'Note: BB called turn — proceed to river', quality: 'perfect', evLoss: 0, coaching: 'BB called twice — they have a real hand. Your top two pair is still almost certainly the best hand.' },
        ],
      },
      {
        street: 'river',
        board: ['As', '8d', '5c', '2h', 'Kd'],
        context: 'Pot $50bb. River: Kd — mostly blank (BB could have AK for better two pair, but rare). BB checks.',
        prompt: 'River Kd. BB called two streets and checks. You have top two pair (A and 8). The K is a minor scare card but rare for BB to have AK after calling flop/turn. Do you overbet river?',
        options: [
          { id: 'check', label: 'Check (scared of AK)', quality: 'mistake', evLoss: 6.0, coaching: 'Checking top two pair after two streets of value on a dry board is a value error. AK in BB\'s range is a small fraction. Most of BB\'s range is Ax, 8x, 5x — they will call a river bet.' },
          { id: 'bet-standard', label: 'Bet 32bb (64% pot)', quality: 'good', evLoss: 1.5, coaching: 'Standard river bet is fine. Extracts from BB\'s Ax and 8x hands.' },
          { id: 'overbet', label: 'Overbet 60bb (120% pot)', quality: 'perfect', evLoss: 0, coaching: 'Overbet the river with top two pair on a dry board. On A-8-5-2-K, your two pair is near the top of your range. BB called two streets — they have a strong enough hand to call. By overbetting, you extract maximum value from BB\'s committed Ax and 8x hands that won\'t fold.' },
        ],
      },
    ],
  },

  // ── dyn-n38: BB TJ two pair, straight on river — fold to value bet ────────
  {
    id: 'dyn-n38-bb-tj-two-pair-straight-river-fold',
    title: 'BB Two Pair — River Ace Completes Straight. Fold to Value Bet?',
    description: 'You defend BB with 9hTh and flop two pair on 9-T-Q. The K turn and A river complete K-Q-J-T-9 and A-K-Q-J-T straights. BTN fires a river value bet.',
    difficulty: 'intermediate',
    category: 'River Defense',
    gameType: 'cash',
    format: '6-max',
    heroPosition: 'BB',
    villainPosition: 'BTN',
    heroCards: ['9h', 'Th'],
    effectiveStack: 100,
    stakes: '$1/$2',
    summary: '',
    tags: [],
    steps: [
      {
        street: 'preflop',
        board: [],
        context: 'Folds to BTN who raises to $5. SB folds. BB (you) calls.',
        prompt: '9hTh in BB — suited connector. Defend vs BTN.',
        options: [
          { id: 'call', label: 'Call $3', quality: 'perfect', evLoss: 0, coaching: 'T9s is a clear BB defend with straight and flush potential.' },
        ],
      },
      {
        street: 'flop',
        board: ['9c', 'Td', 'Qh'],
        context: 'Pot $10bb. Flop: 9c Td Qh. You check. BTN c-bets 6bb. You call (two pair!).',
        prompt: 'You flopped two pair (9 and T) on Q-T-9. BTN c-bets. But this board is dangerous — JT, KJ, and AK all have straight draws. Call?',
        options: [
          { id: 'call', label: 'Call $6', quality: 'perfect', evLoss: 0, coaching: 'Call with two pair. You\'re ahead right now but the board is dangerous. Don\'t bloat the pot with a check-raise — just call and re-evaluate.' },
          { id: 'check-raise', label: 'Check-raise to $20', quality: 'good', evLoss: 0.8, coaching: 'Check-raising two pair is valid — protects your hand and builds a pot you likely have the best of. Calling is slightly safer on this connected board.' },
        ],
      },
      {
        street: 'turn',
        board: ['9c', 'Td', 'Qh', 'Kh'],
        context: 'You called flop. Pot $22bb. Turn: Kh — now J makes a straight (K-Q-J-T-9). BTN bets 14bb.',
        prompt: 'Kh turn: now any J completes a K-Q-J-T-9 straight. BTN bets 14bb. Your two pair (9 and T). Call or fold?',
        options: [
          { id: 'fold', label: 'Fold (King completed draws)', quality: 'mistake', evLoss: 5.0, coaching: 'Folding two pair to one bet when a straight draw card comes is too tight. BTN barrels their wide range here — many of which are still behind your two pair.' },
          { id: 'call', label: 'Call $14', quality: 'perfect', evLoss: 0, coaching: 'Call. You have two pair, still a strong hand. BTN\'s barreling range includes all their flop c-bets — many of which are Ax, pair hands, and bluffs that don\'t have the J for a straight. Call and see the river.' },
        ],
      },
      {
        street: 'river',
        board: ['9c', 'Td', 'Qh', 'Kh', 'Ah'],
        context: 'Pot $50bb. River: Ah — completes A-K-Q-J-T straight (any J in BTN\'s hand is a straight). BTN bets 35bb (70% pot).',
        prompt: 'River Ah completes the Broadway straight (A-K-Q-J-T). Any J in BTN\'s hand makes the nuts. BTN bets 70% pot — a value sizing. You have two pair (9 and T). The board reads A-K-Q-J-T and any J beats you. Do you call or fold?',
        options: [
          { id: 'call', label: 'Call $35 (hero call)', quality: 'mistake', evLoss: 5.0, coaching: 'Calling here is a mistake. The board is A-K-Q-J-T — any J in BTN\'s hand makes the nuts, and BTN opened the pot and has all the AJs, KJs, QJs combos. BTN betting 70% pot on this board is very weighted to straights and strong made hands.' },
          { id: 'fold', label: 'Fold (board completes straight)', quality: 'perfect', evLoss: 0, coaching: 'Fold. The river A completes Broadway (A-K-Q-J-T). Any J beats you, and BTN\'s range as the preflop raiser contains many Jx combos (AJ, KJ, QJ, JJ). Their 70% pot river bet is weighted heavily to straights. Two pair is not good enough here.' },
        ],
      },
    ],
  },

  // ── dyn-n39: CO river blocker bluff — KQ on missed draw board ────────────
  {
    id: 'dyn-n39-co-river-blocker-bluff-kq',
    title: 'CO River Blocker Bluff — KQ Misses All Draws on A-9-6-3-T',
    description: 'You open CO with KcQc on A-9-6-3 — you had a gutshot and backdoor flush draw. The T river completes nothing. You have the Kc blocker. Bluff or give up?',
    difficulty: 'intermediate',
    category: 'River Bluffing',
    gameType: 'cash',
    format: '6-max',
    heroPosition: 'CO',
    villainPosition: 'BB',
    heroCards: ['Kc', 'Qc'],
    effectiveStack: 100,
    stakes: '$1/$2',
    summary: '',
    tags: [],
    steps: [
      {
        street: 'preflop',
        board: [],
        context: 'Folds to CO. You raise to $5. BTN and SB fold. BB calls.',
        prompt: 'KcQc on CO — premium suited broadway. BB defends.',
        options: [
          { id: 'continue', label: 'Note: standard open — proceed to flop', quality: 'perfect', evLoss: 0, coaching: 'KQs is a strong CO open with flush, straight, and top-pair potential.' },
        ],
      },
      {
        street: 'flop',
        board: ['Ah', '9d', '6c'],
        context: 'BB checks. Pot $10bb. Flop: Ah 9d 6c. You miss entirely. You check back (no c-bet with KQ on an A-high board you missed).',
        prompt: 'You missed the A-9-6 flop with KcQc. Do you c-bet or check back?',
        options: [
          { id: 'check', label: 'Check back', quality: 'perfect', evLoss: 0, coaching: 'Correct to check KQ on A-9-6 — the ace hits BB\'s range heavily (Ax defends), and you have no pair/draw. Take a free card.' },
          { id: 'bet', label: 'C-bet 6bb (bluff)', quality: 'good', evLoss: 0.7, coaching: 'C-betting is a reasonable bluff given your position, but KQ has better spots. Checking preserves equity.' },
        ],
      },
      {
        street: 'turn',
        board: ['Ah', '9d', '6c', '3s'],
        context: 'BB checks turn. Pot $10bb. Turn: 3s — now KQ has a gutshot (2 makes a wheel? No: K-Q on A-9-6-3 doesn\'t give a standard draw). BB checks. You check back again.',
        prompt: 'Turn 3s — still no pair with KcQc. BB checked. You check back again.',
        options: [
          { id: 'check', label: 'Check back', quality: 'perfect', evLoss: 0, coaching: 'Checking back with KQ on A-9-6-3 with no equity is correct. You\'re looking for a river card to either hit or bluff.' },
        ],
      },
      {
        street: 'river',
        board: ['Ah', '9d', '6c', '3s', 'Tc'],
        context: 'BB checks river. Pot $10bb. River: Tc — board is A-9-6-3-T. You have KcQc — two clubs (Kc blocker to club flush) but no flush (need 5 clubs). BB checked. You have King-high only.',
        prompt: 'River Tc. You have King-high, missed everything. BB checked. You have the Kc (blocker to club flush) and KQ (blockers to K-high hands). Do you fire a bluff or give up?',
        options: [
          { id: 'check', label: 'Give up (King-high, no bluff)', quality: 'good', evLoss: 0.5, coaching: 'Giving up is fine — the board checked through twice and BB may be pot-controlling a medium hand. Your bluff equity is limited.' },
          { id: 'bet-small', label: 'Bluff 6bb (60% of pot)', quality: 'perfect', evLoss: 0, coaching: 'Fire a small river bluff. You have the Kc (blocks some of BB\'s calling hands) and your line (check-check-check) looks like a missed draw or air. BB checked twice — they have a medium hand that might fold to a bet. Your blockers make this a profitable spot. Keep the sizing small to maximize fold equity.' },
          { id: 'bet-large', label: 'Bluff 25bb (250% pot)', quality: 'mistake', evLoss: 3.0, coaching: 'Large river bluff into a tiny pot with no real blockers to BB\'s calling range is a mistake. The pot is too small to justify a large bet — keep it proportional.' },
        ],
      },
    ],
  },

  // ── dyn-n40: BTN multi-street bluff, complete or give up on river ─────────
  {
    id: 'dyn-n40-btn-multistreet-bluff-river',
    title: 'BTN Multi-Street Bluff — Complete or Give Up on River?',
    description: 'You open BTN and barrel the flop and turn on Jh-9c-4d-2h as a bluff. The river 7c arrives. You have committed significant equity to this bluff — complete it or give up?',
    difficulty: 'intermediate',
    category: 'River Bluffing',
    gameType: 'cash',
    format: '6-max',
    heroPosition: 'BTN',
    villainPosition: 'BB',
    heroCards: ['Ac', '6d'],
    effectiveStack: 100,
    stakes: '$1/$2',
    summary: '',
    tags: [],
    steps: [
      {
        street: 'preflop',
        board: [],
        context: 'Folds to BTN. You raise to $5. SB folds. BB calls.',
        prompt: 'Ac6d on BTN — ace-rag. Standard BTN open for position.',
        options: [
          { id: 'continue', label: 'Note: standard open — proceed to flop', quality: 'perfect', evLoss: 0, coaching: 'A6o is a standard BTN open. You have ace-high and position.' },
        ],
      },
      {
        street: 'flop',
        board: ['Jh', '9c', '4d'],
        context: 'BB checks. Pot $10bb. Flop: Jh 9c 4d. You c-bet 6bb as a bluff with Ac6d. BB calls.',
        prompt: 'You c-bet Ac6d on J-9-4 — pure bluff. BB calls. Continue the bluff?',
        options: [
          { id: 'continue', label: 'Note: BB called flop — proceed to turn', quality: 'perfect', evLoss: 0, coaching: 'BB called your flop bluff. The turn is the key decision — barrel again or give up. Your Ac gives some blocker value.' },
        ],
      },
      {
        street: 'turn',
        board: ['Jh', '9c', '4d', '2h'],
        context: 'Pot $22bb. Turn: 2h — blank. You bet 14bb as a double-barrel bluff. BB calls.',
        prompt: 'You double-barreled the bluff on the 2h turn. BB called again. Heading to the river — you\'ve committed 20bb to this bluff.',
        options: [
          { id: 'continue', label: 'Note: BB called turn — proceed to river', quality: 'perfect', evLoss: 0, coaching: 'BB called two streets. Their range is now: Jx (top pair), 9x, and strong bluff-catchers. The river is the decision point.' },
        ],
      },
      {
        street: 'river',
        board: ['Jh', '9c', '4d', '2h', '7c'],
        context: 'Pot $50bb. River: 7c — blank. BB checks. You have Ac6d — ace-high.',
        prompt: 'River 7c is a total brick. BB called two streets and checked the river. You have ace-high — the bluff has to work now. Complete the triple-barrel bluff or give up?',
        options: [
          { id: 'check', label: 'Give up (save the last bet)', quality: 'good', evLoss: 1.5, coaching: 'Giving up the bluff is fine — BB called two streets and checked, which could mean they have a strong made hand waiting to call. Saving the river bet is defensible.' },
          { id: 'bet-large', label: 'Complete triple-barrel (32bb, 64% pot)', quality: 'perfect', evLoss: 0, coaching: 'Complete the triple-barrel bluff. BB called twice and checked the river — they have a medium-strength one-pair hand (Jx, 9x) that is choosing to check-call. Your large river bet represents a very strong hand (JJ, 99, A-J type holdings). A significant portion of BB\'s range folds to the third barrel, making this profitable.' },
          { id: 'bet-small', label: 'Small river bluff (15bb)', quality: 'good', evLoss: 1.0, coaching: 'Small river bluff is too weak to fold out BB\'s one-pair hands. If you\'re going to bluff, size up significantly.' },
        ],
      },
    ],
  },

  // ── dyn-n41: BTN near-indifferent turn barrel — SPR context ──────────────
  {
    id: 'dyn-n41-btn-near-indifferent-turn-barrel',
    title: 'BTN Near-Indifferent Turn Decision — SPR Changes the Calculus',
    description: 'You open BTN with AcJh and bet the Ac-8d-3h flop. The 5s turn arrives. At high SPR, barrel for value. At low SPR, the decision becomes near-indifferent. Key concept: SPR changes optimal strategy.',
    difficulty: 'advanced',
    category: 'SPR and Stack Depth',
    gameType: 'cash',
    format: '6-max',
    heroPosition: 'BTN',
    villainPosition: 'BB',
    heroCards: ['Ac', 'Jh'],
    effectiveStack: 100,
    stakes: '$1/$2',
    summary: '',
    tags: [],
    steps: [
      {
        street: 'preflop',
        board: [],
        context: 'Folds to BTN. You raise to $5. SB folds. BB calls.',
        prompt: 'AcJh on BTN — strong ace. BB defends. Consider SPR implications.',
        options: [
          { id: 'continue', label: 'Note: standard open — proceed to flop', quality: 'perfect', evLoss: 0, coaching: 'AJo is a standard BTN open. The key concept in this puzzle is how SPR (Stack-to-Pot Ratio) affects optimal turn betting strategy.' },
        ],
      },
      {
        street: 'flop',
        board: ['Ac', '8d', '3h'],
        context: 'BB checks. Pot $10bb. Flop: Ac 8d 3h — dry board. You c-bet 6bb. BB calls. Pot is now $22bb with effective stacks of $89bb remaining. SPR = 89/22 ≈ 4.',
        prompt: 'You c-bet TPTK on dry A-8-3. BB calls. SPR entering the turn is approximately 4. What does SPR=4 imply for your turn strategy?',
        options: [
          { id: 'continue', label: 'Note: BB called flop (SPR≈4) — proceed to turn', quality: 'perfect', evLoss: 0, coaching: 'SPR≈4 means you have enough stack left for two more streets of betting (turn + river). A turn bet of ~40% pot leaves about SPR=2.5 for the river, which is a comfortable 2-street value extraction setup.' },
        ],
      },
      {
        street: 'turn',
        board: ['Ac', '8d', '3h', '5s'],
        context: 'Pot $22bb. Turn: 5s — blank. BB checks. Effective stacks ~$89bb. SPR≈4.',
        prompt: 'Blank 5s turn. BB checks. You have TPTK (AcJh on A-8-3-5). SPR≈4. At this SPR, a turn barrel commits you to a river bet. Is this near-indifferent or a clear bet?',
        options: [
          { id: 'check', label: 'Check back (SPR concern)', quality: 'good', evLoss: 0.8, coaching: 'Checking back at SPR≈4 is a reasonable approach if you want pot control. However, TPTK on a blank board is still ahead of BB\'s range — the EV difference is small but betting is slightly better.' },
          { id: 'bet-small', label: 'Bet 9bb (41% pot)', quality: 'perfect', evLoss: 0, coaching: 'Barrel the turn for value. At SPR≈4, your TPTK is strong and a turn bet sets up a manageable river bet. The blank 5s doesn\'t change anything. BB checked — they\'re still in the pot with a made hand that calls. Bet and extract value while planning a river sizing.' },
          { id: 'jam', label: 'Jam $89bb (405% pot — overkill)', quality: 'mistake', evLoss: 4.0, coaching: 'Jamming on a blank turn with TPTK when SPR≈4 is an overbluff. You have a value hand — size appropriately for 2 streets, not one.' },
        ],
      },
      {
        street: 'river',
        board: ['Ac', '8d', '3h', '5s', 'Kd'],
        context: 'BB calls turn. Pot $40bb. River: Kd — potential scare card (BB can have Kx). BB checks. Effective stacks ~$80bb. SPR relative to pot is now manageable.',
        prompt: 'River Kd is a mild scare card. BB called the turn and checked. You have TPTK. How does the river change your decision given the committed pot?',
        options: [
          { id: 'check', label: 'Check (Kd might have improved BB)', quality: 'mistake', evLoss: 5.5, coaching: 'Checking TPTK after two streets of value on a dry board is a mistake. Yes, Kd could improve BB, but the frequency of BB having Kx vs the value extracted from Ax, 8x, and underpairs makes betting far superior.' },
          { id: 'bet-medium', label: 'Bet 22bb (55% pot)', quality: 'perfect', evLoss: 0, coaching: 'Medium river value bet. BB called two streets on a dry board — they have a made hand. Kd might scare you but it improves a small fraction of BB\'s range. Extract from the majority who have Ax, 8x, or underpairs. This is the right completion of the barrel-barrel-value sequence at this SPR.' },
          { id: 'bet-large', label: 'Bet 38bb (95% pot)', quality: 'good', evLoss: 1.5, coaching: 'Large river bet may fold out some of BB\'s thinner calls. Medium sizing extracts more across BB\'s full calling range.' },
        ],
      },
    ],
  },

  // ── dyn-n42: BTN ATs river bluff — holds Ah blocker on K-Q-J-9 ───────────
  {
    id: 'dyn-n42-btn-blocker-river-bluff-sizing',
    title: 'BTN River Bluff — Blocking the Nut Flush. What Sizing?',
    description: 'You open BTN with AhTs. The board runs K-Q-J-9 — you have a gutshot that missed. Your Ah blocks the nut flush (Ah-Xh). River bluff with blocker value.',
    difficulty: 'advanced',
    category: 'River Bluffing',
    gameType: 'cash',
    format: '6-max',
    heroPosition: 'BTN',
    villainPosition: 'BB',
    heroCards: ['Ah', 'Ts'],
    effectiveStack: 100,
    stakes: '$1/$2',
    summary: '',
    tags: [],
    steps: [
      {
        street: 'preflop',
        board: [],
        context: 'Folds to BTN. You raise to $5. SB folds. BB calls.',
        prompt: 'AhTs on BTN — suited ace. BB defends. Plan for the hand.',
        options: [
          { id: 'continue', label: 'Note: standard open — proceed to flop', quality: 'perfect', evLoss: 0, coaching: 'ATs is a premium BTN open with flush and top-pair potential.' },
        ],
      },
      {
        street: 'flop',
        board: ['Kh', 'Qh', 'Jc'],
        context: 'BB checks. Pot $10bb. Flop: Kh Qh Jc. You have a gutshot to Broadway (T makes K-Q-J-T-9? No: need A for A-K-Q-J-T Broadway, but ATs on KQJ means you actually have Broadway with Ah-Ts-Kh-Qh-Jc: A-K-Q-J-T straight! Wait — you have AhTs on board KhQhJc: your A and T give you A-K-Q-J-T = Broadway straight! You flopped the nuts.',
        prompt: 'Wait — AhTs on Kh-Qh-Jc: you have A-K-Q-J-T = Broadway (the nuts)! And you have Ah for nut flush draw. You flopped the absolute nuts. How do you play this monster?',
        options: [
          { id: 'check', label: 'Check (slow-play the nuts)', quality: 'good', evLoss: 0.5, coaching: 'Slow-playing the nuts on a very wet board is risky — many turns kill your action (paired board reduces calling ranges). C-betting is better EV.' },
          { id: 'bet', label: 'Bet 6bb (60% pot)', quality: 'perfect', evLoss: 0, coaching: 'Bet with the nut straight on an extremely wet board. Two hearts mean BB can have flush draws. Straight draws and combo draws exist. Get money in now while there\'s action to extract.' },
        ],
      },
      {
        street: 'turn',
        board: ['Kh', 'Qh', 'Jc', '9d'],
        context: 'BB calls flop. Pot $22bb. Turn: 9d — no help to hero\'s straight, but 9 gives draws to T8 for a lower straight. BB checks.',
        prompt: 'Turn 9d — your Broadway is still the nuts but 8-T creates an alternative straight. BB calls again. The pot is building with your nut straight. How do you bet the turn?',
        options: [
          { id: 'bet', label: 'Bet 15bb (68% pot)', quality: 'perfect', evLoss: 0, coaching: 'Bet the turn for value. Your Broadway straight is still the nuts. BB called the flop — they have a flush draw, a pair, or a lesser straight draw. Extract value now.' },
          { id: 'check', label: 'Check (trap for river)', quality: 'good', evLoss: 0.8, coaching: 'Checking the turn to trap for a river overbet is fine but risks BB checking behind on the river too, cutting your value.' },
        ],
      },
      {
        street: 'river',
        board: ['Kh', 'Qh', 'Jc', '9d', '8h'],
        context: 'BB calls turn. Pot $52bb. River: 8h — the flush completed (three hearts: Kh, Qh, 8h) and T8 made a lower straight (8-9-T-J-Q). BTN checks. Your Broadway (A-K-Q-J-T) is STILL the nuts — beats both the flush and lower straight.',
        prompt: 'River 8h completes hearts for flush and makes a lower straight (T8). BB checked. Your AhTs Broadway is still the nuts. How do you extract maximum value?',
        options: [
          { id: 'check', label: 'Check (induce bluff)', quality: 'good', evLoss: 3.0, coaching: 'Inducing is fine but leaving value on the table — BB has a flush or lower straight and will call a bet. Extract directly.' },
          { id: 'bet-standard', label: 'Bet 32bb (62% pot)', quality: 'good', evLoss: 2.0, coaching: 'Standard river bet extracts value from BB\'s flush and lower straights.' },
          { id: 'overbet', label: 'Overbet 70bb (135% pot)', quality: 'perfect', evLoss: 0, coaching: 'Overbet river with the nuts. BB has a flush or lower straight — hands that feel very strong and will call large bets. The 8h completing the flush gives BB\'s range a lot of value that will call your overbet. Maximize extraction with the absolute nuts.' },
        ],
      },
    ],
  },

  // ── dyn-n43: MDF river calculation — BB defends medium pair ──────────────
  {
    id: 'dyn-n43-bb-mdf-river-calculation',
    title: 'BB River Defense — MDF Calculation with Medium Pair',
    description: 'BTN bets 75% pot on a blank river. The minimum defense frequency (MDF) is ~57%. You have a medium pair — is it in your defending range? Understanding MDF.',
    difficulty: 'advanced',
    category: 'GTO Concepts',
    gameType: 'cash',
    format: '6-max',
    heroPosition: 'BB',
    villainPosition: 'BTN',
    heroCards: ['8h', '8d'],
    effectiveStack: 100,
    stakes: '$1/$2',
    summary: '',
    tags: [],
    steps: [
      {
        street: 'preflop',
        board: [],
        context: 'Folds to BTN who raises to $5. SB folds. BB (you) calls.',
        prompt: '8h8d in BB — solid pocket pair. Call or 3-bet vs BTN?',
        options: [
          { id: 'call', label: 'Call $3', quality: 'perfect', evLoss: 0, coaching: '88 is a standard BB call vs BTN. Set mining equity + the ability to overpair on low boards.' },
          { id: '3bet', label: '3-bet to $16', quality: 'good', evLoss: 0.5, coaching: '3-betting 88 from BB vs BTN is a reasonable squeeze play but calling is more standard.' },
        ],
      },
      {
        street: 'flop',
        board: ['Ah', '7c', '2d'],
        context: 'Pot $10bb. Flop: Ah 7c 2d. You check. BTN c-bets 6bb. You call (underpair, gutshot to nothing, but BTN c-bets air frequently).',
        prompt: '88 on A-7-2. BTN c-bets. Your underpair has showdown value as a bluff-catcher. Call?',
        options: [
          { id: 'call', label: 'Call $6', quality: 'perfect', evLoss: 0, coaching: 'Call with 88. BTN c-bets wide on A-7-2 — many bluffs. Your pocket pair beats all the bluffs and has showdown value. Classic bluff-catcher call.' },
          { id: 'fold', label: 'Fold', quality: 'mistake', evLoss: 2.5, coaching: 'Folding 88 on the flop to a c-bet is too tight. You have showdown value as an underpair.' },
        ],
      },
      {
        street: 'turn',
        board: ['Ah', '7c', '2d', '5s'],
        context: 'Pot $22bb. Turn: 5s — blank. BTN bets 14bb. You call (88 is still a bluff-catcher).',
        prompt: 'Blank turn, BTN barrels. You call with 88 again. Heading to the river.',
        options: [
          { id: 'call', label: 'Call $14', quality: 'perfect', evLoss: 0, coaching: 'Call. Your 88 underpair is a bluff-catcher on A-7-2-5. BTN\'s double-barrel range has significant bluffs.' },
          { id: 'fold', label: 'Fold', quality: 'mistake', evLoss: 4.0, coaching: 'Folding 88 to a double-barrel is too tight — you beat all of BTN\'s bluffs.' },
        ],
      },
      {
        street: 'river',
        board: ['Ah', '7c', '2d', '5s', '3h'],
        context: 'Pot $50bb. River: 3h — blank. BTN bets 37.5bb (75% pot). MDF = pot/(pot + bet) = 50/(50 + 37.5) = 57%. You need to call at least 57% of the time to prevent BTN from profitably bluffing.',
        prompt: 'BTN bets 75% pot on a blank river. MDF = 57%. Your 88 underpair on A-7-2-5-3. Is 88 in your defending range? You need 37.5% pot odds to call — you must win 30% of the time. Does BTN bluff often enough for 88 to be a call?',
        options: [
          { id: 'fold', label: 'Fold (only bluff-catcher, risky)', quality: 'good', evLoss: 1.0, coaching: 'Folding 88 is defensible — it\'s the bottom of your calling range. However, the MDF math says you must defend a significant portion of your range to prevent BTN from bluffing too profitably.' },
          { id: 'call', label: 'Call $37.5 (MDF defense)', quality: 'perfect', evLoss: 0, coaching: 'Call. The MDF of 57% means you must defend broadly. Your 88 beats BTN\'s bluffs (QJ, KJ, T9, 64 — missed straights/draws). BTN fires 75% pot — a sizing that targets fold equity. If BTN has enough bluffs (which they should at equilibrium), 88 is a profitable call that defends your range correctly.' },
          { id: 'raise', label: 'Check-raise jam (bluff)', quality: 'mistake', evLoss: 5.0, coaching: 'Raising the river with a bluff-catcher (88) against BTN\'s value-heavy river range is a mistake. You\'re turning a showdown hand into a bluff — losing value when you\'re ahead and getting called by all value hands.' },
        ],
      },
    ],
  },

  // ── dyn-n44: CO turn overbluff — 78 missed on A-K-3-9 ───────────────────
  {
    id: 'dyn-n44-co-turn-overbluff-decision',
    title: 'CO Turn Overbluff — 78 Misses on A-K-3-9. Fire or Give Up?',
    description: 'You open CO with 7c8c. The board runs A-K-3-9 — you have no pair, no draw. This is a spot to analyze whether overbluffing or giving up is correct.',
    difficulty: 'advanced',
    category: 'Bluffing Theory',
    gameType: 'cash',
    format: '6-max',
    heroPosition: 'CO',
    villainPosition: 'BB',
    heroCards: ['7c', '8c'],
    effectiveStack: 100,
    stakes: '$1/$2',
    summary: '',
    tags: [],
    steps: [
      {
        street: 'preflop',
        board: [],
        context: 'Folds to CO. You raise to $5. BTN and SB fold. BB calls.',
        prompt: '7c8c on CO — suited connector. BB defends.',
        options: [
          { id: 'continue', label: 'Note: standard open — proceed to flop', quality: 'perfect', evLoss: 0, coaching: '78s is a standard CO open with implied odds and connectivity.' },
        ],
      },
      {
        street: 'flop',
        board: ['As', 'Kd', '3h'],
        context: 'BB checks. Pot $10bb. Flop: As Kd 3h. You c-bet 6bb (standard c-bet representing your wide opening range). BB calls.',
        prompt: 'You c-bet on A-K-3 as a standard bluff with 78s. BB calls. What should BB\'s range be here?',
        options: [
          { id: 'continue', label: 'Note: BB called flop — proceed to turn', quality: 'perfect', evLoss: 0, coaching: 'BB calls with Ax, Kx, 33, and some draws. BB\'s range is fairly strong here — they called on an A-K high board.' },
        ],
      },
      {
        street: 'turn',
        board: ['As', 'Kd', '3h', '9c'],
        context: 'Pot $22bb. Turn: 9c — adds gutshot potential (78 and T8 have draws to ... wait: you have 7c8c on A-K-3-9: no straight draw (need 5-6-T-J for 78, none on board). You have pure air. BB checks.',
        prompt: 'You have 7c8c on A-K-3-9 — no pair, no draw (pure air). BB checked. Should you overbluff the turn, fire a normal size, or give up?',
        options: [
          { id: 'check', label: 'Give up (pure air)', quality: 'perfect', evLoss: 0, coaching: 'Give up the bluff. You have no pair, no draw, and no blockers to BB\'s likely holdings (Ax, Kx). BB called a c-bet on A-K-3 — they have something real. Firing again with pure air into a strong calling range is burning money.' },
          { id: 'bet-standard', label: 'Fire 14bb (double-barrel)', quality: 'good', evLoss: 1.5, coaching: 'Double-barreling pure air into BB\'s strong range (Ax, Kx) is a poor EV play. The turn is a blank for both ranges — BB won\'t fold their strong top-pair hands. Give up.' },
          { id: 'overbet', label: 'Overbet 28bb (127% pot)', quality: 'mistake', evLoss: 4.0, coaching: 'Overbetting with pure air on A-K-3-9 into BB\'s strong Ax/Kx range is a significant mistake. You have no blockers, no equity, and BB\'s range dominates yours. This is not the correct spot to overbluff.' },
        ],
      },
    ],
  },

  // ── dyn-n45: BTN river overbet with flopped flush ─────────────────────────
  {
    id: 'dyn-n45-btn-river-overbet-flopped-flush',
    title: 'BTN Flopped Flush — Slow-Played to River. When to Overbet?',
    description: 'You open BTN with Kd9d and flop a flush on Qd-7d-2h. You slow-play to the river to allow BB to build a hand. River arrives — now overbet for maximum value.',
    difficulty: 'advanced',
    category: 'River Betting',
    gameType: 'cash',
    format: '6-max',
    heroPosition: 'BTN',
    villainPosition: 'BB',
    heroCards: ['Kd', '9d'],
    effectiveStack: 100,
    stakes: '$1/$2',
    summary: '',
    tags: [],
    steps: [
      {
        street: 'preflop',
        board: [],
        context: 'Folds to BTN. You raise to $5. SB folds. BB calls.',
        prompt: 'Kd9d on BTN — king-9 suited. BB defends.',
        options: [
          { id: 'continue', label: 'Note: standard open — proceed to flop', quality: 'perfect', evLoss: 0, coaching: 'K9s is a standard BTN open with flush potential.' },
        ],
      },
      {
        street: 'flop',
        board: ['Qd', '7d', '2h'],
        context: 'BB checks. Pot $10bb. Flop: Qd 7d 2h — you flopped a flush (Kd9d on Qd7d2h = flush)! BB checks.',
        prompt: 'You flopped a flush on Q-7-2 with two diamonds. BB checks. Should you bet for value immediately or slow-play?',
        options: [
          { id: 'bet', label: 'Bet 6bb (60% pot — extract now)', quality: 'good', evLoss: 0.8, coaching: 'Betting the flush is fine — build the pot. However, slow-playing to let BB catch up and set up a river overbet can extract more EV in the right conditions.' },
          { id: 'check', label: 'Check (slow-play — build pot across streets)', quality: 'perfect', evLoss: 0, coaching: 'Slow-play the flush. The board is Q-7-2 — BB has limited equity and not much to call with yet. Check and let them pick up a pair on the turn, then extract across two streets when they have a hand to commit with.' },
        ],
      },
      {
        street: 'turn',
        board: ['Qd', '7d', '2h', 'Tc'],
        context: 'BB checks. You checked flop. Pot $10bb. Turn: Tc — BB might have picked up a pair (Tx) or a straight draw (JQ, J9). You now bet 7bb for value. BB calls.',
        prompt: 'Turn Tc — BB may have improved with Tx. You bet for value. BB calls. Setting up the river.',
        options: [
          { id: 'continue', label: 'Note: BB called turn — proceed to river', quality: 'perfect', evLoss: 0, coaching: 'BB called the turn — they have Tx, Qx, or a draw. The pot is building. Set up the river overbet.' },
        ],
      },
      {
        street: 'river',
        board: ['Qd', '7d', '2h', 'Tc', '8h'],
        context: 'BB calls turn. Pot $24bb. River: 8h — a near-blank. BB checks. You have the flush (best possible hand excluding a higher flush).',
        prompt: 'River 8h. BB called the turn and checked. You have a king-high flush — near the top of possible hands. The pot is $24bb. BB has committed to multiple streets. Now is the moment to overbet for maximum value.',
        options: [
          { id: 'bet-standard', label: 'Bet 16bb (67% pot)', quality: 'good', evLoss: 3.0, coaching: 'Standard river bet extracts value but leaves significant money on the table. With a near-nut flush after slow-playing, an overbet is superior.' },
          { id: 'overbet', label: 'Overbet 28bb (117% pot)', quality: 'perfect', evLoss: 0, coaching: 'Overbet the river with your flush. You slow-played specifically to allow BB to improve. BB called the turn — they have a pair or draw that may call a large bet. Your flush is near-invincible (only Ad-Xd, Jd-Xd beat you). Overbet to extract maximum value from BB\'s committed range.' },
          { id: 'check', label: 'Check (induce)', quality: 'mistake', evLoss: 5.5, coaching: 'Checking the river with a flush on a non-threatening board after slow-playing is a value error. BB checked — they won\'t bluff. You must bet to extract value.' },
        ],
      },
    ],
  },

  // ── dyn-n46: BB TPTK must bet turn to deny equity ─────────────────────────
  {
    id: 'dyn-n46-bb-tptk-equity-denial-turn',
    title: 'BB TPTK — Must Bet Turn to Deny Free Card on Draw-Heavy Board',
    description: 'You defend BB with AsQs. Flop A-T-7 with two suits — many draws. You must bet the turn to deny a free card and protect your TPTK.',
    difficulty: 'advanced',
    category: 'Equity Denial',
    gameType: 'cash',
    format: '6-max',
    heroPosition: 'BB',
    villainPosition: 'BTN',
    heroCards: ['As', 'Qs'],
    effectiveStack: 100,
    stakes: '$1/$2',
    summary: '',
    tags: [],
    steps: [
      {
        street: 'preflop',
        board: [],
        context: 'Folds to BTN who raises to $5. SB folds. BB (you) calls.',
        prompt: 'AsQs in BB — premium hand. Call or 3-bet vs BTN?',
        options: [
          { id: 'call', label: 'Call $3', quality: 'good', evLoss: 0.4, coaching: 'Calling AQs is fine. You can trap BTN\'s worse aces and broadway hands.' },
          { id: '3bet', label: '3-bet to $16', quality: 'perfect', evLoss: 0, coaching: '3-betting AQs from BB is optimal — builds value and denies equity to BTN\'s marginal hands.' },
        ],
      },
      {
        street: 'flop',
        board: ['Ah', 'Th', '7c'],
        context: 'Pot $10bb. Flop: Ah Th 7c — wet board with heart draw. BTN checks. You bet 6bb for value. BTN calls.',
        prompt: 'TPTK on A-T-7 with heart draw. BTN checks and you bet. BTN calls. The turn is critical — this board is extremely draw-heavy.',
        options: [
          { id: 'continue', label: 'Note: BTN called flop — proceed to turn', quality: 'perfect', evLoss: 0, coaching: 'BTN called with Tx, 7x, flush draws (hearts), and straight draws (89h, 98). You must bet the turn to deny free cards.' },
        ],
      },
      {
        street: 'turn',
        board: ['Ah', 'Th', '7c', '6d'],
        context: 'Pot $22bb. Turn: 6d — adds 8-9 gutshot (5-6-7-8 and 6-7-8-9) to the board. You act first OOP.',
        prompt: 'Turn 6d adds straight draw potential to an already-wet board. You have TPTK OOP. You must bet to deny equity to flush draws (9 outs), straight draws, and combo draws. What is the correct action?',
        options: [
          { id: 'check', label: 'Check (pot control OOP)', quality: 'mistake', evLoss: 5.5, coaching: 'Checking TPTK on a draw-heavy board is a critical mistake. Flush draws (9 outs = 18% equity per card), straight draws, and combo draws all get a free card. Checking gives them free equity — you are literally paying them to outdraw you.' },
          { id: 'bet-large', label: 'Bet 16bb (73% pot)', quality: 'perfect', evLoss: 0, coaching: 'Bet large on the turn. A-T-7-6 with draws everywhere demands a large bet to deny equity. Your TPTK is the best hand now — charge flush draws (they need 26% equity, giving them ~18%). Extract value from made hands and force draws to pay a premium.' },
          { id: 'bet-small', label: 'Bet 7bb (32% pot)', quality: 'good', evLoss: 2.0, coaching: 'Small turn bet is too cheap. Flush draws get correct odds to call (18% equity vs. 24% needed at 32% pot bet). Size up to deny equity properly.' },
        ],
      },
    ],
  },

  // ── dyn-n47: BB river check-raise bluff (rare spot) ──────────────────────
  {
    id: 'dyn-n47-bb-river-checkraise-bluff',
    title: 'BB River Check-Raise Bluff — Rare but Correct Spot',
    description: 'You defend BB with 5h6h. The board runs 9-Q-3-2-K — you missed all draws. BTN bets small on the river. Is this the rare correct spot for a river check-raise bluff?',
    difficulty: 'advanced',
    category: 'River Bluffing',
    gameType: 'cash',
    format: '6-max',
    heroPosition: 'BB',
    villainPosition: 'BTN',
    heroCards: ['5h', '6h'],
    effectiveStack: 100,
    stakes: '$1/$2',
    summary: '',
    tags: [],
    steps: [
      {
        street: 'preflop',
        board: [],
        context: 'Folds to BTN who raises to $5. SB folds. BB (you) calls.',
        prompt: '5h6h in BB — suited connector. Defend vs BTN.',
        options: [
          { id: 'call', label: 'Call $3', quality: 'perfect', evLoss: 0, coaching: '56s is a clear BB defend with implied odds and connectivity.' },
        ],
      },
      {
        street: 'flop',
        board: ['9c', 'Qd', '3h'],
        context: 'Pot $10bb. Flop: 9c Qd 3h. You check. BTN c-bets 6bb. You call (gutshot 5-6-7-8 needs 7 and 8 both? No: 56 on 9Q3 has no draw). You actually have no draw here — bad call but proceed.',
        prompt: '56h on Q-9-3 — you have nothing. BTN c-bets. Fold or float?',
        options: [
          { id: 'call', label: 'Call $6 (float with equity hope)', quality: 'good', evLoss: 0.8, coaching: 'Floating with 56h on Q-9-3 is borderline — you have backdoor straight and flush draws. Marginal call.' },
          { id: 'fold', label: 'Fold', quality: 'perfect', evLoss: 0, coaching: 'Folding 56h on Q-9-3 is the correct play — you have almost no equity. This puzzle proceeds assuming you called to demonstrate the river concept.' },
        ],
      },
      {
        street: 'turn',
        board: ['9c', 'Qd', '3h', '2s'],
        context: 'You called flop. Pot $22bb. Turn: 2s — blank. BTN checks back (showed weakness). You check also.',
        prompt: 'BTN checked back the turn — showing significant weakness. BB\'s range now includes all hands that couldn\'t bet twice. Proceed to river.',
        options: [
          { id: 'continue', label: 'Note: both checked turn — proceed to river', quality: 'perfect', evLoss: 0, coaching: 'BTN checking the turn caps their range significantly. On the river, BB can attack with a check-raise bluff against BTN\'s weakened range.' },
        ],
      },
      {
        street: 'river',
        board: ['9c', 'Qd', '3h', '2s', 'Ks'],
        context: 'Pot $22bb. River: Ks. BTN bets 8bb (small, 36% pot). You have 5h6h — nothing. This is the rare check-raise bluff spot.',
        prompt: 'BTN bet small on the river after checking the turn. This small sizing often indicates a blocking bet or thin value. You missed everything. Is this the correct spot to check-raise bluff the river?',
        options: [
          { id: 'fold', label: 'Fold (nothing to bluff with)', quality: 'good', evLoss: 0.5, coaching: 'Folding is fine — you have no hand and no blockers. River check-raise bluffs are rare plays.' },
          { id: 'call', label: 'Call $8 (hero call)', quality: 'mistake', evLoss: 2.0, coaching: 'Calling with six-high is a mistake — you lose to every made hand BTN can bet for value.' },
          { id: 'check-raise', label: 'Check-raise to $28 (river bluff)', quality: 'perfect', evLoss: 0, coaching: 'This is the rare correct river check-raise bluff spot. BTN bet small after checking the turn — their range is capped (no strong value hands bet small here). A check-raise to ~3.5x their small bet represents a strong hand (set, KQ, Kx two pair) that slow-played through. BTN\'s small sizing makes them unable to call a large check-raise without a strong hand — and their range, capped by the turn check, rarely has one.' },
        ],
      },
    ],
  },

  // ── dyn-n48: Population exploit — opponent over-folds rivers ─────────────
  {
    id: 'dyn-n48-population-exploit-river-fold',
    title: 'Population Exploit — Opponent Over-Folds Rivers. Bluff More.',
    description: 'Your opponent folds 60% on rivers when called on the turn (vs. MDF of ~43%). This is a significant deviation — you should exploit by bluffing more rivers than GTO suggests.',
    difficulty: 'advanced',
    category: 'Exploitative Play',
    gameType: 'cash',
    format: '6-max',
    heroPosition: 'BTN',
    villainPosition: 'BB',
    heroCards: ['Kc', 'Jc'],
    effectiveStack: 100,
    stakes: '$1/$2',
    summary: '',
    tags: [],
    steps: [
      {
        street: 'preflop',
        board: [],
        context: 'Folds to BTN. You raise to $5. SB folds. BB calls. Note: you have a read that BB folds to river bets 60% of the time when they call the turn.',
        prompt: 'KcJc on BTN — strong hand. BB defends. You have a population read: BB over-folds rivers. Plan to exploit.',
        options: [
          { id: 'continue', label: 'Note: standard open — proceed to flop', quality: 'perfect', evLoss: 0, coaching: 'KJs is a premium BTN open. The key here is the population read: BB folds 60% to river bets when called on turn (vs. MDF of ~43%). This means every river bluff you fire has higher EV than GTO predicts.' },
        ],
      },
      {
        street: 'flop',
        board: ['Ks', '8h', '3d'],
        context: 'BB checks. Pot $10bb. Flop: Ks 8h 3d. You c-bet 6bb. BB calls.',
        prompt: 'You flopped top pair with KcJc. BB calls. The population read says BB will fold rivers frequently. Plan your line.',
        options: [
          { id: 'continue', label: 'Note: BB called flop — proceed to turn', quality: 'perfect', evLoss: 0, coaching: 'BB calls with Kx, 8x, and draws. When you get to the river, if you have a weaker hand or bluff, fire confidently — BB over-folds there.' },
        ],
      },
      {
        street: 'turn',
        board: ['Ks', '8h', '3d', '7c'],
        context: 'Pot $22bb. Turn: 7c — blank. You bet 14bb. BB calls. Now the exploit read becomes actionable.',
        prompt: 'You barreled the turn for value. BB called. River is coming. Remember: BB folds 60% to river bets (vs. MDF 43%). This is a +17% exploit edge. How do you think about the river?',
        options: [
          { id: 'continue', label: 'Note: BB called turn — proceed to river', quality: 'perfect', evLoss: 0, coaching: 'BB called twice. Standard river strategy: bet with value hands and some bluffs. But with a 60% fold rate (vs. 43% MDF), you should bluff MORE than GTO — adding extra bluff combos that would normally be checks.' },
        ],
      },
      {
        street: 'river',
        board: ['Ks', '8h', '3d', '7c', '4h'],
        context: 'Pot $50bb. River: 4h — blank. BB checks. You have KcJc — top pair, J kicker. But suppose your hand were weaker (KcJc missed draw version). BB folds 60% to river bets (MDF = ~43% for 67% pot bet). You are getting +17% edge on bluffs.',
        prompt: 'BB folds 60% to river bets. GTO MDF for 67% pot bet = 43%. So 60% fold rate = +17% exploit. You have KcJc (top pair or bluff depending on scenario). What is the exploitative play?',
        options: [
          { id: 'check', label: 'Check (let BB showdown)', quality: 'mistake', evLoss: 3.5, coaching: 'Checking against an opponent who over-folds rivers is a large EV error. You have an identified exploit — fire the river and take advantage of their over-folding. Check only the very bottom of your range.' },
          { id: 'bet-standard', label: 'Bet 32bb (64% pot)', quality: 'good', evLoss: 1.0, coaching: 'Standard bet is fine and profits from the over-fold. However, you can go bigger to maximize the exploit.' },
          { id: 'bet-large', label: 'Bet 45bb (90% pot — exploit sizing)', quality: 'perfect', evLoss: 0, coaching: 'Bet large to maximize the exploit. BB folds 60% regardless of sizing in this read. Larger sizing extracts more when called AND folds at the same rate. When opponents over-fold, size up — each dollar bet returns more than its GTO expectation.' },
        ],
      },
    ],
  },

  // ── dyn-n49: BTN mixed strategy turn — medium-strength hand ──────────────
  {
    id: 'dyn-n49-btn-mixed-strategy-turn',
    title: 'BTN Mixed Strategy Turn — Betting 50% and Checking 50% is GTO',
    description: 'You open BTN with Ah9h. Flop A-7-3 rainbow. Turn 5. Your A9 (TPTK) on a dry board is in the GTO "mixed" zone — checking half the time and betting half is near-optimal.',
    difficulty: 'advanced',
    category: 'GTO Concepts',
    gameType: 'cash',
    format: '6-max',
    heroPosition: 'BTN',
    villainPosition: 'BB',
    heroCards: ['Ah', '9h'],
    effectiveStack: 100,
    stakes: '$1/$2',
    summary: '',
    tags: [],
    steps: [
      {
        street: 'preflop',
        board: [],
        context: 'Folds to BTN. You raise to $5. SB folds. BB calls.',
        prompt: 'Ah9h on BTN — suited ace. BB defends.',
        options: [
          { id: 'continue', label: 'Note: standard open — proceed to flop', quality: 'perfect', evLoss: 0, coaching: 'A9s is a standard BTN open with top-pair and flush potential.' },
        ],
      },
      {
        street: 'flop',
        board: ['As', '7d', '3c'],
        context: 'BB checks. Pot $10bb. Flop: As 7d 3c — dry rainbow. You c-bet 4bb (small range bet). BB calls.',
        prompt: 'Small range bet on a dry A-7-3 board. BB calls. Proceeding to the turn.',
        options: [
          { id: 'continue', label: 'Note: BB called flop — proceed to turn', quality: 'perfect', evLoss: 0, coaching: 'BB calls with Ax (weaker kicker), 7x, 3x, and underpairs. Your A9 is likely best.' },
        ],
      },
      {
        street: 'turn',
        board: ['As', '7d', '3c', '5h'],
        context: 'Pot $18bb. Turn: 5h — blank (adds wheel draw 2-3-4-5-6, but none of those hands are likely). BB checks.',
        prompt: 'Blank 5h turn. BB checks. You have Ah9h — TPTK on a dry A-7-3-5 board. GTO analysis: A9 is in the "mixed" zone where checking ~50% and betting ~50% yields near-equal EV. What does this tell you about the decision?',
        options: [
          { id: 'bet', label: 'Bet 10bb (56% pot)', quality: 'perfect', evLoss: 0, coaching: 'Betting is fine — you have TPTK and this is a value bet. In the mixed zone, both actions are near-equal EV. Betting extracts value from BB\'s weaker pairs and sets up a river extraction. Choose to bet when you prefer building the pot.' },
          { id: 'check', label: 'Check back (pot control)', quality: 'perfect', evLoss: 0, coaching: 'Checking is also correct in this spot. A9 on a dry A-7-3-5 board is strong but the turn is a blank. Checking allows you to protect your checking range and induce bluffs on the river. In GTO terms, both actions are within ~0.5bb EV of each other.' },
          { id: 'jam', label: 'Jam $95bb (overkill)', quality: 'mistake', evLoss: 5.5, coaching: 'Jamming TPTK on a dry board with a large stack is a massive mistake. You fold out all of BB\'s weaker hands while only getting called by better hands.' },
        ],
      },
    ],
  },

  // ── dyn-n50: BTN river overbet theory — nut advantage ────────────────────
  {
    id: 'dyn-n50-btn-river-overbet-nut-advantage',
    title: 'BTN River Overbet Theory — Nut Advantage Dominates Smaller Sizes',
    description: 'You open BTN with AdKd and the board runs A-K-7-2-9 rainbow. You have top two pair. On this river, your range has a massive nut advantage over BB. Overbet to exploit it.',
    difficulty: 'advanced',
    category: 'River Betting',
    gameType: 'cash',
    format: '6-max',
    heroPosition: 'BTN',
    villainPosition: 'BB',
    heroCards: ['Ad', 'Kd'],
    effectiveStack: 100,
    stakes: '$1/$2',
    summary: '',
    tags: [],
    steps: [
      {
        street: 'preflop',
        board: [],
        context: 'Folds to BTN. You raise to $5. SB folds. BB calls.',
        prompt: 'AdKd on BTN — the best drawing hand. BB defends. Plan for extracting maximum value.',
        options: [
          { id: 'continue', label: 'Note: standard open — proceed to flop', quality: 'perfect', evLoss: 0, coaching: 'AKs is the second-best starting hand. Your goal: flop top pair or two pair and extract three streets of maximum value.' },
        ],
      },
      {
        street: 'flop',
        board: ['Ah', 'Kc', '7s'],
        context: 'BB checks. Pot $10bb. Flop: Ah Kc 7s — you flopped top two pair! BB checks.',
        prompt: 'Top two pair on A-K-7 dry rainbow. BB checks. Build the pot or slow-play?',
        options: [
          { id: 'bet-small', label: 'Bet 4bb (40% pot — range bet)', quality: 'perfect', evLoss: 0, coaching: 'Small range bet. On A-K-7 dry, you want to keep BB\'s entire range in. Small bet achieves this while building the pot slowly for larger bets on later streets.' },
          { id: 'bet-large', label: 'Bet 8bb (80% pot)', quality: 'good', evLoss: 0.8, coaching: 'Large bet on a dry board folds too much of BB\'s range. Small bet extracts more total EV.' },
        ],
      },
      {
        street: 'turn',
        board: ['Ah', 'Kc', '7s', '2d'],
        context: 'BB calls flop. Pot $18bb. Turn: 2d — blank. You bet 12bb. BB calls.',
        prompt: 'Blank turn, you barrel with top two pair. BB calls twice. River coming.',
        options: [
          { id: 'continue', label: 'Note: BB called turn — proceed to river', quality: 'perfect', evLoss: 0, coaching: 'BB called twice on A-K-7-2 — they have a strong made hand. The river is where nut-advantage theory becomes critical.' },
        ],
      },
      {
        street: 'river',
        board: ['Ah', 'Kc', '7s', '2d', '9h'],
        context: 'Pot $42bb. River: 9h — blank. BB checks. You have AdKd — top two pair on A-K-7-2-9 rainbow. This is a nut-advantage spot: your range (BTN opening, c-betting, barreling) contains AA, KK, AK, A7, K7, and other premium holdings. BB\'s defending range cannot have these combos at the same frequency.',
        prompt: 'River 9h on a dry A-K-7-2-9 board. BB checked. Key concept: BTN has a massive NUT ADVANTAGE — BTN can have AA, KK, AK (two pair), A7/K7 (two pair) all at full frequency. BB defending blind cannot match this. When the hero has nut advantage, theory says overbetting dominates smaller sizes. How do you bet?',
        options: [
          { id: 'bet-standard', label: 'Bet 24bb (57% pot)', quality: 'good', evLoss: 3.5, coaching: 'Standard river bet extracts value but underperforms in a nut-advantage spot. When your range dominates at the top, you should bet larger to exploit BB\'s inability to call with the nuts.' },
          { id: 'bet-large', label: 'Bet 36bb (86% pot)', quality: 'good', evLoss: 1.5, coaching: 'Large bet is better. With nut advantage, you can size up and BB cannot construct a proper defense (they don\'t have enough nut hands to profitably call large bets).' },
          { id: 'overbet', label: 'Overbet 55bb (131% pot)', quality: 'perfect', evLoss: 0, coaching: 'Overbet river. This is the core principle of nut-advantage theory: when your range contains many more nut hands than your opponent\'s, overbets dominate smaller sizes. BB cannot call a 130% pot bet with enough nut hands to prevent you from exploiting them. Their range (weakened by having to call multiple streets) cannot profitably call against your strong top end. Extract maximum with your top two pair and set up calls from the Ax and Kx hands in BB\'s range.' },
        ],
      },
    ],
  },

]
