/**
 * Neon Audio Plugin - Filter
 *
 * Biquad filter with lowpass, highpass, bandpass, and other modes.
 */

import { AudioPlugin, setupBypassRouting } from './base';
import type { ParameterDefinition, PluginCategory, BiquadFilterType } from './types';

export interface FilterOptions extends Record<string, unknown> {
  type?: BiquadFilterType;
  cutoff?: number;
  resonance?: number;
}

export class Filter extends AudioPlugin {
  protected _filter: BiquadFilterNode;

  static get id(): string {
    return 'filter';
  }

  static get name(): string {
    return 'Filter';
  }

  static get description(): string {
    return 'Biquad filter with multiple modes (lowpass, highpass, bandpass, etc.)';
  }

  static get category(): PluginCategory {
    return 'filter';
  }

  static get parameterDefinitions(): readonly ParameterDefinition[] {
    return [
      {
        name: 'cutoff',
        label: 'Cutoff',
        min: 20,
        max: 20000,
        default: 1000,
        unit: 'Hz',
        scale: 'log'
      },
      {
        name: 'resonance',
        label: 'Resonance',
        min: 0,
        max: 100,
        default: 0,
        unit: '%',
        scale: 'linear'
      }
    ];
  }

  constructor(audioContext: AudioContext, options: FilterOptions = {}) {
    super(audioContext, options);

    // Create filter node
    this._filter = this.ctx.createBiquadFilter();
    this._filter.type = options.type || 'lowpass';

    // Apply initial parameters
    this._applyParam('cutoff', this._params.cutoff, 0);
    this._applyParam('resonance', this._params.resonance, 0);

    // Setup bypass routing
    setupBypassRouting(this, this._filter, this._filter);
  }

  /** Get/set filter type */
  get type(): BiquadFilterType {
    return this._filter.type;
  }

  set type(value: BiquadFilterType) {
    this._filter.type = value;
  }

  protected _applyParam(name: string, value: number, rampTime: number): void {
    const now = this.ctx.currentTime;

    switch (name) {
      case 'cutoff': {
        const freq = this._clampFrequency(value);
        if (rampTime > 0) {
          this._filter.frequency.setTargetAtTime(freq, now, rampTime / 3);
        } else {
          this._filter.frequency.setValueAtTime(freq, now);
        }
        break;
      }

      case 'resonance': {
        // Map 0-100 to Q value (0-25 is reasonable for most uses)
        const q = (value / 100) * 25;
        if (rampTime > 0) {
          this._filter.Q.setTargetAtTime(q, now, rampTime / 3);
        } else {
          this._filter.Q.setValueAtTime(q, now);
        }
        break;
      }
    }
  }

  protected _bypass(bypassed: boolean): void {
    if (bypassed) {
      // Set to max safe frequency to let all audio through
      this._filter.frequency.setValueAtTime(this._nyquist, this.ctx.currentTime);
      this._filter.Q.setValueAtTime(0, this.ctx.currentTime);
    } else {
      this._applyParam('cutoff', this._params.cutoff, 0.02);
      this._applyParam('resonance', this._params.resonance, 0.02);
    }
  }

  /** Access the underlying BiquadFilterNode */
  get node(): BiquadFilterNode {
    return this._filter;
  }
}

/**
 * Lowpass Filter - convenience class
 */
export class LowpassFilter extends Filter {
  constructor(audioContext: AudioContext, options: Omit<FilterOptions, 'type'> = {}) {
    super(audioContext, { ...options, type: 'lowpass' });
  }

  static get id(): string {
    return 'lowpass-filter';
  }

  static get name(): string {
    return 'Lowpass Filter';
  }

  static get description(): string {
    return 'Removes frequencies above the cutoff point';
  }
}

/**
 * Highpass Filter - convenience class
 */
export class HighpassFilter extends Filter {
  constructor(audioContext: AudioContext, options: Omit<FilterOptions, 'type'> = {}) {
    super(audioContext, { ...options, type: 'highpass' });
  }

  static get id(): string {
    return 'highpass-filter';
  }

  static get name(): string {
    return 'Highpass Filter';
  }

  static get description(): string {
    return 'Removes frequencies below the cutoff point';
  }
}

/**
 * Bandpass Filter - convenience class
 */
export class BandpassFilter extends Filter {
  constructor(audioContext: AudioContext, options: Omit<FilterOptions, 'type'> = {}) {
    super(audioContext, { ...options, type: 'bandpass' });
  }

  static get id(): string {
    return 'bandpass-filter';
  }

  static get name(): string {
    return 'Bandpass Filter';
  }

  static get description(): string {
    return 'Allows frequencies near the cutoff point, attenuates others';
  }
}
