export interface SessionTimestamps {
  startedAt: string;
  endedAt: string;
  durationMinutes: number;
}

/**
 * Combines a date + two local time-of-day strings (from <input type="date">
 * and <input type="time">) into started_at/ended_at ISO timestamps.
 *
 * If the end time is earlier than the start time, the session is assumed to
 * have crossed midnight and ended_at rolls forward one day. bankroll_sessions
 * has a CHECK (ended_at >= started_at) constraint, so this isn't just a UX
 * nicety — without it, saving any session that runs past midnight would
 * fail the insert/update.
 */
export function buildSessionTimestamps(date: string, beginTime: string, endTime: string): SessionTimestamps {
  const started = new Date(`${date}T${beginTime}`);
  let ended = new Date(`${date}T${endTime}`);
  if (ended.getTime() < started.getTime()) {
    ended = new Date(ended.getTime() + 24 * 60 * 60 * 1000);
  }
  const durationMinutes = Math.round((ended.getTime() - started.getTime()) / 60000);
  return { startedAt: started.toISOString(), endedAt: ended.toISOString(), durationMinutes };
}

/** Inverse of buildSessionTimestamps, for pre-filling the edit form from stored timestamps. */
export function splitSessionTimestamps(startedAt: string, endedAt: string | null): {
  date: string;
  beginTime: string;
  endTime: string;
} {
  const pad = (n: number) => String(n).padStart(2, "0");
  const start = new Date(startedAt);
  const date = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`;
  const beginTime = `${pad(start.getHours())}:${pad(start.getMinutes())}`;
  const end = endedAt ? new Date(endedAt) : start;
  const endTime = `${pad(end.getHours())}:${pad(end.getMinutes())}`;
  return { date, beginTime, endTime };
}

/** Result = cash_out - buy_in. The session form always writes buy_in_amount: 0, but
 *  display computes the full difference so it's correct for any row, however written. */
export function computeSessionResult(session: { buy_in_amount: number; cash_out_amount: number | null }): number {
  return (session.cash_out_amount ?? 0) - (session.buy_in_amount ?? 0);
}
