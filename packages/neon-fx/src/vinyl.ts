/**
 * Vinyl Effect - Authentic vinyl surface noise
 *
 * Components:
 * - Hiss: Filtered white noise with RIAA-like rolloff
 * - Crackle: Random pops and clicks
 * - Clunk: End-of-record rhythmic thump
 */

import type { ParameterDefinition, PluginCategory } from './types';
import { AudioPlugin, setupBypassRouting } from './base';

export type ClunkSpeed = '33' | '45';

export interface VinylOptions {
  /** Hiss noise level 0-1 */
  hissLevel?: number;
  /** Crackle pops enabled */
  crackleEnabled?: boolean;
  /** Crackle intensity 0-1 */
  crackleIntensity?: number;
  /** End-of-record clunk enabled */
  clunkEnabled?: boolean;
  /** Clunk speed: '33' or '45' RPM */
  clunkSpeed?: ClunkSpeed;
  /** Output level 0-1 */
  outputLevel?: number;
}

interface HissNodes {
  source: AudioBufferSourceNode;
  highpass: BiquadFilterNode;
  lowpass1: BiquadFilterNode;
  lowpass2: BiquadFilterNode;
  gain: GainNode;
}

export class VinylEffect extends AudioPlugin {
  private _isRunning = false;
  private _hissNodes: HissNodes | null = null;
  private _crackleGain: GainNode;
  private _crackleFilter: BiquadFilterNode;
  private _crackleTimeout: ReturnType<typeof setTimeout> | null = null;
  private _clunkInterval: ReturnType<typeof setInterval> | null = null;
  private _clunkBuffer: AudioBuffer | null = null;
  private _clunkGain: GainNode;
  private _clunkFilter: BiquadFilterNode;
  private _processingGain: GainNode;

  // Store non-numeric params separately
  private _crackleEnabled = true;
  private _clunkEnabled = false;
  private _clunkSpeed: ClunkSpeed = '33';

  static override get id(): string {
    return 'vinyl';
  }

  static override get name(): string {
    return 'Vinyl Effect';
  }

  static override get description(): string {
    return 'Authentic vinyl surface noise with hiss, crackle, and end-of-record clunk';
  }

  static override get category(): PluginCategory {
    return 'utility';
  }

  static override get parameterDefinitions(): readonly ParameterDefinition[] {
    return [
      { name: 'hissLevel', min: 0, max: 1, default: 0.5, unit: '' },
      { name: 'crackleIntensity', min: 0, max: 1, default: 0.5, unit: '' },
      { name: 'outputLevel', min: 0, max: 1, default: 0.5, unit: '' }
    ] as const;
  }

  constructor(audioContext: AudioContext, options: VinylOptions = {}) {
    super(audioContext, {
      hissLevel: options.hissLevel ?? 0.5,
      crackleIntensity: options.crackleIntensity ?? 0.5,
      outputLevel: options.outputLevel ?? 0.5
    });

    // Initialize non-numeric options
    this._crackleEnabled = options.crackleEnabled ?? true;
    this._clunkEnabled = options.clunkEnabled ?? false;
    this._clunkSpeed = options.clunkSpeed ?? '33';

    // Create processing chain
    this._processingGain = this.ctx.createGain();
    this._processingGain.gain.value = this._params.outputLevel ?? 0.5;

    // Setup crackle nodes
    this._crackleGain = this.ctx.createGain();
    this._crackleGain.gain.value = 0;
    this._crackleFilter = this.ctx.createBiquadFilter();
    this._crackleFilter.type = 'lowpass';
    this._crackleFilter.frequency.value = 4000;
    this._crackleFilter.Q.value = 0.5;
    this._crackleFilter.connect(this._crackleGain);
    this._crackleGain.connect(this._processingGain);

    // Setup clunk nodes
    this._clunkGain = this.ctx.createGain();
    this._clunkGain.gain.value = 0;
    this._clunkFilter = this.ctx.createBiquadFilter();
    this._clunkFilter.type = 'lowpass';
    this._clunkFilter.frequency.value = 200;
    this._clunkFilter.Q.value = 0.7;
    this._clunkFilter.connect(this._clunkGain);
    this._clunkGain.connect(this._processingGain);

    // Create clunk buffer
    this._setupClunkBuffer();

    // Setup hiss
    this._setupHiss();

    // Setup bypass routing
    setupBypassRouting(this, this._input, this._processingGain);
  }

