# Flop Equity Trainer — Phase 0 report

Extraction of spots, ranges, equity buckets and reference numbers from
*Modern Poker Theory* (Michael Acevedo). No app code was written.

**Page numbers** in all `data/mpt` files are **1-based PDF pages** (what a PDF
viewer shows). This matches the existing preflop-trainer data
(`frontend/data/ranges/*.json`). Some older notes and puzzle sources use the
0-based page index of `docs/mpt_fulltext.txt`, which is one lower.

**The book** is at `docs/book-local/` (and `docs/`), both git-ignored; `*.pdf`
is now ignored repo-wide. Nothing from the book's text is copied into these
files: only numbers, ranges, definitions and names.

## 1. How the data was extracted

- **Text:** the existing full-text extraction of the book (`docs/mpt_fulltext.txt`).
- **Range grids:** the 13×13 charts are images. A small extractor measures the
  colour split of each cell (all-in / raise / call / fold / not-in-range) along a
  line below the label text. It was validated before use:
  - against 7 charts the preflop trainer already has: mean |difference| per
    cell 0.02–0.14%, max 3.8%, never > 5% in any cell;
  - every extracted chart's combo-weighted totals match the printed caption
    within 0.1% (open/defence charts) or 0.8% (vs-3-bet charts).
- **Diagrams and tables** (EQB pies, range breakdowns): read visually from the
  rendered pages and transcribed by hand.
- **Check:** a one-off exact computation (every turn+river, card removal) of 6
  book flops with the transcribed 40bb ranges — results in section 5.

## 2. Equity buckets — `buckets.json`

| Bucket | Hand-vs-range equity | Colour in the book |
|---|---|---|
| Strong | ≥ 75% | black |
| Good | ≥ 50% and < 75% | grey |
| Weak | ≥ 33% and < 50% | red |
| Trash | < 33% | dark red |

Source: Chapter 10, "Equity Buckets (EQB)", p.597. Exact transcription.

## 3. Spots — `spots.json` (22 entries)

The postflop chapters analyse three families of spots. All are MTT, 9-max,
12.5% ante, heads-up to the flop.

| Spot id | IP | OOP | Stack | Preflop | Status |
|---|---|---|---|---|---|
| srp_bb_vs_bn_40 | BN | BB | 40 | BN opens 2.3x, BB calls | **ready** |
| srp_bb_vs_utg_40 | UTG | BB | 40 | UTG opens 2x (see Q6), BB calls | **ready** |
| srp_bb_vs_{bn,utg}_{20,30} (4) | | | 20/30 | | blocked: BB ranges not in book (Q2) |
| cc_co_vs_bn_40 | BN | CO | 40 | CO opens 2.3x, BN calls | **ready** |
| cc_utg_vs_bn_40 | BN | UTG | 40 | UTG opens 2.3x, BN calls | **ready** |
| cc_co_vs_bn_20 | BN | CO | 20 | CO opens 2x, BN calls | **ready** |
| cc_utg_vs_bn_20 | BN | UTG | 20 | UTG opens 2x, BN calls | **ready** |
| 3bp_bb_vs_bn_40 | BN | BB | 40 | BN opens 2.3x, BB 3-bets 3.5x, BN calls | **ready** |
| 3bp_bb_vs_co_40 | CO | BB | 40 | BB 3-bets 3.5x | **ready** |
| 3bp_sb_vs_bn_40 | BN | SB | 40 | SB 3-bets 3.3x | **ready** |
| 3bp_sb_vs_co_40 | CO | SB | 40 | SB 3-bets 3.3x | **ready** |
| 3bp_bn_vs_co_40 | BN | CO | 40 | BN 3-bets 3.25x | **ready** |
| 3bp_bb_vs_utg_40 · 3bp_sb_vs_utg_40 · 3bp_bn_vs_utg_40 · 3bp_bn_vs_lj_40 · 3bp_utgp1_vs_utg_40 | | | 40 | | needs confirmation: position mapping (Q7) |
| 3bp_co_vs_utg_40 · 3bp_co_vs_mp_40 | | | 40 | | blocked: response chart not printed |

