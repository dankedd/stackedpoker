"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { SessionFormModal } from "@/components/bankroll/SessionFormModal";

interface LogSessionButtonProps {
  className?: string;
  label?: string;
}

const baseButtonCls =
  "group relative overflow-hidden inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-violet-600 to-blue-500 text-white text-base font-bold shadow-lg shadow-violet-500/30 glow-purple hover:shadow-violet-500/50 hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200";

/**
 * The primary "add a session" action, usable from any (server-rendered)
 * /bankroll page without converting the whole page to a client component —
 * this owns the modal-open state itself and just needs the current user.
 * Logging a session is the single most frequent action on the whole
 * bankroll section (every stat, chart and insight is downstream of it), so
 * this is deliberately the biggest, most eye-catching CTA on the page —
 * bigger text/padding and a persistent glow, not just another outline nav
 * pill next to it.
 *
 * Always renders at the same size (a disabled loading state while
 * useAuth() resolves, never `return null`) — the server component that
 * hosts this already redirects signed-out visitors away, so a user is
 * guaranteed to exist here; the only question is whether the client-side
 * auth context has hydrated yet. Returning null during that brief window
 * used to make the button flash out of existence on every page load.
 */
export function LogSessionButton({ className, label = "Log Session" }: LogSessionButtonProps) {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  if (authLoading || !user) {
    return (
      <button type="button" disabled aria-hidden className={cn(baseButtonCls, "opacity-60 cursor-default", className)}>
        <Loader2 className="h-4 w-4 animate-spin" />
        {label}
      </button>
    );
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={cn(baseButtonCls, className)}>
        <div aria-hidden className="pointer-events-none absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/15 to-transparent" />
        <Plus className="h-5 w-5" />
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
