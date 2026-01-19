/**
 * Neon Audio Plugins
 *
 * A collection of chainable Web Audio API plugins with a standardized interface.
 *
 * ## Quick Start
 *
 * ```typescript
 * import { Filter, Compressor, Reverb, PluginChain } from '@neon/fx';
 *
 * const ctx = new AudioContext();
 *
 * // Create plugins
 * const filter = new Filter(ctx, { cutoff: 2000 });
 * const compressor = new Compressor(ctx, { threshold: -18 });
 * const reverb = new Reverb(ctx, { mix: 30 });
 *
 * // Chain them together
 * const chain = new PluginChain(ctx);
 * chain.add(filter).add(compressor).add(reverb);
 *
 * // Connect to audio graph
 * sourceNode.connect(chain.input);
 * chain.connect(ctx.destination);
 *
 * // Adjust parameters in real-time
 * filter.setParam('cutoff', 1000, 0.1);  // ramp over 100ms
 * ```
 */

// Types
export type {
  ParameterDefinition,
  PluginState,
  PluginCategory,
  SaturationMode,
  BiquadFilterType,
  AudioPluginInterface,
  AudioPluginConstructor
} from './types';

// Base class and utilities
export { AudioPlugin, setupBypassRouting } from './base';

// Filter plugins
export {
  Filter,
  LowpassFilter,
  HighpassFilter,
  BandpassFilter
} from './filter';
export type { FilterOptions } from './filter';

// Saturation/distortion plugins
export {
  Saturation,
  createSaturationCurve,
  createTubeCurve,
  createTapeCurve,
  createHardClipCurve
} from './saturation';
export type { SaturationOptions } from './saturation';

// Bitcrusher
export {
  Bitcrusher,
  RetroCrusher,
  LoFiCrusher
} from './bitcrusher';
export type { BitcrusherOptions } from './bitcrusher';

// Distortion
export {
  Distortion,
  Overdrive,
  Fuzz
} from './distortion';
export type { DistortionOptions, DistortionType } from './distortion';

// Dynamics plugins
export {
  Compressor,
  Limiter
} from './compressor';
export type { CompressorOptions } from './compressor';

// Sidechain plugins
export {
  Sidechain,
  RhythmicSidechain
} from './sidechain';
export type { SidechainOptions, RhythmicSidechainOptions } from './sidechain';

// Adaptive noise plugin
export { AdaptiveNoise } from './adaptive-noise';
export type {
  AdaptiveNoiseOptions,
  NoiseControlValues,
  NoiseUpdateCallback,
  NoiseType
} from './adaptive-noise';

// Reverb plugins
export {
  Reverb,
  PlateReverb,
  HallReverb,
  RoomReverb,
  generateImpulseResponse
} from './reverb';
export type { ReverbOptions } from './reverb';

// Delay plugins
export {
  Delay,
  PingPongDelay,
  SlapbackDelay
} from './delay';
export type { DelayOptions } from './delay';

// Phaser plugins
export {
  Phaser,
  VintagePhaser
} from './phaser';
export type { PhaserOptions } from './phaser';

// Flanger plugins
export {
  Flanger,
  JetFlanger,
  SubtleFlanger
} from './flanger';
export type { FlangerOptions } from './flanger';

// Stereo Panner
export { StereoPanner } from './stereo-panner';
export type { StereoPannerOptions } from './stereo-panner';

// Spatial Panner (3D)
export { SpatialPanner } from './spatial-panner';
export type { SpatialPannerOptions, DistanceModelType, PanningModelType } from './spatial-panner';

// Chain utilities
export {
  PluginChain,
  ParallelChain,
  createChain
} from './chain';

// Vinyl effect
export {
  VinylEffect,
  createVinylEffect
} from './vinyl';
export type { VinylOptions, ClunkSpeed } from './vinyl';

// Oscillator (sound source)
export {
  Oscillator,
  OSCILLATOR_PRESETS
} from './oscillator';
export type {
  WaveformType,
  OscillatorOptions
} from './oscillator';

// Envelope generator
export {
  Envelope,
  ENVELOPE_PRESETS
} from './envelope';
export type {
  ADSRParams,
  EnvelopeOptions
} from './envelope';

