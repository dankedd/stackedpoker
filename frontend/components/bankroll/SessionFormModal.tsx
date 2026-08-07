"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Coins, Trophy, RotateCcw } from "lucide-react";
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

type SessionKind = "cash" | "tournament";

const KIND_OPTIONS: { key: SessionKind; label: string; icon: typeof Coins }[] = [
  { key: "cash", label: "Cash Game", icon: Coins },
  { key: "tournament", label: "Tournament", icon: Trophy },
];

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
  kind: SessionKind;
  date: string;
  beginTime: string;
  endTime: string;
  site: string;
  notes: string;
  mentalScore: string;
  // cash-only
  variant: string;
  stakes: string;
  result: string;
  ev: string;
  hands: string;
  // tournament-only
  tournamentName: string;
  buyIn: string;
  fee: string;
  fieldSize: string;
  finishingPosition: string;
  prize: string;
  netResult: string;
}

function emptyForm(): FormState {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  return {
    kind: "cash",
    date,
    beginTime: time,
    endTime: time,
    site: "",
    notes: "",
    mentalScore: "",
    variant: "",
    stakes: "",
    result: "0",
    ev: "",
    hands: "",
    tournamentName: "",
    buyIn: "",
    fee: "",
    fieldSize: "",
    finishingPosition: "",
    prize: "",
    netResult: "0",
  };
}

function formFromEditing(data: SessionFormEditingData): FormState {
  const { session, mentalScore } = data;
  const { date, beginTime, endTime } = splitSessionTimestamps(session.started_at, session.ended_at);
  const kind: SessionKind = session.session_type === "tournament" ? "tournament" : "cash";
  const base = emptyForm();

  if (kind === "tournament") {
    const feeAmount = session.fee_amount ?? 0;
    const pureBuyIn = session.buy_in_amount - feeAmount;
    return {
      ...base,
      kind,
      date, beginTime, endTime,
      site: session.site ?? "",
      notes: session.notes ?? "",
      mentalScore: mentalScore != null ? String(mentalScore) : "",
      tournamentName: session.tournament_name ?? "",
      buyIn: String(pureBuyIn),
      fee: session.fee_amount != null ? String(session.fee_amount) : "",
      fieldSize: session.field_size != null ? String(session.field_size) : "",
      finishingPosition: session.finishing_position != null ? String(session.finishing_position) : "",
      prize: session.prize_amount != null ? String(session.prize_amount) : "",
      netResult: String(computeSessionResult(session)),
    };
  }

  return {
    ...base,
    kind,
    date, beginTime, endTime,
    site: session.site ?? "",
    notes: session.notes ?? "",
    mentalScore: mentalScore != null ? String(mentalScore) : "",
    variant: session.variant ?? "",
    stakes: session.stakes ?? "",
    result: String(computeSessionResult(session)),
    ev: session.ev_amount != null ? String(session.ev_amount) : "",
    hands: session.hands_played != null ? String(session.hands_played) : "",
  };
}

