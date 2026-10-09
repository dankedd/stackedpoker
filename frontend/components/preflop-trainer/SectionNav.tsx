"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PREFLOP_RANGES_PATH, PREFLOP_TRAINER_PATH } from "@/lib/ranges/feature";
import { cn } from "@/lib/utils";

const ITEMS = [
  { label: "Trainer", href: PREFLOP_TRAINER_PATH },
  { label: "Ranges", href: PREFLOP_RANGES_PATH },
];

/** Trainer | Ranges — the section's own sub-navigation, in the site's pill-tab style. */
export function SectionNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Preflop Trainer"
      className="inline-flex gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1"
    >
      {ITEMS.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-lg px-4 py-1.5 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
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
