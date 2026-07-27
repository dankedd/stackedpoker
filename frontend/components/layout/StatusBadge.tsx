import { Construction, ArrowUpRight, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type ProductStatus = "available" | "next" | "development" | "later";

const STATUS_CONFIG: Record<
  ProductStatus,
  { label: string; icon: typeof Construction; className: string }
> = {
  available: {
    label: "Available now",
    icon: CheckCircle2,
    className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  },
  next: {
    label: "Next up",
    icon: ArrowUpRight,
    className: "border-blue-500/30 bg-blue-500/10 text-blue-300",
  },
  development: {
    label: "In development",
    icon: Construction,
    className: "border-amber-500/25 bg-amber-500/10 text-amber-300",
  },
  later: {
    label: "Later",
    icon: Construction,
    className: "border-slate-500/25 bg-slate-500/10 text-slate-400",
  },
};

export function StatusBadge({
  status,
  className,
}: {
  status: ProductStatus;
  className?: string;
}) {
  const { label, icon: Icon, className: statusCls } = STATUS_CONFIG[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider",
        statusCls,
        className
      )}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {label}
    </span>
  );
}
