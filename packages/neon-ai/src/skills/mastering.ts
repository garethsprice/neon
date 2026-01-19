import type { Skill } from '../types';

export const mastering: Skill = {
  name: 'Mastering',
  description: 'Final polish and loudness optimization',
  category: 'mixing',
  applicableTo: ['all'],
  augment: `MASTERING APPROACH:
- Subtle moves: 1-2dB adjustments maximum
- EQ: gentle broad strokes, enhance overall tone
- Compression: glue the mix, 1-3dB gain reduction
- Limiting: achieve loudness while preserving dynamics
- Stereo width: enhance but check mono compatibility
- Loudness targets: -14 LUFS for streaming, -9 for club
- A/B constantly: compare processed vs bypass`,
};
