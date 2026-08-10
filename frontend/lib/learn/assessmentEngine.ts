import {
  ASSESSMENT_QUESTIONS,
  FINAL_CHALLENGE_QUESTIONS,
  type AssessmentQuestion,
  type AssessmentDifficulty,
  type AssessmentTopic,
  type AssessmentLeague,
} from './assessmentQuestions'

// ── Adaptive skill-assessment engine ────────────────────────────────────────
// A deliberately simple staircase (not IRT/Elo) — explainable to the learner
// as "questions get harder when you're right, easier when you're wrong."
// Pure functions over a small state object; no network/React dependency, so
// it can be unit-tested and reused by both the onboarding quiz and the
// Foundation Final Challenge fast-track screen.

const REGULAR_POOL = ASSESSMENT_QUESTIONS.filter(q => !q.isFinalChallenge)

const MIN_QUESTIONS = 8
const MAX_QUESTIONS = 12
const SETTLE_WINDOW = 3 // stop early once the last N answers sat at one difficulty

export interface AssessmentTraceEntry {
  questionId: string
  difficulty: AssessmentDifficulty
  topic: AssessmentTopic
  correct: boolean
}

export interface AssessmentEngineState {
  currentDifficulty: AssessmentDifficulty
  askedIds: string[]
  lastTopic: AssessmentTopic | null
  trace: AssessmentTraceEntry[]
}

export function createInitialState(): AssessmentEngineState {
  return { currentDifficulty: 1, askedIds: [], lastTopic: null, trace: [] }
}

/** Next question at the current difficulty, avoiding already-asked questions
 *  and (when possible) the topic just asked, so consecutive questions rarely
 *  repeat a topic. Returns null once the pool at this difficulty is exhausted
 *  (stop condition should be checked first in normal use). */
export function pickNextQuestion(state: AssessmentEngineState): AssessmentQuestion | null {
  const askedSet = new Set(state.askedIds)
  const candidates = REGULAR_POOL.filter(
    q => q.difficulty === state.currentDifficulty && !askedSet.has(q.id),
  )
  if (candidates.length === 0) return null

  const differentTopic = candidates.filter(q => q.topic !== state.lastTopic)
  const pool = differentTopic.length > 0 ? differentTopic : candidates
  return pool[Math.floor(Math.random() * pool.length)]
}

/** Applies one answered question to the state, moving difficulty up on a
 *  correct answer (capped at 4) and down on an incorrect one (floored at 1). */
export function recordAnswer(
  state: AssessmentEngineState,
  question: AssessmentQuestion,
  correct: boolean,
): AssessmentEngineState {
  const trace = [
    ...state.trace,
    { questionId: question.id, difficulty: question.difficulty, topic: question.topic, correct },
  ]
  const nextDifficulty = clampDifficulty(
    (question.difficulty + (correct ? 1 : -1)) as AssessmentDifficulty,
  )
  return {
    currentDifficulty: nextDifficulty,
    askedIds: [...state.askedIds, question.id],
    lastTopic: question.topic,
    trace,
  }
}

function clampDifficulty(d: AssessmentDifficulty): AssessmentDifficulty {
  if (d < 1) return 1
  if (d > 4) return 4
  return d
}

/** Hard cap at 12; earlier stop once >=8 asked and the ladder has "settled"
 *  — the last 3 questions were all answered at the same difficulty (no flip). */
export function shouldStop(state: AssessmentEngineState): boolean {
  if (state.trace.length >= MAX_QUESTIONS) return true
  if (state.trace.length < MIN_QUESTIONS) return false
  const recent = state.trace.slice(-SETTLE_WINDOW)
  if (recent.length < SETTLE_WINDOW) return false
  return recent.every(t => t.difficulty === recent[0].difficulty)
}

/** Offered only to learners who have been correct on every question so far
 *  and have climbed to the top of the regular ladder. */
