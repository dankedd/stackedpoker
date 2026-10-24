"use client";

import { useManageSubscription } from "@/hooks/useManageSubscription";
import { DASH } from "@/lib/dashboard/strings";

/** The footer's "Manage": Stripe's billing portal, as a text link. */
export function ManageLink() {
  const { handleManage, loading, error } = useManageSubscription();
  return (
    <button
      type="button"
      onClick={() => void handleManage()}
      disabled={loading}
      title={error ?? undefined}
      className="font-semibold text-violet-300 hover:text-violet-200 disabled:opacity-60"
    >
      {DASH.footer.manage}
    </button>
  );
}
