"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { HANDLE, handleFormatError, normalizeHandle } from "@/lib/social/strings";
import { cn } from "@/lib/utils";

type SetHandleResult = { ok?: boolean; error?: string; handle?: string; next_change_at?: string } | null;

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

/** Saves through set_my_handle(); the database enforces every rule. */
export async function saveHandle(value: string): Promise<{ handle: string } | { error: string }> {
  const formatError = handleFormatError(value);
  if (formatError) return { error: formatError };
  const { data, error } = await createClient().rpc("set_my_handle", { p_handle: normalizeHandle(value) });
  const res = data as SetHandleResult;
  if (error || !res) return { error: HANDLE.errors.generic };
  if (!res.ok) {
    const msg = HANDLE.errors[res.error ?? ""] ?? HANDLE.errors.generic;
    return { error: res.next_change_at ? `${msg} ${HANDLE.nextChange(fmtDate(res.next_change_at))}` : msg };
  }
  return { handle: res.handle ?? normalizeHandle(value) };
}

/** The public @username (profiles.handle). */
export function HandleForm({ current, nextChangeAt }: { current: string | null; nextChangeAt: string | null }) {
  const router = useRouter();
  const [value, setValue] = useState(current ?? "");
  const [saved, setSaved] = useState(current ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const locked = Boolean(current && nextChangeAt && new Date(nextChangeAt) > new Date());
  const dirty = normalizeHandle(value) !== saved;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await saveHandle(value);
    setBusy(false);
    if ("error" in res) {
      setError(res.error);
      return;
    }
    setValue(res.handle);
    setSaved(res.handle);
    toast.success(HANDLE.saved);
    router.refresh();
  }

  return (
    <form onSubmit={save} className="space-y-1.5">
      <label htmlFor="handle" className="text-sm text-muted-foreground">
        {HANDLE.label}
      </label>
      <div className="flex gap-2">
        <div
          className={cn(
            "flex h-9 min-w-0 flex-1 items-center rounded-lg border bg-background/60 pl-3 focus-within:ring-2 focus-within:ring-[#7C5CFF]",
            error ? "border-red-500/60" : "border-border/60",
          )}
        >
          <span className="text-sm text-muted-foreground/70" aria-hidden>
            @
          </span>
          <input
            id="handle"
            type="text"
            value={value}
            onChange={(e) => {
              setValue(e.target.value.toLowerCase());
              setError(null);
            }}
            placeholder={HANDLE.placeholder}
            maxLength={21}
            disabled={locked}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            aria-invalid={Boolean(error)}
            aria-describedby="handle-help"
            style={{ fontSize: "16px" }}
            className="h-full min-w-0 flex-1 bg-transparent pr-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none disabled:opacity-60"
          />
        </div>
        <button
          type="submit"
          disabled={busy || !dirty || locked}
          className="h-9 shrink-0 rounded-lg bg-[#7C5CFF] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#6B4BEE] disabled:opacity-50"
        >
          {busy ? HANDLE.saving : HANDLE.save}
        </button>
      </div>
      {error ? (
        <p role="alert" className="text-xs text-red-400">
          {error}
        </p>
      ) : (
        <p id="handle-help" className="text-xs text-muted-foreground/70">
          {locked && nextChangeAt ? HANDLE.nextChange(fmtDate(nextChangeAt)) : HANDLE.help}
        </p>
      )}
    </form>
  );
}
