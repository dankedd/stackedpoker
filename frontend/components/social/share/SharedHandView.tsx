"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Check, ChevronFirst, ChevronLast, ChevronLeft, ChevronRight, ChevronsRight, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { createClient } from "@/lib/supabase/client";
import { trackCustom } from "@/lib/metaPixel";
import { amountFormatter, fmtBb } from "@/lib/handHistory/format";
import { t as hh } from "@/lib/handHistory/strings";
import { buildTimeline, describeStep, nextStreetIndex } from "@/lib/handHistory/timeline";
import type { ParsedHand, Street } from "@/lib/handHistory/types";
import { checkPreflop } from "@/lib/handHistory/preflop";
import { anonId, getSharedHand, recordView, shareUrl, signupFromShareUrl, submitGuess, type SharedHandPayload } from "@/lib/social/share/api";
import type { GuessChoice } from "@/lib/social/share/anonymize";
import { summarizeShare } from "@/lib/social/share/summary";
import { SHARED_HAND, socialErrorMessage } from "@/lib/social/strings";
import { cn } from "@/lib/utils";
import { ReplayTable } from "@/components/hand-history/ReplayTable";
import { PreflopCheckPanel } from "@/components/hand-history/PreflopCheckPanel";
import { PreflopBadge } from "@/components/hand-history/PreflopBadge";
import { PREFLOP_RANGES_ENABLED } from "@/lib/ranges/feature";
import { FlopSpotPanel, useFlopAnalysis } from "@/components/flop-trainer/FlopSpotPanel";
import { ReportButton } from "@/components/social/ReportButton";
import { Avatar } from "@/components/social/Avatar";
import { UserBadges } from "@/components/social/UserBadges";

const STREET_COLOR: Record<Street, string> = { preflop: "#38BDF8", flop: "#34D399", turn: "#FBBF24", river: "#F87171" };
const CTA_DISMISS_KEY = "sp_share_cta_dismissed";

/**
 * Read-only replayer for a shared hand (/h/[slug] and the /embed variant).
 * Works signed out. Amounts in big blinds. In guess mode the server sends
 * the hand only up to Hero's decision; voting returns the rest.
 */
