"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Coins, Trophy, Zap, Spade, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { Navbar } from "@/components/layout/Navbar";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { cn, formatCurrency, getErrorMessage } from "@/lib/utils";
import {
  CATEGORY_META, CATEGORY_ORDER, evaluateBankrollStatus,
  type BankrollCategory, type BuyInRules,
} from "@/lib/bankroll/management";
import { parseLocaleNumber } from "@/lib/bankroll/parseNumberInput";
import { BankrollStatusBadge } from "@/components/bankroll/BankrollStatusBadge";
import { BankrollBackLink } from "@/components/bankroll/BankrollBackLink";
import { BankrollPageLoader } from "@/components/bankroll/BankrollPageLoader";
import { BankrollErrorState } from "@/components/bankroll/BankrollErrorState";
import type { BankrollOverview } from "@/lib/bankroll/types";

const CATEGORY_ICONS: Record<BankrollCategory, LucideIcon> = {
  cash: Coins,
  tournament: Trophy,
  spin_and_go: Zap,
  plo: Spade,
};

const inputCls =
  "w-full bg-card/60 border border-border/50 rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-all";

interface CategoryFormState {
  buyInCount: string;
  currentBuyIn: string;
}

function emptyCategoryForm(): CategoryFormState {
  return { buyInCount: "", currentBuyIn: "" };
}

