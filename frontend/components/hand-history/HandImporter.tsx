"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, ChevronDown, FileArchive, Loader2, Upload } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { createClient } from "@/lib/supabase/client";
import { HANDS_PATH, handsSummaryPath } from "@/lib/handHistory/feature";
import { fmtNum } from "@/lib/handHistory/format";
import {
  UploadLimitError,
  keepLatestTournament,
  logUnsupportedFiles,
  parseTexts,
  readFiles,
  saveHands,
  type ImportProgress,
  type ImportSummary,
} from "@/lib/handHistory/importer";
import { t } from "@/lib/handHistory/strings";
import { findTournamentId } from "@/lib/handHistory/summary/api";
import { track } from "@/lib/metaPixel";
import { formatDateTime, uploadLimitReached } from "@/lib/billing/entitlements";
import { refreshEntitlements, useEntitlements } from "@/hooks/useEntitlements";
import { UpgradeButton, UpgradeModal, UsageMeter } from "@/components/billing/UpgradeUi";
import { cn } from "@/lib/utils";
import { PageHeader, SectionNav } from "./SectionNav";

const PHASE_LABEL: Record<ImportProgress["phase"], string> = t.import.phase;

interface SummaryLink {
  id: string;
  name: string | null;
}

export function HandImporter() {
  const { user } = useAuth();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [summaryLinks, setSummaryLinks] = useState<SummaryLink[]>([]);
  const [error, setError] = useState<string | null>(null);
  // Free plan: 1 new tournament per rolling 7 days (enforced by the database).
  const { entitlements } = useEntitlements();
  const [limitHit, setLimitHit] = useState<{ nextAt: string | null } | null>(null);
  const [trimmed, setTrimmed] = useState<{ name: string | null; skipped: number } | null>(null);
  const busy = progress != null && progress.phase !== "done";
  const uploadLimit = entitlements?.limits.tournamentsPerWeek ?? null;

  const run = useCallback(
    async (files: File[]) => {
      if (!files.length || busy) return;
      if (!user) {
        setError(t.import.notSignedIn);
        return;
      }
      setError(null);
      setSummary(null);
      setSummaryLinks([]);
      setTrimmed(null);
      if (uploadLimitReached(entitlements)) {
        setLimitHit({ nextAt: entitlements?.nextUploadAt ?? null });
        return;
      }
      try {
        const { texts, fileErrors } = await readFiles(files, setProgress);
        setProgress({ phase: "parsing", done: 0, total: texts.length });
        // Let the progress bar paint before the (synchronous) parse.
        await new Promise((r) => setTimeout(r, 0));
        const parsed = parseTexts(texts);
        parsed.fileErrors.unshift(...fileErrors);
        void logUnsupportedFiles(supabase, user.id, parsed.fileErrors);
        if (!parsed.entries.length) {
          setProgress(null);
          setSummary({ tournaments: 0, tournamentKeys: [], imported: 0, skipped: parsed.duplicatesInUpload, failures: parsed.failures, fileErrors: parsed.fileErrors, importId: null });
          if (!parsed.failures.length && !parsed.fileErrors.length) setError(t.import.noHandsFound);
          return;
        }
        let toSave = parsed;
        let wasTrimmed = false;
        if (uploadLimit !== null) {
          const kept = keepLatestTournament(parsed);
          if (kept.skipped > 0) {
            toSave = kept.parsed;
            wasTrimmed = true;
            setTrimmed({ name: kept.name, skipped: kept.skipped });
          }
        }
        const result = await saveHands(supabase, user.id, files.map((f) => f.name), toSave, setProgress);
        if (result.imported > 0) track("ViewContent", { content_name: "Hand history upload", num_items: result.tournaments });
        void refreshEntitlements();
        const links = await summaryLinksFor(supabase, result.tournamentKeys);
        // One clean tournament: straight to its summary (it shows its own loading state).
        if (links.length === 1 && !wasTrimmed && !result.failures.length && !result.fileErrors.length) {
          router.push(handsSummaryPath(links[0].id));
          return;
        }
        setSummaryLinks(links);
        setSummary(result);
      } catch (e) {
        if (e instanceof UploadLimitError) {
          setProgress(null);
          setTrimmed(null);
          setLimitHit({ nextAt: e.nextAvailableAt });
          void refreshEntitlements();
        } else {
          setError(e instanceof Error ? e.message : t.import.failed);
        }
      } finally {
        setProgress((p) => (p ? { ...p, phase: "done" } : p));
      }
    },
    [busy, supabase, user, entitlements, uploadLimit, router],
  );

  const pct = progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="page-enter">
      <div className="mb-6">
        <SectionNav />
      </div>
      <PageHeader
        title={t.import.title}
        subtitle={t.import.subtitle}
      />

      {entitlements && uploadLimit !== null && (
        <div className="-mt-2 mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <UsageMeter used={entitlements.usage.tournamentsThisWeek} limit={uploadLimit} label={t.import.uploadsThisWeek} />
          {entitlements.nextUploadAt && <span>{t.import.nextFreeUpload(formatDateTime(entitlements.nextUploadAt))}</span>}
        </div>
      )}

      <div
        data-tour="hands-upload"
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          run(Array.from(e.dataTransfer.files));
        }}
        className={cn(
          "flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-colors",
          dragging ? "border-violet-400 bg-violet-500/10" : "border-border/70 bg-card/30",
          busy && "pointer-events-none opacity-60",
        )}
      >
        <FileArchive className="mb-3 h-10 w-10 text-violet-300" />
        <p className="font-semibold">{t.import.dropHere}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t.import.dropHint}</p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
        >
          <Upload className="h-4 w-4" /> {t.import.chooseFiles}
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".zip,.txt,.xml,application/zip,text/plain,text/xml,application/xml"
          className="hidden"
          onChange={(e) => {
            run(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
      </div>

      <details className="mt-4 rounded-xl border border-border/50 bg-card/20 px-4 py-3 text-sm text-muted-foreground">
        <summary className="cursor-pointer font-medium text-foreground">{t.import.howTo}</summary>
        <p className="mt-3 font-medium text-foreground">{t.import.howToGG}</p>
        <ol className="mt-1 list-decimal space-y-1 pl-5">
          <li>{t.import.howToGG1}</li>
          <li>{t.import.howToGG2}</li>
        </ol>
        <p className="mt-3 font-medium text-foreground">{t.import.howToPS}</p>
        <ol className="mt-1 list-decimal space-y-1 pl-5">
          <li>{t.import.howToPS1}</li>
          <li>
            <span className="block break-all font-mono text-xs">{t.import.howToPSWindows}</span>
            <span className="block break-all font-mono text-xs">{t.import.howToPSMac}</span>
          </li>
          <li>{t.import.howToPS2}</li>
        </ol>
        <p className="mt-3">{t.import.howToAgain}</p>
      </details>

      {busy && progress && (
        <div className="mt-6 rounded-xl border border-border/60 bg-card/40 p-4" aria-live="polite">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> {PHASE_LABEL[progress.phase]}…
            </span>
            {progress.total > 0 && (
              <span className="font-mono text-muted-foreground">
                {fmtNum(progress.done)} / {fmtNum(progress.total)}
              </span>
            )}
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-secondary/40">
            <div className="h-full bg-violet-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {error && (
        <div role="alert" className="mt-6 flex gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {summary && trimmed && (
        <div className="mt-6 rounded-2xl border border-[#7C5CFF]/30 bg-[#7C5CFF]/[0.07] p-4 text-sm">
          <p className="text-foreground/90">{t.import.onlyLatestImported(trimmed.name ?? "", trimmed.skipped)}</p>
          <div className="mt-3 max-w-xs">
            <UpgradeButton source="upload_limit">{t.import.importAllWithPro}</UpgradeButton>
          </div>
        </div>
      )}

      {summary && <Summary summary={summary} links={summaryLinks} />}

      {limitHit && (
        <UpgradeModal
          source="upload_limit"
          title={t.import.limitTitle}
          body={t.import.limitBody}
          detail={limitHit.nextAt ? t.import.nextFreeUpload(formatDateTime(limitHit.nextAt)) : undefined}
          onClose={() => setLimitHit(null)}
        />
      )}
    </div>
  );
}

/** hh_tournaments ids of the uploaded tournaments; best effort (no links on failure). */
async function summaryLinksFor(supabase: ReturnType<typeof createClient>, keys: ImportSummary["tournamentKeys"]): Promise<SummaryLink[]> {
  const found = await Promise.all(
    keys.map(async (k) => {
      const id = await findTournamentId(supabase, k.site, k.tournament_id).catch(() => null);
      return id ? { id, name: k.name } : null;
    }),
  );
  return found.filter((l): l is SummaryLink => l != null);
}

function Summary({ summary, links }: { summary: ImportSummary; links: SummaryLink[] }) {
  const problems = summary.failures.length + summary.fileErrors.length;
  return (
    <div className="mt-6 space-y-4" aria-live="polite">
      <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.06] p-5">
        <p className="mb-4 inline-flex items-center gap-2 font-semibold text-emerald-300">
          <CheckCircle2 className="h-5 w-5" /> {t.import.complete}
        </p>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label={t.import.tournaments} value={summary.tournaments} />
          <Stat label={t.import.imported} value={summary.imported} />
          <Stat label={t.import.skipped} value={summary.skipped} />
          <Stat label={t.import.errors} value={problems} tone={problems ? "bad" : undefined} />
        </dl>
        <div className="mt-5 flex flex-wrap gap-2">
          {links.length === 1 && (
            <Link href={handsSummaryPath(links[0].id)} className="inline-flex rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500">
              {t.import.viewSummary}
            </Link>
          )}
          {summary.imported > 0 && (
            <Link
              href={HANDS_PATH}
              className={cn(
                "inline-flex rounded-xl px-4 py-2 text-sm font-semibold",
                links.length === 1 ? "border border-border/60 hover:bg-card" : "bg-violet-600 text-white hover:bg-violet-500",
              )}
            >
              {t.import.viewHands}
            </Link>
          )}
        </div>
        {links.length > 1 && (
          <div className="mt-4">
            <p className="mb-1 text-xs font-semibold text-muted-foreground">{t.import.summaries}</p>
            <ul className="space-y-1 text-sm">
              {links.map((l) => (
                <li key={l.id}>
                  <Link href={handsSummaryPath(l.id)} className="text-violet-300 hover:text-violet-200">
                    {l.name || t.summary.untitled}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {summary.fileErrors.length > 0 && (
        <div className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.05] p-4">
          <p className="mb-2 text-sm font-semibold text-amber-200">{t.import.unreadableFiles}</p>
          <ul className="space-y-1 text-sm">
            {summary.fileErrors.map((f, i) => (
              <li key={i}>
                <span className="font-mono text-xs text-muted-foreground">{f.fileName}</span> — {f.error}
              </li>
            ))}
          </ul>
        </div>
      )}

      {summary.failures.length > 0 && (
        <div className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.05] p-4">
          <p className="mb-2 text-sm font-semibold text-amber-200">
            {t.import.failedHands(summary.failures.length)}
          </p>
          <ul className="space-y-2">
            {summary.failures.slice(0, 100).map((f, i) => (
              <li key={i} className="rounded-lg border border-border/40 bg-background/40">
                <details>
                  <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm">
                    <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="font-mono text-xs">{f.handId ?? t.import.unknownHand}</span>
                    <span className="text-muted-foreground">— {f.error}</span>
                  </summary>
                  <pre className="max-h-64 overflow-auto whitespace-pre-wrap border-t border-border/40 px-3 py-2 font-mono text-[11px] text-muted-foreground">
                    {f.fileName ? `${f.fileName}\n\n` : ""}
                    {f.rawText.slice(0, 4000)}
                  </pre>
                </details>
              </li>
            ))}
          </ul>
          {summary.failures.length > 100 && (
            <p className="mt-2 text-xs text-muted-foreground">{t.import.andMore(summary.failures.length - 100)}</p>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "bad" }) {
  return (
    <div className="rounded-xl bg-background/40 px-3 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn("font-mono text-xl font-bold", tone === "bad" ? "text-amber-300" : "text-foreground")}>
        {fmtNum(value)}
      </dd>
    </div>
  );
}
