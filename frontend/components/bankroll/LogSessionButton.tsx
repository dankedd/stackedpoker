"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { SessionFormModal } from "@/components/bankroll/SessionFormModal";

interface LogSessionButtonProps {
  className?: string;
  label?: string;
}

/**
 * The primary "add a session" action, usable from any (server-rendered)
 * /bankroll page without converting the whole page to a client component —
 * this owns the modal-open state itself and just needs the current user.
 * Logging a session is the single most frequent action on the whole
 * bankroll section (every stat, chart and insight is downstream of it), so
 * this is deliberately styled as the one big gradient CTA, distinct from
 * the secondary outline nav pills (Wallet, Stats, ...) next to it.
 */
export function LogSessionButton({ className, label = "Log Session" }: LogSessionButtonProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  if (!user) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "group relative overflow-hidden inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-blue-500 text-white text-sm font-semibold shadow-lg shadow-violet-500/25 hover:shadow-violet-500/45 hover:-translate-y-0.5 transition-all duration-200",
          className
        )}
      >
        <div aria-hidden className="pointer-events-none absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        <Plus className="h-4 w-4" />
        {label}
      </button>

      <SessionFormModal
        open={open}
        userId={user.id}
        editing={null}
        onClose={() => setOpen(false)}
        onSaved={() => router.refresh()}
      />
    </>
  );
}
