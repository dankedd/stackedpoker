import { describe, expect, it } from 'vitest'
import { analyzeHandVsFlop } from '../handDrawAnalysis'

describe('analyzeHandVsFlop', () => {
  it('K♦J♦ on Q♠7♦3♣ — one overcard, backdoor flush draw, backdoor straight draw, no combo draw', () => {
    // The exact hand that was mislabeled "two overcards" in pce-s2 — J is below the board's Queen.
    const facts = analyzeHandVsFlop(['Kd', 'Jd'], ['Qs', '7d', '3c'])
    expect(facts).toBeDefined()
    expect(facts!.overcardCount).toBe(1)
    expect(facts!.category).toBe('none')
    expect(facts!.hasFlushDraw).toBe(false)
    expect(facts!.hasBackdoorFlushDraw).toBe(true)
    expect(facts!.straightDrawType).toBe('none')
    expect(facts!.hasBackdoorStraightDraw).toBe(true)
    expect(facts!.isComboDraw).toBe(false)
  })

  it('Q♥J♥ on A♣8♥7♥ — zero overcards (below the board Ace), a real flush draw, not backdoor, not combo', () => {
    const facts = analyzeHandVsFlop(['Qh', 'Jh'], ['Ac', '8h', '7h'])
    expect(facts).toBeDefined()
    expect(facts!.overcardCount).toBe(0)
    expect(facts!.hasFlushDraw).toBe(true)
    expect(facts!.hasBackdoorFlushDraw).toBe(false)
    expect(facts!.straightDrawType).toBe('none')
    expect(facts!.isComboDraw).toBe(false)
  })

  it('A♦Q♦ on J♠7♦2♣ — two real overcards (both above the Jack)', () => {
    const facts = analyzeHandVsFlop(['Ad', 'Qd'], ['Js', '7d', '2c'])
    expect(facts).toBeDefined()
    expect(facts!.overcardCount).toBe(2)
  })

  it('T♠9♠ on 8♥7♣2♦ — open-ended straight draw (needs J or 6)', () => {
    const facts = analyzeHandVsFlop(['Ts', '9s'], ['8h', '7c', '2d'])
    expect(facts).toBeDefined()
    expect(facts!.straightDrawType).toBe('oesd')
  })

  it('Q♣J♣ on A♠K♦4♥ — gutshot (needs exactly a Ten)', () => {
    const facts = analyzeHandVsFlop(['Qc', 'Jc'], ['As', 'Kd', '4h'])
    expect(facts).toBeDefined()
    expect(facts!.straightDrawType).toBe('gutshot')
  })

  it('J♠T♠ on 9♠8♠2♣ — a real flush draw AND an open-ended straight draw: a genuine combo draw', () => {
    const facts = analyzeHandVsFlop(['Js', 'Ts'], ['9s', '8s', '2c'])
    expect(facts).toBeDefined()
    expect(facts!.hasFlushDraw).toBe(true)
    expect(facts!.straightDrawType).toBe('oesd')
    expect(facts!.isComboDraw).toBe(true)
  })

  it('returns undefined for a non-flop board (turn/river) or a malformed hand', () => {
    expect(analyzeHandVsFlop(['Kd', 'Jd'], ['Qs', '7d', '3c', '2h'])).toBeUndefined()
    expect(analyzeHandVsFlop(['Kd'], ['Qs', '7d', '3c'])).toBeUndefined()
  })
})
