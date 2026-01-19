/**
 * Neon Audio Plugin - Compressor
 *
 * Dynamics compressor for controlling dynamic range.
 */

import { AudioPlugin, setupBypassRouting } from './base';
import type { ParameterDefinition, PluginCategory } from './types';

export interface CompressorOptions extends Record<string, unknown> {
  threshold?: number;
  ratio?: number;
  attack?: number;
  release?: number;
  knee?: number;
  makeupGain?: number;
}

export class Compressor extends AudioPlugin {
  protected _compressor: DynamicsCompressorNode;
  protected _makeupGain: GainNode;

  static get id(): string {
    return 'compressor';
  }

  static get name(): string {
    return 'Compressor';
  }

  static get description(): string {
    return 'Dynamics compressor for controlling dynamic range';
  }

  static get category(): PluginCategory {
    return 'dynamics';
  }

  static get parameterDefinitions(): readonly ParameterDefinition[] {
    return [
      {
        name: 'threshold',
        label: 'Threshold',
        min: -100,
        max: 0,
        default: -24,
        unit: 'dB',
        scale: 'linear'
      },
      {
        name: 'ratio',
        label: 'Ratio',
        min: 1,
        max: 20,
        default: 12,
        unit: ':1',
        scale: 'linear'
      },
      {
        name: 'attack',
        label: 'Attack',
        min: 0,
        max: 1000,
        default: 3,
        unit: 'ms',
        scale: 'log'
      },
      {
        name: 'release',
        label: 'Release',
        min: 0,
        max: 1000,
        default: 250,
        unit: 'ms',
        scale: 'log'
      },
      {
        name: 'knee',
        label: 'Knee',
        min: 0,
        max: 40,
        default: 30,
        unit: 'dB',
        scale: 'linear'
      },
      {
        name: 'makeupGain',
        label: 'Makeup',
        min: -12,
        max: 12,
        default: 0,
        unit: 'dB',
        scale: 'linear'
      }
    ];
  }

  constructor(audioContext: AudioContext, options: CompressorOptions = {}) {
    super(audioContext, options);

    // Create compressor node
    this._compressor = this.ctx.createDynamicsCompressor();

    // Create makeup gain
    this._makeupGain = this.ctx.createGain();
    this._makeupGain.gain.value = 1;

    // Wire processing chain
    this._compressor.connect(this._makeupGain);

    // Apply initial parameters (check for undefined to support subclasses with fewer params)
    if (this._params.threshold !== undefined) this._applyParam('threshold', this._params.threshold, 0);
    if (this._params.ratio !== undefined) this._applyParam('ratio', this._params.ratio, 0);
    if (this._params.attack !== undefined) this._applyParam('attack', this._params.attack, 0);
    if (this._params.release !== undefined) this._applyParam('release', this._params.release, 0);
    if (this._params.knee !== undefined) this._applyParam('knee', this._params.knee, 0);
    if (this._params.makeupGain !== undefined) this._applyParam('makeupGain', this._params.makeupGain, 0);

    // Setup bypass routing
    setupBypassRouting(this, this._compressor, this._makeupGain);
  }

  protected _applyParam(name: string, value: number, rampTime: number): void {
    const now = this.ctx.currentTime;

    switch (name) {
      case 'threshold':
        if (rampTime > 0) {
          this._compressor.threshold.setTargetAtTime(value, now, rampTime / 3);
        } else {
          this._compressor.threshold.setValueAtTime(value, now);
        }
        break;

      case 'ratio':
        if (rampTime > 0) {
          this._compressor.ratio.setTargetAtTime(value, now, rampTime / 3);
        } else {
          this._compressor.ratio.setValueAtTime(value, now);
        }
        break;

      case 'attack': {
        const attackSec = value / 1000;
        if (rampTime > 0) {
          this._compressor.attack.setTargetAtTime(attackSec, now, rampTime / 3);
        } else {
          this._compressor.attack.setValueAtTime(attackSec, now);
        }
        break;
      }

      case 'release': {
        const releaseSec = value / 1000;
        if (rampTime > 0) {
          this._compressor.release.setTargetAtTime(releaseSec, now, rampTime / 3);
        } else {
          this._compressor.release.setValueAtTime(releaseSec, now);
        }
        break;
      }

      case 'knee':
        if (rampTime > 0) {
          this._compressor.knee.setTargetAtTime(value, now, rampTime / 3);
        } else {
          this._compressor.knee.setValueAtTime(value, now);
        }
        break;

      case 'makeupGain': {
        const gain = Math.pow(10, value / 20);
        this._setAudioParam(this._makeupGain.gain, gain, rampTime);
        break;
      }
    }
  }

  protected _bypass(_bypassed: boolean): void {
    // Compressor bypasses cleanly via the base class routing
  }

  /** Get current gain reduction in dB (for metering) */
  get reduction(): number {
    return this._compressor.reduction;
  }

  /** Access the underlying DynamicsCompressorNode */
  get node(): DynamicsCompressorNode {
    return this._compressor;
  }
}

/**
 * Limiter - Compressor preset for limiting
 */
export class Limiter extends Compressor {
  constructor(audioContext: AudioContext, options: CompressorOptions = {}) {
    super(audioContext, {
      threshold: options.threshold ?? -3,
      release: options.release ?? 100,
      makeupGain: options.makeupGain ?? 0,
      ...options
    });

    // Set fixed limiter values directly on the compressor node
    this._compressor.ratio.value = 20;      // High ratio for limiting
    this._compressor.attack.value = 0.001;  // Fast attack to catch peaks
    this._compressor.knee.value = 0;        // Hard knee for brick-wall
  }

  static get id(): string {
    return 'limiter';
  }

  static get name(): string {
    return 'Limiter';
  }

  static get description(): string {
    return 'Hard limiter to prevent clipping';
  }

  static get parameterDefinitions(): readonly ParameterDefinition[] {
    return [
      {
        name: 'threshold',
        label: 'Ceiling',
        min: -24,
        max: 0,
        default: -6,
        unit: 'dB',
        scale: 'linear'
      },
      {
        name: 'release',
        label: 'Release',
        min: 10,
        max: 500,
        default: 100,
        unit: 'ms',
        scale: 'log'
      },
      {
        name: 'makeupGain',
        label: 'Gain',
        min: 0,
        max: 12,
        default: 0,
        unit: 'dB',
        scale: 'linear'
      }
    ];
  }
}
