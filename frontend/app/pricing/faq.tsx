"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const FAQS = [
  {
    q: "Can I cancel anytime?",
    a: "Yes. Cancel from Settings → Manage subscription whenever you like. You keep Pro until the end of the month you paid for, then your account moves to Free. Nothing you uploaded is deleted.",
  },
  {
    q: "Is VAT included?",
    a: "Yes. €7.99 a month is the price you pay, VAT included. Stripe calculates the VAT for your country and shows it on your invoice.",
  },
  {
    q: "Which payment methods can I use?",
    a: "Card (Visa, Mastercard, American Express), iDEAL, Bancontact, Apple Pay and Google Pay. Payments go through Stripe; we never see your card details.",
  },
  {
    q: "What happens after the 7-day trial?",
    a: "New accounts get 7 days of Pro without a card. After that your account moves to Free automatically: no charge, nothing to cancel. Upgrade whenever you want to keep Pro.",
  },
  {
    q: "What happens to my tournaments on Free?",
    a: "They stay saved. Free shows your most recent tournament; upgrade to Pro and your full history is back.",
  },
];

export function PricingFAQ() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <div className="space-y-2">
      {FAQS.map((faq, i) => (
        <div key={i} className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] transition-colors duration-200 hover:border-white/20">
          <button
            onClick={() => setOpen(open === i ? null : i)}
            aria-expanded={open === i}
            className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors duration-150 hover:bg-white/[0.03]"
          >
            <span className="text-sm font-medium text-white">{faq.q}</span>
            <ChevronDown className={cn("h-4 w-4 shrink-0 text-white/50 transition-transform duration-200", open === i && "rotate-180")} />
          </button>

          <div className={cn("grid transition-[grid-template-rows] duration-300 ease-in-out", open === i ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
            <div className="overflow-hidden">
              <p className="border-t border-white/[0.06] px-5 pb-4 pt-3 text-sm leading-relaxed text-white/65">{faq.a}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
