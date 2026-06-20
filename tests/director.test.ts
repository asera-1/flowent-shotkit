import { describe, it, expect } from 'vitest'
import { DeterministicDirector } from '../src/director'

describe('DeterministicDirector', () => {
  it('maps a screenshot label to an on-brand headline', async () => {
    const d = new DeterministicDirector()
    const out = await d.generate({
      screenshots: [{ id: 's1', image: 'x', label: 'Leaderboard screen' }],
      appProfile: { name: 'Flowent' },
      brandVoice: { tone: 'direct', casing: 'upper', banned: [',', '—'] },
      stores: [],
    })
    expect(out.slides[0].headline.line1).toBe('CLIMB THE')
    expect(out.slides[0].headline.line2).toBe('LEADERBOARD')
  })

  it('strips banned tokens (trailing comma / em dash)', async () => {
    const d = new DeterministicDirector()
    const out = await d.generate({
      screenshots: [{ id: 's2', image: 'x', label: 'home daily lesson' }],
      appProfile: { name: 'Flowent' },
      brandVoice: { tone: 'direct', casing: 'upper', banned: [','] },
      stores: [],
    })
    expect(out.slides[0].headline.line1.endsWith(',')).toBe(false)
  })
})
