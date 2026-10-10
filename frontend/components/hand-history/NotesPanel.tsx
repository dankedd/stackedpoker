"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Loader2, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { deleteNote, getNote, saveNote } from "@/lib/handHistory/api";
import { cn } from "@/lib/utils";

type Status = "idle" | "loading" | "dirty" | "saving" | "saved" | "error";

const AUTOSAVE_MS = 800;

/**
 * The whole-hand note (hh_hand_notes.street = 'hand'). Autosaves 800 ms after
 * typing stops, on blur, and when leaving the hand. Per-street notes and tags
 * already have columns; they would be extra panels using the same api calls.
 */
export function NotesPanel({ handRef, userId, onHasNoteChange }: { handRef: string; userId: string; onHasNoteChange?: (has: boolean) => void }) {
  const supabase = useMemo(() => createClient(), []);
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const saved = useRef(""); // last body known to be in the database
  const pending = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    getNote(supabase, handRef)
      .then((n) => {
        if (cancelled) return;
        saved.current = n?.body ?? "";
        setBody(saved.current);
        setSavedAt(n?.updated_at ?? null);
        setStatus("idle");
      })
      .catch((e: Error) => {
        if (cancelled) return;
        setError(e.message);
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [supabase, handRef]);

  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const text = pending.current;
    if (text == null || text === saved.current) return;
    pending.current = null;
    setStatus("saving");
    try {
      const note = await saveNote(supabase, userId, handRef, text);
      saved.current = note?.body ?? "";
      setSavedAt(note?.updated_at ?? null);
      setError(null);
      // Typing may have continued while this request was in flight.
      setStatus(pending.current != null && pending.current !== saved.current ? "dirty" : "saved");
      onHasNoteChange?.(!!note);
    } catch (e) {
      pending.current = pending.current ?? text; // retry with the next save
      setError(e instanceof Error ? e.message : "Opslaan mislukt.");
      setStatus("error");
    }
  }, [supabase, userId, handRef, onHasNoteChange]);

  // Save whatever is pending when leaving this hand (next/previous hand, back to the list).
  useEffect(() => () => void flush(), [flush]);
  useEffect(() => {
    const onUnload = (e: BeforeUnloadEvent) => {
      if (pending.current != null && pending.current !== saved.current) {
        void flush();
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [flush]);

  const onChange = (text: string) => {
    setBody(text);
    pending.current = text;
    setStatus("dirty");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), AUTOSAVE_MS);
  };

  const onDelete = async () => {
    if (!body.trim() && !saved.current) return;
    if (!window.confirm("Notitie bij deze hand verwijderen?")) return;
    if (timer.current) clearTimeout(timer.current);
    pending.current = null;
    setStatus("saving");
    try {
      await deleteNote(supabase, handRef);
      saved.current = "";
      setBody("");
      setSavedAt(null);
      setStatus("idle");
      onHasNoteChange?.(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verwijderen mislukt.");
      setStatus("error");
    }
  };

  return (
    <section className="rounded-2xl border border-border/60 bg-card/40 p-4" aria-labelledby="note-title">
      <div className="mb-2 flex items-center justify-between">
        <h2 id="note-title" className="text-sm font-semibold">
          Notitie
        </h2>
        <StatusLabel status={status} savedAt={savedAt} />
      </div>
      <textarea
        value={body}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => void flush()}
        disabled={status === "loading"}
        rows={8}
        maxLength={20000}
        placeholder="Wat ging er goed of fout in deze hand? Wat zou je de volgende keer anders doen?"
        className="w-full resize-y rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-sm leading-relaxed placeholder:text-muted-foreground/60 focus:border-violet-500/60 focus:outline-none focus:ring-2 focus:ring-violet-500/20 disabled:opacity-50"
      />
      {error && (
        <p role="alert" className="mt-2 text-xs text-rose-300">
          {error}
        </p>
      )}
      <div className="mt-2 flex justify-end">
        <button
          type="button"
          onClick={onDelete}
          disabled={!body && !saved.current}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-muted-foreground hover:text-rose-300 disabled:opacity-30"
        >
          <Trash2 className="h-3.5 w-3.5" /> Verwijderen
        </button>
      </div>
    </section>
  );
}

function StatusLabel({ status, savedAt }: { status: Status; savedAt: string | null }) {
  const base = "inline-flex items-center gap-1 text-xs";
  if (status === "loading") return <span className={cn(base, "text-muted-foreground")}><Loader2 className="h-3 w-3 animate-spin" /> Laden…</span>;
  if (status === "saving") return <span className={cn(base, "text-muted-foreground")}><Loader2 className="h-3 w-3 animate-spin" /> Opslaan…</span>;
  if (status === "dirty") return <span className={cn(base, "text-muted-foreground")}>Niet opgeslagen</span>;
  if (status === "saved") return <span className={cn(base, "text-emerald-300")}><Check className="h-3 w-3" /> Opgeslagen</span>;
  if (status === "error") return <span className={cn(base, "text-rose-300")}>Niet opgeslagen</span>;
  if (savedAt) {
    const d = new Date(savedAt);
    return <span className={cn(base, "text-muted-foreground")}>Bewaard {d.toLocaleDateString("nl-NL", { day: "numeric", month: "short" })}</span>;
  }
  return null;
}
