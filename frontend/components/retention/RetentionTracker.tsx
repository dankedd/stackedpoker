"use client";

import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { createClient } from "@/lib/supabase/client";
import { CONSENT_CHANGE_EVENT, readConsent, trackCustom } from "@/lib/metaPixel";
import { SEO_EVENTS, trackEvent } from "@/lib/seo/analytics";

/**
 * Signed-in housekeeping for the retention features, mounted once in the
 * root layout:
 *  - saves the browser's time zone (profiles.timezone), so streaks and
 *    "today" follow the user's own midnight — once per browser session;
 *  - fires ReturnVisit (Meta custom event + GA4) the first time per day the
 *    user is here on a day other than their signup day. Both trackers are
 *    consent-gated; the day is only marked done once consent allowed it.
 */

const TZ_KEY = "sp_tz_synced";
const RETURN_KEY = "sp_return_visit_day";

function localDay(d: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

export function RetentionTracker() {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading || !user) return;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!tz) return;

    try {
      if (window.sessionStorage.getItem(TZ_KEY) !== `${user.id}:${tz}`) {
        void Promise.resolve(createClient().rpc("set_my_timezone", { p_tz: tz })).then(({ error }) => {
          if (!error) {
            try {
              window.sessionStorage.setItem(TZ_KEY, `${user.id}:${tz}`);
            } catch {}
          }
        });
      }
    } catch {}

    const fireReturnVisit = () => {
      const today = localDay(new Date(), tz);
      const signupDay = localDay(new Date(user.created_at), tz);
      if (today === signupDay || readConsent() !== "granted") return;
      try {
        if (window.localStorage.getItem(RETURN_KEY) === `${user.id}:${today}`) return;
      } catch {}
      const days = Math.max(1, Math.round((Date.parse(today) - Date.parse(signupDay)) / 86_400_000));
      trackCustom("ReturnVisit", { days_since_signup: days });
      trackEvent(SEO_EVENTS.returnVisit, { days_since_signup: days });
      try {
        window.localStorage.setItem(RETURN_KEY, `${user.id}:${today}`);
      } catch {}
    };
    fireReturnVisit();
    // Consent given later on this page view counts too.
    window.addEventListener(CONSENT_CHANGE_EVENT, fireReturnVisit);
    return () => window.removeEventListener(CONSENT_CHANGE_EVENT, fireReturnVisit);
  }, [user, loading]);

  return null;
}
