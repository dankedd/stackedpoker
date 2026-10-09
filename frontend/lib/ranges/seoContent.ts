import type { ArticleSection } from "@/lib/seo/types";
import { DEFENSE_CHARTS, MTT_OPEN_CHARTS, PUSH_FOLD_CHARTS } from "./data";
import { pushValue } from "./logic";
import type { ChartAction } from "./types";

/**
 * "Practical examples" for the preflop range tool page — every number is read
 * from data/ranges/*.json at build time, so the article cannot drift from the
 * charts the widget shows (and changes with them if the data is replaced).
 */

const played = (actions: ChartAction[]) =>
  actions.filter((a) => a.key !== "fold").reduce((s, a) => s + a.pct, 0);

export function preflopRangeExamples(): ArticleSection {
  const rows: { term: string; description: string }[] = [];

  const btn = MTT_OPEN_CHARTS.filter((c) => c.pos === "BN" && [15, 25, 40, 60].includes(c.stack)).sort(
    (a, b) => a.stack - b.stack,
  );
  if (btn.length) {
    rows.push({
      term: "Button opening range by stack",
      description: btn
        .map((c) => `${c.stack}bb: ${played(c.actions).toFixed(1)}% of hands (${c.hr}, p. ${c.page})`)
        .join("; ") + ".",
    });
  }

  const sbPush = PUSH_FOLD_CHARTS.find((c) => c.pos === "SB");
  if (sbPush) {
    const v = pushValue(sbPush.grid["K2o"]);
    rows.push({
      term: "K2o from the small blind",
      description:
        v > 0
          ? `Shoved first in at ${v === 10 ? "every stack of 10bb or less" : `${v}bb or less`} (${sbPush.hr}, p. ${sbPush.page}).`
          : `Never shoved first in (${sbPush.hr}, p. ${sbPush.page}).`,
    });
  }

  const bbVsBtn = DEFENSE_CHARTS.find(
    (c) => c.group === "mtt" && c.hero === "BB" && c.vil === "BN" && c.stack === 25 && c.spot === "open",
  );
  if (bbVsBtn) {
    rows.push({
      term: "Big blind against a 25bb button open",
      description: `Continues with ${played(bbVsBtn.actions).toFixed(1)}% of hands: ${bbVsBtn.actions
        .filter((a) => a.key !== "fold")
        .map((a) => `${a.label.toLowerCase()} ${a.pct}%`)
        .join(", ")} (Hand Range ${bbVsBtn.n}, p. ${bbVsBtn.page}).`,
    });
  }

  return { heading: "Practical examples", definitions: rows };
}
