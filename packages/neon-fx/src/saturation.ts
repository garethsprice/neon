/**
 * Neon Audio Plugin - Saturation
 *
 * Soft-clipping waveshaper for warmth and harmonic distortion.
 */

import { AudioPlugin, setupBypassRouting } from './base';
import type { ParameterDefinition, PluginCategory, SaturationMode } from './types';

/**
 * Generate a soft-clipping saturation curve
 */
export function createSaturationCurve(amount: number, samples: number = 44100): Float32Array {
  const curve = new Float32Array(samples);
  const k = amount * 20;

  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / (samples - 1) - 1;
    curve[i] = k === 0 ? x : ((1 + k) * x) / (1 + k * Math.abs(x));
  }

  return curve;
}

/**
 * Generate a tube-style saturation curve
 */
export function createTubeCurve(amount: number, samples: number = 44100): Float32Array {
  const curve = new Float32Array(samples);
  const k = amount * 10;

  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / (samples - 1) - 1;
    // Asymmetric soft clipping for tube-like harmonics
    if (x >= 0) {
      curve[i] = Math.tanh(x * (1 + k));
    } else {
      curve[i] = Math.tanh(x * (1 + k * 0.5));
    }
  }

  return curve;
}

/**
 * Generate a tape-style saturation curve
 */
export function createTapeCurve(amount: number, samples: number = 44100): Float32Array {
  const curve = new Float32Array(samples);

  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / (samples - 1) - 1;
    const drive = 1 + amount * 3;
    curve[i] = Math.tanh(x * drive) / Math.tanh(drive);
  }

  return curve;
}

/**
 * Generate a hard-clipping distortion curve
 */
export function createHardClipCurve(threshold: number, samples: number = 44100): Float32Array {
  const curve = new Float32Array(samples);
  const t = Math.max(0.01, 1 - threshold);

  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / (samples - 1) - 1;
    curve[i] = Math.max(-t, Math.min(t, x));
  }

  return curve;
}

export interface SaturationOptions extends Record<string, unknown> {
  drive?: number;
  mix?: number;
  mode?: SaturationMode;
}

export class Saturation extends AudioPlugin {
  private _mode: SaturationMode;
  private _shaper: WaveShaperNode;
  private _driveGain: GainNode;
  private _outputGain: GainNode;

  static get id(): string {
    return 'saturation';
  }

  static get name(): string {
    return 'Saturation';
  }

  static get description(): string {
    return 'Adds warmth and harmonic distortion through soft clipping';
  }

  static get category(): PluginCategory {
    return 'distortion';
  }

  static get parameterDefinitions(): readonly ParameterDefinition[] {
    return [
      {
        name: 'drive',
        label: 'Drive',
        min: 0,
        max: 100,
        default: 0,
        unit: '%',
        scale: 'linear'
      },
      {
        name: 'mix',
        label: 'Mix',
        min: 0,
        max: 100,
        default: 100,
        unit: '%',
        scale: 'linear'
      }
    ];
  }

  constructor(audioContext: AudioContext, options: SaturationOptions = {}) {
    super(audioContext, options);

    this._mode = options.mode || 'soft';

    // Create waveshaper
    this._shaper = this.ctx.createWaveShaper();
    this._shaper.oversample = '4x';

    // Input gain for driving the saturation
    this._driveGain = this.ctx.createGain();
    this._driveGain.gain.value = 1;

    // Output gain for level compensation
    this._outputGain = this.ctx.createGain();
    this._outputGain.gain.value = 1;

    // Wire processing chain
    this._driveGain.connect(this._shaper);
    this._shaper.connect(this._outputGain);

    // Apply initial parameters
    this._updateCurve();

    // Setup bypass routing
    setupBypassRouting(this, this._driveGain, this._outputGain);
  }

  /** Get/set saturation mode */
  get mode(): SaturationMode {
    return this._mode;
  }

  set mode(value: SaturationMode) {
    if (['soft', 'tube', 'tape', 'hard'].includes(value)) {
      this._mode = value;
      this._updateCurve();
    }
  }

  private _updateCurve(): void {
    const amount = this._params.drive / 100;

    // Assign curve (use any to bypass TypeScript's strict Float32Array buffer typing)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const setCurve = (curve: Float32Array): void => { (this._shaper as any).curve = curve; };
    switch (this._mode) {
      case 'tube':
        setCurve(createTubeCurve(amount));
        break;
      case 'tape':
        setCurve(createTapeCurve(amount));
        break;
      case 'hard':
        setCurve(createHardClipCurve(amount));
        break;
      case 'soft':
      default:
        setCurve(createSaturationCurve(amount));
        break;
    }

    // Compensate output level
    const compensation = 1 / (1 + amount * 0.5);
    this._outputGain.gain.setValueAtTime(compensation, this.ctx.currentTime);
  }

  protected _applyParam(name: string, value: number, rampTime: number): void {
    switch (name) {
      case 'drive':
        this._updateCurve();
        break;

      case 'mix': {
        const wet = value / 100;
        this._setAudioParam(this._wetGain.gain, wet, rampTime);
        this._setAudioParam(this._bypassGain.gain, 1 - wet, rampTime);
        break;
      }
    }
  }

  protected _bypass(bypassed: boolean): void {
    if (bypassed) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this._shaper as any).curve = createSaturationCurve(0);
    } else {
      this._updateCurve();
    }
  }

  /** Access the underlying WaveShaperNode */
  get node(): WaveShaperNode {
    return this._shaper;
  }
}
