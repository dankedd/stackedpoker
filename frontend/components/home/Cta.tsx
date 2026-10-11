"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { SEO_EVENTS, trackEvent } from "@/lib/seo/analytics";
import { cn } from "@/lib/utils";

export const SIGNUP_PATH = "/signup";
export const TRAINER_PATH = "/preflop-trainer";

/** Query parameters a signup link carries over from the landing URL. */
const KEEP = /^(utm_[a-z_]+|fbclid|gclid|ref)$/i;

/** `/signup` with the visitor's UTM / fbclid / gclid parameters, so attribution survives. */
export function useSignupHref(path = SIGNUP_PATH): string {
  const [href, setHref] = useState(path);
  useEffect(() => {
    const keep = new URLSearchParams();
    new URLSearchParams(window.location.search).forEach((v, k) => KEEP.test(k) && keep.append(k, v));
    const q = keep.toString();
    setHref(q ? `${path}?${q}` : path);
  }, [path]);
  return href;
}

export type CtaLocation = "header" | "hero" | "demo" | "bento" | "showcase" | "pricing" | "final";

const PRIMARY =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 font-semibold text-white shadow-lg shadow-violet-900/40 transition-[transform,opacity] duration-200 [transition-timing-function:var(--hp-ease)] hover:-translate-y-0.5 hover:opacity-95 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070A12] hover:bg-violet-500";
const GHOST =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 px-5 font-semibold text-white/90 transition-[transform,opacity] duration-200 [transition-timing-function:var(--hp-ease)] hover:-translate-y-0.5 hover:border-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300";

/** "Start training free" → /signup (keeps UTM/fbclid), tracked as cta_click. */
export function StartFreeButton({ location, className, children = "Start training free", size = "md" }: { location: CtaLocation; className?: string; children?: ReactNode; size?: "md" | "lg" | "sm" }) {
  const href = useSignupHref();
  return (
    <Link
      href={href}
      onClick={() => trackEvent(SEO_EVENTS.ctaClick, { location, cta: "start_free" })}
      className={cn(PRIMARY, size === "lg" ? "h-12 text-base" : size === "sm" ? "h-9 px-3.5 text-sm" : "h-11 text-[15px]", className)}
    >
      {children}
    </Link>
  );
}

/** "Try the trainer" → /preflop-trainer (no account needed). */
export function TryTrainerButton({ location, className, children = "Try the trainer" }: { location: CtaLocation; className?: string; children?: ReactNode }) {
  return (
    <Link href={TRAINER_PATH} onClick={() => trackEvent(SEO_EVENTS.ctaClick, { location, cta: "try_trainer" })} className={cn(GHOST, "h-11 text-[15px]", className)}>
      {children}
    </Link>
  );
}

export function FrictionLine({ className }: { className?: string }) {
  return <p className={cn("text-[13px] text-white/55", className)}>Free forever plan · No credit card · Cancel anytime</p>;
}
