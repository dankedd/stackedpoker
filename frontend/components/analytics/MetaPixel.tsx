"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { createClient } from "@/lib/supabase/client";
import { readSignupIntent } from "@/lib/ranges/guestProgress";
import {
  CONSENT_CHANGE_EVENT,
  META_PIXEL_ID,
  captureUtm,
  flushPending,
  readConsent,
  readUtm,
  track,
  type Consent,
} from "@/lib/metaPixel";

/**
 * Meta Pixel, mounted once from the root layout.
 *
 * Nothing loads until the visitor accepted in the ConsentBanner: without
 * consent there is no script tag and no request to facebook.com or
 * connect.facebook.net. The <noscript> image fallback is left out on purpose,
 * because it would fire without consent.
 *
 * The base code sends the first PageView; later client-side route changes
 * send one each. Declining mid-session revokes immediately, and the script is
 * not loaded again on the next page load.
 */
export function MetaPixel() {
  const pathname = usePathname();
  const [consent, setConsent] = useState<Consent | null>(null);
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    captureUtm();
    setConsent(readConsent());
    const onChange = (e: Event) => {
      const value = (e as CustomEvent<Consent>).detail;
      setConsent(value);
      // Script already ran this session (a revoke, then a new accept).
      if (window.fbq) {
        window.fbq("consent", value === "granted" ? "grant" : "revoke");
        if (value === "granted") window.fbq("track", "PageView");
      }
    };
    window.addEventListener(CONSENT_CHANGE_EVENT, onChange);
    return () => window.removeEventListener(CONSENT_CHANGE_EVENT, onChange);
  }, []);

  const granted = consent === "granted";

  // One PageView per client-side route change; the base code covers the first.
  useEffect(() => {
    if (!granted) {
      lastPath.current = null;
      return;
    }
    if (lastPath.current === null) {
      lastPath.current = pathname;
      return;
    }
    if (pathname !== lastPath.current) {
      lastPath.current = pathname;
      track("PageView");
    }
  }, [pathname, granted]);

  // Events fired before the inline script ran are sent once it has.
  useEffect(() => {
    if (!granted) return;
    let tries = 0;
    const id = window.setInterval(() => {
      if (window.fbq || ++tries > 100) {
        flushPending();
        window.clearInterval(id);
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [granted]);

  return (
    <>
      <SignupAttribution />
      {granted && (
        <Script id="meta-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${META_PIXEL_ID}');
fbq('track', 'PageView');`}
        </Script>
      )}
    </>
  );
}

const NEW_ACCOUNT_WINDOW_MS = 15 * 60 * 1000;

/**
 * Google sign-ups finish on the server (/auth/callback), so the first page a
 * brand-new OAuth account sees reports CompleteRegistration and saves the
 * session's UTM data with the user. Email sign-ups do both on the signup page.
 * The `signup_attributed` flag in user_metadata makes it once per account.
 */
function SignupAttribution() {
  const { user } = useAuth();
  const done = useRef(false);

  useEffect(() => {
    if (!user || done.current) return;
    const provider = user.app_metadata?.provider;
    if (!provider || provider === "email") return;
    if (user.user_metadata?.signup_attributed) return;
    if (Date.now() - new Date(user.created_at).getTime() > NEW_ACCOUNT_WINDOW_MS) return;
    done.current = true;
    // Signed up from the trainer's save-progress prompt or banner.
    const source = readSignupIntent()?.source;
    track("CompleteRegistration", { registration_method: provider, ...(source ? { source } : {}) });
    const utm = readUtm();
    void createClient().auth.updateUser({
      data: { signup_attributed: true, ...(utm ? { signup_utm: utm } : {}), ...(source ? { signup_source: source } : {}) },
    });
  }, [user]);

  return null;
}
