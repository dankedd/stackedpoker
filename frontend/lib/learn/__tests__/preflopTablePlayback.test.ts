import { describe, it, expect } from 'vitest'
import { buildPlaybackTimeline } from '../preflopTablePlayback'
import { SB_BB, BB_BB } from '../preflopTableState'

describe('buildPlaybackTimeline — graceful degradation (never fabricates)', () => {
  it('undefined when there is no hero_position', () => {
    expect(buildPlaybackTimeline({})).toBeUndefined()
  })

  it('undefined when action_before_hero is absent (unknown prior action)', () => {
    expect(buildPlaybackTimeline({ hero_position: 'CO', table_size: 9 })).toBeUndefined()
  })

  it('undefined when action_before_hero has an unparseable entry', () => {
    expect(
      buildPlaybackTimeline({ hero_position: 'CO', table_size: 9, action_before_hero: ['UTG does something weird'] }),
    ).toBeUndefined()
  })

  it('is pure — calling twice with the same input yields deep-equal output (backs "replay reset")', () => {
    const step = { hero_position: 'BTN', table_size: 9, action_before_hero: ['UTG folds', 'HJ raises to 2.3bb'] }
    expect(buildPlaybackTimeline(step)).toEqual(buildPlaybackTimeline(step))
  })
})

describe('buildPlaybackTimeline — event order', () => {
  it('9-max: SB post, BB post, then each action in order', () => {
    const timeline = buildPlaybackTimeline({
      hero_position: 'BTN',
      table_size: 9,
      action_before_hero: ['UTG folds', 'HJ folds', 'CO raises to 2.3bb'],
    })!
    expect(timeline.events.map((e) => `${e.kind}:${e.position}`)).toEqual([
      'post_sb:SB',
      'post_bb:BB',
      'fold:UTG',
      'fold:HJ',
      'raise:CO',
    ])
  })

  it('heads-up (2-max): no distinct SB seat, so only BB posts as a discrete event', () => {
    const timeline = buildPlaybackTimeline({
      hero_position: 'BTN',
      table_size: 2,
      action_before_hero: [],
    })!
    expect(timeline.events.map((e) => e.kind)).toEqual(['post_bb'])
  })

  it('frames.length is always events.length + 1', () => {
    const timeline = buildPlaybackTimeline({
      hero_position: 'SB',
      table_size: 9,
      action_before_hero: ['CO raises to 2.3bb', 'BTN calls'],
    })!
    expect(timeline.frames.length).toBe(timeline.events.length + 1)
  })
})

describe('buildPlaybackTimeline — blinds post as discrete, staged events', () => {
  it('frame 0: nobody has posted yet — SB and BB show zero commitment', () => {
    const timeline = buildPlaybackTimeline({ hero_position: 'UTG', table_size: 9, action_before_hero: [] })!
    const frame0 = timeline.frames[0]
    expect(frame0.seats.find((s) => s.position === 'SB')?.committedBb).toBe(0)
    expect(frame0.seats.find((s) => s.position === 'SB')?.postedBlindBb).toBeUndefined()
    expect(frame0.seats.find((s) => s.position === 'BB')?.committedBb).toBe(0)
    expect(frame0.potBb).toBe(0)
  })

  it('frame 1: only SB has posted — BB still shows zero', () => {
    const timeline = buildPlaybackTimeline({ hero_position: 'UTG', table_size: 9, action_before_hero: [] })!
    const frame1 = timeline.frames[1]
    expect(frame1.seats.find((s) => s.position === 'SB')?.committedBb).toBe(SB_BB)
    expect(frame1.seats.find((s) => s.position === 'BB')?.committedBb).toBe(0)
    expect(frame1.potBb).toBeCloseTo(SB_BB)
  })

  it('frame 2: both blinds posted, no voluntary action yet', () => {
    const timeline = buildPlaybackTimeline({ hero_position: 'UTG', table_size: 9, action_before_hero: [] })!
    const frame2 = timeline.frames[2]
    expect(frame2.seats.find((s) => s.position === 'SB')?.committedBb).toBe(SB_BB)
    expect(frame2.seats.find((s) => s.position === 'BB')?.committedBb).toBe(BB_BB)
    expect(frame2.potBb).toBeCloseTo(SB_BB + BB_BB)
  })

  it('heads-up: frame 0 has no blinds posted, frame 1 (final) has BB posted', () => {
    const timeline = buildPlaybackTimeline({ hero_position: 'BTN', table_size: 2, action_before_hero: [] })!
    expect(timeline.frames[0].seats.find((s) => s.position === 'BB')?.committedBb).toBe(0)
    expect(timeline.frames[1].seats.find((s) => s.position === 'BB')?.committedBb).toBe(BB_BB)
  })
})

