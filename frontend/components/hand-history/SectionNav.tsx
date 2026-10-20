"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { HANDS_IMPORT_PATH, HANDS_MANUAL_LIST, HANDS_MANUAL_PATH, HANDS_PATH } from "@/lib/handHistory/feature";
import { t } from "@/lib/handHistory/strings";
import { cn } from "@/lib/utils";

type Item = { key: "overview" | "manual" | "import"; label: string; href: string };

const ITEMS: Item[] = [
  { key: "overview", label: t.section.overview, href: HANDS_PATH },
  { key: "manual", label: t.manual.navItem, href: HANDS_MANUAL_LIST },
  { key: "import", label: t.section.import, href: HANDS_IMPORT_PATH },
];

function activeKey(pathname: string, manualFilter: boolean): Item["key"] | null {
  if (pathname === HANDS_IMPORT_PATH) return "import";
  if (pathname.startsWith(HANDS_MANUAL_PATH)) return "manual";
  if (pathname === HANDS_PATH) return manualFilter ? "manual" : "overview";
  return null;
}

/** Overview | Manual hands | Import — same pill tabs as the Preflop Trainer section. */
export function SectionNav() {
  // The query string (?manual=1) needs a Suspense boundary; until it is
  // known, the tabs render from the path alone.
  return (
    <Suspense fallback={<Tabs manualFilter={false} />}>
      <TabsWithQuery />
    </Suspense>
  );
}

function TabsWithQuery() {
  return <Tabs manualFilter={useSearchParams().get("manual") === "1"} />;
}

function Tabs({ manualFilter }: { manualFilter: boolean }) {
  const current = activeKey(usePathname() ?? "", manualFilter);
  return (
    <nav aria-label={t.section.navLabel} className="inline-flex gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
      {ITEMS.map((item) => {
        const active = current === item.key;
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

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}
