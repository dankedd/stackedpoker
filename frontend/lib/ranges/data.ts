import openJson from "@/data/ranges/open.json";
import pushFoldJson from "@/data/ranges/pushfold.json";
import defenseJson from "@/data/ranges/defense.json";
import type { DefenseChart, OpenChart, PushFoldChart } from "./types";

/**
 * Typed views over data/ranges/*.json — the single swap point for the data.
 *
 * Provenance of the current files: Michael Acevedo, "Modern Poker Theory"
 * (D&B Publishing, 2019), chapters 5 and 7. Per-hand frequencies were read
 * off the book's chart images (±1–2 points); the aggregate `pct` per action
 * is the book's own printed figure. Deliberately independent of
 * lib/learn/mttRfiBaselines.ts (a separate extraction used by the lessons) so
 * this dataset can be replaced without touching the curriculum.
 */
// Shapes are enforced by lib/ranges/__tests__/data.test.ts, not by the cast.
export const OPEN_CHARTS = openJson as unknown as OpenChart[];
export const PUSH_FOLD_CHARTS = pushFoldJson as unknown as PushFoldChart[];
export const DEFENSE_CHARTS = defenseJson as unknown as DefenseChart[];

export const MTT_OPEN_CHARTS = OPEN_CHARTS.filter((c) => c.group === "mtt");
export const CASH_OPEN_CHARTS = OPEN_CHARTS.filter((c) => c.group === "cash");

export const SOURCE_CREDIT =
  "Modern Poker Theory by Michael Acevedo (D&B Publishing, 2019)";
