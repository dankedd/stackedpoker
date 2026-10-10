"use client";

import { useEffect, useRef, useState } from "react";
import { Grid3x3, Search, X } from "lucide-react";
import { CARD_RANKS, CARD_SUITS, parseCardQuery, parseTerm, termText } from "@/lib/handHistory/cardSearch";
import { t } from "@/lib/handHistory/strings";
import { handAt } from "@/lib/ranges/logic";
import { cn } from "@/lib/utils";
import { MiniCards } from "./MiniCards";
import { Popover } from "./Popover";

/**
 * Card search field + picker. The field holds the terms ("AQ, 55, AhQd");
 * valid terms are applied after a short pause, on Enter and on blur. The
 * picker adds or removes terms: a 13×13 matrix (hand classes, no suits) and an
 * exact-cards tab (four-colour deck).
 */
export function CardSearch({ terms, onChange, className }: { terms: string[]; onChange: (terms: string[]) => void; className?: string }) {
  const [text, setText] = useState(terms.join(", "));
  const [invalid, setInvalid] = useState<string[]>([]);
  const focused = useRef(false);

  // Follow outside changes (chips removed, presets) unless the user is typing.
  useEffect(() => {
    if (!focused.current) setText(terms.join(", "));
  }, [terms]);

  const apply = (value: string) => {
    const { terms: parsed, invalid: bad } = parseCardQuery(value);
    setInvalid(bad);
    const next = parsed.map(termText);
    if (next.join(",") !== terms.join(",")) onChange(next);
  };

  useEffect(() => {
    if (!focused.current) return;
    const timer = setTimeout(() => apply(text), 450);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  const toggle = (term: string) => {
    const next = terms.includes(term) ? terms.filter((x) => x !== term) : [...terms, term];
    onChange(next);
    setText(next.join(", "));
    setInvalid([]);
  };

  return (
    <div className={cn("relative", className)}>
      <div className="flex items-center gap-1 rounded-xl border border-border/60 bg-background/60 pl-3 pr-1 transition-colors focus-within:border-violet-500/60">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <input
          type="search"
          data-filter="cards"
          value={text}
          aria-label={t.filterBar.searchAria}
          placeholder={t.filterBar.searchPlaceholder}
          title={t.filterBar.searchHelp}
          onFocus={() => (focused.current = true)}
          onBlur={() => {
            focused.current = false;
            apply(text);
          }}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") apply(text);
          }}
          className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
        />
        {text && (
          <button
            type="button"
            aria-label={t.filterBar.clearAll}
            onClick={() => {
              setText("");
              setInvalid([]);
              onChange([]);
            }}
            className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        <Popover
          label={t.filterBar.pickCards}
          align="end"
          trigger={<Grid3x3 className="h-4 w-4" />}
          triggerClassName="rounded-lg p-1.5 text-muted-foreground hover:bg-white/5 hover:text-foreground"
          panelClassName="w-[min(92vw,420px)]"
        >
          <CardPicker terms={terms} onToggle={toggle} />
        </Popover>
      </div>
      {invalid.length > 0 && <p className="mt-1 text-[11px] text-amber-300">{t.filterBar.unrecognised(invalid.join(", "))}</p>}
    </div>
  );
}

function CardPicker({ terms, onToggle }: { terms: string[]; onToggle: (term: string) => void }) {
  const [tab, setTab] = useState<"matrix" | "exact">("matrix");
  const [picked, setPicked] = useState<string[]>([]);
  const combo = picked.length ? termText(parseTerm(picked.join(""))!) : "";

  return (
    <div className="space-y-3">
      <div role="tablist" className="flex gap-1 rounded-lg border border-white/10 bg-white/[0.03] p-0.5 text-xs font-semibold">
        {(["matrix", "exact"] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={cn("flex-1 rounded-md px-3 py-1 transition-colors", tab === k ? "bg-violet-500/25 text-violet-100" : "text-slate-400 hover:text-white")}
          >
            {k === "matrix" ? t.filterBar.tabMatrix : t.filterBar.tabExact}
          </button>
        ))}
      </div>

      {tab === "matrix" ? (
        <>
          <div className="grid gap-[2px]" style={{ gridTemplateColumns: "repeat(13, minmax(0, 1fr))" }}>
            {Array.from({ length: 169 }, (_, i) => {
              const h = handAt(Math.floor(i / 13), i % 13);
              const on = terms.includes(h);
              return (
                <button
                  key={h}
                  type="button"
                  aria-pressed={on}
                  onClick={() => onToggle(h)}
                  className={cn(
                    "aspect-square rounded-[3px] text-[8px] font-semibold leading-none transition-colors sm:text-[10px]",
                    on ? "bg-violet-500 text-white" : h.length === 2 ? "bg-white/[0.07] text-foreground/70 hover:bg-white/15" : "bg-white/[0.03] text-muted-foreground hover:bg-white/10",
                  )}
                >
                  {h}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-muted-foreground">{t.filterBar.matrixHelp}</p>
        </>
      ) : (
        <>
          <div className="space-y-1">
            {CARD_SUITS.split("").map((s) => (
              <div key={s} className="grid gap-[3px]" style={{ gridTemplateColumns: "repeat(13, minmax(0, 1fr))" }}>
                {CARD_RANKS.split("").map((r) => {
                  const c = r + s;
                  const on = picked.includes(c);
                  return (
                    <button
                      key={c}
                      type="button"
                      aria-pressed={on}
                      aria-label={c}
                      onClick={() => setPicked((p) => (on ? p.filter((x) => x !== c) : [...p, c].slice(-2)))}
                      className={cn("flex justify-center rounded-[5px] transition", on ? "ring-2 ring-white" : "opacity-75 hover:opacity-100")}
                    >
                      <MiniCards cards={[c]} />
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] text-muted-foreground">{t.filterBar.exactHelp}</p>
            <button
              type="button"
              disabled={!combo}
              onClick={() => {
                onToggle(combo);
                setPicked([]);
              }}
              className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-500 disabled:opacity-40"
            >
              {t.filterBar.addCards(combo || "…")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
