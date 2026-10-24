"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/** Asks the database to recompute stale stats once, then re-renders the page. */
export function StatsRefresher({ handle }: { handle: string }) {
  const router = useRouter();
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    createClient()
      .rpc("refresh_profile_stats", { p_handle: handle })
      .then(({ data }) => {
        if (data === true) router.refresh();
      });
  }, [handle, router]);
  return null;
}
