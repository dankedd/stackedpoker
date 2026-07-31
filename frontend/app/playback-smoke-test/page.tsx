'use client'

// TEMPORARY manual smoke-test route for the Action Playback Engine — NOT part
// of the app. Deleted after verification.
import { PreflopTable } from '@/components/learn/visuals/PreflopTable'

export default function PlaybackSmokePage() {
  return (
    <div style={{ background: '#0a0a0a', minHeight: '100vh', padding: 40 }}>
      <div style={{ maxWidth: 700, margin: '0 auto' }}>
        <PreflopTable
          tableSize={9}
          heroPosition="BTN"
          heroHand={['As', 'Kd']}
          effectiveStackBb={100}
          actionBeforeHero={['UTG folds', 'HJ folds', 'CO raises to 2.3bb']}
        />
      </div>
    </div>
  )
}
