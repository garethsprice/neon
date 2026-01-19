/**
 * Neon Audio Plugin - Adaptive Noise
 *
 * Analyzes sidechain input (microphone) frequency content and generates
 * control signals to adjust noise channel volumes for sound masking.
 *
 * Maps frequency bands to noise types:
 * - Brown: 20-350 Hz (low rumble, HVAC, traffic)
 * - Pink: 350-1300 Hz (voice fundamentals, mid-range)
 * - Green: 1300-4500 Hz (voice presence, clarity)
 * - White: 4500-20000 Hz (hiss, sibilance, high freq)
 */

import { AudioPlugin, setupBypassRouting } from './base';
import type { ParameterDefinition, PluginCategory } from './types';

export type NoiseType = 'brown' | 'pink' | 'green' | 'white';

export interface NoiseControlValues {
  brown: number;
  pink: number;
  green: number;
  white: number;
}

export type NoiseUpdateCallback = (values: NoiseControlValues) => void;

interface BinRange {
  start: number;
  end: number;
}

export interface AdaptiveNoiseOptions extends Record<string, unknown> {
  sensitivity?: number;
  attack?: number;
  release?: number;
  threshold?: number;
  maxBoost?: number;
  onUpdate?: NoiseUpdateCallback;
}

export class AdaptiveNoise extends AudioPlugin {
  private _passthrough: GainNode;
  private _sidechainInput: GainNode;
  private _analyser: AnalyserNode;
  private _controlValues: NoiseControlValues;
  private _envelopes: NoiseControlValues;
  private _frequencyData: Uint8Array;
  private _onUpdate: NoiseUpdateCallback | null;
  private _isRunning: boolean;
  private _binRanges: Record<NoiseType, BinRange>;

  static get id(): string {
    return 'adaptive-noise';
  }

  static get name(): string {
    return 'Adaptive Noise';
  }

  static get description(): string {
    return 'Analyzes ambient sound to adjust noise masking levels';
  }

  static get category(): PluginCategory {
    return 'utility';
  }

  static get parameterDefinitions(): readonly ParameterDefinition[] {
    return [
      {
        name: 'sensitivity',
        label: 'Sensitivity',
        min: 0,
        max: 100,
        default: 50,
        unit: '%',
        scale: 'linear'
      },
      {
        name: 'attack',
        label: 'Attack',
        min: 5,
        max: 200,
        default: 20,
        unit: 'ms',
        scale: 'log'
      },
      {
        name: 'release',
        label: 'Release',
        min: 50,
        max: 1000,
        default: 150,
        unit: 'ms',
        scale: 'log'
      },
      {
        name: 'threshold',
        label: 'Threshold',
        min: -80,
        max: -20,
        default: -50,
        unit: 'dB',
        scale: 'linear'
      },
      {
        name: 'maxBoost',
        label: 'Max Boost',
        min: 0,
        max: 100,
        default: 100,
        unit: '%',
        scale: 'linear'
      }
    ];
  }

  constructor(audioContext: AudioContext, options: AdaptiveNoiseOptions = {}) {
    super(audioContext, options);

    // Pass-through gain for main signal
    this._passthrough = this.ctx.createGain();
    this._passthrough.gain.value = 1;

    // Sidechain input and analysis
    this._sidechainInput = this.ctx.createGain();
    this._analyser = this.ctx.createAnalyser();
    this._analyser.fftSize = 2048;
    this._analyser.smoothingTimeConstant = 0.5;

    // Connect sidechain to analyser
    this._sidechainInput.connect(this._analyser);

    // Setup bypass routing for main signal (pass-through)
    setupBypassRouting(this, this._passthrough, this._passthrough);

    // Control values for each noise type (0-1 range, represents boost amount)
    this._controlValues = {
      brown: 0,
      pink: 0,
      green: 0,
      white: 0
    };

    // Smoothed envelope values
    this._envelopes = {
      brown: 0,
      pink: 0,
      green: 0,
      white: 0
    };

    // Analysis buffer
    this._frequencyData = new Uint8Array(this._analyser.frequencyBinCount);

    // Callback for value updates
    this._onUpdate = options.onUpdate || null;

    // Running state
    this._isRunning = false;

    // Frequency bin mapping (calculated once)
    this._binRanges = this._calculateBinRanges();
  }