Analysis pages: single-raised pots p.632–658 and p.683–699 (flop examples),
p.728–747 (c-bet defence); cold call p.699–717; 3-bet pots p.717–726.

## 4. Ranges — `ranges/*.json` (16 files)

The notation is hand class → frequency (0–1), i.e. the share of that hand's
combos in the range. Mixed strategies keep their frequency.

| Spot | IP range (book source) | % hands | OOP range (book source) | % hands |
|---|---|---|---|---|
| srp_bb_vs_bn_40 | BN open, HR 114 p.329 | 50.8 | BB call, HR 167 p.397 | 59.1 |
| srp_bb_vs_utg_40 | UTG open, HR 138 p.359 | 15.8 | BB call, HR 173 p.403 | 49.4 |
| cc_co_vs_bn_40 | BN call, HR 342 p.702 | 19.7 | CO open, HR 341 p.701 | 36.4 |
| cc_utg_vs_bn_40 | BN call, HR 344 p.704 | 15.9 | UTG open, HR 343 p.703 | 15.8 |
| cc_co_vs_bn_20 | BN call, HR 346 p.706 | 8.5 | CO open, HR 345 p.705 | 31.9 |
| cc_utg_vs_bn_20 | BN call, HR 348 p.708 | 12.3 | UTG open, HR 347 p.707 | 15.9 |
| 3-bet pots (10) | 3-bettor: non-all-in 3-bet part of HR 167/169/173/195/197/201/220/222/224/263 | 1.5–26.5 | caller: opener's open × "call vs 3-bet" (HR 297–322, p.549–574) | |

How each one was made:
- **Exact transcription:** every chart value.
- **Exact derivation:** the 3-bet-pot caller ranges. The vs-3-bet charts only
  show hands that were opened, so the caller range is open frequency × call
  frequency. Weighted this way, every caption total is reproduced within 0.8%.
- **Implementation decision:** snapping extraction noise (< 4% → 0, > 96% → 1)
  on new charts.

## 5. Golden examples — `golden_examples.json`

The book gives concrete flop numbers for six 40bb examples (Flop Strategy
Examples 1–6, p.682–699, with range breakdown tables 113–118). The Phase 0
exact check uses the transcribed ranges.

| Flop (spot) | Book IP equity | Computed | Book EQB IP / OOP | Computed EQB IP / OOP |
|---|---|---|---|---|
| A♥Q♦3♠ (UTG) | 72 | 71.9 | 56/33/10/1 · 3/17/10/70 | 55.4/33.3/10.5/0.8 · 2.4/17.2/8.5/71.9 |
| Q♥J♥T♥ (UTG) | 64 | 64.0 | 27/53/19/1 · 7/14/29/50 | 27.3/53.0/19.4/0.4 · 8.4/**17.5/24.4**/49.7 |
| 9♥8♥4♦ (UTG) | 56 (table) / 59 (text) | 56.0 | 18/26/56/0 · 4/36/25/35 | 18.5/26.2/55.0/0.4 · 3.8/36.4/24.6/35.1 |
| J♠6♥6♦ (BN) | 57 | 57.1 | 23/42/24/11 · 14/9/25/52 | 22.8/41.2/25.4/10.7 · 14.9/8.9/**32.3/43.8** |
| 8♥6♦2♠ (BN) | 55 | 54.4 | 20/32/44/4 · 4/33/32/31 | 19.6/32.0/44.3/4.0 · 3.8/33.3/32.2/30.6 |
| 5♥5♦4♥ (BN) | 55 | 54.8 | 10/57/24/9 · 8/24/33/35 | 10.0/**54.1/26.9**/9.0 · 9.2/24.2/32.7/33.9 |

(EQB = strong/good/weak/trash %.)