export function SharedHandView({ initial, embed = false }: { initial: SharedHandPayload; embed?: boolean }) {
  const supabase = useMemo(() => createClient(), []);
  const { user, loading: authLoading } = useAuth();
  const [share, setShare] = useState(initial);
  // Guess mode opens on the decision itself; step back to see how it got there.
  const [index, setIndex] = useState(() => (initial.hand.truncated ? buildTimeline(initial.hand as unknown as ParsedHand).length - 1 : 0));
  const [voting, setVoting] = useState(false);
  const counted = useRef(false);

  const hand = share.hand as unknown as ParsedHand;
  const truncated = share.hand.truncated === true;
  const steps = useMemo(() => buildTimeline(hand), [hand]);
  const last = Math.max(0, steps.length - 1);
  const step = steps[Math.min(index, last)];
  const fmt = useMemo(() => amountFormatter("bb", hand.bigBlind || 1), [hand]);
  const summary = useMemo(() => summarizeShare(share.hand), [share.hand]);
  const preflop = useMemo(() => (truncated ? null : checkPreflop(hand)), [hand, truncated]);
  const preflopStep = useMemo(() => steps.findIndex((s) => s.kind === "action" && s.street === "preflop" && s.player === "Hero"), [steps]);
  const flopAnalysis = useFlopAnalysis(truncated ? null : hand);

  // Signed out, guess mode: the server render can't know this browser already voted.
  useEffect(() => {
    if (authLoading) return;
    if (!counted.current) {
      counted.current = true;
      void recordView(supabase, share.slug).catch(() => {});
      trackCustom("SharedHandView", { slug: share.slug, guess_mode: share.guess_mode, embed });
    }
    if (!user && share.guess_mode && !share.my_guess) {
      getSharedHand(supabase, share.slug, anonId())
        .then((s) => s?.my_guess && setShare(s))
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading]);

  const go = useCallback((i: number) => setIndex(Math.max(0, Math.min(last, i))), [last]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      if (e.key === "ArrowRight") go(index + 1);
      else if (e.key === "ArrowLeft") go(index - 1);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, index]);

  async function vote(choice: GuessChoice) {
    setVoting(true);
    try {
      const next = await submitGuess(supabase, share.slug, choice, user ? null : anonId());
      if (!next) throw new Error("not_found");
      trackCustom("SharedHandGuess", { slug: share.slug, choice, matched: next.actual_choice === choice });
      setShare(next);
      // Land on Hero's actual decision so the answer is the next thing seen.
      const full = buildTimeline(next.hand as unknown as ParsedHand);
      const decisionEvent = next.decision_index != null ? next.hand.events[next.decision_index] : null;
      const at = full.findIndex((s) => s.events[0] === decisionEvent);
      setIndex(at >= 0 ? at : 0);
    } catch (e) {
      toast.error(socialErrorMessage(e instanceof Error ? e.message : null));
    } finally {
      setVoting(false);
    }
  }

  const question = share.question || SHARED_HAND.defaultQuestion;
  const atDecision = truncated && index >= last;
  const ownerName = share.owner.handle ? `@${share.owner.handle}` : share.owner.name;

  return (
    <div className={cn(embed ? "p-3" : "pb-4")}>
      {share.is_owner && (share.hidden || share.revoked || !embed) && (
        <p className="mb-3 rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-xs text-violet-200">
          {share.hidden ? SHARED_HAND.hiddenNotice : share.revoked ? SHARED_HAND.revokedNotice : SHARED_HAND.ownerPreview}
        </p>
      )}

      <header className="mb-2">
        <h1 className={cn("font-bold text-foreground", embed ? "text-base" : "text-xl sm:text-2xl")}>{question}</h1>
        <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground sm:text-sm">
          <Avatar path={share.owner.avatar} name={share.owner.name} size={20} />
          {share.owner.handle && !embed ? (
            <Link href={`/u/${share.owner.handle}`} className="font-medium text-foreground hover:underline">
              {SHARED_HAND.sharedBy(ownerName)}
            </Link>
          ) : (
            <span>{SHARED_HAND.sharedBy(ownerName)}</span>
          )}
          <UserBadges badges={share.owner.badges} />
          <span>· {summary.position} · {fmtBb(summary.stackBb)} · {fmt(hand.smallBlind)}/{fmt(hand.bigBlind)}
          {hand.ante ? hh.replayer.ante(fmt(hand.ante)) : ""}</span>
        </p>
      </header>

      <ReplayTable hand={hand} step={step} fmt={fmt} />

      <div className="mt-2 flex min-h-[44px] items-center gap-2 rounded-xl border border-border/60 bg-card/50 px-3 py-2" aria-live="polite">
        <span className="shrink-0 rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-black" style={{ background: STREET_COLOR[step.street] }}>
          {hh.street[step.street]}
        </span>
        <span className="text-sm font-medium">{atDecision ? SHARED_HAND.heroToAct : describeStep(step, fmt)}</span>
        <span className="ml-auto shrink-0 font-mono text-xs text-muted-foreground">
          {index}/{last}
        </span>
      </div>

      <div className="mt-2 flex items-center justify-center gap-1.5 sm:gap-2">
        <Ctrl label={hh.replayer.toStart} onClick={() => go(0)} disabled={index === 0}>
          <ChevronFirst className="h-5 w-5" />
        </Ctrl>
        <Ctrl label={hh.replayer.prevAction} onClick={() => go(index - 1)} disabled={index === 0}>
          <ChevronLeft className="h-5 w-5" />
        </Ctrl>
        <Ctrl label={hh.replayer.nextAction} onClick={() => go(index + 1)} disabled={index >= last} primary>
          <ChevronRight className="h-5 w-5" />
        </Ctrl>
        <Ctrl label={hh.replayer.nextStreet} onClick={() => go(nextStreetIndex(steps, index))} disabled={index >= last}>
          <ChevronsRight className="h-5 w-5" />
        </Ctrl>
        <Ctrl label={hh.replayer.toEnd} onClick={() => go(last)} disabled={index >= last}>
          <ChevronLast className="h-5 w-5" />
        </Ctrl>
      </div>

      {truncated && share.decision_options && (
        <section aria-labelledby="guess-title" className="mt-4 rounded-2xl border border-violet-500/30 bg-violet-500/[0.06] p-4" data-guess-panel>
          <h2 id="guess-title" className="text-sm font-semibold text-foreground">
            {SHARED_HAND.yourTurn}
          </h2>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {share.decision_options.map((c) => (
              <button
                key={c}
                type="button"
                disabled={voting}
                onClick={() => vote(c)}
                data-guess={c}
                className="h-12 rounded-xl border border-violet-500/50 bg-violet-600/20 text-base font-semibold text-violet-100 transition-colors hover:bg-violet-600/40 disabled:opacity-50"
              >
                {voting ? SHARED_HAND.voting : SHARED_HAND.choice[c]}
              </button>
            ))}
          </div>
        </section>
      )}

      {!truncated && share.guess_mode && share.actual_choice && <GuessResult share={share} />}

      {!truncated && share.hand.resultHidden && !share.is_owner && (
        <p className="mt-3 text-center text-xs text-muted-foreground">{SHARED_HAND.resultHidden}</p>
      )}
      {/* "What the ranges say". Not in the embed (too heavy for someone else's page). The full
          chart only while the preflop range data is public (PREFLOP_RANGES_ENABLED); otherwise
          just the verdict. */}
      {!truncated && !embed && (
        <>
          {preflop &&
            (PREFLOP_RANGES_ENABLED ? (
              <PreflopCheckPanel check={preflop} active={index === preflopStep} />
            ) : (
              <p className="mt-4 flex items-center gap-2 rounded-xl border border-border/60 bg-card/40 px-3 py-2.5 text-sm">
                <span className="font-semibold text-foreground">{SHARED_HAND.preflopVerdict}</span>
                <PreflopBadge verdict={preflop.verdict} showAll />
              </p>
            ))}
          <FlopSpotPanel analysis={flopAnalysis} active={step.street === "flop"} hidden={step.street === "preflop"} />
        </>
      )}

      <footer className="mt-4 flex items-center justify-between gap-2">
        {embed ? (
          <a
            href={`${shareUrl(share.slug, typeof window !== "undefined" ? window.location.origin : undefined)}?utm_source=embed&utm_medium=hand&utm_content=${share.slug}`}
            target="_blank"
            rel="noopener"
            className="text-xs font-semibold text-violet-300 hover:text-violet-200"
          >
            {SHARED_HAND.poweredBy} ↗
          </a>
        ) : (
          <span className="text-xs text-muted-foreground">{SHARED_HAND.stacksInBb}</span>
        )}
        {user && !share.is_owner && <ReportButton targetType="hand_share" targetId={share.slug} />}
      </footer>

      {!embed && !authLoading && !user && <SignupBar slug={share.slug} />}
    </div>
  );
}

