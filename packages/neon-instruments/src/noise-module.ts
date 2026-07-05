/**
 * NoiseModule - Gated noise-color generator as a schedulable InstrumentModule.
 *
 * Port of the neon-noise generation algorithms (white/pink/brown/green) with
 * a lanes interface: four always-looping buffer sources feed per-lane gates
 * that open/close at scheduled times, so tracker cells like [vel, durSteps]
 * sequence noise swells natively.
 */

import type { ParameterDefinition } from '@neon/fx';
import { InstrumentModule } from './base';
import type { InstrumentCategory, NoteMode } from './types';

const LANES = ['white', 'pink', 'brown', 'green'] as const;

export type NoiseLane = (typeof LANES)[number];

interface LaneNodes {
  source: AudioBufferSourceNode;
  gate: GainNode;
}

export class NoiseModule extends InstrumentModule {
  private _lanes: (LaneNodes | null)[] = [null, null, null, null];

  static get id(): string {
    return 'noise';
  }

  static get name(): string {
    return 'Noise';
  }

  static get description(): string {
    return 'White/pink/brown/green noise colors with scheduled gating';
  }

  static get category(): InstrumentCategory {
    return 'noise';
  }

  static get noteMode(): NoteMode {
    return 'lanes';
  }

  static get lanes(): readonly string[] {
    return LANES;
  }

  static get parameterDefinitions(): readonly ParameterDefinition[] {
    return [
      { name: 'level', label: 'Level', min: 0, max: 100, default: 80, unit: '%' },
      { name: 'attack', label: 'Attack', min: 0.005, max: 2, default: 0.05, unit: 's' },
      { name: 'release', label: 'Release', min: 0.01, max: 4, default: 0.3, unit: 's' }
    ];
  }

  constructor(audioContext: AudioContext, options: Record<string, unknown> = {}) {
    super(audioContext, options);
    this._applyParam('level', this._params.level, 0);
  }

  private _ensureLane(laneIdx: number): LaneNodes | null {
    if (laneIdx < 0 || laneIdx >= LANES.length) return null;
    let lane = this._lanes[laneIdx];
    if (lane) return lane;

    const gate = this.ctx.createGain();
    gate.gain.value = 0;
    gate.connect(this.output);

    const node = this._createNoiseSource(LANES[laneIdx]);
    node.tail.connect(gate);

    lane = { source: node.source, gate };
    this._lanes[laneIdx] = lane;
    return lane;
  }

  /**
   * Build a looping noise source (port of neon-noise createNoiseNode).
   * Returns the source plus the last node of its chain (bandpass for green).
   */
  private _createNoiseSource(type: NoiseLane): { source: AudioBufferSourceNode; tail: AudioNode } {
    const bufferSize = 2 * this.ctx.sampleRate;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);

    if (type === 'white' || type === 'green') {
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
    } else if (type === 'pink') {
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
        b6 = white * 0.115926;
      }
    } else if (type === 'brown') {
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        const out = (lastOut + 0.02 * white) / 1.02;
        data[i] = out * 3.5;
        lastOut = out;
      }
    }

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.start(0);

    if (type === 'green') {
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1000;
      filter.Q.value = 1.5;
      source.connect(filter);
      return { source, tail: filter };
    }
    return { source, tail: source };
  }

  noteOn(note: number, velocity: number, time: number): void {
    const lane = this._ensureLane(note);
    if (!lane) return;
    lane.gate.gain.setTargetAtTime(velocity, time, this._params.attack / 3);
  }

  noteOff(note: number, time: number): void {
    const lane = this._lanes[note];
    if (!lane) return;
    lane.gate.gain.setTargetAtTime(0, time, this._params.release / 3);
  }

  allNotesOff(afterTime?: number): void {
    const at = Math.max(afterTime ?? this.ctx.currentTime, this.ctx.currentTime);
    for (const lane of this._lanes) {
      if (!lane) continue;
      lane.gate.gain.cancelScheduledValues(at);
      lane.gate.gain.setTargetAtTime(0, at, 0.02);
    }
  }

  protected _applyParam(name: string, value: number, rampTime: number): void {
    if (name === 'level') {
      this._setAudioParam(this.output.gain, value / 100, rampTime);
    }
    // attack/release are read at gate time.
  }

  destroy(): void {
    super.destroy();
    for (const lane of this._lanes) {
      lane?.source.stop();
      lane?.source.disconnect();
      lane?.gate.disconnect();
    }
    this._lanes = [null, null, null, null];
  }
}
