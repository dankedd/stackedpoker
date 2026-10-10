"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, Check, Info, Loader2, NotebookPen, RotateCcw } from "lucide-react";
import { CoachChat, type CoachChatHandle } from "@/components/learn/CoachChat";
import { useAuth } from "@/contexts/AuthContext";
import { askHandCoach, loadHandConversation, newHandConversation } from "@/lib/handHistory/coach";
import { t } from "@/lib/handHistory/strings";
import type { CoachMessage } from "@/lib/learn/types";
import { cn } from "@/lib/utils";

/**
 * "Ask the coach" next to the replayer: the existing AI coach (CoachChat, same
 * quota and usage display) talking about this hand. The server builds the
 * hand context; this sends only the hand id, the replayer step and the text.
 */
export function HandCoachPanel({
  handRef,
  stepIndex,
  onSaveToNotes,
  className,
}: {
  handRef: string;
  /** The replayer's current step — "this spot" means this step. */
  stepIndex: number;
  /** Appends a coach answer to the hand's note; resolves true when saved. */
  onSaveToNotes: (text: string) => Promise<boolean>;
  className?: string;
}) {
  const { session } = useAuth();
  const token = session?.access_token ?? "";
  const chatRef = useRef<CoachChatHandle>(null);
  const stepRef = useRef(stepIndex);
  stepRef.current = stepIndex;

  const [loaded, setLoaded] = useState<{ sessionId: string | null; messages: CoachMessage[] } | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [chatKey, setChatKey] = useState(0);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoaded(null);
    setLoadError(false);
    loadHandConversation(handRef, token)
      .then((c) => !cancelled && setLoaded(c))
      .catch(() => {
        if (cancelled) return;
        setLoadError(true);
        setLoaded({ sessionId: null, messages: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [handRef, token]);

  if (!token) {
    return <section className={cn("rounded-2xl border border-border/60 bg-card/40 p-4 text-sm text-muted-foreground", className)}>{t.coach.signIn}</section>;
  }

  const startNew = async () => {
    if (!window.confirm(t.coach.confirmNew)) return;
    setResetting(true);
    try {
      await newHandConversation(handRef, token);
      setLoaded({ sessionId: null, messages: [] });
      setChatKey((k) => k + 1);
    } finally {
      setResetting(false);
    }
  };

  return (
    <section aria-labelledby="coach-title" className={cn("flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-card/40", className)}>
      <div className="flex items-center justify-between gap-2 border-b border-border/40 px-4 py-3">
        <h2 id="coach-title" className="flex items-center gap-1.5 text-sm font-semibold">
          <Bot className="h-4 w-4 text-violet-300" /> {t.coach.title}
          <span className="group relative inline-flex" tabIndex={0} aria-label={t.coach.chipEv}>
            <Info className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-1 w-52 -translate-x-1/2 rounded-lg border border-border/60 bg-background px-2 py-1.5 text-[11px] font-normal text-foreground opacity-0 shadow-lg transition group-hover:opacity-100 group-focus:opacity-100">
              {t.coach.chipEv}
            </span>
          </span>
        </h2>
        <button
          type="button"
          onClick={startNew}
          disabled={resetting || !loaded}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted-foreground hover:bg-card hover:text-foreground disabled:opacity-40"
        >
          <RotateCcw className="h-3.5 w-3.5" /> {t.coach.newConversation}
        </button>
      </div>

      {!loaded ? (
        <div className="flex flex-1 items-center justify-center py-10 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      ) : (
        <CoachChat
          key={`${handRef}-${chatKey}`}
          ref={chatRef}
          token={token}
          sessionId={loaded.sessionId}
          initialMessages={loaded.messages}
          className="min-h-[320px] flex-1"
          placeholder={t.coach.placeholder}
          sendFn={(_session, message) => askHandCoach(handRef, message, stepRef.current, token)}
          emptyState={<p className="py-4 text-center text-xs text-muted-foreground">{loadError ? t.coach.loadFailed : t.coach.intro}</p>}
          aboveInput={
            <div className="mb-2 flex flex-wrap gap-1.5">
              {t.coach.quickQuestions.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => chatRef.current?.sendMessage(q)}
                  className="rounded-full border border-violet-500/25 bg-violet-500/5 px-2.5 py-1 text-[11px] text-foreground/80 transition hover:border-violet-500/50 hover:bg-violet-500/10"
                >
                  {q}
                </button>
              ))}
            </div>
          }
          renderMessageActions={(msg) => <SaveToNotes text={msg.content} onSave={onSaveToNotes} />}
        />
      )}
    </section>
  );
}

function SaveToNotes({ text, onSave }: { text: string; onSave: (text: string) => Promise<boolean> }) {
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  return (
    <button
      type="button"
      disabled={state === "saving" || state === "saved"}
      onClick={async () => {
        setState("saving");
        setState((await onSave(`${t.coach.notePrefix} ${text}`)) ? "saved" : "error");
      }}
      className={cn(
        "inline-flex items-center gap-1 px-1 text-[11px] transition",
        state === "saved" ? "text-emerald-300" : state === "error" ? "text-rose-300" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {state === "saving" ? <Loader2 className="h-3 w-3 animate-spin" /> : state === "saved" ? <Check className="h-3 w-3" /> : <NotebookPen className="h-3 w-3" />}
      {state === "saved" ? t.coach.savedToNotes : state === "error" ? t.coach.saveFailed : t.coach.saveToNotes}
    </button>
  );
}
