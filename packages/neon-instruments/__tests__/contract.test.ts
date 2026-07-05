/**
 * InstrumentModule contract tests: parameter clamping, modulation isolation
 * from serialized state, serialize/deserialize round-trips, and registry
 * consistency.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MockAudioContext, createMockAudioContext } from '../../neon-fx/__mocks__/web-audio';
import { PolySynth } from '../src/poly-synth';
import { TR909Kit } from '../src/tr909-kit';
import { NoiseModule } from '../src/noise-module';
import {
  createInstrument,
  getAvailableInstruments,
  instrumentDescriptors,
  midiToFrequency
} from '../src/index';
import type { InstrumentConstructor } from '../src/types';

function asCtx(mock: MockAudioContext): AudioContext {
  return mock as unknown as AudioContext;
}

describe('InstrumentModule contract', () => {
  let ctx: MockAudioContext;
  let synth: PolySynth;

  beforeEach(() => {
    ctx = createMockAudioContext();
    synth = new PolySynth(asCtx(ctx));
  });

  it('initializes params from definitions and clamps setParam', () => {
    expect(synth.getParam('cutoff')).toBe(8000);
    synth.setParam('cutoff', 99999);
    expect(synth.getParam('cutoff')).toBe(18000);
    synth.setParam('cutoff', -5);
    expect(synth.getParam('cutoff')).toBe(20);
  });

  it('setModulatedParam moves audio nodes but never serialized state', () => {
    synth.setParam('cutoff', 1000);
    synth.setModulatedParam('cutoff', 4000);
    expect(synth.getParam('cutoff')).toBe(1000);
    expect(synth.serialize().params.cutoff).toBe(1000);
    // but the filter actually moved
    const target = synth.getModTarget('cutoff') as unknown as { value: number };
    expect(target.value).toBe(4000);
  });

  it('getModTarget exposes only unit-native AudioParams', () => {
    expect(synth.getModTarget('cutoff')).not.toBeNull();
    expect(synth.getModTarget('resonance')).not.toBeNull();
    expect(synth.getModTarget('attack')).toBeNull();
    expect(synth.getModTarget('nonexistent')).toBeNull();
  });

  it('PolySynth serialize/deserialize round-trips params and waveform', () => {
    synth.setParam('cutoff', 1234);
    synth.waveform = 'square';
    const state = synth.serialize();
    expect(state.id).toBe('poly-synth');

    const restored = new PolySynth(asCtx(createMockAudioContext()));
    restored.deserialize(state);
    expect(restored.getParam('cutoff')).toBe(1234);
    expect(restored.waveform).toBe('square');
  });

  it('TR909Kit serialize/deserialize round-trips lane params', () => {
    const kit = new TR909Kit(asCtx(ctx));
    kit.setLaneParams('bassDrum', { tune: 30, decay: 100 });
    const state = kit.serialize();
    expect(state.extra).toEqual({ laneParams: { bassDrum: { tune: 30, decay: 100 } } });

    const restored = new TR909Kit(asCtx(createMockAudioContext()));
    restored.deserialize(state);
    expect(restored.getLaneParams('bassDrum')).toEqual({ tune: 30, decay: 100 });
  });

  it('midiToFrequency follows A4 = 69 = 440Hz', () => {
    expect(midiToFrequency(69)).toBe(440);
    expect(midiToFrequency(57)).toBeCloseTo(220, 6);
    expect(midiToFrequency(60)).toBeCloseTo(261.6256, 3);
  });
});

describe('instrument registry', () => {
  it('createInstrument instantiates by id', async () => {
    const ctx = createMockAudioContext();
    const inst = await createInstrument('poly-synth', asCtx(ctx));
    expect(inst).toBeInstanceOf(PolySynth);
  });

  it('throws on unknown id', async () => {
    const ctx = createMockAudioContext();
    await expect(createInstrument('nope', asCtx(ctx))).rejects.toThrow('Unknown instrument id: nope');
  });

  it('descriptors stay in sync with class static metadata', () => {
    const classes: Record<string, InstrumentConstructor> = {
      'tr909-kit': TR909Kit as unknown as InstrumentConstructor,
      'poly-synth': PolySynth as unknown as InstrumentConstructor,
      'noise': NoiseModule as unknown as InstrumentConstructor
    };
    for (const desc of instrumentDescriptors) {
      const cls = classes[desc.id];
      expect(cls, `descriptor for unknown class ${desc.id}`).toBeDefined();
      expect(desc.name).toBe(cls.name);
      expect(desc.description).toBe(cls.description);
      expect(desc.category).toBe(cls.category);
      expect(desc.noteMode).toBe(cls.noteMode);
      expect(desc.lanes).toEqual(cls.lanes);
    }
    expect(getAvailableInstruments().map(d => d.id).sort()).toEqual(
      Object.keys(classes).sort()
    );
  });
});