export function SessionFormModal({ open, userId, editing, onClose, onSaved }: SessionFormModalProps) {
  const [form, setForm] = useState<FormState>(emptyForm());
  // Whether the player has directly edited "Net result" for a tournament —
  // once true, the buy-in/fee/prize auto-calc effect below stops
  // overwriting it (their manual override wins). Starts true when editing
  // an existing tournament session, so opening the form doesn't
  // immediately recompute over — and potentially silently discard — a
  // value that was itself a manual override when it was saved.
  const [netResultTouched, setNetResultTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(editing ? formFromEditing(editing) : emptyForm());
    setNetResultTouched(!!editing && editing.session.session_type === "tournament");
  }, [open, editing]);

  // Live auto-calc: Net result = Prize - Buy-in - Fee, unless the player has
  // taken it over directly (see netResultTouched above).
  useEffect(() => {
    if (form.kind !== "tournament" || netResultTouched) return;
    const buyIn = parseLocaleNumber(form.buyIn) || 0;
    const fee = parseLocaleNumber(form.fee) || 0;
    const prize = parseLocaleNumber(form.prize) || 0;
    const calculated = String(prize - buyIn - fee);
    setForm((f) => (f.netResult === calculated ? f : { ...f, netResult: calculated }));
  }, [form.kind, form.buyIn, form.fee, form.prize, netResultTouched]);

  if (!open) return null;

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  const selectKind = (kind: SessionKind) => {
    set("kind", kind);
    if (kind === "tournament") setNetResultTouched(false);
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.date || !form.beginTime || !form.endTime) {
      toast.error("Date, begin time and end time are required.");
      return;
    }

    setSaving(true);
    try {
      const supabase = createClient();
      const { startedAt, endedAt, durationMinutes } = buildSessionTimestamps(form.date, form.beginTime, form.endTime);

      let payload: Record<string, unknown>;

      if (form.kind === "cash") {
        const resultValue = parseLocaleNumber(form.result);
        if (Number.isNaN(resultValue)) {
          toast.error("Result must be a number.");
          setSaving(false);
          return;
        }
        payload = {
          user_id: userId,
          session_type: "cash",
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
          // Clear tournament-only fields in case this row was previously saved as a tournament.
          tournament_name: null, fee_amount: null, prize_amount: null, field_size: null, finishing_position: null,
        };
      } else {
        const buyIn = form.buyIn.trim() === "" ? 0 : parseLocaleNumber(form.buyIn);
        const fee = form.fee.trim() === "" ? 0 : parseLocaleNumber(form.fee);
        const prize = form.prize.trim() === "" ? 0 : parseLocaleNumber(form.prize);
        const netResultValue = parseLocaleNumber(form.netResult);
        if ([buyIn, fee, prize].some((n) => Number.isNaN(n) || n < 0) || Number.isNaN(netResultValue)) {
          toast.error("Buy-in, fee, total prize and net result must all be valid numbers.");
          setSaving(false);
          return;
        }
        const effectiveBuyIn = buyIn + fee;
        if (netResultValue < -effectiveBuyIn) {
          toast.error(`Net result can't be lower than -${effectiveBuyIn.toFixed(2)} (you can't lose more than the buy-in + fee).`);
          setSaving(false);
          return;
        }
        payload = {
          user_id: userId,
          session_type: "tournament",
          site: form.site.trim() || null,
          tournament_name: form.tournamentName.trim() || null,
          buy_in_amount: effectiveBuyIn,
          fee_amount: form.fee.trim() === "" ? null : fee,
          prize_amount: form.prize.trim() === "" ? null : prize,
          cash_out_amount: effectiveBuyIn + netResultValue,
          field_size: form.fieldSize.trim() === "" ? null : Math.max(1, Math.round(parseLocaleNumber(form.fieldSize))),
          finishing_position: form.finishingPosition.trim() === "" ? null : Math.max(1, Math.round(parseLocaleNumber(form.finishingPosition))),
          started_at: startedAt,
          ended_at: endedAt,
          duration_minutes: durationMinutes,
          notes: form.notes.trim() || null,
          // Clear cash-only fields in case this row was previously saved as a cash session.
          variant: null, stakes: null, ev_amount: null, hands_played: null,
        };
      }

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
        {/* ── Cash Game / Tournament segmented control — same pill-track pattern as the bankroll chart's range selector ── */}
        <div className="flex items-center rounded-full border border-border/50 bg-background/40 p-0.5 w-fit">
          {KIND_OPTIONS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => selectKind(key)}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-all duration-150",
                form.kind === key
                  ? "bg-gradient-to-r from-violet-600 to-blue-500 text-white shadow-sm shadow-violet-900/40"
                  : "text-muted-foreground/50 hover:text-muted-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

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

        {form.kind === "cash" ? (
          <>
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
                <input value={form.stakes} onChange={(e) => set("stakes", e.target.value)} placeholder="€0.05/€0.10" className={inputCls} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>Result</label>
                <input
                  type="number" step="0.01" required
                  value={form.result}
                  onChange={(e) => set("result", e.target.value)}
                  className={cn(inputCls, "tabular-nums")}
                />
              </div>
              <div>
                <label className={labelCls}>EV <span className="text-muted-foreground/40 normal-case font-normal">(optional)</span></label>
                <input
                  type="number" step="0.01"
                  value={form.ev}
                  onChange={(e) => set("ev", e.target.value)}
                  placeholder="—"
                  className={cn(inputCls, "tabular-nums")}
                />
              </div>
              <div>
                <label className={labelCls}>Hands played</label>
                <input
                  type="number" min={0} step="1"
                  value={form.hands}
                  onChange={(e) => set("hands", e.target.value)}
                  placeholder="—"
                  className={cn(inputCls, "tabular-nums")}
                />
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Poker site</label>
                <input list="bankroll-site-suggestions" value={form.site} onChange={(e) => set("site", e.target.value)} placeholder="PokerStars" className={inputCls} />
                <datalist id="bankroll-site-suggestions">
                  {SITE_SUGGESTIONS.map((s) => <option key={s} value={s} />)}
                </datalist>
              </div>
              <div>
                <label className={labelCls}>Tournament name <span className="text-muted-foreground/40 normal-case font-normal">(optional)</span></label>
                <input value={form.tournamentName} onChange={(e) => set("tournamentName", e.target.value)} placeholder="Sunday Million" className={inputCls} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Buy-in</label>
                <input
                  type="number" min={0} step="0.01" required
                  value={form.buyIn}
                  onChange={(e) => set("buyIn", e.target.value)}
                  placeholder="100"
                  className={cn(inputCls, "tabular-nums")}
                />
              </div>
              <div>
                <label className={labelCls}>Fee / rake <span className="text-muted-foreground/40 normal-case font-normal">(optional)</span></label>
                <input
                  type="number" min={0} step="0.01"
                  value={form.fee}
                  onChange={(e) => set("fee", e.target.value)}
                  placeholder="9"
                  className={cn(inputCls, "tabular-nums")}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}># of players <span className="text-muted-foreground/40 normal-case font-normal">(optional)</span></label>
                <input
                  type="number" min={1} step="1"
                  value={form.fieldSize}
                  onChange={(e) => set("fieldSize", e.target.value)}
                  placeholder="—"
                  className={cn(inputCls, "tabular-nums")}
                />
              </div>
              <div>
                <label className={labelCls}>Finish position <span className="text-muted-foreground/40 normal-case font-normal">(optional, e.g. 18)</span></label>
                <input
                  type="number" min={1} step="1"
                  value={form.finishingPosition}
                  onChange={(e) => set("finishingPosition", e.target.value)}
                  placeholder="—"
                  className={cn(inputCls, "tabular-nums")}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Total prize <span className="text-muted-foreground/40 normal-case font-normal">(cash)</span></label>
                <input
                  type="number" min={0} step="0.01"
                  value={form.prize}
                  onChange={(e) => set("prize", e.target.value)}
                  placeholder="0"
                  className={cn(inputCls, "tabular-nums")}
                />
              </div>
              <div>
                <label className={labelCls}>
                  Net result
                  {netResultTouched && (
                    <button
                      type="button"
                      onClick={() => setNetResultTouched(false)}
                      className="ml-1.5 inline-flex items-center gap-0.5 text-violet-400/70 hover:text-violet-300 normal-case font-normal"
                    >
                      <RotateCcw className="h-2.5 w-2.5" />
                      use calculated
                    </button>
                  )}
                </label>
                <input
                  type="number" step="0.01" required
                  value={form.netResult}
                  onChange={(e) => { setNetResultTouched(true); set("netResult", e.target.value); }}
                  className={cn(inputCls, "tabular-nums")}
                />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground/40 -mt-2">
              Net result = Prize − Buy-in − Fee, calculated automatically. Edit it directly to override.
            </p>
          </>
        )}

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
