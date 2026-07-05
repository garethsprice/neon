/**
 * Neon Audio Plugin - Reverb
 *
 * Algorithmic reverb using a network of delays and filters.
 * Also supports convolution reverb when impulse response is provided.
 */

import { AudioPlugin } from './base';
import type { ParameterDefinition, PluginCategory } from './types';

/**
 * Generate a simple noise-based impulse response
 */
export function generateImpulseResponse(
  ctx: AudioContext,
  duration: number,
  decay: number,
  reverse: boolean = false
): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const length = sampleRate * duration;
  const buffer = ctx.createBuffer(2, length, sampleRate);

  for (let channel = 0; channel < 2; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      const n = reverse ? length - i : i;
      channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - n / length, decay);
    }
  }

  return buffer;
}

export interface ReverbOptions extends Record<string, unknown> {
  mix?: number;
  decay?: number;
  damping?: number;
  preDelay?: number;
  impulse?: AudioBuffer;
}

export class Reverb extends AudioPlugin {
  protected _preDelay: DelayNode;
  protected _convolver: ConvolverNode;
  protected _dampingFilter: BiquadFilterNode;
  protected _dryGain: GainNode;
  protected _outputMixer: GainNode;

  static get id(): string {
    return 'reverb';
  }

  static get name(): string {
    return 'Reverb';
  }

  static get description(): string {
    return 'Algorithmic reverb with adjustable decay and damping';
  }

  static get category(): PluginCategory {
    return 'time';
  }

  static get parameterDefinitions(): readonly ParameterDefinition[] {
    return [
      {
        name: 'mix',
        label: 'Mix',
        min: 0,
        max: 100,
        default: 30,
        unit: '%',
        scale: 'linear'
      },
      {
        name: 'decay',
        label: 'Decay',
        min: 0.1,
        max: 10,
        default: 2,
        unit: 's',
        scale: 'log'
      },
      {
        name: 'damping',
        label: 'Damping',
        min: 0,
        max: 100,
        default: 50,
        unit: '%',
        scale: 'linear'
      },
      {
        name: 'preDelay',
        label: 'Pre-Delay',
        min: 0,
        max: 200,
        default: 10,
        unit: 'ms',
        scale: 'linear'
      }
    ];
  }

  constructor(audioContext: AudioContext, options: ReverbOptions = {}) {
    super(audioContext, options);

    // Pre-delay
    this._preDelay = this.ctx.createDelay(0.5);
    this._preDelay.delayTime.value = (options.preDelay || 10) / 1000;

    // Convolver for reverb
    this._convolver = this.ctx.createConvolver();

    // Damping filter (lowpass on reverb output)
    this._dampingFilter = this.ctx.createBiquadFilter();
    this._dampingFilter.type = 'lowpass';
    // Will be set properly in _applyParam, use safe max for now
    this._dampingFilter.frequency.value = this._nyquist;

    // Dry/wet mixing
    this._dryGain = this.ctx.createGain();
    this._outputMixer = this.ctx.createGain();

    // Wire the processing chain
    // Dry path: input -> dryGain -> outputMixer
    // Wet path: input -> preDelay -> convolver -> dampingFilter -> wetGain -> outputMixer

    this._preDelay.connect(this._convolver);
    this._convolver.connect(this._dampingFilter);
    this._dampingFilter.connect(this._wetGain);
    this._wetGain.connect(this._outputMixer);
    this._dryGain.connect(this._outputMixer);

    // Generate initial impulse response
    this._updateImpulse();

    // Apply initial parameters
    this._applyParam('mix', this._params.mix, 0);
    this._applyParam('damping', this._params.damping, 0);
    this._applyParam('preDelay', this._params.preDelay, 0);

    // Custom bypass routing for reverb (dry path is separate)
    this._input.connect(this._preDelay);
    this._input.connect(this._dryGain);
    this._input.connect(this._bypassGain);

    // Final output routing
    this._bypassGain.connect(this._output);
    this._outputMixer.connect(this._output);
  }

  private _updateImpulse(): void {
    const decay = this._params.decay;
    // Generate impulse response based on decay time
    const impulse = generateImpulseResponse(this.ctx, decay, 2);
    this._convolver.buffer = impulse;
  }

  protected _applyParam(name: string, value: number, rampTime: number): void {
    switch (name) {
      case 'mix': {
        const wet = value / 100;
        const dry = 1 - wet * 0.5; // Keep some dry signal
        this._setAudioParam(this._wetGain.gain, wet, rampTime);
        this._setAudioParam(this._dryGain.gain, dry, rampTime);
        break;
      }

      case 'decay':
        this._updateImpulse();
        break;

      case 'damping': {
        // Map damping to filter frequency (100% = 1000Hz, 0% = nyquist)
        const maxFreq = this._nyquist;
        const freq = maxFreq - (value / 100) * (maxFreq - 1000);
        this._setAudioParam(this._dampingFilter.frequency, freq, rampTime);
        break;
      }

      case 'preDelay': {
        const delaySec = value / 1000;
        this._setAudioParam(this._preDelay.delayTime, delaySec, rampTime);
        break;
      }
    }
  }

  protected _bypass(bypassed: boolean): void {
    const now = this.ctx.currentTime;
    const rampTime = 0.02;

    if (bypassed) {
      this._wetGain.gain.setTargetAtTime(0, now, rampTime);
      this._dryGain.gain.setTargetAtTime(0, now, rampTime);
      this._bypassGain.gain.setTargetAtTime(1, now, rampTime);
    } else {
      this._bypassGain.gain.setTargetAtTime(0, now, rampTime);
      this._applyParam('mix', this._params.mix, rampTime * 3);
    }
  }

  /** Load a custom impulse response */
  setImpulse(buffer: AudioBuffer): void {
    this._convolver.buffer = buffer;
  }

  /** Load impulse response from URL */
  async loadImpulse(url: string): Promise<void> {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
    this.setImpulse(audioBuffer);
  }

  /** Access the convolver node */
  get node(): ConvolverNode {
    return this._convolver;
  }
}

/**
 * Plate Reverb - preset with dense, metallic character
 */
export class PlateReverb extends Reverb {
  constructor(audioContext: AudioContext, options: ReverbOptions = {}) {
    super(audioContext, {
      mix: 35,
      decay: 1.5,
      damping: 30,
      preDelay: 5,
      ...options
    });
  }

  static get id(): string {
    return 'plate-reverb';
  }

  static get name(): string {
    return 'Plate Reverb';
  }

  static get description(): string {
    return 'Dense, metallic plate-style reverb';
  }
}

/**
 * Hall Reverb - preset with spacious, natural character
 */
export class HallReverb extends Reverb {
  constructor(audioContext: AudioContext, options: ReverbOptions = {}) {
    super(audioContext, {
      mix: 25,
      decay: 3,
      damping: 60,
      preDelay: 20,
      ...options
    });
  }

  static get id(): string {
    return 'hall-reverb';
  }

  static get name(): string {
    return 'Hall Reverb';
  }

  static get description(): string {
    return 'Spacious concert hall reverb';
  }
}

/**
 * Room Reverb - preset with small, tight character
 */
export class RoomReverb extends Reverb {
  constructor(audioContext: AudioContext, options: ReverbOptions = {}) {
    super(audioContext, {
      mix: 20,
      decay: 0.5,
      damping: 70,
      preDelay: 2,
      ...options
    });
  }

  static get id(): string {
    return 'room-reverb';
  }

  static get name(): string {
    return 'Room Reverb';
  }

  static get description(): string {
    return 'Small room ambience';
  }
}
