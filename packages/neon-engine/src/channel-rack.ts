/**
 * ChannelRack - Live audio graph for the studio's channels.
 *
 * Per channel (the proven neon-synth send-bus topology):
 *
 *   instrument.output -> PluginChain (insert FX) -> channelGain
 *     -> StereoPannerNode -> muteGain -> masterGain
 *   panner -> delaySend  -> shared delay bus  (Delay,  mix 100)
 *   panner -> reverbSend -> shared reverb bus (Reverb, mix 100)
 *
 * Master: masterGain -> Compressor -> Limiter -> Analyser -> destination.
 *
 * The rack is the source of truth for live channel state (name, gain, pan,
 * mute/solo, sends, mods, columns); serializeChannels() emits ChannelState
 * records and applyChannelState()/addChannel() reconstruct the graph through
 * the fx/instrument registries (PluginChain.deserialize alone cannot
 * instantiate plugins).
 */

import {
  Compressor,
  Delay,
  Limiter,
  PluginChain,
  Reverb,
  createPlugin,
  AudioPlugin,
  type ParameterDefinition
} from '@neon/fx';
import {
  createInstrument,
  type InstrumentConstructor,
  type InstrumentModule
} from '@neon/instruments';
import type { ChannelId, ChannelModsState, ChannelState } from './song-model';
import { createDefaultMods } from './song-model';
import type { ChannelDispatch } from './player';

export interface RackChannel {
  id: ChannelId;
  name: string;
  instrument: InstrumentModule;
  fx: PluginChain;
  gainNode: GainNode;
  panner: StereoPannerNode;
  muteGain: GainNode;
  duckGain: GainNode;
  delaySend: GainNode;
  reverbSend: GainNode;
  gain: number;
  pan: number;
  mute: boolean;
  solo: boolean;
  sends: { delay: number; reverb: number };
  /** Sidechain duck amount from kick hits, 0..1 */
  duck: number;
  mods: ChannelModsState;
  columns: number;
}

/** A resolved modulation target: apply moves audio only, def gives the range. */
export interface ResolvedModTarget {
  def: ParameterDefinition;
  base: number;
  apply: (value: number, rampTime?: number) => void;
  /**
   * Backing AudioParam when the declared unit is the node's native unit
   * (def.modulatable) — enables the audio-rate LFO fast path. Null means
   * control-rate only.
   */
  audioParam: AudioParam | null;
}

const SMOOTH = 0.02;

export class ChannelRack {
  readonly ctx: AudioContext;
  readonly masterGain: GainNode;
  readonly analyser: AnalyserNode;

  private _compressor: Compressor;
  private _limiter: Limiter;
  private _delayBus: GainNode;
  private _reverbBus: GainNode;
  private _delay: Delay;
  private _reverb: Reverb;
  private _channels = new Map<ChannelId, RackChannel>();
  private _masterVolume = 0.8;

  constructor(audioContext: AudioContext) {
    this.ctx = audioContext;

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this._masterVolume;

    this._compressor = new Compressor(this.ctx, {});
    this._limiter = new Limiter(this.ctx, { threshold: -1, release: 50 });
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 256;

    this.masterGain.connect(this._compressor.input);
    this._compressor.connect(this._limiter);
    this._limiter.output.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);

    // Shared send FX, fully wet; per-channel send gains set the amount.
    this._delayBus = this.ctx.createGain();
    this._delay = new Delay(this.ctx, { time: 375, feedback: 35, mix: 100 });
    this._delayBus.connect(this._delay.input);
    this._delay.output.connect(this.masterGain);

