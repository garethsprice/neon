import type { Skill } from '../types';

export const bassDesign: Skill = {
  name: 'Bass Design',
  description: 'Creating powerful low-end sounds',
  category: 'sound-design',
  applicableTo: ['synth', 'all'],
  augment: `BASS DESIGN TECHNIQUES:
- Fundamental: keep the sub (below 100Hz) mono and clean
- Harmonics: add upper harmonics for presence on small speakers
- Compression: tame dynamics for consistent low end
- Sidechain: duck bass under kick for clarity
- Filter movement: automate cutoff for evolution
- Saturation: add warmth and harmonics carefully
- Layer: sub layer + mid layer for full frequency coverage`,
};
