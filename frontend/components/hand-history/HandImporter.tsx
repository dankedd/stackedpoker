"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, ChevronDown, FileArchive, Loader2, Upload } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { createClient } from "@/lib/supabase/client";
import { HANDS_PATH } from "@/lib/handHistory/feature";
import { fmtNum } from "@/lib/handHistory/format";
import { parseTexts, readFiles, saveHands, type ImportProgress, type ImportSummary } from "@/lib/handHistory/importer";
import { t } from "@/lib/handHistory/strings";
import { cn } from "@/lib/utils";
import { PageHeader, SectionNav } from "./SectionNav";

const PHASE_LABEL: Record<ImportProgress["phase"], string> = t.import.phase;

export function HandImporter() {
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busy = progress != null && progress.phase !== "done";

  const run = useCallback(
    async (files: File[]) => {
      if (!files.length || busy) return;
      if (!user) {
        setError(t.import.notSignedIn);
        return;
      }
      setError(null);
      setSummary(null);
      try {
        const { texts, fileErrors } = await readFiles(files, setProgress);
        setProgress({ phase: "parsing", done: 0, total: texts.length });
        // Let the progress bar paint before the (synchronous) parse.
        await new Promise((r) => setTimeout(r, 0));
        const parsed = parseTexts(texts);
        parsed.fileErrors.unshift(...fileErrors);
        if (!parsed.entries.length) {
          setProgress(null);
          setSummary({ tournaments: 0, imported: 0, skipped: parsed.duplicatesInUpload, failures: parsed.failures, fileErrors: parsed.fileErrors, importId: null });
          if (!parsed.failures.length && !parsed.fileErrors.length) setError(t.import.noHandsFound);
          return;
        }
        const result = await saveHands(supabase, user.id, files.map((f) => f.name), parsed, setProgress);
        setSummary(result);
      } catch (e) {
        setError(e instanceof Error ? e.message : t.import.failed);
      } finally {
        setProgress((p) => (p ? { ...p, phase: "done" } : p));
      }
    },
    [busy, supabase, user],
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

      <div
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
          accept=".zip,.txt,application/zip,text/plain"
          className="hidden"
          onChange={(e) => {
            run(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
      </div>

      <details className="mt-4 rounded-xl border border-border/50 bg-card/20 px-4 py-3 text-sm text-muted-foreground">
        <summary className="cursor-pointer font-medium text-foreground">{t.import.howTo}</summary>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>{t.import.howTo1}</li>
          <li>{t.import.howTo2}</li>
        </ol>
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

      {summary && <Summary summary={summary} />}
    </div>
  );
}

function Summary({ summary }: { summary: ImportSummary }) {
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
        {summary.imported > 0 && (
          <Link href={HANDS_PATH} className="mt-5 inline-flex rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500">
            {t.import.viewHands}
          </Link>
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