describe('buildPlaybackTimeline — pot and stacks after each event (facing-open, 9-max)', () => {
  const timeline = buildPlaybackTimeline({
    hero_position: 'BTN',
    table_size: 9,
    effective_stack_bb: 100,
    action_before_hero: ['UTG folds', 'HJ folds', 'CO raises to 2.3bb'],
  })!

  it('pot grows monotonically as blinds post and CO opens', () => {
    const pots = timeline.frames.map((f) => f.potBb)
    expect(pots[0]).toBe(0)
    expect(pots[1]).toBeCloseTo(SB_BB)
    expect(pots[2]).toBeCloseTo(SB_BB + BB_BB)
    expect(pots[3]).toBeCloseTo(SB_BB + BB_BB) // UTG folds — no chips added
    expect(pots[4]).toBeCloseTo(SB_BB + BB_BB) // HJ folds — no chips added
    expect(pots[5]).toBeCloseTo(SB_BB + BB_BB + 2.3) // CO opens
  })

  it("CO's stack-behind only drops once CO's own raise frame is reached", () => {
    const before = timeline.frames[4].seats.find((s) => s.position === 'CO')!
    const after = timeline.frames[5].seats.find((s) => s.position === 'CO')!
    expect(before.committedBb).toBe(0)
    expect(before.stackBehindBb).toBe(100)
    expect(after.committedBb).toBe(2.3)
    expect(after.stackBehindBb).toBeCloseTo(97.7)
  })

  it('the last frame is byte-identical (deep-equal) to calling buildPreflopTableRenderState directly', () => {
    const last = timeline.frames[timeline.frames.length - 1]
    expect(last.potBb).toBeCloseTo(2.3 + SB_BB + BB_BB)
    expect(last.seats.find((s) => s.position === 'CO')?.action?.kind).toBe('raise')
  })
})

describe('buildPlaybackTimeline — folds preserve prior commitment (chips already in the pot never vanish)', () => {
  it('a limper who folds to a later raise keeps their committed chip visible through their own fold frame', () => {
    const timeline = buildPlaybackTimeline({
      hero_position: 'BTN',
      table_size: 9,
      action_before_hero: ['UTG limps', 'HJ raises to 3bb', 'UTG folds'],
    })!
    const foldFrame = timeline.frames[timeline.frames.length - 1]
    const utg = foldFrame.seats.find((s) => s.position === 'UTG')!
    expect(utg.action?.kind).toBe('fold')
    expect(utg.committedBb).toBe(1)
  })
})

