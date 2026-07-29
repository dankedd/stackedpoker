import {
  ILLUSTRATIVE_OPENER_RANGE,
  ILLUSTRATIVE_CALLER_RANGE,
  CO_OPEN_RANGE_40BB_PCT,
  BB_CALL_RANGE_40BB_PCT,
} from "@/lib/learn/rangeVsRangeContent";
import { PokerRangeGrid } from "@/components/learn/visuals/PokerRangeGrid";
import { RangeComparisonLayout } from "@/components/learn/visuals/RangeComparisonLayout";
import { MarketingSectionHeader } from "@/components/landing/shared/MarketingSectionHeader";
import { MarketingGlassCard } from "@/components/landing/shared/MarketingGlassCard";

/** Range vs Range — the real illustrative ranges used in the built "Range vs
 *  Range" module (lib/learn/rangeVsRangeContent.ts), not invented data. */
export function RangeThinking() {
  return (
    <section className="relative py-20 md:py-28 bg-background">
      <div className="container mx-auto max-w-5xl px-4 sm:px-6">
        <MarketingSectionHeader
          eyebrow="Think in ranges"
          heading="See the strategy behind the hand."
          body="Every real decision is one hand pulled from a whole range. StackedPoker teaches you to see both sides at once — not just the cards in front of you."
        />

        <MarketingGlassCard className="p-5 sm:p-6">
          <RangeComparisonLayout sideBySideFrom="sm" gapClassName="gap-6">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-violet-300/70 mb-2.5">
                CO opening range · {CO_OPEN_RANGE_40BB_PCT}%
              </p>
              <PokerRangeGrid range={ILLUSTRATIVE_OPENER_RANGE} size="compact" mode="membership" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-300/70 mb-2.5">
                BB calling range · {BB_CALL_RANGE_40BB_PCT}%
              </p>
              <PokerRangeGrid range={ILLUSTRATIVE_CALLER_RANGE} size="compact" mode="membership" />
            </div>
          </RangeComparisonLayout>
          <p className="mt-5 text-sm text-muted-foreground/60 leading-relaxed">
            Range vs Range — one of ten complete modules — is where StackedPoker moves past hand-vs-hand
            thinking and into how two ranges interact on a board.
          </p>
        </MarketingGlassCard>
      </div>
    </section>
  );
}
