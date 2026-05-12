export type ActionQuality = 'perfect' | 'good' | 'acceptable' | 'mistake' | 'punt'
export type Difficulty = 'beginner' | 'intermediate' | 'advanced' | 'expert'

export interface ActionOption {
  id: string
  label: string
  quality: ActionQuality
  evLoss: number   // in BBs, 0 for perfect
  coaching: string
}

export interface PuzzleStep {
  street: 'preflop' | 'flop' | 'turn' | 'river'
  board: string[]   // cumulative board cards at start of this step
  context: string   // what just happened before hero acts
  prompt: string
  options: ActionOption[]
}

export interface Puzzle {
  id: string
  title: string
  description: string
  difficulty: Difficulty
  category: string
  gameType: 'cash' | 'tournament'
  format: string
  heroPosition: string
  villainPosition: string
  heroCards: string[]
  effectiveStack: number  // in BB
  stakes: string
  steps: PuzzleStep[]
  summary: string
  tags: string[]
}

export const QUALITY_SCORE: Record<ActionQuality, number> = {
  perfect:    100,
  good:        80,
  acceptable:  60,
  mistake:     30,
  punt:         0,
}
