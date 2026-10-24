"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2, Lock } from "lucide-react";
import { AlreadySubscribedError, requestCheckoutUrl } from "@/components/poker/UpgradePrompt";
import { useAuth } from "@/contexts/AuthContext";
import { UPGRADE_SOURCES, type UpgradeSource } from "@/lib/billing/entitlements";
import { CHECKOUT } from "@/lib/billing/strings";

type State = "working" | "signin" | "already" | "failed";

export function CheckoutRedirect() {
  const params = useSearchParams();
  const raw = params.get("source");
  const source: UpgradeSource = UPGRADE_SOURCES.includes(raw as UpgradeSource) ? (raw as UpgradeSource) : "pricing_page";
  const { user, loading } = useAuth();
  const [state, setState] = useState<State>("working");
  const started = useRef(false);

  const go = useCallback(async () => {
    setState("working");
    try {
      // Same tab: this page has nothing else to show.
      window.location.replace(await requestCheckoutUrl(source));
    } catch (e) {
      if (e instanceof AlreadySubscribedError) {
        setState("already");
        window.location.replace("/dashboard");
      } else {
        setState("failed");
      }
    }
  }, [source]);

  useEffect(() => {
    if (loading || started.current) return;
    started.current = true;
    if (!user) {
      setState("signin");
      window.location.replace(`/login?redirect=${encodeURIComponent(`/checkout?source=${source}`)}`);
      return;
    }
    void go();
  }, [loading, user, source, go]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0B0E1A] px-4">
      <div className="w-full max-w-sm rounded-2xl border border-[#7C5CFF]/40 bg-white/[0.03] p-6 text-center">
        <h1 className="text-lg font-bold text-white">{CHECKOUT.title}</h1>
        <p className="mt-1 text-sm text-white/60">{CHECKOUT.plan}</p>
        {state === "failed" ? (
          <div className="mt-5 space-y-3">
            <p className="text-sm text-red-400">{CHECKOUT.failed}</p>
            <button
              type="button"
              onClick={() => void go()}
              className="flex h-11 w-full items-center justify-center rounded-xl bg-[#7C5CFF] text-sm font-semibold text-white transition-colors hover:bg-[#6B4BEE]"
            >
              {CHECKOUT.retry}
            </button>
            <Link href={`/pricing?source=${source}`} className="block text-sm text-white/60 underline underline-offset-2 hover:text-white">
              {CHECKOUT.toPricing}
            </Link>
          </div>
        ) : (
          <p className="mt-5 flex items-center justify-center gap-2 text-sm text-white/75" aria-live="polite">
            <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
            {state === "signin" ? CHECKOUT.signingIn : state === "already" ? CHECKOUT.alreadyPro : CHECKOUT.opening}
          </p>
        )}
        <p className="mt-5 flex items-center justify-center gap-1.5 text-xs text-white/40">
          <Lock aria-hidden="true" className="h-3 w-3" /> Payments by Stripe
        </p>
      </div>
    </main>
  );
}