  /** Calculate which FFT bins correspond to each frequency range */
  private _calculateBinRanges(): Record<NoiseType, BinRange> {
    const sampleRate = this.ctx.sampleRate;
    const binCount = this._analyser.frequencyBinCount;
    const binSize = sampleRate / (binCount * 2); // Hz per bin

    const freqToBin = (freq: number): number => Math.round(freq / binSize);

    return {
      brown: { start: freqToBin(20), end: freqToBin(350) },
      pink: { start: freqToBin(350), end: freqToBin(1300) },
      green: { start: freqToBin(1300), end: freqToBin(4500) },
      white: { start: freqToBin(4500), end: freqToBin(16000) }
    };
  }

  /** Get average energy in a frequency range */
  private _getRangeEnergy(startBin: number, endBin: number): number {
    let sum = 0;
    const count = endBin - startBin + 1;
    for (let i = startBin; i <= endBin && i < this._frequencyData.length; i++) {
      sum += this._frequencyData[i];
    }
    return sum / count / 255; // Normalize to 0-1
  }

  /** Sidechain input node - connect microphone here */
  get sidechainInput(): GainNode {
    return this._sidechainInput;
  }

  /** Analyser node for visualization */
  get analyser(): AnalyserNode {
    return this._analyser;
  }

  /** Current control values for each noise type */
  get controlValues(): NoiseControlValues {
    return { ...this._controlValues };
  }

  /** Set callback for when control values update */
  set onUpdate(callback: NoiseUpdateCallback | null) {
    this._onUpdate = callback;
  }

  /** Check if analysis is running */
  get isRunning(): boolean {
    return this._isRunning;
  }

  /** Start the analysis loop */
  start(): void {
    if (this._isRunning) return;
    this._isRunning = true;
    this._analyze();
  }

  /** Stop the analysis loop */
  stop(): void {
    this._isRunning = false;
  }

  private _analyze(): void {
    if (!this._isRunning) return;

    // Get frequency data (any cast for TypeScript's strict buffer typing)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this._analyser.getByteFrequencyData(this._frequencyData as any);

    const sensitivity = this._params.sensitivity / 100;
    const threshold = this._params.threshold;
    const maxBoost = this._params.maxBoost / 100;
    const attackCoef = Math.exp(-1 / (this._params.attack * this.ctx.sampleRate / 1000 / 128));
    const releaseCoef = Math.exp(-1 / (this._params.release * this.ctx.sampleRate / 1000 / 128));

    // Analyze each frequency band
    const noiseTypes: NoiseType[] = ['brown', 'pink', 'green', 'white'];
    let hasChanges = false;

    noiseTypes.forEach(type => {
      const range = this._binRanges[type];
      const energy = this._getRangeEnergy(range.start, range.end);

      // Convert to dB
      const db = 20 * Math.log10(energy + 0.0001);

      // Calculate target boost
      let targetBoost = 0;
      if (db > threshold) {
        const overThreshold = db - threshold;
        // Map to boost amount with sensitivity scaling
        targetBoost = Math.min(maxBoost, (overThreshold / 40) * sensitivity * maxBoost);
      }

      // Apply envelope smoothing
      const currentEnvelope = this._envelopes[type];
      let newEnvelope: number;

      if (targetBoost > currentEnvelope) {
        // Attack
        newEnvelope = attackCoef * currentEnvelope + (1 - attackCoef) * targetBoost;
      } else {
        // Release
        newEnvelope = releaseCoef * currentEnvelope + (1 - releaseCoef) * targetBoost;
      }

      this._envelopes[type] = newEnvelope;

      // Round to avoid excessive updates
      const roundedValue = Math.round(newEnvelope * 1000) / 1000;
      if (this._controlValues[type] !== roundedValue) {
        this._controlValues[type] = roundedValue;
        hasChanges = true;
      }
    });

    // Notify callback if values changed
    if (hasChanges && this._onUpdate) {
      this._onUpdate(this._controlValues);
    }

    requestAnimationFrame(() => this._analyze());
  }

  protected _applyParam(_name: string, _value: number, _rampTime: number): void {
    // Parameters are read directly in the analysis loop
  }

  protected _bypass(bypassed: boolean): void {
    if (bypassed) {
      // Reset control values when bypassed
      this._controlValues = { brown: 0, pink: 0, green: 0, white: 0 };
      this._envelopes = { brown: 0, pink: 0, green: 0, white: 0 };
      if (this._onUpdate) {
        this._onUpdate(this._controlValues);
      }
    }
  }

  destroy(): void {
    this.stop();
    super.destroy();
  }
}
