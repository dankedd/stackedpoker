"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Code2, Copy, Link2, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import { createClient } from "@/lib/supabase/client";
import { trackCustom } from "@/lib/metaPixel";
import { fmtBb } from "@/lib/handHistory/format";
import { t as hh } from "@/lib/handHistory/strings";
import type { ParsedHand } from "@/lib/handHistory/types";
import { decisionPoints, defaultDecision, type DecisionPoint } from "@/lib/social/share/anonymize";
import {
  createShare,
  embedCode,
  listMyShares,
  revokeShare,
  shareUrl,
  socialShareUrl,
  updateShare,
  type MyShare,
  type ShareVisibility,
} from "@/lib/social/share/api";
import { SHARE, SHARED_HAND, socialErrorMessage } from "@/lib/social/strings";
import { cn } from "@/lib/utils";

const VISIBILITIES: ShareVisibility[] = ["link", "friends", "public"];

/**
 * Create, copy, update and revoke share links for one of the user's hands.
 * `hand` is the full (named) hand; it is anonymised in createShare().
 */
export function ShareDialog({ open, onClose, handId, hand }: { open: boolean; onClose: () => void; handId: string; hand: ParsedHand | null }) {
  const supabase = useMemo(() => createClient(), []);
  const points = useMemo(() => (hand ? decisionPoints(hand) : []), [hand]);
  const [shares, setShares] = useState<MyShare[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<ShareVisibility>("link");
  const [showHeroCards, setShowHeroCards] = useState(true);
  const [showResult, setShowResult] = useState(true);
  const [guess, setGuess] = useState(false);
  const [decisionIdx, setDecisionIdx] = useState<number | null>(null);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    listMyShares(supabase, handId)
      .then((rows) => {
        setShares(rows);
        const live = rows.find((r) => !r.revoked_at);
        if (live) pick(live);
        else reset();
      })
      .catch(() => setShares([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, handId, supabase]);

  useEffect(() => {
    if (decisionIdx == null) setDecisionIdx(defaultDecision(points)?.eventIndex ?? null);
  }, [points, decisionIdx]);

  function reset() {
    setActive(null);
    setVisibility("link");
    setShowHeroCards(true);
    setShowResult(true);
    setGuess(false);
    setQuestion("");
  }

  function pick(s: MyShare) {
    setActive(s.slug);
    setVisibility(s.visibility);
    setShowHeroCards(s.show_hero_cards);
    setShowResult(s.show_result);
    setGuess(s.guess_mode);
    setQuestion(s.question ?? "");
  }

  const activeShare = shares.find((s) => s.slug === active) ?? null;
  const decision: DecisionPoint | null = guess ? (points.find((p) => p.eventIndex === decisionIdx) ?? null) : null;
  const url = active ? shareUrl(active, typeof window !== "undefined" ? window.location.origin : undefined) : null;
  const shareText = question.trim() || SHARED_HAND.defaultQuestion;

  async function refresh(select?: string) {
    const rows = await listMyShares(supabase, handId).catch(() => shares);
    setShares(rows);
    if (select) setActive(select);
  }

  async function create() {
    if (!hand) return;
    setBusy(true);
    setError(null);
    try {
      const slug = await createShare(supabase, handId, hand, { visibility, showHeroCards, showResult, question, decision });
      trackCustom("HandShared", { visibility, guess_mode: decision != null, has_question: question.trim() !== "" });
      await refresh(slug);
    } catch (e) {
      setError(socialErrorMessage(e instanceof Error ? e.message : null));
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!active) return;
    setBusy(true);
    setError(null);
    try {
      await updateShare(supabase, active, { visibility, showHeroCards, showResult, question });
      toast.success(SHARE.saved);
      await refresh(active);
    } catch (e) {
      setError(socialErrorMessage(e instanceof Error ? e.message : null));
    } finally {
      setBusy(false);
    }
  }

  async function revoke(slug: string) {
    try {
      await revokeShare(supabase, slug);
      toast.success(SHARE.revoked);
      await refresh();
      if (slug === active) reset();
    } catch {
      toast.error(SHARE.failed);
    }
  }

  async function copy(text: string, done: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(done);
    } catch {
      window.prompt(SHARE.copy, text);
    }
  }

  async function nativeShare() {
    if (!url) return;
    try {
      await navigator.share({ title: shareText, text: shareText, url });
    } catch {
      /* dismissed */
    }
  }

  const dirty =
    activeShare != null &&
    (activeShare.visibility !== visibility ||
      activeShare.show_hero_cards !== showHeroCards ||
      activeShare.show_result !== showResult ||
      (activeShare.question ?? "") !== question.trim());

  return (
    <Modal open={open} onClose={onClose} title={SHARE.title} bodyClassName="px-4 py-4 sm:px-6 sm:py-5 space-y-5">
      {/* Options */}
      <fieldset className="space-y-2">
        <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{SHARE.visibility.label}</legend>
        {VISIBILITIES.map((v) => (
          <label
            key={v}
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5",
              visibility === v ? "border-violet-500/60 bg-violet-500/10" : "border-border/60 hover:bg-white/[0.03]",
            )}
          >
            <input type="radio" name="share-visibility" className="mt-1 accent-[#7C5CFF]" checked={visibility === v} onChange={() => setVisibility(v)} />
            <span>
              <span className="block text-sm font-medium text-foreground">{SHARE.visibility[v]}</span>
              <span className="block text-xs text-muted-foreground">{SHARE.visibility.help[v]}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <div className="space-y-1">
        <Toggle checked={showHeroCards} onChange={setShowHeroCards} label={SHARE.showHeroCards} />
        <Toggle checked={showResult} onChange={setShowResult} label={SHARE.showResult} />
        <Toggle
          checked={guess}
          onChange={setGuess}
          label={SHARE.guessMode}
          help={points.length ? SHARE.guessModeHelp : SHARE.noDecision}
          disabled={!points.length || activeShare != null}
        />
        {guess && points.length > 0 && (
          <label className="block pl-12">
            <span className="mb-1 block text-xs text-muted-foreground">{SHARE.guessSpot}</span>
            <select
              value={decisionIdx ?? ""}
              disabled={activeShare != null}
              onChange={(e) => setDecisionIdx(Number(e.target.value))}
              style={{ fontSize: "16px" }}
              className="h-10 w-full rounded-lg border border-border/60 bg-background/60 px-2 text-sm text-foreground"
            >
              {points.map((p) => (
                <option key={p.eventIndex} value={p.eventIndex}>
                  {decisionLabel(p, hand?.bigBlind ?? 1)}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <label className="block">
        <span className="mb-1 flex justify-between text-xs text-muted-foreground">
          <span>{SHARE.question}</span>
          <span className={cn(question.length > 140 && "text-red-400")}>{question.length}/140</span>
        </span>
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          maxLength={140}
          placeholder={SHARE.questionPlaceholder}
          style={{ fontSize: "16px" }}
          className="h-10 w-full rounded-lg border border-border/60 bg-background/60 px-3 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-[#7C5CFF]"
        />
      </label>

      <p className="text-xs text-muted-foreground/80">{SHARE.privacyNote}</p>
      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}

      {!activeShare ? (
        <button
          type="button"
          onClick={create}
          disabled={busy || !hand}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#7C5CFF] text-sm font-semibold text-white hover:bg-[#6B4BEE] disabled:opacity-50"
        >
          <Link2 className="h-4 w-4" /> {busy ? SHARE.creating : SHARE.create}
        </button>
      ) : (
        <div className="space-y-3 rounded-xl border border-border/60 bg-white/[0.02] p-3">
          <div className="flex gap-2">
            <input
              readOnly
              value={url ?? ""}
              aria-label={SHARE.copy}
              onFocus={(e) => e.currentTarget.select()}
              className="h-10 min-w-0 flex-1 rounded-lg border border-border/60 bg-background/60 px-3 font-mono text-xs text-foreground"
            />
            <button
              type="button"
              onClick={() => url && copy(url, SHARE.copied)}
              className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-[#7C5CFF] px-3 text-sm font-semibold text-white hover:bg-[#6B4BEE]"
            >
              <Copy className="h-4 w-4" /> {SHARE.copy}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {typeof navigator !== "undefined" && "share" in navigator && (
              <SmallButton onClick={nativeShare}>
                <Share2 className="h-4 w-4" /> {SHARE.shareVia}
              </SmallButton>
            )}
            {url &&
              (["whatsapp", "x", "reddit"] as const).map((target) => (
                <a
                  key={target}
                  href={socialShareUrl(target, url, shareText)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-9 items-center rounded-lg border border-border/60 px-3 text-sm text-foreground hover:bg-white/[0.04]"
                >
                  {SHARE[target]}
                </a>
              ))}
            <SmallButton onClick={() => url && copy(url, SHARE.discordCopied)}>{SHARE.discord}</SmallButton>
            <SmallButton onClick={() => active && copy(embedCode(active, window.location.origin), SHARE.embedCopied)}>
              <Code2 className="h-4 w-4" /> {SHARE.embedCopy}
            </SmallButton>
          </div>
          {dirty && (
            <button
              type="button"
              onClick={save}
              disabled={busy}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-violet-500/60 text-sm font-semibold text-violet-200 hover:bg-violet-500/10 disabled:opacity-50"
            >
              <Check className="h-4 w-4" /> {SHARE.save}
            </button>
          )}
        </div>
      )}

      {shares.length > 0 && (
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{SHARE.existing}</h3>
            {activeShare && (
              <button type="button" onClick={reset} className="text-xs font-semibold text-violet-300 hover:text-violet-200">
                + {SHARE.newLink}
              </button>
            )}
          </div>
          <ul className="space-y-2">
            {shares.map((s) => (
              <li
                key={s.slug}
                className={cn("flex items-center gap-2 rounded-lg border px-3 py-2 text-sm", s.slug === active ? "border-violet-500/50" : "border-border/60")}
              >
                <button type="button" onClick={() => !s.revoked_at && pick(s)} disabled={!!s.revoked_at} className="min-w-0 flex-1 text-left">
                  <span className="block truncate font-mono text-xs text-foreground">/h/{s.slug}</span>
                  <span className="block text-xs text-muted-foreground">
                    {s.revoked_at
                      ? SHARE.revokedLabel
                      : s.hidden_at
                        ? SHARE.hiddenLabel
                        : [SHARE.visibility[s.visibility], SHARE.views(s.view_count), s.guess_mode ? SHARE.votes(s.guesses) : null].filter(Boolean).join(" · ")}
                  </span>
                </button>
                {!s.revoked_at && (
                  <button type="button" onClick={() => revoke(s.slug)} className="h-8 shrink-0 rounded-md px-2 text-xs text-red-400 hover:bg-red-500/10">
                    {SHARE.revoke}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </Modal>
  );
}

function decisionLabel(p: DecisionPoint, bb: number): string {
  return SHARE.decisionLabel(hh.street[p.street], p.toCall > 0 ? fmtBb(p.toCall / bb) : null, SHARE.pastTense[p.actual]);
}

function Toggle({
  checked,
  onChange,
  label,
  help,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  help?: string;
  disabled?: boolean;
}) {
  return (
    <label className={cn("flex items-start gap-3 py-1.5", disabled ? "opacity-60" : "cursor-pointer")}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn("relative mt-0.5 h-6 w-10 shrink-0 rounded-full transition-colors", checked ? "bg-[#7C5CFF]" : "bg-white/15")}
      >
        <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all", checked ? "left-[18px]" : "left-0.5")} />
      </button>
      <span>
        <span className="block text-sm text-foreground">{label}</span>
        {help && <span className="block text-xs text-muted-foreground">{help}</span>}
      </span>
    </label>
  );
}

function SmallButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border/60 px-3 text-sm text-foreground hover:bg-white/[0.04]"
    >
      {children}
    </button>
  );
}
