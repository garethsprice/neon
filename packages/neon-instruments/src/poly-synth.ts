/**
 * PolySynth - Polyphonic subtractive synth voice pool, built for lookahead
 * scheduling.
 *
 * Unlike the @neon/fx Oscillator/Envelope pair (whose noteOff cancels
 * scheduled values at "now" and tracks phase with setTimeout — fatal for
 * events sitting in a lookahead window), every voice here is a throwaway
 * node pair whose envelope is scheduled entirely with absolute times:
 *
 *   voice: OscillatorNode (+ optional detuned twin) -> GainNode envelope
 *          -> shared BiquadFilter (LP) -> output
 *
 * trigger(ev) pre-schedules the COMPLETE envelope (attack/decay/sustain/
 * release) at trigger time — the correct path for sequenced playback, no
 * future cancellation ever needed. noteOn/noteOff support live (held) input.
 *
 * Voice stealing only ever touches voices with startTime <= the new event's
 * time; future-scheduled voices are never stolen.
 */

import type { ParameterDefinition } from '@neon/fx';
import { InstrumentModule } from './base';
import { midiToFrequency, type InstrumentCategory, type NoteEvent, type NoteMode } from './types';

export type PolySynthWaveform = 'sine' | 'square' | 'sawtooth' | 'triangle';

export interface PolySynthOptions extends Record<string, unknown> {
  waveform?: PolySynthWaveform;
}

interface Voice {
  note: number;
  startTime: number;
  /** Absolute time the release begins, Infinity while held. */
  releaseTime: number;
  oscs: OscillatorNode[];
  env: GainNode;
}

const MAX_VOICES = 32;
/** Envelope tail after release starts before the oscillator is stopped. */
const RELEASE_TAIL = 0.1;

export class PolySynth extends InstrumentModule {
  private _waveform: PolySynthWaveform;
  private _filter: BiquadFilterNode;
  private _voices: Voice[] = [];

  static get id(): string {
    return 'poly-synth';
  }

  static get name(): string {
    return 'Poly Synth';
  }

  static get description(): string {
    return 'Polyphonic subtractive synth with lowpass filter and ADSR';
  }

  static get category(): InstrumentCategory {
    return 'synth';
  }

  static get noteMode(): NoteMode {
    return 'pitched';
  }

  static get parameterDefinitions(): readonly ParameterDefinition[] {
    return [
      { name: 'cutoff', label: 'Cutoff', min: 20, max: 18000, default: 8000, unit: 'Hz', scale: 'log', modulatable: true },
      { name: 'resonance', label: 'Resonance', min: 0, max: 24, default: 0.7, unit: 'Q', modulatable: true },
      { name: 'attack', label: 'Attack', min: 0.001, max: 2, default: 0.005, unit: 's' },
      { name: 'decay', label: 'Decay', min: 0.001, max: 2, default: 0.08, unit: 's' },
      { name: 'sustain', label: 'Sustain', min: 0, max: 1, default: 0.7 },
      { name: 'release', label: 'Release', min: 0.005, max: 4, default: 0.15, unit: 's' },
      { name: 'detune', label: 'Detune', min: 0, max: 50, default: 0, unit: 'ct' },
      { name: 'gain', label: 'Gain', min: 0, max: 1, default: 0.8 }
    ];
  }

  constructor(audioContext: AudioContext, options: PolySynthOptions = {}) {
    super(audioContext, options);
    this._waveform = options.waveform ?? 'sawtooth';

    this._filter = this.ctx.createBiquadFilter();
    this._filter.type = 'lowpass';
    this._filter.frequency.value = this._params.cutoff;
    this._filter.Q.value = this._params.resonance;
    this._filter.connect(this.output);

    this.output.gain.value = this._params.gain;
  }

  get waveform(): PolySynthWaveform {
    return this._waveform;
  }

  set waveform(w: PolySynthWaveform) {
    this._waveform = w;
  }

  /** Sequenced path: schedule the complete envelope up front. */
  trigger(ev: NoteEvent): void {
    if (ev.duration === undefined) {
      this.noteOn(ev.note, ev.velocity, ev.time);
      return;
    }
    const releaseStart = ev.time + ev.duration;
    this._startVoice(ev.note, ev.velocity, ev.time, releaseStart);
  }

  /** Live path: held note, envelope scheduled up to sustain. */
  noteOn(note: number, velocity: number, time: number): void {
    this._startVoice(note, velocity, time, Infinity);
  }

