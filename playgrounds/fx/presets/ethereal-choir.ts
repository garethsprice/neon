/**
 * Ethereal Choir Pads
 * Slow, sustained choir pads inspired by Enya and ambient new age music
 */

import type { SoundPreset } from './types';

export const etherealChoir: SoundPreset = {
  id: 'choir',
  name: 'Ethereal Choir',
  description: 'Slow, sustained choir pads. Inspired by Enya and ambient new age.',
  category: 'ambient',

  bpm: 40,
  notes: [
    // Cmaj7 chord (sustained)
    { note: 60, duration: 4, gap: 0 }, { note: 64, duration: 4, gap: 0 },
    { note: 67, duration: 4, gap: 0 }, { note: 71, duration: 4 },
    // Am9 chord
    { note: 57, duration: 4, gap: 0 }, { note: 60, duration: 4, gap: 0 },
    { note: 64, duration: 4, gap: 0 }, { note: 71, duration: 4 },
    // Fmaj7 chord
    { note: 53, duration: 4, gap: 0 }, { note: 57, duration: 4, gap: 0 },
    { note: 60, duration: 4, gap: 0 }, { note: 64, duration: 4 },
    // Gsus4 chord
    { note: 55, duration: 4, gap: 0 }, { note: 60, duration: 4, gap: 0 },
    { note: 62, duration: 4, gap: 0 }, { note: 67, duration: 4 }
  ],

  oscillator: {
    waveform: 'sine',   // Pure, choir-like tone
    detune: 8,          // Slight chorus effect
    gain: 70
  },

  envelope: {
    attack: 1.5,    // Very slow attack
    decay: 0.5,
    sustain: 0.8,
    release: 3.0    // Long, fading release
  },

  filter: {
    enabled: true,
    params: { cutoff: 3000, resonance: 1 }  // Soft, warm
  },

  saturation: { enabled: false, params: {} },
  bitcrusher: { enabled: false, params: {} },
  distortion: { enabled: false, params: {} },
  compressor: { enabled: false, params: {} },

  delay: {
    enabled: true,
    params: { time: 400, feedback: 30, damping: 40, mix: 20 }
  },

  reverb: {
    enabled: true,
    params: { decay: 5, damping: 60, preDelay: 40, mix: 45 }  // Lush, spacious
  },

  phaser: {
    enabled: true,
    params: { rate: 0.15, depth: 40, feedback: 30, stages: 4, baseFreq: 800, mix: 25 }
  },

  flanger: { enabled: false, params: {} }
};
