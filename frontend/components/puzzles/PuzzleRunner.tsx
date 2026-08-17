'use client'

import { useCallback, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { PreflopTable } from '@/components/learn/visuals/PreflopTable'
import { CompletionCard } from './CompletionCard'
import { DecisionPanel } from './DecisionPanel'
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
            onRestart={restart}
          />
        </div>
      ) : (
        /* Table on top, actions directly beneath it — the arrangement of a real
           poker client, and the same one every Learn decision step uses. One
           column at every width, so the phone layout is the desktop layout with
           less around it rather than a different screen. */
        <div className="mt-6 space-y-5">
          <div className="mx-auto w-full max-w-2xl">
            {/* The canonical Learn table — the same component ConceptReveal,
                DecisionSpot and TableDecision render, driven by the same
                action-prose format. Puzzles inherit the lesson table's felt,
                rail, seats, dealer button, chips and pot rather than getting a
                second near-identical implementation that would drift from it. */}
            <PreflopTable
              tableSize={puzzle.setup.tableSize}
              heroPosition={puzzle.setup.heroSeat}
              heroHand={puzzle.setup.heroCards}
              effectiveStackBb={puzzle.setup.effectiveStackBb}
              actionBeforeHero={decision.actionBeforeHero}
              board={decision.board.length > 0 ? decision.board : undefined}
              postflopAction={decision.postflopAction}
              street={decision.street === 'preflop' ? undefined : decision.street}
              potBb={decision.potBb}
              heroAction={chosenOption?.tableAction}
              result={tableResult}
            />
            <p className="mt-2 text-center text-[11px] leading-relaxed text-slate-600">
              {puzzle.setup.gameNotes}
            </p>
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

            <RangeExplorer ranges={puzzle.ranges} />
          </div>
        </div>
      )}
    </div>
  )
}
