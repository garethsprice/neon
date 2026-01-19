/**
 * Neon FX - Distortion
 *
 * Aggressive distortion effect with multiple drive types and tone shaping.
 * More aggressive than Saturation, designed for guitar amp-style overdrive.
 */

import { AudioPlugin } from './base';
import type { ParameterDefinition, PluginCategory } from './types';

export type DistortionType = 'soft' | 'hard' | 'fuzz' | 'overdrive';

export interface DistortionOptions {
  /** Drive amount (0-100) */
  drive?: number;
  /** Tone control - low values = darker, high = brighter (0-100) */
  tone?: number;
  /** Output level (0-100) */
  level?: number;
  /** Distortion type */
  type?: DistortionType;
  /** Wet/dry mix (0-100) */
  mix?: number;
  /** Index signature for compatibility */
  [key: string]: unknown;
}

/**
 * Create a soft clipping curve (tube-like)
 */
function createSoftClipCurve(drive: number): Float32Array {
  const samples = 44100;
  const curve = new Float32Array(samples);
  const k = drive * 10 + 1;

  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    curve[i] = Math.tanh(k * x);
  }

  return curve;
}

/**
 * Create a hard clipping curve (transistor-like)
 */
function createHardClipCurve(drive: number): Float32Array {
  const samples = 44100;
  const curve = new Float32Array(samples);
  const threshold = Math.max(0.01, 1 - (drive / 100) * 0.9);

  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    if (x > threshold) {
      curve[i] = threshold + (x - threshold) * 0.1;
    } else if (x < -threshold) {
      curve[i] = -threshold + (x + threshold) * 0.1;
    } else {
      curve[i] = x;
    }
    curve[i] = Math.max(-1, Math.min(1, curve[i]));
  }

  return curve;
}

/**
 * Create a fuzz curve (aggressive asymmetric clipping)
 */
function createFuzzCurve(drive: number): Float32Array {
  const samples = 44100;
  const curve = new Float32Array(samples);
  const k = (drive / 100) * 50 + 1;

  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    // Asymmetric distortion for fuzz character
    if (x >= 0) {
      curve[i] = 1 - Math.exp(-k * x);
    } else {
      curve[i] = -(1 - Math.exp(k * x * 0.8));
    }
  }

  return curve;
}

/**
 * Create an overdrive curve (warm, amp-like)
 */
function createOverdriveCurve(drive: number): Float32Array {
  const samples = 44100;
  const curve = new Float32Array(samples);
  const k = (drive / 100) * 20 + 1;

  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    // Soft knee compression style
    const sign = x >= 0 ? 1 : -1;
    const absX = Math.abs(x);
    curve[i] = sign * (1 - Math.pow(1 - absX, k)) * (absX > 0 ? 1 : 0) + (absX === 0 ? 0 : 0);
    // Apply tanh for final shaping
    curve[i] = Math.tanh(curve[i] * 2);
  }

  return curve;
}

/**
 * Distortion effect with multiple drive types.
 *
 * @example
 * ```ts
 * const distortion = new Distortion(audioContext, {
 *   drive: 60,
 *   tone: 50,
 *   type: 'overdrive',
 *   mix: 100
 * });
 *
 * source.connect(distortion.input);
 * distortion.connect(audioContext.destination);
 * ```
 */
export class Distortion extends AudioPlugin {
  static override readonly id: string = 'distortion';
  static override readonly name: string = 'Distortion';
  static override readonly description: string = 'Aggressive distortion with multiple drive types';
  static override readonly category: PluginCategory = 'distortion';

  static override readonly parameterDefinitions: readonly ParameterDefinition[] = [
    { name: 'drive', min: 0, max: 100, default: 50 },
    { name: 'tone', min: 0, max: 100, default: 50 },
    { name: 'level', min: 0, max: 100, default: 50 },
    { name: 'mix', min: 0, max: 100, default: 100 }
  ];

  private _waveshaper: WaveShaperNode;
  private _preGain: GainNode;
  private _toneFilter: BiquadFilterNode;
  private _postGain: GainNode;
  private _wetGainNode: GainNode;
  private _dryGainNode: GainNode;
  private _inputSplit: GainNode;
  private _distortionType: DistortionType = 'overdrive';

  constructor(audioContext: AudioContext, options: DistortionOptions = {}) {
    super(audioContext, options);

    this._distortionType = (options.type as DistortionType) || 'overdrive';

    // Create nodes
    this._inputSplit = this.ctx.createGain();
    this._inputSplit.gain.value = 1;

    this._preGain = this.ctx.createGain();
    this._preGain.gain.value = 1;

    this._waveshaper = this.ctx.createWaveShaper();
    this._waveshaper.oversample = '2x';

    this._toneFilter = this.ctx.createBiquadFilter();
    this._toneFilter.type = 'lowpass';
    this._toneFilter.Q.value = 0.5;

    this._postGain = this.ctx.createGain();
    this._postGain.gain.value = 0.5;

    this._wetGainNode = this.ctx.createGain();
    this._dryGainNode = this.ctx.createGain();

    // Set up routing
    this._setupRouting();

    // Apply initial parameters
    this._applyAllParams();
  }

