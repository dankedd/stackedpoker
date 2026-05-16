"""
Recommendation Engine — maps detected leaks to targeted study materials.

For each PlayerLeak, we return:
  • puzzle_tags     — filter tags matching the existing puzzle dataset
  • drill_description — a custom drill exercise to practise this leak
  • gto_concept     — the key solver concept the player needs to understand
  • articles        — 2-3 study articles (concept + explanation)

The frontend uses puzzle_tags to filter the existing puzzle library and
surface the most relevant practise scenarios automatically.
"""
from __future__ import annotations

from app.models.schemas import PlayerLeak, StudyArticle, StudyRecommendation

# ── Leak → study material mapping ────────────────────────────────────────────

_RECOMMENDATIONS: dict[str, dict] = {
    "cbet_oversizing": {
        "puzzle_tags": ["SRP", "c-bet", "flop", "OOP", "IP", "sizing"],
        "puzzle_count_target": 8,
        "drill_description": (
            "Pull up 10 flop c-bet spots from your hand history. For each, classify "
            "the board as 'dry', 'semi-wet', or 'wet'. Then assign an optimal sizing "
            "bucket: dry=25–33%, semi-wet=40–55%, wet=55–75%. Compare to what you actually bet."
        ),
        "gto_concept": (
            "GTO c-bet sizing is board-texture dependent. On dry/low-connectivity boards, "
            "small sizes dominate because villain's range can't continue wide enough to justify "
            "charging more. On wet boards with many draws, larger sizing extracts from equity."
        ),
        "articles": [
            StudyArticle(
                title="C-Bet Sizing Fundamentals",
                concept="Board texture and optimal c-bet sizing",
                explanation=(
                    "The cardinal rule: bet size should match the 'wetness' of the board. "
                    "Dry boards (A72r, K54r) favour small c-bets (25–33%) at high frequency. "
                    "Wet boards (JT9dd, Q♠J♠8♥) require larger sizes (55–75%) to charge draws. "
                    "Over-sizing on dry boards folds out the medium-strength hands that pay you later."
                ),
                difficulty="beginner",
            ),
            StudyArticle(
                title="Range vs Range Equity on Different Textures",
                concept="Range advantage and c-bet frequency",
                explanation=(
                    "Solvers show PFR (preflop raiser) has range advantage on high-card boards "
                    "(A-high, K-high) because their 3bet/open range has more Ax, Kx hands. "
                    "On low-card boards, the caller's range connects more (suited connectors, "
                    "small pairs). Adjust your c-bet strategy accordingly."
                ),
                difficulty="intermediate",
            ),
            StudyArticle(
                title="Population Tendencies and Exploitative Sizing",
                concept="Deviating from GTO based on villain tendencies",
                explanation=(
                    "If your opponents rarely raise c-bets, betting slightly larger extracts "
                    "more value from their wide calling ranges. However, this exploit works only "
                    "vs passive opponents — vs active check-raisers, stick to smaller sizing "
                    "to reduce variance and maintain positional advantage."
                ),
                difficulty="advanced",
            ),
        ],
    },

    "missed_value": {
        "puzzle_tags": ["river value", "TPTK", "two pair", "value bet", "river", "SRP"],
        "puzzle_count_target": 6,
        "drill_description": (
            "Review your last 20 hands that reached the river. For each, ask: "
            "(1) Am I the best hand? (2) What hands would villain call? "
            "(3) Did I bet the right size? If you checked back a hand that villain "
            "would have called, mark it as a missed value spot."
        ),
        "gto_concept": (
            "River value extraction is the highest-EV street. When villain checks to you "
            "after calling two streets, their range is capped — they would raise with the "
            "nuts. Use large sizes (70–90% pot) to extract maximum value from their calling range."
        ),
        "articles": [
            StudyArticle(
                title="River Value Betting Mastery",
                concept="Optimal river sizing with strong hands",
                explanation=(
                    "The key question: 'What hands will villain call that I beat?' "
                    "If many hands call that you beat, bet large. Start with 60% pot "
                    "minimum on the river with any two-pair or better. Work up to "
                    "85–100% pot when villain's capped range is wide."
                ),
                difficulty="beginner",
            ),
            StudyArticle(
                title="Pot Control vs Value Extraction Trade-off",
                concept="When to bet large vs check-call on the river",
                explanation=(
                    "Bet large when: you're ahead of villain's range, villain will call "
                    "worse, you have no SDV to protect. Check when: hand has SDV vs "
                    "likely river bluffs, board is very wet and you might be beat by rivers "
                    "that gave villain a flush or straight. Don't pot-control strong hands."
                ),
                difficulty="intermediate",
            ),
            StudyArticle(
                title="Thin Value Betting and Blockers",
                concept="Maximising EV with marginal value hands",
                explanation=(
                    "Thin value hands (TPTK, over-pair on paired board) still deserve a bet "
                    "on the river when villain's calling range includes worse. Use blockers: "
                    "holding the Ace blocks villain's nut flush/straight — bet thinner. "
                    "Not holding the flush card means villain has it more often — check more."
                ),
                difficulty="advanced",
            ),
        ],
    },

    "overfold": {
        "puzzle_tags": ["BB defense", "facing cbet", "call or fold", "MDF", "pot odds"],
        "puzzle_count_target": 10,
        "drill_description": (
            "Before each fold decision, calculate pot odds: (bet / (pot + bet)) × 100 = "
            "required equity%. Then count your outs (each out ≈ 2% equity on flop, ≈ 4.5% on turn). "
            "If your equity > required%, call. Do this calculation for 20 consecutive decisions."
        ),
        "gto_concept": (
            "Minimum Defense Frequency (MDF): at a given bet size, you must defend "
            "at least MDF = 1 - (bet / pot+bet) of your range to prevent villain from "
            "profiting with pure bluffs. Folding more than 1-MDF is an automatic loss."
        ),
        "articles": [
            StudyArticle(
                title="Pot Odds and MDF Basics",
                concept="Calculating when a call is mathematically required",
                explanation=(
                    "MDF for 50% pot bet = 67% (defend 2/3 of range). "
                    "MDF for 75% pot bet = 57% (defend 57% of range). "
                    "MDF for pot bet = 50% (defend half your range). "
                    "If you fold more than (1-MDF) of your range, villain profits on every bluff."
                ),
                difficulty="beginner",
            ),
            StudyArticle(
                title="Range Construction for Defence",
                concept="Which hands to include in your defending range",
                explanation=(
                    "Build your defend range from: (1) hands with direct equity (draws, pair+draw), "
                    "(2) hands with implied odds (suited connectors, small pairs), "
                    "(3) hands that block villain's value range. Fold hands with no equity and "
                    "no blockers. Calling with blockers even at low equity has long-term value."
                ),
                difficulty="intermediate",
            ),
            StudyArticle(
                title="Exploitative Adjustments to MDF",
                concept="Deviating from GTO based on opponent tendencies",
                explanation=(
                    "Against frequent bluffers: loosen your calling range below MDF — "
                    "their bluff% is above equilibrium so you profit by calling more. "
                    "Against tight players who rarely bluff: fold more than MDF — "
                    "you're rarely getting the right price when they bet strong. "
                    "MDF is the baseline, not the fixed answer."
                ),
                difficulty="advanced",
            ),
        ],
    },

    "overcall": {
        "puzzle_tags": ["fold vs check-raise", "3bet pot", "facing 3bet", "over-pair"],
        "puzzle_count_target": 7,
        "drill_description": (
            "Tag 10 hands where you called and lost a big pot. For each, identify: "
            "(1) What was villain's likely betting range? (2) How often did you beat that range? "
            "(3) Were you getting the right price? If your equity was below the pot odds, "
            "mark it as an overcall mistake."
        ),
        "gto_concept": (
            "Continuing vs strong lines requires equity vs villain's range, not just the "
            "individual hand. Vs a check-raise, villain's range includes sets, two pairs, "
            "and strong draws. Unless you have top of your range or a powerful draw, fold."
        ),
        "articles": [
            StudyArticle(
                title="Understanding Betting Range vs Hand Strength",
                concept="Why strong-looking hands still fold to strong lines",
                explanation=(
                    "Top pair is often strong in absolute terms but weak vs strong villain actions. "
                    "A flop check-raise from OOP typically represents: sets (AA, KK, QQ on low boards), "
                    "two pairs (87 on 87x), and strong draws (nut flush draw + pair). "
                    "Middle pair rarely beats any of these — fold."
                ),
                difficulty="beginner",
            ),
            StudyArticle(
                title="Reading Villain Lines and Range Narrowing",
                concept="Reducing villain's range based on their action sequence",
                explanation=(
                    "Each action villain takes narrows their range. Call preflop + check-raise "
                    "flop = very strong made hands + strong draws. Call preflop + call flop + "
                    "bet turn = medium strength. Use action sequences to precisely place "
                    "villain on a range before deciding to call."
                ),
                difficulty="intermediate",
            ),
            StudyArticle(
                title="GTO Bluff Catchers vs Polarised Ranges",
                concept="When it's profitable to call down polarised bets",
                explanation=(
                    "Against a polarised villain range (bluffs + nuts, no medium hands), "
                    "calculate: (bluff% × pot) > (value% × bet) to see if calling is profitable. "
                    "Holding blockers to villain's nuts shifts the equity calculation significantly. "
                    "This is the fundamental framework for any call-down decision."
                ),
                difficulty="advanced",
            ),
        ],
    },

    "river_bluff": {
        "puzzle_tags": ["river bluff", "bluffing", "river", "missed draw", "air"],
        "puzzle_count_target": 6,
        "drill_description": (
            "Review 15 river spots where you checked behind. For each: "
            "(1) Did your hand have showdown value? (2) Could you represent a strong hand? "
            "(3) Would villain fold enough to make a bluff profitable? "
            "Mark spots where villain folds >40% as missed bluff opportunities."
        ),
        "gto_concept": (
            "River bluff frequency depends on bet sizing. At 75% pot, GTO requires "
            "~43% bluffs in your betting range (1.75 bluffs per 1 value bet). "
            "Best bluff hands: missed draws (no SDV), hands with blockers to villain's "
            "calling range, hands that unblock villain's folding range."
        ),
        "articles": [
            StudyArticle(
                title="When to Bluff the River",
                concept="Selecting profitable river bluff spots",
                explanation=(
                    "Bluff the river when: (1) your hand has no showdown value (missed draws), "
                    "(2) you can credibly represent a strong hand, (3) villain's calling range "
                    "is narrow (they folded many hands on previous streets). "
                    "Don't bluff with hands that might win at showdown — you're better off checking."
                ),
                difficulty="beginner",
            ),
            StudyArticle(
                title="Blocker Theory for River Bluffing",
                concept="Using blockers to select superior river bluffs",
                explanation=(
                    "Blocker = a card in your hand that reduces combos of villain's strong hands. "
                    "Hold the Ace on an Ax board: fewer combos of AK, AQ in villain's call range. "
                    "Hold a flush card: fewer combos of flush in villain's call range. "
                    "Prefer bluffs that block the nuts and unblock villain's fold range."
                ),
                difficulty="intermediate",
            ),
            StudyArticle(
                title="GTO Bluff:Value Ratios by Sizing",
                concept="Maintaining balance in your river betting range",
                explanation=(
                    "Sizing → Bluff% of betting range: "
                    "33% pot = 25% bluffs, 50% pot = 33% bluffs, 75% pot = 43% bluffs, "
                    "pot = 50% bluffs, 2x pot = 67% bluffs. "
                    "If your bluff% deviates far from equilibrium, adjust — add more bluffs or "
                    "remove some, depending on your population's calling tendencies."
                ),
                difficulty="advanced",
            ),
        ],
    },

    "preflop_3bet": {
        "puzzle_tags": ["3bet pot", "3-bet", "preflop", "IP", "QQ"],
        "puzzle_count_target": 8,
        "drill_description": (
            "Each session, track: how often do you 3-bet vs open? How often do you flat? "
            "Target: 3-bet 10–18% of facing-open situations in late position. "
            "If you're below 10%, add A2s-A5s, KQs, JTs as bluff 3-bets. "
            "If above 18%, tighten to just strong hands + a few suited bluffs."
        ),
        "gto_concept": (
            "A balanced 3-bet range must include premiums (for value) and bluffs (for balance). "
            "Suited Ax (A2s-A5s) are ideal 3-bet bluffs: they block Ax calling ranges, have "
            "strong equity when called, and make backdoor nut flushes."
        ),
        "articles": [
            StudyArticle(
                title="Building a 3-Bet Range from Scratch",
                concept="Which hands to 3-bet and why",
                explanation=(
                    "Value 3-bets: JJ+, AQs+, AKo. Bluff 3-bets: A2s-A5s (block opponent's Ax), "
                    "KQs, JTs, maybe T9s. Do NOT 3-bet: ATo, KJo, KQo (these play well as flats). "
                    "Your 3-bet range should be polarised: either strong or with good equity/bluffing value."
                ),
                difficulty="beginner",
            ),
            StudyArticle(
                title="Positional 3-Bet Frequencies",
                concept="Adapting your 3-bet range to position",
                explanation=(
                    "BTN vs CO: 3-bet ~14–18%. CO vs HJ: ~12–15%. SB vs BTN: ~14–20% (wider vs wide open). "
                    "BB vs any: 3-bet less (you have position post-flop disadvantage in SB spot, but have "
                    "good price to call). From UTG: tighten to premiums only (QQ+, AK). "
                    "Position changes the optimal 3-bet frequency significantly."
                ),
                difficulty="intermediate",
            ),
            StudyArticle(
                title="4-Bet Ranges and How to Respond",
                concept="Adjusting your 3-bet range based on opponent 4-bet frequency",
                explanation=(
                    "If villain 4-bets often: widen your value 3-bets (TT+, AJs+) and remove bluffs. "
                    "If villain never 4-bets: exploit with looser 3-bets — they're folding too much. "
                    "Against tight opponents: 3-bet mainly for value; against loose opponents: add more "
                    "bluffs to their wide opening ranges."
                ),
                difficulty="advanced",
            ),
        ],
    },

    "bb_defense": {
        "puzzle_tags": ["BB defense", "big blind", "preflop", "call or fold"],
        "puzzle_count_target": 10,
        "drill_description": (
            "Next 5 sessions: for every BB defense decision, track your VPIP from BB. "
            "Target: defend ~50–60% vs BTN opens, ~45% vs CO, ~35% vs EP. "
            "Categorise hands you fold: if you fold hands with >22% equity, widen your range."
        ),
        "gto_concept": (
            "From BB vs a 2.5x BTN open, you're getting 3.5:1 odds — you need ~22% equity to call. "
            "Most hands with a pair, suited connector, or any hand with playability meet this threshold. "
            "MDF from BB vs 2.5x = ~65% — defend the vast majority of your range."
        ),
        "articles": [
            StudyArticle(
                title="Big Blind Defense Fundamentals",
                concept="When to call vs raise vs fold from BB",
                explanation=(
                    "From BB, you get the best price of anyone. Against a 2.5bb open, calling "
                    "costs only 1.5bb into a 4bb pot — you need just 27% pot equity. "
                    "Hands worth calling: any pair, any suited hand, any connected hand 54+, "
                    "any Ax, broadway hands. Fold only truly garbage: 72o, 83o, J3o (no equity, no playability)."
                ),
                difficulty="beginner",
            ),
            StudyArticle(
                title="BB Positional Disadvantage and Post-Flop Adjustments",
                concept="Playing OOP from BB post-flop",
                explanation=(
                    "BB defends wide but plays OOP — so post-flop strategy must compensate. "
                    "Use check-raise more aggressively (you can rep the full board range). "
                    "Avoid donk-betting without strong hands. Use probe bets selectively on "
                    "good turns. The BB's edge comes from good range defence, not blind aggression."
                ),
                difficulty="intermediate",
            ),
            StudyArticle(
                title="Solving BB vs BTN with Solver Output",
                concept="Exact GTO defending ranges from the big blind",
                explanation=(
                    "Solver output for BB vs BTN 2.5x shows defend ~60% of hands, including "
                    "87o, 96s, T7s, J6s, A2o, K6s. The solver's selection criteria: pairs (all), "
                    "any suit with connector potential, and hands with two over cards. "
                    "Study one solver snapshot for BB vs BTN every week and memorise ranges."
                ),
                difficulty="advanced",
            ),
        ],
    },

    "check_raise_response": {
        "puzzle_tags": ["fold vs check-raise", "check-raise", "flop", "SRP", "3bet pot"],
        "puzzle_count_target": 7,
        "drill_description": (
            "Next session: every time you face a check-raise, categorise it as "
            "'dry board' or 'wet board'. On dry boards, fold middle pair and below. "
            "On wet boards, widen continues to include draws and top pair. "
            "Track your call%, fold% and results over 20 check-raise spots."
        ),
        "gto_concept": (
            "A flop check-raise from OOP is one of the strongest lines in poker. "
            "OOP check-raises are polarised: made strong hands + semi-bluffs (strong draws). "
            "The caller needs high equity or strong hands to continue profitably."
        ),
        "articles": [
            StudyArticle(
                title="Responding to Check-Raises",
                concept="When to call, fold, or re-raise vs a check-raise",
                explanation=(
                    "Call with: strong top pair+, flush draws, open-ended straight draws (good equity). "
                    "Fold with: middle pair, bottom pair, gutshots with no pair. "
                    "Re-raise (jam) with: sets, top two pair, combo draws on wet boards (use SPR to decide). "
                    "The check-raise is a signal of strength — respond accordingly."
                ),
                difficulty="beginner",
            ),
            StudyArticle(
                title="Check-Raise Ranges: What Villains Hold",
                concept="Modelling the check-raiser's range",
                explanation=(
                    "On A86s flop, OOP check-raise range = A8, A6, 86, A8s, 86s (two pair/sets) "
                    "+ 9Ts, 7Ts, JTs (combo draws). GTO mix includes ~30% bluffs. "
                    "On dry A72r: check-raise range is far more value-heavy (A7, A2, 77, 72). "
                    "Adjust your response to board texture when facing check-raises."
                ),
                difficulty="intermediate",
            ),
            StudyArticle(
                title="SPR and Commitment Decisions vs Check-Raises",
                concept="Stack-to-pot ratio and when to jam or fold vs check-raises",
                explanation=(
                    "Low SPR (1–2): you're pot-committed with top pair vs a check-raise — jam. "
                    "Medium SPR (3–5): need strong equity to call; fold marginal pairs. "
                    "High SPR (6+): only continue with very strong hands or combo draws. "
                    "Calculate SPR before the hand — it determines your commitment threshold."
                ),
                difficulty="advanced",
            ),
        ],
    },

    "turn_barrel": {
        "puzzle_tags": ["double barrel", "turn", "SRP", "river value", "OOP"],
        "puzzle_count_target": 6,
        "drill_description": (
            "For every flop c-bet, decide before betting: 'On which turns do I continue?' "
            "Map out: which cards improve your equity? Which improve your perceived range? "
            "Which blank the caller's draws? Bet those turns. Check and give up on turns "
            "that help the caller's range more than yours."
        ),
        "gto_concept": (
            "Second-barrel frequency should correlate with range advantage. "
            "When the turn card improves your range more than the caller's, continue at high frequency (60–75%). "
            "When the turn helps the caller (low cards on low-card boards, flush completions), "
            "reduce to 30–40% and rely on value hands only."
        ),
        "articles": [
            StudyArticle(
                title="When to Fire a Second Barrel",
                concept="Conditions for profitable turn betting",
                explanation=(
                    "Barrel when: (1) the turn improves your hand (you now have a strong draw or made hand), "
                    "(2) the turn is 'blank' — doesn't help the caller, "
                    "(3) the turn overcards your flop story (A or K arrives, fitting your opening range). "
                    "Give up when: the turn completes obvious draws or is a low card on a low board."
                ),
                difficulty="beginner",
            ),
            StudyArticle(
                title="Turn Barrel Sizing Strategy",
                concept="How to size your turn bets effectively",
                explanation=(
                    "Turn bets should be larger than flop bets when you're barreling for value: "
                    "65–80% pot to charge draws and extract from medium hands. "
                    "For bluff barrels, use 50–65% — you need fold equity but want pot control. "
                    "Avoid over-betting the turn without very strong hands — you may face a check-raise."
                ),
                difficulty="intermediate",
            ),
            StudyArticle(
                title="Merging Vs Polarising on the Turn",
                concept="When to use merged and polarised betting strategies",
                explanation=(
                    "Polarised = bet strong hands + bluffs, check medium strength. Use on wet boards "
                    "where medium hands can't call profitably anyway. "
                    "Merged = bet wide including medium strength for value and protection. Use on "
                    "dry boards where medium hands have enough equity to bet but not enough to fold out. "
                    "Identify which strategy applies before your turn c-bet decision."
                ),
                difficulty="advanced",
            ),
        ],
    },

    "stack_depth_play": {
        "puzzle_tags": ["All-in Spots", "push-fold", "tournament", "short stack"],
        "puzzle_count_target": 8,
        "drill_description": (
            "Using HoldemResources or an ICM calculator: "
            "(1) Look up your push range at exactly 15bb from BTN vs 2 opponents. "
            "(2) Look up your call range vs a CO push at 10bb from BB. "
            "Memorise these ranges. Next session, apply them and track accuracy."
        ),
        "gto_concept": (
            "Below 20bb: avoid raising-folding. Every preflop decision is shove-or-fold. "
            "The Nash equilibrium for push-fold depends on stack size, position, and "
            "opponents' calling ranges. Memorise ranges for 10bb, 15bb, 20bb from each position."
        ),
        "articles": [
            StudyArticle(
                title="Push-Fold Fundamentals for Short Stacks",
                concept="When to shove, call, or fold with <20bb",
                explanation=(
                    "At <15bb from BTN: push any pair (22+), any Ax, any two broadway cards (KJ, KQ, QJ), "
                    "and suited connectors (56s+). At <10bb: push wider — any A, any pair, K8o+. "
                    "Never raise-fold at these depths — you give free equity to 3-betters."
                ),
                difficulty="beginner",
            ),
            StudyArticle(
                title="ICM-Adjusted Push-Fold Ranges",
                concept="How ICM modifies push-fold decisions in tournaments",
                explanation=(
                    "Near the bubble, add a risk premium to all decisions. "
                    "Your chip EV push may be slightly positive but negative in ICM equity "
                    "if busting costs significant prize equity. "
                    "Use ICM calculators (ICMIZER, HoldemResources) to find exact push/fold "
                    "ranges adjusted for prize structure."
                ),
                difficulty="intermediate",
            ),
            StudyArticle(
                title="Calling Ranges vs Shoves: The Math",
                concept="Calculating profitable calls vs all-in shoves",
                explanation=(
                    "Call when: (equity vs their range × total pot) > (call amount). "
                    "Example: shove 20bb, you call 18bb, pot = 21bb. Need ~46% equity. "
                    "AJs vs a 20bb BTN shove has ~50% equity vs BTN's range — profitable call. "
                    "Run these calculations for common spots to build intuition."
                ),
                difficulty="advanced",
            ),
        ],
    },

    "icm_pressure": {
        "puzzle_tags": ["tournament", "ICM", "All-in Spots", "push-fold"],
        "puzzle_count_target": 7,
        "drill_description": (
            "Use ICMIZER to simulate 5 tournament spots near the bubble. "
            "For each, find: (1) your chip-EV optimal action, (2) your ICM-optimal action. "
            "Note where they differ. This teaches you where ICM pressure changes decisions."
        ),
        "gto_concept": (
            "ICM values chip survival over chip accumulation. Near pay jumps, the marginal "
            "value of winning chips is less than the marginal value of losing chips. "
            "This creates risk-aversion that narrows profitable shove ranges and widens "
            "profitable fold ranges vs large stacks."
        ),
        "articles": [
            StudyArticle(
                title="Introduction to ICM in Tournaments",
                concept="Why chip EV and tournament EV differ",
                explanation=(
                    "In a cash game, 1 chip = 1 unit of value. In a tournament, your equity "
                    "depends on your stack relative to others and the prize structure. "
                    "Doubling up from 10% to 20% of chips does NOT double your prize equity — "
                    "the marginal value of chips decreases as your stack grows."
                ),
                difficulty="beginner",
            ),
            StudyArticle(
                title="Bubble Play and Stack-Size Dynamics",
                concept="Adjusting strategy based on stack size near the bubble",
                explanation=(
                    "Large stack: max pressure on medium stacks; they can't call without risking bust. "
                    "Medium stack: tighten vs large stack, exploit short stacks. "
                    "Short stack: shove wide to avoid blinding out; survival is priority. "
                    "Micro stack: near zero ICM pressure — call with anything profitable chip-EV."
                ),
                difficulty="intermediate",
            ),
            StudyArticle(
                title="Final Table ICM and Pay Jump Exploits",
                concept="Advanced ICM application at the final table",
                explanation=(
                    "Final table pay jumps are large — ICM pressure peaks here. "
                    "Calculate risk premiums for each pay jump. Against a short stack that needs "
                    "chips: even AK might be a fold if busting destroys your prize equity. "
                    "Use HoldemResources Final Table ICM to input exact stacks and prize structures."
                ),
                difficulty="advanced",
            ),
        ],
    },

    "ip_aggression": {
        "puzzle_tags": ["IP", "SRP", "c-bet", "flop", "value bet"],
        "puzzle_count_target": 6,
        "drill_description": (
            "Review 10 hands where you were IP and checked back on a street. "
            "For each, evaluate: did checking protect you? Did you lose EV? "
            "Mark any check where you had top pair or better as a potential missed value spot."
        ),
        "gto_concept": (
            "In position, you control the price of the hand and realise equity more efficiently. "
            "This means you can bet more thin value hands because you see one more card before "
            "committing more chips. IP aggression frequency should generally be higher than OOP."
        ),
        "articles": [
            StudyArticle(
                title="Exploiting Positional Advantage",
                concept="How to use IP advantage to extract more EV",
                explanation=(
                    "IP benefits: (1) last to act = more information before decision, "
                    "(2) can choose to see next card for free, (3) build bigger pots with strong hands. "
                    "When IP with top pair or better: bet for value 70%+ of the time unless the board is "
                    "extremely wet and you want protection from a check-raise."
                ),
                difficulty="beginner",
            ),
            StudyArticle(
                title="IP Bet Sizing Strategies",
                concept="Optimal sizing when betting in position",
                explanation=(
                    "IP c-bets can use a wider sizing range than OOP: small (25-33%) for "
                    "merged/thin value on dry boards, large (65-75%) for polarised betting on "
                    "wet boards where equity charging is important. Use large IP turns to polarise "
                    "and force villain to make difficult call/fold decisions."
                ),
                difficulty="intermediate",
            ),
        ],
    },

    "oop_sizing": {
        "puzzle_tags": ["OOP", "SRP", "river value", "check-raise", "BB defense"],
        "puzzle_count_target": 6,
        "drill_description": (
            "Map your OOP c-bet frequency and average sizing for 20 flop spots. "
            "Compare to solver output: aim for 40–55% c-bet frequency OOP on most boards. "
            "On boards where you have range disadvantage, check at 70%+ frequency."
        ),
        "gto_concept": (
            "OOP bets should be larger on average than IP bets because OOP has no "
            "informational advantage. Large OOP bets compensate by denying equity "
            "realisation to the IP player and building pots when strong."
        ),
        "articles": [
            StudyArticle(
                title="OOP C-Bet Strategy Fundamentals",
                concept="When and how to bet out of position",
                explanation=(
                    "OOP c-bet on boards where you have range advantage: A-high boards as PFR, "
                    "boards that hit your 3-bet range harder. On boards where IP player has range "
                    "advantage: check at high frequency and use check-raise as primary weapon. "
                    "Avoid low-frequency donk bets on boards where IP has the edge."
                ),
                difficulty="beginner",
            ),
            StudyArticle(
                title="Check-Raise as OOP Primary Aggression Tool",
                concept="Using check-raises to counter IP betting pressure",
                explanation=(
                    "OOP check-raise advantages: (1) builds a larger pot with strong hands, "
                    "(2) denies equity to IP draws, (3) balances your checking range (they can't "
                    "just auto-bet your checks). Build your check-raise range: sets + two pair "
                    "(value) + strong draws + occasional bluffs (balance)."
                ),
                difficulty="intermediate",
            ),
        ],
    },

    "stat_loose_passive": {
        "puzzle_tags": ["preflop", "3bet pot", "BB defense", "call or fold"],
        "puzzle_count_target": 10,
        "drill_description": (
            "For one session: every time you want to call preflop, ask 'is 3-betting better?' "
            "With any premium (TT+, AJs+, AQo+): 3-bet instead of call. "
            "Track: how many hands did you 3-bet this session? Target 3+ per 100 hands."
        ),
        "gto_concept": (
            "A loose-passive style (high VPIP, low PFR) is highly exploitable. "
            "Opponents always know you'll call and never 3-bet — they can open any two cards "
            "and c-bet you off marginal hands. Adding 3-bets forces them to have real hands."
        ),
        "articles": [
            StudyArticle(
                title="Raising Your PFR Without Increasing Mistakes",
                concept="How to add aggression while maintaining accuracy",
                explanation=(
                    "Start by 3-betting your premiums (JJ+, AK) instead of flatting. "
                    "This is the lowest-risk upgrade: you're still playing strong hands, "
                    "just playing them more aggressively. Next, add bluff 3-bets with A2s-A5s "
                    "and KQs for balance. Your VPIP stays constant while PFR increases."
                ),
                difficulty="beginner",
            ),
        ],
    },

    "stat_nit": {
        "puzzle_tags": ["preflop", "opening ranges", "BTN", "SRP"],
        "puzzle_count_target": 8,
        "drill_description": (
            "Print a preflop opening chart for BTN (50% of hands), CO (30%), HJ (22%). "
            "For one session, force yourself to open exactly these ranges. "
            "Track how many hands you folded that were in the chart — those are missed EV opportunities."
        ),
        "gto_concept": (
            "Late position opens are profitable because you gain positional advantage post-flop "
            "and steal blinds with a wide range. BTN can open 45–55% of hands profitably "
            "because the ranges are well-studied and the positional advantage is significant."
        ),
        "articles": [
            StudyArticle(
                title="Opening Ranges by Position",
                concept="Which hands to open from each seat",
                explanation=(
                    "UTG: open ~15-18% (TT+, AJs+, AQo+, KQs, QJs). "
                    "HJ: open ~22% (add 99, ATo, KJs, QTs). "
                    "CO: open ~30% (add 88, A9o+, KTo+, any two cards 87s+). "
                    "BTN: open ~45% (add 77, A5o+, K8s+, any two broadways, suited connectors 54s+). "
                    "Memorise these and never open less aggressively in late position."
                ),
                difficulty="beginner",
            ),
        ],
    },

    "stat_oop_struggles": {
        "puzzle_tags": ["OOP", "BB defense", "check-raise", "SRP"],
        "puzzle_count_target": 8,
        "drill_description": (
            "Replay 10 hands from BB where you lost EV. Identify: "
            "(1) Did you defend correctly? (2) Did you c-bet appropriately OOP? "
            "(3) Did you use check-raise enough? Create a personal OOP checklist: "
            "check range > 60% OOP, c-bet only with range advantage."
        ),
        "gto_concept": (
            "OOP disadvantage is structural — you act first, see less information. "
            "Compensate by: (1) widening check-raise to balance your checking range, "
            "(2) sizing larger when you bet for value, "
            "(3) defending wider to avoid being auto-exploited on c-bets."
        ),
        "articles": [
            StudyArticle(
                title="Playing Profitably Out of Position",
                concept="Core OOP strategy concepts",
                explanation=(
                    "OOP checklist: check more than you bet (60%+ check frequency on most boards), "
                    "use check-raise as primary aggression tool (not donk-bet), "
                    "size larger when you do bet (55%+ pot) to compensate for no information advantage. "
                    "Study one BB OOP scenario per week using a solver."
                ),
                difficulty="intermediate",
            ),
        ],
    },

    "stat_short_stack": {
        "puzzle_tags": ["push-fold", "All-in Spots", "tournament", "short stack"],
        "puzzle_count_target": 8,
        "drill_description": (
            "Drill push-fold ranges with PokerRanger or HoldemResources: "
            "15bb BTN, 12bb CO, 10bb UTG. Do 20 scenarios each. "
            "Track accuracy %. Target: >90% accuracy on push-fold decisions within 2 weeks."
        ),
        "gto_concept": (
            "Short-stack play is the most solved area of poker — push-fold charts are "
            "precisely calculated. Memorising correct ranges is a direct skill upgrade with "
            "immediate EV impact. There is no creativity required — just memorise and execute."
        ),
        "articles": [
            StudyArticle(
                title="Short Stack Fundamentals: Shove or Fold",
                concept="Why raise-fold is never correct with <20bb",
                explanation=(
                    "Below 20bb: raise = pot commitment. Opponents can 3-bet-shove profitably "
                    "knowing you're committed. So: shove all-in (denying them 3-bet opportunity) "
                    "or fold. Never raise to 2.5x or 3x — you become exploitable. "
                    "The shove forces villain to call with a premium hand or fold."
                ),
                difficulty="beginner",
            ),
        ],
    },
}


