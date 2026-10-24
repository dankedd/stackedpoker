"use client";

import { canUseFeature } from "@/lib/features";
import { useSubscription } from "./useSubscription";

/** Client-side gate for social UI (lib/features.ts "social"). */
export function useSocialEnabled(): boolean {
  const { subscription } = useSubscription();
  return canUseFeature("social", subscription?.tier);
}
