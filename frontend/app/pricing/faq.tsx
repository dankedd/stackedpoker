"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const FAQS = [
  {
    q: "What's the difference between the plans?",
    a: "Free gives you core analysis to try the platform. Pro (€14.99/month) unlocks advanced analysis, AI coaching, extended replay tools, expanded puzzle access, leak detection, and training history. Premium (€34.99/month) includes everything in Pro plus advanced solver-backed analysis, premium coaching, advanced leak intelligence, priority features, and premium study systems.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes, absolutely. Cancel from your account settings whenever you like. You keep full access to your current plan until the end of the billing period — no partial refunds, no hassle.",
  },
  {
    q: "What payment methods are accepted?",
    a: "We accept iDEAL (Netherlands), all major credit and debit cards, Apple Pay, and Google Pay — all processed securely through Stripe.",
  },
  {
    q: "Is my payment information secure?",
    a: "All payments go through Stripe, a PCI DSS Level 1 certified processor trusted by millions of businesses. We never see or store your card details.",
  },
  {
    q: "What happens to my saved hands if I downgrade?",
    a: "Your previously analyzed hands are always yours. If you downgrade, you revert to the lower plan's daily limits, but every hand history you already saved stays in your account and remains viewable.",
  },
  {
    q: "Is there a free trial for Pro or Premium?",
    a: "There's no timed trial, but the Free plan lets you run analyses to experience the full coaching quality before upgrading. No credit card required to start.",
  },
  {
    q: "Does it work on mobile?",
    a: "Yes. The full web app is responsive and runs in any modern mobile browser — no app installation required.",
  },
  {
    q: "Which poker sites are supported?",
    a: "GGPoker and PokerStars hand history formats are fully supported, including ZIP exports from PokerCraft. Additional sites may be added in future updates.",
  },
];

export function PricingFAQ() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <div className="space-y-2">
      {FAQS.map((faq, i) => (
        <div
          key={i}
          className="rounded-xl border border-border/50 bg-card/60 overflow-hidden hover:border-border/70 transition-colors duration-200"
        >
          <button
            onClick={() => setOpen(open === i ? null : i)}
            className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-secondary/20 transition-colors duration-150"
          >
            <span className="text-sm font-medium text-foreground">{faq.q}</span>
            <ChevronDown
              className={cn(
                "h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200",
                open === i && "rotate-180",
              )}
            />
          </button>

          <div className={cn(
            "grid transition-[grid-template-rows] duration-300 ease-in-out",
            open === i ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
          )}>
            <div className="overflow-hidden">
              <p className="px-5 pb-4 pt-3 text-sm text-muted-foreground leading-relaxed border-t border-border/30">
                {faq.a}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
