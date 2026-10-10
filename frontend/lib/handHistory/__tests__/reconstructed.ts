/**
 * RECONSTRUCTED hands — not copied from a real export.
 *
 * TOP_HAND rebuilds the first hand of "GG20261008-1802 - Daily Special 10.txt"
 * from the lines and figures quoted in the feature spec (Hero AhQd all-in vs
 * JsJd, Level19 1,500/3,000(350), pot 64,676, `raises … to 47,892`,
 * `calls 24,188`, `Uncalled bet (20,704)`). Every chip amount reconciles:
 * 8×350 antes + 1,500 SB + 6,000 open + 2×27,188 = 64,676. Seat names and
 * stacks not quoted in the spec are filled in.
 *
 * The others are small constructed hands for side/split pots — including the
 * Hero-wins-a-split and Hero-wins-only-the-main-pot cases, which the real
 * export does not contain. The real export (fixtures/, when present) is
 * covered by the "real export" block in parser.test.ts; there the top hand
 * has the same amounts but different seats (the opener is 6888443a, and
 * 922e16a4 sits in seat 8).
 */

export const TOP_HAND = `Poker Hand #TM6510945691: Tournament #316999261, Daily Special $10 Hold'em No Limit - Level19(1,500/3,000(350)) - 2026/10/08 21:40:24
Table '132' 8-max Seat #2 is the button
Seat 1: 922e16a4 (48,242 in chips)
Seat 2: 7b1c90fe (35,100 in chips)
Seat 3: 4070ed9d (51,900 in chips)
Seat 4: Hero (27,538 in chips)
Seat 5: a596eadd (88,410 in chips)
Seat 6: 3f0e11c2 (19,875 in chips)
Seat 7: c81d55b0 (40,020 in chips)
Seat 8: 5e2a7d19 (62,333 in chips)
922e16a4: posts the ante 350
7b1c90fe: posts the ante 350
4070ed9d: posts the ante 350
Hero: posts the ante 350
a596eadd: posts the ante 350
3f0e11c2: posts the ante 350
c81d55b0: posts the ante 350
5e2a7d19: posts the ante 350
4070ed9d: posts small blind 1,500
Hero: posts big blind 3,000
*** HOLE CARDS ***
Dealt to 922e16a4
Dealt to 7b1c90fe
Dealt to 4070ed9d
Dealt to Hero [Qd Ah]
Dealt to a596eadd
Dealt to 3f0e11c2
Dealt to c81d55b0
Dealt to 5e2a7d19
a596eadd: raises 3,000 to 6,000
3f0e11c2: folds
c81d55b0: folds
5e2a7d19: folds
922e16a4: raises 41,892 to 47,892 and is all-in
7b1c90fe: folds
4070ed9d: folds
Hero: calls 24,188 and is all-in
a596eadd: folds
Uncalled bet (20,704) returned to 922e16a4
Hero: shows [Qd Ah]
922e16a4: shows [Js Jd]
*** FLOP *** [6c 8s 7c]
*** TURN *** [6c 8s 7c] [Ks]
*** RIVER *** [6c 8s 7c Ks] [4s]
*** SHOWDOWN ***
922e16a4 collected 64,676 from pot
*** SUMMARY ***
Total pot 64,676 | Rake 0 | Jackpot 0 | Bingo 0 | Fortune 0 | Tax 0
Board [6c 8s 7c Ks 4s]
Seat 1: 922e16a4 showed [Js Jd] and won (64,676) with a pair of Jacks
Seat 2: 7b1c90fe (button) folded before Flop
Seat 3: 4070ed9d (small blind) folded before Flop
Seat 4: Hero (big blind) showed [Qd Ah] and lost with King high
Seat 5: a596eadd folded before Flop
Seat 6: 3f0e11c2 folded before Flop
Seat 7: c81d55b0 folded before Flop
Seat 8: 5e2a7d19 folded before Flop`;