What this shows:
- **Equity:** all six within 0.6%. The transcribed ranges are the ones the
  book's simulations used.
- **Buckets:** 9 of 12 distributions are within 2%. Three exceed it: the BB on
  Q♥J♥T♥, the BB on J♠6♥6♦ (up to 8%, all between weak and trash) and the BN on
  5♥5♦4♥ (2.9%). See Q3.

Also recorded:
- per-hand-class share and equity for the raiser on all six flops (Tables 113–118);
- Table 88: equity per hand category on A♥Q♦T♠, T♥9♦8♠, T♦9♥8♥ and T♥9♥8♥;
- A♠T♥T♦ (30bb);
- the all-flop average EQB (Diagram 38);
- the A76r/654r averages from the donk-bet section.

The last three are aggregates or 30bb, so they are marked descriptive, not
tests.

## 6. Comparison with the existing preflop trainer

The trainer was not changed.
- **Same charts:** HR 341 = trainer HR 118 (CO 40bb open), HR 343 = HR 138
  (UTG 40bb), HR 344 = HR 224 (BN vs UTG 40bb), HR 342 = HR 220 (BN vs CO
  40bb). Cell differences ≤ 0.1% (extraction noise). **No range deviations.**
- **Trainer charts re-verified against the book:** HR 114, 138, 167, 173 —
  mean cell difference ≤ 0.12%, max 3%.
- **Open-size deviation:** the trainer shows UTG 40bb as "Raise 2x" (HR 138,
  p.359), while the postflop chapter prints the same range as "Open 2.3x"
  (HR 343). This is in the book itself; see Q6.
- **New charts, not in the trainer:** HR 345–348 (20bb opens and BN calls) and
  HR 297–322 (opener vs 3-bet, 40bb).

## 7. What can be reused from the preflop trainer

- **Daily limit:** `consume_usage(user_id, 'trainer_hand')` against
  `plan_limits.free_trainer_hands_per_day = 50` (Amsterdam day); Pro unlimited.
  Returns 429 `TRAINER_DAILY_LIMIT_REACHED`. Guests have only a browser counter
  (`lib/billing/guestLimit.ts`). The flop trainer can share the same metric.
- **XP:** goes through `xp_events` via `increment_user_xp(user, xp, source_type,
  ref)`. The column is `source_type` (CHECK constraint), not `trainer_type`.
  Adding `'flop_equity'` needs a small migration.
- **Highscores:** `trainer_highscores` (per `trainer_key`) can hold
  `'flop-equity'`.
- **Paywall:** `UpgradeSource` and `UpgradeUi` exist, and `PaywallView` /
  explorer can reuse them.

## 8. Open questions

1. **Nut advantage has no metric in the book.** The glossary (p.20) defines it
   as "effective nut hands make up a larger portion of the range" without a
   threshold. The postflop chapters never measure it. The spec's "% two pair+ /
   % set-straight-flush+" is therefore our own definition. Options:
   - (a) use it, labelled as our metric;
   - (b) use the book's own top bucket, the Strong share (≥75%), as "nut
     advantage";
   - (c) drop the second question.

   Which?
2. **20bb and 30bb single-raised pots.** The book analyses BB vs BN/UTG at 20,
   30 and 40bb but prints BB defence charts only at 15/25/40/60bb. Options:
   only 40bb (as now), or approximate with the 25bb charts (not the book's
   simulation ranges; would be labelled).
3. **Golden test tolerance.** Equity matches within 0.6% everywhere, but three
   bucket splits differ by more than 2% (up to 8% on J♠6♥6♦ for the BB, all
   between weak and trash). Probably the book's simulation tool assigned
   near-33% hands slightly differently. Keep the 2% rule and list these three as
   known exceptions, or widen buckets to 3% / test only the IP side?
4. **The book contradicts itself on 9♥8♥4♦:** the text (p.688) says 59% equity,
   Table 115 says 56%. Our computation gives 56.0%. Use 56?
