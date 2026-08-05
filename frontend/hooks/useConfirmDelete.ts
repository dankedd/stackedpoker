import { useCallback, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Click-to-arm, click-again-to-confirm delete flow with optimistic removal
 * and resync-on-failure — the exact pattern /bankroll/sessions and
 * /bankroll/goals each hand-rolled separately (setConfirmId state +
 * filter-then-delete-then-resync-on-error). Generic over any table with a
 * uuid `id` column and a local list of `{ id: string }`-shaped items.
 */
export function useConfirmDelete<T extends { id: string }>(
  table: string,
  setItems: React.Dispatch<React.SetStateAction<T[]>>,
  onError: () => void
) {
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const handleDelete = useCallback(async (id: string) => {
    if (confirmId !== id) {
      setConfirmId(id);
      return;
    }
    setConfirmId(null);
    setItems((prev) => prev.filter((item) => item.id !== id));

    const supabase = createClient();
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) {
      console.error(`[bankroll] delete from ${table} failed:`, error.message);
      onError(); // resync — the optimistic removal above may have been wrong
    }
  }, [confirmId, table, setItems, onError]);

  return { confirmId, handleDelete, cancelDelete: () => setConfirmId(null) };
}
