import { displayPos, openSize, villainAllIn, type Scenario } from "./logic";

/**
 * The action before Hero acts, as steps with bet sizes in bb — for the phone
 * table's chips ("2.3", "7.5") and its action line ("UTG opens 2.3 → You
 * 3-bet 7.5 → UTG 4-bets 19–23").
 *
 * Sources (Modern Poker Theory). Every size is one of:
 *  - data:        from the chart itself (open sizes, limp-raise sizes in the
 *                 action labels, the stack for an all-in);
 *  - derived:     a multiplier printed in a Hand Range title, applied to the
 *                 bet it answers (BvB 2.75x 3-bet and 2.6x 4-bet, HR 105/108
 *                 pp. 316/319; SB re-raise after a limp 2.75x at 40bb, HR 104
 *                 p. 315, and 3.4x at 60bb, HR 107 p. 318);
 *  - recommended: the book's recommended sizings, which the charts do not
 *                 state they were solved with — MTT 3-bets from Table 43
 *                 (p. 296), MTT non-all-in 4-bets as the 2.25–2.5x (IP) /
 *                 2.5–3x (OOP) range from p. 297, and the 100bb cash sizes
 *                 (p. 181).
 */

export type SizeSource = "data" | "derived" | "recommended";
export interface Step {
  /** Seat (trainer position code, e.g. "BN"), or Hero's seat. */
  pos: string;
  hero: boolean;
  verb: "opens" | "limps" | "goes all-in" | "3-bets" | "4-bets" | "raises" | "re-raises";
  /** bb; a [lo, hi] pair when only a range is known. */
  amount: number | [number, number];
  allIn: boolean;
  source: SizeSource;
}

/** Table 43 (p. 296): MTT recommended 3-bet sizes (bb), non-all-in option, by stack band. */
const TABLE_43: { max: number; ip: number; sb: number; bb: number }[] = [
  { max: 23, ip: 5, sb: 5.5, bb: 5.5 },
  { max: 27, ip: 5.5, sb: 6.5, bb: 6.5 },
  { max: 35, ip: 6, sb: 7, bb: 7 },
  { max: 45, ip: 7, sb: 8, bb: 8 },
  { max: 65, ip: 7.5, sb: 9, bb: 9 },
  { max: 99, ip: 8, sb: 9.5, bb: 9.5 },
  { max: Infinity, ip: 8.5, sb: 10, bb: 10 },
];

/** p. 181: 100bb cash recommended sizes. */
const CASH = { threeBetIP: 8.5, threeBetOOP: 10, fourBet: 23, bvbThreeBet: 9, bvbFourBet: 24, bvbIso: 3.5, bvbLimpReraise: 13 };

const x = (s: string) => Number(s.replace(/x$/, ""));
const isBlind = (pos: string) => pos === "SB" || pos === "BB";

export function actionSteps(sc: Scenario): Step[] {
  if (sc.type !== "def") return [];
  const vil = sc.vil;
  const hero = sc.hero;
  const allIn = villainAllIn(sc);
  const bvb = vil === "SB" && hero === "BB";
  const step = (pos: string, verb: Step["verb"], amount: Step["amount"], source: SizeSource, isAllIn = false): Step => ({
    pos,
    hero: pos === hero,
    verb,
    amount,
    allIn: isAllIn,
    source,
  });
  const open = x(openSize(sc));

  switch (sc.spot) {
    case "open":
      return [step(vil, "opens", open, "data")];
    case "push":
      return [step(vil, "goes all-in", sc.stack, "data", true)];
    case "limp":
      return [step(vil, "limps", 1, "data")];
    case "4bet": {
      let threeBet: number;
      let threeSource: SizeSource;
      let fourBet: Step["amount"];
      let fourSource: SizeSource;
      if (sc.fmt === "cash") {
        threeBet = bvb ? CASH.bvbThreeBet : isBlind(hero) ? CASH.threeBetOOP : CASH.threeBetIP;
        threeSource = "recommended";
        fourBet = bvb ? CASH.bvbFourBet : CASH.fourBet;
        fourSource = "recommended";
      } else if (bvb) {
        threeBet = round1(open * 2.75);
        threeSource = "derived";
        fourBet = round1(threeBet * 2.6);
        fourSource = "derived";
      } else {
        const row = TABLE_43.find((r) => sc.stack <= r.max)!;
        threeBet = hero === "SB" ? row.sb : hero === "BB" ? row.bb : row.ip;
        threeSource = "recommended";
        // The opener 4-bets in position when Hero 3-bet from the blinds.
        const [lo, hi] = isBlind(hero) ? [2.25, 2.5] : [2.5, 3];
        fourBet = [Math.round(threeBet * lo), Math.round(threeBet * hi)];
        fourSource = "recommended";
      }
      return [
        step(vil, "opens", open, "data"),
        step(hero, "3-bets", threeBet, threeSource),
        allIn ? step(vil, "4-bets", sc.stack, "data", true) : step(vil, "4-bets", fourBet, fourSource),
      ];
    }
    case "lr": {
      // Only blind vs blind: the SB limps, the BB raises, the SB re-raises.
      let raise: number;
      let reraise: number;
      let source: SizeSource;
      if (sc.fmt === "cash") {
        raise = CASH.bvbIso;
        reraise = CASH.bvbLimpReraise;
        source = "recommended";
      } else {
        raise = LIMP_RAISE_BY_STACK[sc.stack] ?? 3.5;
        reraise = round1(raise * (sc.stack >= 60 ? 3.4 : 2.75));
        source = "derived";
      }
      return [
        step(vil, "limps", 1, "data"),
        step(hero, "raises", raise, sc.fmt === "cash" ? "recommended" : "data"),
        allIn ? step(vil, "re-raises", sc.stack, "data", true) : step(vil, "re-raises", reraise, source),
      ];
    }
  }
}

/** The BB's raise size vs a SB limp in the MTT limp charts (action labels of HR 147/149/151/153). */
const LIMP_RAISE_BY_STACK: Record<number, number> = { 15: 3, 25: 3.3, 40: 3.5, 60: 3.5 };

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

/** "2.3", "9.6", "25", "19–23". */
export function formatBb(a: Step["amount"]): string {
  const f = (n: number) => String(round1(n));
  return Array.isArray(a) ? `${f(a[0])}–${f(a[1])}` : f(a);
}

/** Chips in front of each seat (bb, no unit): each player's last amount, blinds otherwise. */
export function chipsBySeat(sc: Scenario): Record<string, string> {
  const out: Record<string, string> = { SB: "0.5", BB: "1" };
  for (const s of actionSteps(sc)) out[s.pos] = formatBb(s.amount);
  return out;
}

/** "UTG opens 2.3", "You 3-bet 7.5", "UTG 4-bets all-in 25". */
export function stepText(s: Step): string {
  const who = s.hero ? "You" : displayPos(s.pos);
  const verb = s.hero ? s.verb.replace(/s$/, "").replace(/^goes/, "go") : s.verb;
  if (s.verb === "limps") return `${who} ${s.hero ? "limp" : "limps"}`;
  if (s.allIn && s.verb !== "goes all-in") return `${who} ${verb} all-in ${formatBb(s.amount)}`;
  return `${who} ${verb} ${formatBb(s.amount)}`;
}
