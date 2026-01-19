/**
 * Neon Audio Plugin - Sidechain
 *
 * Sidechain ducking effect for the classic "pumping" sound.
 * Uses envelope following to duck the main signal based on sidechain input.
 */

import { AudioPlugin, setupBypassRouting } from './base';
import type { ParameterDefinition, PluginCategory } from './types';

export interface SidechainOptions extends Record<string, unknown> {
  amount?: number;
  attack?: number;
  release?: number;
  threshold?: number;
}

export class Sidechain extends AudioPlugin {
  private _duckGain: GainNode;
  private _sidechainInput: GainNode;
  private _analyser: AnalyserNode;
  private _envelope: number;
  private _targetEnvelope: number;
  private _isRunning: boolean;
  private _analysisBuffer: Float32Array;

  static get id(): string {
    return 'sidechain';
  }

  static get name(): string {
    return 'Sidechain';
  }

  static get description(): string {
    return 'Sidechain ducking for pumping effects';
  }

  static get category(): PluginCategory {
    return 'dynamics';
  }

  static get parameterDefinitions(): readonly ParameterDefinition[] {
    return [
      {
        name: 'amount',
        label: 'Amount',
        min: 0,
        max: 100,
        default: 50,
        unit: '%',
        scale: 'linear'
      },
      {
        name: 'attack',
        label: 'Attack',
        min: 1,
        max: 100,
        default: 5,
        unit: 'ms',
        scale: 'log'
      },
      {
        name: 'release',
        label: 'Release',
        min: 10,
        max: 1000,
        default: 100,
        unit: 'ms',
        scale: 'log'
      },
      {
        name: 'threshold',
        label: 'Threshold',
        min: -60,
        max: 0,
        default: -20,
        unit: 'dB',
        scale: 'linear'
      }
    ];
  }

  constructor(audioContext: AudioContext, options: SidechainOptions = {}) {
    super(audioContext, options);

    // Main signal gain (this gets ducked)
    this._duckGain = this.ctx.createGain();
    this._duckGain.gain.value = 1;

    // Sidechain input and analysis chain
    this._sidechainInput = this.ctx.createGain();
    this._analyser = this.ctx.createAnalyser();
    this._analyser.fftSize = 256;
    this._analyser.smoothingTimeConstant = 0.3;

    // Connect sidechain to analyser
    this._sidechainInput.connect(this._analyser);

    // Setup bypass routing for main signal
    setupBypassRouting(this, this._duckGain, this._duckGain);

    // Envelope state
    this._envelope = 1;
    this._targetEnvelope = 1;
    this._isRunning = false;
    this._analysisBuffer = new Float32Array(this._analyser.fftSize);

    // Start envelope follower
    this._startEnvelopeFollower();
  }

  /** Sidechain input node - connect trigger source here */
  get sidechainInput(): GainNode {
    return this._sidechainInput;
  }

  private _startEnvelopeFollower(): void {
    if (this._isRunning) return;
    this._isRunning = true;

    const process = (): void => {
      if (!this._isRunning) return;

      // Get time domain data (any cast for TypeScript's strict buffer typing)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this._analyser.getFloatTimeDomainData(this._analysisBuffer as any);

      // Calculate RMS level
      let sum = 0;
      for (let i = 0; i < this._analysisBuffer.length; i++) {
        sum += this._analysisBuffer[i] * this._analysisBuffer[i];
      }
      const rms = Math.sqrt(sum / this._analysisBuffer.length);

      // Convert to dB
      const db = 20 * Math.log10(rms + 0.0001);

      // Compare to threshold
      const threshold = this._params.threshold;
      const amount = this._params.amount / 100;

      if (db > threshold) {
        // Signal above threshold - duck
        const overThreshold = db - threshold;
        const duckFactor = Math.max(0, 1 - (overThreshold / 40) * amount);
        this._targetEnvelope = duckFactor;
      } else {
        // Signal below threshold - release
        this._targetEnvelope = 1;
      }

      // Smooth envelope with attack/release
      const attackCoef = Math.exp(-1 / (this._params.attack * this.ctx.sampleRate / 1000));
      const releaseCoef = Math.exp(-1 / (this._params.release * this.ctx.sampleRate / 1000));

      if (this._targetEnvelope < this._envelope) {
        // Attack (ducking)
        this._envelope = attackCoef * this._envelope + (1 - attackCoef) * this._targetEnvelope;
      } else {
        // Release
        this._envelope = releaseCoef * this._envelope + (1 - releaseCoef) * this._targetEnvelope;
      }

      // Apply to gain
      const now = this.ctx.currentTime;
      this._duckGain.gain.setValueAtTime(this._envelope, now);

      requestAnimationFrame(process);
    };

    requestAnimationFrame(process);
  }