# ── Public API ────────────────────────────────────────────────────────────────

def build_study_recommendations(leaks: list[PlayerLeak]) -> list[StudyRecommendation]:
    """Return a StudyRecommendation for each of the top 5 leaks."""
    recommendations: list[StudyRecommendation] = []

    for leak in leaks[:5]:
        data = _RECOMMENDATIONS.get(leak.category) or _RECOMMENDATIONS.get(leak.id)
        if not data:
            # Generic fallback
            recommendations.append(StudyRecommendation(
                leak_category=leak.category,
                leak_title=leak.title,
                puzzle_tags=[leak.street, "SRP"],
                puzzle_count_target=5,
                drill_description=(
                    f"Review your last 10 hands involving '{leak.title.lower()}' situations. "
                    "For each, identify what the optimal play was and why yours differed."
                ),
                gto_concept=leak.coaching_note or "Study GTO fundamentals for this spot type.",
                articles=[],
            ))
            continue

        recommendations.append(StudyRecommendation(
            leak_category=leak.category,
            leak_title=leak.title,
            puzzle_tags=data.get("puzzle_tags", []),
            puzzle_count_target=data.get("puzzle_count_target", 5),
            drill_description=data.get("drill_description", ""),
            gto_concept=data.get("gto_concept", ""),
            articles=data.get("articles", []),
        ))

    return recommendations