export default function BankrollManagementPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currency, setCurrency] = useState("USD");
  const [bankroll, setBankroll] = useState(0);
  const [forms, setForms] = useState<Record<BankrollCategory, CategoryFormState>>({
    cash: emptyCategoryForm(),
    tournament: emptyCategoryForm(),
    spin_and_go: emptyCategoryForm(),
    plo: emptyCategoryForm(),
  });

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [user, authLoading, router]);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const supabase = createClient();
      const [{ data: settingsRow, error: settingsError }, { data: overviewRow }] = await Promise.all([
        supabase.from("bankroll_settings").select("preferred_currency, buy_in_rules").eq("user_id", user.id).maybeSingle(),
        supabase.rpc("bankroll_overview", { p_user_id: user.id }).single(),
      ]);

      if (settingsError) {
        console.error("[bankroll/management] fetch error:", settingsError.message);
        setLoadError(true);
        return;
      }
      setLoadError(false);

      setCurrency(settingsRow?.preferred_currency ?? "USD");
      setBankroll((overviewRow as unknown as BankrollOverview | null)?.current_bankroll ?? 0);

      const rules = (settingsRow?.buy_in_rules ?? {}) as BuyInRules;
      setForms({
        cash: rules.cash ? { buyInCount: String(rules.cash.buyInCount), currentBuyIn: rules.cash.currentBuyIn != null ? String(rules.cash.currentBuyIn) : "" } : emptyCategoryForm(),
        tournament: rules.tournament ? { buyInCount: String(rules.tournament.buyInCount), currentBuyIn: rules.tournament.currentBuyIn != null ? String(rules.tournament.currentBuyIn) : "" } : emptyCategoryForm(),
        spin_and_go: rules.spin_and_go ? { buyInCount: String(rules.spin_and_go.buyInCount), currentBuyIn: rules.spin_and_go.currentBuyIn != null ? String(rules.spin_and_go.currentBuyIn) : "" } : emptyCategoryForm(),
        plo: rules.plo ? { buyInCount: String(rules.plo.buyInCount), currentBuyIn: rules.plo.currentBuyIn != null ? String(rules.plo.currentBuyIn) : "" } : emptyCategoryForm(),
      });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const setCategoryField = (category: BankrollCategory, field: keyof CategoryFormState, value: string) => {
    setForms((prev) => ({ ...prev, [category]: { ...prev[category], [field]: value } }));
  };

  const previewRules: BuyInRules = useMemo(() => {
    const result: BuyInRules = {};
    for (const category of CATEGORY_ORDER) {
      const f = forms[category];
      const buyInCount = parseLocaleNumber(f.buyInCount);
      if (!f.buyInCount || Number.isNaN(buyInCount) || buyInCount <= 0) continue;
      const currentBuyIn = f.currentBuyIn.trim() === "" ? null : parseLocaleNumber(f.currentBuyIn);
      result[category] = { buyInCount, currentBuyIn: currentBuyIn != null && !Number.isNaN(currentBuyIn) ? currentBuyIn : null };
    }
    return result;
  }, [forms]);

  async function handleSave() {
    if (!user) return;
    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("bankroll_settings")
        .update({ buy_in_rules: previewRules })
        .eq("user_id", user.id);
      if (error) throw error;
      toast.success("Bankroll rules saved");
    } catch (err) {
      console.error("[bankroll] save management rules failed:", err);
      toast.error(`Couldn't save your bankroll rules: ${getErrorMessage(err)}`);
    } finally {
      setSaving(false);
    }
  }

  if (authLoading || loading) return <BankrollPageLoader />;

  return (
    <div className="min-h-screen bg-background">
      <Navbar variant="static" />

      <main className="container mx-auto max-w-4xl px-4 sm:px-6 py-10 page-enter">

        <div className="mb-8 animate-fade-in">
          <BankrollBackLink />
          <h1 className="text-3xl font-black text-foreground tracking-tight">Bankroll management</h1>
          <p className="text-muted-foreground mt-1.5 max-w-2xl">
            Pick your own buy-in safety rule per game type, and tell us what buy-in size you&apos;re currently playing.
            Your dashboard will automatically flag when you&apos;re safe, ready to move up, or should move down.
          </p>
        </div>

        {loadError ? (
          <BankrollErrorState message="Couldn't load your bankroll rules." onRetry={fetchData} />
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              {CATEGORY_ORDER.map((category) => {
                const meta = CATEGORY_META[category];
                const Icon = CATEGORY_ICONS[category];
                const form = forms[category];
                const rule = previewRules[category];
                const preview = evaluateBankrollStatus(bankroll, rule);

                return (
                  <div key={category} className="rounded-2xl border border-border/50 bg-card/60 p-5 card-lift">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/12 border border-violet-500/25 shrink-0">
                          <Icon className="h-4 w-4 text-violet-400" />
                        </div>
                        <h2 className="text-sm font-semibold text-foreground">{meta.label}</h2>
                      </div>
                      <BankrollStatusBadge status={preview.status} />
                    </div>

                    <div className="mb-3">
                      <label className="text-xs font-semibold text-muted-foreground/70 mb-1.5 block">Buy-in rule</label>
                      <div className="flex flex-wrap gap-1.5">
                        {meta.buyInPresets.map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setCategoryField(category, "buyInCount", String(preset))}
                            className={cn(
                              "px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all",
                              parseLocaleNumber(form.buyInCount) === preset
                                ? "border-violet-500/50 bg-violet-500/10 text-violet-300"
                                : "border-border/40 bg-secondary/20 text-muted-foreground hover:text-foreground hover:border-border/60"
                            )}
                          >
                            {preset} BI
                          </button>
                        ))}
                        <input
                          type="number"
                          min={1}
                          step="1"
                          placeholder="Custom"
                          value={form.buyInCount && !meta.buyInPresets.includes(parseLocaleNumber(form.buyInCount)) ? form.buyInCount : ""}
                          onChange={(e) => setCategoryField(category, "buyInCount", e.target.value)}
                          className="w-20 bg-card/60 border border-border/50 rounded-lg px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-violet-500/50 tabular-nums"
                        />
                      </div>
                    </div>

                    <div className="mb-1">
                      <label className="text-xs font-semibold text-muted-foreground/70 mb-1.5 block">
                        Current buy-in size <span className="text-muted-foreground/40 normal-case font-normal">($)</span>
                      </label>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="e.g. 200"
                        value={form.currentBuyIn}
                        onChange={(e) => setCategoryField(category, "currentBuyIn", e.target.value)}
                        className={cn(inputCls, "tabular-nums")}
                      />
                    </div>

                    {preview.buyInsAvailable != null && (
                      <p className="text-[11px] text-muted-foreground/50 mt-2">
                        {preview.buyInsAvailable.toFixed(1)} buy-ins available ({formatCurrency(bankroll, currency)} bankroll)
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end">
              <Button variant="poker" onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Save changes
              </Button>
            </div>
          </>
        )}

      </main>
    </div>
  );
}
