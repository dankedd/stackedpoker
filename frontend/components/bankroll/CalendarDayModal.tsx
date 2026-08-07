import { Clock, Trophy } from "lucide-react";
import { cn, formatCurrency, formatOrdinal } from "@/lib/utils";
import { Modal } from "@/components/ui/modal";
import { computeSessionResult } from "@/lib/bankroll/sessionForm";
import type { CalendarDayData } from "@/lib/bankroll/calendar";

interface CalendarDayModalProps {
  open: boolean;
  onClose: () => void;
  date: Date | null;
  day: CalendarDayData | undefined;
  currency: string;
}

export function CalendarDayModal({ open, onClose, date, day, currency }: CalendarDayModalProps) {
  const title = date
    ? date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
    : "";

  const profit = day?.profit ?? 0;
  const hours = day?.hours ?? 0;
  const positive = profit >= 0;

  return (
    <Modal open={open} onClose={onClose} title={title} maxWidthClassName="max-w-lg">
      {!day || day.sessions.length === 0 ? (
        <p className="text-sm text-muted-foreground/60 py-6 text-center">No sessions logged on this day.</p>
      ) : (
        <div className="space-y-5">
          <div className="flex items-center gap-6">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/50 mb-1">Profit</p>
              <p className={cn("text-2xl font-black tabular-nums", positive ? "text-emerald-400" : "text-red-400")}>
                {positive ? "+" : ""}{formatCurrency(profit, currency)}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/50 mb-1">Hours</p>
              <p className="text-2xl font-black tabular-nums text-foreground">{hours.toFixed(1)}</p>
            </div>
          </div>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/50 mb-2">
              {day.sessions.length} session{day.sessions.length !== 1 ? "s" : ""}
            </p>
            <div className="space-y-2">
              {day.sessions.map((session) => {
                const result = computeSessionResult(session);
                const sessionPositive = result >= 0;
                const isTournament = session.session_type === "tournament";
                const meta = isTournament
                  ? [session.tournament_name, session.site].filter(Boolean).join(" · ")
                  : [session.site, session.variant, session.stakes].filter(Boolean).join(" · ");
                return (
                  <div key={session.id} className="rounded-xl border border-border/40 bg-background/30 px-4 py-3">
                    <div className="flex items-center justify-between gap-3 mb-1">
                      <p className="text-xs text-muted-foreground/60 truncate">{meta || "Session"}</p>
                      <p className={cn("text-sm font-bold tabular-nums shrink-0", sessionPositive ? "text-emerald-400" : "text-red-400")}>
                        {sessionPositive ? "+" : ""}{formatCurrency(result, currency)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {session.duration_minutes != null && (
                        <p className="flex items-center gap-1 text-[11px] text-muted-foreground/40">
                          <Clock className="h-2.5 w-2.5" />
                          {(session.duration_minutes / 60).toFixed(1)}h
                        </p>
                      )}
                      {isTournament && session.finishing_position != null && (
                        <p className="flex items-center gap-1 text-[11px] text-muted-foreground/40">
                          <Trophy className="h-2.5 w-2.5" />
                          {formatOrdinal(session.finishing_position)}
                        </p>
                      )}
                    </div>
                    {session.notes && (
                      <p className="text-xs text-muted-foreground/60 mt-2 pt-2 border-t border-border/20 leading-relaxed">
                        {session.notes}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
