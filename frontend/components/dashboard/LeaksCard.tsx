import Link from "next/link";
import { Play, Target } from "lucide-react";
import { ShareButton } from "@/components/social/share/ShareButton";
import type { LeakView } from "@/lib/dashboard/model";
import { DASH } from "@/lib/dashboard/strings";
import { HANDS_IMPORT_PATH, HANDS_PATH } from "@/lib/handHistory/feature";
import { cn } from "@/lib/utils";
import { Block, BlockLink, EmptyState } from "./Block";

const L = DASH.leaks;

/**
 * Block 3 — the newest preflop/flop mistakes from Hand Review, each opening
 * the replayer, with "Train this spot" and (when sharing is live) "Share & ask".
 */
export function LeaksCard({ leaks, hasHands, canShare }: { leaks: LeakView[]; hasHands: boolean; canShare: boolean }) {
  return (
    <Block title={L.heading} aside={hasHands ? <BlockLink href={HANDS_PATH}>{L.all}</BlockLink> : undefined}>
      {!hasHands ? (
        <EmptyState text={L.emptyNoHands} cta={L.emptyNoHandsCta} href={HANDS_IMPORT_PATH} />
      ) : leaks.length === 0 ? (
        <EmptyState text={L.emptyClean} cta={L.emptyCleanCta} href={HANDS_PATH} />
      ) : (
        <ul className="grid gap-2.5 md:grid-cols-3">
          {leaks.map((l) => (
            <li key={l.handId} className="flex flex-col rounded-xl border border-border/50 bg-white/[0.02] p-3">
              <Link href={l.href} className="group min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate font-mono text-[15px] font-bold text-foreground">{l.title}</p>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                      l.street === "preflop" ? "bg-blue-500/15 text-blue-300" : "bg-emerald-500/15 text-emerald-300",
                    )}
                  >
                    {l.street}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{l.spot}</p>
                <p className="mt-1.5 text-sm font-semibold text-orange-300">{l.verdict}</p>
                <span className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-violet-300 group-hover:text-violet-200">
                  <Play aria-hidden className="h-3 w-3" />
                  {L.replay}
                </span>
              </Link>
              <div className="mt-2.5 flex items-center gap-2 border-t border-border/40 pt-2.5">
                <Link
                  href={l.trainHref}
                  className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-violet-500/15 px-3 text-sm font-semibold text-violet-200 transition-colors hover:bg-violet-500/25"
                >
                  <Target aria-hidden className="h-3.5 w-3.5" />
                  {L.train}
                </Link>
                {canShare && <ShareButton handId={l.handId} label={L.share} className="h-9 px-3" />}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Block>
  );
}
