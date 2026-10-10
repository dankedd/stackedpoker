import { describe, expect, it } from "vitest";
import { cardFilter, parseCardQuery, termText } from "../cardSearch";
import { DEFAULT_STATE, applyFilters, isTargeted, readQueryState, writeQueryState, type FilterableQuery, type HandQueryState } from "../filters";
import { PRESETS, activeChips, clearAll, restoreDefaults } from "../filterUi";

class FakeQuery implements FilterableQuery {
  calls: string[] = [];
  gte(c: string, v: unknown) {
    this.calls.push(`gte ${c} ${v}`);
    return this;
  }
  eq(c: string, v: unknown) {
    this.calls.push(`eq ${c} ${v}`);
    return this;
  }
  in(c: string, v: readonly unknown[]) {
    this.calls.push(`in ${c} ${v.join("|")}`);
    return this;
  }
  or(f: string) {
    this.calls.push(`or ${f}`);
    return this;
  }
}

const state = (q: string): HandQueryState => readQueryState(new URLSearchParams(q));
const calls = (s: HandQueryState) => applyFilters(new FakeQuery(), s.filters).calls;

describe("card search", () => {
  it("understands classes, rank pairs, pairs and exact cards", () => {
    const { terms, invalid } = parseCardQuery("AQ, aqs, QAo, 55, AhQd, qdah, Ah, kk, xyz, AA s");
    expect(terms.map(termText)).toEqual(["AQ", "AQs", "AQo", "55", "AhQd", "Ah", "KK"]);
    expect(invalid).toEqual(["xyz", "AA s"]);
  });

  it("rejects impossible terms", () => {
    expect(parseCardQuery("55s, AhAh, 1A").terms).toEqual([]);
  });

  it("builds one OR filter: classes via hero_hand, exact cards via hero_cards", () => {
    expect(cardFilter(parseCardQuery("AQ, 55, AhQd, Ks").terms)).toBe("hero_hand.in.(AQs,AQo,55),hero_cards.cs.{Ah,Qd},hero_cards.cs.{Ks}");
    expect(cardFilter([])).toBeNull();
  });
});

describe("one precedence rule", () => {
  it("defaults apply when nothing targeted is active", () => {
    expect(calls(DEFAULT_STATE)).toEqual(["eq hero_involved true", "gte pot_bb 20"]);
    expect(isTargeted(DEFAULT_STATE.filters)).toBe(false);
  });

  it.each([
    ["cards=AQ", ["or hero_hand.in.(AQs,AQo)"]],
    ["pf=too_tight", ["in preflop_check too_tight"]],
    ["fav=1", ["eq is_favorite true"]],
    ["notes=1", ["eq has_note true"]],
  ])("any targeted filter (%s) switches the defaults off", (q, expected) => {
    expect(calls(state(q))).toEqual(expected);
  });

  it("targeted filters AND between types, OR within a type; tournament always applies", () => {
    expect(calls(state("cards=AQ,KK&pf=too_loose,too_tight&fav=1&t=316999261&minPot=40"))).toEqual([
      "or hero_hand.in.(AQs,AQo,KK)",
      "eq is_favorite true",
      "in preflop_check too_loose|too_tight",
      "eq tournament_id 316999261",
    ]);
  });

  it("switched-off defaults are kept, and come back when targeted filters are cleared", () => {
    const s = state("minPot=40&played=0&notes=1");
    expect(s.filters.minPotBb).toBe(40);
    expect(calls(s)).toEqual(["eq has_note true"]);
    const restored: HandQueryState = { ...s, filters: { ...s.filters, ...restoreDefaults(s).filters } };
    expect(calls(restored)).toEqual(["gte pot_bb 40"]);
  });
});

describe("URL state", () => {
  it("round-trips every filter, and keeps defaults out of the URL", () => {
    expect(writeQueryState(DEFAULT_STATE)).toBe("");
    const s = state("cards=AhQd,55&pf=mixed&fav=1&notes=1&played=0&minPot=35&t=1&sort=result&dir=asc");
    expect(readQueryState(new URLSearchParams(writeQueryState(s).slice(1)))).toEqual(s);
  });

  it("still reads old links (?alle=1)", () => {
    expect(state("alle=1").filters.heroInvolved).toBe(false);
  });

  it("'Recently starred' turns Favorites on", () => {
    const s = state("sort=favorited");
    expect(s.sort).toBe("favorited");
    expect(s.filters.favorites).toBe(true);
  });

  it("drops junk card terms from the URL", () => {
    expect(state("cards=AQ,zz,).or(").filters.cards).toEqual(["AQ"]);
  });
});

describe("chips and presets", () => {
  it("shows a chip per active filter; defaults only when changed and in effect", () => {
    expect(activeChips(DEFAULT_STATE)).toEqual([]);
    expect(activeChips(state("minPot=40")).map((c) => c.key)).toEqual(["pot"]);
    // Overridden defaults get no chip (the "Showing all hands…" note covers them).
    expect(activeChips(state("minPot=40&cards=AQ")).map((c) => c.key)).toEqual(["card:AQ"]);
    expect(activeChips(state("cards=AQ,KK&pf=too_tight&fav=1&notes=1&t=9")).map((c) => c.key)).toEqual([
      "card:AQ",
      "card:KK",
      "pf:too_tight",
      "fav",
      "notes",
      "t",
    ]);
  });

  it("removing the favorites chip also leaves the star-date sort", () => {
    const s = state("sort=favorited");
    const fav = activeChips(s).find((c) => c.key === "fav")!;
    expect(fav.remove).toEqual({ filters: { favorites: false }, sort: "pot" });
  });

  it("clear all resets everything", () => {
    const s = state("cards=AQ&fav=1&t=9&minPot=50&sort=favorited");
    expect(clearAll(s)).toEqual({ filters: DEFAULT_STATE.filters, sort: "pot" });
  });

  it("presets apply and recognise themselves", () => {
    for (const p of PRESETS) {
      const patch = p.apply(DEFAULT_STATE);
      const applied: HandQueryState = { ...DEFAULT_STATE, ...patch, filters: { ...DEFAULT_STATE.filters, ...patch.filters } };
      expect(p.isActive(applied), p.key).toBe(true);
      for (const other of PRESETS) if (other !== p) expect(other.isActive(applied), `${p.key} vs ${other.key}`).toBe(false);
    }
    expect(PRESETS.find((p) => p.key === "mistakes")!.apply(DEFAULT_STATE).filters!.preflop).toEqual(["too_loose", "too_tight", "wrong_action"]);
  });
});
