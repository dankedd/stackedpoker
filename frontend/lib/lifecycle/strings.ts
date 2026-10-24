/**
 * Every user-facing line of the retention features: lifecycle emails, the
 * unsubscribe page, the streak and the daily-progress strip. One file so the
 * copy can be reviewed (and later translated) in one place.
 */

export const FOUNDER_NAME = "Manuel";
export const BRAND = "Stacked Poker";

const plural = (n: number, one: string, many: string) => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;

export const STREAK = {
  /** "🔥 3-day streak" */
  badge: (n: number) => `🔥 ${n}-day streak`,
  /** Day 1 (streak 0 or 1): the first day of a streak. */
  start: "Start your streak — come back tomorrow.",
  startNone: "Play a spot to start your streak.",
  keepToday: "Play one spot today to keep it.",
  doneToday: "Today counts. See you tomorrow.",
};

export const DAILY = {
  /** "Today: 12/50 spots done" or "Today: 12 spots done" (no limit). */
  today: (used: number, limit: number | null) =>
    limit === null ? `Today: ${plural(used, "spot", "spots")} done` : `Today: ${Math.min(used, limit)}/${limit} spots done`,
  limitTitle: (max: number) => `You've done today's ${max} spots 🔥`,
  limitBody: "Nice work. Come back tomorrow for a new set, or keep drilling now with Pro.",
  unlocksIn: "New spots unlock in",
  /** "at 00:00 your time" */
  unlocksAt: (clock: string) => `at ${clock} your time`,
  comeBack: "Come back tomorrow",
};

export const EMAIL = {
  greeting: (name: string | null) => (name ? `Hi ${name},` : "Hi there,"),
  footerWhy: `You're getting this because you created a ${BRAND} account.`,
  unsubscribe: "Unsubscribe",
  settings: "email settings",

  day1: {
    subject: (streak: number) => (streak > 0 ? `Don't lose your ${streak}-day streak 🔥` : "Today's preflop spots are ready"),
    preheader: (spot: string) => `${spot} What's your play?`,
    intro: "Today's preflop spots are ready. Here's one to warm up with:",
    cta: "Play today's spots",
    after: "Every spot is graded against the full range, with the exact frequencies shown.",
  },

  day3: {
    subject: (hands: number, weakest: string | null) =>
      hands === 0 ? "Your first preflop spot is waiting" : weakest ? `Your weakest spot: ${weakest}` : `You've answered ${plural(hands, "hand", "hands")} so far`,
    preheader: (hands: number, accuracy: number | null) =>
      hands === 0 ? "One spot takes about ten seconds." : `${plural(hands, "hand", "hands")} answered${accuracy !== null ? `, ${accuracy}% accuracy` : ""}.`,
    introNone: "You haven't played a spot yet. One takes about ten seconds, and your progress builds from there.",
    intro: "Here's where you stand in the Preflop Trainer:",
    handsLabel: "Hands answered",
    accuracyLabel: "Accuracy",
    accuracyNote: "Correct or mixed answers, as a share of all hands.",
    weakest: (label: string, wrong: number, total: number) => `Your weakest spot: ${label} (${wrong} of ${total} wrong).`,
    noWeakest: "Play a few more hands and we'll show you your weakest spot.",
    cta: (hasWeakest: boolean) => (hasWeakest ? "Train your weakest spot" : "Back to the trainer"),
  },

  day7: {
    subject: "What was missing?",
    preheader: `Hey, ${FOUNDER_NAME} here — one quick question.`,
    lines: (name: string | null, hands: number) => [
      `Hey${name ? ` ${name}` : ""}, ${FOUNDER_NAME} here — I'm building ${BRAND}.`,
      hands > 0
        ? `You signed up last week and played ${plural(hands, "hand", "hands")} in the Preflop Trainer, but you haven't been back since.`
        : "You signed up last week but haven't been back since.",
      "What was missing? Just hit reply — one line is plenty. I read every answer myself.",
    ],
    signoff: `— ${FOUNDER_NAME}`,
    ps: "This is the last email of this kind. If you'd still like reminders later, you can turn them on any time.",
  },

  trialEnding: {
    /** "in 2 days" / "tomorrow" / "today" */
    when: (days: number) => (days <= 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`),
    subject: (when: string) => `Your Pro trial ends ${when}`,
    preheader: (price: string) => `Keep unlimited training and the Flop Explorer for ${price}/month.`,
    intro: (when: string, date: string) => `Your 7-day Pro trial ends ${when} (${date}). Here's what Pro gives you:`,
    perks: [
      "Unlimited Preflop and Flop Trainer hands",
      "The Flop Explorer: all 1,755 flops, hand by hand",
      "Unlimited tournament uploads and your full history",
      "Unlimited AI Coach questions",
    ],
    after: "After the trial you move to Free automatically. Your XP, streak and uploads stay, with daily limits on hands and questions.",
    cta: (price: string) => `Keep Pro for ${price}/month`,
    fine: "VAT included. Cancel anytime. Payments by Stripe.",
  },

  /** Streak line inside the day-1 and day-3 emails. */
  streak: (streak: number) =>
    streak > 0
      ? `🔥 You're on a ${streak}-day streak. Don't lose it — play one spot today.`
      : "🔥 Start a streak today — one spot is enough.",
};

export const UNSUBSCRIBE = {
  doneTitle: "You're unsubscribed",
  doneBody: "You won't get training reminders from us any more. Account emails (password resets, receipts) still arrive.",
  resubscribe: "Resubscribe",
  resubscribedTitle: "You're subscribed again",
  resubscribedBody: "Training reminders are back on. You can change this any time in your settings.",
  invalidTitle: "This link doesn't work",
  invalidBody: "It may be incomplete. You can turn reminders off in your settings instead.",
  toSettings: "Go to settings",
  home: "Back to Stacked Poker",
};

export const SETTINGS = {
  title: "Email",
  label: "Training reminders",
  help: "Occasional emails with a spot to play and your progress. Never more than a few in your first week.",
  saved: "Saved",
  error: "Could not save. Please try again.",
};

export const SIGNUP_NOTICE = "We'll send you occasional training reminders. Unsubscribe anytime.";
