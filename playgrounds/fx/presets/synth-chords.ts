/**
 * Pop Chords
 * I-V-vi-IV chord progression
 * The most used progression in pop music
 */

import type { SoundPreset } from './types';

export const synthChords: SoundPreset = {
  id: 'chords',
  name: 'Pop Chords',
  description: 'I-V-vi-IV chord progression. The most used progression in pop music.',
  category: 'synth',

  bpm: 72,
  notes: [
    // I chord (C)
    { note: 60, duration: 2, gap: 0 }, { note: 64, duration: 2, gap: 0 }, { note: 67, duration: 2 },
    // V chord (G)
    { note: 55, duration: 2, gap: 0 }, { note: 59, duration: 2, gap: 0 }, { note: 62, duration: 2 },
    // vi chord (Am)
    { note: 57, duration: 2, gap: 0 }, { note: 60, duration: 2, gap: 0 }, { note: 64, duration: 2 },
    // IV chord (F)
    { note: 53, duration: 2, gap: 0 }, { note: 57, duration: 2, gap: 0 }, { note: 60, duration: 2 }
  ],

  oscillator: {
    waveform: 'sawtooth',
    detune: 10,
    gain: 75
  },

  envelope: {
    attack: 0.1,
    decay: 0.2,
    sustain: 0.7,
    release: 0.5
  },

  filter: {
    enabled: true,
    params: { cutoff: 3000, resonance: 2 }
  },

  saturation: { enabled: false, params: {} },
  bitcrusher: { enabled: false, params: {} },
  distortion: { enabled: false, params: {} },

  compressor: {
    enabled: true,
    params: { threshold: -18, ratio: 3, attack: 15, release: 150 }
  },

  delay: {
    enabled: true,
    params: { time: 330, feedback: 25, damping: 40, mix: 20 }
  },

  reverb: {
    enabled: true,
    params: { decay: 2, damping: 50, preDelay: 15, mix: 25 }
  },

  phaser: { enabled: false, params: {} },
  flanger: { enabled: false, params: {} }
};
