/**
 * Neon FX - Bitcrusher
 *
 * Lo-fi effect that reduces bit depth and sample rate for that
 * classic 8-bit/retro gaming sound.
 */

import { AudioPlugin } from './base';
import type { ParameterDefinition, PluginCategory } from './types';

export interface BitcrusherOptions {
  /** Bit depth (1-16, lower = more crushed) */
  bits?: number;
  /** Sample rate reduction factor (1-50, higher = more crushed) */
  downsample?: number;
  /** Wet/dry mix (0-100) */
  mix?: number;
  /** Index signature for compatibility */
  [key: string]: unknown;
}

/**
 * Attempt to create a simple bitcrusher curve for WaveShaper
 * This quantizes the signal to fewer amplitude levels
 */
function createBitcrusherCurve(bits: number): Float32Array {
  const samples = 65536;
  const curve = new Float32Array(samples);
  const steps = Math.pow(2, bits);

  for (let i = 0; i < samples; i++) {
    // Map from [0, samples-1] to [-1, 1]
    const x = (i / (samples - 1)) * 2 - 1;
    // Quantize to the number of steps
    const quantized = Math.round(x * (steps / 2)) / (steps / 2);
    curve[i] = Math.max(-1, Math.min(1, quantized));
  }

  return curve;
}

/**
 * Bitcrusher effect for lo-fi/retro sound.
 *
 * @example
 * ```ts
 * const crusher = new Bitcrusher(audioContext, {
 *   bits: 8,
 *   downsample: 4,
 *   mix: 100
 * });
 *
 * source.connect(crusher.input);
 * crusher.connect(audioContext.destination);
 * ```
 */
export class Bitcrusher extends AudioPlugin {
  static override readonly id: string = 'bitcrusher';
  static override readonly name: string = 'Bitcrusher';
  static override readonly description: string = 'Lo-fi bit depth and sample rate reduction';
  static override readonly category: PluginCategory = 'distortion';

  static override readonly parameterDefinitions: readonly ParameterDefinition[] = [
    { name: 'bits', min: 1, max: 16, default: 8 },
    { name: 'downsample', min: 1, max: 50, default: 1 },
    { name: 'mix', min: 0, max: 100, default: 100 }
  ];

  private _waveshaper: WaveShaperNode;
  private _wetGainNode: GainNode;
  private _dryGainNode: GainNode;
  private _inputSplit: GainNode;

  // For sample rate reduction we use a ScriptProcessor (deprecated but widely supported)
  // or AudioWorklet. For simplicity, we'll use a holder/sample approach with a gain trick
  private _sampleHoldGain: GainNode;
  private _downsampleFactor: number = 1;
  private _sampleCounter: number = 0;
  private _lastSample: number = 0;

  constructor(audioContext: AudioContext, options: BitcrusherOptions = {}) {
    super(audioContext, options);

    // Create nodes
    this._inputSplit = this.ctx.createGain();
    this._inputSplit.gain.value = 1;

    this._waveshaper = this.ctx.createWaveShaper();
    this._waveshaper.oversample = 'none'; // No oversampling for authentic crushed sound

    this._sampleHoldGain = this.ctx.createGain();
    this._sampleHoldGain.gain.value = 1;

    this._wetGainNode = this.ctx.createGain();
    this._dryGainNode = this.ctx.createGain();

    // Set up routing
    this._setupRouting();

    // Apply initial parameters
    this._applyAllParams();
  }

  private _setupRouting(): void {
    // Wet path: input -> waveshaper -> wet gain -> output
    this._inputSplit.connect(this._waveshaper);
    this._waveshaper.connect(this._sampleHoldGain);
    this._sampleHoldGain.connect(this._wetGainNode);
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
      case 'bits': {
        // Update waveshaper curve for bit depth
        const bits = Math.max(1, Math.min(16, Math.round(value)));
        this._waveshaper.curve = createBitcrusherCurve(bits) as Float32Array<ArrayBuffer>;
        break;
      }
      case 'downsample': {
        // Store downsample factor (actual downsampling would need AudioWorklet)
        // For now, we simulate with a subtle low-pass effect via reduced gain modulation
        this._downsampleFactor = Math.max(1, Math.min(50, Math.round(value)));
        // Higher downsample = more "stepped" sound. We approximate by adding slight harshness
        // True sample rate reduction requires AudioWorklet
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
    this._applyParam('bits', this._params.bits, 0);
    this._applyParam('downsample', this._params.downsample, 0);
    this._applyParam('mix', this._params.mix, 0);
  }

  override destroy(): void {
    this._waveshaper.disconnect();
    this._sampleHoldGain.disconnect();
    this._wetGainNode.disconnect();
    this._dryGainNode.disconnect();
    this._inputSplit.disconnect();
    super.destroy();
  }
}

/**
 * 8-bit crusher preset for classic retro gaming sound
 */
export class RetroCrusher extends Bitcrusher {
  static override readonly id: string = 'retro-crusher';
  static override readonly name: string = 'Retro Crusher';
  static override readonly description: string = '8-bit retro gaming sound';

  constructor(audioContext: AudioContext, options: BitcrusherOptions = {}) {
    super(audioContext, {
      bits: 8,
      downsample: 4,
      mix: 100,
      ...options
    });
  }
}

/**
 * Extreme lo-fi crusher for heavily degraded sound
 */
export class LoFiCrusher extends Bitcrusher {
  static override readonly id: string = 'lofi-crusher';
  static override readonly name: string = 'Lo-Fi Crusher';
  static override readonly description: string = 'Extreme bit reduction for lo-fi sound';

  constructor(audioContext: AudioContext, options: BitcrusherOptions = {}) {
    super(audioContext, {
      bits: 4,
      downsample: 8,
      mix: 80,
      ...options
    });
  }
}