/** Steal, everyone folds: uncalled bet, no flop, no showdown. */
export const NO_FLOP_HAND = `Poker Hand #TM0000000002: Tournament #316999261, Daily Special $10 Hold'em No Limit - Level3(150/300(40)) - 2026/10/08 18:20:00
Table '132' 6-max Seat #4 is the button
Seat 1: aa11bb22 (20,000 in chips)
Seat 2: cc33dd44 (20,000 in chips)
Seat 4: Hero (20,000 in chips)
Seat 5: ee55ff66 (20,000 in chips)
Seat 6: 77aa88bb (20,000 in chips)
aa11bb22: posts the ante 40
cc33dd44: posts the ante 40
Hero: posts the ante 40
ee55ff66: posts the ante 40
77aa88bb: posts the ante 40
ee55ff66: posts small blind 150
77aa88bb: posts big blind 300
*** HOLE CARDS ***
Dealt to aa11bb22
Dealt to cc33dd44
Dealt to Hero [Ks Td]
Dealt to ee55ff66
Dealt to 77aa88bb
aa11bb22: folds
cc33dd44: folds
Hero: raises 360 to 660
ee55ff66: folds
77aa88bb: folds
Uncalled bet (360) returned to Hero
*** SHOWDOWN ***
Hero collected 950 from pot
*** SUMMARY ***
Total pot 950 | Rake 0 | Jackpot 0 | Bingo 0 | Fortune 0 | Tax 0
Seat 4: Hero (button) collected (950)`;

/** Three-way all-in with a side pot: Hero has the shortest stack and wins the main pot (24,375); the side pot (43,750) goes to 11111111. */
export const SIDE_POT_HAND = `Poker Hand #TM0000000003: Tournament #316999261, Daily Special $10 Hold'em No Limit - Level10(500/1,000(125)) - 2026/10/08 19:30:00
Table '132' 8-max Seat #1 is the button
Seat 1: 11111111 (30,000 in chips)
Seat 2: 22222222 (50,000 in chips)
Seat 3: Hero (8,125 in chips)
11111111: posts the ante 125
22222222: posts the ante 125
Hero: posts the ante 125
22222222: posts small blind 500
Hero: posts big blind 1,000
*** HOLE CARDS ***
Dealt to 11111111
Dealt to 22222222
Dealt to Hero [Ac Ad]
11111111: raises 1,000 to 2,000
22222222: raises 6,000 to 8,000
Hero: calls 7,000 and is all-in
11111111: raises 21,875 to 29,875 and is all-in
22222222: calls 21,875
Hero: shows [Ac Ad]
11111111: shows [Kh Kc]
22222222: shows [Qs Qh]
*** FLOP *** [2c 7d 9s]
*** TURN *** [2c 7d 9s] [Jc]
*** RIVER *** [2c 7d 9s Jc] [3h]
*** SHOWDOWN ***
11111111 collected 43,750 from pot
Hero collected 24,375 from pot
*** SUMMARY ***
Total pot 68,125 | Rake 0 | Jackpot 0 | Bingo 0 | Fortune 0 | Tax 0
Board [2c 7d 9s Jc 3h]`;

/** Heads-up to the river, chopped. */
export const SPLIT_POT_HAND = `Poker Hand #TM0000000004: Tournament #316999261, Daily Special $10 Hold'em No Limit - Level5(200/400(50)) - 2026/10/08 18:50:00
Table '132' 8-max Seat #6 is the button
Seat 2: Hero (15,000 in chips)
Seat 6: abcdef01 (15,000 in chips)
Seat 7: 99999999 (15,000 in chips)
Hero: posts the ante 50
abcdef01: posts the ante 50
99999999: posts the ante 50
99999999: posts small blind 200
Hero: posts big blind 400
*** HOLE CARDS ***
Dealt to Hero [Ah Tc]
Dealt to abcdef01
Dealt to 99999999
abcdef01: raises 400 to 800
99999999: folds
Hero: calls 400
*** FLOP *** [As 7h 2d]
Hero: checks
abcdef01: bets 600
Hero: calls 600
*** TURN *** [As 7h 2d] [9c]
Hero: checks
abcdef01: checks
*** RIVER *** [As 7h 2d 9c] [Kd]
Hero: checks
abcdef01: checks
Hero: shows [Ah Tc]
abcdef01: shows [Ad Th]
*** SHOWDOWN ***
Hero collected 1,575 from pot
abcdef01 collected 1,575 from pot
*** SUMMARY ***
Total pot 3,150 | Rake 0 | Jackpot 0 | Bingo 0 | Fortune 0 | Tax 0
Board [As 7h 2d 9c Kd]`;
