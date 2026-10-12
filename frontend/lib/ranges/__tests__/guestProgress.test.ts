import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import {
  GUEST_HANDS_KEY,
  GUEST_PROGRESS_KEY,
  addHand,
  bannerClosedThisSession,
  bannerVisible,
  closeBannerForSession,
  emptyProgress,
  isGuestVisitor,
  markPromptSeen,
  mergeGuestProgressIntoAccount,
  promptDue,
  readProgress,
  readSeenPrompts,
  readSignupIntent,
  recordGuestHand,
  rememberSignupIntent,
  safeReturnPath,
  storageAvailable,
  worstSpot,
  type MergeRpc,
  type PromptTrigger,
} from "../guestProgress";

class MemoryStorage {
  private m = new Map<string, string>();
  getItem(k: string) {
    return this.m.has(k) ? this.m.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, String(v));
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
}

class BlockedStorage {
  getItem(): string | null {
    throw new Error("SecurityError");
  }
  setItem() {
    throw new Error("SecurityError");
  }
  removeItem() {
    throw new Error("SecurityError");
  }
}

const g = globalThis as unknown as { window?: unknown };
let local: MemoryStorage;

function installWindow(storage: object = new MemoryStorage()) {
  local = storage as MemoryStorage;
  g.window = { localStorage: storage, sessionStorage: new MemoryStorage() };
}

beforeEach(() => installWindow());
afterEach(() => {
  delete g.window;
});

/**
 * Plays `n` hands as a guest and walks the prompt the way the trainer does:
 * whenever a prompt is due it is shown (marked seen) and closed. Returns the
 * hand numbers at which a prompt appeared and whether the banner was up after each hand.
 */
function play(n: number, verdict: "correct" | "wrong" = "correct") {
  const prompts: { hand: number; trigger: PromptTrigger }[] = [];
  const banner: boolean[] = [];
  for (let i = 0; i < n; i++) {
    const p = recordGuestHand("BTN open", verdict)!;
    const due = promptDue(p.hands_played, readSeenPrompts());
    if (due) {
      prompts.push({ hand: p.hands_played, trigger: due });
      markPromptSeen(due); // shown, then closed with "Keep practicing as guest"
    }
    banner.push(bannerVisible(readSeenPrompts(), bannerClosedThisSession()));
  }
  return { prompts, banner };
}

describe("guest hand counter", () => {
  it("counts every answered hand, right or wrong, in sp_guest_hands and sp_guest_progress", () => {
    recordGuestHand("BTN open", "correct");
    recordGuestHand("BB vs CO open", "wrong");
    recordGuestHand("BTN open", "mixed");
    expect(local.getItem(GUEST_HANDS_KEY)).toBe("3");
    const p = readProgress()!;
    expect(p).toMatchObject({ hands_played: 3, right: 2, wrong: 1, streak: 1, best_streak: 1 });
    expect(p.spots).toEqual({ "BTN open": { right: 2, wrong: 0 }, "BB vs CO open": { right: 0, wrong: 1 } });
    expect(JSON.parse(local.getItem(GUEST_PROGRESS_KEY)!)).toEqual(p);
  });

  it("survives a reload: the count continues from storage", () => {
    play(3);
    installWindow(local); // same storage, fresh page
    expect(recordGuestHand("BTN open", "correct")!.hands_played).toBe(4);
  });

  it("uses the server's streak rule: wrong resets, mixed keeps it, best is kept", () => {
    let p = emptyProgress();
    for (const v of ["correct", "mixed", "correct", "wrong", "correct"] as const) p = addHand(p, "x", v);
    expect(p.streak).toBe(1);
    expect(p.best_streak).toBe(3);
  });

  it("with storage blocked: counts nothing, so no prompt can ever be due", () => {
    installWindow(new BlockedStorage());
    expect(storageAvailable()).toBe(false);
    expect(recordGuestHand("BTN open", "correct")).toBeNull();
    expect(readProgress()).toBeNull();
    expect(readSeenPrompts()).toEqual([]);
  });

  it("ignores corrupted stored progress instead of crashing", () => {
    local.setItem(GUEST_PROGRESS_KEY, '{"v":1,"hands_played":-4}');
    expect(readProgress()).toBeNull();
    expect(recordGuestHand("BTN open", "correct")!.hands_played).toBe(1);
  });
});

