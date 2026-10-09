"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { fetchTrainerState, type HandXpResult, type TrainerXpState } from "@/lib/ranges/api";

const STORAGE_KEY = "mpt-trainer-highscore";

function readLocal(): number {
  try {
    return Number(localStorage.getItem(STORAGE_KEY) ?? 0) || 0;
  } catch {
    return 0;
  }
}

function writeLocal(n: number) {
  try {
    localStorage.setItem(STORAGE_KEY, String(n));
  } catch {
    // Private window / blocked storage: the record just lasts this session.
  }
}

/**
 * Streak record and XP state for the trainer.
 *
 * Signed out: the record lives in localStorage and no XP is earned.
 * Signed in: the SERVER owns streak, record and today's XP
 * (supabase_preflop_trainer_xp.sql) — the streak carries over between
 * sessions, and every number shown comes from a server response.
 */
export function useTrainerProgress() {
  const { user, session } = useAuth();
  const token = session?.access_token ?? "";
  const signedIn = Boolean(user && token);
  const [high, setHigh] = useState(0);
  const [xpState, setXpState] = useState<TrainerXpState | null>(null);
  const highRef = useRef(0);

  const setRecord = useCallback((n: number) => {
    highRef.current = n;
    setHigh(n);
  }, []);

  // Guests: local record.
  useEffect(() => {
    if (!signedIn) {
      setXpState(null);
      setRecord(readLocal());
    }
  }, [signedIn, setRecord]);

  // Signed in: server state.
  useEffect(() => {
    if (!signedIn) return;
    let cancelled = false;
    fetchTrainerState(token)
      .then((s) => {
        if (cancelled) return;
        setXpState(s);
        setRecord(s.best_streak);
      })
      .catch(() => {
        // No XP state (offline, backend down): the trainer still works, it just
        // shows no XP numbers until the next successful hand.
      });
    return () => {
      cancelled = true;
    };
    // Re-run on a new user only, not on every token refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, signedIn, setRecord]);

  /** Guests only. Returns true when `streak` is a new record. */
  const recordLocalStreak = useCallback(
    (streak: number): boolean => {
      if (streak <= highRef.current) return false;
      setRecord(streak);
      writeLocal(streak);
      return true;
    },
    [setRecord],
  );

  /** Signed in: adopt the server's numbers. Returns true when this hand set a new record. */
  const applyHandResult = useCallback(
    (r: HandXpResult): boolean => {
      const isRecord = r.best_streak > highRef.current && r.streak === r.best_streak;
      setRecord(r.best_streak);
      setXpState({
        streak: r.streak,
        best_streak: r.best_streak,
        daily_xp: r.daily_xp,
        daily_cap: r.daily_cap,
        xp_per_correct: r.xp_per_correct,
        next_tier_at: r.next_tier_at,
      });
      return isRecord;
    },
    [setRecord],
  );

  const resetLocal = useCallback(() => {
    setRecord(0);
    writeLocal(0);
  }, [setRecord]);

  return { signedIn, token, high, xpState, recordLocalStreak, applyHandResult, resetLocal };
}
