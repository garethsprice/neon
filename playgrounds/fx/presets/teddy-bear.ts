/**
 * Teddy Bear's Picnic
 * The classic novelty song (1907) with a playful calliope sound
 */

import type { SoundPreset } from './types';

export const teddyBear: SoundPreset = {
  id: 'teddybear',
  name: "Teddy Bear's Picnic",
  description: 'The classic novelty song (1907) with a playful calliope sound.',
  category: 'retro',

  bpm: 120,
  notes: [
    { note: 60, duration: 0.75 }, { note: 64, duration: 0.75 }, { note: 67, duration: 0.75 }, { note: 72, duration: 0.75 },
    { note: 67, duration: 0.75 }, { note: 64, duration: 0.75 }, { note: 60, duration: 1.5 },
    { note: 62, duration: 0.75 }, { note: 65, duration: 0.75 }, { note: 69, duration: 0.75 }, { note: 74, duration: 0.75 },
    { note: 69, duration: 0.75 }, { note: 65, duration: 0.75 }, { note: 62, duration: 1.5 },
    { note: 64, duration: 0.75 }, { note: 67, duration: 0.75 }, { note: 71, duration: 0.75 }, { note: 76, duration: 0.75 },
    { note: 71, duration: 0.75 }, { note: 67, duration: 0.75 }, { note: 64, duration: 1.5 }
  ],

  oscillator: {
    waveform: 'square',  // Calliope/organ sound
    detune: 3,
    gain: 70
  },

  envelope: {
    attack: 0.01,
    decay: 0.1,
    sustain: 0.6,
    release: 0.15
  },

  filter: {
    enabled: true,
    params: { cutoff: 3500, resonance: 1 }
  },

  saturation: { enabled: false, params: {} },
  bitcrusher: { enabled: false, params: {} },
  distortion: { enabled: false, params: {} },
  compressor: { enabled: false, params: {} },

  delay: { enabled: false, params: {} },

  reverb: {
    enabled: true,
    params: { decay: 1.5, damping: 40, preDelay: 5, mix: 25 }
  },

  phaser: {
    enabled: true,
    params: { rate: 0.8, depth: 30, feedback: 20, stages: 4, baseFreq: 1200, mix: 20 }
  },

  flanger: { enabled: false, params: {} }
};
