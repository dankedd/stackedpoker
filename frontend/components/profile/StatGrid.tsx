"use client";

import type { PlayerStats } from "@/lib/types";
import { cn } from "@/lib/utils";

interface StatTileProps {
  label: string;
  value: string;
  sub?: string;
  color?: string;
  benchmark?: string;
  delay?: number;
}

function StatTile({ label, value, sub, color, benchmark, delay = 0 }: StatTileProps) {
  return (
    <div
      className="rounded-xl border border-border/60 bg-card/60 p-4 space-y-2"
      style={{ animationDelay: `${delay}ms` }}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("text-2xl font-bold tabular-nums", color ?? "text-foreground")}>
        {value}
      </p>
      {sub && <p className="text-xs text-muted-foreground/70">{sub}</p>}
      {benchmark && (
        <p className="text-[10px] text-muted-foreground/60 border-t border-border/40 pt-1.5">
          {benchmark}
        </p>
      )}
    </div>
  );
}

const scoreColor = (v: number) =>
  v >= 80 ? "text-green-400" :
  v >= 65 ? "text-blue-400"  :
  v >= 50 ? "text-amber-400" :
  v > 0   ? "text-red-400"   :
  "text-muted-foreground";

interface Props {
  stats: PlayerStats;
}

export function StatGrid({ stats }: Props) {
  const {
    vpip_pct, pfr_pct, three_bet_pct,
    ip_score, oop_score,
    srp_score, three_bet_pot_score,
    deep_score, short_score,
    avg_mistakes_per_hand, total_ev_loss_bb,
    cash_avg_score, tournament_avg_score,
    pfr_score, caller_score,
  } = stats;

  return (
    <div className="space-y-4">
      {/* Preflop stats */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Preflop</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <StatTile
            label="VPIP"
            value={`${vpip_pct.toFixed(0)}%`}
            color={vpip_pct >= 15 && vpip_pct <= 28 ? "text-green-400" : vpip_pct < 12 ? "text-slate-400" : "text-amber-400"}
            benchmark="GTO: 18–28%"
            delay={0}
          />
          <StatTile
            label="PFR"
            value={`${pfr_pct.toFixed(0)}%`}
            color={pfr_pct >= 14 && pfr_pct <= 22 ? "text-green-400" : pfr_pct < 10 ? "text-slate-400" : "text-amber-400"}
            benchmark="GTO: 14–22%"
            delay={60}
          />
          <StatTile
            label="3-Bet %"
            value={`${three_bet_pct.toFixed(0)}%`}
            color={three_bet_pct >= 6 && three_bet_pct <= 12 ? "text-green-400" : "text-amber-400"}
            benchmark="GTO: 6–12%"
            delay={120}
          />
        </div>
      </div>

      {/* Position */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Position</h3>
        <div className="grid grid-cols-2 gap-3">
          <StatTile
            label="In-Position Score"
            value={ip_score > 0 ? ip_score.toFixed(0) : "—"}
            color={scoreColor(ip_score)}
            sub="avg score when IP"
            delay={0}
          />
          <StatTile
            label="Out-of-Position Score"
            value={oop_score > 0 ? oop_score.toFixed(0) : "—"}
            color={scoreColor(oop_score)}
            sub="avg score when OOP"
            delay={60}
          />
        </div>
      </div>

      {/* Pot type */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Pot Type</h3>
        <div className="grid grid-cols-2 gap-3">
          <StatTile
            label="SRP Score"
            value={srp_score > 0 ? srp_score.toFixed(0) : "—"}
            color={scoreColor(srp_score)}
            sub="single-raised pots"
            delay={0}
          />
          <StatTile
            label="3-Bet Pot Score"
            value={three_bet_pot_score > 0 ? three_bet_pot_score.toFixed(0) : "—"}
            color={scoreColor(three_bet_pot_score)}
            sub="3-bet+ pots"
            delay={60}
          />
        </div>
      </div>

      {/* Stack depth */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Stack Depth</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <StatTile
            label="Deep (100bb+)"
            value={deep_score > 0 ? deep_score.toFixed(0) : "—"}
            color={scoreColor(deep_score)}
            delay={0}
          />
          <StatTile
            label="Short (<50bb)"
            value={short_score > 0 ? short_score.toFixed(0) : "—"}
            color={scoreColor(short_score)}
            delay={60}
          />
          <StatTile
            label="PFR vs Caller"
            value={pfr_score > 0 && caller_score > 0 ? `${pfr_score.toFixed(0)} / ${caller_score.toFixed(0)}` : "—"}
            sub="aggressor vs defender"
            delay={120}
          />
        </div>
      </div>

      {/* EV & errors */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">EV & Mistakes</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <StatTile
            label="Mistakes / Hand"
            value={avg_mistakes_per_hand.toFixed(2)}
            color={avg_mistakes_per_hand < 0.5 ? "text-green-400" : avg_mistakes_per_hand < 1.5 ? "text-amber-400" : "text-red-400"}
            sub="lower is better"
            delay={0}
          />
          <StatTile
            label="Total EV Loss"
            value={`−${total_ev_loss_bb.toFixed(0)}bb`}
            color="text-red-400"
            sub="estimated cumulative"
            delay={60}
          />
          <StatTile
            label="Cash / MTT Score"
            value={
              cash_avg_score > 0 && tournament_avg_score > 0
                ? `${cash_avg_score.toFixed(0)} / ${tournament_avg_score.toFixed(0)}`
                : cash_avg_score > 0
                ? `${cash_avg_score.toFixed(0)} / —`
                : "—"
            }
            sub="cash vs tournament"
            delay={120}
          />
        </div>
      </div>
    </div>
  );
}
