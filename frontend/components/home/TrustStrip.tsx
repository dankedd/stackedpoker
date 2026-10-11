"use client";

import { useState } from "react";
import { InView, useCountUp } from "./InView";

export type TrustItem = { label: string; value?: number; suffix?: string };

function Count({ to, run }: { to: number; run: boolean }) {
  return <>{useCountUp(to, run).toLocaleString("en-US")}</>;
}

/** Facts under the hero; numbers count up once when they come into view. */
export function TrustStrip({ items }: { items: TrustItem[] }) {
  const [run, setRun] = useState(false);
  if (!items.length) return null;
  return (
    <InView onEnter={() => setRun(true)} className="relative mx-auto mt-12 max-w-6xl px-4 sm:px-6" threshold={0.1}>
      <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-t border-white/10 pt-6 text-sm text-white/65">
        {items.map((it, n) => (
          <li key={it.label} className="hp-reveal flex items-baseline gap-1.5" style={{ ["--hp-i" as string]: n }}>
            {it.value != null && (
              <span className="font-mono text-base font-semibold text-white tabular-nums">
                <Count to={it.value} run={run} />
                {it.suffix}
              </span>
            )}
            <span>{it.label}</span>
          </li>
        ))}
      </ul>
    </InView>
  );
}