    this._reverbBus = this.ctx.createGain();
    this._reverb = new Reverb(this.ctx, { mix: 100, decay: 2, damping: 50 });
    this._reverbBus.connect(this._reverb.input);
    this._reverb.output.connect(this.masterGain);
  }

  get masterVolume(): number {
    return this._masterVolume;
  }

  setMasterVolume(value: number): void {
    this._masterVolume = Math.max(0, Math.min(1, value));
    this.masterGain.gain.setTargetAtTime(this._masterVolume, this.ctx.currentTime, SMOOTH);
  }

  get channelIds(): ChannelId[] {
    return [...this._channels.keys()];
  }

  getChannel(id: ChannelId): RackChannel | undefined {
    return this._channels.get(id);
  }

  /**
   * Create a channel from serialized state: instrument via the instrument
   * registry, FX chain via the fx plugin registry.
   */
  async addChannel(id: ChannelId, state: ChannelState): Promise<RackChannel> {
    if (this._channels.has(id)) {
      throw new Error(`Channel already exists: ${id}`);
    }

    // Constructor options carry ctor-time extras (waveform, sample urls);
    // deserialize() then restores the full param/extra state rigorously.
    const instrument = await createInstrument(state.instrument.id, this.ctx, {
      ...(state.instrument.extra ?? {}),
      ...state.instrument.params
    });
    instrument.deserialize(state.instrument);

    const fx = new PluginChain(this.ctx);
    for (const pluginState of state.fx) {
      const plugin = await createPlugin(pluginState.id, this.ctx, pluginState.params);
      if (pluginState.bypassed) {
        plugin.bypassed = true;
      }
      fx.add(plugin);
    }

    const gainNode = this.ctx.createGain();
    const panner = this.ctx.createStereoPanner();
    const muteGain = this.ctx.createGain();
    const duckGain = this.ctx.createGain();
    const delaySend = this.ctx.createGain();
    const reverbSend = this.ctx.createGain();

    gainNode.gain.value = state.gain;
    panner.pan.value = state.pan;
    delaySend.gain.value = state.sends.delay;
    reverbSend.gain.value = state.sends.reverb;

    instrument.connect(fx.input);
    fx.output.connect(gainNode);
    gainNode.connect(panner);
    panner.connect(muteGain);
    muteGain.connect(duckGain);
    duckGain.connect(this.masterGain);
    panner.connect(delaySend);
    delaySend.connect(this._delayBus);
    panner.connect(reverbSend);
    reverbSend.connect(this._reverbBus);

    const channel: RackChannel = {
      id,
      name: state.name,
      instrument,
      fx,
      gainNode,
      panner,
      muteGain,
      duckGain,
      delaySend,
      reverbSend,
      gain: state.gain,
      pan: state.pan,
      mute: state.mute,
      solo: false,
      sends: { ...state.sends },
      duck: state.duck ?? 0,
      mods: state.mods ?? createDefaultMods(),
      columns: state.columns
    };
    this._channels.set(id, channel);
    this._applyAudibility();
    return channel;
  }

  removeChannel(id: ChannelId): void {
    const ch = this._channels.get(id);
    if (!ch) return;
    ch.instrument.destroy();
    ch.fx.destroy();
    ch.gainNode.disconnect();
    ch.panner.disconnect();
    ch.muteGain.disconnect();
    ch.duckGain.disconnect();
    ch.delaySend.disconnect();
    ch.reverbSend.disconnect();
    this._channels.delete(id);
    this._applyAudibility();
  }

  removeAllChannels(): void {
    for (const id of this.channelIds) {
      this.removeChannel(id);
    }
  }

  setChannelName(id: ChannelId, name: string): void {
    const ch = this._channels.get(id);
    if (ch) ch.name = name;
  }

  /**
   * Swap a channel's instrument in place (FX chain and mix settings stay).
   * Any playing notes on the old instrument are cut.
   */
  async replaceInstrument(
    id: ChannelId,
    instrumentId: string,
    options: Record<string, unknown> = {}
  ): Promise<InstrumentModule | null> {
    const ch = this._channels.get(id);
    if (!ch) return null;
    const next = await createInstrument(instrumentId, this.ctx, options);
    ch.instrument.destroy();
    next.connect(ch.fx.input);
    ch.instrument = next;
    return next;
  }

  /** Replace the channel's whole FX chain from serialized plugin states. */
  async setChannelFxChain(
    id: ChannelId,
    states: Array<{ id: string; params?: Record<string, number>; bypassed?: boolean }>
  ): Promise<void> {
    const ch = this._channels.get(id);
    if (!ch) return;
    ch.fx.clear(true);
    for (const state of states) {
      const plugin = await createPlugin(state.id, this.ctx, state.params ?? {});
      if (state.bypassed) plugin.bypassed = true;
      ch.fx.add(plugin);
    }
  }

  setChannelGain(id: ChannelId, gain: number): void {
    const ch = this._channels.get(id);
    if (!ch) return;
    ch.gain = Math.max(0, Math.min(1, gain));
    ch.gainNode.gain.setTargetAtTime(ch.gain, this.ctx.currentTime, SMOOTH);
  }

  setChannelPan(id: ChannelId, pan: number): void {
    const ch = this._channels.get(id);
    if (!ch) return;
    ch.pan = Math.max(-1, Math.min(1, pan));
    ch.panner.pan.setTargetAtTime(ch.pan, this.ctx.currentTime, SMOOTH);
  }

  setChannelMute(id: ChannelId, mute: boolean): void {
    const ch = this._channels.get(id);
    if (!ch) return;
    ch.mute = mute;
    this._applyAudibility();
  }

  setChannelSolo(id: ChannelId, solo: boolean): void {
    const ch = this._channels.get(id);
    if (!ch) return;
    ch.solo = solo;
    this._applyAudibility();
  }

  setChannelDuck(id: ChannelId, amount: number): void {
    const ch = this._channels.get(id);
    if (!ch) return;
    ch.duck = Math.max(0, Math.min(1, amount));
  }

  /**
   * Sidechain pump: dip every other ducking channel at an absolute event
   * time (called by the app on scheduled kick-lane hits). Events arrive in
   * time order from the lookahead transport, so no cancellation is needed.
   */
  triggerDuck(sourceChannelId: ChannelId, time: number, release = 0.12): void {
    for (const ch of this._channels.values()) {
      if (ch.id === sourceChannelId || ch.duck <= 0) continue;
      ch.duckGain.gain.setTargetAtTime(1 - ch.duck, time, 0.005);
      ch.duckGain.gain.setTargetAtTime(1, time + 0.03, release);
    }
  }

  setChannelSend(id: ChannelId, send: 'delay' | 'reverb', amount: number): void {
    const ch = this._channels.get(id);
    if (!ch) return;
    const clamped = Math.max(0, Math.min(1, amount));
    ch.sends[send] = clamped;
    const node = send === 'delay' ? ch.delaySend : ch.reverbSend;
    node.gain.setTargetAtTime(clamped, this.ctx.currentTime, SMOOTH);
  }

  /** True when the channel would trigger notes (mute/solo resolved). */
  isAudible(id: ChannelId): boolean {
    const ch = this._channels.get(id);
    if (!ch) return false;
    const anySolo = [...this._channels.values()].some(c => c.solo);
    return !ch.mute && (!anySolo || ch.solo);
  }

  /** Mute/solo-resolved dispatch list for the Player. */
  getDispatch(): ChannelDispatch[] {
    return [...this._channels.values()].map(ch => {
      const ctor = ch.instrument.constructor as unknown as InstrumentConstructor;
      return {
        id: ch.id,
        instrument: ch.instrument,
        instrumentId: ctor.id,
        noteMode: ctor.noteMode,
        audible: this.isAudible(ch.id)
      };
    });
  }

  serializeChannel(id: ChannelId): ChannelState | undefined {
    const ch = this._channels.get(id);
    if (!ch) return undefined;
    return {
      name: ch.name,
      instrument: ch.instrument.serialize(),
      fx: ch.fx.serialize(),
      gain: ch.gain,
      pan: ch.pan,
      mute: ch.mute,
      sends: { ...ch.sends },
      duck: ch.duck,
      mods: ch.mods,
      columns: ch.columns
    };
  }

  serializeChannels(order: ChannelId[]): Record<ChannelId, ChannelState> {
    const out: Record<ChannelId, ChannelState> = {};
    for (const id of order.length ? order : this.channelIds) {
      const state = this.serializeChannel(id);
      if (state) out[id] = state;
    }
    return out;
  }

  /**
   * Resolve a mod route target string for this channel:
   * 'inst.<param>' | 'fx<slot>.<param>' | 'channel.gain' | 'channel.pan'.
   * Returns null for unknown targets (e.g. after an FX slot was replaced).
   */
  resolveModTarget(id: ChannelId, target: string): ResolvedModTarget | null {
    const ch = this._channels.get(id);
    if (!ch) return null;

    if (target === 'channel.gain') {
      return {
        def: { name: 'gain', min: 0, max: 1, default: 0.8, modulatable: true },
        base: ch.gain,
        audioParam: ch.gainNode.gain,
        apply: (value, rampTime = SMOOTH) => {
          ch.gainNode.gain.setTargetAtTime(
            Math.max(0, Math.min(1, value)), this.ctx.currentTime, rampTime
          );
        }
      };
    }
    if (target === 'channel.pan') {
      return {
        def: { name: 'pan', min: -1, max: 1, default: 0, modulatable: true },
        base: ch.pan,
        audioParam: ch.panner.pan,
        apply: (value, rampTime = SMOOTH) => {
          ch.panner.pan.setTargetAtTime(
            Math.max(-1, Math.min(1, value)), this.ctx.currentTime, rampTime
          );
        }
      };
    }

    const instMatch = target.match(/^inst\.(.+)$/);
    if (instMatch) {
      const param = instMatch[1];
      const def = (ch.instrument.constructor as unknown as InstrumentConstructor)
        .parameterDefinitions.find(d => d.name === param);
      if (!def) return null;
      return {
        def,
        base: ch.instrument.getParam(param),
        audioParam: def.modulatable ? ch.instrument.getModTarget(param) : null,
        apply: (value, rampTime) => ch.instrument.setModulatedParam(param, value, rampTime)
      };
    }

    const fxMatch = target.match(/^fx(\d+)\.(.+)$/);
    if (fxMatch) {
      const plugin = ch.fx.get(parseInt(fxMatch[1], 10));
      if (!plugin) return null;
      const param = fxMatch[2];
      const def = (plugin.constructor as typeof AudioPlugin).parameterDefinitions
        .find(d => d.name === param);
      if (!def) return null;
      return {
        def,
        base: plugin.getParam(param),
        audioParam: null, // fx params rescale in _applyParam; control-rate only
        apply: (value, rampTime) => plugin.setModulatedParam(param, value, rampTime)
      };
    }

    return null;
  }

  /** Recompute every channel's mute gain from mute/solo state. */
  private _applyAudibility(): void {
    for (const ch of this._channels.values()) {
      const audible = this.isAudible(ch.id);
      ch.muteGain.gain.setTargetAtTime(audible ? 1 : 0, this.ctx.currentTime, SMOOTH);
    }
  }

  destroy(): void {
    for (const id of this.channelIds) {
      this.removeChannel(id);
    }
    this._delay.destroy();
    this._reverb.destroy();
    this._compressor.destroy();
    this._limiter.destroy();
    this.masterGain.disconnect();
    this._delayBus.disconnect();
    this._reverbBus.disconnect();
  }
}