function GuessResult({ share }: { share: SharedHandPayload }) {
  const dist = share.distribution ?? {};
  const options = share.decision_options ?? [];
  const total = options.reduce((n, c) => n + (dist[c] ?? 0), 0);
  const actual = share.actual_choice!;
  const mine = share.my_guess;
  return (
    <section aria-labelledby="votes-title" className="mt-4 rounded-2xl border border-border/60 bg-card/40 p-4" data-guess-result>
      <p className="text-sm font-semibold text-foreground">
        {SHARED_HAND.heroDid(SHARED_HAND.choice[actual])}
        {mine && <span className="ml-1 font-normal text-muted-foreground">{mine === actual ? SHARED_HAND.matched : SHARED_HAND.youPicked(SHARED_HAND.choice[mine])}</span>}
      </p>
      <h2 id="votes-title" className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {SHARED_HAND.votesTitle} · {SHARED_HAND.totalVotes(total)}
      </h2>
      <ul className="mt-2 space-y-2">
        {options.map((c) => {
          const n = dist[c] ?? 0;
          const pct = total ? Math.round((n / total) * 100) : 0;
          return (
            <li key={c}>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 font-medium text-foreground">
                  {SHARED_HAND.choice[c]}
                  {c === actual && <Check aria-label="Hero" className="h-3.5 w-3.5 text-emerald-400" />}
                  {c === mine && <span className="rounded bg-violet-500/20 px-1.5 text-[10px] font-semibold text-violet-200">you</span>}
                </span>
                <span className="font-mono text-xs text-muted-foreground">{pct}%</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/[0.06]">
                <div className={cn("h-full rounded-full", c === actual ? "bg-emerald-500" : "bg-violet-500/70")} style={{ width: `${pct}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * "Analyze your own hands" for signed-out visitors. Fixed to the bottom, but
 * the page reserves its height (spacer), so it never covers content; one tap
 * closes it for the session.
 */
function SignupBar({ slug }: { slug: string }) {
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    try {
      setHidden(sessionStorage.getItem(CTA_DISMISS_KEY) === "1");
    } catch {
      setHidden(false);
    }
  }, []);
  if (hidden) return null;
  const dismiss = () => {
    try {
      sessionStorage.setItem(CTA_DISMISS_KEY, "1");
    } catch {}
    setHidden(true);
  };
  return (
    <>
      <div aria-hidden className="h-24" />
      <aside
        aria-label={SHARED_HAND.ctaTitle}
        className="fixed inset-x-0 bottom-0 z-40 border-t border-violet-500/30 bg-[#0B1120]/95 backdrop-blur"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        data-share-cta
      >
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">{SHARED_HAND.ctaTitle}</p>
            <p className="hidden truncate text-xs text-muted-foreground sm:block">{SHARED_HAND.ctaBody}</p>
          </div>
          <Link
            href={signupFromShareUrl(slug)}
            onClick={() => trackCustom("SharedHandSignupClick", { slug })}
            className="inline-flex h-10 shrink-0 items-center rounded-lg bg-[#7C5CFF] px-4 text-sm font-semibold text-white hover:bg-[#6B4BEE]"
          >
            {SHARED_HAND.ctaButton}
          </Link>
          <button type="button" onClick={dismiss} aria-label={SHARED_HAND.ctaDismiss} className="-mr-2 rounded-md p-2 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
      </aside>
    </>
  );
}

function Ctrl({ label, onClick, disabled, primary, children }: { label: string; onClick: () => void; disabled?: boolean; primary?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex h-11 min-w-11 items-center justify-center rounded-xl border px-3 transition disabled:opacity-35",
        primary ? "border-violet-500/60 bg-violet-600 text-white hover:bg-violet-500" : "border-border/60 bg-card/60 hover:bg-card",
      )}
    >
      {children}
    </button>
  );
}