  private _setupHiss(): void {
    const bufferSize = 2 * this.ctx.sampleRate;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const source = this.ctx.createBufferSource();
    source.buffer = noiseBuffer;
    source.loop = true;

    const highpass = this.ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 70;
    highpass.Q.value = 0.7;

    const lowpass1 = this.ctx.createBiquadFilter();
    lowpass1.type = 'lowpass';
    lowpass1.frequency.value = 3000;
    lowpass1.Q.value = 0.5;

    const lowpass2 = this.ctx.createBiquadFilter();
    lowpass2.type = 'lowpass';
    lowpass2.frequency.value = 9000;
    lowpass2.Q.value = 0.5;

    const hissGain = this.ctx.createGain();
    hissGain.gain.value = this._params.hissLevel ?? 0.5;

    source.connect(highpass);
    highpass.connect(lowpass1);
    lowpass1.connect(lowpass2);
    lowpass2.connect(hissGain);
    hissGain.connect(this._processingGain);

    source.start(0);

    this._hissNodes = {
      source,
      highpass,
      lowpass1,
      lowpass2,
      gain: hissGain
    };
  }

  private _setupClunkBuffer(): void {
    const duration = 0.08;
    const sampleRate = this.ctx.sampleRate;
    const samples = Math.floor(duration * sampleRate);
    const buffer = this.ctx.createBuffer(1, samples, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < samples; i++) {
      const t = i / sampleRate;
      const envelope = Math.exp(-t * 30);
      const freq = 100 - 60 * (t / duration);
      const phase = 2 * Math.PI * freq * t;
      data[i] = Math.sin(phase) * envelope * 0.8;
      data[i] += (Math.random() * 2 - 1) * envelope * 0.1;
    }

    this._clunkBuffer = buffer;
  }

  private _triggerCrackle(): void {
    if (!this._isRunning || !this._crackleEnabled) return;

    const now = this.ctx.currentTime;
    const duration = 0.005 + Math.random() * 0.015;
    const amplitude = (0.1 + Math.random() * 0.9) * (this._params.crackleIntensity ?? 0.5);

    const sampleRate = this.ctx.sampleRate;
    const samples = Math.floor(duration * sampleRate);
    const buffer = this.ctx.createBuffer(1, samples, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < samples; i++) {
      const t = i / samples;
      const envelope = Math.exp(-t * 8);
      data[i] = (Math.random() * 2 - 1) * envelope;
    }

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;

    const filterVariation = 2000 + Math.random() * 4000;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterVariation;

    const gain = this.ctx.createGain();
    gain.gain.value = amplitude * 0.3;

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this._crackleGain);

    source.start(now);
    source.stop(now + duration);

    const avgInterval = 0.2 + (1 - (this._params.crackleIntensity ?? 0.5)) * 0.3;
    const nextInterval = -Math.log(Math.random()) * avgInterval;

