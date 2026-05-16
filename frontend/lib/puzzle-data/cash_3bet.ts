import type { Puzzle } from '../puzzle-types'

export const PUZZLES_CASH_3BET: Puzzle[] = [

  // ── 3bp-n01: BTN AA — value 3-bet, c-bet, turn barrel, river jam ─────────
  {
    id: '3bp-n01-btn-aa-3bet-value',
    title: 'BTN Aces — 3-Bet Value and Three Streets',
    description: 'CO opens and you 3-bet AA from BTN. Navigate three postflop streets as IP in a 3-bet pot, extracting maximum value.',
    difficulty: 'beginner',
    category: '3-Bet Pots',
    gameType: 'cash',
    format: '6-max',
    heroPosition: 'BTN',
    villainPosition: 'CO',
    heroCards: ['As', 'Ah'],
    effectiveStack: 100,
    stakes: '$1/$2',
    summary: '',
    tags: [],
    steps: [
      {
        street: 'preflop',
        board: [],
        context: 'Folds to CO who raises to $5. BTN (you) 3-bets to $17. SB/BB fold. CO calls.',
        prompt: 'AA in the BTN vs CO open. How do you size your 3-bet?',
        options: [
          { id: 'call', label: 'Just call (slowplay)', quality: 'mistake', evLoss: 4.5, coaching: 'Cold-calling AA from BTN is a significant mistake. You invite SB/BB to come along, you don\'t build the pot, and you give CO excellent implied odds with their wide opening range. Always 3-bet AA.' },
          { id: '3bet-small', label: '3-bet to $14 (2.8x)', quality: 'good', evLoss: 0.6, coaching: 'A small 3-bet keeps CO\'s range wide but doesn\'t build as big a pot as a standard sizing.' },
          { id: '3bet-standard', label: '3-bet to $17 (3.4x)', quality: 'perfect', evLoss: 0, coaching: 'Standard 3-bet sizing. Gets value from CO\'s wide calling range while building a pot. Pot will be ~35bb heading to the flop.' },
        ],
      },
      {
        street: 'flop',
        board: ['Kd', '7h', '2c'],
        context: 'CO calls 3-bet. Pot $35bb. Flop: Kd7h2c — dry. CO checks. You are IP.',
        prompt: 'Dry Kd7h2c. CO checks to you. You have AA. Do you c-bet for value, check back to control pot, or bet large?',
        options: [
          { id: 'check', label: 'Check back', quality: 'mistake', evLoss: 3.2, coaching: 'Checking back AA on a dry K-high flop is a mistake. CO\'s range includes KQo, KJs, QQ, JJ — all of which will call a c-bet and are dominated by your hand. You must bet to extract value.' },
          { id: 'bet-small', label: 'Bet 12bb (34% pot)', quality: 'good', evLoss: 0.7, coaching: 'Small bet is fine to keep CO\'s range wide. On a dry board, CO is more likely to call small with medium pairs. But a larger sizing extracts more from KX, QQ, JJ.' },
          { id: 'bet-large', label: 'Bet 25bb (71% pot)', quality: 'perfect', evLoss: 0, coaching: 'Large c-bet is optimal in 3-bet pots on dry boards. CO\'s range (AQ, KQ, QQ, JJ) will call a large sizing — they have pot-committed implied odds. Building the pot now sets up a turn barrel and river jam.' },
        ],
      },
      {
        street: 'turn',
        board: ['Kd', '7h', '2c', 'Jc'],
        context: 'CO calls flop. Pot $85bb. Turn: Jc. CO checks. Stacks ~$57bb.',
        prompt: 'Jc turn — CO could have KJ, QJ, or backdoor clubs now. CO checks. Your AA is still likely best. Do you barrel or pot control?',
        options: [
          { id: 'check', label: 'Check (scared of KJ, QQ)', quality: 'mistake', evLoss: 4.8, coaching: 'Checking AA on the turn after a large flop bet is a big mistake. You built this pot to barrel off. CO checking doesn\'t mean they have a monster — they could have KQ, QQ, JJ, or a one-pair hand. Keep betting.' },
          { id: 'bet-half', label: 'Bet 28bb (33% of pot, ~half remaining stack)', quality: 'good', evLoss: 1.2, coaching: 'Medium sizing keeps CO in with their range. Fine play, but sets up an awkward river jam sizing.' },
          { id: 'jam', label: 'Jam $57bb all-in', quality: 'perfect', evLoss: 0, coaching: 'Jam the turn. Stacks are ~67bb deep, pot is $85bb — a turn jam is the natural continuation. CO called a large flop bet. They have KQ, QQ, KJ or worse. All those hands will call a jam. Lock up the value.' },
        ],
      },
    ],
  },

  // ── 3bp-n02: CO QQ — 3-bet, bluff-catch on A-high board ─────────────────
  {
    id: '3bp-n02-co-qq-bluffcatcher',
    title: 'CO Queens — 3-Bet Pot Bluff-Catcher on Ace-High Board',
    description: 'You 3-bet QQ from CO vs BTN open. An ace lands on the flop. Navigate the classic "do they have it?" decision tree.',
    difficulty: 'intermediate',
    category: '3-Bet Pots',
    gameType: 'cash',
    format: '6-max',
    heroPosition: 'CO',
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
        context: 'BTN raises to $5. You 3-bet CO to $17. BTN calls. Pot $35bb.',
        prompt: 'QQ from CO vs BTN open. You 3-bet. BTN calls. Standard so far — now prepare for an ace-high flop.',
        options: [
          { id: 'continue', label: 'Note: standard 3-bet — proceed to flop', quality: 'perfect', evLoss: 0, coaching: 'QQ is a clear 3-bet from CO vs BTN open. Calling is too passive with the second-best starting hand.' },
        ],
      },
      {
        street: 'flop',
        board: ['Ac', '7d', '3s'],
        context: 'Pot $35bb. Flop: Ac7d3s. You act first OOP.',
        prompt: 'Ace-high dry flop. You 3-bet QQ and the ace landed. Do you c-bet or check to BTN?',
        options: [
          { id: 'bet', label: 'Bet 20bb (57% pot)', quality: 'perfect', evLoss: 0, coaching: 'C-bet this flop. As the 3-bettor OOP, your range is capped at AA/KK/AK — you have many strong hands here. BTN will often fold small pairs, KQ, and bluffs. A c-bet forces BTN to make a decision and protects your range.' },
          { id: 'check-fold', label: 'Check-fold (ace scared me)', quality: 'mistake', evLoss: 6.8, coaching: 'Checking with the intention to fold to any bet is a disaster with QQ. BTN will c-bet the flop IP almost always when checked to — and many of those bets are bluffs or thin value. Check-folding QQ OOP concedes too much equity.' },
          { id: 'check-call', label: 'Check-call', quality: 'good', evLoss: 1.5, coaching: 'Check-calling is reasonable as a bluff-catcher. You let BTN barrel air into you. The issue: BTN checks back many weak hands that you beat, and c-betting keeps them from realizing equity for free.' },
        ],
      },
      {
        street: 'turn',
        board: ['Ac', '7d', '3s', '9h'],
        context: 'BTN calls flop c-bet. Pot $75bb. Turn: 9h. You act first OOP.',
        prompt: 'BTN called your flop c-bet. 9h turn adds no obvious draws. You act first. Does BTN have an ace?',
        options: [
          { id: 'check-fold', label: 'Check-fold', quality: 'mistake', evLoss: 8.2, coaching: 'Folding after one call on the turn is giving up massive equity. BTN\'s range calling your 3-bet + flop c-bet includes many hands you beat: KK, JJ, TT, AT (TPTK thinking they\'re ahead), 77, 33 (sets but you beat those). Turn check-fold is a large mistake.' },
          { id: 'check-call', label: 'Check-call (bluff-catch mode)', quality: 'perfect', evLoss: 0, coaching: 'Switch to check-call mode. You\'ve established your range by c-betting the flop. Now check and use QQ as a bluff-catcher. BTN will barrel with KJ, KQ, KT (which missed), and even naked bluffs. Call one more street and reassess the river.' },
          { id: 'barrel', label: 'Barrel 40bb (second barrel)', quality: 'good', evLoss: 1.8, coaching: 'Second barreling QQ is fine if BTN is a frequent folder, but you risk being called by AX or a trap from a set. Checking and calling keeps you in as a bluff-catcher at lower risk.' },
        ],
      },
      {
        street: 'river',
        board: ['Ac', '7d', '3s', '9h', '2d'],
        context: 'BTN checks turn back (after you check-called). Pot $75bb. River: 2d — blank. BTN bets $45bb (60% pot).',
        prompt: 'BTN checked turn, now bets large on the blank river. This is a polarized bet. Do you call with QQ or fold?',
        options: [
          { id: 'fold', label: 'Fold QQ (too scary)', quality: 'mistake', evLoss: 7.5, coaching: 'Folding QQ to a river bet in a 3-bet pot after turning down two streets is a significant mistake. BTN checked the turn — they showed weakness. River bets after a checked turn are often thin value or bluffs. QQ beats all of BTN\'s bluffs and any hand without an ace. Call.' },
          { id: 'call', label: 'Call $45', quality: 'perfect', evLoss: 0, coaching: 'Call. BTN checked the turn (showed weakness), now bets the river. This is a common "give up and fire" pattern. Your QQ beats AJ, AT, KK, JJ, TT, 99, and all of BTN\'s missed bluffs. You need to win ~32% of the time to call — you\'re winning far more than that.' },
          { id: 'raise', label: 'Raise all-in', quality: 'mistake', evLoss: 3.2, coaching: 'Raising QQ on an A-high board as a bluff-raise doesn\'t make sense — you have showdown value. Just call and see their hand.' },
        ],
      },
    ],
  },

  // ── 3bp-n03: BB AK — 3-bet, hit top pair, 3-street value OOP ────────────
  {
    id: '3bp-n03-bb-ak-3bet-oop',
    title: 'BB AK — 3-Bet Pot, Hit Top Pair OOP',
    description: 'You 3-bet AK from BB vs BTN open. Flop gives you top pair. Play three streets of value in a large 3-bet pot from OOP.',
    difficulty: 'beginner',
    category: '3-Bet Pots',
    gameType: 'cash',
    format: '6-max',
    heroPosition: 'BB',
    villainPosition: 'BTN',
    heroCards: ['As', 'Kd'],
    effectiveStack: 100,
    stakes: '$1/$2',
    summary: '',
    tags: [],
    steps: [
      {
        street: 'preflop',
        board: [],
        context: 'BTN raises to $5. SB folds. BB (you) 3-bets to $18. BTN calls. Pot $37bb.',
        prompt: 'AKo in the BB vs BTN open. You 3-bet. Size your 3-bet.',
        options: [
          { id: 'call', label: 'Call $3 (flat)', quality: 'good', evLoss: 1.2, coaching: 'Calling AKo OOP is a weaker play. You have one of the top hands in your range — 3-betting builds the pot and denies BTN equity from their wide opening range.' },
          { id: '3bet', label: '3-bet to $18', quality: 'perfect', evLoss: 0, coaching: 'Standard 3-bet. AKo plays well in large pots even OOP. BTN calls wide and you dominate their AQ, KQ, AJ range. Build the pot preflop.' },
        ],
      },
      {
        street: 'flop',
        board: ['As', '9h', '4d'],
        context: 'Pot $37bb. Flop: As9h4d — dry. You act first OOP.',
        prompt: 'You flopped top pair, top kicker on As9h4d. You 3-bet OOP and hit — now what?',
        options: [
          { id: 'check', label: 'Check (protect range)', quality: 'good', evLoss: 0.9, coaching: 'Check-calling is viable and protects your checking range. But on a dry board in a 3-bet pot, BTN will check back IP often with medium-strength hands. Leading is slightly better.' },
          { id: 'bet-small', label: 'Bet 12bb (32% pot)', quality: 'good', evLoss: 0.5, coaching: 'Small c-bet keeps BTN\'s range wide. In 3-bet pots, small bets work well to extract from medium-strength hands.' },
          { id: 'bet-large', label: 'Bet 25bb (68% pot)', quality: 'perfect', evLoss: 0, coaching: 'Lead large. You have TPTK in a 3-bet pot — stack sizes are shallow relative to pot. BTN has KK, QQ, AQ, KQ — all of which call a large flop bet. Build the pot to set up the turn jam.' },
        ],
      },
      {
        street: 'turn',
        board: ['As', '9h', '4d', 'Tc'],
        context: 'BTN calls flop. Pot $87bb. Turn: Tc. Stacks ~$56bb. You act first OOP.',
        prompt: 'Tc turn — adds KQJ and JQ8 straight draws. BTN called your large flop bet. The effective stack is now ~56bb into $87bb pot. Do you jam now?',
        options: [
          { id: 'check', label: 'Check-call', quality: 'good', evLoss: 2.1, coaching: 'Check-calling is fine but loses value vs hands that check back (KK, QQ). You want to build the pot toward a river jam. Leading the turn keeps pressure on.' },
          { id: 'bet-half', label: 'Bet 25bb (29% pot, set up jam)', quality: 'good', evLoss: 0.8, coaching: 'Betting to set up a river jam works, but with $56bb behind and an $87bb pot, just jamming the turn is more direct.' },
          { id: 'jam', label: 'Jam $56bb all-in', quality: 'perfect', evLoss: 0, coaching: 'Jam. You have TPTK in a 3-bet pot. The stacks are set up perfectly for a turn jam — pot to stack ratio demands it. BTN has AQ, KK, QQ, 99 that all call. You\'re extracting maximum value by jamming now instead of two smaller bets.' },
        ],
      },
    ],
  },

  // ── 3bp-n04: BTN KQs — call 3-bet IP, flop two pair, navigate draws ─────
  {
    id: '3bp-n04-btn-kqs-two-pair-ip',
    title: 'BTN KQs — Call 3-Bet IP and Flop Two Pair',
    description: 'You open BTN with KhQh and BB 3-bets. You call IP. Flop gives you top two pair on a draw-heavy board. Navigate as the 3-bet caller with initiative.',
    difficulty: 'intermediate',
    category: '3-Bet Pots',
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
        context: 'You raise BTN to $5. BB 3-bets to $18. SB folds.',
        prompt: 'KhQh on BTN vs BB 3-bet. Call, 4-bet, or fold?',
        options: [
          { id: 'fold', label: 'Fold', quality: 'mistake', evLoss: 2.8, coaching: 'Folding KQs to a BB 3-bet is a mistake. You\'re IP, have a strong suited hand, and are getting good odds. KQs has excellent equity vs BB\'s 3-bet range and plays great in position.' },
          { id: 'call', label: 'Call $13', quality: 'perfect', evLoss: 0, coaching: 'Standard call. KQs plays excellently in position vs a 3-bet. You have implied odds, connectivity, and the nut flush potential. Calling is optimal over 4-betting in this spot.' },
          { id: '4bet', label: '4-bet to $45', quality: 'good', evLoss: 1.5, coaching: 'KQs can 4-bet as a bluff in some ranges, but it\'s too strong to fold and too weak to build a large pot with. Calling IP is clearly best.' },
        ],
      },
      {
        street: 'flop',
        board: ['Kd', 'Qc', '8h'],
        context: 'Pot $37bb. Flop: KdQc8h — two pair. BB checks. You are IP.',
        prompt: 'You flopped top two pair KQ on a draw-heavy board KQ8. BB checks. Bet large, bet small, or slowplay?',
        options: [
          { id: 'check', label: 'Check (slowplay)', quality: 'mistake', evLoss: 3.1, coaching: 'Slowplaying top two pair on a wet board is a mistake. KQ8 has flush draws and straight draws (JT, T9) — you must bet to charge them.' },
          { id: 'bet-small', label: 'Bet 10bb (27% pot)', quality: 'good', evLoss: 1.3, coaching: 'Small bet keeps draws in but doesn\'t charge them adequately. On KQ8 with multiple draw possibilities, a larger bet is needed.' },
          { id: 'bet-large', label: 'Bet 28bb (76% pot)', quality: 'perfect', evLoss: 0, coaching: 'Large bet. Two pair on KQ8 in a 3-bet pot demands maximum charging of all draws. BB\'s range includes AK, AA, JTs (flush+straight draw), TJ — you need to charge them immediately.' },
        ],
      },
      {
        street: 'turn',
        board: ['Kd', 'Qc', '8h', 'Jd'],
        context: 'BB calls flop. Pot $93bb. Turn: Jd — adds diamond draw, completes T9 straight. BB leads $40bb.',
        prompt: 'BB leads into you for $40bb on the Jd turn. Possible straight (T9), possible diamond flush draw. Do you raise, call, or fold?',
        options: [
          { id: 'fold', label: 'Fold two pair (scary board)', quality: 'mistake', evLoss: 12, coaching: 'Folding top two pair to a turn lead in a 3-bet pot is a massive mistake. You have KQ — a very strong hand that still beats much of BB\'s range. Fold equity matters here: you need to put pressure on draws.' },
          { id: 'call', label: 'Call $40', quality: 'good', evLoss: 2.5, coaching: 'Calling preserves your equity and keeps BB\'s bluffs in. Fine play. You see the river card without inflating the pot against potential straights.' },
          { id: 'raise', label: 'Raise to $93+ (jam)', quality: 'perfect', evLoss: 0, coaching: 'Raise/jam. You have top two pair. BB led the turn with a potential bluff (draws) or value (sets, straights). When you raise, you fold out all draws and force the best hands to commit. You have immense equity even vs JJ or T9. This is a commitment spot — jam.' },
        ],
      },
    ],
  },

  // ── 3bp-n05: BB TT — 3-bet pot, fold vs ace with SPR math ───────────────
  {
    id: '3bp-n05-bb-tt-ace-fold',
    title: 'BB Tens — 3-Bet Pot Check-Fold vs Ace',
    description: 'You 3-bet TT from BB vs BTN. An ace lands on a connected flop. Navigate a check-fold decision in a 3-bet pot with SPR math.',
    difficulty: 'intermediate',
    category: '3-Bet Pots',
    gameType: 'cash',
    format: '6-max',
    heroPosition: 'BB',
    villainPosition: 'BTN',
    heroCards: ['Tc', 'Td'],
    effectiveStack: 100,
    stakes: '$1/$2',
    summary: '',
    tags: [],
    steps: [
      {
        street: 'preflop',
        board: [],
        context: 'BTN raises to $5. SB folds. BB 3-bets to $18. BTN calls. Pot $37bb.',
        prompt: 'TT in BB vs BTN open. Do you 3-bet, call, or fold?',
        options: [
          { id: 'fold', label: 'Fold', quality: 'mistake', evLoss: 5.5, coaching: 'Folding TT BB vs BTN is a massive mistake. TT is one of the best hands you can have — always at minimum defend, usually 3-bet.' },
          { id: 'call', label: 'Call $3', quality: 'good', evLoss: 1.2, coaching: 'Calling is fine and keeps pot small. However, 3-betting TT has positive EV — it builds the pot when BTN folds and denies BTN\'s range equity.' },
          { id: '3bet', label: '3-bet to $18', quality: 'perfect', evLoss: 0, coaching: '3-betting TT vs a wide BTN opener is standard. TT is ahead of BTN\'s calling range and building the pot has significant EV.' },
        ],
      },
      {
        street: 'flop',
        board: ['Ah', '8d', '6c'],
        context: 'Pot $37bb. Flop: Ah8d6c — connected ace-high. You act first OOP.',
        prompt: 'Ace flop in a 3-bet pot. You have TT. Do you c-bet to represent AK/AA, check-fold, or check-call?',
        options: [
          { id: 'bet', label: 'C-bet 20bb (54% pot)', quality: 'good', evLoss: 0.8, coaching: 'C-betting TT on ace-high boards is standard — you have the 3-bet range advantage and BTN will fold AJ, KQ, 9s, 7s. However, if BTN calls, you\'re in a tough spot with no outs vs AX.' },
          { id: 'check-fold', label: 'Check-fold if BTN bets', quality: 'perfect', evLoss: 0, coaching: 'Check-fold is the optimal line in many solver solutions for this exact spot. Your TT has no real equity vs BTN\'s calling range of AQ, AJ, AT. With SPR ~1.7, committing with TT vs a c-bet is -EV. Check and fold to a large bet.' },
          { id: 'check-call', label: 'Check-call and barrel off', quality: 'mistake', evLoss: 4.8, coaching: 'Check-calling TT on an ace flop and calling multiple streets is a significant mistake. You\'re behind AX and drawing nearly dead. The check-fold saves your remaining stack for better spots.' },
        ],
      },
      {
        street: 'turn',
        board: ['Ah', '8d', '6c', '3s'],
        context: 'You checked flop. BTN bets 15bb. You called. Pot $67bb. Turn: 3s — blank. You act first OOP.',
        prompt: 'You called BTN\'s flop bet (perhaps looking for reads). Turn 3s changes nothing. Now you act first in a $67bb pot with TT. Check-fold or lead?',
        options: [
          { id: 'lead', label: 'Lead $25bb (bluff the turn)', quality: 'mistake', evLoss: 6.5, coaching: 'Leading the turn with TT on an ace-high board when BTN showed strength is a bluff that won\'t work. BTN\'s flop betting range is heavily weighted toward AX and strong hands. Your bluff has no fold equity.' },
          { id: 'check-fold', label: 'Check-fold', quality: 'perfect', evLoss: 0, coaching: 'Check-fold is correct. You called the flop which was marginal. Now on a blank turn, BTN will barrel their AX hands and you have no outs. Cut your losses and fold. This spot has minimal equity and you saved half your stack by getting here cheaply.' },
          { id: 'check-call', label: 'Check-call again', quality: 'mistake', evLoss: 5.2, coaching: 'Calling a second barrel on an ace-high board with TT is a mistake. You\'re paying to see a river where you still have no outs. Fold now.' },
        ],
      },
    ],
  },

  // ── 3bp-n06: CO 4-bet QQ vs BTN 3-bet — commit or fold ──────────────────
  {
    id: '3bp-n06-co-qq-4bet',
    title: 'CO Queens — 4-Bet Pot vs BTN 3-Bet',
    description: 'You open CO with QQ. BTN 3-bets. Decide whether to 4-bet, call, or fold, then navigate a 4-bet pot with commitment math.',
    difficulty: 'advanced',
    category: '3-Bet Pots',
    gameType: 'cash',
    format: '6-max',
    heroPosition: 'CO',
    villainPosition: 'BTN',
    heroCards: ['Qc', 'Qs'],
    effectiveStack: 100,
    stakes: '$1/$2',
    summary: '',
    tags: [],
    steps: [
      {
        street: 'preflop',
        board: [],
        context: 'Folds to CO. You raise to $5. BTN 3-bets to $16. SB/BB fold.',
        prompt: 'QQ facing a BTN 3-bet. Do you fold, call, or 4-bet?',
        options: [
          { id: 'fold', label: 'Fold (scared of AA/KK)', quality: 'mistake', evLoss: 12, coaching: 'Folding QQ to a BTN 3-bet is a catastrophic mistake. QQ is the third-strongest hand in poker. BTN\'s 3-bet range includes AK, JJ, TT, AQs, and bluffs — you have massive equity vs all of those.' },
          { id: 'call', label: 'Call $11 (play a 3-bet pot OOP)', quality: 'good', evLoss: 1.8, coaching: 'Calling is acceptable but surrenders initiative OOP. You\'ll face c-bets on every flop. 4-betting builds the pot when they have AK/JJ/bluffs.' },
          { id: '4bet', label: '4-bet to $38', quality: 'perfect', evLoss: 0, coaching: '4-bet QQ. BTN\'s 3-bet range is wide — AK, JJ, TT, AQs, bluffs. You dominate most of it. Building the pot with QQ preflop is maximally profitable. If BTN jams, you call off — you need less than 36% equity vs their 5-bet jam range and you have much more.' },
        ],
      },
      {
        street: 'flop',
        board: ['Jh', '8s', '3d'],
        context: 'BTN calls 4-bet. Pot $77bb. Flop: Jh8s3d. Stacks ~$61bb. You act first OOP.',
        prompt: '4-bet pot, Jh8s3d flop, stacks $61bb. QQ is an overpair. SPR ~0.8 means you\'re essentially committed. Do you jam or bet-set up?',
        options: [
          { id: 'check-fold', label: 'Check-fold (hit QQ)', quality: 'mistake', evLoss: 25, coaching: 'Folding an overpair in a 4-bet pot on this board is a colossal mistake. SPR is under 1. You are mathematically committed — folding here is equivalent to throwing away 30+ bb of EV.' },
          { id: 'bet-set-up', label: 'Bet $30bb (set up river jam)', quality: 'good', evLoss: 0.5, coaching: 'Betting to set up a river jam works, but with SPR under 1, just jamming is cleaner and avoids the possibility of giving BTN a free card on the river.' },
          { id: 'jam', label: 'Jam $61bb all-in', quality: 'perfect', evLoss: 0, coaching: 'Jam. SPR under 1, you have an overpair, BTN\'s range calling a 4-bet is AK, JJ, TT, 99, maybe AA/KK. You have QQ — ahead of AK (flipped vs underpairs, crushed by AA/KK). You need to fold equity here and the jam achieves maximum pressure. Commit and ship it.' },
        ],
      },
    ],
  },

  // ── 3bp-n07: BTN JTs — combo draw OOP in 3-bet pot ──────────────────────
  {
    id: '3bp-n07-btn-jts-combo-3bet',
    title: 'BTN JTs — Combo Draw in 3-Bet Pot as Caller',
    description: 'You 3-bet JTs from BTN vs CO open. CO calls. Navigate a 3-bet pot IP with a combo draw on a wet flop.',
    difficulty: 'advanced',
    category: '3-Bet Pots',
    gameType: 'cash',
    format: '6-max',
    heroPosition: 'BTN',
    villainPosition: 'CO',
    heroCards: ['Jd', 'Ts'],
    effectiveStack: 100,
    stakes: '$1/$2',
    summary: '',
    tags: [],
    steps: [
      {
        street: 'preflop',
        board: [],
        context: 'CO raises to $5. BTN (you) 3-bets to $17. Blinds fold. CO calls.',
        prompt: 'JTs from BTN — should you 3-bet, call, or fold vs CO open?',
        options: [
          { id: 'call', label: 'Call $5 (flatting IP)', quality: 'good', evLoss: 0.8, coaching: 'Calling JTs IP is fine. You keep the pot small OOP. However, 3-betting IP with JTs as a semi-bluff has positive EV — you take the pot down preflop often and build a pot when called.' },
          { id: '3bet', label: '3-bet to $17', quality: 'perfect', evLoss: 0, coaching: '3-betting JTs IP is correct in balanced ranges. You bluff with a hand that has strong equity when called (flush draw potential, two straight draws). CO\'s calling range will make up a 3-bet pot where you have a significant range advantage.' },
          { id: 'fold', label: 'Fold', quality: 'mistake', evLoss: 2.5, coaching: 'Folding JTs IP to a CO open is a mistake. You have a premium speculative hand with the position advantage. At minimum call, preferably 3-bet.' },
        ],
      },
      {
        street: 'flop',
        board: ['9d', '8h', '2d'],
        context: 'Pot $35bb. Flop: 9d8h2d. CO checks. You are IP.',
        prompt: 'You 3-bet IP and CO checks to you on 9d8h2d. You have JdTs — open-ended straight draw + backdoor diamond draw. C-bet or check?',
        options: [
          { id: 'check', label: 'Check (take a free turn)', quality: 'mistake', evLoss: 2.2, coaching: 'Checking back in a 3-bet pot as the aggressor with a semi-bluff combo draw gives up significant fold equity. CO checked — they\'re weak. A large c-bet here can take the pot immediately or build a massive pot when called with equity.' },
          { id: 'bet-small', label: 'Bet 12bb (34% pot)', quality: 'good', evLoss: 0.9, coaching: 'Small c-bet has merit in 3-bet pots. But with 8 clean outs and the position advantage, a larger sizing earns more fold equity and builds a bigger pot when called.' },
          { id: 'bet-large', label: 'Bet 25bb (71% pot)', quality: 'perfect', evLoss: 0, coaching: 'Large c-bet. You have 8 outs to a straight plus potential diamond draw. CO checked — their range is weak-medium. A large bet folds out AX hands and 33-77 while building a pot you\'ll get paid from when you hit.' },
        ],
      },
      {
        street: 'turn',
        board: ['9d', '8h', '2d', '7c'],
        context: 'CO calls flop. Pot $85bb. Turn: 7c — you made the straight! CO checks.',
        prompt: 'You rivered a straight with Jd-Ts on 9-8-7. CO called your large flop bet and checks. How do you extract?',
        options: [
          { id: 'check', label: 'Check (fear of re-raise)', quality: 'mistake', evLoss: 8.5, coaching: 'Checking the nut straight in a large pot is a huge value leak. You need to bet — CO has pairs, two pairs, and flush draws that will call or raise (giving you a chance to jam). Never slowplay the nuts in a 3-bet pot.' },
          { id: 'bet-half', label: 'Bet 40bb (47% pot)', quality: 'good', evLoss: 2.1, coaching: 'Betting half pot is fine but undersizes given the remaining stack (~$48bb). Setting up a river jam is slightly awkward. Just jam the turn or bet large.' },
          { id: 'jam', label: 'Jam $48bb all-in', quality: 'perfect', evLoss: 0, coaching: 'Jam with the nut straight. Stacks are perfect for a turn jam in this 3-bet pot. CO called a large flop bet and checked — they have a pair, two pair, or flush draw. All of those hands call a jam here. Extract the maximum.' },
        ],
      },
    ],
  },

  // ── 3bp-n08: SB A5s — bluff 3-bet execution through three streets ────────
  {
    id: '3bp-n08-sb-a5s-bluff',
    title: 'SB A5s — 3-Bet Bluff and Execute the Barrel',
    description: 'You 3-bet A5s from SB as a balanced bluff vs BTN open. Follow through with a credible three-barrel line, leveraging your nut blocker.',
    difficulty: 'advanced',
    category: '3-Bet Pots',
    gameType: 'cash',
    format: '6-max',
    heroPosition: 'SB',
    villainPosition: 'BTN',
    heroCards: ['Ac', '5c'],
    effectiveStack: 100,
    stakes: '$1/$2',
    summary: '',
    tags: [],
    steps: [
      {
        street: 'preflop',
        board: [],
        context: 'BTN raises to $5. BB folds.',
        prompt: 'SB with Ac5c facing BTN open. 3-bet bluff, call, or fold?',
        options: [
          { id: 'fold', label: 'Fold', quality: 'mistake', evLoss: 1.5, coaching: 'Folding A5s OOP to a BTN open is fine as a pure fold but suboptimal. The ace blocks AA and AK (reducing BTN\'s value-heavy 4-bet range) and the suited nature gives backup equity. It\'s a solid 3-bet bluff candidate.' },
          { id: 'call', label: 'Call $4 (flatting OOP)', quality: 'mistake', evLoss: 1.8, coaching: 'Cold-calling OOP in the SB is a bad spot. You\'re out of position vs an IP opener with BB yet to act. 3-bet or fold is preferred to calling in the SB.' },
          { id: '3bet', label: '3-bet to $18', quality: 'perfect', evLoss: 0, coaching: '3-bet A5s as a bluff. The ace blocker reduces BTN\'s AA/AK holdings, and the suited-ness gives you backup equity when called. This is a textbook balanced 3-bet bluff candidate from the SB.' },
        ],
      },
      {
        street: 'flop',
        board: ['Kh', '9d', '4s'],
        context: 'BTN calls 3-bet. Pot $37bb. Flop: Kh9d4s. You act first OOP.',
        prompt: 'You 3-bet bluffed A5s and BTN called. Kh9d4s flop — you have nothing but a backdoor wheel draw and an ace overcard. C-bet or give up?',
        options: [
          { id: 'check-fold', label: 'Check-fold (give up bluff)', quality: 'mistake', evLoss: 5.2, coaching: 'Giving up the c-bet after a 3-bet bluff is a massive mistake. You committed $18 preflop precisely to take down the pot with follow-through aggression. This flop (K94 dry) is actually good for your 3-bet range — you "have" many AK, KK, AA hands. C-bet.' },
          { id: 'bet-small', label: 'Bet 12bb (32% pot)', quality: 'good', evLoss: 1.2, coaching: 'Small c-bet is fine and folds out BTN\'s non-king medium pairs. But a slightly larger sizing represents strength better given 3-bet pot dynamics.' },
          { id: 'bet-large', label: 'Bet 22bb (59% pot)', quality: 'perfect', evLoss: 0, coaching: 'C-bet large. Your 3-bet range is perfectly suited for K-high boards — you 3-bet AK, KK, AA. BTN will fold QJ, QT, JT, small pairs, and AQ that missed. Execute the bluff with conviction.' },
        ],
      },
      {
        street: 'turn',
        board: ['Kh', '9d', '4s', '5d'],
        context: 'BTN calls flop. Pot $81bb. Turn: 5d — you hit a pair! Also adds diamond draw. You act first OOP.',
        prompt: 'Turn 5d gives you a pair of fives. Your semi-bluff just picked up equity. Continue barreling or slow down?',
        options: [
          { id: 'check-fold', label: 'Check-fold', quality: 'mistake', evLoss: 9.5, coaching: 'Giving up now with a pair and a flush draw on the turn after two streets of investment is a critical mistake. Your equity just improved — you have 8 outs (flush) plus pair value. This is the highest-equity barrel of the hand.' },
          { id: 'bet-half', label: 'Bet 35bb (43% pot)', quality: 'good', evLoss: 1.5, coaching: 'A half-pot turn barrel is fine and keeps BTN\'s range wide for river. However, with an $81bb pot and drawing to the flush, a larger sizing sets up a river jam better.' },
          { id: 'jam', label: 'Jam all-in (~$44bb)', quality: 'perfect', evLoss: 0, coaching: 'Jam the turn. You have pair + flush draw (8 outs) for ~34% equity plus full fold equity. BTN has to call $44 into $125bb pot (~26% price) — they need strong holdings. Many of BTN\'s bluff-catchers (AJ, QJ, TT) will fold. Lock in the fold equity and go.' },
        ],
      },
    ],
  },

]
