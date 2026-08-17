import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PuzzleRunner } from '@/components/puzzles/PuzzleRunner'
import { PUZZLES, getPuzzle } from '@/lib/puzzles/interactive/data'

export function generateStaticParams() {
  return PUZZLES.map((p) => ({ slug: p.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const puzzle = getPuzzle(slug)
  if (!puzzle) return { title: 'Puzzle not found | Stacked' }

  return {
    title: `${puzzle.title} — ${puzzle.topic} puzzle | Stacked`,
    description: puzzle.description,
  }
}

export default async function PuzzlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const puzzle = getPuzzle(slug)
  if (!puzzle) notFound()

  return <PuzzleRunner puzzle={puzzle} />
}
