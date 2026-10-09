"use client";

import { useMemo, useState } from "react";
import { PokerRangeGrid } from "@/components/learn/visuals/PokerRangeGrid";
import { DEFENSE_CHARTS, PUSH_FOLD_CHARTS } from "@/lib/ranges/data";
import { ALL_HANDS, combos, displayPos, pushValue, spotLabel, type DefenseScenario } from "@/lib/ranges/logic";
import type { ChartAction, DefenseChart, DefenseSpot, OpenChart } from "@/lib/ranges/types";
import { cn } from "@/lib/utils";
import { ACTION_ORDER, ChartPanel, Note, Pills, fmtPct, sourceLabel, toStrategies } from "./shared";

// ── Small multiples ─────────────────────────────────────────────────────────

interface MiniItem {
  key: string;
  label: string;
  grid: Record<string, number[] | null>;
  actions: ChartAction[];
}

function MiniStacks({
  heading,
  items,
  selected,
  onSelect,
}: {
  heading: string;
  items: MiniItem[];
  selected: string;
  onSelect: (key: string) => void;
}) {
  if (items.length < 2) return null;
  return (
    <section className="mt-6 border-t border-border/50 pt-4">
      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{heading}</h3>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(112px,1fr))] gap-3">
        {items.map((it) => {
          const { strategies, absent } = toStrategies(it.grid, it.actions);
          const played = it.actions.filter((a) => a.key !== "fold").reduce((s, a) => s + a.pct, 0);
          return (
            <button
              key={it.key}
              type="button"
              aria-pressed={it.key === selected}
              onClick={() => onSelect(it.key)}
              className={cn(
                "rounded-lg border p-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                it.key === selected
                  ? "border-violet-500/60 bg-violet-500/10"
                  : "border-border/60 bg-card/30 hover:border-violet-500/40",
              )}
            >
              <PokerRangeGrid
                range={[]}
                mode="strategy"
                size="mini"
                strategies={strategies}
                strategyActionOrder={ACTION_ORDER}
                absentHands={absent}
              />
              <span className="mt-1.5 block text-xs font-semibold text-foreground">
                {it.label} <span className="font-normal text-muted-foreground">· {fmtPct(played)}%</span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

// ── Open ranges (MTT / cash) ────────────────────────────────────────────────

export function OpenRangesView({
  charts,
  positions,
  initialPos,
  initialStack,
  showStacks,
  note,
}: {
  charts: OpenChart[];
  positions: string[];
  initialPos: string;
  initialStack: number;
  showStacks: boolean;
  note: string;
}) {
  const [pos, setPos] = useState(initialPos);
  const [stack, setStack] = useState(initialStack);

  const posCharts = charts.filter((c) => c.pos === pos).sort((a, b) => a.stack - b.stack);
  const chart =
    posCharts.find((c) => c.stack === stack) ??
    posCharts.reduce((b, c) => (Math.abs(c.stack - stack) < Math.abs(b.stack - stack) ? c : b));

  return (
    <div>
      <div className="mb-5 space-y-3">
        <Pills label="Position" value={pos} options={positions} onChange={setPos} format={displayPos} />
        {showStacks && (
          <Pills
            label="Stack"
            value={String(chart.stack)}
            options={posCharts.map((c) => String(c.stack))}
            onChange={(s) => setStack(Number(s))}
            format={(s) => `${s}bb`}
          />
        )}
      </div>
      <ChartPanel
        heading={`${displayPos(chart.pos)} · ${chart.stack}bb`}
        source={`${sourceLabel(chart.hr)} · p. ${chart.page}`}
        grid={chart.grid}
        actions={chart.actions}
      />
      {showStacks && (
        <MiniStacks
          heading={`Every stack · ${displayPos(chart.pos)}`}
          items={posCharts.map((c) => ({ key: String(c.stack), label: `${c.stack}bb`, grid: c.grid, actions: c.actions }))}
          selected={String(chart.stack)}
          onSelect={(k) => setStack(Number(k))}
        />
      )}
      <Note>{note}</Note>
    </div>
  );
}

// ── Defense ─────────────────────────────────────────────────────────────────

const HEROES = ["UTG+1", "HJ", "CO", "BN", "SB", "BB"];
const OPENERS = ["UTG", "LJ", "HJ", "CO", "BN", "SB"];
const SPOT_ORDER: DefenseSpot[] = ["open", "push", "limp", "4bet", "lr"];

function asScenario(c: DefenseChart): DefenseScenario {
  return { type: "def", kind: "freq", chart: c, stack: c.stack, fmt: c.group, hero: c.hero, vil: c.vil, spot: c.spot };
}

export function DefenseView() {
  const [fmt, setFmt] = useState<"mtt" | "cash">("mtt");
  const [hero, setHero] = useState("BB");
  const [vil, setVil] = useState("BN");
  const [stack, setStack] = useState(25);
  const [spot, setSpot] = useState<DefenseSpot>("open");

  // Each selector narrows the next; an invalid earlier pick falls back to the nearest valid one.
  const sel = useMemo(() => {
    const pool = DEFENSE_CHARTS.filter((c) => c.group === fmt);
    const heroes = HEROES.filter((h) => pool.some((c) => c.hero === h));
    const h = heroes.includes(hero) ? hero : heroes[heroes.length - 1];
    const p1 = pool.filter((c) => c.hero === h);
    const vils = OPENERS.filter((v) => p1.some((c) => c.vil === v));
    const v = vils.includes(vil) ? vil : vils[vils.length - 1];
    const p2 = p1.filter((c) => c.vil === v);
    const stacks = [...new Set(p2.map((c) => c.stack))].sort((a, b) => a - b);
    const s = stacks.includes(stack)
      ? stack
      : stacks.reduce((b, x) => (Math.abs(x - stack) < Math.abs(b - stack) ? x : b), stacks[0]);
    const p3 = p2.filter((c) => c.stack === s).sort((a, b) => SPOT_ORDER.indexOf(a.spot) - SPOT_ORDER.indexOf(b.spot));
    const chart = p3.find((c) => c.spot === spot) ?? p3[0];
    const sameSpot = p2.filter((c) => c.spot === chart.spot).sort((a, b) => a.stack - b.stack);
    return { heroes, vils, stacks, spots: p3, chart, sameSpot };
  }, [fmt, hero, vil, stack, spot]);

  const { chart } = sel;
  const label = (c: DefenseChart) => spotLabel(asScenario(c));

  return (
    <div>
      <div className="mb-5 space-y-3">
        <Pills
          label="Game"
          value={fmt}
          options={["mtt", "cash"]}
          onChange={(v) => {
            setFmt(v as "mtt" | "cash");
            setStack(v === "cash" ? 100 : 25);
          }}
          format={(v) => (v === "mtt" ? "MTT · 15–60bb" : "Cash 6-max · 100bb")}
        />
        <Pills label="You" value={chart.hero} options={sel.heroes} onChange={setHero} format={displayPos} />
        <Pills label="Opener" value={chart.vil} options={sel.vils} onChange={setVil} format={displayPos} />
        {fmt === "mtt" && (
          <Pills
            label="Stack"
            value={String(chart.stack)}
            options={sel.stacks.map(String)}
            onChange={(s) => setStack(Number(s))}
            format={(s) => `${s}bb`}
          />
        )}
        <Pills
          label="Situation"
          value={chart.spot}
          options={sel.spots.map((c) => c.spot)}
          onChange={(s) => setSpot(s as DefenseSpot)}
          format={(s) => label(sel.spots.find((c) => c.spot === s)!)}
        />
      </div>
      <ChartPanel
        heading={`${displayPos(chart.hero)} vs ${displayPos(chart.vil)}${chart.group === "mtt" ? ` · ${chart.stack}bb` : ""}`}
        source={`${label(chart)} · Hand Range ${chart.n} · p. ${chart.page}`}
        grid={chart.grid}
        actions={chart.actions}
      />
      <MiniStacks
        heading={`Every stack · ${displayPos(chart.hero)} vs ${displayPos(chart.vil)}`}
        items={sel.sameSpot.map((c) => ({ key: String(c.stack), label: `${c.stack}bb`, grid: c.grid, actions: c.actions }))}
        selected={String(chart.stack)}
        onSelect={(k) => setStack(Number(k))}
      />
      <Note>
        {fmt === "mtt"
          ? "MTT defense with antes (Hand Ranges 140–266). Facing a 4-bet or a re-raise, only the hands that actually reach that spot are shown; the percentages on the right are the source's own figures. Per-hand frequencies are read from the charts (±1–2 points)."
          : "6-max cash game, 100bb (chapter 5, Hand Ranges 56–87). Facing a 4-bet or a re-raise, only the hands that actually reach that spot are shown. Per-hand frequencies are read from the charts (±1–2 points)."}
      </Note>
    </div>
  );
}

// ── Push / fold ─────────────────────────────────────────────────────────────

const PF_POSITIONS = ["UTG", "UTG+1", "UTG+2", "LJ", "HJ", "CO", "BN", "SB"];

export function PushFoldView() {
  const [pos, setPos] = useState("BN");
  const [bb, setBb] = useState(10);
  const [focus, setFocus] = useState<string | null>(null);
  const chart = PUSH_FOLD_CHARTS.find((c) => c.pos === pos)!;
  const values = useMemo(
    () => Object.fromEntries(Object.entries(chart.grid).map(([h, cell]) => [h, pushValue(cell)])),
    [chart],
  );
  const pushPct = (ALL_HANDS.filter((h) => values[h] >= bb).reduce((s, h) => s + combos(h), 0) / 1326) * 100;
  const fv = focus ? values[focus] : 0;

  return (
    <div>
      <div className="mb-5 space-y-3">
        <Pills label="Position" value={pos} options={PF_POSITIONS} onChange={setPos} format={displayPos} />
        <div>
          <label htmlFor="pf-stack" className="block text-xs font-medium text-muted-foreground">
            Stack
          </label>
          <div className="mt-1.5 flex max-w-md items-center gap-3">
            <input
              id="pf-stack"
              type="range"
              min={1}
              max={10}
              step={1}
              value={bb}
              onChange={(e) => setBb(Number(e.target.value))}
              className="flex-1 accent-violet-500"
            />
            <output htmlFor="pf-stack" className="w-12 font-mono text-sm font-semibold tabular-nums text-foreground">
              {bb}bb
            </output>
          </div>
        </div>
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <PokerRangeGrid range={[]} mode="pushfold" pushValues={values} pushThreshold={bb} onHandFocus={setFocus} />
        <aside className="space-y-4 rounded-xl border border-border/60 bg-background/40 p-4">
          <div>
            <h3 className="text-lg font-semibold tracking-tight text-foreground">{displayPos(chart.pos)} · shove ≤10bb</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {chart.hr} · p. {chart.page}
            </p>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Each number is the <b className="text-foreground">largest</b> stack (in bb) at which the hand is still
            shoved first in. “10” means every stack of 10bb or less.
          </p>
          <div>
            <div className="flex gap-0.5" aria-hidden="true">
              {Array.from({ length: 10 }, (_, i) => (
                <span
                  key={i}
                  className="flex h-5 flex-1 items-center justify-center rounded-[3px] font-mono text-[10px] font-semibold text-white"
                  style={{ background: `rgba(239,68,68,${(0.3 + 0.6 * (i / 9)).toFixed(2)})` }}
                >
                  {i + 1}
                </span>
              ))}
            </div>
            <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
              <span>only very short</span>
              <span>up to 10bb</span>
            </div>
          </div>
          <p className="flex items-center text-sm text-foreground">
            Shoving range at {bb}bb
            <span className="ml-auto font-mono text-xs tabular-nums text-muted-foreground">{fmtPct(pushPct)}%</span>
          </p>
          <div className="min-h-[3.5rem] border-t border-border/50 pt-3">
            {focus ? (
              <>
                <p className="font-mono text-xl font-semibold text-foreground">{focus}</p>
                <p className="text-xs text-muted-foreground">
                  {fv > 0 ? `Shove at ${fv === 10 ? "10bb or less" : `${fv}bb or less`}` : "Never shove (not even at 1bb)"}
                </p>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">Hover or tap a hand.</p>
            )}
          </div>
        </aside>
      </div>
      <Note>
        Push/fold tables (Hand Ranges 88–95), computed in the source with HRC (FGS). Drag the slider to see which hands
        you can shove at your stack; hands with a lower number are dimmed.
      </Note>
    </div>
  );
}
