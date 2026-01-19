/**
 * Sandstorm
 * Darude (1999)
 * The iconic trance synth riff
 */

import type { SoundPreset } from './types';

export const sandstorm: SoundPreset = {
  id: 'sandstorm',
  name: 'Sandstorm',
  description: 'Darude - Sandstorm (1999). The iconic trance synth riff.',
  category: 'electronic',

  bpm: 136,
  notes: [
    // E D B A pattern - the iconic Sandstorm riff
    { note: 64, duration: 0.5 }, { note: 64, duration: 0.5 }, { note: 64, duration: 0.5 }, { note: 64, duration: 0.5 },  // E
    { note: 62, duration: 0.5 }, { note: 62, duration: 0.5 }, { note: 62, duration: 0.5 }, { note: 62, duration: 0.5 },  // D
    { note: 59, duration: 0.5 }, { note: 59, duration: 0.5 }, { note: 59, duration: 0.5 }, { note: 59, duration: 0.5 },  // B
    { note: 57, duration: 0.5 }, { note: 57, duration: 0.5 }, { note: 57, duration: 0.5 }, { note: 57, duration: 0.5 }   // A
  ],

  oscillator: {
    waveform: 'sawtooth',  // Classic trance supersaw
    detune: 15,            // Detuned for thickness
    gain: 90
  },

  envelope: {
    attack: 0.005,  // Instant attack
    decay: 0.1,
    sustain: 0.7,
    release: 0.15   // Quick release for staccato
  },

  filter: {
    enabled: true,
    params: { cutoff: 4000, resonance: 4 }  // Bright with some resonance
  },

  saturation: {
    enabled: true,
    params: { drive: 25, mix: 60 }  // Add grit
  },

  bitcrusher: { enabled: false, params: {} },
  distortion: { enabled: false, params: {} },

  compressor: {
    enabled: true,
    params: { threshold: -12, ratio: 4, attack: 5, release: 100 }  // Punchy
  },

  delay: {
    enabled: true,
    params: { time: 220, feedback: 25, damping: 30, mix: 15 }  // Tight delay
  },

  reverb: {
    enabled: true,
    params: { decay: 1.5, damping: 50, preDelay: 10, mix: 20 }  // Small room
  },

  phaser: { enabled: false, params: {} },
  flanger: { enabled: false, params: {} }
};
