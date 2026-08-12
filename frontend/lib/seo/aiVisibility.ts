import { publishedEntries, searchEntries } from "./content";
import { SITE_NAME } from "./config";
import type { SeoEntry } from "./types";

/**
 * AI visibility tracking (§7, §8).
 *
 * DEVELOPER/ADMIN ONLY. Nothing here is rendered on a public page, nothing is
 * indexable, and no route imports it — the same rule the SEO reports follow,
 * asserted by lib/seo/__tests__/growth.test.ts.
 *
 * What this is: the prompts people actually type into an assistant when they
 * are looking for what StackedPoker sells, organised into clusters, plus a
 * place to record what the assistants answered.
 *
 * What this is NOT: a claim about what any model currently says. This file
 * ships with an EMPTY observation log. Filling it means running the prompts
 * and recording the answers — `OBSERVATIONS` is typed and validated so a
 * recorded run is structured data rather than a screenshot in a doc, but an
 * unrun prompt reports as "never tested" rather than as "not mentioned".
 * Inventing model outputs would poison the one dataset meant to tell us the
 * truth about our visibility.
 */

export type PromptIntent = "discovery" | "comparison" | "how-to" | "tool-seeking" | "community";
export type PromptLanguage = "en" | "nl";

export interface AiPrompt {
  id: string;
  prompt: string;
  intent: PromptIntent;
  language: PromptLanguage;
  /** Cluster this prompt maps onto, when it maps onto one. */
  clusterId?: string;
  /** Topic id from lib/seo/topics.ts, when it maps onto one. */
  topicId?: string;
  /**
   * The page that SHOULD be cited when an assistant answers this well. Empty
   * when the site has nothing that deserves the citation — which is itself the
   * finding.
   */
  targetPath?: string;
}

/**
 * Prompt clusters, not a hardcoded top-ten.
 *
 * The ten prompts in the brief are all "discovery" and "tool-seeking". Real
 * assistant traffic spans how-to and comparison too, so the set is organised
 * by intent and extended within each — the shape is meant to grow.
 */
