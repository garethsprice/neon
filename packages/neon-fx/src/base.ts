/**
 * Neon Audio Plugin System - Base Class
 *
 * Standard interface for chainable Web Audio API plugins.
 */

import type { ParameterDefinition, PluginState, PluginCategory, AudioPluginInterface } from './types';

export class AudioPlugin implements AudioPluginInterface {
  protected ctx: AudioContext;
  protected _bypassed: boolean = false;
  protected _params: Record<string, number> = {};

  protected _input: GainNode;
  protected _output: GainNode;
  protected _bypassGain: GainNode;
  protected _wetGain: GainNode;

  static get id(): string {
    return 'base';
  }

  static get name(): string {
    return 'Audio Plugin';
  }

  static get description(): string {
    return 'Base audio plugin class';
  }

  static get category(): PluginCategory {
    return 'utility';
  }

  static get parameterDefinitions(): readonly ParameterDefinition[] {
    return [];
  }

  constructor(audioContext: AudioContext, options: Record<string, unknown> = {}) {
    if (!audioContext) {
      throw new Error('AudioPlugin requires an AudioContext');
    }

    this.ctx = audioContext;

    // Create input/output gain nodes for routing
    this._input = this.ctx.createGain();
    this._output = this.ctx.createGain();

    // Bypass routing nodes
    this._bypassGain = this.ctx.createGain();
    this._wetGain = this.ctx.createGain();
    this._bypassGain.gain.value = 0;
    this._wetGain.gain.value = 1;

    // Initialize parameters from definitions with defaults
    const defs = (this.constructor as typeof AudioPlugin).parameterDefinitions;
    defs.forEach(def => {
      const value = options[def.name];
      this._params[def.name] = typeof value === 'number' ? value : (def.default ?? 0);
    });
  }

  /** Input node - connect sources here */
  get input(): GainNode {
    return this._input;
  }

  /** Output node - connect this to destination */
  get output(): GainNode {
    return this._output;
  }

  /**
   * Connect output to another node or plugin
   */
  connect(
    destination: AudioNode | AudioPlugin,
    outputIndex?: number,
    inputIndex?: number
  ): AudioNode | AudioPlugin {
    if (destination instanceof AudioPlugin) {
      this._output.connect(destination.input, outputIndex, inputIndex);
    } else {
      this._output.connect(destination, outputIndex, inputIndex);
    }
    return destination;
  }

  /**
   * Disconnect output
   */
  disconnect(destination?: AudioNode | AudioPlugin): void {
    if (destination) {
      if (destination instanceof AudioPlugin) {
        this._output.disconnect(destination.input);
      } else {
        this._output.disconnect(destination);
      }
    } else {
      this._output.disconnect();
    }
  }

  /** Get all current parameter values */
  get params(): Record<string, number> {
    return { ...this._params };
  }

  /**
   * Get a parameter value
   */
  getParam(name: string): number {
    return this._params[name];
  }

  /**
   * Set a parameter value
   */
  setParam(name: string, value: number, rampTime: number = 0): void {
    const def = (this.constructor as typeof AudioPlugin).parameterDefinitions.find(
      d => d.name === name
    );
    if (def) {
      // Clamp to min/max
      value = Math.max(def.min ?? -Infinity, Math.min(def.max ?? Infinity, value));
    }
    this._params[name] = value;
    this._applyParam(name, value, rampTime);
  }

  /**
   * Set multiple parameters at once
   */
  setParams(params: Record<string, number>, rampTime: number = 0): void {
    Object.entries(params).forEach(([name, value]) => {
      this.setParam(name, value, rampTime);
    });
  }

  /**
   * Apply parameter change to audio nodes (override in subclass)
   */
  protected _applyParam(_name: string, _value: number, _rampTime: number): void {
    // Override in subclass
  }

  /**
   * Helper to set AudioParam with optional ramping
   */
  protected _setAudioParam(audioParam: AudioParam, value: number, rampTime: number): void {
    const now = this.ctx.currentTime;
    if (rampTime > 0) {
      audioParam.setTargetAtTime(value, now, rampTime / 3);
    } else {
      audioParam.setValueAtTime(value, now);
    }
  }

  /**
   * Get the Nyquist frequency (max safe frequency for filters)
   * This is sampleRate / 2, with a small margin for safety
   */
  protected get _nyquist(): number {
    return this.ctx.sampleRate / 2 - 100;
  }

  /**
   * Clamp a frequency value to safe range for BiquadFilter
   */
  protected _clampFrequency(freq: number): number {
    return Math.min(Math.max(20, freq), this._nyquist);
  }

  /** Whether the plugin is bypassed */
  get bypassed(): boolean {
    return this._bypassed;
  }

  set bypassed(value: boolean) {
    this._bypassed = !!value;
    const now = this.ctx.currentTime;
    const rampTime = 0.02;

    if (this._bypassed) {
      this._wetGain.gain.setTargetAtTime(0, now, rampTime);
      this._bypassGain.gain.setTargetAtTime(1, now, rampTime);
    } else {
      this._wetGain.gain.setTargetAtTime(1, now, rampTime);
      this._bypassGain.gain.setTargetAtTime(0, now, rampTime);
    }

    this._bypass(this._bypassed);
  }

  /**
   * Handle bypass state change (override in subclass if needed)
   */
  protected _bypass(_bypassed: boolean): void {
    // Override in subclass if additional handling needed
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.disconnect();
    this._input.disconnect();
  }

  /**
   * Serialize plugin state
   */
  serialize(): PluginState {
    return {
      id: (this.constructor as typeof AudioPlugin).id,
      bypassed: this._bypassed,
      params: { ...this._params }
    };
  }

  /**
   * Restore plugin state
   */
  deserialize(state: Partial<PluginState>): void {
    if (state.params) {
      this.setParams(state.params);
    }
    if (state.bypassed !== undefined) {
      this.bypassed = state.bypassed;
    }
  }
}

/**
 * Helper to create a standard bypass routing setup
 * Call this after creating processing nodes in subclass constructor
 */
export function setupBypassRouting(
  plugin: AudioPlugin,
  processingInput: AudioNode,
  processingOutput: AudioNode
): void {
  // Access protected members via type assertion for setup helper
  const p = plugin as unknown as {
    _input: GainNode;
    _output: GainNode;
    _bypassGain: GainNode;
    _wetGain: GainNode;
  };

  // Dry path (bypass)
  p._input.connect(p._bypassGain);
  p._bypassGain.connect(p._output);

  // Wet path (processed)
  p._input.connect(processingInput);
  processingOutput.connect(p._wetGain);
  p._wetGain.connect(p._output);
}
