"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { getHand, getNote } from "@/lib/handHistory/api";
import { HANDS_PATH } from "@/lib/handHistory/feature";
import { fmtPlayedAt } from "@/lib/handHistory/format";
import { buildManualHand, type ShowdownInput } from "@/lib/handHistory/manual/build";
import { clearDraft, loadDraft, saveDraft, type DraftPhase, type ManualDraft } from "@/lib/handHistory/manual/draft";
import { ManualHandError, replay, streetsEntered, type ManualSetup, type ManualStep } from "@/lib/handHistory/manual/engine";
import { logManualEvent, saveManualHand } from "@/lib/handHistory/manual/save";
import { t } from "@/lib/handHistory/strings";
import { trackCustom } from "@/lib/metaPixel";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { PageHeader, SectionNav } from "../SectionNav";
import { ActionsStep } from "./ActionsStep";
import { ReviewStep } from "./ReviewStep";
import { SetupStep } from "./SetupStep";

function nowLocal(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:00`;
}

export function defaultSetup(): ManualSetup {
  return {
    format: "tournament",
    playerCount: 9,
    smallBlind: 500,
    bigBlind: 1000,
    ante: 1000,
    anteType: "bb_ante",
    level: null,
    heroPosition: "CO",
    heroStack: 25000,
    stacks: {},
    heroCards: [],
    tournamentName: "",
    playedAt: nowLocal(),
    buyIn: "",
    live: true,
    venue: "",
  };
}

/** The longest start of `steps` that is still valid for `setup` (after editing the setup). */
function validPrefix(setup: ManualSetup, steps: ManualStep[]): ManualStep[] {
  for (let n = steps.length; n > 0; n--) {
    try {
      replay(setup, steps.slice(0, n));
      return steps.slice(0, n);
    } catch {
      /* shorter */
    }
  }
  return [];
}

const EMPTY_SHOWDOWN: ShowdownInput = { shown: {}, potWinners: {} };

export function ManualHandEntry() {
  const router = useRouter();
  const params = useSearchParams();
  const editId = params.get("edit");
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);

  const [phase, setPhase] = useState<DraftPhase>("setup");
  const [setup, setSetup] = useState<ManualSetup>(defaultSetup);
  const [steps, setSteps] = useState<ManualStep[]>([]);
  const [showdown, setShowdown] = useState<ShowdownInput>(EMPTY_SHOWDOWN);
  const [note, setNote] = useState("");
  const [starred, setStarred] = useState(false);
  const [handId, setHandId] = useState<string | null>(null);
  const [resume, setResume] = useState<ManualDraft | null>(null);
  const [loading, setLoading] = useState(Boolean(editId));
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [started, setStarted] = useState(Boolean(editId));
  const [touched, setTouched] = useState(false);

  const apply = (d: Pick<ManualDraft, "phase" | "entry" | "note" | "starred">) => {
    setSetup(d.entry.setup);
    setSteps(d.entry.steps);
    setShowdown({ shown: d.entry.shown, potWinners: d.entry.potWinners });
    setNote(d.note);
    setStarred(d.starred);
    setPhase(d.phase);
  };

  // Edit: load the saved hand's entry, note and star. New: offer the draft.
  useEffect(() => {
    if (!user) return;
    const draft = loadDraft(user.id);
    if (!editId) {
      if (draft && !draft.editId) setResume(draft);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const row = await getHand(supabase, editId);
        const entry = row?.data?.manual?.entry;
        if (!row || !entry) throw new Error(t.manual.notFound);
        const n = await getNote(supabase, editId).catch(() => null);
        if (cancelled) return;
        setHandId(row.data.handId);
        if (draft?.editId === editId) setResume(draft);
        apply({ phase: "actions", entry, note: n?.body ?? "", starred: row.favorited_at != null });
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : t.manual.notFound);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, editId, supabase]);

  // Autosave once the user has entered something.
  useEffect(() => {
    if (!user || !touched || resume) return;
    saveDraft(user.id, { editId, phase, entry: { setup, steps, ...showdown }, note, starred });
  }, [user, touched, resume, editId, phase, setup, steps, showdown, note, starred]);

  const touch = <T,>(fn: (v: T) => void) => (v: T) => {
    setTouched(true);
    fn(v);
  };

  const hand = useMemo(() => {
    if (phase !== "review") return null;
    try {
      return buildManualHand(setup, replay(setup, steps), showdown, handId ?? "M");
    } catch {
      return null;
    }
  }, [phase, setup, steps, showdown, handId]);

  const goActions = () => {
    setSteps((s) => validPrefix(setup, s));
    setPhase("actions");
    if (!started && user) {
      setStarted(true);
      trackCustom("ManualHandStarted", { game_type: setup.format });
      void logManualEvent(supabase, user.id, "started", setup.format, null).catch(() => {});
    }
  };

  const save = async () => {
    if (!user) return;
    setSaving(true);
    setSaveError(null);
    try {
      const state = replay(setup, steps);
      const id = handId ?? `M${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      const built = buildManualHand(setup, state, showdown, id);
      const savedId = await saveManualHand(supabase, built, { userId: user.id, editId, note, starred });
      const streets = streetsEntered(state);
      trackCustom("ManualHandSaved", { game_type: setup.format, streets_entered: streets });
      void logManualEvent(supabase, user.id, editId ? "edited" : "saved", setup.format, streets).catch(() => {});
      clearDraft(user.id);
      toast.success(t.manual.saved);
      router.push(`${HANDS_PATH}/${savedId}?manual=1`);
    } catch (e) {
      setSaveError(e instanceof ManualHandError || e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      </div>
    );
  }

  return (
    <div className="page-enter mx-auto max-w-2xl">
      <div className="mb-6">
        <SectionNav />
      </div>
      <PageHeader title={editId ? t.manual.editTitle : t.manual.title} subtitle={t.manual.subtitle} />

      {loadError && (
        <p role="alert" className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {loadError}
        </p>
      )}

      {resume && (
        <div className="mb-4 rounded-2xl border border-[#7C5CFF]/40 bg-[#7C5CFF]/[0.07] p-4">
          <p className="font-semibold">{t.manual.resumeTitle}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t.manual.resumeBody(fmtPlayedAt(resume.savedAt.slice(0, 19)))}</p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => {
                apply(resume);
                setResume(null);
                setTouched(true);
              }}
              className="h-10 flex-1 rounded-xl bg-[#7C5CFF] text-sm font-semibold text-white"
            >
              {t.manual.resume}
            </button>
            <button
              type="button"
              onClick={() => {
                if (user) clearDraft(user.id);
                setResume(null);
              }}
              className="h-10 flex-1 rounded-xl border border-white/15 text-sm font-semibold"
            >
              {editId ? t.manual.cancel : t.manual.startOver}
            </button>
          </div>
        </div>
      )}

      <ol className="mb-5 flex gap-2" aria-label="Steps">
        {t.manual.steps.map((label, i) => {
          const current = ["setup", "actions", "review"].indexOf(phase);
          return (
            <li key={label} aria-current={i === current ? "step" : undefined} className={cn("flex-1 rounded-full py-1.5 text-center text-xs font-semibold", i === current ? "bg-[#7C5CFF] text-white" : i < current ? "bg-[#7C5CFF]/25 text-violet-100" : "bg-white/[0.05] text-muted-foreground")}>
              {i + 1}. {label}
            </li>
          );
        })}
      </ol>

      {phase === "setup" && <SetupStep setup={setup} onChange={touch(setSetup)} onNext={goActions} />}
      {phase === "actions" && (
        <ActionsStep
          setup={setup}
          steps={steps}
          onSteps={touch(setSteps)}
          showdown={showdown}
          onShowdown={touch(setShowdown)}
          onBack={() => setPhase("setup")}
          onNext={() => setPhase("review")}
        />
      )}
      {phase === "review" && hand && (
        <ReviewStep
          hand={hand}
          note={note}
          onNote={touch(setNote)}
          starred={starred}
          onStar={touch(setStarred)}
          saving={saving}
          error={saveError}
          onBack={() => setPhase("actions")}
          onSave={save}
        />
      )}
    </div>
  );
}