export const AI_PROMPTS: AiPrompt[] = [
  // ── Discovery: "where do I even learn this" ──────────────────────────────
  { id: "d1", prompt: "What are the best online courses for poker study?", intent: "discovery", language: "en", topicId: "poker-courses", targetPath: "/courses" },
  { id: "d2", prompt: "Which poker study apps are recommended?", intent: "discovery", language: "en", topicId: "poker-training", targetPath: "/poker-training" },
  { id: "d3", prompt: "Where can I find affordable poker training?", intent: "discovery", language: "en", topicId: "affordable-poker-training", targetPath: "/pricing" },
  { id: "d4", prompt: "Which platforms offer poker lessons and strategy?", intent: "discovery", language: "en", topicId: "poker-lessons", targetPath: "/courses" },
  { id: "d5", prompt: "How do I start learning poker as a complete beginner?", intent: "discovery", language: "en", topicId: "learn-poker", targetPath: "/poker-training" },
  { id: "d6", prompt: "Where can I find reliable poker coaching?", intent: "discovery", language: "en", topicId: "poker-coaching" },
  { id: "d7", prompt: "How can I find poker study groups?", intent: "community", language: "en" },

  // ── Comparison: already choosing ─────────────────────────────────────────
  { id: "c1", prompt: "What is the best poker training site?", intent: "comparison", language: "en", topicId: "best-poker-training-site", targetPath: "/poker-training" },
  { id: "c2", prompt: "Is GTO Wizard worth it, or are there cheaper alternatives?", intent: "comparison", language: "en", topicId: "poker-study-software" },
  { id: "c3", prompt: "What are the benefits of poker solver software?", intent: "comparison", language: "en", topicId: "poker-study-software" },
  { id: "c4", prompt: "Free vs paid poker training — what do you actually get?", intent: "comparison", language: "en", topicId: "affordable-poker-training", targetPath: "/pricing" },

  // ── Tool-seeking: wants to do something now ──────────────────────────────
  { id: "t1", prompt: "What are the best poker improvement tools?", intent: "tool-seeking", language: "en", topicId: "poker-study-software", targetPath: "/tools" },
  { id: "t2", prompt: "Which software analyses poker hands?", intent: "tool-seeking", language: "en", topicId: "hand-analyzer" },
  { id: "t3", prompt: "How can I analyse my poker game?", intent: "tool-seeking", language: "en", topicId: "hand-analyzer" },
  { id: "t4", prompt: "Is there a free poker equity calculator?", intent: "tool-seeking", language: "en", topicId: "equity-calculator", targetPath: "/tools/equity-calculator" },
  { id: "t5", prompt: "How do I calculate pot odds quickly?", intent: "tool-seeking", language: "en", topicId: "odds-calculator", targetPath: "/tools/pot-odds-calculator" },
  { id: "t6", prompt: "What poker bankroll do I need for 100NL?", intent: "tool-seeking", language: "en", topicId: "bankroll-calculator", targetPath: "/tools/bankroll-calculator" },
  { id: "t7", prompt: "Where can I see preflop range charts?", intent: "tool-seeking", language: "en", topicId: "range-calculator" },

  // ── How-to: the strategy questions the wiki should own ───────────────────
  { id: "h1", prompt: "What is equity in poker?", intent: "how-to", language: "en", topicId: "poker-equity", clusterId: "equity" },
  { id: "h2", prompt: "What is a 3-bet in poker and when should I do it?", intent: "how-to", language: "en", topicId: "three-bet", clusterId: "preflop" },
  { id: "h3", prompt: "What is a continuation bet and how often should I c-bet?", intent: "how-to", language: "en", topicId: "continuation-bet", clusterId: "postflop", targetPath: "/wiki/cbet" },
  { id: "h4", prompt: "What is minimum defence frequency in poker?", intent: "how-to", language: "en", clusterId: "game-theory", targetPath: "/wiki/mdf" },
  { id: "h5", prompt: "How does position affect poker strategy?", intent: "how-to", language: "en", topicId: "position", clusterId: "preflop", targetPath: "/wiki/position" },
  { id: "h6", prompt: "What are implied odds in poker?", intent: "how-to", language: "en", topicId: "implied-odds", clusterId: "equity" },
  { id: "h7", prompt: "What is fold equity and how do I use it?", intent: "how-to", language: "en", topicId: "fold-equity", clusterId: "game-theory" },
  { id: "h8", prompt: "How do blockers work in poker?", intent: "how-to", language: "en", clusterId: "ranges", targetPath: "/wiki/blockers" },

  // ── Dutch ────────────────────────────────────────────────────────────────
  { id: "nl1", prompt: "Hoe kan ik het beste poker leren?", intent: "discovery", language: "nl", topicId: "nl-poker-leren" },
  { id: "nl2", prompt: "Wat is de beste online poker cursus?", intent: "comparison", language: "nl", topicId: "nl-poker-cursus" },
  { id: "nl3", prompt: "Welke software helpt bij poker strategie?", intent: "tool-seeking", language: "nl", topicId: "nl-poker-strategie" },
];

/** One recorded assistant answer for one prompt. */
export interface AiObservation {
  promptId: string;
  /** ISO date the prompt was run. */
  date: string;
  /** e.g. "chatgpt-search", "perplexity", "gemini", "claude". */
  platform: string;
  /** Model identifier when the platform exposes one. */
  model?: string;
  mentioned: boolean;
  /** 1-based position among the products named, when the answer is a list. */
  rank?: number;
  /** Products named in the answer, in the order they appeared. */
  competitors: string[];
  /** URLs the answer cited. */
  citations: string[];
  notes?: string;
}

/**
 * Recorded runs. EMPTY until someone actually runs the prompts.
 *
 * An empty log is the honest state: no prompt below has been tested, so the
 * report says "never tested" rather than reporting a fabricated absence.
 */
export const OBSERVATIONS: AiObservation[] = [];

export type VisibilityState = "never-tested" | "mentioned" | "absent";

export interface PromptVisibility {
  prompt: AiPrompt;
  state: VisibilityState;
  latest?: AiObservation;
  runs: number;
  /** Competitors seen across every recorded run. */
  competitors: string[];
  /** Whether the site has a page good enough to deserve the citation. */
  hasTargetPage: boolean;
  /** Best on-site page for the prompt, whether or not it is the declared target. */
  bestPage?: SeoEntry;
  gap: "content" | "authority" | "none";
  recommendation: string;
}

