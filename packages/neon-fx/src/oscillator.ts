/**
 * Neon FX - Oscillator
 *
 * Pure polyphonic oscillator for synthesizer applications.
 * Generates waveforms without envelope - pair with Envelope for shaped sound.
 */

export type WaveformType = 'sine' | 'square' | 'sawtooth' | 'triangle';

export interface OscillatorOptions {
  /** Waveform type */
  waveform?: WaveformType;
  /** Detune in cents */
  detune?: number;
  /** Output gain (0-1) */
  gain?: number;
}

interface Voice {
  oscillator: OscillatorNode;
  noteId: number;
}

/**
 * Polyphonic oscillator - pure waveform generator.
 *
 * For amplitude shaping, connect to an Envelope:
 *
 * @example
 * ```ts
 * const osc = new Oscillator(ctx, { waveform: 'sawtooth' });
 * const env = new Envelope(ctx, { attack: 0.1, release: 0.5 });
 * const filter = new LowpassFilter(ctx, { cutoff: 2000 });
 *
 * // Chain: oscillator -> envelope -> filter -> output
 * osc.connect(env);
 * env.connect(filter);
 * filter.connect(ctx.destination);
 *
 * // Play a note (coordinate oscillator and envelope)
 * osc.start(60, 440);
 * env.noteOn(60);
 *
 * // Release
 * env.noteOff(60);
 * // Oscillator stops after envelope release (or manually)
 * ```
 */
export class Oscillator {
  readonly ctx: AudioContext;
  readonly output: GainNode;

  private _waveform: WaveformType = 'sawtooth';
  private _detune: number = 0;
  private _gain: number = 1;
  private _voices: Map<number, Voice> = new Map();

  constructor(audioContext: AudioContext, options: OscillatorOptions = {}) {
    this.ctx = audioContext;
    this.output = this.ctx.createGain();
    this.output.gain.value = 1;

    // Apply options
    if (options.waveform) this._waveform = options.waveform;
    if (options.detune !== undefined) this._detune = options.detune;
    if (options.gain !== undefined) {
      this._gain = options.gain;
      this.output.gain.value = options.gain;
    }
  }

  // ==========================================================================
  // Properties
  // ==========================================================================

  get waveform(): WaveformType {
    return this._waveform;
  }

  set waveform(value: WaveformType) {
    this._waveform = value;
    // Update active voices
    this._voices.forEach(voice => {
      voice.oscillator.type = value;
    });
  }

  get detune(): number {
    return this._detune;
  }

  set detune(value: number) {
    this._detune = value;
    const now = this.ctx.currentTime;
    this._voices.forEach(voice => {
      voice.oscillator.detune.setValueAtTime(value, now);
    });
  }

  get gain(): number { return this._gain; }
  set gain(value: number) {
    this._gain = value;
    this.output.gain.setTargetAtTime(value, this.ctx.currentTime, 0.01);
  }

  get activeVoices(): number {
    return this._voices.size;
  }

  // ==========================================================================
  // Voice Control
  // ==========================================================================

  /**
   * Start a voice at the given frequency.
   * @param noteId Unique identifier for this voice (e.g., MIDI note number)
   * @param frequency Frequency in Hz
   */
  start(noteId: number, frequency: number): void {
    // Stop existing voice for this note if any
    if (this._voices.has(noteId)) {
      this.stop(noteId);
    }

    const now = this.ctx.currentTime;

    // Create oscillator
    const oscillator = this.ctx.createOscillator();
    oscillator.type = this._waveform;
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.detune.setValueAtTime(this._detune, now);

    // Connect to output
    oscillator.connect(this.output);

    // Start oscillator
    oscillator.start(now);

    // Store voice
    this._voices.set(noteId, { oscillator, noteId });
  }

  /**
   * Stop a voice.
   * @param noteId The voice identifier passed to start
   */
  stop(noteId: number): void {
    const voice = this._voices.get(noteId);
    if (!voice) return;

    voice.oscillator.stop();
    voice.oscillator.disconnect();
    this._voices.delete(noteId);
  }

  /**
   * Stop a voice after a delay (for coordinating with envelope release).
   * Only stops the voice active at call time - if the note is retriggered
   * before the delay elapses, the new voice is left running.
   * @param noteId The voice identifier
   * @param delay Delay in seconds before stopping
   */
  stopAfter(noteId: number, delay: number): void {
    const voice = this._voices.get(noteId);
    if (!voice) return;
    setTimeout(() => {
      if (this._voices.get(noteId) === voice) {
        this.stop(noteId);
      }
    }, delay * 1000);
  }

