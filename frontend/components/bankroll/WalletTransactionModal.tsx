"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";

const inputCls =
  "w-full bg-card/60 border border-border/50 rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-all";
const labelCls = "text-xs font-semibold text-muted-foreground/70 mb-1.5 block";

function todayLocal(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

interface WalletTransactionModalProps {
  open: boolean;
  type: "deposit" | "withdrawal";
  userId: string;
  currency: string;
  onClose: () => void;
  onSaved: () => void;
}

export function WalletTransactionModal({ open, type, userId, currency, onClose, onSaved }: WalletTransactionModalProps) {
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayLocal());
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAmount("");
    setDate(todayLocal());
    setNote("");
  }, [open, type]);

  if (!open) return null;

  const isDeposit = type === "deposit";
  const title = isDeposit ? "Add deposit" : "Add withdrawal";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amountValue = Number(amount);
    if (!amount || Number.isNaN(amountValue) || amountValue <= 0) {
      toast.error("Enter an amount greater than 0.");
      return;
    }
    if (!date) {
      toast.error("Date is required.");
      return;
    }

    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("bankroll_transactions").insert({
        user_id: userId,
        type,
        amount: amountValue,
        currency,
        occurred_at: new Date(`${date}T12:00`).toISOString(),
        note: note.trim() || null,
      });
      if (error) throw error;

      toast.success(isDeposit ? "Deposit added" : "Withdrawal added");
      onSaved();
      onClose();
    } catch (err) {
      console.error("[bankroll] save transaction failed:", err);
      toast.error("Couldn't save the transaction. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={title} maxWidthClassName="max-w-md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={labelCls}>Amount</label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            required
            autoFocus
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className={cn(inputCls, "tabular-nums")}
          />
        </div>

        <div>
          <label className={labelCls}>Date</label>
          <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
        </div>

        <div>
          <label className={labelCls}>Note <span className="text-muted-foreground/40 normal-case font-normal">(optional)</span></label>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={isDeposit ? "e.g. bank transfer top-up" : "e.g. cashed out to bank"}
            rows={2}
            className="font-sans"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" variant="poker" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {isDeposit ? "Add deposit" : "Add withdrawal"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
