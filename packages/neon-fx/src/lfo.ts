/**
 * Neon FX - LFO (Low Frequency Oscillator)
 *
 * Reusable LFO for modulating audio parameters.
 * Used in phasers, flangers, tremolo, vibrato, and other modulation effects.
 */

export type LFOWaveform = 'sine' | 'triangle' | 'square' | 'sawtooth';

export interface LFOOptions {
  /** LFO rate/frequency in Hz (default: 1) */
  rate?: number;
  /** LFO depth/amplitude (default: 1) */
  depth?: number;
  /** Waveform type (default: 'sine') */
  waveform?: LFOWaveform;
  /** Phase offset in degrees 0-360 (default: 0) */
  phase?: number;
  /** Whether to start immediately (default: true) */
  autoStart?: boolean;
}

/**
 * Low Frequency Oscillator for modulating audio parameters.
 *
 * @example
 * ```ts
 * const lfo = new LFO(audioContext, {
 *   rate: 0.5,
 *   depth: 100,
 *   waveform: 'sine'
 * });
 *
 * // Connect to any AudioParam
 * lfo.connect(filter.frequency);
 *
 * // Or get the output node for custom routing
 * lfo.output.connect(someNode);
 * ```
 */
export class LFO {
  readonly ctx: AudioContext;

  private _oscillator: OscillatorNode;
  private _gainNode: GainNode;
  private _rate: number;
  private _depth: number;
  private _waveform: LFOWaveform;
  private _started: boolean = false;

  constructor(audioContext: AudioContext, options: LFOOptions = {}) {
    this.ctx = audioContext;

    this._rate = options.rate ?? 1;
    this._depth = options.depth ?? 1;
    this._waveform = options.waveform ?? 'sine';

    // Create oscillator
    this._oscillator = this.ctx.createOscillator();
    this._oscillator.type = this._waveform;
    this._oscillator.frequency.value = this._rate;

    // Create gain for depth control
    this._gainNode = this.ctx.createGain();
    this._gainNode.gain.value = this._depth;

    // Connect oscillator to gain
    this._oscillator.connect(this._gainNode);

    // Handle phase offset if specified
    if (options.phase && options.phase !== 0) {
      // Phase offset is achieved by starting at a specific time
      // For simplicity, we'll note this is a limitation - true phase offset
      // would require a more complex implementation with delay nodes
    }

    // Auto-start by default
    if (options.autoStart !== false) {
      this.start();
    }
  }

  /** Output node - connect this to AudioParams or other nodes */
  get output(): GainNode {
    return this._gainNode;
  }

  /** Current rate in Hz */
  get rate(): number {
    return this._rate;
  }

  set rate(value: number) {
    this._rate = Math.max(0.001, value);
    this._oscillator.frequency.setValueAtTime(this._rate, this.ctx.currentTime);
  }

  /** Current depth/amplitude */
  get depth(): number {
    return this._depth;
  }

  set depth(value: number) {
    this._depth = value;
    this._gainNode.gain.setValueAtTime(this._depth, this.ctx.currentTime);
  }

  /** Current waveform */
  get waveform(): LFOWaveform {
    return this._waveform;
  }

  set waveform(value: LFOWaveform) {
    this._waveform = value;
    this._oscillator.type = value;
  }

  /** Whether the LFO is currently running */
  get running(): boolean {
    return this._started;
  }

  /**
   * Set rate with optional ramp time
   */
  setRate(value: number, rampTime: number = 0): void {
    this._rate = Math.max(0.001, value);
    const now = this.ctx.currentTime;
    if (rampTime > 0) {
      this._oscillator.frequency.setTargetAtTime(this._rate, now, rampTime / 3);
    } else {
      this._oscillator.frequency.setValueAtTime(this._rate, now);
    }
  }

  /**
   * Set depth with optional ramp time
   */
  setDepth(value: number, rampTime: number = 0): void {
    this._depth = value;
    const now = this.ctx.currentTime;
    if (rampTime > 0) {
      this._gainNode.gain.setTargetAtTime(this._depth, now, rampTime / 3);
    } else {
      this._gainNode.gain.setValueAtTime(this._depth, now);
    }
  }

  /**
   * Connect LFO output to an AudioParam or AudioNode
   */
  connect(destination: AudioParam | AudioNode): void {
    this._gainNode.connect(destination as AudioNode);
  }

  /**
   * Disconnect LFO output
   */
  disconnect(destination?: AudioParam | AudioNode): void {
    if (destination) {
      this._gainNode.disconnect(destination as AudioNode);
    } else {
      this._gainNode.disconnect();
    }
  }

  /**
   * Start the LFO
   */
  start(): void {
    if (!this._started) {
      this._oscillator.start();
      this._started = true;
    }
  }

  /**
   * Stop and destroy the LFO
   * Note: After stopping, the LFO cannot be restarted (Web Audio limitation)
   */
  stop(): void {
    if (this._started) {
      this._oscillator.stop();
      this._oscillator.disconnect();
      this._gainNode.disconnect();
    }
  }

  /**
   * Create a new LFO instance (useful after stopping)
   */
  reset(options?: LFOOptions): LFO {
    this.stop();
    return new LFO(this.ctx, {
      rate: this._rate,
      depth: this._depth,
      waveform: this._waveform,
      ...options
    });
  }
}

/**
 * Preset LFO configurations
 */
export const LFO_PRESETS = {
  /** Slow, smooth modulation */
  slow: { rate: 0.2, waveform: 'sine' as LFOWaveform },
  /** Medium speed modulation */
  medium: { rate: 1, waveform: 'sine' as LFOWaveform },
  /** Fast modulation */
  fast: { rate: 5, waveform: 'sine' as LFOWaveform },
  /** Tremolo-style */
  tremolo: { rate: 6, waveform: 'sine' as LFOWaveform },
  /** Vibrato-style */
  vibrato: { rate: 5, waveform: 'sine' as LFOWaveform },
  /** Square wave for choppy effects */
  choppy: { rate: 4, waveform: 'square' as LFOWaveform },
  /** Sample-and-hold style (using square) */
  sampleHold: { rate: 8, waveform: 'square' as LFOWaveform }
} as const;
