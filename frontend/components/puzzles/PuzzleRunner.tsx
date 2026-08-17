'use client'

import { useCallback, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { PreflopTable } from '@/components/learn/visuals/PreflopTable'
import { CompletionCard } from './CompletionCard'
import { DecisionPanel } from './DecisionPanel'
import { HandHistory, type HistoryLine } from './HandHistory'
import { HandInfo } from './HandInfo'
import { RangeExplorer } from './RangeExplorer'
import { StreetProgress } from './StreetProgress'
import { DIFFICULTY_LABEL, puzzleStreets, type InteractivePuzzle } from '@/lib/puzzles/interactive/types'

/**
 * Puzzle state machine.
 *
 * One decision on screen at a time, answers kept so accuracy can be scored at
 * the end. Deliberately local state with no persistence: this is the playable
 * surface, and wiring it to the XP tables would couple the first puzzle to the
 * progression system before the shape of a puzzle session has settled. The end
 * screen shows the XP the puzzle is worth; awarding it is the next step, not a
 * silent one taken here.
 *
 * LAYOUT: two columns on desktop with the table sticky beside the decision, one
 * column on mobile with the table first. That ordering is why the mobile view
 * doesn't read as a squeezed desktop — on a phone the table is the context you
 * read once and the answer buttons are full-width targets underneath, rather
 * than a shrunken diagram fighting the buttons for the fold.
 */
export function PuzzleRunner({ puzzle }: { puzzle: InteractivePuzzle }) {
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [showTheory, setShowTheory] = useState(false)
  const [complete, setComplete] = useState(false)

  const streets = useMemo(() => puzzleStreets(puzzle), [puzzle])
  const decision = puzzle.decisions[index]
  const chosen = decision ? answers[decision.id] : undefined

  const correct = puzzle.decisions.filter((d) => answers[d.id] === d.bestOptionId).length

  const choose = useCallback(
    (optionId: string) => {
      setAnswers((prev) => (prev[decision.id] ? prev : { ...prev, [decision.id]: optionId }))
    },
    [decision]
  )

  const next = useCallback(() => {
    setShowTheory(false)
    if (index + 1 < puzzle.decisions.length) {
      setIndex(index + 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else {
      setComplete(true)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [index, puzzle.decisions.length])

  const restart = useCallback(() => {
    setIndex(0)
    setAnswers({})
    setShowTheory(false)
    setComplete(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const chosenOption = decision?.options.find((o) => o.id === chosen)

  // The strip shows the authored history up to this decision, plus Hero's own
  // choice once it exists. Built from the CURRENT decision only, so a street the
  // learner hasn't reached can't leak into it.
  //
  // A board-reading puzzle appends nothing: its answers are readings of the
  // board, not actions taken, and writing "BB — pairs the board" into an action
  // strip would put a play in the record that nobody made.
  const historyLines: HistoryLine[] = decision
    ? [
        ...(decision.history ?? []),
        ...(chosenOption && !puzzle.readsTheBoardOnly
          ? [
              {
                street: decision.street,
                actor: puzzle.setup.heroSeat,
                text: chosenOption.historyText ?? chosenOption.label,
                isHero: true,
              },
            ]
          : []),
      ]
    : []

  // The table's correctness badge is deliberately only set for the two
  // unambiguous grades. A 'defensible' answer is a real part of the strategy at
  // lower frequency, and stamping it "incorrect" on the felt would contradict
  // what the theory panel goes on to say two paragraphs later.
  const tableResult =
    chosenOption?.verdict === 'best'
      ? ('correct' as const)
      : chosenOption?.verdict === 'mistake'
        ? ('incorrect' as const)
        : undefined

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <Link
        href="/puzzles"
        className="inline-flex items-center gap-1.5 text-[12px] font-medium text-slate-500 transition-colors hover:text-violet-300"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
        Puzzles
      </Link>

      {/* Header */}
      <header className="mt-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[11px] font-bold text-slate-600">
            #{String(puzzle.number).padStart(2, '0')}
          </span>
          <Badge variant="green" className="uppercase tracking-wider">
            {puzzle.topic}
          </Badge>
          <Badge variant="outline" className="uppercase tracking-wider">
            {DIFFICULTY_LABEL[puzzle.difficulty]}
          </Badge>
          <Badge variant="outline" className="uppercase tracking-wider">
            {puzzle.setup.format}
          </Badge>
        </div>

        <h1 className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-3xl">{puzzle.title}</h1>
        <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-slate-400">{puzzle.description}</p>
      </header>

      <div className="mt-6">
        <StreetProgress
          streets={streets}
          currentIndex={decision ? streets.indexOf(decision.street) : streets.length}
          complete={complete}
        />
      </div>

      {complete ? (
        <div className="mt-6">
          <CompletionCard
            puzzle={puzzle}
            correct={correct}
            total={puzzle.decisions.length}
            answers={answers}
            onRestart={restart}
          />
        </div>
      ) : (
        /* Table on top, actions directly beneath it — the arrangement of a real
           poker client, and the same one every Learn decision step uses. One
           column at every width, so the phone layout is the desktop layout with
           less around it rather than a different screen. */
        <div className="mt-5 space-y-5">
          {/* Table centre, hand info left, action strip right. The side columns
              are narrow and fixed so the felt keeps the width it needs — the
              table is the point of the screen, not an illustration beside the
              text. Below `xl` the sides drop under the table rather than
              squeezing it. */}
          <div className="grid gap-4 xl:grid-cols-[minmax(0,15rem)_minmax(0,1fr)_minmax(0,15rem)] xl:items-start">
            <div className="order-2 space-y-4 xl:order-1">
              <HandInfo puzzle={puzzle} decision={decision} />
            </div>

            <div className="order-1 min-w-0 xl:order-2">
              {/* The canonical Learn table — the same component ConceptReveal,
                  DecisionSpot and TableDecision render, driven by the same
                  action-prose format. Puzzles inherit the lesson table's felt,
                  rail, seats, dealer button, chips and pot rather than getting a
                  second near-identical implementation that would drift from it. */}
              <PreflopTable
                tableSize={puzzle.setup.tableSize}
                heroPosition={puzzle.setup.heroSeat}
                heroHand={puzzle.setup.heroCards}
                // Per-DECISION, not per-puzzle: each street's figure is the stack
                // at the start of that street, which is exactly what the table's
                // "N bb behind" arithmetic subtracts this street's chips from.
                effectiveStackBb={decision.effectiveStackBb}
                // A tournament pot contains dead money before anyone acts, and
                // the table derives the pot from the action rather than being
                // told it. Without this the felt would show a 9-max MTT pot
                // 1.125bb light and quietly misprice every defence in it.
                anteBb={puzzle.setup.anteBb}
                actionBeforeHero={decision.actionBeforeHero}
                board={decision.board.length > 0 ? decision.board : undefined}
                postflopAction={decision.postflopAction}
                street={decision.street === 'preflop' ? undefined : decision.street}
                potBb={decision.potBb}
                // Everything earlier streets built. The table derives this from
                // the preflop line alone, which is right on a flop and wrong from
                // the turn on — by then the flop's chips are dead money it never
                // saw. potBb minus the bet currently faced is that number.
                deadPotBb={decision.potBb - (decision.facingBetBb ?? 0)}
                heroAction={chosenOption?.tableAction}
                result={tableResult}
              />
            </div>

            <div className="order-3 space-y-4">
              <HandHistory lines={historyLines} />
            </div>
          </div>

          <div className="mx-auto w-full max-w-3xl space-y-5">
            <DecisionPanel
              decision={decision}
              chosen={chosen}
              showTheory={showTheory}
              onChoose={choose}
              onToggleTheory={() => setShowTheory((v) => !v)}
              onNext={next}
              nextLabel={index + 1 < puzzle.decisions.length ? 'Continue' : 'Finish hand'}
            />

            <RangeExplorer ranges={puzzle.ranges} heroHand={puzzle.setup.heroCards} />
          </div>
        </div>
      )}
    </div>
  )
}