5. **Card inconsistencies in the book:**
   - the turn chapter calls Example 1 "A♠Q♦3♠" (flop chapter: A♥Q♦3♠);
   - it calls Example 3 "9♥8♥4♥" (flop chapter: 9♥8♥4♦);
   - Table 118 is captioned "UTG" for a BN example;
   - Table 88's text calls T98 "single suited" with 60% for top pair, but 60% is
     the monotone column.

   We follow the flop chapter and the tables. OK?
6. **UTG 40bb open size:** 2x (HR 138) or 2.3x (HR 343, HR 318–322)? It does
   not change equity, but it changes pot size and SPR shown in the spot label.
7. **Position names in the 3-bet-pot list:** the book uses EP and MP ("BN vs
   EP", "CO vs MP", "EP vs EP"). We mapped EP → UTG and MP → LJ, and "EP vs EP"
   → UTG+1 vs UTG. Confirm or drop those five spots.
8. **Which spots for the MVP?** We suggest starting with the two 40bb
   single-raised pots (the book's main spots, all six golden examples), then the
   four cold-call spots and the 3-bet pots.
9. **Hand classes for the heatmap/breakdown:** the book's tables use slightly
   different class lists per flop (e.g. "Pocket 1-2 (KK)", "Pocket 2-3
   (66-JJ)", "Combo Draw", "King High"). Proposal: one fixed list taken from the
   union of Tables 113–118, so per-flop results compare to the book.
10. **"Texture" for tracking and filtering:** the book has five axes (structure,
    suit texture, rank, flopped straights, family) but no single category name
    such as "low connected boards". Our trainer categories would be a grouping
    of those axes (an implementation decision). OK to define them ourselves,
    clearly built from the book's axes?
11. **XP and limit per flop:**
    - does one answered flop (equity + nut question) cost 1 of the 50 daily
      actions?
    - how much XP is "full" (the preflop trainer gives 1–4 XP plus streak tiers)?
    - does the flop trainer share the preflop trainer's 300 XP/day cap?
12. **Precompute tooling (Phase 1):** exact enumeration in Python needs a fast
    evaluator. `eval7` is not installed. May we add it to the backend (or use
    the site's own TypeScript evaluator, which ran a flop in 2–7 s)? Estimate:
    16 spots × 1,755 flops ≈ 28k flops.
13. **C-bet advice (Phase 3):** concrete per-flop frequencies and sizes exist
    only for the six example flops, plus aggregates by texture. For all other
    flops the advice would be rule-based (from `texture_concepts.md`) and
    labelled as such. OK?

## Files

`data/mpt/`:
- `buckets.json`
- `spots.json`
- `ranges/` (16 files)
- `golden_examples.json`
- `texture_concepts.md`
- `REPORT.md`

## 9. Decisions (2026-10-20)

| # | Question | Decision |
|---|---|---|
| 1 | Nut advantage | Follow the book. Its glossary definition (effective nut hands as a larger share of the range, p.20) is measured with the book's own top bucket: the **Strong share (≥75%)** of each range. "Equal" when the two shares are within 3 points (our threshold; the book gives none). |
| 2 | 20/30bb single-raised pots | Follow the book: only ranges it prints, so **40bb only**. |
| 3 | Golden tolerance | Equity ≤ 1 point, buckets ≤ 2 points. The three book splits that sit on a cluster at a bucket edge must be reproduced by moving that edge ≤ 2 equity points (tested explicitly). |
| 4 | UTG 40bb open size | **2.3x**, as the postflop chapter prints it (HR 343, HR 318–322). |
| 5 | EP/MP mapping | Confirmed: EP = UTG, MP = LJ, "EP vs EP" = UTG+1 vs UTG. |
| 6 | MVP spots | srp_bb_vs_bn_40 and srp_bb_vs_utg_40. |
| 7 | XP / daily limit | Later. |
| 8 | Tooling | Python + eval7 (offline only, `backend/requirements-precompute.txt`). |
