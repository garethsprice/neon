/**
 * Synth Lead
 * A classic mono synth lead sound with portamento feel
 */

import type { SoundPreset } from './types';

export const leadSynth: SoundPreset = {
  id: 'lead',
  name: 'Synth Lead',
  description: 'A classic mono synth lead sound with portamento feel.',
  category: 'synth',

  bpm: 120,
  notes: [
    // Simple ascending melody
    { note: 60, duration: 1 }, { note: 62, duration: 1 }, { note: 64, duration: 1 }, { note: 65, duration: 1 },
    { note: 67, duration: 2 }, { note: 65, duration: 1 }, { note: 64, duration: 1 },
    { note: 62, duration: 1 }, { note: 60, duration: 1 }, { note: 62, duration: 2 },
    { note: 64, duration: 1 }, { note: 62, duration: 1 }, { note: 60, duration: 2 }
  ],

  oscillator: {
    waveform: 'sawtooth',
    detune: 5,
    gain: 85
  },

  envelope: {
    attack: 0.02,
    decay: 0.1,
    sustain: 0.8,
    release: 0.3
  },

  filter: {
    enabled: true,
    params: { cutoff: 4500, resonance: 8 }  // Resonant, cutting
  },

  saturation: {
    enabled: true,
    params: { drive: 30, mix: 50 }
  },

  bitcrusher: { enabled: false, params: {} },

  distortion: {
    enabled: true,
    params: { drive: 20, tone: 60, level: 60, mix: 30 }
  },

  compressor: {
    enabled: true,
    params: { threshold: -15, ratio: 4, attack: 5, release: 100 }
  },

  delay: {
    enabled: true,
    params: { time: 250, feedback: 35, damping: 30, mix: 25 }
  },

  reverb: {
    enabled: true,
    params: { decay: 1.5, damping: 45, preDelay: 10, mix: 20 }
  },

  phaser: { enabled: false, params: {} },

  flanger: {
    enabled: true,
    params: { rate: 0.2, depth: 50, feedback: 40, delay: 4, mix: 25 }
  }
};