    this._crackleTimeout = setTimeout(() => this._triggerCrackle(), nextInterval * 1000);
  }

  private _triggerClunk(): void {
    if (!this._isRunning || !this._clunkEnabled || !this._clunkBuffer) return;

    const source = this.ctx.createBufferSource();
    source.buffer = this._clunkBuffer;
    source.connect(this._clunkFilter);
    source.start(this.ctx.currentTime);
  }

  private _startClunkLoop(): void {
    if (this._clunkInterval) {
      clearInterval(this._clunkInterval);
    }

    if (!this._clunkEnabled) return;

    const interval = this._clunkSpeed === '33' ? 1818 : 1333;

    this._triggerClunk();
    this._clunkInterval = setInterval(() => this._triggerClunk(), interval);
  }

  private _stopClunkLoop(): void {
    if (this._clunkInterval) {
      clearInterval(this._clunkInterval);
      this._clunkInterval = null;
    }
  }

  /** Whether the effect is currently running */
  get isRunning(): boolean {
    return this._isRunning;
  }

  /** Start the vinyl effect (crackle and clunk loops) */
  start(): void {
    this._isRunning = true;

    if (this._crackleEnabled) {
      this._crackleGain.gain.value = 1;
      this._triggerCrackle();
    }

    if (this._clunkEnabled) {
      this._clunkGain.gain.value = 0.5;
      this._startClunkLoop();
    }
  }

  /** Stop the vinyl effect */
  stop(): void {
    this._isRunning = false;

    if (this._crackleTimeout) {
      clearTimeout(this._crackleTimeout);
      this._crackleTimeout = null;
    }

    this._stopClunkLoop();
  }

  protected override _applyParam(name: string, value: number, rampTime: number): void {
    const time = rampTime > 0 ? rampTime / 3 : 0.03;

    switch (name) {
      case 'hissLevel':
        if (this._hissNodes) {
          this._setAudioParam(this._hissNodes.gain.gain, value, time);
        }
        break;
      case 'outputLevel':
        this._setAudioParam(this._processingGain.gain, value, time);
        break;
      // crackleIntensity doesn't need audio param updates - it's read during crackle generation
    }
  }

  /** Set hiss noise level (0-1) */
  setHissLevel(value: number): void {
    this.setParam('hissLevel', value);
  }

  /** Set crackle intensity (0-1) */
  setCrackleIntensity(value: number): void {
    this.setParam('crackleIntensity', value);
  }

  /** Set output level (0-1) */
  setOutputLevel(value: number): void {
    this.setParam('outputLevel', value);
  }

  /** Enable/disable crackle */
  setCrackleEnabled(enabled: boolean): void {
    this._crackleEnabled = enabled;

    if (this._isRunning) {
      if (enabled) {
        this._crackleGain.gain.setTargetAtTime(1, this.ctx.currentTime, 0.03);
        this._triggerCrackle();
      } else {
        this._crackleGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.03);
        if (this._crackleTimeout) {
          clearTimeout(this._crackleTimeout);
          this._crackleTimeout = null;
        }
      }
    }
  }

  /** Get crackle enabled state */
  get crackleEnabled(): boolean {
    return this._crackleEnabled;
  }

  /** Enable/disable clunk */
  setClunkEnabled(enabled: boolean): void {
    this._clunkEnabled = enabled;

    if (this._isRunning) {
      if (enabled) {
        this._clunkGain.gain.setTargetAtTime(0.5, this.ctx.currentTime, 0.03);
        this._startClunkLoop();
      } else {
        this._clunkGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.03);
        this._stopClunkLoop();
      }
    }
  }

  /** Get clunk enabled state */
  get clunkEnabled(): boolean {
    return this._clunkEnabled;
  }

  /** Set clunk speed (RPM) */
  setClunkSpeed(speed: ClunkSpeed): void {
    this._clunkSpeed = speed;

    if (this._isRunning && this._clunkEnabled) {
      this._startClunkLoop();
    }
  }

  /** Get clunk speed */
  get clunkSpeed(): ClunkSpeed {
    return this._clunkSpeed;
  }

  /** Get all vinyl-specific params for backwards compatibility */
  get vinylParams(): {
    hissLevel: number;
    crackleEnabled: boolean;
    crackleIntensity: number;
    clunkEnabled: boolean;
    clunkSpeed: ClunkSpeed;
  } {
    return {
      hissLevel: this._params.hissLevel ?? 0.5,
      crackleEnabled: this._crackleEnabled,
      crackleIntensity: this._params.crackleIntensity ?? 0.5,
      clunkEnabled: this._clunkEnabled,
      clunkSpeed: this._clunkSpeed
    };
  }

  override serialize(): {
    id: string;
    bypassed: boolean;
    params: Record<string, number>;
    crackleEnabled: boolean;
    clunkEnabled: boolean;
    clunkSpeed: ClunkSpeed;
  } {
    return {
      ...super.serialize(),
      crackleEnabled: this._crackleEnabled,
      clunkEnabled: this._clunkEnabled,
      clunkSpeed: this._clunkSpeed
    };
  }

  override deserialize(state: Partial<{
    params: Record<string, number>;
    bypassed: boolean;
    crackleEnabled: boolean;
    clunkEnabled: boolean;
    clunkSpeed: ClunkSpeed;
  }>): void {
    super.deserialize(state);

    if (state.crackleEnabled !== undefined) {
      this.setCrackleEnabled(state.crackleEnabled);
    }
    if (state.clunkEnabled !== undefined) {
      this.setClunkEnabled(state.clunkEnabled);
    }
    if (state.clunkSpeed === '33' || state.clunkSpeed === '45') {
      this.setClunkSpeed(state.clunkSpeed);
    }
  }

  override destroy(): void {
    this.stop();
    if (this._hissNodes) {
      this._hissNodes.source.stop();
      this._hissNodes.source.disconnect();
    }
    super.destroy();
  }
}

/**
 * Create a vinyl effect with default settings
 */
export function createVinylEffect(
  audioContext: AudioContext,
  options?: VinylOptions
): VinylEffect {
  return new VinylEffect(audioContext, options);
}
