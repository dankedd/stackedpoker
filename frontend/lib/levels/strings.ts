/** Copy for levels, the level card and the level-up moment. */

export const LEVELS = {
  heading: "Your level",
  level: (n: number) => `Level ${n}`,
  short: (n: number) => `Lv ${n}`,
  badgeLabel: (n: number, title: string) => `Level ${n}, ${title}`,
  progress: (current: number, needed: number) => `${current.toLocaleString("en-US")} / ${needed.toLocaleString("en-US")} XP`,
  toNext: (xp: number, next: number) => `${xp.toLocaleString("en-US")} XP to level ${next}`,
  maxLevel: "Max level. Prestige comes later.",
  totalXp: "Total XP",
  preflop: "Preflop trainer",
  flop: "Flop trainer",
  bonuses: (streak: number, review: number) =>
    [streak > 0 && `${streak.toLocaleString("en-US")} XP streak bonus`, review > 0 && `${review.toLocaleString("en-US")} XP hand review`]
      .filter(Boolean)
      .join(" · "),
  today: (xp: number, cap: number) => `Today ${xp}/${cap} trainer XP`,
  streakBonus: (minDays: number, percent: number) => `${minDays}+ day streak: +${percent}% XP`,
  streakBonusOn: (percent: number) => `Streak bonus active: +${percent}% XP`,
  train: "Train to level up",
  notice:
    "We've rebalanced levels around the trainers. Your XP now reflects trainer and hand-review progress.",
  dismiss: "Dismiss",
  newTitle: "New title",
  reached: (title: string) => `You're a ${title} now.`,
  bonusChip: (xp: number) => `+${xp} streak bonus`,
};
