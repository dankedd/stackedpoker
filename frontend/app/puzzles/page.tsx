import type { Metadata } from 'next'
import Link from 'next/link'
import { BookOpen, ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { PlayingCard } from '@/components/poker/PlayingCard'
import { PUZZLES } from '@/lib/puzzles/interactive/data'
import { DIFFICULTY_LABEL, puzzleStreets, STREET_LABEL } from '@/lib/puzzles/interactive/types'

export const metadata: Metadata = {
  title: 'Poker Puzzles — Play a hand, learn why | Stacked',
  description:
    'Play real poker hands one decision at a time. Every answer is explained from Modern Poker Theory, with the ranges, frequencies and page references behind it.',
}

export default function PuzzlesPage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Puzzles</h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-slate-400">
          Play a hand one decision at a time. You choose, then you find out why — with the ranges,
          frequencies and sourcing behind every answer, and a plain statement wherever the theory
          runs out.
        </p>
        <p className="mt-4 inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[12px] text-slate-400">
          <BookOpen className="h-3.5 w-3.5 shrink-0 text-violet-400" aria-hidden />
          Every frequency and range cites Modern Poker Theory by page.
        </p>
      </header>

      <ul className="mt-9 space-y-3">
        {PUZZLES.map((puzzle) => {
          const streets = puzzleStreets(puzzle)
          return (
            <li key={puzzle.id}>
              <Link
                href={`/puzzles/${puzzle.slug}`}
                className="group flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.02] p-5 transition-all duration-150 hover:border-violet-500/40 hover:bg-violet-500/[0.05] sm:flex-row sm:items-center sm:gap-6"
              >
                <div className="flex shrink-0 items-center gap-3">
                  <span className="font-mono text-[11px] font-bold text-slate-600">
                    #{String(puzzle.number).padStart(2, '0')}
                  </span>
                  <div className="flex gap-1.5">
                    {puzzle.setup.heroCards.map((c) => (
                      <PlayingCard key={c} card={c} size="sm" />
                    ))}
                  </div>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
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

                  <h2 className="mt-2.5 text-[17px] font-bold text-white transition-colors group-hover:text-violet-200">
                    {puzzle.title}
                  </h2>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-slate-400">{puzzle.description}</p>

                  <p className="mt-3 text-[11px] text-slate-600">
                    {puzzle.setup.heroSeat} vs {puzzle.setup.villainSeat}
                    <span aria-hidden> · </span>
                    {streets.map((s) => STREET_LABEL[s]).join(' → ')}
                    <span aria-hidden> · </span>
                    {puzzle.decisions.length}{' '}
                    {puzzle.decisions.length === 1 ? 'decision' : 'decisions'}
                    <span aria-hidden> · </span>+{puzzle.xp} XP
                  </p>
                </div>

                <ChevronRight
                  className="hidden h-5 w-5 shrink-0 text-slate-600 transition-colors group-hover:text-violet-400 sm:block"
                  aria-hidden
                />
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
