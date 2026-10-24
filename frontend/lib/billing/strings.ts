import { PRO_PRICE_LABEL } from "./entitlements";

/**
 * User-facing copy for the trial notices and the /checkout hand-off page.
 * One file so it can be reviewed (and later translated) in one place.
 */

export const TRIAL = {
  /** "Your Pro trial ends in 3 days" / "… ends tomorrow" / "… ends today" */
  endingTitle: (days: number) =>
    days <= 0 ? "Your Pro trial ends today" : days === 1 ? "Your Pro trial ends tomorrow" : `Your Pro trial ends in ${days} days`,
  endingBody: `Keep unlimited trainer hands, tournaments, AI Coach and the Flop Explorer for ${PRO_PRICE_LABEL}/month. Cancel anytime.`,
  endingCta: "Keep Pro",
  endedTitle: "Your Pro trial has ended",
  endedBody: `Upgrade to Pro for ${PRO_PRICE_LABEL}/mo: unlimited hands, tournaments, AI Coach and the Flop Explorer.`,
  endedCta: "Upgrade to Pro",
  dismiss: "Dismiss for today",
};

export const CHECKOUT = {
  title: "Upgrade to Pro",
  opening: "Opening secure checkout…",
  plan: `Pro · ${PRO_PRICE_LABEL}/month · VAT included · cancel anytime`,
  signingIn: "Sign in to continue to checkout…",
  alreadyPro: "You already have Pro. Taking you to your dashboard…",
  failed: "We couldn't open checkout.",
  retry: "Try again",
  toPricing: "See plans",
};
