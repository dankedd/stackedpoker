import Link from "next/link";
import { ArrowRight } from "lucide-react";
// Metadata only — never '@/lib/learn/curriculum'. See scripts/generateCurriculumPublic.ts.
import { LEARNING_MODULES } from "@/lib/learn/curriculumPublic.generated";
import { JOURNEY_STAGES } from "@/lib/learn/curriculumRoadmap";
import { getJourneyOverview } from "@/lib/learn/journey";
import { StatusBadge } from "@/components/layout/StatusBadge";
import { MarketingSectionHeader } from "@/components/landing/shared/MarketingSectionHeader";
import { MarketingGlassCard } from "@/components/landing/shared/MarketingGlassCard";
import { RevealOnScroll } from "@/components/landing/shared/RevealOnScroll";

const journeyOverview = getJourneyOverview({});
const MODULES_BY_ID = new Map(LEARNING_MODULES.map((m) => [m.id, m]));

function isComplete(status: string | undefined) {
  return !status || status === "complete";
}

// First 6 of the 13 Poker Journey stages — this is where every module built
// so far actually lives; the remaining 7 are roadmap-only.
const STAGES_SHOWN = JOURNEY_STAGES.slice(0, 6);

export const FEATURED_MODULE_IDS = ["poker-fundamentals-module", "blockers-module", "game-theory-foundations-module"];

// scroll-mt tracks the real measured header height (--sp-header-height, see
// Navbar.tsx/useMeasuredHeightVar) so Hero's "Explore the curriculum" link
// (which jumps to #curriculum) clears the fixed nav exactly, not a
// hardcoded guess.
export function LearningPath() {
  return (
    <section id="curriculum" className="relative py-20 md:py-28 bg-card/10 scroll-mt-[var(--sp-header-height,6rem)]">
      <div className="container mx-auto max-w-5xl px-4 sm:px-6">
        <RevealOnScroll>
          <MarketingSectionHeader
            eyebrow="A complete learning path"
            heading="From your first hand to game theory."
            body={`${journeyOverview.availableModules} of ${journeyOverview.totalRoadmapModules} Poker Journey modules are live today, with the full path already mapped out.`}
          />
        </RevealOnScroll>

        {/* Stage timeline */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-10">
          {STAGES_SHOWN.map((stage, i) => {
            const modules = stage.moduleIds.map((id) => MODULES_BY_ID.get(id)).filter(Boolean);
            const availableCount = modules.filter((m) => isComplete(m?.contentStatus)).length;
            const available = availableCount > 0;
            return (
              <RevealOnScroll key={stage.id} delayMs={i * 60}>
                <div className="sp-glass-interactive rounded-xl border border-border/40 bg-black/20 p-3.5 h-full">
                  <StatusBadge status={available ? "available" : "later"} className="text-[9px] mb-2.5 px-2 py-0.5" />
                  <p className="text-[13px] font-bold text-foreground leading-snug">{stage.title}</p>
                  <p className="text-[11px] text-muted-foreground/50 mt-1 leading-snug">{stage.subtitle}</p>
                </div>
              </RevealOnScroll>
            );
          })}
        </div>

        {/* Featured real modules */}
        <div className="grid sm:grid-cols-3 gap-4">
          {FEATURED_MODULE_IDS.map((id, i) => {
            const m = MODULES_BY_ID.get(id);
            if (!m) return null;
            return (
              <RevealOnScroll key={id} delayMs={i * 100}>
                <MarketingGlassCard interactive className="p-4 h-full">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-300/70 mb-1.5">
                    {m.estimatedLessons ?? "—"} lessons
                  </p>
                  <h3 className="text-sm font-bold text-foreground mb-1.5">{m.title}</h3>
                  <p className="text-[12px] text-muted-foreground/55 leading-relaxed mb-3">{m.subtitle}</p>
                  <Link
                    href={`/learn/module/${m.slug}`}
                    className="group inline-flex items-center gap-1.5 text-[12px] font-medium text-violet-400 hover:text-violet-300 transition-colors"
                  >
                    Start module
                    <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform duration-150" />
                  </Link>
                </MarketingGlassCard>
              </RevealOnScroll>
            );
          })}
        </div>

        <div className="mt-10 text-center">
          <Link
            href="/learn"
            className="group inline-flex items-center gap-2 text-[14px] font-medium text-violet-400 hover:text-violet-300 transition-colors"
          >
            See the full roadmap
            <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform duration-150" />
          </Link>
        </div>
      </div>
    </section>
  );
}
