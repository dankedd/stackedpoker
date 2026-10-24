"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { DISPLAY_NAME, displayNameFormatError } from "@/lib/profile/strings";
import { cn } from "@/lib/utils";

/** The public leaderboard name (profiles.display_name, via set_my_display_name()). */
export function DisplayNameForm({ current }: { current: string | null }) {
  const router = useRouter();
  const [value, setValue] = useState(current ?? "");
  const [saved, setSaved] = useState(current ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const dirty = value.trim() !== saved;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const formatError = displayNameFormatError(value);
    if (formatError) {
      setError(formatError);
      return;
    }
    setBusy(true);
    setError(null);
    const { data, error: rpcError } = await createClient().rpc("set_my_display_name", { p_name: value.trim() });
    setBusy(false);
    const res = data as { ok?: boolean; error?: string; display_name?: string | null } | null;
    if (rpcError || !res) {
      setError(DISPLAY_NAME.errors.generic);
      return;
    }
    if (!res.ok) {
      setError(DISPLAY_NAME.errors[res.error ?? ""] ?? DISPLAY_NAME.errors.generic);
      return;
    }
    const next = res.display_name ?? "";
    setValue(next);
    setSaved(next);
    toast.success(next ? DISPLAY_NAME.saved : DISPLAY_NAME.cleared);
    router.refresh();
  }

  return (
    <form onSubmit={save} className="space-y-1.5">
      <label htmlFor="display-name" className="text-sm text-muted-foreground">
        {DISPLAY_NAME.label}
      </label>
      <div className="flex gap-2">
        <input
          id="display-name"
          type="text"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          placeholder={DISPLAY_NAME.placeholder}
          maxLength={20}
          autoComplete="nickname"
          aria-invalid={Boolean(error)}
          aria-describedby="display-name-help"
          style={{ fontSize: "16px" }}
          className={cn(
            "h-9 min-w-0 flex-1 rounded-lg border bg-background/60 px-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-[#7C5CFF]",
            error ? "border-red-500/60" : "border-border/60",
          )}
        />
        <button
          type="submit"
          disabled={busy || !dirty}
          className="h-9 shrink-0 rounded-lg bg-[#7C5CFF] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#6B4BEE] disabled:opacity-50"
        >
          {busy ? DISPLAY_NAME.saving : DISPLAY_NAME.save}
        </button>
      </div>
      {error ? (
        <p role="alert" className="text-xs text-red-400">
          {error}
        </p>
      ) : (
        <p id="display-name-help" className="text-xs text-muted-foreground/70">
          {DISPLAY_NAME.help}
        </p>
      )}
    </form>
  );
}
