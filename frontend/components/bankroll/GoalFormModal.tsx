"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Wallet, TrendingUp, Clock, Hash, Layers, type LucideIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";
import { GOAL_TYPE_META, GOAL_TYPE_ORDER, type GoalType } from "@/lib/bankroll/goals";

const inputCls =
  "w-full bg-card/60 border border-border/50 rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-all";
const labelCls = "text-xs font-semibold text-muted-foreground/70 mb-1.5 block";

const TYPE_ICONS: Record<GoalType, LucideIcon> = {
  bankroll_amount: Wallet,
  profit_target: TrendingUp,
  hours_played: Clock,
  hands_played: Hash,
  sessions_count: Layers,
};

interface GoalFormModalProps {
  open: boolean;
  userId: string;
  currency: string;
  onClose: () => void;
  onSaved: () => void;
}

export function GoalFormModal({ open, userId, currency, onClose, onSaved }: GoalFormModalProps) {
  const [goalType, setGoalType] = useState<GoalType>("bankroll_amount");
  const [title, setTitle] = useState("");
  const [targetValue, setTargetValue] = useState("");
  const [titleTouched, setTitleTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setGoalType("bankroll_amount");
    setTitle("");
    setTargetValue("");
    setTitleTouched(false);
  }, [open]);

  if (!open) return null;

  const meta = GOAL_TYPE_META[goalType];
  const target = Number(targetValue);
  const suggestedTitle = !Number.isNaN(target) && target > 0 ? meta.defaultTitle(target) : "";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!targetValue || Number.isNaN(target) || target <= 0) {
      toast.error("Enter a target greater than 0.");
      return;
    }

    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("bankroll_goals").insert({
        user_id: userId,
        goal_type: goalType,
        title: (titleTouched ? title.trim() : "") || suggestedTitle || meta.label,
        target_value: target,
        currency: meta.isMoney ? currency : null,
      });
      if (error) throw error;

      toast.success("Goal added");
      onSaved();
      onClose();
    } catch (err) {
      console.error("[bankroll] save goal failed:", err);
      toast.error("Couldn't save the goal. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="New goal" maxWidthClassName="max-w-md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={labelCls}>Goal type</label>
          <div className="grid grid-cols-1 gap-1.5">
            {GOAL_TYPE_ORDER.map((type) => {
              const m = GOAL_TYPE_META[type];
              const Icon = TYPE_ICONS[type];
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setGoalType(type)}
                  className={cn(
                    "flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm font-medium text-left transition-all",
                    goalType === type
                      ? "border-violet-500/50 bg-violet-500/10 text-violet-300"
                      : "border-border/40 bg-secondary/20 text-muted-foreground hover:text-foreground hover:border-border/60"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className={labelCls}>
            Target {meta.isMoney ? `(${currency})` : meta.unit && `(${meta.unit})`}
          </label>
          <input
            type="number"
            min={0.01}
            step={meta.isMoney ? "0.01" : "1"}
            required
            autoFocus
            value={targetValue}
            onChange={(e) => setTargetValue(e.target.value)}
            placeholder={meta.isMoney ? "10000" : "100"}
            className={cn(inputCls, "tabular-nums")}
          />
        </div>

        <div>
          <label className={labelCls}>Title <span className="text-muted-foreground/40 normal-case font-normal">(optional)</span></label>
          <input
            value={title}
            onChange={(e) => { setTitle(e.target.value); setTitleTouched(true); }}
            placeholder={suggestedTitle || "e.g. My next milestone"}
            className={inputCls}
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" variant="poker" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Add goal
          </Button>
        </div>
      </form>
    </Modal>
  );
}
