/**
 * TR909Kit - TR-909 sample-sprite drum kit as a schedulable InstrumentModule.
 *
 * Port of the neon-drums AudioEngine sample playback core (sprite decode,
 * nearest-sample selection, hi-hat choke) with the one change that makes it
 * modular: every hit is scheduled at an absolute AudioContext `time` instead
 * of "now", so a lookahead transport can drive it sample-accurately.
 *
 * noteMode is 'lanes': tracker cells index into LANES; the cell's velocity
 * code (1 = hit, 2 = accent) arrives here as velocity 0.8 / 1.0.
 *
 * Assumes callers schedule events in non-decreasing time order (true for the
 * lookahead transport) — hi-hat choke tracking relies on it.
 */

import type { ParameterDefinition } from '@neon/fx';
import { InstrumentModule } from './base';
import type { InstrumentCategory, NoteMode } from './types';

/** [name, startMs, durationMs, ...paramValues] — one slice of the sprite. */
export type SampleData = [string, number, number, ...number[]];

/** The compressed manifest format shipped with the TR-909 sprite. */
export interface CompressedManifest {
  /** lane -> sample slices */
  d: Record<string, SampleData[]>;
  /** lane -> ordered param names matching each slice's trailing values */
  def: Record<string, string[]>;
}

export interface TR909KitOptions extends Record<string, unknown> {
  /** URL of the OGG sample sprite (default 'tr909-sprite.ogg') */
  sampleUrl?: string;
  /** URL of the compressed manifest JSON (default 'manifest-sprite-compressed.json') */
  manifestUrl?: string;
}

const LANES = [
  'bassDrum', 'snareDrum', 'lowTom', 'midTom', 'highTom',
  'rimshot', 'handclap', 'closedHiHat', 'openHiHat',
  'crashCymbal', 'rideCymbal'
] as const;

export type TR909Lane = (typeof LANES)[number];

interface ActiveHit {
  source: AudioBufferSourceNode;
  gain: GainNode;
  startTime: number;
}

export class TR909Kit extends InstrumentModule {
  private _sampleUrl: string;
  private _manifestUrl: string;
  private _manifest: CompressedManifest | null = null;
  private _sprite: AudioBuffer | null = null;
  private _active: ActiveHit[] = [];
  /** Gain node of the most recent open hi-hat, for choke */
  private _openHatGain: GainNode | null = null;
  /** Per-lane sample-selection params (tune/decay/tone/snappy...), 0-100 scales. */
  private _laneParams: Record<string, Record<string, number>> = {};

  static get id(): string {
    return 'tr909-kit';
  }

  static get name(): string {
    return '909 Kit';
  }

  static get description(): string {
    return 'TR-909 drum kit with velocity-layered sample playback';
  }

  static get category(): InstrumentCategory {
    return 'drums';
  }

  static get noteMode(): NoteMode {
    return 'lanes';
  }

  static get lanes(): readonly string[] {
    return LANES;
  }

  static get parameterDefinitions(): readonly ParameterDefinition[] {
    return [
      { name: 'level', label: 'Level', min: 0, max: 100, default: 80, unit: '%' }
    ];
  }

  constructor(audioContext: AudioContext, options: TR909KitOptions = {}) {
    super(audioContext, options);
    this._sampleUrl = options.sampleUrl ?? 'tr909-sprite.ogg';
    this._manifestUrl = options.manifestUrl ?? 'manifest-sprite-compressed.json';
    this._applyParam('level', this._params.level, 0);
  }

  get isLoaded(): boolean {
    return this._sprite !== null && this._manifest !== null;
  }

  async load(): Promise<void> {
    if (this.isLoaded) return;
    const [manifestResp, spriteResp] = await Promise.all([
      fetch(this._manifestUrl),
      fetch(this._sampleUrl)
    ]);
    const manifest = (await manifestResp.json()) as CompressedManifest;
    const sprite = await this.ctx.decodeAudioData(await spriteResp.arrayBuffer());
    this.loadData(manifest, sprite);
  }

