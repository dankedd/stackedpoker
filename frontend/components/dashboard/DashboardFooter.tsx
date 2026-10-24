import Link from "next/link";
import type { PlanLine } from "@/lib/dashboard/model";
import { DASH } from "@/lib/dashboard/strings";
import { ManageLink } from "./ManageLink";

const F = DASH.footer;

/** Block 6 — plan and usage, member since, hands imported: one small line, no tiles. */
export function DashboardFooter({
  plan,
  memberSince,
  hands,
  tournaments,
}: {
  plan: PlanLine | null;
  memberSince: string;
  hands: number | null;
  tournaments: number | null;
}) {
  const parts: React.ReactNode[] = [];
  if (plan) {
    parts.push(
      <span key="plan" className="inline-flex flex-wrap items-baseline gap-x-1">
        <b className="font-semibold text-foreground/80">{plan.label}</b>
        {plan.detail && <span>· {plan.detail}</span>}
        {plan.action === "upgrade" && (
          <>
            <span>·</span>
            <Link href="/pricing" className="font-semibold text-violet-300 hover:text-violet-200">
              {F.upgrade}
            </Link>
          </>
        )}
        {plan.action === "manage" && (
          <>
            <span>·</span>
            <ManageLink />
          </>
        )}
      </span>,
    );
  }
  parts.push(<span key="since">{F.memberSince(memberSince)}</span>);
  if (hands !== null) {
    parts.push(
      <span key="hands" className="tabular-nums">
        {F.hands(hands)}
        {tournaments ? ` · ${F.tournaments(tournaments)}` : ""}
      </span>,
    );
  }
  return (
    <footer className="flex flex-wrap items-baseline gap-x-5 gap-y-1.5 border-t border-border/40 pt-4 text-xs text-muted-foreground">
      {parts}
    </footer>
  );
}