  private _stopEnvelopeFollower(): void {
    this._isRunning = false;
  }

  protected _applyParam(_name: string, _value: number, _rampTime: number): void {
    // Parameters are read directly in the envelope follower loop
  }

  protected _bypass(bypassed: boolean): void {
    if (bypassed) {
      this._duckGain.gain.setValueAtTime(1, this.ctx.currentTime);
    }
  }

  /** Get current duck level (0-1) for metering */
  get duckLevel(): number {
    return this._envelope;
  }

  destroy(): void {
    this._stopEnvelopeFollower();
    super.destroy();
  }

  /** Access the main gain node */
  get node(): GainNode {
    return this._duckGain;
  }
}

export interface RhythmicSidechainOptions extends Record<string, unknown> {
  amount?: number;
  rate?: number;
  attack?: number;
  release?: number;
  bpm?: number;
}

/**
 * Rhythmic sidechain with built-in trigger generator
 * Creates pumping effect synced to a tempo without external input
 */
export class RhythmicSidechain extends AudioPlugin {
  private _duckGain: GainNode;
  private _isRunning: boolean;
  private _nextTriggerTime: number;
  private _schedulerTimeout: ReturnType<typeof setTimeout> | null = null;

  static get id(): string {
    return 'rhythmic-sidechain';
  }

  static get name(): string {
    return 'Rhythmic Sidechain';
  }

  static get description(): string {
    return 'Tempo-synced pumping effect';
  }

  static get category(): PluginCategory {
    return 'dynamics';
  }

  static get parameterDefinitions(): readonly ParameterDefinition[] {
    return [
      {
        name: 'amount',
        label: 'Amount',
        min: 0,
        max: 100,
        default: 50,
        unit: '%',
        scale: 'linear'
      },
      {
        name: 'rate',
        label: 'Rate',
        min: 1,
        max: 8,
        default: 4,
        unit: 'x',
        scale: 'linear'
      },
      {
        name: 'attack',
        label: 'Attack',
        min: 1,
        max: 100,
        default: 5,
        unit: 'ms',
        scale: 'log'
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
        name: 'bpm',
        label: 'BPM',
        min: 40,
        max: 240,
        default: 120,
        unit: '',
        scale: 'linear'
      }
    ];
  }

  constructor(audioContext: AudioContext, options: RhythmicSidechainOptions = {}) {
    super(audioContext, options);

    // Main signal gain
    this._duckGain = this.ctx.createGain();
    this._duckGain.gain.value = 1;

    // Setup bypass routing
    setupBypassRouting(this, this._duckGain, this._duckGain);

    // Rhythmic state
    this._isRunning = false;
    this._nextTriggerTime = 0;
  }

  /** Start the rhythmic pumping */
  start(startTime: number = this.ctx.currentTime): void {
    this._isRunning = true;
    this._nextTriggerTime = startTime;
    this._schedulePumps();
  }

  /** Stop the rhythmic pumping */
  stop(): void {
    this._isRunning = false;
    if (this._schedulerTimeout !== null) {
      clearTimeout(this._schedulerTimeout);
      this._schedulerTimeout = null;
    }
    this._duckGain.gain.cancelScheduledValues(this.ctx.currentTime);
    this._duckGain.gain.setValueAtTime(1, this.ctx.currentTime);
  }

  private _schedulePumps(): void {
    if (!this._isRunning) return;

    const now = this.ctx.currentTime;
    const scheduleAhead = 0.2; // Schedule 200ms ahead

    while (this._nextTriggerTime < now + scheduleAhead) {
      this._schedulePump(this._nextTriggerTime);

      // Calculate next trigger time based on BPM and rate
      const beatDuration = 60 / this._params.bpm;
      const triggerInterval = beatDuration / this._params.rate;
      this._nextTriggerTime += triggerInterval;
    }

    this._schedulerTimeout = setTimeout(() => this._schedulePumps(), 100);
  }

  private _schedulePump(time: number): void {
    const amount = this._params.amount / 100;
    const duckLevel = 1 - amount;
    const attackTime = this._params.attack / 1000;
    const releaseTime = this._params.release / 1000;

    // Duck down
    this._duckGain.gain.setValueAtTime(1, time);
    this._duckGain.gain.linearRampToValueAtTime(duckLevel, time + attackTime);

    // Release back up
    this._duckGain.gain.setTargetAtTime(1, time + attackTime, releaseTime / 3);
  }

  protected _applyParam(_name: string, _value: number, _rampTime: number): void {
    // Parameters are read when scheduling pumps
  }

  protected _bypass(bypassed: boolean): void {
    if (bypassed) {
      this.stop();
    }
  }

  destroy(): void {
    this.stop();
    super.destroy();
  }

  /** Access the gain node */
  get node(): GainNode {
    return this._duckGain;
  }
}
