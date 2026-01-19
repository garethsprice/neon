/**
 * Neon FX - Envelope Generator
 *
 * ADSR envelope generator for shaping amplitude over time.
 * Can be used with any audio source (oscillators, samples, noise, etc.)
 */

export interface ADSRParams {
  /** Attack time in seconds */
  attack: number;
  /** Decay time in seconds */
  decay: number;
  /** Sustain level (0-1) */
  sustain: number;
  /** Release time in seconds */
  release: number;
}

export interface EnvelopeOptions extends Partial<ADSRParams> {
  /** Output gain multiplier (0-1) */
  gain?: number;
}

interface ActiveEnvelope {
  envelope: GainNode;
  releaseTimeout?: ReturnType<typeof setTimeout>;
  state: 'attack' | 'decay' | 'sustain' | 'release';
}

/**
 * Polyphonic ADSR envelope generator.
 *
 * Routes audio through gain nodes that follow ADSR curves.
 * Each note gets its own envelope instance for true polyphony.
 *
 * @example
 * ```ts
 * const osc = new Oscillator(ctx, { waveform: 'sawtooth' });
 * const env = new Envelope(ctx, { attack: 0.1, decay: 0.2, sustain: 0.7, release: 0.5 });
 *
 * // Connect: oscillator -> envelope -> destination
 * osc.connect(env);
 * env.connect(ctx.destination);
 *
 * // Trigger notes (coordinates with oscillator)
 * osc.start(60, 440);
 * env.noteOn(60);
 *
 * // Later...
 * env.noteOff(60);
 * osc.stop(60);
 * ```
 */
export class Envelope {
  readonly ctx: AudioContext;
  readonly input: GainNode;
  readonly output: GainNode;

  private _params: ADSRParams = {
    attack: 0.01,
    decay: 0.1,
    sustain: 0.7,
    release: 0.3
  };
  private _gain: number = 1;
  private _envelopes: Map<number, ActiveEnvelope> = new Map();

  constructor(audioContext: AudioContext, options: EnvelopeOptions = {}) {
    this.ctx = audioContext;

    // Input receives audio from source
    this.input = this.ctx.createGain();
    this.input.gain.value = 1;

    // Output sends processed audio
    this.output = this.ctx.createGain();
    this.output.gain.value = 1;

    // Apply options
    if (options.attack !== undefined) this._params.attack = options.attack;
    if (options.decay !== undefined) this._params.decay = options.decay;
    if (options.sustain !== undefined) this._params.sustain = options.sustain;
    if (options.release !== undefined) this._params.release = options.release;
    if (options.gain !== undefined) {
      this._gain = options.gain;
      this.output.gain.value = options.gain;
    }
  }

  // ==========================================================================
  // Properties
  // ==========================================================================

  get params(): ADSRParams {
    return { ...this._params };
  }

  set params(value: Partial<ADSRParams>) {
    if (value.attack !== undefined) this._params.attack = value.attack;
    if (value.decay !== undefined) this._params.decay = value.decay;
    if (value.sustain !== undefined) this._params.sustain = value.sustain;
    if (value.release !== undefined) this._params.release = value.release;
  }

  get attack(): number { return this._params.attack; }
  set attack(value: number) { this._params.attack = Math.max(0.001, value); }

  get decay(): number { return this._params.decay; }
  set decay(value: number) { this._params.decay = Math.max(0.001, value); }

  get sustain(): number { return this._params.sustain; }
  set sustain(value: number) { this._params.sustain = Math.max(0.001, Math.min(1, value)); }

  get release(): number { return this._params.release; }
  set release(value: number) { this._params.release = Math.max(0.001, value); }

  get gain(): number { return this._gain; }
  set gain(value: number) {
    this._gain = value;
    this.output.gain.setTargetAtTime(value, this.ctx.currentTime, 0.01);
  }

  get activeCount(): number {
    return this._envelopes.size;
  }

  // ==========================================================================
  // Envelope Control
  // ==========================================================================

  /**
   * Trigger the attack phase for a note.
   * Creates a new envelope gain node for this note ID.
   * @param noteId Unique identifier for this note
   */
  noteOn(noteId: number): GainNode {
    // Clean up existing envelope for this note if any
    if (this._envelopes.has(noteId)) {
      this.noteOff(noteId, true); // Force immediate release
    }

    const now = this.ctx.currentTime;
    const { attack, decay, sustain } = this._params;

    // Create envelope gain node
    const envelope = this.ctx.createGain();
    envelope.gain.setValueAtTime(0, now);

    // Attack phase
    const attackEnd = now + attack;
    envelope.gain.linearRampToValueAtTime(1, attackEnd);

    // Decay phase -> sustain level
    envelope.gain.linearRampToValueAtTime(sustain, attackEnd + decay);

    // Connect: input -> envelope -> output
    this.input.connect(envelope);
    envelope.connect(this.output);

    // Store envelope
    this._envelopes.set(noteId, { envelope, state: 'attack' });

    // Update state after attack
    setTimeout(() => {
      const env = this._envelopes.get(noteId);
      if (env && env.state === 'attack') {
        env.state = 'decay';
        setTimeout(() => {
          const env2 = this._envelopes.get(noteId);
          if (env2 && env2.state === 'decay') {
            env2.state = 'sustain';
          }
        }, decay * 1000);
      }
    }, attack * 1000);

    return envelope;
  }

