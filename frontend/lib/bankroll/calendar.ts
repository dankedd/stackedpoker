import { computeSessionResult } from "./sessionForm";

export interface CalendarSession {
  id: string;
  session_type: string;
  started_at: string;
  buy_in_amount: number;
  cash_out_amount: number | null;
  duration_minutes: number | null;
  site: string | null;
  variant: string | null;
  stakes: string | null;
  notes: string | null;
  tournament_name: string | null;
  finishing_position: number | null;
}

export interface CalendarDayData {
  dateKey: string;
  profit: number;
  hours: number;
  sessions: CalendarSession[];
}

export type CalendarDayStatus = "win" | "loss" | "none";

/** Local (not UTC) Y-M-D key — the calendar is a local-wall-clock view, so
 *  a session must land on the day the player actually experienced it, not
 *  whatever day UTC conversion happens to shift it to near midnight. */
export function dateKeyOf(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Groups settled sessions by local calendar day, summing profit/hours. Unsettled sessions (cash_out_amount null) are excluded, matching every other bankroll aggregate in this app. */
export function buildCalendarDayMap(sessions: CalendarSession[]): Map<string, CalendarDayData> {
  const map = new Map<string, CalendarDayData>();

  for (const session of sessions) {
    if (session.cash_out_amount == null) continue;
    const key = dateKeyOf(new Date(session.started_at));
    const profit = computeSessionResult(session);
    const hours = (session.duration_minutes ?? 0) / 60;

    const existing = map.get(key);
    if (existing) {
      existing.profit += profit;
      existing.hours += hours;
      existing.sessions.push(session);
    } else {
      map.set(key, { dateKey: key, profit, hours, sessions: [session] });
    }
  }

  return map;
}

export function dayStatus(day: CalendarDayData | undefined): CalendarDayStatus {
  if (!day || day.sessions.length === 0) return "none";
  return day.profit >= 0 ? "win" : "loss";
}

export interface CalendarCell {
  date: Date;
  dateKey: string;
  inMonth: boolean;
}

/**
 * A 6-week (42-cell) grid for the given month (0-indexed), padded with the
 * trailing days of the previous month and leading days of the next so every
 * week row is complete — the standard month-calendar layout. 6 weeks always
 * covers every possible month/weekday combination, so the grid size never
 * varies (simpler for the UI than a variable 4-6 row grid).
 */
export function buildMonthGrid(year: number, month: number): CalendarCell[] {
  const firstOfMonth = new Date(year, month, 1);
  const startWeekday = firstOfMonth.getDay();
  const gridStart = new Date(year, month, 1 - startWeekday);

  const cells: CalendarCell[] = [];
  for (let i = 0; i < 42; i++) {
    const date = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
    cells.push({ date, dateKey: dateKeyOf(date), inMonth: date.getMonth() === month });
  }
  return cells;
}