  private _setupRouting(): void {
    // Wet path: input -> preGain -> waveshaper -> toneFilter -> postGain -> wet gain -> output
    this._inputSplit.connect(this._preGain);
    this._preGain.connect(this._waveshaper);
    this._waveshaper.connect(this._toneFilter);
    this._toneFilter.connect(this._postGain);
    this._postGain.connect(this._wetGainNode);
    this._wetGainNode.connect(this._output);

    // Dry path
    this._inputSplit.connect(this._dryGainNode);
    this._dryGainNode.connect(this._output);

    // Input routing
    this._input.connect(this._inputSplit);
    this._input.connect(this._bypassGain);

    // Bypass output
    this._bypassGain.connect(this._output);
  }

  protected override _applyParam(name: string, value: number, rampTime: number): void {
    switch (name) {
      case 'drive': {
        // Update waveshaper curve based on drive and type
        this._updateCurve(value);
        // Pre-gain boosts signal into waveshaper
        const preGainValue = 1 + (value / 100) * 4;
        this._setAudioParam(this._preGain.gain, preGainValue, rampTime);
        break;
      }
      case 'tone': {
        // Map tone 0-100 to frequency 500-8000 Hz
        const freq = 500 + (value / 100) * 7500;
        this._setAudioParam(this._toneFilter.frequency, freq, rampTime);
        break;
      }
      case 'level': {
        // Output level
        const level = value / 100;
        this._setAudioParam(this._postGain.gain, level, rampTime);
        break;
      }
      case 'mix': {
        const wet = value / 100;
        const dry = 1 - wet;
        this._setAudioParam(this._wetGainNode.gain, wet, rampTime);
        this._setAudioParam(this._dryGainNode.gain, dry, rampTime);
        break;
      }
    }
  }

  private _updateCurve(drive: number): void {
    let curve: Float32Array;

    switch (this._distortionType) {
      case 'soft':
        curve = createSoftClipCurve(drive);
        break;
      case 'hard':
        curve = createHardClipCurve(drive);
        break;
      case 'fuzz':
        curve = createFuzzCurve(drive);
        break;
      case 'overdrive':
      default:
        curve = createOverdriveCurve(drive);
        break;
    }

    this._waveshaper.curve = curve as Float32Array<ArrayBuffer>;
  }

  /** Get or set the distortion type */
  get type(): DistortionType {
    return this._distortionType;
  }

  set type(value: DistortionType) {
    this._distortionType = value;
    this._updateCurve(this._params.drive);
  }

  protected override _bypass(bypassed: boolean): void {
    const now = this.ctx.currentTime;
    const rampTime = 0.02;

    if (bypassed) {
      this._wetGainNode.gain.setTargetAtTime(0, now, rampTime);
      this._dryGainNode.gain.setTargetAtTime(0, now, rampTime);
      this._bypassGain.gain.setTargetAtTime(1, now, rampTime);
    } else {
      this._bypassGain.gain.setTargetAtTime(0, now, rampTime);
      this._applyParam('mix', this._params.mix, rampTime * 3);
    }
  }

  private _applyAllParams(): void {
    this._applyParam('drive', this._params.drive, 0);
    this._applyParam('tone', this._params.tone, 0);
    this._applyParam('level', this._params.level, 0);
    this._applyParam('mix', this._params.mix, 0);
  }

  override destroy(): void {
    this._waveshaper.disconnect();
    this._preGain.disconnect();
    this._toneFilter.disconnect();
    this._postGain.disconnect();
    this._wetGainNode.disconnect();
    this._dryGainNode.disconnect();
    this._inputSplit.disconnect();
    super.destroy();
  }
}

/**
 * Classic overdrive for warm, amp-like tone
 */
export class Overdrive extends Distortion {
  static override readonly id: string = 'overdrive';
  static override readonly name: string = 'Overdrive';
  static override readonly description: string = 'Warm tube-style overdrive';

  constructor(audioContext: AudioContext, options: DistortionOptions = {}) {
    super(audioContext, {
      drive: 40,
      tone: 60,
      level: 60,
      mix: 100,
      type: 'overdrive',
      ...options
    });
  }
}

/**
 * High-gain fuzz distortion
 */
export class Fuzz extends Distortion {
  static override readonly id: string = 'fuzz';
  static override readonly name: string = 'Fuzz';
  static override readonly description: string = 'Aggressive vintage fuzz';

  constructor(audioContext: AudioContext, options: DistortionOptions = {}) {
    super(audioContext, {
      drive: 70,
      tone: 40,
      level: 50,
      mix: 100,
      type: 'fuzz',
      ...options
    });
  }
}
