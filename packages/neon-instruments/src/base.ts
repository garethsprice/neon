/**
 * Neon Instruments - Base Class
 *
 * Abstract source module with sample-accurate, schedulable note methods.
 * Mirrors the @neon/fx AudioPlugin parameter/serialization pattern so racks
 * can treat instruments and effects uniformly, but:
 *  - it is a source: `output` only, no input, no bypass routing
 *  - every note method takes an absolute AudioContext-clock `time`
 *  - modulation writes go through setModulatedParam (never corrupts state)
 */

import type { ParameterDefinition } from '@neon/fx';
import type { InstrumentCategory, InstrumentState, NoteEvent, NoteMode } from './types';

export abstract class InstrumentModule {
  protected ctx: AudioContext;
  protected _params: Record<string, number> = {};
  readonly output: GainNode;

  static get id(): string {
    return 'instrument';
  }

  static get name(): string {
    return 'Instrument Module';
  }

  static get description(): string {
    return 'Base instrument module class';
  }

  static get category(): InstrumentCategory {
    return 'synth';
  }

  static get parameterDefinitions(): readonly ParameterDefinition[] {
    return [];
  }

  static get noteMode(): NoteMode {
    return 'pitched';
  }

  static get lanes(): readonly string[] | undefined {
    return undefined;
  }

  constructor(audioContext: AudioContext, options: Record<string, unknown> = {}) {
    if (!audioContext) {
      throw new Error('InstrumentModule requires an AudioContext');
    }
    this.ctx = audioContext;
    this.output = this.ctx.createGain();

    const defs = (this.constructor as typeof InstrumentModule).parameterDefinitions;
    defs.forEach(def => {
      const value = options[def.name];
      this._params[def.name] = typeof value === 'number' ? value : (def.default ?? 0);
    });
  }

  /**
   * Async resource loading (sample sprites etc). Resolves immediately for
   * purely synthesized instruments.
   */
  async load(): Promise<void> {
    // Override in subclass if resources must be fetched/decoded.
  }

  /**
   * Start a note at an absolute AudioContext time.
   * Implementations MUST schedule at `time`, never at currentTime.
   */
  abstract noteOn(note: number, velocity: number, time: number): void;

  /** Release a note at an absolute AudioContext time. */
  abstract noteOff(note: number, time: number): void;

  /**
   * noteOn + scheduled noteOff. Subclasses with envelopes should override to
   * pre-schedule the complete envelope (no future cancellation needed).
   */
  trigger(ev: NoteEvent): void {
    this.noteOn(ev.note, ev.velocity, ev.time);
    if (ev.duration !== undefined) {
      this.noteOff(ev.note, ev.time + ev.duration);
    }
  }

  /**
   * Silence the instrument: ramp down anything sounding at `afterTime` and
   * cancel every event scheduled after it (the lookahead window on stop).
   */
  abstract allNotesOff(afterTime?: number): void;

  /** Get all current parameter values */
  get params(): Record<string, number> {
    return { ...this._params };
  }

  getParam(name: string): number {
    return this._params[name];
  }

  setParam(name: string, value: number, rampTime: number = 0): void {
    const def = (this.constructor as typeof InstrumentModule).parameterDefinitions.find(
      d => d.name === name
    );
    if (def) {
      value = Math.max(def.min ?? -Infinity, Math.min(def.max ?? Infinity, value));
    }
    this._params[name] = value;
    this._applyParam(name, value, rampTime);
  }

  setParams(params: Record<string, number>, rampTime: number = 0): void {
    Object.entries(params).forEach(([name, value]) => {
      this.setParam(name, value, rampTime);
    });
  }

  /**
   * Apply a modulated value to the audio nodes WITHOUT touching stored state,
   * so serialize() keeps returning the user's base value. Clamped to range.
   */
  setModulatedParam(name: string, value: number, rampTime: number = 0): void {
    const def = (this.constructor as typeof InstrumentModule).parameterDefinitions.find(
      d => d.name === name
    );
    if (def) {
      value = Math.max(def.min ?? -Infinity, Math.min(def.max ?? Infinity, value));
    }
    this._applyParam(name, value, rampTime);
  }

  /**
   * Return the backing AudioParam for audio-rate modulation, or null when the
   * param's declared unit does not map 1:1 onto an AudioParam.
   */
  getModTarget(_name: string): AudioParam | null {
    return null;
  }

  /** Apply parameter change to audio nodes (override in subclass). */
  protected abstract _applyParam(name: string, value: number, rampTime: number): void;

  /** Helper to set an AudioParam with optional smoothing. */
  protected _setAudioParam(audioParam: AudioParam, value: number, rampTime: number): void {
    const now = this.ctx.currentTime;
    if (rampTime > 0) {
      audioParam.setTargetAtTime(value, now, rampTime / 3);
    } else {
      audioParam.setValueAtTime(value, now);
    }
  }

  connect(destination: AudioNode | { input: AudioNode }): void {
    if ('input' in destination && !(destination instanceof AudioNode)) {
      this.output.connect(destination.input);
    } else {
      this.output.connect(destination as AudioNode);
    }
  }

  disconnect(): void {
    this.output.disconnect();
  }

  serialize(): InstrumentState {
    const state: InstrumentState = {
      id: (this.constructor as typeof InstrumentModule).id,
      params: { ...this._params }
    };
    const extra = this._serializeExtra();
    if (extra && Object.keys(extra).length > 0) {
      state.extra = extra;
    }
    return state;
  }

  deserialize(state: Partial<InstrumentState>): void {
    if (state.params) {
      this.setParams(state.params);
    }
    if (state.extra) {
      this._deserializeExtra(state.extra);
    }
  }

  /** Non-numeric state hook (waveform name, lane params, ...). */
  protected _serializeExtra(): Record<string, unknown> | undefined {
    return undefined;
  }

  protected _deserializeExtra(_extra: Record<string, unknown>): void {
    // Override in subclass.
  }

  destroy(): void {
    this.allNotesOff();
    this.disconnect();
  }
}
