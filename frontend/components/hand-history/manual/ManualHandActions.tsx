"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { HANDS_MANUAL_LIST, HANDS_MANUAL_PATH } from "@/lib/handHistory/feature";
import { deleteManualHand } from "@/lib/handHistory/manual/save";
import { t } from "@/lib/handHistory/strings";
import { createClient } from "@/lib/supabase/client";
import { ManualBadge } from "./ManualNotes";

/** Under a manual hand's title: the "Manual" label, Edit and Delete (imports have neither). */
export function ManualHandActions({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const remove = async () => {
    if (!window.confirm(t.manual.confirmDelete)) return;
    setBusy(true);
    try {
      await deleteManualHand(createClient(), id);
      toast.success(t.manual.deleted);
      router.push(HANDS_MANUAL_LIST);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-2">
      <ManualBadge />
      <Link
        href={`${HANDS_MANUAL_PATH}?edit=${id}`}
        className="inline-flex items-center gap-1 rounded-lg border border-white/15 px-2 py-0.5 text-xs font-semibold text-white/85 hover:bg-white/[0.06]"
      >
        <Pencil aria-hidden="true" className="h-3 w-3" /> {t.manual.editHand}
      </Link>
      <button
        type="button"
        onClick={remove}
        disabled={busy}
        className="inline-flex items-center gap-1 rounded-lg border border-rose-500/30 px-2 py-0.5 text-xs font-semibold text-rose-200 hover:bg-rose-500/10 disabled:opacity-50"
      >
        <Trash2 aria-hidden="true" className="h-3 w-3" /> {t.manual.deleteHand}
      </button>
    </div>
  );
}