// LFO (Low Frequency Oscillator)
export {
  LFO,
  LFO_PRESETS
} from './lfo';
export type {
  LFOWaveform,
  LFOOptions
} from './lfo';

// Import classes for registry
import { Filter, LowpassFilter, HighpassFilter, BandpassFilter } from './filter';
import { Saturation } from './saturation';
import { Bitcrusher, RetroCrusher, LoFiCrusher } from './bitcrusher';
import { Compressor, Limiter } from './compressor';
import { Sidechain, RhythmicSidechain } from './sidechain';
import { AdaptiveNoise } from './adaptive-noise';
import { Reverb, PlateReverb, HallReverb, RoomReverb } from './reverb';
import { Delay, PingPongDelay, SlapbackDelay } from './delay';
import { Phaser, VintagePhaser } from './phaser';
import { Flanger, JetFlanger, SubtleFlanger } from './flanger';
import { StereoPanner } from './stereo-panner';
import { SpatialPanner } from './spatial-panner';
import { VinylEffect } from './vinyl';
import { Distortion, Overdrive, Fuzz } from './distortion';
import { AudioPlugin } from './base';

/** Plugin constructor type for registry - using any for flexibility with different option types */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PluginConstructor = new (audioContext: AudioContext, options?: any) => AudioPlugin;

/** Plugin loader function type */
type PluginLoader = () => Promise<PluginConstructor>;

/**
 * Registry of all available plugins for dynamic instantiation
 */
export const pluginRegistry: Record<string, PluginLoader> = {
  // Filters
  'filter': () => Promise.resolve(Filter),
  'lowpass-filter': () => Promise.resolve(LowpassFilter),
  'highpass-filter': () => Promise.resolve(HighpassFilter),
  'bandpass-filter': () => Promise.resolve(BandpassFilter),

  // Saturation
  'saturation': () => Promise.resolve(Saturation),

  // Bitcrusher
  'bitcrusher': () => Promise.resolve(Bitcrusher),
  'retro-crusher': () => Promise.resolve(RetroCrusher),
  'lofi-crusher': () => Promise.resolve(LoFiCrusher),

  // Dynamics
  'compressor': () => Promise.resolve(Compressor),
  'limiter': () => Promise.resolve(Limiter),

  // Sidechain
  'sidechain': () => Promise.resolve(Sidechain),
  'rhythmic-sidechain': () => Promise.resolve(RhythmicSidechain),

  // Adaptive
  'adaptive-noise': () => Promise.resolve(AdaptiveNoise),

  // Reverb
  'reverb': () => Promise.resolve(Reverb),
  'plate-reverb': () => Promise.resolve(PlateReverb),
  'hall-reverb': () => Promise.resolve(HallReverb),
  'room-reverb': () => Promise.resolve(RoomReverb),

  // Delay
  'delay': () => Promise.resolve(Delay),
  'ping-pong-delay': () => Promise.resolve(PingPongDelay),
  'slapback-delay': () => Promise.resolve(SlapbackDelay),

  // Phaser
  'phaser': () => Promise.resolve(Phaser),
  'vintage-phaser': () => Promise.resolve(VintagePhaser),

  // Flanger
  'flanger': () => Promise.resolve(Flanger),
  'jet-flanger': () => Promise.resolve(JetFlanger),
  'subtle-flanger': () => Promise.resolve(SubtleFlanger),

  // Vinyl
  'vinyl': () => Promise.resolve(VinylEffect),

  // Distortion
  'distortion': () => Promise.resolve(Distortion),
  'overdrive': () => Promise.resolve(Overdrive),
  'fuzz': () => Promise.resolve(Fuzz),

  // Stereo Panner
  'stereo-panner': () => Promise.resolve(StereoPanner),

  // Spatial Panner (3D)
  'spatial-panner': () => Promise.resolve(SpatialPanner)
};

/**
 * Create a plugin by id
 */
export async function createPlugin(
  id: string,
  audioContext: AudioContext,
  options: Record<string, unknown> = {}
): Promise<AudioPlugin> {
  const loader = pluginRegistry[id];
  if (!loader) {
    throw new Error(`Unknown plugin id: ${id}`);
  }
  const PluginClass = await loader();
  return new PluginClass(audioContext, options);
}

/**
 * Get all available plugin ids
 */
export function getAvailablePlugins(): string[] {
  return Object.keys(pluginRegistry);
}
