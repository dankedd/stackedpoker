"use client";

import { useState } from "react";
import { Flag } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import { createClient } from "@/lib/supabase/client";
import { REPORT_REASONS, SHARED_HAND, socialErrorMessage } from "@/lib/social/strings";
import { cn } from "@/lib/utils";

/** Report any registered target (moderation_targets) through report_content(). */
export function ReportButton({ targetType, targetId, className }: { targetType: string; targetId: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("spam");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { data, error } = await createClient().rpc("report_content", {
      p_target_type: targetType,
      p_target_id: targetId,
      p_reason: reason,
      p_details: details.trim() || null,
    });
    setBusy(false);
    const res = data as { ok?: boolean; error?: string } | null;
    if (error || !res?.ok) {
      toast.error(socialErrorMessage(error?.message ?? res?.error));
      if (res?.error === "duplicate") setOpen(false);
      return;
    }
    toast.success(SHARED_HAND.reported);
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn("inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-xs text-muted-foreground hover:text-foreground", className)}
      >
        <Flag className="h-3.5 w-3.5" /> {SHARED_HAND.report}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={SHARED_HAND.report} bodyClassName="px-4 py-4 sm:px-6">
        <form onSubmit={send} className="space-y-3">
          <div className="space-y-1">
            {Object.entries(REPORT_REASONS).map(([value, label]) => (
              <label key={value} className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-white/[0.03]">
                <input type="radio" name="report-reason" className="accent-[#7C5CFF]" checked={reason === value} onChange={() => setReason(value)} />
                <span className="text-sm text-foreground">{label}</span>
              </label>
            ))}
          </div>
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            maxLength={500}
            rows={3}
            style={{ fontSize: "16px" }}
            className="w-full rounded-lg border border-border/60 bg-background/60 p-3 text-foreground focus:outline-none focus:ring-2 focus:ring-[#7C5CFF]"
          />
          <button
            type="submit"
            disabled={busy}
            className="h-10 w-full rounded-lg bg-[#7C5CFF] text-sm font-semibold text-white hover:bg-[#6B4BEE] disabled:opacity-50"
          >
            {SHARED_HAND.report}
          </button>
        </form>
      </Modal>
    </>
  );
}