export function shouldOfferFinalChallenge(state: AssessmentEngineState): boolean {
  return state.currentDifficulty === 4 && state.trace.length > 0 && state.trace.every(t => t.correct)
}

export function pickFinalChallengeQuestions(): AssessmentQuestion[] {
  const shuffled = [...FINAL_CHALLENGE_QUESTIONS].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, 2)
}

// ── Results computation ─────────────────────────────────────────────────────

export interface AssessmentResults {
  estimatedLeague: AssessmentLeague
  assessmentScore: number // 0-100, correct/answered
  strongestTopics: AssessmentTopic[]
  weakestTopics: AssessmentTopic[]
  estimatedStudyHours: number
  recommendedModuleId: string
}

const STUDY_HOURS_BY_LEAGUE: Record<AssessmentLeague, number> = {
  foundation: 0,
  intermediate: 3,
  advanced: 8,
  expert: 15,
  master: 20,
}

// Real curriculum.ts module slugs (confirmed present), ordered by roughly
// increasing prerequisite depth — not a book-sourced claim, just a
// reasonable on-ramp per league, same as estimated_study_hours.
const RECOMMENDED_MODULE_BY_LEAGUE: Record<AssessmentLeague, string> = {
  foundation: 'poker-fundamentals-module',
  intermediate: 'preflop-foundation-module',
  advanced: 'cbetting-fundamentals-module',
  expert: 'game-theory-foundations-module',
  master: 'bet-sizing-language-module',
}

/** Deterministic lookup table, not a hidden formula — kept explainable.
 *  `finalChallengePassed` is undefined when the Final Challenge was never
 *  offered/taken. */
export function computeLeague(
  trace: AssessmentTraceEntry[],
  finalChallengePassed: boolean | undefined,
): AssessmentLeague {
  const maxDifficulty = trace.reduce<number>((max, t) => Math.max(max, t.difficulty), 1) as AssessmentDifficulty
  const accuracy = trace.length > 0 ? trace.filter(t => t.correct).length / trace.length : 0

  if (finalChallengePassed) return 'master'
  if (maxDifficulty <= 1 || accuracy < 0.6) return 'foundation'
  if (maxDifficulty === 2) return 'intermediate'
  if (maxDifficulty === 3) return 'advanced'
  return 'expert' // maxDifficulty === 4, Final Challenge not offered or not passed
}

export function computeResults(
  trace: AssessmentTraceEntry[],
  finalChallengePassed: boolean | undefined,
): AssessmentResults {
  const estimatedLeague = computeLeague(trace, finalChallengePassed)
  const correctCount = trace.filter(t => t.correct).length
  const assessmentScore = trace.length > 0 ? Math.round((100 * correctCount) / trace.length) : 0

  const byTopic = new Map<AssessmentTopic, { attempts: number; correct: number }>()
  for (const t of trace) {
    const entry = byTopic.get(t.topic) ?? { attempts: 0, correct: 0 }
    entry.attempts += 1
    if (t.correct) entry.correct += 1
    byTopic.set(t.topic, entry)
  }

  const strongestTopics: AssessmentTopic[] = []
  const weakestTopics: { topic: AssessmentTopic; accuracy: number }[] = []
  for (const [topic, { attempts, correct }] of byTopic) {
    if (correct === attempts) strongestTopics.push(topic)
    else weakestTopics.push({ topic, accuracy: correct / attempts })
  }
  weakestTopics.sort((a, b) => a.accuracy - b.accuracy)

  return {
    estimatedLeague,
    assessmentScore,
    strongestTopics: strongestTopics.slice(0, 4),
    weakestTopics: weakestTopics.slice(0, 4).map(w => w.topic),
    estimatedStudyHours: STUDY_HOURS_BY_LEAGUE[estimatedLeague],
    recommendedModuleId: RECOMMENDED_MODULE_BY_LEAGUE[estimatedLeague],
  }
}
