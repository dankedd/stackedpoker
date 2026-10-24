"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AtSign, X } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { HANDLE, HANDLE_PROMPT, normalizeHandle } from "@/lib/social/strings";
import { saveHandle } from "./HandleForm";

const DISMISS_KEY = "sp_handle_prompt_dismissed";

/**
 * Dashboard card asking an account without a username to pick one, prefilled
 * with suggest_my_handle(). Dismissable per device; it returns on another
 * device until a username is set. Not a modal: it never covers content.
 */
export function HandlePrompt() {
  const router = useRouter();
  const [hidden, setHidden] = useState(true);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(DISMISS_KEY)) return;
    } catch {
      // Storage blocked: show the card anyway.
    }
    setHidden(false);
    createClient()
      .rpc("suggest_my_handle")
      .then(({ data }) => {
        if (typeof data === "string") setValue((v) => v || data);
      });
  }, []);

  if (hidden) return null;

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Ignore: the card just comes back next visit.
    }
    setHidden(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await saveHandle(value);
    setBusy(false);
    if ("error" in res) {
      setError(res.error);
      return;
    }
    toast.success(HANDLE.saved);
    setHidden(true);
    router.refresh();
  }

  return (
    <section
      aria-labelledby="handle-prompt-title"
      className="relative rounded-xl border border-violet-500/30 bg-violet-500/[0.06] p-4 sm:p-5"
    >
      <button
        type="button"
        onClick={dismiss}
        aria-label={HANDLE_PROMPT.later}
        className="absolute right-2 top-2 rounded-md p-2 text-muted-foreground hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-start gap-3 pr-8">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 text-violet-400">
          <AtSign className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <h2 id="handle-prompt-title" className="font-semibold text-foreground">
            {HANDLE_PROMPT.title}
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{HANDLE_PROMPT.body}</p>
        </div>
      </div>
      <form onSubmit={submit} className="mt-3 flex flex-col gap-2 sm:flex-row">
        <div className="flex h-10 min-w-0 flex-1 items-center rounded-lg border border-border/60 bg-background/60 pl-3 focus-within:ring-2 focus-within:ring-[#7C5CFF]">
          <span className="text-sm text-muted-foreground/70" aria-hidden>
            @
          </span>
          <input
            aria-label={HANDLE.label}
            value={value}
            onChange={(e) => {
              setValue(e.target.value.toLowerCase());
              setError(null);
            }}
            placeholder={HANDLE.placeholder}
            maxLength={21}
            autoCapitalize="none"
            spellCheck={false}
            style={{ fontSize: "16px" }}
            className="h-full min-w-0 flex-1 bg-transparent pr-3 text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={busy || !normalizeHandle(value)}
          className="h-10 shrink-0 rounded-lg bg-[#7C5CFF] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#6B4BEE] disabled:opacity-50"
        >
          {busy ? HANDLE.saving : HANDLE_PROMPT.use}
        </button>
      </form>
      {error && (
        <p role="alert" className="mt-2 text-xs text-red-400">
          {error}
        </p>
      )}
      <p className="mt-2 text-xs text-muted-foreground/70">{HANDLE.help}</p>
    </section>
  );
}