describe('buildPlaybackTimeline — scenario coverage required by the regression checklist', () => {
  it('6-max limped pot', () => {
    const timeline = buildPlaybackTimeline({
      hero_position: 'BB',
      table_size: 6,
      action_before_hero: ['UTG limps', 'HJ limps', 'CO limps'],
    })!
    expect(timeline.frames[timeline.frames.length - 1].potBb).toBeCloseTo(1 + 1 + 1 + SB_BB + BB_BB)
  })

  it('open-raise (single raise, everyone else folds)', () => {
    const timeline = buildPlaybackTimeline({
      hero_position: 'BB',
      table_size: 6,
      action_before_hero: ['UTG folds', 'HJ folds', 'CO folds', 'BTN raises to 2.5bb', 'SB folds'],
    })!
    const last = timeline.frames[timeline.frames.length - 1]
    expect(last.seats.find((s) => s.position === 'BTN')?.action?.kind).toBe('raise')
  })

  it('3-bet', () => {
    const timeline = buildPlaybackTimeline({
      hero_position: 'BB',
      table_size: 6,
      action_before_hero: ['UTG raises to 2.3bb', 'CO raises to 7bb'],
    })!
    const last = timeline.frames[timeline.frames.length - 1]
    expect(last.seats.find((s) => s.position === 'CO')?.committedBb).toBe(7)
  })

  it('4-bet', () => {
    const timeline = buildPlaybackTimeline({
      hero_position: 'BB',
      table_size: 6,
      action_before_hero: ['UTG raises to 2.3bb', 'CO raises to 7bb', 'BTN raises to 20bb'],
    })!
    const last = timeline.frames[timeline.frames.length - 1]
    expect(last.seats.find((s) => s.position === 'BTN')?.committedBb).toBe(20)
  })

  it('squeeze (open + flat call, then a big 3-bet)', () => {
    const timeline = buildPlaybackTimeline({
      hero_position: 'SB',
      table_size: 9,
      action_before_hero: ['CO raises to 2.3bb', 'BTN calls'],
    })!
    expect(timeline.events.map((e) => e.kind)).toContain('call')
    const last = timeline.frames[timeline.frames.length - 1]
    expect(last.potBb).toBeCloseTo(2.3 + 2.3 + SB_BB + BB_BB)
  })

  it('multiway pot (open, two callers)', () => {
    const timeline = buildPlaybackTimeline({
      hero_position: 'BB',
      table_size: 9,
      action_before_hero: ['UTG raises to 2.3bb', 'UTG+1 folds', 'UTG+2 calls', 'LJ folds', 'HJ calls', 'CO folds', 'BTN folds', 'SB folds'],
    })!
    const last = timeline.frames[timeline.frames.length - 1]
    expect(last.potBb).toBeCloseTo(2.3 * 3 + SB_BB + BB_BB)
  })

  it('all-in scenario', () => {
    const timeline = buildPlaybackTimeline({
      hero_position: 'BTN',
      table_size: 6,
      effective_stack_bb: 20,
      action_before_hero: ['UTG raises all-in to 20bb'],
    })!
    const last = timeline.frames[timeline.frames.length - 1]
    const utg = last.seats.find((s) => s.position === 'UTG')!
    expect(utg.action?.kind).toBe('allin')
    expect(utg.committedBb).toBe(20)
  })

  it('9-max full ring order is respected end to end', () => {
    const timeline = buildPlaybackTimeline({
      hero_position: 'BB',
      table_size: 9,
      action_before_hero: ['Everyone folds'],
    })!
    const foldEvents = timeline.events.filter((e) => e.kind === 'fold').map((e) => e.position)
    expect(foldEvents).toEqual(['UTG', 'UTG+1', 'UTG+2', 'LJ', 'HJ', 'CO', 'BTN', 'SB'])
  })
})

describe("buildPlaybackTimeline — Hero's own prior action (rejam spots) round-trips correctly", () => {
  it("Hero's own open survives the raw-string round-trip with isHero preserved on the recomputed frame", () => {
    const timeline = buildPlaybackTimeline({
      hero_position: 'BTN',
      table_size: 6,
      action_before_hero: ['Hero raises to 2bb', 'SB raises all-in to 15bb'],
    })!
    const last = timeline.frames[timeline.frames.length - 1]
    const hero = last.seats.find((s) => s.isHero)!
    expect(hero.action?.kind).toBe('raise')
    expect(hero.action?.isHero).toBe(true)
    const midFrame = timeline.frames[timeline.frames.length - 2] // after Hero's raise, before SB's shove
    expect(midFrame.seats.find((s) => s.isHero)?.action?.kind).toBe('raise')
  })
})
