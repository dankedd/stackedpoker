import { MarketingSectionHeader } from "@/components/landing/shared/MarketingSectionHeader";
import { MarketingGlassCard } from "@/components/landing/shared/MarketingGlassCard";
import { CoachPreviewCard } from "@/components/landing/shared/CoachPreviewCard";

/**
 * Marketing-only stand-in for the real AI Coach — see
 * `components/learn/coach/LessonCoachDrawer.tsx` / `CoachChat.tsx` for the
 * live version, which requires an authenticated session and a real lesson
 * context. This section reuses the same visual language (see
 * `CoachPreviewCard`) with a scripted exchange instead.
 */
export function CoachSection() {
  return (
    <section className="relative py-20 md:py-28 bg-background">
      <div className="container mx-auto max-w-3xl px-4 sm:px-6">
        <MarketingSectionHeader
          eyebrow="Help when you need it"
          heading="Your coach knows what you're learning."
          body="No generic chatbot, no leaving the lesson — the AI Coach understands the exact concept and step you're on."
        />

        <MarketingGlassCard elevated className="p-6 sm:p-8">
          <CoachPreviewCard
            size="full"
            question="Why does this blocker matter?"
            hint="Think about the hands your opponent needs to keep betting for value. If you're holding one of their key cards, how does that change how often they can actually have those hands?"
          />
        </MarketingGlassCard>
      </div>
    </section>
  );
}
