"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { createClient } from "@/lib/supabase/client";
import { mergeGuestProgressIntoAccount, readProgress, readSignupIntent } from "@/lib/ranges/guestProgress";

/** Fired on window once guest hands are in the account, so the trainer reloads its numbers. */
export const GUEST_MERGED_EVENT = "sp-guest-progress-merged";

/**
 * Moves Preflop Trainer progress made while signed out into the account, on
 * the first page after sign-up (Google), email confirmation, or log-in.
 * Mounted once from the root layout because those land on different pages.
 *
 * Local progress is cleared only after the server confirmed the merge; on an
 * error it stays and the next signed-in page load tries again. A visitor who
 * came from the trainer's prompt is sent back to the same trainer setup.
 */
export function GuestProgressSync() {
  const { user } = useAuth();
  const router = useRouter();
  const running = useRef(false);

  useEffect(() => {
    if (!user || running.current) return;
    const progress = readProgress();
    if (!progress || progress.hands_played === 0) return;
    running.current = true;
    const intent = readSignupIntent();
    const supabase = createClient();
    void mergeGuestProgressIntoAccount((fn, args) => supabase.rpc(fn, args)).then((result) => {
      running.current = false;
      if (result !== "merged") return;
      window.dispatchEvent(new Event(GUEST_MERGED_EVENT));
      toast.success("Progress saved.");
      if (intent && !window.location.pathname.startsWith("/preflop-trainer")) router.replace(intent.return_to);
    });
  }, [user, router]);

  return null;
}
