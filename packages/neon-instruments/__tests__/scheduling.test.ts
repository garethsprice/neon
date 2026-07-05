/**
 * Future-scheduling semantics tests — the highest-risk part of the
 * instrument contract. Every note method must honor its absolute `time`
 * argument, voice stealing must never touch future-scheduled voices, and
 * allNotesOff(afterTime) must cancel events inside the lookahead window.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  MockAudioContext,
  MockGainNode,
  MockOscillatorNode,
  MockAudioBufferSourceNode,
  createMockAudioContext
} from '../../neon-fx/__mocks__/web-audio';
import { PolySynth } from '../src/poly-synth';
import { TR909Kit, type CompressedManifest } from '../src/tr909-kit';
import { NoiseModule } from '../src/noise-module';

function asCtx(mock: MockAudioContext): AudioContext {
  return mock as unknown as AudioContext;
}

function oscillators(ctx: MockAudioContext): MockOscillatorNode[] {
  return ctx._nodes.filter((n): n is MockOscillatorNode => n instanceof MockOscillatorNode);
}

function bufferSources(ctx: MockAudioContext): MockAudioBufferSourceNode[] {
  return ctx._nodes.filter((n): n is MockAudioBufferSourceNode => n instanceof MockAudioBufferSourceNode);
}

function gains(ctx: MockAudioContext): MockGainNode[] {
  return ctx._nodes.filter((n): n is MockGainNode => n instanceof MockGainNode);
}

describe('PolySynth scheduling', () => {
  let ctx: MockAudioContext;
  let synth: PolySynth;

  beforeEach(() => {
    ctx = createMockAudioContext();
    synth = new PolySynth(asCtx(ctx));
  });

  it('trigger() starts oscillators exactly at the requested time', () => {
    synth.trigger({ time: 1.0, note: 60, velocity: 0.8, duration: 0.25 });
    const oscs = oscillators(ctx);
    expect(oscs.length).toBe(1); // detune 0 -> single osc
    expect(oscs[0]._startTime).toBe(1.0);
  });

  it('trigger() pre-schedules the complete envelope at absolute times', () => {
    const attack = synth.getParam('attack');
    const decay = synth.getParam('decay');
    const release = synth.getParam('release');

    synth.trigger({ time: 2.0, note: 60, velocity: 1.0, duration: 0.5 });

    // env gain is the last created gain node
    const env = gains(ctx)[gains(ctx).length - 1];
    const events = env.gain._scheduledValues;

    expect(events[0]).toMatchObject({ type: 'setValueAtTime', value: 0, time: 2.0 });
    expect(events[1]).toMatchObject({ type: 'linearRampToValueAtTime', value: 1.0, endTime: 2.0 + attack });
    expect(events[2]).toMatchObject({ type: 'linearRampToValueAtTime', endTime: 2.0 + attack + decay });
    // release pre-scheduled at time + duration
    expect(events[3]).toMatchObject({ type: 'setTargetAtTime', target: 0, startTime: 2.5 });

    // oscillator stop scheduled after the release tail
    const osc = oscillators(ctx)[0];
    expect(osc._stopTime).toBeCloseTo(2.5 + release + 0.1, 6);
  });

  it('creates a detuned twin oscillator when detune > 0', () => {
    synth.setParam('detune', 10);
    synth.trigger({ time: 1.0, note: 60, velocity: 0.8, duration: 0.25 });
    const oscs = oscillators(ctx);
    expect(oscs.length).toBe(2);
    expect(oscs[0].detune._scheduledValues[0]).toMatchObject({ value: -5, time: 1.0 });
    expect(oscs[1].detune._scheduledValues[0]).toMatchObject({ value: 5, time: 1.0 });
  });

  it('never steals voices scheduled after the new event time', () => {
    // Fill the pool: 31 sounding voices + 1 future-scheduled voice.
    for (let i = 0; i < 31; i++) {
      synth.trigger({ time: 0.1 + i * 0.01, note: 30 + i, velocity: 0.8, duration: 10 });
    }
    synth.trigger({ time: 5.0, note: 100, velocity: 0.8, duration: 1 }); // future voice
    expect(synth.voiceCount).toBe(32);

    const futureOsc = oscillators(ctx)[31];
    expect(futureOsc._startTime).toBe(5.0);
    const futureStop = futureOsc._stopTime;

    // Pool is full; new event at t=1.0 must steal the OLDEST sounding voice.
    synth.trigger({ time: 1.0, note: 61, velocity: 0.8, duration: 1 });
    expect(synth.voiceCount).toBe(32);

    const oldestOsc = oscillators(ctx)[0];
    expect(oldestOsc._stopTime).toBeCloseTo(1.05, 6); // stolen: stopped just after the event
    expect(futureOsc._stopTime).toBe(futureStop);     // untouched
  });

  it('noteOff() ignores voices that start after the release time', () => {
    synth.noteOn(60, 0.8, 3.0); // scheduled in the future
    synth.noteOff(60, 1.0);     // release BEFORE the voice starts
    const osc = oscillators(ctx)[0];
    expect(osc._stopTime).toBeUndefined(); // not released
  });

  it('allNotesOff(afterTime) cancels scheduled events and stops all voices', () => {
    synth.trigger({ time: 1.0, note: 60, velocity: 0.8, duration: 4 });
    synth.trigger({ time: 2.5, note: 62, velocity: 0.8, duration: 4 }); // inside lookahead
    const envs = [gains(ctx)[gains(ctx).length - 2], gains(ctx)[gains(ctx).length - 1]];

    synth.allNotesOff(2.0);

    for (const env of envs) {
      // cancelScheduledValues wipes the mock's log; only the fade remains
      expect(env.gain._scheduledValues).toEqual([
        expect.objectContaining({ type: 'setTargetAtTime', target: 0, startTime: 2.0 })
      ]);
    }
    for (const osc of oscillators(ctx)) {
      expect(osc._stopTime).toBeCloseTo(2.1, 6);
    }
    expect(synth.voiceCount).toBe(0);
  });
});

describe('TR909Kit scheduling', () => {
  let ctx: MockAudioContext;
  let kit: TR909Kit;

  const manifest: CompressedManifest = {
    d: {
      bassDrum: [
        ['bd-soft', 0, 500, 50],
        ['bd-hard', 600, 500, 100]
      ],
      closedHiHat: [['ch', 2100, 200, 50]],
      openHiHat: [['oh', 1200, 800, 50]]
    },
    def: {
      bassDrum: ['velocity'],
      closedHiHat: ['velocity'],
      openHiHat: ['velocity']
    }
  };

  const BD = 0;
  const CH = 7;
  const OH = 8;

  beforeEach(() => {
    ctx = createMockAudioContext();
    kit = new TR909Kit(asCtx(ctx));
    kit.loadData(manifest, ctx.createBuffer(2, 44100, 44100) as unknown as AudioBuffer);
  });

  it('noteOn() starts the sample slice exactly at the requested time', () => {
    kit.noteOn(BD, 0.8, 2.5);
    const src = bufferSources(ctx)[0];
    expect(src._startTime).toBe(2.5);
    expect(src._startOffset).toBe(0);        // velocity 50 layer
    expect(src._startDuration).toBe(0.5);
  });

  it('accent velocity selects the hot sample layer', () => {
    kit.noteOn(BD, 1.0, 1.0);
    const src = bufferSources(ctx)[0];
    expect(src._startOffset).toBe(0.6);      // velocity 100 layer at 600ms
  });

  it('closed hi-hat chokes the sounding open hi-hat at the hit time', () => {
    kit.noteOn(OH, 0.8, 1.0);
    const openHatGain = gains(ctx)[gains(ctx).length - 1];

    kit.noteOn(CH, 0.8, 1.5);

    expect(openHatGain.gain._scheduledValues).toContainEqual(
      expect.objectContaining({ type: 'setTargetAtTime', target: 0, startTime: 1.5 })
    );
  });

  it('allNotesOff(afterTime) stops scheduled hits', () => {
    kit.noteOn(BD, 0.8, 1.0);
    kit.noteOn(BD, 0.8, 2.5); // inside lookahead window
    kit.allNotesOff(2.0);
    for (const src of bufferSources(ctx)) {
      expect(src._stopTime).toBeCloseTo(2.05, 6);
    }
  });
});

describe('NoiseModule scheduling', () => {
  let ctx: MockAudioContext;
  let noise: NoiseModule;

  beforeEach(() => {
    ctx = createMockAudioContext();
    noise = new NoiseModule(asCtx(ctx));
  });

  it('noteOn() opens the lane gate at the requested time', () => {
    noise.noteOn(0, 0.6, 2.0);
    const gate = gains(ctx)[gains(ctx).length - 1];
    expect(gate.gain._scheduledValues).toContainEqual(
      expect.objectContaining({ type: 'setTargetAtTime', target: 0.6, startTime: 2.0 })
    );
  });

  it('trigger() with duration schedules the gate close', () => {
    noise.trigger({ time: 2.0, note: 1, velocity: 1.0, duration: 0.5 });
    const gate = gains(ctx)[gains(ctx).length - 1];
    expect(gate.gain._scheduledValues).toContainEqual(
      expect.objectContaining({ type: 'setTargetAtTime', target: 0, startTime: 2.5 })
    );
  });

  it('green lane routes through a bandpass filter', () => {
    noise.noteOn(3, 0.5, 1.0);
    const filters = ctx._nodes.filter(n => (n as { type?: string }).type === 'bandpass');
    expect(filters.length).toBe(1);
  });

  it('allNotesOff(afterTime) cancels pending gate events', () => {
    noise.trigger({ time: 1.0, note: 0, velocity: 1.0, duration: 5 });
    const gate = gains(ctx)[gains(ctx).length - 1];
    noise.allNotesOff(2.0);
    expect(gate.gain._scheduledValues).toEqual([
      expect.objectContaining({ type: 'setTargetAtTime', target: 0, startTime: 2.0 })
    ]);
  });
});