  /**
   * Schedule an independent one-shot voice at absolute AudioContext times
   * (for lookahead sequencing). The voice is NOT tracked in the polyphonic
   * voice map: retriggers of the same note inside a lookahead window can
   * never steal each other, and held start()/stop() voices are unaffected.
   * @param frequency Frequency in Hz
   * @param startTime Absolute start time (>= ctx.currentTime)
   * @param stopTime Absolute stop time
   */
  triggerVoice(frequency: number, startTime: number, stopTime: number): OscillatorNode {
    const oscillator = this.ctx.createOscillator();
    oscillator.type = this._waveform;
    oscillator.frequency.setValueAtTime(frequency, startTime);
    oscillator.detune.setValueAtTime(this._detune, startTime);
    oscillator.connect(this.output);
    oscillator.start(startTime);
    oscillator.stop(stopTime);
    oscillator.onended = (): void => oscillator.disconnect();
    return oscillator;
  }

  /**
   * Check if a voice is currently active.
   * @param noteId The voice identifier
   */
  isPlaying(noteId: number): boolean {
    return this._voices.has(noteId);
  }

  /**
   * Set frequency of an active voice.
   * @param noteId The voice identifier
   * @param frequency New frequency in Hz
   * @param rampTime Optional ramp time in seconds for portamento
   */
  setFrequency(noteId: number, frequency: number, rampTime: number = 0): void {
    const voice = this._voices.get(noteId);
    if (!voice) return;

    const now = this.ctx.currentTime;
    if (rampTime > 0) {
      voice.oscillator.frequency.linearRampToValueAtTime(frequency, now + rampTime);
    } else {
      voice.oscillator.frequency.setValueAtTime(frequency, now);
    }
  }

  /**
   * Immediately stop all voices.
   */
  allNotesOff(): void {
    this._voices.forEach((voice, noteId) => {
      voice.oscillator.stop();
      voice.oscillator.disconnect();
      this._voices.delete(noteId);
    });
  }

  // ==========================================================================
  // Parameter Control
  // ==========================================================================

  /**
   * Set a parameter by name.
   */
  setParam(name: string, value: number): void {
    switch (name) {
      case 'detune':
        this.detune = value;
        break;
      case 'gain':
        this.gain = value;
        break;
    }
  }

  /**
   * Get a parameter by name.
   */
  getParam(name: string): number {
    switch (name) {
      case 'detune': return this._detune;
      case 'gain': return this._gain;
      default: return 0;
    }
  }

  // ==========================================================================
  // Connection
  // ==========================================================================

  /**
   * Connect the oscillator output to a destination.
   */
  connect(destination: AudioNode | { input: AudioNode }): void {
    if ('input' in destination) {
      this.output.connect(destination.input);
    } else {
      this.output.connect(destination);
    }
  }

  /**
   * Disconnect the oscillator output.
   */
  disconnect(destination?: AudioNode | { input: AudioNode }): void {
    if (destination) {
      if ('input' in destination) {
        this.output.disconnect(destination.input);
      } else {
        this.output.disconnect(destination);
      }
    } else {
      this.output.disconnect();
    }
  }

  /**
   * Clean up all resources.
   */
  destroy(): void {
    this.allNotesOff();
    this.output.disconnect();
  }

  /**
   * Serialize oscillator state.
   */
  serialize(): OscillatorOptions {
    return {
      waveform: this._waveform,
      detune: this._detune,
      gain: this._gain
    };
  }

  /**
   * Restore oscillator state.
   */
  deserialize(state: OscillatorOptions): void {
    if (state.waveform) this._waveform = state.waveform;
    if (state.detune !== undefined) this._detune = state.detune;
    if (state.gain !== undefined) this.gain = state.gain;
  }
}

/**
 * Convenience presets for common oscillator configurations
 */
export const OSCILLATOR_PRESETS = {
  /** Classic sawtooth lead */
  lead: {
    waveform: 'sawtooth' as WaveformType,
    detune: 0
  },

  /** Detuned supersaw */
  supersaw: {
    waveform: 'sawtooth' as WaveformType,
    detune: 15
  },

  /** Square wave bass */
  bass: {
    waveform: 'square' as WaveformType,
    detune: 0
  },

  /** Pure sine sub */
  sub: {
    waveform: 'sine' as WaveformType,
    detune: 0
  },

  /** Mellow triangle */
  mellow: {
    waveform: 'triangle' as WaveformType,
    detune: 0
  },

  /** Detuned unison */
  unison: {
    waveform: 'sawtooth' as WaveformType,
    detune: 25
  }
};
