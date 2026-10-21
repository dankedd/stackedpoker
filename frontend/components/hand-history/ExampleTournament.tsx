"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { HANDS_IMPORT_PATH } from "@/lib/handHistory/feature";
import { DEFAULT_MIN_POT_BB } from "@/lib/handHistory/filters";
import { fmtBb, fmtSignedBb } from "@/lib/handHistory/format";
import { PREFLOP_ERRORS } from "@/lib/handHistory/preflop/types";
import { t } from "@/lib/handHistory/strings";
import {
  exampleHands,
  type ExampleHand,
} from "@/lib/onboarding/exampleTournament";
import { cn } from "@/lib/utils";
import { FavoriteStar } from "./FavoriteStar";
import { MiniCards } from "./MiniCards";
import { PreflopBadge } from "./PreflopBadge";
import { PreflopCheckPanel } from "./PreflopCheckPanel";
import { FlopSpotPanel, useFlopAnalysis } from "@/components/flop-trainer/FlopSpotPanel";
import { PageHeader, SectionNav } from "./SectionNav";

/**
 * The Hand Review tour's example tournament: made-up hands through the real
 * parser and preflop check, shown with the real list pieces and range chart.
 * Stars and notes live in this component's state only — nothing is saved,
 * nothing counts toward the upload limit.
 */
export function ExampleTournament() {
  const hands = useMemo(() => exampleHands(), []);
  const shown = hands.filter((h) => h.matters);
  const leaks = hands.filter(
    (h) => h.check && PREFLOP_ERRORS.includes(h.check.verdict),
  );
  const [selectedId, setSelectedId] = useState(
    () => (leaks.find((h) => h.matters) ?? shown[0]).id,
  );
  const [stars, setStars] = useState<Set<string>>(() => new Set());
  const [notes, setNotes] = useState<Record<string, string>>({});
  const selected = hands.find((h) => h.id === selectedId) ?? shown[0];
  const selectedFlop = useFlopAnalysis(selected.hand);

  const toggleStar = (id: string) =>
    setStars((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <div className="page-enter">
      <div className="mb-6">
        <SectionNav />
      </div>
      <PageHeader title={t.example.title}>
        <Link
          href={HANDS_IMPORT_PATH}
          className="inline-flex items-center gap-2 self-start rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-500"
        >
          {t.example.uploadOwn}
        </Link>
      </PageHeader>

      <div className="-mt-2 mb-6 flex flex-col items-start gap-2 rounded-xl sm:flex-row sm:gap-3 border border-[#7C5CFF]/30 bg-[#7C5CFF]/[0.07] px-4 py-3 text-sm">
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#7C5CFF]/40 bg-[#7C5CFF]/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#D6CCFF]">
          <Sparkles aria-hidden="true" className="h-3 w-3" /> {t.example.badge}
        </span>
        <p className="text-foreground/80">{t.example.intro}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section
          data-tour="example-list"
          aria-labelledby="ex-matters"
          className="rounded-2xl border border-border/60 bg-card/40 p-4"
        >
          <h2 id="ex-matters" className="text-sm font-semibold">
            {t.example.mattersTitle}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {t.example.mattersSub(
              shown.length,
              hands.length,
              DEFAULT_MIN_POT_BB,
            )}
          </p>
          <ul className="mt-3 divide-y divide-border/40">
            {shown.map((h) => (
              <HandRow
                key={h.id}
                h={h}
                selected={h.id === selected.id}
                starred={stars.has(h.id)}
                onSelect={() => setSelectedId(h.id)}
                onStar={() => toggleStar(h.id)}
              />
            ))}
          </ul>
        </section>

        <section
          data-tour="example-leaks"
          aria-labelledby="ex-leaks"
          className="rounded-2xl border border-border/60 bg-card/40 p-4"
        >
          <h2 id="ex-leaks" className="text-sm font-semibold">
            {t.example.leaksTitle}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {t.example.leaksSub}
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {leaks.map((h) => (
              <li key={h.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(h.id)}
                  aria-pressed={h.id === selected.id}
                  className={cn(
                    "flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors",
                    h.id === selected.id
                      ? "border-violet-500/60 bg-violet-500/10"
                      : "border-border/60 hover:border-border",
                  )}
                >
                  <PreflopBadge verdict={h.check!.verdict} />
                  <MiniCards cards={h.hand.heroCards} />
                  <span className="text-xs text-muted-foreground">
                    {h.derived.heroPosition}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="mt-2 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div data-tour="example-check">
          {selected.check ? (
            <PreflopCheckPanel check={selected.check} active />
          ) : (
            <p className="mt-4 rounded-2xl border border-border/60 bg-card/40 p-4 text-sm text-muted-foreground">
              {t.example.noCheck}
            </p>
          )}
          {/* Tournament view: the compact flop panel for heads-up pots that match a trainer spot. */}
          <FlopSpotPanel analysis={selectedFlop} showHero={false} />
        </div>

        <section
          data-tour="example-study"
          aria-labelledby="ex-study"
          className="rounded-2xl border border-border/60 bg-card/40 p-4"
        >
          <h2 id="ex-study" className="text-sm font-semibold">
            {t.example.studyTitle}
          </h2>
          <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            <FavoriteStar
              on={stars.has(selected.id)}
              onToggle={() => toggleStar(selected.id)}
            />
            {t.example.studyStar}
          </div>
          <label htmlFor="ex-note" className="sr-only">
            {t.notes.title}
          </label>
          <textarea
            id="ex-note"
            rows={3}
            value={notes[selected.id] ?? ""}
            onChange={(e) =>
              setNotes((n) => ({ ...n, [selected.id]: e.target.value }))
            }
            placeholder={t.example.studyNotePlaceholder}
            className="mt-2 w-full resize-y rounded-xl border border-border/60 bg-background/40 px-3 py-2 text-sm outline-none focus:border-violet-500/60"
          />
        </section>
      </div>
    </div>
  );
}

function HandRow({
  h,
  selected,
  starred,
  onSelect,
  onStar,
}: {
  h: ExampleHand;
  selected: boolean;
  starred: boolean;
  onSelect: () => void;
  onStar: () => void;
}) {
  const net = h.derived.heroNetBb;
  return (
    <li
      className={cn(
        "flex items-center gap-2 py-2",
        selected && "rounded-lg bg-violet-500/[0.08]",
      )}
    >
      <FavoriteStar on={starred} onToggle={onStar} />
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 text-left text-sm"
      >
        <span className="w-14 shrink-0 text-xs text-muted-foreground">
          {h.derived.heroPosition}
        </span>
        <MiniCards cards={h.hand.heroCards} />
        <span className="hidden text-xs text-muted-foreground sm:inline">
          {t.example.board}
        </span>
        <MiniCards cards={h.board} />
        {h.check && <PreflopBadge verdict={h.check.verdict} />}
        <span className="ml-auto flex items-center gap-3 font-mono">
          <span title={t.example.pot}>{fmtBb(h.derived.potBb)}</span>
          <span
            className={cn(
              "font-semibold",
              net > 0
                ? "text-emerald-400"
                : net < 0
                  ? "text-rose-400"
                  : "text-muted-foreground",
            )}
            title={t.example.result}
          >
            {fmtSignedBb(net)}
          </span>
        </span>
      </button>
    </li>
  );
}
