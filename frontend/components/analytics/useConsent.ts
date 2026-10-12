"use client";

import { useEffect, useState } from "react";
import { CONSENT_CHANGE_EVENT, readConsent, type Consent } from "@/lib/metaPixel";

/** The visitor's cookie choice; null until mounted or until they choose. */
export function useConsent(): Consent | null {
  const [consent, setConsent] = useState<Consent | null>(null);
  useEffect(() => {
    setConsent(readConsent());
    const onChange = (e: Event) => setConsent((e as CustomEvent<Consent>).detail);
    window.addEventListener(CONSENT_CHANGE_EVENT, onChange);
    return () => window.removeEventListener(CONSENT_CHANGE_EVENT, onChange);
  }, []);
  return consent;
}
