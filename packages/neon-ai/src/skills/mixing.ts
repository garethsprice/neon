import type { Skill } from '../types';

export const mixing: Skill = {
  name: 'Mixing',
  description: 'Balancing and processing elements',
  category: 'mixing',
  applicableTo: ['all'],
  augment: `MIXING FUNDAMENTALS:
- Gain staging: set levels before processing
- EQ: cut before boost, remove conflicts
- Compression: control dynamics, add punch
- Saturation: add warmth and harmonics
- Reverb: create depth and space (less is more)
- Panning: spread elements for width, keep bass centered
- Reference: compare to professional mixes frequently`,
};
