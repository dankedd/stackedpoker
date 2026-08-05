"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";
import { buildSessionTimestamps, splitSessionTimestamps, computeSessionResult } from "@/lib/bankroll/sessionForm";
import { parseLocaleNumber } from "@/lib/bankroll/parseNumberInput";
import type { BankrollSessionRow } from "@/lib/bankroll/types";

const inputCls =
  "w-full bg-card/60 border border-border/50 rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-all";
const labelCls = "text-xs font-semibold text-muted-foreground/70 mb-1.5 block";

const SITE_SUGGESTIONS = ["PokerStars", "GGPoker", "partypoker", "888poker", "WPN", "Winamax", "Live — Casino", "Live — Home Game"];
const VARIANT_SUGGESTIONS = ["NLHE", "PLO", "PLO5", "PLO6", "Short Deck", "Mixed", "Stud"];

export interface SessionFormEditingData {
  session: BankrollSessionRow;
  mentalScore: number | null;
  mentalEntryId: string | null;
}

interface SessionFormModalProps {
  open: boolean;
  userId: string;
  editing: SessionFormEditingData | null;
  onClose: () => void;
  onSaved: () => void;
}

interface FormState {
  date: string;
  beginTime: string;
  endTime: string;
  site: string;
  variant: string;
  stakes: string;
  result: string;
  ev: string;
  hands: string;
  notes: string;
  mentalScore: string;
}

function emptyForm(): FormState {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    beginTime: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
    endTime: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
    site: "",
    variant: "",
    stakes: "",
    result: "0",
    ev: "",
    hands: "",
    notes: "",
    mentalScore: "",
  };
}

function formFromEditing(data: SessionFormEditingData): FormState {
  const { session, mentalScore } = data;
  const { date, beginTime, endTime } = splitSessionTimestamps(session.started_at, session.ended_at);
  return {
    date,
    beginTime,
    endTime,
    site: session.site ?? "",
    variant: session.variant ?? "",
    stakes: session.stakes ?? "",
    result: String(computeSessionResult(session)),
    ev: session.ev_amount != null ? String(session.ev_amount) : "",
    hands: session.hands_played != null ? String(session.hands_played) : "",
    notes: session.notes ?? "",
    mentalScore: mentalScore != null ? String(mentalScore) : "",
  };
}

