import type { Skill } from '../types';

export const livePerformance: Skill = {
  name: 'Live Performance',
  description: 'Creating music for live contexts',
  category: 'performance',
  applicableTo: ['all'],
  augment: `LIVE PERFORMANCE CONSIDERATIONS:
- Extended intros/outros: allow for DJ mixing (16-32 bars)
- Clear structure: obvious sections for live manipulation
- Loop-friendly: patterns that work when extended
- Energy management: build and release for crowd response
- Transition points: clear spots for mixing in/out
- Variation hooks: elements that can be added/removed live
- BPM consistency: maintain tempo for seamless mixing`,
};