describe("sign-up prompt", () => {
  it("appears after hand 5 and not at 6, 7, 8…", () => {
    const { prompts } = play(19);
    expect(prompts).toEqual([{ hand: 5, trigger: "hand_5" }]);
  });

  it("appears once more at hand 20, and never after that", () => {
    const { prompts } = play(40);
    expect(prompts).toEqual([
      { hand: 5, trigger: "hand_5" },
      { hand: 20, trigger: "hand_20" },
    ]);
  });

  it("is not shown again after a reload once it was seen", () => {
    play(5);
    installWindow(local);
    expect(promptDue(6, readSeenPrompts())).toBeNull();
  });

  it("a visitor who skipped past 20 (storage reset of the flags) gets the hand-20 prompt only", () => {
    expect(promptDue(23, [])).toBe("hand_20");
    markPromptSeen("hand_20");
    expect(promptDue(24, readSeenPrompts())).toBeNull();
  });

  it("shows the visitor's own result and the most-missed spot", () => {
    let p = emptyProgress();
    p = addHand(p, "BTN open", "correct");
    p = addHand(p, "BB vs BTN open", "wrong");
    p = addHand(p, "SB open", "wrong");
    p = addHand(p, "BB vs BTN open", "wrong");
    p = addHand(p, "BTN open", "mixed");
    expect(`${p.right}/${p.hands_played}`).toBe("2/5");
    expect(worstSpot(p)).toBe("BB vs BTN open");
    expect(worstSpot(addHand(emptyProgress(), "BTN open", "correct"))).toBeNull();
  });
});

describe("save-progress banner", () => {
  it("shows after the first prompt was closed, not before", () => {
    const { banner } = play(6);
    expect(banner).toEqual([false, false, false, false, true, true]);
  });

  it("can be closed for the session, and is back in a new session", () => {
    play(5);
    closeBannerForSession();
    expect(bannerVisible(readSeenPrompts(), bannerClosedThisSession())).toBe(false);
    installWindow(local); // new tab/session, same localStorage
    expect(bannerVisible(readSeenPrompts(), bannerClosedThisSession())).toBe(true);
  });
});

describe("migration after sign-up", () => {
  it("sends the progress to the account, then clears every guest key", async () => {
    play(6);
    rememberSignupIntent("trainer_prompt_5", "/preflop-trainer?type=def");
    const calls: unknown[] = [];
    const rpc: MergeRpc = async (fn, args) => {
      calls.push([fn, args.p_progress.hands_played, args.p_progress.right]);
      return { error: null };
    };
    expect(await mergeGuestProgressIntoAccount(rpc)).toBe("merged");
    expect(calls).toEqual([["merge_guest_trainer_progress", 6, 6]]);
    expect(readProgress()).toBeNull();
    expect(local.getItem(GUEST_HANDS_KEY)).toBeNull();
    expect(readSeenPrompts()).toEqual([]);
    expect(readSignupIntent()).toBeNull();
  });

  it("keeps the progress when the server fails, for the next try", async () => {
    play(5);
    expect(await mergeGuestProgressIntoAccount(async () => ({ error: { message: "boom" } }))).toBe("kept");
    expect(readProgress()!.hands_played).toBe(5);
  });

  it("does not call the server when there is nothing to merge", async () => {
    let called = false;
    expect(
      await mergeGuestProgressIntoAccount(async () => {
        called = true;
        return { error: null };
      }),
    ).toBe("nothing");
    expect(called).toBe(false);
  });
});

describe("sign-up intent", () => {
  it("remembers source and return path, and expires after a day", () => {
    rememberSignupIntent("trainer_banner", "/preflop-trainer?game=cash");
    const i = readSignupIntent()!;
    expect(i).toMatchObject({ source: "trainer_banner", return_to: "/preflop-trainer?game=cash" });
    expect(readSignupIntent(i.at + 25 * 60 * 60 * 1000)).toBeNull();
  });

  it("only ever returns to a same-site path", () => {
    expect(safeReturnPath("/preflop-trainer")).toBe("/preflop-trainer");
    for (const bad of ["//evil.com", "https://evil.com", "/\\evil.com", "", null]) expect(safeReturnPath(bad)).toBeNull();
    rememberSignupIntent("trainer_prompt_5", "//evil.com");
    expect(readSignupIntent()).toBeNull();
  });
});

describe("signed-in visitors", () => {
  it("are never treated as guests, nor while auth is still loading", () => {
    expect(isGuestVisitor({ id: "u1" }, false)).toBe(false);
    expect(isGuestVisitor(null, true)).toBe(false);
    expect(isGuestVisitor(null, false)).toBe(true);
  });

  it("the trainer counts guest hands only in its signed-out branch", () => {
    const src = readFileSync(path.resolve(__dirname, "../../../components/preflop-trainer/Trainer.tsx"), "utf-8");
    const branch = src.slice(src.indexOf("if (!signedIn) {"), src.indexOf("} else {", src.indexOf("if (!signedIn) {")));
    expect(branch).toContain("recordGuestHand(deal, g.verdict)");
    expect(src.match(/recordGuestHand\(/g)).toHaveLength(1);
  });
});
