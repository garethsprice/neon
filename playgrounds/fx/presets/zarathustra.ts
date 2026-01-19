/**
 * Also Sprach Zarathustra - "Sunrise" fanfare
 * Richard Strauss (1896)
 * The iconic 2001: A Space Odyssey opening
 */

import type { SoundPreset } from './types';

export const zarathustra: SoundPreset = {
  id: 'zarathustra',
  name: '2001 Sunrise',
  description: 'Also Sprach Zarathustra - Richard Strauss (1896). The iconic space odyssey fanfare.',
  category: 'classical',

  bpm: 30,
  notes: [
    // Low C pedal with the rising C-G-C motif
    { note: 36, duration: 8, gap: 0 },  // Low C pedal (C2)
    { note: 48, duration: 6, gap: 0 },  // C3 pedal reinforcement
    { note: 60, duration: 4 },          // C4 - first note of motif
    // The rising fifth
    { note: 36, duration: 6, gap: 0 },  // Low pedal continues
    { note: 48, duration: 6, gap: 0 },
    { note: 67, duration: 4 },          // G4 - the fifth
    // The triumphant octave
    { note: 36, duration: 8, gap: 0 },  // Pedal
    { note: 48, duration: 8, gap: 0 },
    { note: 60, duration: 8, gap: 0 },  // C4
    { note: 72, duration: 8 },          // C5 - the climax!
    // Final sustain with full chord
    { note: 36, duration: 12, gap: 0 }, // C2
    { note: 48, duration: 12, gap: 0 }, // C3
    { note: 60, duration: 12, gap: 0 }, // C4
    { note: 67, duration: 12, gap: 0 }, // G4
    { note: 72, duration: 12 }          // C5
  ],

  oscillator: {
    waveform: 'sawtooth',  // Rich harmonics like organ/brass
    detune: 5,             // Slight detuning for thickness
    gain: 85
  },

  envelope: {
    attack: 0.8,    // Slow swell like organ
    decay: 0.3,
    sustain: 0.9,   // Full sustain
    release: 2.0    // Long decay
  },

  filter: {
    enabled: true,
    params: { cutoff: 2500, resonance: 2 }  // Warm, not too bright
  },

  saturation: {
    enabled: true,
    params: { drive: 15, mix: 50 }  // Subtle warmth
  },

  bitcrusher: { enabled: false, params: {} },
  distortion: { enabled: false, params: {} },

  compressor: {
    enabled: true,
    params: { threshold: -18, ratio: 3, attack: 20, release: 200 }
  },

  delay: { enabled: false, params: {} },

  reverb: {
    enabled: true,
    params: { decay: 4, damping: 40, preDelay: 30, mix: 35 }  // Large hall
  },

  phaser: { enabled: false, params: {} },
  flanger: { enabled: false, params: {} }
};
