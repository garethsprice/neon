/**
 * Neon FX - Flanger
 *
 * Classic flanger effect using a short modulated delay line.
 * Creates metallic, swooshing comb-filter effects.
 */

import { AudioPlugin } from './base';
import { LFO } from './lfo';
import type { ParameterDefinition, PluginCategory } from './types';

export interface FlangerOptions {
  /** LFO rate in Hz (0.01-10) */
  rate?: number;
  /** Effect depth/intensity (0-100) */
  depth?: number;
  /** Feedback amount (-90 to 90, negative inverts phase) */
  feedback?: number;
  /** Base delay time in ms (0.5-20) */
  delay?: number;
  /** Wet/dry mix (0-100) */
  mix?: number;
  /** Index signature for compatibility */
  [key: string]: unknown;
}

/**
 * Flanger effect with LFO-modulated delay line.
 *
 * @example
 * ```ts
 * const flanger = new Flanger(audioContext, {
 *   rate: 0.3,
 *   depth: 80,
 *   feedback: 50,
 *   delay: 5
 * });
 *
 * source.connect(flanger.input);
 * flanger.connect(audioContext.destination);
 * ```
 */
export class Flanger extends AudioPlugin {
  static override readonly id: string = 'flanger';
  static override readonly name: string = 'Flanger';
  static override readonly description: string = 'Classic flanger with modulated delay';
  static override readonly category: PluginCategory = 'modulation';

  static override readonly parameterDefinitions: readonly ParameterDefinition[] = [
    { name: 'rate', min: 0.01, max: 10, default: 0.3 },
    { name: 'depth', min: 0, max: 100, default: 70 },
    { name: 'feedback', min: -90, max: 90, default: 50 },
    { name: 'delay', min: 0.5, max: 20, default: 5 },
    { name: 'mix', min: 0, max: 100, default: 50 }
  ];

  private _lfo: LFO;
  private _delayNode: DelayNode;
  private _feedbackGain: GainNode;
  private _wetGainNode: GainNode;
  private _dryGainNode: GainNode;
  private _inputSplit: GainNode;
  private _delayInput: GainNode;

  constructor(audioContext: AudioContext, options: FlangerOptions = {}) {
    super(audioContext, options);

    // Create nodes
    this._inputSplit = this.ctx.createGain();
    this._inputSplit.gain.value = 1;

    this._delayInput = this.ctx.createGain();
    this._delayInput.gain.value = 1;

    // Delay line (max 50ms for flanger range)
    this._delayNode = this.ctx.createDelay(0.05);

    this._feedbackGain = this.ctx.createGain();
    this._wetGainNode = this.ctx.createGain();
    this._dryGainNode = this.ctx.createGain();

    // Create LFO for delay modulation
    this._lfo = new LFO(audioContext, {
      rate: this._params.rate,
      depth: 0, // Will be set by _applyAllParams based on depth and delay
      waveform: 'sine'
    });

    // Connect LFO to delay time
    this._lfo.connect(this._delayNode.delayTime);

    // Set up routing
    this._setupRouting();

    // Apply initial parameters
    this._applyAllParams();
  }

  private _setupRouting(): void {
    // Wet path: input -> delay -> wet gain -> output
    this._inputSplit.connect(this._delayInput);
    this._delayInput.connect(this._delayNode);
    this._delayNode.connect(this._wetGainNode);
    this._wetGainNode.connect(this._output);

    // Feedback path
    this._delayNode.connect(this._feedbackGain);
    this._feedbackGain.connect(this._delayInput);

    // Dry path
    this._inputSplit.connect(this._dryGainNode);
    this._dryGainNode.connect(this._output);

    // Input routing (parallel paths)
    this._input.connect(this._inputSplit);
    this._input.connect(this._bypassGain);

    // Bypass output
    this._bypassGain.connect(this._output);
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

  protected override _applyParam(name: string, value: number, rampTime: number): void {
    switch (name) {
      case 'rate':
        this._lfo.setRate(value, rampTime);
        break;
      case 'depth': {
        // Depth controls how much the delay time is modulated
        // At 100% depth, modulation sweeps from near 0 to 2x base delay
        const baseDelay = this._params.delay / 1000;
        const lfoAmount = (value / 100) * baseDelay * 0.9;
        this._lfo.setDepth(lfoAmount, rampTime);
        break;
      }
      case 'feedback': {
        // Feedback can be negative for phase-inverted sound
        const fb = value / 100 * 0.9;
        this._setAudioParam(this._feedbackGain.gain, fb, rampTime);
        break;
      }
      case 'delay': {
        // Base delay time in ms
        const delaySeconds = value / 1000;
        this._setAudioParam(this._delayNode.delayTime, delaySeconds, rampTime);
        // Update LFO depth for new delay time
        const lfoAmount = (this._params.depth / 100) * delaySeconds * 0.9;
        this._lfo.setDepth(lfoAmount, rampTime);
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

  private _applyAllParams(): void {
    this._applyParam('rate', this._params.rate, 0);
    this._applyParam('delay', this._params.delay, 0);
    this._applyParam('depth', this._params.depth, 0);
    this._applyParam('feedback', this._params.feedback, 0);
    this._applyParam('mix', this._params.mix, 0);
  }

  override destroy(): void {
    this._lfo.stop();
    this._delayNode.disconnect();
    this._feedbackGain.disconnect();
    this._wetGainNode.disconnect();
    this._dryGainNode.disconnect();
    this._delayInput.disconnect();
    super.destroy();
  }
}

/**
 * Jet flanger with aggressive feedback for metallic sounds
 */
export class JetFlanger extends Flanger {
  static override readonly id = 'jet-flanger';
  static override readonly name = 'Jet Flanger';
  static override readonly description = 'Aggressive jet-plane flanger effect';

  constructor(audioContext: AudioContext, options: FlangerOptions = {}) {
    super(audioContext, {
      rate: 0.15,
      depth: 90,
      feedback: 80,
      delay: 3,
      mix: 60,
      ...options
    });
  }
}

/**
 * Subtle flanger for gentle modulation
 */
export class SubtleFlanger extends Flanger {
  static override readonly id = 'subtle-flanger';
  static override readonly name = 'Subtle Flanger';
  static override readonly description = 'Gentle chorus-like flanger';

  constructor(audioContext: AudioContext, options: FlangerOptions = {}) {
    super(audioContext, {
      rate: 0.5,
      depth: 40,
      feedback: 20,
      delay: 7,
      mix: 35,
      ...options
    });
  }
}
