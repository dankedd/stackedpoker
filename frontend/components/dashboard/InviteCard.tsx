"use client";

import { useEffect, useState } from "react";
import { Check, Copy, UserPlus } from "lucide-react";
import { DASH } from "@/lib/dashboard/strings";

const I = DASH.social.invite;

/**
 * "Invite a friend": the invite link (signup with utm_source=invite, recorded
 * in signup_utm like share referrals), a copy button and a QR code for
 * showing a phone across the table. The QR library loads only here.
 */
export function InviteCard({ url }: { url: string }) {
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    import("qrcode")
      .then((m) => m.toDataURL(url, { margin: 1, width: 192, color: { dark: "#0B0E1A", light: "#FFFFFF" } }))
      .then((d) => !cancelled && setQr(d))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [url]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: the link stays visible to copy by hand.
    }
  }

  return (
    <div className="flex items-start gap-4">
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 font-semibold text-foreground">
          <UserPlus aria-hidden className="h-4 w-4 text-violet-300" />
          {I.title}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">{I.body}</p>
        <p className="mt-2 truncate rounded-lg bg-white/[0.03] px-2.5 py-1.5 font-mono text-xs text-muted-foreground">{url}</p>
        <button
          type="button"
          onClick={() => void copy()}
          className="mt-2 inline-flex h-9 items-center gap-1.5 rounded-lg bg-violet-500/15 px-3.5 text-sm font-semibold text-violet-200 transition-colors hover:bg-violet-500/25"
        >
          {copied ? <Check aria-hidden className="h-4 w-4" /> : <Copy aria-hidden className="h-4 w-4" />}
          {copied ? I.copied : I.copy}
        </button>
      </div>
      <div className="h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-white p-1">
        {/* eslint-disable-next-line @next/next/no-img-element -- a data: URL generated in the browser */}
        {qr && <img src={qr} alt={I.qr} width={88} height={88} className="h-full w-full" />}
      </div>
    </div>
  );
}
