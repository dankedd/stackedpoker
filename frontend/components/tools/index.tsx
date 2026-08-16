import type { ComponentType } from "react";
import { BankrollCalculator } from "./BankrollCalculator";
import { EquityCalculator } from "./EquityCalculator";
import { PokerHandAnalyzer } from "./PokerHandAnalyzer";
import { PositionTrainer } from "./PositionTrainer";
import { PotOddsCalculator } from "./PotOddsCalculator";
import { StartingHandQuiz } from "./StartingHandQuiz";
import { VarianceCalculator } from "./VarianceCalculator";

/**
 * Slug → interactive widget.
 *
 * This is a UI lookup, NOT a second content registry: the tool's slug, title,
 * metadata, educational body, FAQs, links and sitemap entry all still come
 * from lib/seo/content/tools.ts. All this decides is which React component
 * renders above that content.
 *
 * `widget: true` in the SEO registry and a key here must agree, and
 * lib/tools/__tests__/toolIntegration.test.ts fails the build if they ever
 * drift — a tool page that lost its calculator would otherwise still look
 * fine, just useless.
 */
export const TOOL_WIDGETS: Record<string, ComponentType> = {
  "pot-odds-calculator": PotOddsCalculator,
  "equity-calculator": EquityCalculator,
  "poker-hand-analyzer": PokerHandAnalyzer,
  "bankroll-calculator": BankrollCalculator,
  "variance-calculator": VarianceCalculator,
  "position-trainer": PositionTrainer,
  "starting-hand-quiz": StartingHandQuiz,
};

export function toolWidgetFor(slug: string): ComponentType | undefined {
  return TOOL_WIDGETS[slug];
}
