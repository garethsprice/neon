/**
 * Sound Presets Index
 *
 * Re-exports all presets and types for easy importing
 */

// Types
export type {
  SequenceNote,
  OscillatorSettings,
  EnvelopeSettings,
  EffectSettings,
  SoundPreset
} from './types';

// Individual presets
export { zarathustra } from './zarathustra';
export { etherealChoir } from './ethereal-choir';
export { sandstorm } from './sandstorm';
export { axelF } from './axel-f';
export { happyBirthday } from './happy-birthday';
export { teddyBear } from './teddy-bear';
export { chiptune } from './chiptune';
export { synthChords } from './synth-chords';
export { leadSynth } from './lead-synth';

// Import for registry
import { zarathustra } from './zarathustra';
import { etherealChoir } from './ethereal-choir';
import { sandstorm } from './sandstorm';
import { axelF } from './axel-f';
import { happyBirthday } from './happy-birthday';
import { teddyBear } from './teddy-bear';
import { chiptune } from './chiptune';
import { synthChords } from './synth-chords';
import { leadSynth } from './lead-synth';
import type { SoundPreset } from './types';

/**
 * All available presets
 */
export const ALL_PRESETS: SoundPreset[] = [
  // Classical
  zarathustra,

  // Ambient
  etherealChoir,

  // Electronic
  sandstorm,
  axelF,

  // Retro
  happyBirthday,
  teddyBear,
  chiptune,

  // Synth
  synthChords,
  leadSynth
];

/**
 * Presets organized by category
 */
export const PRESETS_BY_CATEGORY = {
  classical: ALL_PRESETS.filter(p => p.category === 'classical'),
  ambient: ALL_PRESETS.filter(p => p.category === 'ambient'),
  electronic: ALL_PRESETS.filter(p => p.category === 'electronic'),
  retro: ALL_PRESETS.filter(p => p.category === 'retro'),
  synth: ALL_PRESETS.filter(p => p.category === 'synth')
};

/**
 * Get a preset by its ID
 */
export function getPresetById(id: string): SoundPreset | undefined {
  return ALL_PRESETS.find(p => p.id === id);
}
