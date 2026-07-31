'use client'

// TEMPORARY manual visual smoke-test route for the seat-label spacing fix —
// NOT part of the app. Deleted after verification.
import { PreflopTable } from '@/components/learn/visuals/PreflopTable'

const scenarios: { title: string; heroPosition: string; actionBeforeHero: string[] }[] = [
  { title: 'CO raise (the reported case)', heroPosition: 'BTN', actionBeforeHero: ['UTG folds', 'HJ folds', 'CO raises to 2.3bb'] },
  { title: 'CO 3-bet', heroPosition: 'BB', actionBeforeHero: ['UTG raises to 2.3bb', 'CO raises to 8bb'] },
  { title: 'CO all-in', heroPosition: 'BTN', actionBeforeHero: ['CO raises all-in to 40bb'] },
  { title: 'CO call', heroPosition: 'BTN', actionBeforeHero: ['UTG raises to 2.3bb', 'CO calls'] },
  { title: 'CO check', heroPosition: 'BTN', actionBeforeHero: ['CO checks'] },
  { title: 'Everyone folds to BTN', heroPosition: 'BTN', actionBeforeHero: ['Everyone folds'] },
]

export default function SeatSpacingSmokeTest() {
  return (
    <div style={{ background: '#0a0a0a', minHeight: '100vh', padding: 24 }}>
      <div style={{ maxWidth: 700, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 40 }}>
        {scenarios.map((s) => (
          <div key={s.title}>
            <p style={{ color: '#aaa', fontSize: 12, marginBottom: 8 }}>{s.title}</p>
            <PreflopTable
              tableSize={9}
              heroPosition={s.heroPosition}
              heroHand={['As', 'Kd']}
              effectiveStackBb={100}
              actionBeforeHero={s.actionBeforeHero}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
