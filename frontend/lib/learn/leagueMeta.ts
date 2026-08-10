import type { AssessmentLeague, AssessmentTopic } from './assessmentQuestions'

// Shared display metadata for skill leagues — used by the onboarding results
// screen, the fast-track choice, and the dashboard widget. Deliberately its
// own color scale (emerald/blue/violet/amber/rose), never reusing PlanBadge's
// Free/Plus/Elite styling — skill league and subscription tier are unrelated
// axes and must never look like the same concept.
export const LEAGUE_META: Record<AssessmentLeague, { label: string; emoji: string; classes: string }> = {
  foundation: { label: 'Foundation', emoji: '🟢', classes: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' },
  intermediate: { label: 'Intermediate', emoji: '🔵', classes: 'border-blue-500/30 bg-blue-500/10 text-blue-300' },
  advanced: { label: 'Advanced', emoji: '🟣', classes: 'border-violet-500/30 bg-violet-500/10 text-violet-300' },
  expert: { label: 'Expert', emoji: '🟠', classes: 'border-amber-500/30 bg-amber-500/10 text-amber-300' },
  master: { label: 'Master', emoji: '🔴', classes: 'border-rose-500/30 bg-rose-500/10 text-rose-300' },
}

export const LEAGUE_ORDER: AssessmentLeague[] = ['foundation', 'intermediate', 'advanced', 'expert', 'master']

const TOPIC_LABELS: Record<AssessmentTopic, string> = {
  hand_rankings: 'Hand Rankings',
  positions: 'Table Positions',
  betting_order: 'Betting Order',
  opening_ranges: 'Opening Ranges',
  position_advantage: 'Position Advantage',
  pot_odds: 'Pot Odds',
  range_advantage: 'Range Advantage',
  continuation_betting: 'Continuation Betting',
  equity_realization: 'Equity Realization',
  blockers: 'Blockers',
  polarization: 'Polarization',
  range_construction: 'Range Construction',
  multi_street_ranges: 'Multi-Street Ranges',
  delayed_cbets: 'Delayed C-Bets',
  range_protection: 'Range Protection',
  bluff_selection: 'Bluff Selection',
  elite_board_analysis: 'Elite Board Analysis',
}

export function topicLabel(topic: AssessmentTopic): string {
  return TOPIC_LABELS[topic] ?? topic.replace(/_/g, ' ')
}
