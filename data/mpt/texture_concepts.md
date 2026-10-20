# Flop textures: how Modern Poker Theory classifies them

Summary in our own words of how *Modern Poker Theory* (Michael Acevedo) sorts
flops and ties them to range advantage and c-bet sizing. This is the basis for
the trainer's explanations and the c-bet rules in Phase 3. It does not quote
the book. Page numbers are 1-based PDF pages.

All the book's postflop numbers come from aggregated solver runs on MTT ranges
(ante, no rake), mostly at 20–40bb stacks, over all 1,755 suit-isomorphic flops
(p.590, p.624–625).

## 1. The classification axes (p.626–631)

A flop is described along five independent axes:

| Axis | Values | Notes |
|---|---|---|
| **Structure** | trips · paired · unpaired | The first thing to read; play changes completely between them. |
| **Suit texture** | monotone · two-tone · rainbow | Two-tone has three subtypes by which two cards share a suit: **high-mid** (A♥K♥Q♠), **mid-low** (J♥6♠5♠), **high-low** (A♥9♠2♥). |
| **Rank** | the highest card: Axx, Kxx, … 2xx | Higher-rank flops are more common; Axx is the single largest group. |
| **Flopped straights** | 0, 1, 2 or 3 possible straights | Within the 0-straight flops the book mentions a sub-count of possible open-ended draws, but does not develop it (p.629). |
| **Family** | each card as A (ace), H (K–T), M (9–6), L (5–2) | e.g. ALL = ace + two low cards, 9MM, 77H for a paired seven with a high card. Flops in one family tend to be played alike. |

Related concept, **dynamic vs static** (p.625): on dynamic boards (low,
connected, with flush/straight draws) hand values can change a lot on later
streets; on static boards (high, disconnected, rainbow) they mostly stay put.

## 2. Equity buckets drive the strategy (p.597–600, p.634–635, p.676–681)

The book sorts every hand in a range by its hand-vs-range equity into **Strong
(≥75%)**, **Good (50–75%)**, **Weak (33–50%)** and **Trash (<33%)**. The point
is that the *shape* of both ranges matters more than the raw range-vs-range
equity:

- Two flops can give the preflop raiser similar overall equity but very
  different bucket shapes, and that shape — not the headline number — decides
  how often and how big to bet.
- A player who holds many more strong hands than the opponent is said to have
  the advantage at the top of the range; the book's glossary calls this the
  *nut advantage* (p.20), without a numeric threshold.

## 3. From buckets to c-bet frequency and size (IP, SRP vs the BB)

The book groups flop c-bets into two size families — **big** (1/2 or 2/3 pot)
and **small** (min-bet or 1/3 pot) — and three frequency bands — **high
(80%+)**, **mid (60–80%)**, **low (<60%)** (p.676).

What pushes toward a **big** size:
- The defender (BB) has *few* strong hands but many good, calling-type hands.
  Betting big charges those hands and the defender has little to raise with.
- Rainbow and high/static boards, where the raiser's strong hands stay strong
  and can be bet across several streets.

What pushes toward a **small** size:
- The defender's range is *polarized*: a fair number of strong hands plus a lot
  of trash, with little in between. This is typical of **paired** and
  **monotone** flops. A small bet folds out the trash cheaply without isolating
  the raiser against the defender's best hands.
- The raiser's own range is mostly good-but-not-great hands.

What pushes toward **checking more** (lower frequency):
- Lower ranks and more connected boards (more possible straights). The book
  reports the check rate rising with the number of flopped straights (p.674).
- The defender has enough strong hands to check-raise often; then the raiser
  should check back many good and weak hands instead of betting and folding to
  a raise.

Texture-level tendencies the book reports (IP c-betting vs the BB):
- **Trips** flops are the best for the raiser and are bet very often (p.664).
- **Paired** flops: mostly min-bets; 1/3 pot on some families (AAM, AAL, LLL);
  low and middle pairs are checked more than paired high cards or aces
  (p.668).
- **Monotone**: bet very often but small; the raiser's equity edge is smallest
  here (p.672–673).
- **Two-tone vs rainbow**: rainbow gives the raiser a larger edge and more
  big bets; two-tone flush draws make equities shift more (p.674–675).
- **Rank**: Axx and Kxx are c-bet most; middle and low flops least (p.662).

## 4. The defender's side (donk bets, p.632–650)

The BB leads into the raiser almost never overall, but on a small set of low,
connected flops (mostly 7xx and 6xx with possible straights) it leads often,
because there the BB's range is the more polarized one and the raiser's range
is full of weak hands. On high, ace-high, monotone and high-paired flops the BB
should simply check.

## 5. Other spots in the book

- **OOP c-bets after a cold call** (opener vs BN, p.699–717): ranges are much
  closer, so the opener bets less often, uses bigger sizes on low paired and
  rainbow boards, and plays passively on middle/low connected boards.
- **3-bet pots** (40bb, p.717–726): the 3-bettor usually has a clear
  polarization edge; small bets (1/4 pot) dominate in position; Axx is checked
  surprisingly often in position because it is static and polarizes the caller.

## 6. How the trainer will use this

- Texture labels per flop: structure, suit texture (with the two-tone
  subtype), rank, flopped-straight count and family — all mechanical, computed
  from the cards.
- One-line explanations generated from the precomputed numbers (bucket shapes
  of both players) plus the tendencies above, written in our own words.
- C-bet rules (Phase 3) start from the bucket-shape → size/frequency
  relationships in section 3. Where the book prints a concrete strategy for a
  specific flop (the six Flop Strategy Examples, p.682–699), those numbers win.
