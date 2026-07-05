/**
 * Neon Instruments Type Definitions
 *
 * The InstrumentModule contract mirrors the @neon/fx AudioPlugin statics and
 * registry pattern, but describes a *source* (output only, no input/bypass)
 * whose note methods take an AudioContext-clock `time` for sample-accurate
 * lookahead scheduling.
 */

import type { ParameterDefinition } from '@neon/fx';
import type { InstrumentModule } from './base';

export type InstrumentCategory = 'drums' | 'synth' | 'noise' | 'sampler';

/**
 * How a sequencer should interpret this instrument's tracker cells:
 * - 'pitched': cell values are MIDI note numbers (C-3 style display)
 * - 'lanes':   one column per named lane; cell value is a velocity code
 *              (1 = hit, 2 = accent)
 */
export type NoteMode = 'pitched' | 'lanes';

/**
 * A single scheduled note.
 *
 * `time` is an AudioContext.currentTime-based timestamp in seconds and MUST
 * be honored by implementations (>= currentTime; never "now" implicitly).
 */
export interface NoteEvent {
  time: number;
  /** pitched: MIDI note number; lanes: lane index */
  note: number;
  /** 0..1 */
  velocity: number;
  /** gate length in seconds; omit = held until noteOff */
  duration?: number;
}

/** Serialized instrument state (id + numeric params + non-numeric extras). */
export interface InstrumentState {
  id: string;
  params: Record<string, number>;
  /** Non-numeric state: waveform name, per-lane sample params, urls, ... */
  extra?: Record<string, unknown>;
}

/** Static metadata + constructor contract every instrument class satisfies. */
export interface InstrumentConstructor {
  new (audioContext: AudioContext, options?: Record<string, unknown>): InstrumentModule;
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly category: InstrumentCategory;
  readonly parameterDefinitions: readonly ParameterDefinition[];
  readonly noteMode: NoteMode;
  /** Required when noteMode === 'lanes': ordered lane names. */
  readonly lanes?: readonly string[];
}

/** Lightweight descriptor for instrument pickers (no module load needed). */
export interface InstrumentDescriptor {
  id: string;
  name: string;
  description: string;
  category: InstrumentCategory;
  noteMode: NoteMode;
  lanes?: readonly string[];
}

/**
 * Convert a MIDI note number to frequency in Hz (A4 = 69 = 440 Hz).
 * The canonical pitch convention for 'pitched' instruments.
 */
export function midiToFrequency(note: number): number {
  return 440 * Math.pow(2, (note - 69) / 12);
}
