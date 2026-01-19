import type { Genre } from '../types';

export const hiphop: Genre = {
  name: 'Hip-Hop / Trap',
  description: 'Hip-hop, trap, boom bap, lo-fi',
  keywords: ['hip-hop', 'hiphop', 'trap', 'boom bap', 'lofi', 'lo-fi', 'rap', 'beats', '808', 'drill', 'grime'],
  bpmRange: [85, 150],
  aesthetic: 'Punchy and groove-focused. Reference Timbaland, Metro Boomin. Hip-hop: 85-100 BPM with heavy shuffle. Trap: 130-150 BPM half-time feel with hi-hat rolls. Lo-fi: add saturation, reduce highs. Space for vocals.',
  artwork: 'Urban grit, gold chains on black, city streets at night, bold typography influence, smoke and atmosphere, high contrast shadows, streetwear aesthetics, raw and unpolished textures',
  related: ['trap', 'grime', 'r&b'],
};
