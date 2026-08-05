"use client";

import { Pencil, Trash2, X, Clock, Hash, Brain } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { computeSessionResult } from "@/lib/bankroll/sessionForm";
import { DeleteConfirmFooter } from "@/components/bankroll/DeleteConfirmFooter";
import type { BankrollSessionRow } from "@/lib/bankroll/types";

function formatDateTime(startedAt: string, endedAt: string | null): string {
  const start = new Date(startedAt);
  const dateStr = start.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const startTime = start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (!endedAt) return `${dateStr} · ${startTime}`;
  const endTime = new Date(endedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${dateStr} · ${startTime}–${endTime}`;
}

function formatDuration(minutes: number | null): string | null {
  if (minutes == null) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

interface SessionRowProps {
  session: BankrollSessionRow;
  currency: string;
  mentalScore: number | null;
  confirmingDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onCancelDelete: () => void;
}

export function SessionRow({ session, currency, mentalScore, confirmingDelete, onEdit, onDelete, onCancelDelete }: SessionRowProps) {
  const result = computeSessionResult(session);
  const positive = result >= 0;
  const duration = formatDuration(session.duration_minutes);
  const metaParts = [session.site, session.variant, session.stakes].filter(Boolean);

  return (
    <div
      className={cn(
        "rounded-2xl border bg-card/60 p-5 card-lift transition-colors",
        confirmingDelete ? "border-red-500/40 bg-red-500/5" : "border-border/50 hover:border-violet-500/20"
      )}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{formatDateTime(session.started_at, session.ended_at)}</p>
          {metaParts.length > 0 && (
            <p className="text-xs text-muted-foreground/60 mt-0.5 truncate">{metaParts.join(" · ")}</p>
          )}
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          {!confirmingDelete ? (
            <>
              <button
                type="button"
                onClick={onEdit}
                title="Edit"
                className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground/50 hover:text-violet-400 hover:bg-violet-500/10 transition-all"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={onDelete}
                title="Delete"
                className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground/50 hover:text-red-400 hover:bg-red-500/10 transition-all"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onCancelDelete}
              className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground/50 hover:text-foreground hover:bg-white/5 transition-all"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center flex-wrap gap-x-5 gap-y-2 mb-1">
        <p className={cn("text-2xl font-black tabular-nums", positive ? "text-emerald-400" : "text-red-400")}>
          {positive ? "+" : ""}{formatCurrency(result, currency)}
        </p>

        {session.ev_amount != null && (
          <span className="text-xs text-blue-300/80 tabular-nums">
            EV {session.ev_amount >= 0 ? "+" : ""}{formatCurrency(session.ev_amount, currency)}
          </span>
        )}

        {mentalScore != null && (
          <span className="flex items-center gap-1 text-xs text-violet-300/80">
            <Brain className="h-3 w-3" />
            {mentalScore}/10
          </span>
        )}
      </div>

      <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground/50">
        {duration && (
          <span className="flex items-center gap-1">
            <Clock className="h-2.5 w-2.5" />
            {duration}
          </span>
        )}
        {session.hands_played != null && (
          <span className="flex items-center gap-1">
            <Hash className="h-2.5 w-2.5" />
            {session.hands_played.toLocaleString()} hands
          </span>
        )}
      </div>

      {session.notes && (
        <p className="text-xs text-muted-foreground/60 mt-3 pt-3 border-t border-border/20 leading-relaxed line-clamp-2">
          {session.notes}
        </p>
      )}

      {confirmingDelete && <DeleteConfirmFooter itemLabel="session" onConfirm={onDelete} />}
    </div>
  );
}
