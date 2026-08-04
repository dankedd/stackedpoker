import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import type { BankrollTransactionRow } from "@/lib/bankroll/types";

export function TransactionRow({ transaction }: { transaction: BankrollTransactionRow }) {
  const isDeposit = transaction.type === "deposit";
  const Icon = isDeposit ? ArrowDownToLine : ArrowUpFromLine;
  const date = new Date(transaction.occurred_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/40 bg-card/40 px-4 py-3.5">
      <div
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-xl shrink-0 border",
          isDeposit ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-400" : "bg-red-500/10 border-red-500/25 text-red-400"
        )}
      >
        <Icon className="h-4 w-4" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{isDeposit ? "Deposit" : "Withdrawal"}</p>
        <p className="text-xs text-muted-foreground/50 truncate">
          {date}
          {transaction.note ? ` · ${transaction.note}` : ""}
        </p>
      </div>

      <p className={cn("text-sm font-bold tabular-nums shrink-0", isDeposit ? "text-emerald-400" : "text-red-400")}>
        {isDeposit ? "+" : "−"}{formatCurrency(transaction.amount, transaction.currency)}
      </p>
    </div>
  );
}
