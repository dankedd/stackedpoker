"use client";

import { useEffect, useState } from "react";
import { useNow } from "@/components/billing/UpgradeUi";
import { clockUntil } from "@/lib/dashboard/hero";
import { DASH } from "@/lib/dashboard/strings";

/** "New spots in 04:12", ticking. Rendered after mount, so server and client HTML agree. */
export function ResetClock({ to }: { to: string }) {
  const now = useNow(15_000);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return <span className="tabular-nums">{mounted ? DASH.hero.limit.newSpotsIn(clockUntil(to, now)) : " "}</span>;
}
