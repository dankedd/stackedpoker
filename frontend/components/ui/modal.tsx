"use client";

import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidthClassName?: string;
}

/**
 * Shared modal shell (portal + overlay + panel + header) extracted from the
 * bankroll session form modal so every future modal (e.g. wallet
 * deposit/withdrawal) reuses the same one, instead of re-hand-rolling the
 * portal/overlay boilerplate per feature. Uses the same createPortal
 * technique as components/layout/UserMenu.tsx — no Dialog library added.
 *
 * Gated by `if (!open) return null` (rather than calling createPortal
 * conditionally inline) so `document` is never touched during SSR, matching
 * UserMenu's `{open && createPortal(...)}` pattern.
 */
export function Modal({ open, onClose, title, children, maxWidthClassName = "max-w-lg" }: ModalProps) {
  if (!open) return null;

  const modal = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className={cn(
          "w-full rounded-2xl border border-white/10 bg-[#0B1120] shadow-2xl shadow-black/60 max-h-[90vh] overflow-y-auto",
          maxWidthClassName
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.07] sticky top-0 bg-[#0B1120] z-10">
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground/50 hover:text-foreground hover:bg-white/5 transition-all"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
