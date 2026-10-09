"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { createClient } from "@/lib/supabase/client";

const STORAGE_KEY = "mpt-trainer-highscore";
const TRAINER_KEY = "preflop-ranges";

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
 * Best streak. Always kept in localStorage; when signed in, also in
 * `trainer_highscores` (see supabase_trainer_highscores.sql) and merged as
 * max(local, server). Every server error is swallowed — a missing table or a
 * network blip must never break the trainer, only its persistence.
 */
export function useHighscore() {
  const { user } = useAuth();
  const [high, setHigh] = useState(0);
  const highRef = useRef(0);

  const apply = useCallback((n: number) => {
    highRef.current = n;
    setHigh(n);
    writeLocal(n);
  }, []);

  useEffect(() => {
    apply(Math.max(highRef.current, readLocal()));
  }, [apply]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from("trainer_highscores")
          .select("best_streak")
          .eq("user_id", user.id)
          .eq("trainer_key", TRAINER_KEY)
          .maybeSingle();
        if (cancelled) return;
        const server = data?.best_streak ?? 0;
        const merged = Math.max(server, highRef.current);
        if (merged > highRef.current) apply(merged);
        if (merged > server) await supabase.rpc("record_trainer_streak", { p_trainer_key: TRAINER_KEY, p_streak: merged });
      } catch {
        /* persistence only */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, apply]);

  /** Returns true when `streak` is a new record. */
  const submit = useCallback(
    (streak: number): boolean => {
      if (streak <= highRef.current) return false;
      apply(streak);
      if (user) {
        createClient()
          .rpc("record_trainer_streak", { p_trainer_key: TRAINER_KEY, p_streak: streak })
          .then(
            () => undefined,
            () => undefined,
          );
      }
      return true;
    },
    [user, apply],
  );

  const reset = useCallback(() => apply(0), [apply]);

  return { high, submit, reset, signedIn: Boolean(user) };
}
