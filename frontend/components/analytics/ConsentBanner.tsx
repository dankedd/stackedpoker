"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { CONSENT_OPEN_EVENT, openConsentSettings, readConsent, writeConsent, type Consent } from "@/lib/metaPixel";

/**
 * Cookie consent for the Meta Pixel. Shown once, until the visitor chooses;
 * "Cookie settings" in the footer reopens it. Accept and Decline share one
 * style and size so neither is the easier click.
 */
export function ConsentBanner() {
  const [open, setOpen] = useState(false);
  // Embedded hands (/embed) live inside other sites: no banner there, and
  // without consent nothing is tracked.
  const embedded = (usePathname() ?? "").startsWith("/embed/");

  useEffect(() => {
    if (readConsent() === null) setOpen(true);
    const reopen = () => setOpen(true);
    window.addEventListener(CONSENT_OPEN_EVENT, reopen);
    return () => window.removeEventListener(CONSENT_OPEN_EVENT, reopen);
  }, []);

  if (!open || embedded) return null;

  const choose = (value: Consent) => {
    writeConsent(value);
    setOpen(false);
  };

  const button =
    "h-10 flex-1 rounded-xl border border-[#7C5CFF]/60 bg-[#7C5CFF]/15 px-5 text-sm font-semibold text-white transition-colors hover:bg-[#7C5CFF]/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C5CFF] sm:flex-none";

  return (
    <div
      role="region"
      aria-label="Cookie consent"
      className="fixed inset-x-0 bottom-0 z-[60] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:bottom-4 sm:left-4 sm:right-auto sm:max-w-md sm:p-0"
    >
      <div className="rounded-2xl border border-white/10 bg-[#0B0E1A] p-4 shadow-2xl shadow-black/60">
        <p className="text-sm leading-relaxed text-white/85">
          We use cookies to measure our ads and improve the site.
        </p>
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={() => choose("granted")} className={button}>
            Accept
          </button>
          <button type="button" onClick={() => choose("denied")} className={button}>
            Decline
          </button>
        </div>
      </div>
    </div>
  );
}

/** Footer link that reopens the banner. */
export function CookieSettingsLink({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={openConsentSettings}
      className={className}
    >
      Cookie settings
    </button>
  );
}
