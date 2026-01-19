/**
 * Happy Birthday
 * The classic birthday song with a music box sound
 */

import type { SoundPreset } from './types';

export const happyBirthday: SoundPreset = {
  id: 'birthday',
  name: 'Happy Birthday',
  description: 'The classic birthday song with a music box sound.',
  category: 'retro',

  bpm: 120,
  notes: [
    { note: 60, duration: 0.75 }, { note: 60, duration: 0.25 }, { note: 62, duration: 1 }, { note: 60, duration: 1 },
    { note: 65, duration: 1 }, { note: 64, duration: 2 },
    { note: 60, duration: 0.75 }, { note: 60, duration: 0.25 }, { note: 62, duration: 1 }, { note: 60, duration: 1 },
    { note: 67, duration: 1 }, { note: 65, duration: 2 },
    { note: 60, duration: 0.75 }, { note: 60, duration: 0.25 }, { note: 72, duration: 1 }, { note: 69, duration: 1 },
    { note: 65, duration: 1 }, { note: 64, duration: 1 }, { note: 62, duration: 1 },
    { note: 70, duration: 0.75 }, { note: 70, duration: 0.25 }, { note: 69, duration: 1 }, { note: 65, duration: 1 },
    { note: 67, duration: 1 }, { note: 65, duration: 2 }
  ],

  oscillator: {
    waveform: 'triangle',  // Music box / celesta sound
    detune: 0,
    gain: 75
  },

  envelope: {
    attack: 0.001,   // Instant attack like struck metal
    decay: 0.3,
    sustain: 0.2,
    release: 0.8     // Ring out
  },

  filter: {
    enabled: true,
    params: { cutoff: 6000, resonance: 2 }  // Bright, bell-like
  },

  saturation: { enabled: false, params: {} },
  bitcrusher: { enabled: false, params: {} },
  distortion: { enabled: false, params: {} },
  compressor: { enabled: false, params: {} },

  delay: {
    enabled: true,
    params: { time: 200, feedback: 15, damping: 60, mix: 15 }
  },

  reverb: {
    enabled: true,
    params: { decay: 2, damping: 50, preDelay: 10, mix: 30 }
  },

  phaser: { enabled: false, params: {} },
  flanger: { enabled: false, params: {} }
};
