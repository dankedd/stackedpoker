"use client";

import { useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { SETTINGS } from "@/lib/lifecycle/strings";
import { cn } from "@/lib/utils";

/** Training-reminder emails on/off (profiles.email_opt_out, via set_email_opt_out()). */
export function EmailPreferences({ optedOut }: { optedOut: boolean }) {
  const [on, setOn] = useState(!optedOut);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    const next = !on;
    setOn(next);
    setBusy(true);
    const { error } = await createClient().rpc("set_email_opt_out", { p_opt_out: !next });
    setBusy(false);
    if (error) {
      setOn(!next);
      toast.error(SETTINGS.error);
    } else {
      toast.success(SETTINGS.saved);
    }
  }

  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p id="email-reminders-label" className="text-sm font-medium text-foreground">
          {SETTINGS.label}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground/70">{SETTINGS.help}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-labelledby="email-reminders-label"
        onClick={toggle}
        disabled={busy}
        className={cn(
          "relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C5CFF] disabled:opacity-60",
          on ? "border-violet-500/60 bg-violet-500" : "border-border bg-card",
        )}
      >
        <span
          aria-hidden="true"
          className={cn("inline-block h-4 w-4 rounded-full bg-white shadow transition-transform", on ? "translate-x-6" : "translate-x-1")}
        />
      </button>
    </div>
  );
}
