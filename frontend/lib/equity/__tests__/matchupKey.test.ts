import { describe, expect, it } from "vitest";
import { keyHands, matchupKey } from "../matchupKey";

describe("matchupKey", () => {
  it("is the same for suit relabellings", () => {
    const a = matchupKey(["As", "Ks"], ["Qh", "Qd"]);
    expect(matchupKey(["Ah", "Kh"], ["Qs", "Qc"])).toEqual(a);
    expect(matchupKey(["Ks", "As"], ["Qd", "Qh"])).toEqual(a);
  });

  it("tells suit patterns apart", () => {
    expect(matchupKey(["As", "Ah"], ["Kd", "Kc"]).key).not.toBe(matchupKey(["As", "Ah"], ["Ks", "Kd"]).key);
    expect(matchupKey(["As", "Ah"], ["Ks", "Kd"]).key).not.toBe(matchupKey(["As", "Ah"], ["Ks", "Kh"]).key);
  });

  it("flags the reversed order and round-trips", () => {
    const fwd = matchupKey(["As", "Ah"], ["Kd", "Kc"]);
    const rev = matchupKey(["Kd", "Kc"], ["As", "Ah"]);
    expect(rev.key).toBe(fwd.key);
    expect(rev.flipped).toBe(!fwd.flipped);
    const [h, v] = keyHands(fwd.key);
    expect(matchupKey(h, v)).toEqual({ key: fwd.key, flipped: false });
  });
});