export function SessionFormModal({ open, userId, editing, onClose, onSaved }: SessionFormModalProps) {
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(editing ? formFromEditing(editing) : emptyForm());
  }, [open, editing]);

  if (!open) return null;

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.date || !form.beginTime || !form.endTime) {
      toast.error("Date, begin time and end time are required.");
      return;
    }
    const resultValue = parseLocaleNumber(form.result);
    if (Number.isNaN(resultValue)) {
      toast.error("Result must be a number.");
      return;
    }

    setSaving(true);
    try {
      const supabase = createClient();
      const { startedAt, endedAt, durationMinutes } = buildSessionTimestamps(form.date, form.beginTime, form.endTime);

      const payload = {
        user_id: userId,
        session_type: "cash" as const,
        site: form.site.trim() || null,
        variant: form.variant.trim() || null,
        stakes: form.stakes.trim() || null,
        buy_in_amount: 0,
        cash_out_amount: resultValue,
        ev_amount: form.ev.trim() === "" ? null : parseLocaleNumber(form.ev),
        started_at: startedAt,
        ended_at: endedAt,
        duration_minutes: durationMinutes,
        hands_played: form.hands.trim() === "" ? null : Math.max(0, Math.round(parseLocaleNumber(form.hands))),
        notes: form.notes.trim() || null,
      };

      let sessionId = editing?.session.id ?? null;

      if (sessionId) {
        const { error } = await supabase.from("bankroll_sessions").update(payload).eq("id", sessionId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("bankroll_sessions").insert(payload).select("id").single();
        if (error) throw error;
        sessionId = (data as { id: string }).id;
      }

      // Mental game score lives in its own table (bankroll_mental_entries),
      // linked via session_id — upsert/delete it alongside the session.
      const mentalScoreValue = form.mentalScore.trim() === "" ? null : Number(form.mentalScore);
      const existingEntryId = editing?.mentalEntryId ?? null;

      if (mentalScoreValue != null) {
        if (existingEntryId) {
          const { error } = await supabase
            .from("bankroll_mental_entries")
            .update({ overall_score: mentalScoreValue })
            .eq("id", existingEntryId);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("bankroll_mental_entries")
            .insert({ user_id: userId, session_id: sessionId, overall_score: mentalScoreValue });
          if (error) throw error;
        }
      } else if (existingEntryId) {
        const { error } = await supabase.from("bankroll_mental_entries").delete().eq("id", existingEntryId);
        if (error) throw error;
      }

      toast.success(editing ? "Session updated" : "Session logged");
      onSaved();
      onClose();
    } catch (err) {
      console.error("[bankroll] save session failed:", err);
      const detail = err instanceof Error ? err.message : String(err);
      toast.error(`Couldn't save the session: ${detail}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? "Edit session" : "New session"}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={labelCls}>Date</label>
            <input type="date" required value={form.date} onChange={(e) => set("date", e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Begin time</label>
            <input type="time" required value={form.beginTime} onChange={(e) => set("beginTime", e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>End time</label>
            <input type="time" required value={form.endTime} onChange={(e) => set("endTime", e.target.value)} className={inputCls} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={labelCls}>Site</label>
            <input list="bankroll-site-suggestions" value={form.site} onChange={(e) => set("site", e.target.value)} placeholder="PokerStars" className={inputCls} />
            <datalist id="bankroll-site-suggestions">
              {SITE_SUGGESTIONS.map((s) => <option key={s} value={s} />)}
            </datalist>
          </div>
          <div>
            <label className={labelCls}>Variant</label>
            <input list="bankroll-variant-suggestions" value={form.variant} onChange={(e) => set("variant", e.target.value)} placeholder="NLHE" className={inputCls} />
            <datalist id="bankroll-variant-suggestions">
              {VARIANT_SUGGESTIONS.map((v) => <option key={v} value={v} />)}
            </datalist>
          </div>
          <div>
            <label className={labelCls}>Stake</label>
            <input value={form.stakes} onChange={(e) => set("stakes", e.target.value)} placeholder="$1/$2" className={inputCls} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={labelCls}>Result</label>
            <input
              type="number"
              step="0.01"
              required
              value={form.result}
              onChange={(e) => set("result", e.target.value)}
              className={cn(inputCls, "tabular-nums")}
            />
          </div>
          <div>
            <label className={labelCls}>EV <span className="text-muted-foreground/40 normal-case font-normal">(optional)</span></label>
            <input
              type="number"
              step="0.01"
              value={form.ev}
              onChange={(e) => set("ev", e.target.value)}
              placeholder="—"
              className={cn(inputCls, "tabular-nums")}
            />
          </div>
          <div>
            <label className={labelCls}>Hands played</label>
            <input
              type="number"
              min={0}
              step="1"
              value={form.hands}
              onChange={(e) => set("hands", e.target.value)}
              placeholder="—"
              className={cn(inputCls, "tabular-nums")}
            />
          </div>
        </div>

        <div>
          <label className={labelCls}>Mental game score <span className="text-muted-foreground/40 normal-case font-normal">(optional, 1–10)</span></label>
          <select value={form.mentalScore} onChange={(e) => set("mentalScore", e.target.value)} className={cn(inputCls, "cursor-pointer")}>
            <option value="">Not tracked</option>
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>{n} / 10</option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelCls}>Notes</label>
          <Textarea
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
            placeholder="How did it go? Any leaks, reads, or takeaways…"
            rows={3}
            className="font-sans"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" variant="poker" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {editing ? "Save changes" : "Log session"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
