/**
 * 8-Bit Chiptune
 * Classic chiptune sound with bitcrusher
 */

import type { SoundPreset } from './types';

export const chiptune: SoundPreset = {
  id: 'chiptune',
  name: '8-Bit Arpeggio',
  description: 'Classic chiptune sound with bitcrusher.',
  category: 'retro',

  bpm: 140,
  notes: [
    // C major arpeggio up and down
    { note: 60, duration: 0.5 }, { note: 64, duration: 0.5 }, { note: 67, duration: 0.5 }, { note: 72, duration: 0.5 },
    { note: 67, duration: 0.5 }, { note: 64, duration: 0.5 },
    // A minor
    { note: 57, duration: 0.5 }, { note: 60, duration: 0.5 }, { note: 64, duration: 0.5 }, { note: 69, duration: 0.5 },
    { note: 64, duration: 0.5 }, { note: 60, duration: 0.5 },
    // F major
    { note: 53, duration: 0.5 }, { note: 57, duration: 0.5 }, { note: 60, duration: 0.5 }, { note: 65, duration: 0.5 },
    { note: 60, duration: 0.5 }, { note: 57, duration: 0.5 },
    // G major
    { note: 55, duration: 0.5 }, { note: 59, duration: 0.5 }, { note: 62, duration: 0.5 }, { note: 67, duration: 0.5 },
    { note: 62, duration: 0.5 }, { note: 59, duration: 0.5 }
  ],

  oscillator: {
    waveform: 'square',  // Classic 8-bit
    detune: 0,
    gain: 80
  },

  envelope: {
    attack: 0.001,
    decay: 0.05,
    sustain: 0.8,
    release: 0.1
  },

  filter: {
    enabled: false,
    params: {}
  },

  saturation: { enabled: false, params: {} },

  bitcrusher: {
    enabled: true,
    params: { bits: 8, downsample: 4, mix: 100 }  // Authentic 8-bit
  },

  distortion: { enabled: false, params: {} },
  compressor: { enabled: false, params: {} },
  delay: { enabled: false, params: {} },

  reverb: {
    enabled: true,
    params: { decay: 0.5, damping: 80, preDelay: 0, mix: 15 }
  },

  phaser: { enabled: false, params: {} },
  flanger: { enabled: false, params: {} }
};
