"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { DASH } from "@/lib/dashboard/strings";
import { SHARED_HAND } from "@/lib/social/strings";

const choiceLabel = (c: string) => SHARED_HAND.choice[c] ?? c;

/**
 * Inline guess on a friend's shared hand (submit_hand_guess, the same RPC as
 * the /h page). After voting it shows your pick and the vote count; the full
 * hand and the split are one tap away.
 */
export function FeedVote({ slug, options, myChoice, votes }: { slug: string; options: string[]; myChoice: string | null; votes: number }) {
  const supabase = useMemo(() => createClient(), []);
  const [picked, setPicked] = useState(myChoice);
  const [count, setCount] = useState(votes);
  const [busy, setBusy] = useState(false);

  async function vote(choice: string) {
    setBusy(true);
    const { data, error } = await supabase.rpc("submit_hand_guess", { p_slug: slug, p_choice: choice });
    setBusy(false);
    if (error || !data) {
      toast.error(DASH.social.voteFailed);
      return;
    }
    const dist = (data as { distribution?: Record<string, number> }).distribution;
    setPicked(choice);
    setCount(dist ? Object.values(dist).reduce((a, n) => a + n, 0) : count + 1);
  }

  if (picked) {
    return (
      <p className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{DASH.social.voted(choiceLabel(picked), count)}</span>
        <Link href={`/h/${slug}`} className="font-medium text-violet-300 hover:text-violet-200">
          {DASH.social.open}
        </Link>
      </p>
    );
  }
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          disabled={busy}
          onClick={() => void vote(o)}
          className="h-9 min-w-[64px] flex-1 rounded-lg border border-border/60 px-3 text-sm font-semibold text-foreground transition-colors hover:border-violet-500/50 hover:bg-violet-500/10 disabled:opacity-60"
        >
          {choiceLabel(o)}
        </button>
      ))}
    </div>
  );
}
