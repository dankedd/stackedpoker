import Link from "next/link";
import { Coins, Trophy, Zap, Spade, Settings2, AlertTriangle, type LucideIcon } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import {
  CATEGORY_META, CATEGORY_ORDER, evaluateBankrollStatus,
  type BankrollCategory, type BuyInRules,
} from "@/lib/bankroll/management";
import { BankrollStatusBadge } from "@/components/bankroll/BankrollStatusBadge";

const CATEGORY_ICONS: Record<BankrollCategory, LucideIcon> = {
  cash: Coins,
  tournament: Trophy,
  spin_and_go: Zap,
  plo: Spade,
};

interface BankrollManagementSectionProps {
  bankroll: number;
  currency: string;
  buyInRules: BuyInRules;
  recentStakeByCategory: Partial<Record<BankrollCategory, string>>;
}

export function BankrollManagementSection({ bankroll, currency, buyInRules, recentStakeByCategory }: BankrollManagementSectionProps) {
  const hasAnyRule = CATEGORY_ORDER.some((c) => buyInRules[c]);

  if (!hasAnyRule) {
    return (
      <div className="rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-950/30 via-card/60 to-blue-950/10 p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/12 border border-violet-500/25 shrink-0">
            <Settings2 className="h-4.5 w-4.5 text-violet-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Set up bankroll management</p>
            <p className="text-xs text-muted-foreground/60 mt-0.5">Pick your own buy-in rule per game type and get automatic Safe / Move Up / Move Down status.</p>
          </div>
        </div>
        <Link
          href="/bankroll/management"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-blue-500 text-white text-sm font-semibold shadow-lg shadow-violet-500/25 hover:shadow-violet-500/45 hover:-translate-y-0.5 transition-all duration-200 shrink-0"
        >
          Set up rules
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground/50">Bankroll management</p>
        <Link href="/bankroll/management" className="flex items-center gap-1 text-xs font-semibold text-violet-400 hover:text-violet-300 transition-colors">
          <Settings2 className="h-3 w-3" />
          Manage rules
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {CATEGORY_ORDER.map((category) => {
          const meta = CATEGORY_META[category];
          const Icon = CATEGORY_ICONS[category];
          const rule = buyInRules[category];
          const result = evaluateBankrollStatus(bankroll, rule);
          const stakeLabel = recentStakeByCategory[category];

          return (
            <div key={category} className="rounded-2xl border border-border/50 bg-card/60 p-5 card-lift">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Icon className="h-4 w-4 text-violet-400/80 shrink-0" />
                  <span className="text-sm font-semibold text-foreground truncate">{meta.label}</span>
                </div>
                <BankrollStatusBadge status={result.status} />
              </div>

              <p className="text-xs text-muted-foreground/60 mb-1">
                Current stake: <span className="text-foreground/80 font-medium">{stakeLabel ?? "—"}</span>
              </p>

              {result.buyInsAvailable != null ? (
                <p className="text-xs text-muted-foreground/60">
                  <span className="text-foreground font-semibold tabular-nums">{result.buyInsAvailable.toFixed(1)}</span> buy-ins
                  {rule && <span className="text-muted-foreground/40"> · rule: {rule.buyInCount} BI</span>}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground/40">
                  {rule ? "Add your current buy-in size to see status." : "No rule set yet."}
                </p>
              )}

              {result.warning && (
                <p className="flex items-start gap-1.5 text-[11px] text-amber-400/90 mt-3 pt-3 border-t border-amber-500/15 leading-relaxed">
                  <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
                  {result.warning}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-[10px] text-muted-foreground/40 mt-3">
        Bankroll: {formatCurrency(bankroll, currency)}. Buy-in rules are set by you — Stacked Poker doesn&apos;t prescribe a &quot;correct&quot; number.
      </p>
    </div>
  );
}
