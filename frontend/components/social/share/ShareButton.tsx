"use client";

import { useMemo, useState } from "react";
import { Share2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { getHand } from "@/lib/handHistory/api";
import type { ParsedHand } from "@/lib/handHistory/types";
import { SHARE } from "@/lib/social/strings";
import { useSocialEnabled } from "@/hooks/useSocialEnabled";
import { cn } from "@/lib/utils";
import { ShareDialog } from "./ShareDialog";

/**
 * Opens the share dialog for one of the user's hands. Pass `hand` when it is
 * already loaded (replayer); otherwise it is fetched on the first click
 * (hands overview). Renders nothing while the social feature is off.
 */
export function ShareButton({ handId, hand, compact, className }: { handId: string; hand?: ParsedHand | null; compact?: boolean; className?: string }) {
  const enabled = useSocialEnabled();
  const supabase = useMemo(() => createClient(), []);
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState<ParsedHand | null>(hand ?? null);

  if (!enabled) return null;

  async function openDialog(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!loaded && !hand) {
      const row = await getHand(supabase, handId).catch(() => null);
      if (!row) {
        toast.error(SHARE.failed);
        return;
      }
      setLoaded(row.data);
    }
    setOpen(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        aria-label={SHARE.button}
        title={SHARE.button}
        data-share-hand={handId}
        className={cn(
          "inline-flex items-center justify-center gap-1.5 rounded-lg border border-border/60 text-sm font-medium text-foreground transition-colors hover:bg-white/[0.05]",
          compact ? "h-9 w-9" : "h-8 px-3",
          className,
        )}
      >
        <Share2 className="h-4 w-4" />
        {!compact && <span>{SHARE.button}</span>}
      </button>
      <ShareDialog open={open} onClose={() => setOpen(false)} handId={handId} hand={hand ?? loaded} />
    </>
  );
}
