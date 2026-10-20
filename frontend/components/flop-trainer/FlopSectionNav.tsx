"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FLOP_EXPLORER_PATH, FLOP_QUICK_FIRE_PATH, FLOP_TRAINER_PATH } from "@/lib/flopTrainer/feature";
import { cn } from "@/lib/utils";

const ITEMS = [
  { label: "Trainer", href: FLOP_TRAINER_PATH },
  { label: "Quick fire", href: FLOP_QUICK_FIRE_PATH },
  { label: "Explorer", href: FLOP_EXPLORER_PATH },
];

/** Trainer | Quick fire | Explorer — same pill tabs as the Preflop Trainer section. */
export function FlopSectionNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Flop Trainer" className="inline-flex gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
      {ITEMS.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-lg px-3 py-1.5 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-4",
              active ? "bg-violet-500/20 text-violet-100" : "text-slate-400 hover:text-white",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