  /**
   * Trigger the release phase for a note.
   * @param noteId The note identifier passed to noteOn
   * @param immediate If true, stop immediately without release phase
   */
  noteOff(noteId: number, immediate: boolean = false): void {
    const active = this._envelopes.get(noteId);
    if (!active) return;

    const { envelope, releaseTimeout } = active;

    // Clear any pending cleanup
    if (releaseTimeout) {
      clearTimeout(releaseTimeout);
    }

    const now = this.ctx.currentTime;

    if (immediate) {
      // Immediate stop
      envelope.gain.cancelScheduledValues(now);
      envelope.gain.setValueAtTime(0, now);
      this._cleanup(noteId);
    } else {
      // Release phase
      const { release } = this._params;
      const releaseEnd = now + release;

      envelope.gain.cancelScheduledValues(now);
      envelope.gain.setValueAtTime(envelope.gain.value, now);
      envelope.gain.exponentialRampToValueAtTime(0.001, releaseEnd);

      active.state = 'release';

      // Schedule cleanup after release
      active.releaseTimeout = setTimeout(() => {
        this._cleanup(noteId);
      }, release * 1000 + 50);
    }
  }

  /**
   * Trigger a one-shot envelope (attack -> hold -> release).
   * @param noteId Unique identifier for this note
   * @param duration Hold duration in seconds before release
   * @returns The envelope gain node
   */
  trigger(noteId: number, duration: number): GainNode {
    const envelope = this.noteOn(noteId);

    // Schedule release after duration
    setTimeout(() => {
      this.noteOff(noteId);
    }, duration * 1000);

    return envelope;
  }

  /**
   * Immediately stop all active envelopes.
   */
  allNotesOff(): void {
    this._envelopes.forEach((_, noteId) => {
      this.noteOff(noteId, true);
    });
  }

  private _cleanup(noteId: number): void {
    const active = this._envelopes.get(noteId);
    if (!active) return;

    active.envelope.disconnect();
    this._envelopes.delete(noteId);
  }

  // ==========================================================================
  // Connection
  // ==========================================================================

  /**
   * Connect the envelope output to a destination.
   */
  connect(destination: AudioNode | { input: AudioNode }): void {
    if ('input' in destination) {
      this.output.connect(destination.input);
    } else {
      this.output.connect(destination);
    }
  }

  /**
   * Disconnect the envelope output.
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
    this.input.disconnect();
    this.output.disconnect();
  }

  /**
   * Set a parameter by name.
   */
  setParam(name: string, value: number): void {
    switch (name) {
      case 'attack':
        this.attack = value;
        break;
      case 'decay':
        this.decay = value;
        break;
      case 'sustain':
        this.sustain = value;
        break;
      case 'release':
        this.release = value;
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
      case 'attack': return this._params.attack;
      case 'decay': return this._params.decay;
      case 'sustain': return this._params.sustain;
      case 'release': return this._params.release;
      case 'gain': return this._gain;
      default: return 0;
    }
  }

  /**
   * Serialize envelope state.
   */
  serialize(): EnvelopeOptions {
    return {
      attack: this._params.attack,
      decay: this._params.decay,
      sustain: this._params.sustain,
      release: this._params.release,
      gain: this._gain
    };
  }

  /**
   * Restore envelope state.
   */
  deserialize(state: EnvelopeOptions): void {
    if (state.attack !== undefined) this._params.attack = state.attack;
    if (state.decay !== undefined) this._params.decay = state.decay;
    if (state.sustain !== undefined) this._params.sustain = state.sustain;
    if (state.release !== undefined) this._params.release = state.release;
    if (state.gain !== undefined) this.gain = state.gain;
  }
}

/**
 * Convenience presets for common envelope shapes
 */
export const ENVELOPE_PRESETS = {
  /** Slow attack pad */
  pad: {
    attack: 0.3,
    decay: 0.5,
    sustain: 0.7,
    release: 1.0
  },

  /** Punchy bass */
  bass: {
    attack: 0.01,
    decay: 0.3,
    sustain: 0.4,
    release: 0.2
  },

  /** Short pluck */
  pluck: {
    attack: 0.001,
    decay: 0.2,
    sustain: 0.1,
    release: 0.3
  },

  /** Organ-like (no decay) */
  organ: {
    attack: 0.01,
    decay: 0.01,
    sustain: 1.0,
    release: 0.1
  },

  /** Brass stab */
  brass: {
    attack: 0.08,
    decay: 0.2,
    sustain: 0.6,
    release: 0.4
  },

  /** Percussion hit */
  perc: {
    attack: 0.001,
    decay: 0.1,
    sustain: 0.0,
    release: 0.1
  },

  /** Swell */
  swell: {
    attack: 1.0,
    decay: 0.5,
    sustain: 0.8,
    release: 1.5
  }
};
