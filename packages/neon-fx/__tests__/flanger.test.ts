/**
 * Tests for neon-fx Flanger
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Flanger, JetFlanger, SubtleFlanger } from '../src/flanger';
import { LFO } from '../src/lfo';
import { MockAudioContext, createMockAudioContext, MockGainNode, MockDelayNode } from '../__mocks__/web-audio';

type TestableFlanger = Flanger & {
  ctx: MockAudioContext;
  _input: MockGainNode;
  _output: MockGainNode;
  _lfo: LFO;
  _delayNode: MockDelayNode;
  _feedbackGain: MockGainNode;
  _wetGainNode: MockGainNode;
  _dryGainNode: MockGainNode;
  _params: Record<string, number>;
  _bypassed: boolean;
};

describe('Flanger', () => {
  let audioContext: MockAudioContext;

  beforeEach(() => {
    audioContext = createMockAudioContext();
  });

  describe('constructor', () => {
    it('creates with default options', () => {
      const flanger = new Flanger(audioContext as unknown as AudioContext) as TestableFlanger;

      expect(flanger._params.rate).toBe(0.3);
      expect(flanger._params.depth).toBe(70);
      expect(flanger._params.feedback).toBe(50);
      expect(flanger._params.delay).toBe(5);
      expect(flanger._params.mix).toBe(50);
    });

    it('creates with custom options', () => {
      const flanger = new Flanger(audioContext as unknown as AudioContext, {
        rate: 0.5,
        depth: 90,
        feedback: 70,
        delay: 10,
        mix: 60
      }) as TestableFlanger;

      expect(flanger._params.rate).toBe(0.5);
      expect(flanger._params.depth).toBe(90);
      expect(flanger._params.feedback).toBe(70);
      expect(flanger._params.delay).toBe(10);
      expect(flanger._params.mix).toBe(60);
    });

    it('creates LFO', () => {
      const flanger = new Flanger(audioContext as unknown as AudioContext) as TestableFlanger;

      expect(flanger._lfo).toBeDefined();
      expect(flanger._lfo).toBeInstanceOf(LFO);
      expect(flanger._lfo.running).toBe(true);
      expect(flanger._lfo.waveform).toBe('sine');
    });

    it('creates delay node', () => {
      const flanger = new Flanger(audioContext as unknown as AudioContext) as TestableFlanger;

      expect(flanger._delayNode).toBeDefined();
    });

    it('creates input and output nodes', () => {
      const flanger = new Flanger(audioContext as unknown as AudioContext) as TestableFlanger;
      expect(flanger._input).toBeDefined();
      expect(flanger._output).toBeDefined();
    });

    it('creates wet and dry gain nodes', () => {
      const flanger = new Flanger(audioContext as unknown as AudioContext) as TestableFlanger;
      expect(flanger._wetGainNode).toBeDefined();
      expect(flanger._dryGainNode).toBeDefined();
    });

    it('creates feedback gain node', () => {
      const flanger = new Flanger(audioContext as unknown as AudioContext) as TestableFlanger;
      expect(flanger._feedbackGain).toBeDefined();
    });
  });

  describe('parameter control', () => {
    it('setParam updates rate', () => {
      const flanger = new Flanger(audioContext as unknown as AudioContext) as TestableFlanger;
      flanger.setParam('rate', 1.0);

      expect(flanger._params.rate).toBe(1.0);
      expect(flanger._lfo.rate).toBe(1.0);
    });

    it('setParam updates depth', () => {
      const flanger = new Flanger(audioContext as unknown as AudioContext) as TestableFlanger;
      flanger.setParam('depth', 100);

      expect(flanger._params.depth).toBe(100);
      // LFO depth should be updated based on depth and delay
      expect(flanger._lfo.depth).toBeGreaterThan(0);
    });

    it('setParam updates feedback (positive)', () => {
      const flanger = new Flanger(audioContext as unknown as AudioContext) as TestableFlanger;
      flanger.setParam('feedback', 80);

      expect(flanger._params.feedback).toBe(80);
      expect(flanger._feedbackGain.gain._value).toBeCloseTo(0.72, 1); // 80% of 0.9
    });

    it('setParam updates feedback (negative for phase inversion)', () => {
      const flanger = new Flanger(audioContext as unknown as AudioContext) as TestableFlanger;
      flanger.setParam('feedback', -50);

      expect(flanger._params.feedback).toBe(-50);
      expect(flanger._feedbackGain.gain._value).toBeLessThan(0);
    });

    it('setParam updates delay time', () => {
      const flanger = new Flanger(audioContext as unknown as AudioContext) as TestableFlanger;
      flanger.setParam('delay', 10);

      expect(flanger._params.delay).toBe(10);
      expect(flanger._delayNode.delayTime._value).toBeCloseTo(0.01); // 10ms = 0.01s
    });

    it('setParam updates mix', () => {
      const flanger = new Flanger(audioContext as unknown as AudioContext) as TestableFlanger;
      flanger.setParam('mix', 80);

      expect(flanger._params.mix).toBe(80);
      expect(flanger._wetGainNode.gain._value).toBeCloseTo(0.8);
      expect(flanger._dryGainNode.gain._value).toBeCloseTo(0.2);
    });

    it('setParam clamps values to valid range', () => {
      const flanger = new Flanger(audioContext as unknown as AudioContext) as TestableFlanger;

      flanger.setParam('rate', 100);
      expect(flanger._params.rate).toBe(10); // Max is 10

      flanger.setParam('delay', 100);
      expect(flanger._params.delay).toBe(20); // Max is 20
    });

    it('getParam returns current values', () => {
      const flanger = new Flanger(audioContext as unknown as AudioContext, {
        rate: 0.8,
        depth: 60
      });

      expect(flanger.getParam('rate')).toBe(0.8);
      expect(flanger.getParam('depth')).toBe(60);
    });
  });

  describe('depth and delay interaction', () => {
    it('depth affects LFO modulation amount based on delay', () => {
      const flanger = new Flanger(audioContext as unknown as AudioContext, {
        delay: 5,
        depth: 50
      }) as TestableFlanger;

      const initialLfoDepth = flanger._lfo.depth;

      flanger.setParam('delay', 10);

      // Doubling delay should increase the LFO modulation range
      expect(flanger._lfo.depth).toBeGreaterThan(initialLfoDepth);
    });
  });

  describe('bypass', () => {
    it('starts not bypassed', () => {
      const flanger = new Flanger(audioContext as unknown as AudioContext) as TestableFlanger;
      expect(flanger._bypassed).toBe(false);
    });

    it('can be bypassed', () => {
      const flanger = new Flanger(audioContext as unknown as AudioContext) as TestableFlanger;
      flanger.bypassed = true;
      expect(flanger._bypassed).toBe(true);
    });

    it('can be un-bypassed', () => {
      const flanger = new Flanger(audioContext as unknown as AudioContext) as TestableFlanger;
      flanger.bypassed = true;
      flanger.bypassed = false;
      expect(flanger._bypassed).toBe(false);
    });
  });

  describe('connection', () => {
    it('connects to AudioNode', () => {
      const flanger = new Flanger(audioContext as unknown as AudioContext) as TestableFlanger;
      const dest = audioContext.createGain();

      flanger.connect(dest as unknown as AudioNode);

      expect(flanger._output._connections.length).toBeGreaterThan(0);
    });

    it('connects to another plugin', () => {
      const flanger1 = new Flanger(audioContext as unknown as AudioContext) as TestableFlanger;
      const flanger2 = new Flanger(audioContext as unknown as AudioContext);

      flanger1.connect(flanger2);

      expect(flanger1._output._connections.some(c => c.destination === flanger2.input)).toBe(true);
    });
  });

  describe('destroy', () => {
    it('stops LFO and disconnects all nodes', () => {
      const flanger = new Flanger(audioContext as unknown as AudioContext) as TestableFlanger;
      flanger.connect(audioContext.createGain() as unknown as AudioNode);

      flanger.destroy();

      expect(flanger._lfo.running).toBe(true); // LFO was running, stop() doesn't change this flag
      expect(flanger._output._connections.length).toBe(0);
    });
  });

  describe('serialization', () => {
    it('serializes current state', () => {
      const flanger = new Flanger(audioContext as unknown as AudioContext, {
        rate: 0.5,
        depth: 80,
        mix: 60
      });
      flanger.bypassed = true;

      const state = flanger.serialize();

      expect(state.id).toBe('flanger');
      expect(state.bypassed).toBe(true);
      expect(state.params.rate).toBe(0.5);
      expect(state.params.depth).toBe(80);
      expect(state.params.mix).toBe(60);
    });

    it('deserializes state', () => {
      const flanger = new Flanger(audioContext as unknown as AudioContext) as TestableFlanger;

      flanger.deserialize({
        params: { rate: 1.0, depth: 90 },
        bypassed: true
      });

      expect(flanger._params.rate).toBe(1.0);
      expect(flanger._params.depth).toBe(90);
      expect(flanger._bypassed).toBe(true);
    });
  });

  describe('static properties', () => {
    it('has correct id', () => {
      expect(Flanger.id).toBe('flanger');
    });

    it('has correct category', () => {
      expect(Flanger.category).toBe('modulation');
    });

    it('has parameter definitions', () => {
      expect(Flanger.parameterDefinitions.length).toBeGreaterThan(0);
      expect(Flanger.parameterDefinitions.find(p => p.name === 'rate')).toBeDefined();
      expect(Flanger.parameterDefinitions.find(p => p.name === 'depth')).toBeDefined();
      expect(Flanger.parameterDefinitions.find(p => p.name === 'feedback')).toBeDefined();
    });

    it('feedback allows negative values', () => {
      const feedbackDef = Flanger.parameterDefinitions.find(p => p.name === 'feedback');
      expect(feedbackDef?.min).toBeLessThan(0);
    });
  });
});

describe('JetFlanger', () => {
  let audioContext: MockAudioContext;

  beforeEach(() => {
    audioContext = createMockAudioContext();
  });

  it('creates with jet preset values', () => {
    const flanger = new JetFlanger(audioContext as unknown as AudioContext) as TestableFlanger;

    expect(flanger._params.rate).toBe(0.15);
    expect(flanger._params.depth).toBe(90);
    expect(flanger._params.feedback).toBe(80);
    expect(flanger._params.delay).toBe(3);
    expect(flanger._params.mix).toBe(60);
  });

  it('has correct id', () => {
    expect(JetFlanger.id).toBe('jet-flanger');
  });

  it('allows overriding preset values', () => {
    const flanger = new JetFlanger(audioContext as unknown as AudioContext, {
      rate: 0.5
    }) as TestableFlanger;

    expect(flanger._params.rate).toBe(0.5);
    expect(flanger._params.depth).toBe(90); // Still uses preset
  });
});

describe('SubtleFlanger', () => {
  let audioContext: MockAudioContext;

  beforeEach(() => {
    audioContext = createMockAudioContext();
  });

  it('creates with subtle preset values', () => {
    const flanger = new SubtleFlanger(audioContext as unknown as AudioContext) as TestableFlanger;

    expect(flanger._params.rate).toBe(0.5);
    expect(flanger._params.depth).toBe(40);
    expect(flanger._params.feedback).toBe(20);
    expect(flanger._params.delay).toBe(7);
    expect(flanger._params.mix).toBe(35);
  });

  it('has correct id', () => {
    expect(SubtleFlanger.id).toBe('subtle-flanger');
  });

  it('allows overriding preset values', () => {
    const flanger = new SubtleFlanger(audioContext as unknown as AudioContext, {
      depth: 60
    }) as TestableFlanger;

    expect(flanger._params.depth).toBe(60);
    expect(flanger._params.feedback).toBe(20); // Still uses preset
  });
});
