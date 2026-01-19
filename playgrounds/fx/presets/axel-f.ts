/**
 * Axel F
 * Harold Faltermeyer (1984)
 * Beverly Hills Cop theme - Classic 80s synth
 */

import type { SoundPreset } from './types';

export const axelF: SoundPreset = {
  id: 'axelf',
  name: 'Axel F',
  description: 'Beverly Hills Cop theme - Harold Faltermeyer (1984). Classic 80s synth.',
  category: 'electronic',

  bpm: 120,
  notes: [
    { note: 65, duration: 0.5 }, { note: 68, duration: 0.75 }, { note: 65, duration: 0.25 }, { note: 65, duration: 0.25 },
    { note: 70, duration: 0.5 }, { note: 65, duration: 0.5 }, { note: 63, duration: 0.5 },
    { note: 65, duration: 0.5 }, { note: 72, duration: 0.75 }, { note: 65, duration: 0.25 }, { note: 65, duration: 0.25 },
    { note: 73, duration: 0.5 }, { note: 72, duration: 0.5 }, { note: 68, duration: 0.5 },
    { note: 65, duration: 0.5 }, { note: 72, duration: 0.5 }, { note: 77, duration: 0.5 },
    { note: 65, duration: 0.25 }, { note: 63, duration: 0.5 }, { note: 63, duration: 0.25 },
    { note: 60, duration: 0.5 }, { note: 67, duration: 1 }, { note: 65, duration: 1 }
  ],

  oscillator: {
    waveform: 'square',  // Classic 80s synth bass
    detune: 0,
    gain: 80
  },

  envelope: {
    attack: 0.01,
    decay: 0.15,
    sustain: 0.5,
    release: 0.2
  },

  filter: {
    enabled: true,
    params: { cutoff: 2000, resonance: 6 }  // Resonant, funky
  },

  saturation: { enabled: false, params: {} },
  bitcrusher: { enabled: false, params: {} },
  distortion: { enabled: false, params: {} },

  compressor: {
    enabled: true,
    params: { threshold: -15, ratio: 3, attack: 10, release: 150 }
  },

  delay: {
    enabled: true,
    params: { time: 125, feedback: 20, damping: 50, mix: 20 }  // 16th note delay
  },

  reverb: {
    enabled: true,
    params: { decay: 1, damping: 60, preDelay: 5, mix: 15 }
  },

  phaser: { enabled: false, params: {} },
  flanger: { enabled: false, params: {} }
};
