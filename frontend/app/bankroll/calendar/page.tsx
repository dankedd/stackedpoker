"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { cn, formatCurrency } from "@/lib/utils";
import { buildMonthGrid, buildCalendarDayMap, dayStatus, dateKeyOf, type CalendarSession, type CalendarDayData } from "@/lib/bankroll/calendar";
import { CalendarDayModal } from "@/components/bankroll/CalendarDayModal";
import { BankrollBackLink } from "@/components/bankroll/BankrollBackLink";
import { BankrollPageLoader } from "@/components/bankroll/BankrollPageLoader";
import { BankrollErrorState } from "@/components/bankroll/BankrollErrorState";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const STATUS_CLS: Record<"win" | "loss" | "none", string> = {
  win: "border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/15",
  loss: "border-red-500/30 bg-red-500/10 hover:bg-red-500/15",
  none: "border-border/30 bg-card/30 hover:bg-card/50",
};

export default function BankrollCalendarPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const today = useMemo(() => new Date(), []);
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [sessions, setSessions] = useState<CalendarSession[]>([]);
  const [currency, setCurrency] = useState("USD");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [user, authLoading, router]);

  const grid = useMemo(() => buildMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);
  const rangeStart = grid[0].date;
  const rangeEnd = grid[grid.length - 1].date;

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const supabase = createClient();
      const [{ data: sessionRows, error: sessionsError }, { data: settingsRow }] = await Promise.all([
        supabase
          .from("bankroll_sessions")
          .select("id, session_type, started_at, buy_in_amount, cash_out_amount, duration_minutes, site, variant, stakes, notes, tournament_name, finishing_position")
          .eq("user_id", user.id)
          .gte("started_at", rangeStart.toISOString())
          .lt("started_at", new Date(rangeEnd.getFullYear(), rangeEnd.getMonth(), rangeEnd.getDate() + 1).toISOString()),
        supabase.from("bankroll_settings").select("preferred_currency").eq("user_id", user.id).maybeSingle(),
      ]);

      if (sessionsError) {
        console.error("[bankroll/calendar] fetch error:", sessionsError.message);
        setLoadError(true);
        return;
      }
      setLoadError(false);

      setSessions((sessionRows ?? []) as unknown as CalendarSession[]);
      setCurrency(settingsRow?.preferred_currency ?? "USD");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, viewYear, viewMonth]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const dayMap = useMemo(() => buildCalendarDayMap(sessions), [sessions]);

  const goToPrevMonth = () => {
    setSelectedDate(null);
    if (viewMonth === 0) { setViewYear((y) => y - 1); setViewMonth(11); }
    else setViewMonth((m) => m - 1);
  };
  const goToNextMonth = () => {
    setSelectedDate(null);
    if (viewMonth === 11) { setViewYear((y) => y + 1); setViewMonth(0); }
    else setViewMonth((m) => m + 1);
  };
  const goToToday = () => {
    setSelectedDate(null);
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
  };

  const selectedDay: CalendarDayData | undefined = selectedDate ? dayMap.get(dateKeyOf(selectedDate)) : undefined;

  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });

  if (authLoading) return <BankrollPageLoader />;

  return (
    <div className="min-h-screen bg-background">
      <Navbar variant="static" />

      <main className="container mx-auto max-w-4xl px-4 sm:px-6 py-10 page-enter">

        <div className="mb-8 animate-fade-in">
          <BankrollBackLink />
          <h1 className="text-3xl font-black text-foreground tracking-tight">Calendar</h1>
          <p className="text-muted-foreground mt-1.5">A day-by-day view of your results. Tap a day for the details.</p>
        </div>

        {loadError ? (
          <BankrollErrorState message="Couldn't load your calendar." onRetry={fetchData} />
        ) : (
        <div className="rounded-2xl border border-border/50 bg-card/60 p-4 sm:p-6 card-lift">
          <div className="flex items-center justify-between mb-5">
            <button
              type="button"
              onClick={goToPrevMonth}
              className="h-8 w-8 flex items-center justify-center rounded-lg border border-border/50 text-muted-foreground hover:text-foreground hover:border-border transition-all"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold text-foreground">{monthLabel}</h2>
              <button
                type="button"
                onClick={goToToday}
                className="text-[11px] font-semibold text-violet-400 hover:text-violet-300 transition-colors px-2 py-1 rounded-lg hover:bg-violet-500/10"
              >
                Today
              </button>
            </div>

            <button
              type="button"
              onClick={goToNextMonth}
              className="h-8 w-8 flex items-center justify-center rounded-lg border border-border/50 text-muted-foreground hover:text-foreground hover:border-border transition-all"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 sm:gap-1.5 mb-1.5">
            {WEEKDAY_LABELS.map((label) => (
              <div key={label} className="text-center text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/40 py-1">
                {label}
              </div>
            ))}
          </div>

          <div className={cn("grid grid-cols-7 gap-1 sm:gap-1.5", loading && "opacity-50 pointer-events-none")}>
            {grid.map((cell) => {
              const day = dayMap.get(cell.dateKey);
              const status = dayStatus(day);
              const isToday = cell.dateKey === dateKeyOf(today);

              return (
                <button
                  key={cell.dateKey}
                  type="button"
                  onClick={() => cell.inMonth && day && setSelectedDate(cell.date)}
                  disabled={!cell.inMonth || !day}
                  className={cn(
                    "aspect-square rounded-lg sm:rounded-xl border flex flex-col items-center justify-center gap-0.5 p-1 transition-all",
                    cell.inMonth ? STATUS_CLS[status] : "border-transparent bg-transparent opacity-25",
                    cell.inMonth && day && "cursor-pointer",
                    isToday && "ring-1 ring-violet-500/50"
                  )}
                >
                  <span className={cn("text-[10px] sm:text-xs font-semibold tabular-nums", cell.inMonth ? "text-foreground/80" : "text-muted-foreground/40")}>
                    {cell.date.getDate()}
                  </span>
                  {cell.inMonth && day && (
                    <span
                      className={cn(
                        "hidden sm:block text-[10px] font-bold tabular-nums",
                        status === "win" ? "text-emerald-400" : "text-red-400"
                      )}
                    >
                      {day.profit >= 0 ? "+" : ""}{formatCurrency(day.profit, currency).replace(/\.00$/, "")}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-4 mt-5 pt-4 border-t border-border/20">
            <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground/50">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/60" /> Winning day
            </span>
            <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground/50">
              <span className="h-2.5 w-2.5 rounded-full bg-red-500/60" /> Losing day
            </span>
            <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground/50">
              <span className="h-2.5 w-2.5 rounded-full bg-border" /> No session
            </span>
          </div>
        </div>
        )}

      </main>

      <CalendarDayModal
        open={selectedDate !== null}
        onClose={() => setSelectedDate(null)}
        date={selectedDate}
        day={selectedDay}
        currency={currency}
      />
    </div>
  );
}
