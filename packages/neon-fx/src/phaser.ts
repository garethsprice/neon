/**
 * Neon FX - Phaser
 *
 * Classic phaser effect using cascaded all-pass filters modulated by an LFO.
 * Creates sweeping notches in the frequency spectrum.
 */

import { AudioPlugin } from './base';
import { LFO } from './lfo';
import type { ParameterDefinition, PluginCategory } from './types';

export interface PhaserOptions {
  /** LFO rate in Hz (0.01-10) */
  rate?: number;
  /** Effect depth/intensity (0-100) */
  depth?: number;
  /** Feedback amount (0-90) */
  feedback?: number;
  /** Number of stages/poles (2, 4, 6, 8, 10, 12) */
  stages?: number;
  /** Base frequency for sweep in Hz */
  baseFreq?: number;
  /** Wet/dry mix (0-100) */
  mix?: number;
  /** Index signature for compatibility */
  [key: string]: unknown;
}

/**
 * Phaser effect with LFO-modulated all-pass filter stages.
 *
 * @example
 * ```ts
 * const phaser = new Phaser(audioContext, {
 *   rate: 0.5,
 *   depth: 70,
 *   feedback: 50,
 *   stages: 4
 * });
 *
 * source.connect(phaser.input);
 * phaser.connect(audioContext.destination);
 * ```
 */
export class Phaser extends AudioPlugin {
  static override readonly id: string = 'phaser';
  static override readonly name: string = 'Phaser';
  static override readonly description: string = 'Classic phaser with LFO-modulated all-pass filters';
  static override readonly category: PluginCategory = 'modulation';

  static override readonly parameterDefinitions: readonly ParameterDefinition[] = [
    { name: 'rate', min: 0.01, max: 10, default: 0.5 },
    { name: 'depth', min: 0, max: 100, default: 70 },
    { name: 'feedback', min: 0, max: 90, default: 40 },
    { name: 'stages', min: 2, max: 12, default: 4 },
    { name: 'baseFreq', min: 100, max: 4000, default: 1000 },
    { name: 'mix', min: 0, max: 100, default: 50 }
  ];

  private _lfo: LFO;
  private _allpassFilters: BiquadFilterNode[] = [];
  private _feedbackGain: GainNode;
  private _wetGainNode: GainNode;
  private _dryGainNode: GainNode;
  private _inputSplit: GainNode;

  constructor(audioContext: AudioContext, options: PhaserOptions = {}) {
    super(audioContext, options);

    // Create nodes
    this._inputSplit = this.ctx.createGain();
    this._inputSplit.gain.value = 1;

    this._wetGainNode = this.ctx.createGain();
    this._dryGainNode = this.ctx.createGain();
    this._feedbackGain = this.ctx.createGain();

    // Create LFO for modulation
    this._lfo = new LFO(audioContext, {
      rate: this._params.rate,
      depth: 0, // Will be set by _applyAllParams based on depth and baseFreq
      waveform: 'sine'
    });

    // Create initial all-pass filter stages
    this._createFilterStages(this._params.stages);

    // Connect LFO to all-pass filter frequencies
    this._connectLfoToFilters();

    // Set up routing
    this._setupRouting();

    // Apply initial parameters
    this._applyAllParams();
  }

  private _createFilterStages(count: number): void {
    // Disconnect existing filters
    this._allpassFilters.forEach(f => {
      f.disconnect();
    });
    this._allpassFilters = [];

    // Ensure even number of stages (2, 4, 6, 8, 10, 12)
    count = Math.max(2, Math.min(12, Math.round(count / 2) * 2));

    // Create new stages
    for (let i = 0; i < count; i++) {
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'allpass';
      filter.frequency.value = this._params.baseFreq;
      filter.Q.value = 0.5;
      this._allpassFilters.push(filter);
    }

    // Chain filters together
    for (let i = 0; i < this._allpassFilters.length - 1; i++) {
      this._allpassFilters[i].connect(this._allpassFilters[i + 1]);
    }
  }

  private _connectLfoToFilters(): void {
    this._allpassFilters.forEach(filter => {
      this._lfo.connect(filter.frequency);
    });
  }

  private _setupRouting(): void {
    // Wet path: input -> allpass chain -> feedback -> wet gain
    if (this._allpassFilters.length > 0) {
      this._inputSplit.connect(this._allpassFilters[0]);
      const lastFilter = this._allpassFilters[this._allpassFilters.length - 1];
      lastFilter.connect(this._wetGainNode);
      lastFilter.connect(this._feedbackGain);
      this._feedbackGain.connect(this._allpassFilters[0]);
    }

    // Dry path
    this._inputSplit.connect(this._dryGainNode);

    // Input routing (parallel paths)
    this._input.connect(this._inputSplit);
    this._input.connect(this._bypassGain);

    // Output routing
    this._wetGainNode.connect(this._output);
    this._dryGainNode.connect(this._output);
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
        // Depth controls LFO modulation amount
        const lfoAmount = (value / 100) * this._params.baseFreq * 0.8;
        this._lfo.setDepth(lfoAmount, rampTime);
        break;
      }
      case 'feedback':
        this._setAudioParam(this._feedbackGain.gain, value / 100 * 0.9, rampTime);
        break;
      case 'stages':
        // Recreate filter chain with new stage count
        this._rebuildFilterChain(Math.round(value));
        break;
      case 'baseFreq': {
        this._allpassFilters.forEach(filter => {
          this._setAudioParam(filter.frequency, value, rampTime);
        });
        // Update LFO depth for new base freq
        const lfoAmount = (this._params.depth / 100) * value * 0.8;
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

  private _rebuildFilterChain(stages: number): void {
    // Ensure even number of stages (2, 4, 6, 8, 10, 12)
    stages = Math.max(2, Math.min(12, Math.round(stages / 2) * 2));

    // Disconnect everything
    this._input.disconnect();
    this._inputSplit.disconnect();
    this._allpassFilters.forEach(f => f.disconnect());
    this._feedbackGain.disconnect();
    this._lfo.disconnect();
    this._wetGainNode.disconnect();
    this._dryGainNode.disconnect();
    this._bypassGain.disconnect();

    // Recreate filter stages
    this._createFilterStages(stages);
    this._connectLfoToFilters();
    this._setupRouting();

    // Reapply current params to new filters
    this._allpassFilters.forEach(filter => {
      filter.frequency.value = this._params.baseFreq;
    });

    // Restore bypass state
    if (this._bypassed) {
      this._bypass(true);
    }
  }

  private _applyAllParams(): void {
    this._applyParam('rate', this._params.rate, 0);
    this._applyParam('depth', this._params.depth, 0);
    this._applyParam('feedback', this._params.feedback, 0);
    this._applyParam('baseFreq', this._params.baseFreq, 0);
    this._applyParam('mix', this._params.mix, 0);
  }

  override destroy(): void {
    this._lfo.stop();
    this._allpassFilters.forEach(f => f.disconnect());
    this._feedbackGain.disconnect();
    this._wetGainNode.disconnect();
    this._dryGainNode.disconnect();
    super.destroy();
  }
}

/**
 * Vintage-style phaser with 6 stages and warm character
 */
export class VintagePhaser extends Phaser {
  static override readonly id = 'vintage-phaser';
  static override readonly name = 'Vintage Phaser';
  static override readonly description = '70s-style 6-stage phaser';

  constructor(audioContext: AudioContext, options: PhaserOptions = {}) {
    super(audioContext, {
      rate: 0.3,
      depth: 80,
      feedback: 60,
      stages: 6,
      baseFreq: 800,
      mix: 50,
      ...options
    });
  }
}
