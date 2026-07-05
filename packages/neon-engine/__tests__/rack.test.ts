/**
 * ChannelRack + ModEngine tests: graph construction from serialized state,
 * serialize round-trips, mod target resolution that never corrupts saved
 * state, mute/solo audibility, and deterministic control-rate modulation.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MockAudioContext, createMockAudioContext } from '../../neon-fx/__mocks__/web-audio';
import { ChannelRack } from '../src/channel-rack';
import { ModEngine } from '../src/mod-engine';
import { createChannelState } from '../src/song-model';

function asCtx(mock: MockAudioContext): AudioContext {
  return mock as unknown as AudioContext;
}

describe('ChannelRack', () => {
  let ctx: MockAudioContext;
  let rack: ChannelRack;

  beforeEach(() => {
    ctx = createMockAudioContext();
    rack = new ChannelRack(asCtx(ctx));
  });

  it('builds a channel from serialized state via the registries', async () => {
    const state = createChannelState('BASS', 'poly-synth', {
      columns: 2,
      instrumentParams: { cutoff: 900 },
      instrumentExtra: { waveform: 'square' },
      fx: [{ id: 'delay', bypassed: false, params: { time: 250, feedback: 30, mix: 40 } }]
    });

    const ch = await rack.addChannel('ch2', state);
    expect(ch.instrument.getParam('cutoff')).toBe(900);
    expect(ch.fx.length).toBe(1);
    expect(ch.fx.get(0)?.serialize().id).toBe('delay');
    expect(ch.fx.get(0)?.getParam('time')).toBe(250);

    const dispatch = rack.getDispatch();
    expect(dispatch).toEqual([
      expect.objectContaining({ id: 'ch2', noteMode: 'pitched', audible: true })
    ]);
  });

  it('serializeChannel round-trips the full channel state', async () => {
    const state = createChannelState('BASS', 'poly-synth', {
      columns: 2,
      gain: 0.6,
      pan: -0.25,
      sends: { delay: 0.3, reverb: 0.1 },
      instrumentExtra: { waveform: 'square' },
      fx: [{ id: 'reverb', bypassed: true, params: {} }]
    });
    await rack.addChannel('ch2', state);

    const out = rack.serializeChannel('ch2')!;
    expect(out.name).toBe('BASS');
    expect(out.gain).toBe(0.6);
    expect(out.pan).toBe(-0.25);
    expect(out.sends).toEqual({ delay: 0.3, reverb: 0.1 });
    expect(out.instrument.id).toBe('poly-synth');
    expect(out.instrument.extra).toMatchObject({ waveform: 'square' });
    expect(out.fx).toEqual([expect.objectContaining({ id: 'reverb', bypassed: true })]);
    expect(out.columns).toBe(2);
  });

  it('resolves mod targets and modulation never touches serialized state', async () => {
    await rack.addChannel('ch1', createChannelState('LEAD', 'poly-synth', {
      fx: [{ id: 'delay', bypassed: false, params: {} }]
    }));

    const inst = rack.resolveModTarget('ch1', 'inst.cutoff');
    expect(inst?.def.name).toBe('cutoff');
    expect(inst?.base).toBe(8000);
    inst?.apply(12000);
    expect(rack.serializeChannel('ch1')!.instrument.params.cutoff).toBe(8000);

    const fx = rack.resolveModTarget('ch1', 'fx0.mix');
    expect(fx?.def.name).toBe('mix');
    fx?.apply(80);
    expect(rack.serializeChannel('ch1')!.fx[0].params.mix).toBe(fx!.base);

    expect(rack.resolveModTarget('ch1', 'channel.gain')?.def).toMatchObject({ min: 0, max: 1 });
    expect(rack.resolveModTarget('ch1', 'fx5.mix')).toBeNull();
    expect(rack.resolveModTarget('ch1', 'inst.nonexistent')).toBeNull();
    expect(rack.resolveModTarget('nope', 'inst.cutoff')).toBeNull();
  });

  it('solo silences other channels in dispatch and audio', async () => {
    await rack.addChannel('ch1', createChannelState('DRUMS', 'tr909-kit', { columns: 11 }));
    await rack.addChannel('ch2', createChannelState('BASS', 'poly-synth'));

    rack.setChannelSolo('ch2', true);
    expect(rack.isAudible('ch1')).toBe(false);
    expect(rack.isAudible('ch2')).toBe(true);
    const ch1 = rack.getChannel('ch1')!;
    expect((ch1.muteGain.gain as unknown as { _value: number })._value).toBe(0);

    rack.setChannelSolo('ch2', false);
    expect(rack.isAudible('ch1')).toBe(true);
  });

  it('removeChannel tears the channel down', async () => {
    await rack.addChannel('ch1', createChannelState('NOISE', 'noise', { columns: 4 }));
    rack.removeChannel('ch1');
    expect(rack.getChannel('ch1')).toBeUndefined();
    expect(rack.getDispatch()).toEqual([]);
  });
});

describe('ModEngine', () => {
  let ctx: MockAudioContext;
  let rack: ChannelRack;
  let engine: ModEngine;

  beforeEach(async () => {
    vi.useFakeTimers();
    ctx = createMockAudioContext();
    rack = new ChannelRack(asCtx(ctx));
    await rack.addChannel('ch1', createChannelState('LEAD', 'poly-synth'));
    await rack.addChannel('ch2', createChannelState('DRUMS', 'tr909-kit', { columns: 11 }));
    engine = new ModEngine(asCtx(ctx), rack, { getBpm: () => 120 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function oscCount(): number {
    return ctx._nodes.filter(n =>
      (n as { constructor: { name: string } }).constructor.name === 'MockOscillatorNode'
    ).length;
  }

  it('applies control-rate LFO modulation around the base without corrupting state', () => {
    // tr909 'level' has no backing AudioParam -> control-rate path
    const ch = rack.getChannel('ch2')!;
    ch.mods.routes.push({ source: 'lfo1', target: 'inst.level', depth: 1 });
    // lfo1 defaults: 1 Hz sine

    ctx.currentTime = 0;
    engine.start();
    ctx.currentTime = 0.25; // sine peak at quarter period
    engine.tick();

    // base 80 + 1 * (100-0) * 1 * 0.5 = 130, clamped to 100 -> output gain 1.0
    const out = ch.instrument.output.gain as unknown as { _value: number };
    expect(out._value).toBeCloseTo(1.0, 6);
    expect(ch.instrument.serialize().params.level).toBe(80);
  });

  it('routes unit-native LFO targets through the audio-rate fast path', () => {
    const ch = rack.getChannel('ch1')!;
    ch.mods.routes.push({ source: 'lfo1', target: 'inst.cutoff', depth: 0.5 });

    ctx.currentTime = 0;
    engine.start();
    const before = oscCount();
    engine.tick();

    // one real oscillator spun up, wired via a depth gain to the AudioParam
    expect(oscCount()).toBe(before + 1);
    const freqParam = ch.instrument.getModTarget('cutoff');
    const depthGains = ctx._nodes.filter(n =>
      (n as { _connections?: Array<{ destination: unknown }> })._connections?.some(
        c => c.destination === freqParam
      )
    );
    expect(depthGains.length).toBe(1);
    // stored state untouched
    expect(ch.instrument.serialize().params.cutoff).toBe(8000);

    // removing the route tears the oscillator down on the next tick
    ch.mods.routes.length = 0;
    engine.tick();
    const osc = ctx._nodes.find(n =>
      (n as { constructor: { name: string }; _stopped?: boolean }).constructor.name === 'MockOscillatorNode'
    ) as { _stopped: boolean };
    expect(osc._stopped).toBe(true);
  });

  it('menv follows note triggers at control rate even on unit-native targets', () => {
    const ch = rack.getChannel('ch1')!;
    ch.mods.routes.push({ source: 'menv', target: 'inst.cutoff', depth: 0.5 });
    ch.mods.menv = { attack: 0.1, decay: 1 };

    ctx.currentTime = 0;
    engine.start();

    ctx.currentTime = 1.0;
    engine.tick(); // no trigger yet -> source 0 -> base value
    const freq = ch.instrument.getModTarget('cutoff') as unknown as { _value: number };
    expect(freq._value).toBeCloseTo(8000, 6);

    engine.notifyTrigger('ch1', 1.0);
    ctx.currentTime = 1.05; // mid-attack: source = 0.5
    engine.tick();
    // 8000 + 0.5 * 17980 * 0.5 * 0.5 = 10247.5
    expect(freq._value).toBeCloseTo(10247.5, 4);
  });

  it('stop() restores control-rate targets and tears down audio-rate nodes', () => {
    const drums = rack.getChannel('ch2')!;
    drums.mods.routes.push({ source: 'lfo1', target: 'inst.level', depth: 1 });
    const lead = rack.getChannel('ch1')!;
    lead.mods.routes.push({ source: 'lfo2', target: 'inst.cutoff', depth: 1 });

    ctx.currentTime = 0;
    engine.start();
    ctx.currentTime = 0.25;
    engine.tick();

    const out = drums.instrument.output.gain as unknown as { _value: number };
    expect(out._value).not.toBeCloseTo(0.8, 2);

    engine.stop();
    expect(out._value).toBeCloseTo(0.8, 6);
    const oscs = ctx._nodes.filter(n =>
      (n as { constructor: { name: string } }).constructor.name === 'MockOscillatorNode'
    ) as Array<{ _stopped: boolean }>;
    expect(oscs.every(o => o._stopped)).toBe(true);
  });
});