  /** Direct data injection — used by load() and by tests. */
  loadData(manifest: CompressedManifest, sprite: AudioBuffer): void {
    this._manifest = manifest;
    this._sprite = sprite;
  }

  /** Set sample-selection params for one lane (0-100 scales, e.g. tune/decay). */
  setLaneParams(lane: string, params: Record<string, number>): void {
    this._laneParams[lane] = { ...this._laneParams[lane], ...params };
  }

  getLaneParams(lane: string): Record<string, number> {
    return { ...this._laneParams[lane] };
  }

  /**
   * Nearest-match sample selection by summed param distance
   * (port of neon-drums AudioEngine.getSampleData).
   */
  getSampleData(lane: string, targetParams: Record<string, number>): SampleData | null {
    if (!this._manifest) return null;
    const samples = this._manifest.d[lane];
    const paramNames = this._manifest.def[lane];
    if (!samples || !paramNames) return null;

    let best = samples[0];
    let minDiff = Infinity;
    for (const sample of samples) {
      let diff = 0;
      paramNames.forEach((pName, idx) => {
        const target = targetParams[pName];
        const sampleVal = sample[3 + idx] as number | undefined;
        if (target !== undefined && sampleVal !== undefined) {
          diff += Math.abs(sampleVal - target);
        }
      });
      if (diff < minDiff) {
        minDiff = diff;
        best = sample;
      }
    }
    return best;
  }

  noteOn(note: number, velocity: number, time: number): void {
    if (!this._sprite || !this._manifest) return;
    const lane = LANES[note];
    if (!lane) return;

    // Closed hat (or a new open hat) chokes the sounding open hat at `time`.
    // Events arrive in time order, so plain scheduling suffices — no
    // cancelScheduledValues, which would erase the hit's own level event.
    if ((lane === 'closedHiHat' || lane === 'openHiHat') && this._openHatGain) {
      this._openHatGain.gain.setTargetAtTime(0, time, 0.005);
      this._openHatGain = null;
    }

    // Accent (velocity >= 0.95) selects the hot velocity layer.
    const sampleParams: Record<string, number> = {
      ...this._laneParams[lane],
      velocity: velocity >= 0.95 ? 100 : 50
    };
    const sampleData = this.getSampleData(lane, sampleParams);
    if (!sampleData) return;
    const [, startMs, durMs] = sampleData;

    const source = this.ctx.createBufferSource();
    source.buffer = this._sprite;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(velocity, time);

    if (lane === 'openHiHat') {
      this._openHatGain = gain;
    }

    source.connect(gain);
    gain.connect(this.output);
    source.start(time, startMs / 1000, durMs / 1000);

    const hit: ActiveHit = { source, gain, startTime: time };
    this._active.push(hit);
    source.onended = () => {
      this._active = this._active.filter(h => h !== hit);
      if (this._openHatGain === gain) {
        this._openHatGain = null;
      }
    };
  }

  noteOff(_note: number, _time: number): void {
    // One-shot samples: nothing to release.
  }

  allNotesOff(afterTime?: number): void {
    const at = Math.max(afterTime ?? this.ctx.currentTime, this.ctx.currentTime);
    for (const hit of this._active) {
      hit.gain.gain.setTargetAtTime(0, at, 0.01);
      hit.source.stop(at + 0.05);
    }
    this._active = [];
    this._openHatGain = null;
  }

  protected _applyParam(name: string, value: number, rampTime: number): void {
    if (name === 'level') {
      this._setAudioParam(this.output.gain, value / 100, rampTime);
    }
  }

  protected _serializeExtra(): Record<string, unknown> | undefined {
    if (Object.keys(this._laneParams).length === 0) return undefined;
    return { laneParams: this._laneParams };
  }

  protected _deserializeExtra(extra: Record<string, unknown>): void {
    if (extra.laneParams && typeof extra.laneParams === 'object') {
      this._laneParams = { ...(extra.laneParams as Record<string, Record<string, number>>) };
    }
  }
}
