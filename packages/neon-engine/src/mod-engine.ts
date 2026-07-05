/**
 * ModEngine - Control-rate modulation for channel racks.
 *
 * The honest approach (see plan): most plugin/instrument params are NOT
 * backed 1:1 by AudioParams (values get rescaled in _applyParam), so the
 * primary modulation path is a JS tick (default 25ms) that computes source
 * values and writes them through setModulatedParam — audio nodes move, the
 * serialized base value never does. ~40Hz ceiling; right for wobbles, filter
 * sweeps, tremolo, autopan. An audio-rate fast path for `modulatable`
 * unit-native params comes later (M5).
 *
 * LFO phase is derived deterministically from elapsed engine time (and BPM
 * for tempo-synced rates), so pattern loops sound consistent.
 *
 * Modulation formula per route:
 *   value = base + depth * (def.max - def.min) * source * 0.5, clamped.
 */

import type { ChannelRack } from './channel-rack';
import type { ChannelId, LfoState, ModRouteState } from './song-model';

export interface ModEngineOptions {
  tickMs?: number;
  getBpm: () => number;
}

const SMOOTH = 0.03;

function lfoFrequency(lfo: LfoState, bpm: number): number {
  if (lfo.sync) {
    // '1/N': one cycle per 1/N note -> freq = beatsPerSec * N/4
    const m = lfo.sync.match(/^1\/(\d+)$/);
    if (m) {
      return (bpm / 60) * (parseInt(m[1], 10) / 4);
    }
  }
  return lfo.rate;
}

function lfoValue(lfo: LfoState, elapsedSec: number, bpm: number): number {
  const freq = lfoFrequency(lfo, bpm);
  const phase = ((elapsedSec * freq) % 1 + 1) % 1;
  switch (lfo.wave) {
    case 'sine':
      return Math.sin(phase * 2 * Math.PI);
    case 'triangle':
      return phase < 0.5 ? phase * 4 - 1 : 3 - phase * 4;
    case 'sawtooth':
      return phase * 2 - 1;
    case 'square':
      return phase < 0.5 ? 1 : -1;
    default:
      return 0;
  }
}

export class ModEngine {
  private ctx: AudioContext;
  private rack: ChannelRack;
  private tickMs: number;
  private getBpm: () => number;
  private _timer: ReturnType<typeof setInterval> | null = null;
  private _anchorTime = 0;
  /** channelId -> last note trigger time (feeds menv). */
  private _lastTrigger = new Map<ChannelId, number>();
  /** Targets we modulated, so they can be restored to base on route removal. */
  private _touched = new Map<string, { channelId: ChannelId; target: string }>();
  /**
   * Audio-rate fast path: real oscillator -> depth gain -> AudioParam, for
   * LFO routes whose target is unit-native (def.modulatable). Keyed by
   * channel:source:target; torn down when the route disappears.
   */
  private _audioRoutes = new Map<string, { osc: OscillatorNode; gain: GainNode; param: AudioParam }>();

  constructor(audioContext: AudioContext, rack: ChannelRack, options: ModEngineOptions) {
    this.ctx = audioContext;
    this.rack = rack;
    this.tickMs = options.tickMs ?? 25;
    this.getBpm = options.getBpm;
  }

  get isRunning(): boolean {
    return this._timer !== null;
  }

  start(): void {
    if (this._timer !== null) return;
    this._anchorTime = this.ctx.currentTime;
    this._timer = setInterval(() => this.tick(), this.tickMs);
  }

  stop(): void {
    if (this._timer === null) return;
    clearInterval(this._timer);
    this._timer = null;
    for (const node of this._audioRoutes.values()) {
      node.osc.stop();
      node.gain.disconnect();
    }
    this._audioRoutes.clear();
    this.restoreBases();
  }

  /** Feed from Player.onChannelTrigger — retriggers the channel's mod env. */
  notifyTrigger(channelId: ChannelId, time: number): void {
    this._lastTrigger.set(channelId, time);
  }

  /** Write every previously-modulated target back to its base value. */
  restoreBases(): void {
    for (const { channelId, target } of this._touched.values()) {
      const resolved = this.rack.resolveModTarget(channelId, target);
      resolved?.apply(resolved.base, SMOOTH);
    }
    this._touched.clear();
  }

  /**
   * One control-rate pass. Public for deterministic testing; runs on the
   * internal interval in production.
   */
  tick(): void {
    const now = this.ctx.currentTime;
    const elapsed = now - this._anchorTime;
    const bpm = this.getBpm();
    const liveAudioKeys = new Set<string>();

    for (const channelId of this.rack.channelIds) {
      const ch = this.rack.getChannel(channelId);
      if (!ch || ch.mods.routes.length === 0) continue;

      for (const route of ch.mods.routes) {
        const resolved = this.rack.resolveModTarget(channelId, route.target);
        if (!resolved) continue;
        const range = resolved.def.max - resolved.def.min;

        // Audio-rate fast path: LFO sources onto unit-native AudioParams.
        if ((route.source === 'lfo1' || route.source === 'lfo2') && resolved.audioParam) {
          const lfo = ch.mods[route.source];
          const key = `${channelId}:${route.source}:${route.target}`;
          let node = this._audioRoutes.get(key);
          if (!node || node.param !== resolved.audioParam) {
            if (node) {
              node.osc.stop();
              node.gain.disconnect();
            }
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            gain.gain.value = 0;
            osc.connect(gain);
            gain.connect(resolved.audioParam);
            osc.start();
            node = { osc, gain, param: resolved.audioParam };
            this._audioRoutes.set(key, node);
          }
          node.osc.type = lfo.wave;
          node.osc.frequency.setTargetAtTime(lfoFrequency(lfo, bpm), now, 0.05);
          node.gain.gain.setTargetAtTime(route.depth * range * 0.5, now, 0.05);
          liveAudioKeys.add(key);
          continue;
        }

        const source = this._sourceValue(channelId, route, elapsed, now, bpm);
        const value = resolved.base + route.depth * range * source * 0.5;
        resolved.apply(value, SMOOTH);
        this._touched.set(`${channelId}:${route.target}`, { channelId, target: route.target });
      }
    }

    // tear down audio-rate nodes for removed/retargeted routes
    for (const [key, node] of this._audioRoutes) {
      if (!liveAudioKeys.has(key)) {
        node.osc.stop();
        node.gain.disconnect();
        this._audioRoutes.delete(key);
      }
    }
  }

  private _sourceValue(
    channelId: ChannelId,
    route: ModRouteState,
    elapsed: number,
    now: number,
    bpm: number
  ): number {
    const ch = this.rack.getChannel(channelId);
    if (!ch) return 0;
    switch (route.source) {
      case 'lfo1':
        return lfoValue(ch.mods.lfo1, elapsed, bpm);
      case 'lfo2':
        return lfoValue(ch.mods.lfo2, elapsed, bpm);
      case 'menv': {
        const trigger = this._lastTrigger.get(channelId);
        if (trigger === undefined || now < trigger) return 0;
        const { attack, decay } = ch.mods.menv;
        const t = now - trigger;
        // Unipolar 0..1: linear attack, exponential decay.
        if (t < attack) return t / Math.max(attack, 1e-4);
        return Math.exp(-(t - attack) / Math.max(decay, 1e-4));
      }
      default:
        return 0;
    }
  }

  destroy(): void {
    this.stop();
    this._lastTrigger.clear();
  }
}
