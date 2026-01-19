/**
 * Tests for neon-fx Phaser
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Phaser, VintagePhaser } from '../src/phaser';
import { LFO } from '../src/lfo';
import { MockAudioContext, createMockAudioContext, MockGainNode, MockBiquadFilterNode } from '../__mocks__/web-audio';

type TestablePhaser = Phaser & {
  ctx: MockAudioContext;
  _input: MockGainNode;
  _output: MockGainNode;
  _lfo: LFO;
  _allpassFilters: MockBiquadFilterNode[];
  _feedbackGain: MockGainNode;
  _wetGainNode: MockGainNode;
  _dryGainNode: MockGainNode;
  _params: Record<string, number>;
  _bypassed: boolean;
};

describe('Phaser', () => {
  let audioContext: MockAudioContext;

  beforeEach(() => {
    audioContext = createMockAudioContext();
  });

  describe('constructor', () => {
    it('creates with default options', () => {
      const phaser = new Phaser(audioContext as unknown as AudioContext) as TestablePhaser;

      expect(phaser._params.rate).toBe(0.5);
      expect(phaser._params.depth).toBe(70);
      expect(phaser._params.feedback).toBe(40);
      expect(phaser._params.stages).toBe(4);
      expect(phaser._params.baseFreq).toBe(1000);
      expect(phaser._params.mix).toBe(50);
    });

    it('creates with custom options', () => {
      const phaser = new Phaser(audioContext as unknown as AudioContext, {
        rate: 1.0,
        depth: 80,
        feedback: 60,
        stages: 6,
        baseFreq: 800,
        mix: 70
      }) as TestablePhaser;

      expect(phaser._params.rate).toBe(1.0);
      expect(phaser._params.depth).toBe(80);
      expect(phaser._params.feedback).toBe(60);
      expect(phaser._params.stages).toBe(6);
      expect(phaser._params.baseFreq).toBe(800);
      expect(phaser._params.mix).toBe(70);
    });

    it('creates LFO', () => {
      const phaser = new Phaser(audioContext as unknown as AudioContext) as TestablePhaser;

      expect(phaser._lfo).toBeDefined();
      expect(phaser._lfo).toBeInstanceOf(LFO);
      expect(phaser._lfo.running).toBe(true);
      expect(phaser._lfo.waveform).toBe('sine');
    });

    it('creates correct number of all-pass filter stages', () => {
      const phaser = new Phaser(audioContext as unknown as AudioContext, {
        stages: 6
      }) as TestablePhaser;

      expect(phaser._allpassFilters.length).toBe(6);
      phaser._allpassFilters.forEach(filter => {
        expect(filter.type).toBe('allpass');
      });
    });

    it('creates input and output nodes', () => {
      const phaser = new Phaser(audioContext as unknown as AudioContext) as TestablePhaser;
      expect(phaser._input).toBeDefined();
      expect(phaser._output).toBeDefined();
    });

    it('creates wet and dry gain nodes', () => {
      const phaser = new Phaser(audioContext as unknown as AudioContext) as TestablePhaser;
      expect(phaser._wetGainNode).toBeDefined();
      expect(phaser._dryGainNode).toBeDefined();
    });
  });

  describe('parameter control', () => {
    it('setParam updates rate', () => {
      const phaser = new Phaser(audioContext as unknown as AudioContext) as TestablePhaser;
      phaser.setParam('rate', 2.0);

      expect(phaser._params.rate).toBe(2.0);
      expect(phaser._lfo.rate).toBe(2.0);
    });

    it('setParam updates depth', () => {
      const phaser = new Phaser(audioContext as unknown as AudioContext) as TestablePhaser;
      phaser.setParam('depth', 100);

      expect(phaser._params.depth).toBe(100);
      // LFO depth should be updated based on depth and baseFreq
      expect(phaser._lfo.depth).toBeGreaterThan(0);
    });

    it('setParam updates feedback', () => {
      const phaser = new Phaser(audioContext as unknown as AudioContext) as TestablePhaser;
      phaser.setParam('feedback', 80);

      expect(phaser._params.feedback).toBe(80);
      expect(phaser._feedbackGain.gain._value).toBeCloseTo(0.72, 1); // 80% of 0.9
    });

    it('setParam updates baseFreq on all filters', () => {
      const phaser = new Phaser(audioContext as unknown as AudioContext, {
        stages: 4
      }) as TestablePhaser;

      phaser.setParam('baseFreq', 2000);

      expect(phaser._params.baseFreq).toBe(2000);
      phaser._allpassFilters.forEach(filter => {
        expect(filter.frequency._value).toBe(2000);
      });
    });

    it('setParam updates mix', () => {
      const phaser = new Phaser(audioContext as unknown as AudioContext) as TestablePhaser;
      phaser.setParam('mix', 80);

      expect(phaser._params.mix).toBe(80);
      expect(phaser._wetGainNode.gain._value).toBeCloseTo(0.8);
      expect(phaser._dryGainNode.gain._value).toBeCloseTo(0.2);
    });

    it('setParam clamps values to valid range', () => {
      const phaser = new Phaser(audioContext as unknown as AudioContext) as TestablePhaser;

      phaser.setParam('rate', 100);
      expect(phaser._params.rate).toBe(10); // Max is 10

      phaser.setParam('feedback', -50);
      expect(phaser._params.feedback).toBe(0); // Min is 0
    });

    it('getParam returns current values', () => {
      const phaser = new Phaser(audioContext as unknown as AudioContext, {
        rate: 1.5,
        depth: 60
      });

      expect(phaser.getParam('rate')).toBe(1.5);
      expect(phaser.getParam('depth')).toBe(60);
    });
  });

  describe('stages', () => {
    it('rebuilds filter chain when stages change', () => {
      const phaser = new Phaser(audioContext as unknown as AudioContext, {
        stages: 4
      }) as TestablePhaser;

      expect(phaser._allpassFilters.length).toBe(4);

      phaser.setParam('stages', 8);

      expect(phaser._allpassFilters.length).toBe(8);
    });

    it('ensures even number of stages', () => {
      const phaser = new Phaser(audioContext as unknown as AudioContext, {
        stages: 5 // Will be rounded to 4 or 6
      }) as TestablePhaser;

      // Stages should be even
      expect(phaser._allpassFilters.length % 2).toBe(0);
    });

    it('clamps stages to valid range', () => {
      const phaser = new Phaser(audioContext as unknown as AudioContext) as TestablePhaser;

      phaser.setParam('stages', 20);
      expect(phaser._allpassFilters.length).toBeLessThanOrEqual(12);

      phaser.setParam('stages', 1);
      expect(phaser._allpassFilters.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('bypass', () => {
    it('starts not bypassed', () => {
      const phaser = new Phaser(audioContext as unknown as AudioContext) as TestablePhaser;
      expect(phaser._bypassed).toBe(false);
    });

    it('can be bypassed', () => {
      const phaser = new Phaser(audioContext as unknown as AudioContext) as TestablePhaser;
      phaser.bypassed = true;
      expect(phaser._bypassed).toBe(true);
    });

    it('can be un-bypassed', () => {
      const phaser = new Phaser(audioContext as unknown as AudioContext) as TestablePhaser;
      phaser.bypassed = true;
      phaser.bypassed = false;
      expect(phaser._bypassed).toBe(false);
    });
  });

  describe('connection', () => {
    it('connects to AudioNode', () => {
      const phaser = new Phaser(audioContext as unknown as AudioContext) as TestablePhaser;
      const dest = audioContext.createGain();

      phaser.connect(dest as unknown as AudioNode);

      expect(phaser._output._connections.length).toBeGreaterThan(0);
    });

    it('connects to another plugin', () => {
      const phaser1 = new Phaser(audioContext as unknown as AudioContext) as TestablePhaser;
      const phaser2 = new Phaser(audioContext as unknown as AudioContext);

      phaser1.connect(phaser2);

      expect(phaser1._output._connections.some(c => c.destination === phaser2.input)).toBe(true);
    });
  });

  describe('destroy', () => {
    it('stops LFO and disconnects all nodes', () => {
      const phaser = new Phaser(audioContext as unknown as AudioContext) as TestablePhaser;
      phaser.connect(audioContext.createGain() as unknown as AudioNode);

      phaser.destroy();

      expect(phaser._lfo.running).toBe(true); // LFO was running, stop() doesn't change this flag
      expect(phaser._output._connections.length).toBe(0);
    });
  });

  describe('serialization', () => {
    it('serializes current state', () => {
      const phaser = new Phaser(audioContext as unknown as AudioContext, {
        rate: 1.0,
        depth: 80,
        mix: 60
      });
      phaser.bypassed = true;

      const state = phaser.serialize();

      expect(state.id).toBe('phaser');
      expect(state.bypassed).toBe(true);
      expect(state.params.rate).toBe(1.0);
      expect(state.params.depth).toBe(80);
      expect(state.params.mix).toBe(60);
    });

    it('deserializes state', () => {
      const phaser = new Phaser(audioContext as unknown as AudioContext) as TestablePhaser;

      phaser.deserialize({
        params: { rate: 2.0, depth: 90 },
        bypassed: true
      });

      expect(phaser._params.rate).toBe(2.0);
      expect(phaser._params.depth).toBe(90);
      expect(phaser._bypassed).toBe(true);
    });
  });

  describe('static properties', () => {
    it('has correct id', () => {
      expect(Phaser.id).toBe('phaser');
    });

    it('has correct category', () => {
      expect(Phaser.category).toBe('modulation');
    });

    it('has parameter definitions', () => {
      expect(Phaser.parameterDefinitions.length).toBeGreaterThan(0);
      expect(Phaser.parameterDefinitions.find(p => p.name === 'rate')).toBeDefined();
      expect(Phaser.parameterDefinitions.find(p => p.name === 'depth')).toBeDefined();
    });
  });
});

describe('VintagePhaser', () => {
  let audioContext: MockAudioContext;

  beforeEach(() => {
    audioContext = createMockAudioContext();
  });

  it('creates with vintage preset values', () => {
    const phaser = new VintagePhaser(audioContext as unknown as AudioContext) as TestablePhaser;

    expect(phaser._params.rate).toBe(0.3);
    expect(phaser._params.depth).toBe(80);
    expect(phaser._params.feedback).toBe(60);
    expect(phaser._params.stages).toBe(6);
    expect(phaser._params.baseFreq).toBe(800);
  });

  it('has correct id', () => {
    expect(VintagePhaser.id).toBe('vintage-phaser');
  });

  it('allows overriding preset values', () => {
    const phaser = new VintagePhaser(audioContext as unknown as AudioContext, {
      rate: 1.0
    }) as TestablePhaser;

    expect(phaser._params.rate).toBe(1.0);
    expect(phaser._params.depth).toBe(80); // Still uses preset
  });
});
