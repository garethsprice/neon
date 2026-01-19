import type { Genre } from '../types';

export const chiptune: Genre = {
  name: 'Chiptune',
  description: '8-bit, retro gaming, chip music, bitpop',
  keywords: ['chiptune', '8-bit', '8bit', 'chip', 'gameboy', 'nes', 'retro gaming', 'bitpop', 'fakebit'],
  bpmRange: [120, 160],
  aesthetic: 'Nostalgic, playful, and lo-fi by design. Reference Anamanaguchi, Chipzel, Bit Shifter. Square and pulse wave synthesis. Limited channel count (traditionally 3-4 voices). Arpeggios simulate chords. Fast arps, simple waveforms, lo-fi charm. Can be combined with modern production.',
  artwork: 'Pixel art aesthetic, 8-bit graphics, retro game references, CRT screen effects, neon on black, classic game console colors, nostalgic gaming imagery, blocky typography',
  related: ['synthwave', 'electro', 'hardcore'],
};
