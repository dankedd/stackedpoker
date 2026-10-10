import { describe, expect, it } from "vitest";
import {
  DEFAULT_MIN_POT_BB,
  DEFAULT_STATE,
  applyFilters,
  keysetAfter,
  readQueryState,
  reverseOrder,
  sortColumns,
  writeQueryState,
  type FilterableQuery,
} from "../filters";

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
}

describe("hand filters", () => {
  it("defaults to involved hands with pots of at least 20 BB, biggest first", () => {
    const s = readQueryState(new URLSearchParams());
    expect(s).toEqual(DEFAULT_STATE);
    expect(DEFAULT_MIN_POT_BB).toBe(20);
    expect(applyFilters(new FakeQuery(), s.filters).calls).toEqual(["eq hero_involved true", "gte pot_bb 20"]);
  });

  it("round-trips through the query string and keeps defaults out of it", () => {
    expect(writeQueryState(DEFAULT_STATE)).toBe("");
    const s = readQueryState(new URLSearchParams("alle=1&minPot=35&t=316999261&notes=1&sort=invested&dir=asc&page=3"));
    expect(s.filters).toEqual({ favorites: false, preflop: [], heroInvolved: false, minPotBb: 35, tournamentId: "316999261", withNotes: true });
    expect(s.sort).toBe("invested");
    expect(readQueryState(new URLSearchParams(writeQueryState(s).slice(1)))).toEqual(s);
    expect(writeQueryState(s, false)).not.toContain("page");
    expect(applyFilters(new FakeQuery(), s.filters).calls).toEqual([
      "gte pot_bb 35",
      "eq tournament_id 316999261",
      "eq has_note true",
    ]);
  });

  it("the preflop filter goes before 'involved' and the minimum pot", () => {
    const s = readQueryState(new URLSearchParams("pf=too_tight,bogus,too_loose&t=316999261"));
    expect(s.filters.preflop).toEqual(["too_loose", "too_tight"]);
    expect(applyFilters(new FakeQuery(), s.filters).calls).toEqual([
      "in preflop_check too_loose|too_tight",
      "eq tournament_id 316999261",
    ]);
    expect(writeQueryState(s)).toBe("?pf=too_loose%2Ctoo_tight&t=316999261");
    expect(readQueryState(new URLSearchParams(writeQueryState(s).slice(1))).filters.preflop).toEqual(["too_loose", "too_tight"]);
  });

  it("the favourites filter goes before 'involved' and the minimum pot, other filters still apply", () => {
    const s = readQueryState(new URLSearchParams("fav=1&minPot=50&notes=1&t=316999261&pf=too_loose"));
    expect(s.filters.favorites).toBe(true);
    expect(applyFilters(new FakeQuery(), s.filters).calls).toEqual([
      "eq is_favorite true",
      "in preflop_check too_loose",
      "eq tournament_id 316999261",
      "eq has_note true",
    ]);
    expect(readQueryState(new URLSearchParams(writeQueryState(s).slice(1)))).toEqual(s);
  });

  it("sorts by star date only together with the favourites filter", () => {
    expect(readQueryState(new URLSearchParams("fav=1&sort=favorited")).sort).toBe("favorited");
    expect(readQueryState(new URLSearchParams("sort=favorited")).sort).toBe("pot");
    expect(sortColumns("favorited", "desc").map((c) => c.column)).toEqual(["favorited_at", "played_at", "id"]);
  });

  it("rejects junk in the URL", () => {
    const s = readQueryState(new URLSearchParams("minPot=-4&t=x'),or(&sort=evil&page=0"));
    expect(s).toEqual(DEFAULT_STATE);
  });

  it("minimum pot 0 and 'all hands' mean no filter at all", () => {
    expect(applyFilters(new FakeQuery(), { ...DEFAULT_STATE.filters, heroInvolved: false, minPotBb: 0 }).calls).toEqual([]);
  });

  it("orders with stable tie-breakers matching the indexes", () => {
    expect(sortColumns("pot", "desc").map((c) => `${c.column}:${c.ascending}`)).toEqual(["pot_bb:false", "played_at:false", "id:false"]);
    expect(sortColumns("date", "asc").map((c) => c.column)).toEqual(["played_at", "id"]);
    expect(sortColumns("invested", "desc").map((c) => c.column)).toEqual(["hero_invested_bb", "played_at", "id"]);
  });

  it("builds keyset filters for the next and previous hand", () => {
    const cols = sortColumns("pot", "desc");
    const row = { pot_bb: 21.56, played_at: "2026-10-08T21:40:24", id: "abc" };
    expect(keysetAfter(cols, row)).toBe(
      'pot_bb.lt."21.56",and(pot_bb.eq."21.56",played_at.lt."2026-10-08T21:40:24"),and(pot_bb.eq."21.56",played_at.eq."2026-10-08T21:40:24",id.lt."abc")',
    );
    expect(keysetAfter(reverseOrder(cols), row)).toMatch(/^pot_bb\.gt\."21\.56"/);
  });
});
