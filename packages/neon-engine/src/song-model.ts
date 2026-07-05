/**
 * Song Model - The canonical Neon Studio project format.
 *
 * Design constraints (see plan):
 *  - `channels` and `patterns` are Records keyed by stable ids because the
 *    @neon/cloud diff engine only produces per-key granularity for object
 *    fields; ordering lives in `channelOrder`/`songOrder` arrays.
 *  - Note cells reuse the TrackerNoteData lingua franca shared with the
 *    piano-roll, MIDI import/export, and the AI JSON schemas. For 'lanes'
 *    instruments the cell VALUE is a velocity code (1 = hit, 2 = accent);
 *    for 'pitched' instruments it is a MIDI note number. Interpretation is
 *    strictly a function of the channel instrument's static noteMode.
 *  - One `length` per pattern (no polymeter).
 */

import type { InstrumentState } from '@neon/instruments';
import type { PluginState } from '@neon/fx';

/**
 * rest | value | [value, durationSteps] | [value, durationSteps, velocity]
 * The optional third element is a 1-127 velocity for pitched channels
 * (lanes channels encode velocity in the value itself: 1 hit, 2 accent).
 */
export type TrackerNoteData = null | number | [number, number] | [number, number, number];

export type ChannelId = string;
export type PatternId = string;

/** The sixteen addressable pattern slots (A-P; the UI may expose fewer). */
export const PATTERN_IDS: readonly PatternId[] = 'ABCDEFGHIJKLMNOP'.split('');

export type ModSourceId = 'lfo1' | 'lfo2' | 'menv';

export interface ModRouteState {
  source: ModSourceId;
  /** 'inst.<param>' | 'fx<slotIndex>.<param>' | 'channel.gain' | 'channel.pan' */
  target: string;
  /** -1..1, scaled by the target parameter's declared range */
  depth: number;
}

export interface LfoState {
  /** Hz when sync is null */
  rate: number;
  /** tempo-sync division like '1/4', or null for free Hz */
  sync: string | null;
  wave: 'sine' | 'triangle' | 'sawtooth' | 'square';
}

export interface ModEnvState {
  attack: number;
  decay: number;
}

export interface ChannelModsState {
  lfo1: LfoState;
  lfo2: LfoState;
  menv: ModEnvState;
  routes: ModRouteState[];
}

export interface ChannelState {
  name: string;
  instrument: InstrumentState;
  /** PluginChain.serialize() verbatim */
  fx: PluginState[];
  /** 0..1 */
  gain: number;
  /** -1..1 */
  pan: number;
  mute: boolean;
  sends: { delay: number; reverb: number };
  /** Sidechain duck amount from kick-lane hits, 0..1 (0 = off). */
  duck?: number;
  mods: ChannelModsState;
  /** pitched: polyphony columns (1..4); lanes: must equal lanes.length */
  columns: number;
}

export type PatternLength = 8 | 16 | 32 | 64;

export interface PatternState {
  length: PatternLength;
  /** channelId -> [column][row] cells; channels with no notes are omitted */
  channels: Record<ChannelId, TrackerNoteData[][]>;
}

export interface ProjectState {
  version: 1;
  bpm: number;
  /** 0-100, applied to odd 16th rows */
  swing: number;
  name: string;
  description: string;
  thumbnailUrl: string | null;
  /** 0..1 */
  masterVolume: number;
  channels: Record<ChannelId, ChannelState>;
  channelOrder: ChannelId[];
  patterns: Record<PatternId, PatternState>;
  songOrder: PatternId[];
}

/**
 * diffState configuration for @neon/cloud commits of a ProjectState.
 */
export const STUDIO_DIFF_CONFIG = {
  scalarFields: ['bpm', 'swing', 'name', 'description', 'thumbnailUrl', 'masterVolume'],
  objectFields: ['patterns', 'channels'],
  arrayFields: ['songOrder', 'channelOrder'],
  ignoreFields: ['_id', 'id', 'createdAt', 'updatedAt']
} as const;

export function createDefaultMods(): ChannelModsState {
  return {
    lfo1: { rate: 1, sync: null, wave: 'sine' },
    lfo2: { rate: 4, sync: null, wave: 'triangle' },
    menv: { attack: 0.01, decay: 0.3 },
    routes: []
  };
}

export function createChannelState(
  name: string,
  instrumentId: string,
  options: Partial<Omit<ChannelState, 'name' | 'instrument'>> & {
    instrumentParams?: Record<string, number>;
    instrumentExtra?: Record<string, unknown>;
  } = {}
): ChannelState {
  const instrument: InstrumentState = {
    id: instrumentId,
    params: options.instrumentParams ?? {}
  };
  if (options.instrumentExtra) {
    instrument.extra = options.instrumentExtra;
  }
  return {
    name,
    instrument,
    fx: options.fx ?? [],
    gain: options.gain ?? 0.8,
    pan: options.pan ?? 0,
    mute: options.mute ?? false,
    sends: options.sends ?? { delay: 0, reverb: 0 },
    duck: options.duck ?? 0,
    mods: options.mods ?? createDefaultMods(),
    columns: options.columns ?? 4
  };
}

export function createEmptyPattern(length: PatternLength = 16): PatternState {
  return { length, channels: {} };
}

/** Build an empty [column][row] cell grid. */
export function createEmptyCells(columns: number, rows: number): TrackerNoteData[][] {
  return Array.from({ length: columns }, () => Array.from({ length: rows }, () => null));
}

/**
 * Get (creating if needed) a channel's cell grid inside a pattern, sized to
 * the channel's column count and the pattern's length.
 */
export function ensurePatternChannel(
  pattern: PatternState,
  channelId: ChannelId,
  columns: number
): TrackerNoteData[][] {
  let cells = pattern.channels[channelId];
  if (!cells) {
    cells = createEmptyCells(columns, pattern.length);
    pattern.channels[channelId] = cells;
  }
  return cells;
}

/** True when a cell grid contains no notes (safe to omit from serialization). */
export function cellsAreEmpty(cells: TrackerNoteData[][]): boolean {
  return cells.every(col => col.every(cell => cell === null));
}

/** Drop empty channel grids from a pattern (sparse serialization). */
export function prunePattern(pattern: PatternState): PatternState {
  const channels: Record<ChannelId, TrackerNoteData[][]> = {};
  for (const [id, cells] of Object.entries(pattern.channels)) {
    if (!cellsAreEmpty(cells)) {
      channels[id] = cells;
    }
  }
  return { length: pattern.length, channels };
}

export function createDefaultProject(): ProjectState {
  return {
    version: 1,
    bpm: 120,
    swing: 0,
    name: 'Untitled',
    description: '',
    thumbnailUrl: null,
    masterVolume: 0.8,
    channels: {
      ch1: createChannelState('DRUMS', 'tr909-kit', { columns: 11 }),
      ch2: createChannelState('BASS', 'poly-synth', {
        columns: 2,
        instrumentParams: { cutoff: 900, resonance: 4 },
        instrumentExtra: { waveform: 'sawtooth' }
      }),
      ch3: createChannelState('LEAD', 'poly-synth', {
        columns: 4,
        instrumentExtra: { waveform: 'square' }
      }),
      ch4: createChannelState('NOISE', 'noise', { columns: 4, gain: 0.5 })
    },
    channelOrder: ['ch1', 'ch2', 'ch3', 'ch4'],
    patterns: { A: createEmptyPattern(16) },
    songOrder: ['A']
  };
}
