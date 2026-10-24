"use client";

import { useState } from "react";
import { Download, Trash2 } from "lucide-react";
import { ACCOUNT_DATA } from "@/lib/social/strings";

/** Settings card: GDPR export (GET /api/account/export) and account deletion. */
export function AccountDataCard() {
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function download() {
    setExporting(true);
    setExportError(null);
    try {
      const res = await fetch("/api/account/export", { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      const name = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? "stacked-poker-data.json";
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement("a"), { href: url, download: name });
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setExportError(ACCOUNT_DATA.exportFailed);
    } finally {
      setExporting(false);
    }
  }

  async function remove(e: React.FormEvent) {
    e.preventDefault();
    if (typed !== ACCOUNT_DATA.deleteConfirmWord) return;
    setDeleting(true);
    setDeleteError(null);
    const res = await fetch("/api/account/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: ACCOUNT_DATA.deleteConfirmWord }),
    }).catch(() => null);
    const json = (await res?.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    if (json?.ok) {
      window.location.assign("/");
      return;
    }
    setDeleting(false);
    setDeleteError(json?.error === "active_subscription" ? ACCOUNT_DATA.deleteActiveSubscription : ACCOUNT_DATA.deleteFailed);
  }

  return (
    <div className="mt-6 divide-y divide-border/40 rounded-xl border border-border/60 bg-card/60">
      <div className="px-6 py-4">
        <h2 className="font-semibold text-foreground">{ACCOUNT_DATA.title}</h2>
      </div>
      <div className="space-y-2 px-6 py-5">
        <button
          type="button"
          onClick={download}
          disabled={exporting}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-border/60 px-3 text-sm font-medium text-foreground hover:bg-white/[0.04] disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          {exporting ? ACCOUNT_DATA.exporting : ACCOUNT_DATA.exportLabel}
        </button>
        <p className="text-xs text-muted-foreground/70">{ACCOUNT_DATA.exportHelp}</p>
        {exportError && (
          <p role="alert" className="text-xs text-red-400">
            {exportError}
          </p>
        )}
      </div>
      <div className="space-y-2 px-6 py-5">
        {!confirming ? (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-red-500/40 px-3 text-sm font-medium text-red-400 hover:bg-red-500/10"
          >
            <Trash2 className="h-4 w-4" />
            {ACCOUNT_DATA.deleteLabel}
          </button>
        ) : (
          <form onSubmit={remove} className="space-y-2">
            <label htmlFor="delete-confirm" className="text-sm text-muted-foreground">
              {ACCOUNT_DATA.deleteConfirmPrompt}
            </label>
            <div className="flex gap-2">
              <input
                id="delete-confirm"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
                autoCapitalize="characters"
                style={{ fontSize: "16px" }}
                className="h-9 min-w-0 flex-1 rounded-lg border border-red-500/40 bg-background/60 px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-red-500/60"
              />
              <button
                type="submit"
                disabled={deleting || typed !== ACCOUNT_DATA.deleteConfirmWord}
                className="h-9 shrink-0 rounded-lg bg-red-600 px-3 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? ACCOUNT_DATA.deleting : ACCOUNT_DATA.deleteButton}
              </button>
            </div>
          </form>
        )}
        <p className="text-xs text-muted-foreground/70">{ACCOUNT_DATA.deleteHelp}</p>
        {deleteError && (
          <p role="alert" className="text-xs text-red-400">
            {deleteError}
          </p>
        )}
      </div>
    </div>
  );
}