  noteOff(note: number, time: number): void {
    const release = this._params.release;
    for (const voice of this._voices) {
      if (voice.note !== note || voice.releaseTime !== Infinity) continue;
      if (voice.startTime > time) continue; // not sounding yet at `time`
      voice.releaseTime = time;
      // No cancelScheduledValues: earlier envelope events are in the past or
      // (attack/decay still in flight) simply overlap the release target,
      // which is audibly benign and keeps future-scheduled voices safe.
      voice.env.gain.setTargetAtTime(0, time, release / 3);
      for (const osc of voice.oscs) {
        osc.stop(time + release + RELEASE_TAIL);
      }
    }
  }

  allNotesOff(afterTime?: number): void {
    const at = Math.max(afterTime ?? this.ctx.currentTime, this.ctx.currentTime);
    for (const voice of this._voices) {
      voice.env.gain.cancelScheduledValues(at);
      voice.env.gain.setTargetAtTime(0, at, 0.01);
      for (const osc of voice.oscs) {
        osc.stop(at + RELEASE_TAIL);
      }
    }
    this._voices = [];
  }

  /** Number of live (allocated) voices — exposed for tests/metering. */
  get voiceCount(): number {
    return this._voices.length;
  }

  private _startVoice(note: number, velocity: number, time: number, releaseStart: number): void {
    this._stealIfNeeded(time);

    const { attack, decay, sustain, release, detune } = this._params;
    const freq = midiToFrequency(note);
    const peak = Math.max(0.0001, velocity);

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0, time);
    env.gain.linearRampToValueAtTime(peak, time + attack);
    env.gain.linearRampToValueAtTime(peak * sustain, time + attack + decay);
    env.connect(this._filter);

    const oscs: OscillatorNode[] = [];
    const detunes = detune > 0 ? [-detune / 2, detune / 2] : [0];
    for (const cents of detunes) {
      const osc = this.ctx.createOscillator();
      osc.type = this._waveform;
      osc.frequency.setValueAtTime(freq, time);
      osc.detune.setValueAtTime(cents, time);
      osc.connect(env);
      osc.start(time);
      oscs.push(osc);
    }

    const voice: Voice = { note, startTime: time, releaseTime: releaseStart, oscs, env };

    if (releaseStart !== Infinity) {
      // Pre-schedule the release; the whole lifecycle is locked in now.
      env.gain.setTargetAtTime(0, releaseStart, release / 3);
      for (const osc of oscs) {
        osc.stop(releaseStart + release + RELEASE_TAIL);
      }
    }

    oscs[0].onended = () => {
      this._voices = this._voices.filter(v => v !== voice);
      env.disconnect();
    };

    this._voices.push(voice);
  }

  /**
   * Steal the oldest already-sounding voice when the pool is full. Voices
   * scheduled in the future (startTime > the new event's time) are never
   * touched — cutting them would corrupt the lookahead window.
   */
  private _stealIfNeeded(newEventTime: number): void {
    if (this._voices.length < MAX_VOICES) return;
    const stealable = this._voices
      .filter(v => v.startTime <= newEventTime)
      .sort((a, b) => a.startTime - b.startTime);
    const victim = stealable[0];
    if (!victim) return;
    victim.env.gain.cancelScheduledValues(newEventTime);
    victim.env.gain.setTargetAtTime(0, newEventTime, 0.005);
    for (const osc of victim.oscs) {
      osc.stop(newEventTime + 0.05);
    }
    this._voices = this._voices.filter(v => v !== victim);
  }

  getModTarget(name: string): AudioParam | null {
    // Only params whose declared unit is the AudioParam's native unit.
    if (name === 'cutoff') return this._filter.frequency;
    if (name === 'resonance') return this._filter.Q;
    return null;
  }

  protected _applyParam(name: string, value: number, rampTime: number): void {
    switch (name) {
      case 'cutoff':
        this._setAudioParam(this._filter.frequency, value, rampTime);
        break;
      case 'resonance':
        this._setAudioParam(this._filter.Q, value, rampTime);
        break;
      case 'gain':
        this._setAudioParam(this.output.gain, value, rampTime);
        break;
      // attack/decay/sustain/release/detune are read at voice start.
    }
  }

  protected _serializeExtra(): Record<string, unknown> | undefined {
    return { waveform: this._waveform };
  }

  protected _deserializeExtra(extra: Record<string, unknown>): void {
    if (typeof extra.waveform === 'string') {
      this._waveform = extra.waveform as PolySynthWaveform;
    }
  }
}
