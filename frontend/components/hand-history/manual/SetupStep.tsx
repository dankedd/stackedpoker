"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { positionsFor, validateSetup, type AnteType, type ManualSetup } from "@/lib/handHistory/manual/engine";
import { t } from "@/lib/handHistory/strings";
import { cn } from "@/lib/utils";
import { CardPick } from "./CardPick";

type Unit = "bb" | "chips";

const field = "h-10 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 text-sm outline-none focus:border-[#7C5CFF]/70";
const label = "mb-1 block text-xs font-medium text-muted-foreground";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border/60 bg-card/40 p-4">
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Segmented<T extends string>({ value, options, onChange, ariaLabel }: { value: T; options: { v: T; label: string }[]; onChange: (v: T) => void; ariaLabel: string }) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="inline-flex rounded-xl border border-white/10 bg-white/[0.03] p-1">
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          role="radio"
          aria-checked={value === o.v}
          onClick={() => onChange(o.v)}
          className={cn("rounded-lg px-3 py-1.5 text-[13px] font-semibold transition-colors", value === o.v ? "bg-violet-500/25 text-violet-100" : "text-slate-400 hover:text-white")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** A number field that shows and takes chips or big blinds. Empty = null. */
function AmountInput({
  chips,
  onChange,
  unit,
  bigBlind,
  placeholder,
  id,
}: {
  chips: number | null;
  onChange: (chips: number | null) => void;
  unit: Unit;
  bigBlind: number;
  placeholder?: string;
  id?: string;
}) {
  const shown = chips == null ? "" : unit === "bb" && bigBlind > 0 ? String(Math.round((chips / bigBlind) * 100) / 100) : String(chips);
  return (
    <input
      id={id}
      inputMode="decimal"
      value={shown}
      placeholder={placeholder}
      onChange={(e) => {
        const raw = e.target.value.replace(",", ".").trim();
        if (raw === "") return onChange(null);
        const n = Number(raw);
        if (!Number.isFinite(n) || n < 0) return;
        onChange(unit === "bb" ? Math.round(n * bigBlind) : Math.round(n));
      }}
      className={field}
    />
  );
}

export function SetupStep({ setup, onChange, onNext }: { setup: ManualSetup; onChange: (s: ManualSetup) => void; onNext: () => void }) {
  const [unit, setUnit] = useState<Unit>("bb");
  const [showErrors, setShowErrors] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(Boolean(setup.tournamentName || setup.venue || setup.buyIn));
  const set = (patch: Partial<ManualSetup>) => onChange({ ...setup, ...patch });
  const positions = positionsFor(setup.playerCount);
  const others = positions.filter((p) => p !== setup.heroPosition);
  const errors = validateSetup(setup);

  return (
    <div className="space-y-4">
      <Section title={t.manual.gameType}>
        <div className="flex flex-wrap items-center gap-3">
          <Segmented
            ariaLabel={t.manual.gameType}
            value={setup.format}
            options={[
              { v: "tournament", label: t.manual.tournament },
              { v: "cash", label: t.manual.cash },
            ]}
            onChange={(format) => set({ format, ...(format === "cash" ? { anteType: "none" as AnteType, level: null } : {}) })}
          />
        </div>
        <label htmlFor="mh-players" className={cn(label, "mt-4")}>
          {t.manual.players}
        </label>
        <div id="mh-players" className="flex flex-wrap gap-1.5">
          {Array.from({ length: 9 }, (_, i) => i + 2).map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={setup.playerCount === n}
              onClick={() => {
                const pos = positionsFor(n);
                set({ playerCount: n, heroPosition: pos.includes(setup.heroPosition) ? setup.heroPosition : pos[pos.length - 1], stacks: {} });
              }}
              className={cn(
                "h-9 w-9 rounded-lg border text-sm font-semibold",
                setup.playerCount === n ? "border-[#7C5CFF] bg-[#7C5CFF]/25 text-white" : "border-white/10 bg-white/[0.04] text-white/80",
              )}
            >
              {n}
            </button>
          ))}
        </div>
      </Section>

      <Section title={t.manual.blinds}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <label htmlFor="mh-sb" className={label}>{t.manual.smallBlind}</label>
            <AmountInput id="mh-sb" chips={setup.smallBlind || null} onChange={(v) => set({ smallBlind: v ?? 0 })} unit="chips" bigBlind={setup.bigBlind} />
          </div>
          <div>
            <label htmlFor="mh-bb" className={label}>{t.manual.bigBlind}</label>
            <AmountInput id="mh-bb" chips={setup.bigBlind || null} onChange={(v) => set({ bigBlind: v ?? 0 })} unit="chips" bigBlind={setup.bigBlind} />
          </div>
          {setup.format === "tournament" && (
            <div>
              <label htmlFor="mh-level" className={label}>{t.manual.level}</label>
              <input
                id="mh-level"
                inputMode="numeric"
                value={setup.level ?? ""}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  set({ level: e.target.value.trim() === "" || !Number.isInteger(n) || n < 1 ? null : n });
                }}
                className={field}
              />
            </div>
          )}
        </div>
        <span className={cn(label, "mt-4")}>{t.manual.ante}</span>
        <div className="flex flex-wrap items-center gap-3">
          <Segmented
            ariaLabel={t.manual.ante}
            value={setup.anteType}
            options={[
              { v: "none", label: t.manual.anteNone },
              { v: "bb_ante", label: t.manual.anteBb },
              { v: "per_player", label: t.manual.antePerPlayer },
            ]}
            onChange={(anteType) => set({ anteType, ante: anteType === "none" ? 0 : setup.ante || (anteType === "bb_ante" ? setup.bigBlind : Math.round(setup.bigBlind / 8)) })}
          />
          {setup.anteType !== "none" && (
            <div className="w-32">
              <AmountInput chips={setup.ante || null} onChange={(v) => set({ ante: v ?? 0 })} unit="chips" bigBlind={setup.bigBlind} />
            </div>
          )}
        </div>
      </Section>

      <Section title={t.manual.heroPosition}>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t.manual.heroPosition}>
          {positions.map((p) => (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={setup.heroPosition === p}
              onClick={() => set({ heroPosition: p })}
              className={cn(
                "h-9 min-w-[3.25rem] rounded-full border px-3 text-sm font-semibold",
                setup.heroPosition === p ? "border-[#7C5CFF] bg-[#7C5CFF]/25 text-white" : "border-white/10 bg-white/[0.04] text-white/80",
              )}
            >
              {p}
            </button>
          ))}
        </div>
      </Section>

      <Section title={t.manual.stacks}>
        <div className="mb-3">
          <Segmented ariaLabel={t.manual.stacks} value={unit} options={[{ v: "bb", label: t.manual.unitBb }, { v: "chips", label: t.manual.unitChips }]} onChange={setUnit} />
        </div>
        <label htmlFor="mh-hero-stack" className={label}>{t.manual.heroStack}</label>
        <div className="max-w-[12rem]">
          <AmountInput id="mh-hero-stack" chips={setup.heroStack || null} onChange={(v) => set({ heroStack: v ?? 0 })} unit={unit} bigBlind={setup.bigBlind} />
        </div>
        <details className="mt-4 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2">
          <summary className="cursor-pointer text-sm font-medium">{t.manual.otherStacks}</summary>
          <p className="mt-1 text-xs text-muted-foreground">{t.manual.otherStacksHint}</p>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {others.map((p) => (
              <div key={p}>
                <label htmlFor={`mh-stack-${p}`} className={label}>{p}</label>
                <AmountInput
                  id={`mh-stack-${p}`}
                  chips={setup.stacks[p] ?? null}
                  onChange={(v) => set({ stacks: { ...setup.stacks, [p]: v } })}
                  unit={unit}
                  bigBlind={setup.bigBlind}
                  placeholder={t.manual.sameAsHero}
                />
              </div>
            ))}
          </div>
        </details>
      </Section>

      <Section title={t.manual.heroCards}>
        <CardPick value={setup.heroCards} onChange={(heroCards) => set({ heroCards })} count={2} blocked={new Set()} label={t.manual.heroCards} />
      </Section>

      <section className="rounded-2xl border border-border/60 bg-card/40">
        <button type="button" onClick={() => setDetailsOpen((v) => !v)} aria-expanded={detailsOpen} className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold">
          {t.manual.details}
          <ChevronDown className={cn("h-4 w-4 transition-transform", detailsOpen && "rotate-180")} />
        </button>
        {detailsOpen && (
          <div className="grid gap-3 px-4 pb-4 sm:grid-cols-2">
            {setup.format === "tournament" && (
              <div className="sm:col-span-2">
                <label htmlFor="mh-tname" className={label}>{t.manual.tournamentName}</label>
                <input id="mh-tname" value={setup.tournamentName} maxLength={80} onChange={(e) => set({ tournamentName: e.target.value })} className={field} />
                <p className="mt-1 text-[11px] text-muted-foreground">{t.manual.tournamentNameHint}</p>
              </div>
            )}
            <div>
              <label htmlFor="mh-date" className={label}>{t.manual.date}</label>
              <input id="mh-date" type="datetime-local" value={setup.playedAt.slice(0, 16)} onChange={(e) => e.target.value && set({ playedAt: `${e.target.value}:00` })} className={field} />
            </div>
            {setup.format === "tournament" && (
              <div>
                <label htmlFor="mh-buyin" className={label}>{t.manual.buyIn}</label>
                <input id="mh-buyin" value={setup.buyIn} maxLength={20} onChange={(e) => set({ buyIn: e.target.value })} className={field} placeholder="€50" />
              </div>
            )}
            <div>
              <span className={label}>{t.manual.live} / {t.manual.online}</span>
              <Segmented ariaLabel={t.manual.live} value={setup.live ? "live" : "online"} options={[{ v: "live", label: t.manual.live }, { v: "online", label: t.manual.online }]} onChange={(v) => set({ live: v === "live" })} />
            </div>
            <div>
              <label htmlFor="mh-venue" className={label}>{t.manual.venue}</label>
              <input id="mh-venue" value={setup.venue} maxLength={60} onChange={(e) => set({ venue: e.target.value })} className={field} />
            </div>
          </div>
        )}
      </section>

      {showErrors && errors.length > 0 && (
        <ul role="alert" className="space-y-1 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={() => (errors.length ? setShowErrors(true) : onNext())}
        className="h-12 w-full rounded-xl bg-[#7C5CFF] text-sm font-semibold text-white transition-colors hover:bg-[#6B4BEE]"
      >
        {t.manual.next}
      </button>
    </div>
  );
}
