"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const FAQS = [
  {
    q: "What's the difference between the plans?",
    a: "Free covers Module 1, Module 2, and the first lesson of every other module, plus XP, achievements, streaks, the leaderboard, a limited Range Trainer, and 3 AI Coach messages a day. Plus (€7.99/month) unlocks every Learn module — current and future — the full Range Trainer, the full Bankroll Tracker, your personal dashboard, and 15 AI Coach messages a day. Elite (€11.99/month) adds unlimited AI Coach messages plus the Solver Explorer and Solver Tree Explorer.",
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
    q: "What happens to my progress if I downgrade?",
    a: "Your XP, achievements, streak, and bankroll history are always yours. If you downgrade, you revert to the lower plan's access, but nothing you've already earned or logged is ever deleted.",
  },
  {
    q: "Is there a free trial for Plus or Elite?",
    a: "There's no timed trial, but the Free plan lets you experience the platform's core teaching quality before upgrading. No credit card required to start.",
  },
  {
    q: "Does it work on mobile?",
    a: "Yes. The full web app is responsive and runs in any modern mobile browser — no app installation required.",
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