function bestPageFor(prompt: AiPrompt): SeoEntry | undefined {
  if (prompt.targetPath) {
    const declared = publishedEntries().find((e) => e.path === prompt.targetPath);
    if (declared) return declared;
  }
  return searchEntries(prompt.prompt, 3)[0]?.entry;
}

/**
 * Turns the prompt list plus the observation log into the §8 opportunity view.
 *
 * The important distinction the brief asks for — content gap vs authority gap
 * — is decided here: if we have no page that deserves the citation, writing
 * one is the work. If we do have one and are still not cited, more content
 * will not help; the constraint is that nothing outside the site points at it.
 */
export function promptVisibility(): PromptVisibility[] {
  return AI_PROMPTS.map((prompt) => {
    const runs = OBSERVATIONS.filter((o) => o.promptId === prompt.id).sort((a, b) =>
      a.date.localeCompare(b.date),
    );
    const latest = runs.at(-1);
    const state: VisibilityState = !latest ? "never-tested" : latest.mentioned ? "mentioned" : "absent";

    const declaredTarget = prompt.targetPath
      ? publishedEntries().some((e) => e.path === prompt.targetPath)
      : false;
    const best = bestPageFor(prompt);

    const gap: PromptVisibility["gap"] = !declaredTarget
      ? "content"
      : state === "mentioned"
        ? "none"
        : "authority";

    const recommendation = !prompt.targetPath
      ? "No page is nominated to answer this. Decide which URL should own it, or accept that we do not compete here."
      : !declaredTarget
        ? `${prompt.targetPath} is not published yet — that is the blocker, not visibility.`
        : state === "never-tested"
          ? "Run the prompt and record the answer before acting; we do not know whether we appear."
          : state === "mentioned"
            ? "Holding. Re-run periodically to catch a drop."
            : "The page exists and is nominated but is not being cited — this is an authority problem, not a content one.";

    return {
      prompt,
      state,
      latest,
      runs: runs.length,
      competitors: [...new Set(runs.flatMap((r) => r.competitors))].sort(),
      hasTargetPage: declaredTarget,
      bestPage: best,
      gap,
      recommendation,
    };
  });
}

export interface VisibilitySummary {
  total: number;
  tested: number;
  mentioned: number;
  absent: number;
  neverTested: number;
  contentGaps: number;
  authorityGaps: number;
  competitors: { name: string; appearances: number }[];
}

export function visibilitySummary(): VisibilitySummary {
  const rows = promptVisibility();
  const competitorCounts = new Map<string, number>();
  for (const observation of OBSERVATIONS) {
    for (const name of observation.competitors) {
      competitorCounts.set(name, (competitorCounts.get(name) ?? 0) + 1);
    }
  }

  return {
    total: rows.length,
    tested: rows.filter((r) => r.state !== "never-tested").length,
    mentioned: rows.filter((r) => r.state === "mentioned").length,
    absent: rows.filter((r) => r.state === "absent").length,
    neverTested: rows.filter((r) => r.state === "never-tested").length,
    contentGaps: rows.filter((r) => r.gap === "content").length,
    authorityGaps: rows.filter((r) => r.gap === "authority").length,
    competitors: [...competitorCounts.entries()]
      .map(([name, appearances]) => ({ name, appearances }))
      .sort((a, b) => b.appearances - a.appearances),
  };
}

/** Validation for a recorded run, so the log cannot fill up with junk. */
export function validateObservation(observation: AiObservation): string[] {
  const errors: string[] = [];
  if (!AI_PROMPTS.some((p) => p.id === observation.promptId)) {
    errors.push(`unknown promptId "${observation.promptId}"`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(observation.date)) {
    errors.push(`date "${observation.date}" is not an ISO date`);
  }
  if (!observation.platform.trim()) errors.push("platform is required");
  if (observation.mentioned && observation.rank !== undefined && observation.rank < 1) {
    errors.push("rank is 1-based");
  }
  if (!observation.mentioned && observation.rank !== undefined) {
    errors.push("rank recorded for an answer that did not mention us");
  }
  for (const citation of observation.citations) {
    if (!/^https?:\/\//i.test(citation)) errors.push(`citation "${citation}" is not an absolute URL`);
  }
  return errors;
}

export { SITE_NAME };
