/**
 * Homepage FAQ — one list for the visible accordion (components/home/Closing.tsx)
 * and the FAQPage structured data (app/page.tsx), so the two never differ.
 */
export const FAQ: { q: string; a: string }[] = [
  { q: "Is it really free?", a: "Yes. The free plan never expires and needs no credit card: the preflop trainer, hand-history review, the AI coach (3 messages a day), XP and the leaderboard. Paid plans unlock more." },
  { q: "Which poker sites can I import hand histories from?", a: "GGPoker and PokerStars tournaments: the PokerCraft export from GGPoker (the .zip file or the .txt files inside it), and the .txt files PokerStars saves automatically. Cash games aren't supported yet." },
  { q: "Is this a solver?", a: "No. The trainer grades you against published preflop ranges, and the replayer computes exact equity and pot odds. StackedPoker doesn't run a solver on your hands." },
  { q: "Is this gambling?", a: "No. StackedPoker is an educational tool only. There is no real-money play and no betting of any kind." },
  { q: "Can I cancel anytime?", a: "Yes. Paid plans are monthly and you can cancel whenever you like from your account." },
  { q: "Does it work on mobile?", a: "Yes. The trainer, the hand list and the replayer are built for phones as well as desktop." },
];
