/**
 * Tests for neon-fx Distortion
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Distortion, Overdrive, Fuzz } from '../src/distortion';
import { MockAudioContext, createMockAudioContext, MockGainNode, MockBiquadFilterNode, MockWaveShaperNode } from '../__mocks__/web-audio';

type TestableDistortion = Distortion & {
  ctx: MockAudioContext;
  _input: MockGainNode;
  _output: MockGainNode;
  _waveshaper: MockWaveShaperNode;
  _preGain: MockGainNode;
  _toneFilter: MockBiquadFilterNode;
  _postGain: MockGainNode;
  _wetGainNode: MockGainNode;
  _dryGainNode: MockGainNode;
  _params: Record<string, number>;
  _bypassed: boolean;
  _distortionType: string;
};

describe('Distortion', () => {
  let audioContext: MockAudioContext;

  beforeEach(() => {
    audioContext = createMockAudioContext();
  });

  describe('constructor', () => {
    it('creates with default options', () => {
      const distortion = new Distortion(audioContext as unknown as AudioContext) as TestableDistortion;

      expect(distortion._params.drive).toBe(50);
      expect(distortion._params.tone).toBe(50);
      expect(distortion._params.level).toBe(50);
      expect(distortion._params.mix).toBe(100);
    });

    it('creates with custom options', () => {
      const distortion = new Distortion(audioContext as unknown as AudioContext, {
        drive: 70,
        tone: 60,
        level: 80,
        mix: 90
      }) as TestableDistortion;

      expect(distortion._params.drive).toBe(70);
      expect(distortion._params.tone).toBe(60);
      expect(distortion._params.level).toBe(80);
      expect(distortion._params.mix).toBe(90);
    });

    it('creates with specified distortion type', () => {
      const distortion = new Distortion(audioContext as unknown as AudioContext, {
        type: 'fuzz'
      }) as TestableDistortion;

      expect(distortion._distortionType).toBe('fuzz');
    });

    it('defaults to overdrive type', () => {
      const distortion = new Distortion(audioContext as unknown as AudioContext) as TestableDistortion;

      expect(distortion._distortionType).toBe('overdrive');
    });

    it('creates waveshaper with 2x oversampling', () => {
      const distortion = new Distortion(audioContext as unknown as AudioContext) as TestableDistortion;

      expect(distortion._waveshaper).toBeDefined();
      expect(distortion._waveshaper.oversample).toBe('2x');
    });

    it('creates tone filter as lowpass', () => {
      const distortion = new Distortion(audioContext as unknown as AudioContext) as TestableDistortion;

      expect(distortion._toneFilter).toBeDefined();
      expect(distortion._toneFilter.type).toBe('lowpass');
    });

    it('creates input and output nodes', () => {
      const distortion = new Distortion(audioContext as unknown as AudioContext) as TestableDistortion;
      expect(distortion._input).toBeDefined();
      expect(distortion._output).toBeDefined();
    });

    it('creates wet and dry gain nodes', () => {
      const distortion = new Distortion(audioContext as unknown as AudioContext) as TestableDistortion;
      expect(distortion._wetGainNode).toBeDefined();
      expect(distortion._dryGainNode).toBeDefined();
    });
  });

  describe('distortion types', () => {
    it('supports soft clip type', () => {
      const distortion = new Distortion(audioContext as unknown as AudioContext, {
        type: 'soft'
      }) as TestableDistortion;

      expect(distortion._distortionType).toBe('soft');
      expect(distortion._waveshaper.curve).toBeDefined();
    });

    it('supports hard clip type', () => {
      const distortion = new Distortion(audioContext as unknown as AudioContext, {
        type: 'hard'
      }) as TestableDistortion;

      expect(distortion._distortionType).toBe('hard');
      expect(distortion._waveshaper.curve).toBeDefined();
    });

    it('supports fuzz type', () => {
      const distortion = new Distortion(audioContext as unknown as AudioContext, {
        type: 'fuzz'
      }) as TestableDistortion;

      expect(distortion._distortionType).toBe('fuzz');
      expect(distortion._waveshaper.curve).toBeDefined();
    });

    it('supports overdrive type', () => {
      const distortion = new Distortion(audioContext as unknown as AudioContext, {
        type: 'overdrive'
      }) as TestableDistortion;

      expect(distortion._distortionType).toBe('overdrive');
      expect(distortion._waveshaper.curve).toBeDefined();
    });

    it('can change type after creation', () => {
      const distortion = new Distortion(audioContext as unknown as AudioContext, {
        type: 'soft'
      }) as TestableDistortion;

      expect(distortion.type).toBe('soft');

      distortion.type = 'fuzz';
      expect(distortion.type).toBe('fuzz');
    });
  });

  describe('parameter control', () => {
    it('setParam updates drive', () => {
      const distortion = new Distortion(audioContext as unknown as AudioContext) as TestableDistortion;
      distortion.setParam('drive', 80);

      expect(distortion._params.drive).toBe(80);
      // Drive affects pre-gain and waveshaper curve
      expect(distortion._preGain.gain._value).toBeGreaterThan(1);
    });

    it('setParam updates tone', () => {
      const distortion = new Distortion(audioContext as unknown as AudioContext) as TestableDistortion;
      distortion.setParam('tone', 80);

      expect(distortion._params.tone).toBe(80);
      // Tone 80 should map to higher frequency
      expect(distortion._toneFilter.frequency._value).toBeGreaterThan(6000);
    });

    it('setParam updates level', () => {
      const distortion = new Distortion(audioContext as unknown as AudioContext) as TestableDistortion;
      distortion.setParam('level', 80);

      expect(distortion._params.level).toBe(80);
      expect(distortion._postGain.gain._value).toBeCloseTo(0.8);
    });

    it('setParam updates mix', () => {
      const distortion = new Distortion(audioContext as unknown as AudioContext) as TestableDistortion;
      distortion.setParam('mix', 80);

      expect(distortion._params.mix).toBe(80);
      expect(distortion._wetGainNode.gain._value).toBeCloseTo(0.8);
      expect(distortion._dryGainNode.gain._value).toBeCloseTo(0.2);
    });

    it('setParam clamps values to valid range', () => {
      const distortion = new Distortion(audioContext as unknown as AudioContext) as TestableDistortion;

      distortion.setParam('drive', 150);
      expect(distortion._params.drive).toBe(100); // Max is 100

      distortion.setParam('tone', -50);
      expect(distortion._params.tone).toBe(0); // Min is 0
    });

    it('getParam returns current values', () => {
      const distortion = new Distortion(audioContext as unknown as AudioContext, {
        drive: 60,
        tone: 40
      });

      expect(distortion.getParam('drive')).toBe(60);
      expect(distortion.getParam('tone')).toBe(40);
    });
  });

  describe('bypass', () => {
    it('starts not bypassed', () => {
      const distortion = new Distortion(audioContext as unknown as AudioContext) as TestableDistortion;
      expect(distortion._bypassed).toBe(false);
    });

    it('can be bypassed', () => {
      const distortion = new Distortion(audioContext as unknown as AudioContext) as TestableDistortion;
      distortion.bypassed = true;
      expect(distortion._bypassed).toBe(true);
    });

    it('can be un-bypassed', () => {
      const distortion = new Distortion(audioContext as unknown as AudioContext) as TestableDistortion;
      distortion.bypassed = true;
      distortion.bypassed = false;
      expect(distortion._bypassed).toBe(false);
    });
  });

  describe('connection', () => {
    it('connects to AudioNode', () => {
      const distortion = new Distortion(audioContext as unknown as AudioContext) as TestableDistortion;
      const dest = audioContext.createGain();

      distortion.connect(dest as unknown as AudioNode);

      expect(distortion._output._connections.length).toBeGreaterThan(0);
    });

    it('connects to another plugin', () => {
      const distortion1 = new Distortion(audioContext as unknown as AudioContext) as TestableDistortion;
      const distortion2 = new Distortion(audioContext as unknown as AudioContext);

      distortion1.connect(distortion2);

      expect(distortion1._output._connections.some(c => c.destination === distortion2.input)).toBe(true);
    });
  });

  describe('destroy', () => {
    it('disconnects all nodes', () => {
      const distortion = new Distortion(audioContext as unknown as AudioContext) as TestableDistortion;
      distortion.connect(audioContext.createGain() as unknown as AudioNode);

      distortion.destroy();

      expect(distortion._output._connections.length).toBe(0);
    });
  });

  describe('serialization', () => {
    it('serializes current state', () => {
      const distortion = new Distortion(audioContext as unknown as AudioContext, {
        drive: 70,
        tone: 60,
        mix: 80
      });
      distortion.bypassed = true;

      const state = distortion.serialize();

      expect(state.id).toBe('distortion');
      expect(state.bypassed).toBe(true);
      expect(state.params.drive).toBe(70);
      expect(state.params.tone).toBe(60);
      expect(state.params.mix).toBe(80);
    });

    it('deserializes state', () => {
      const distortion = new Distortion(audioContext as unknown as AudioContext) as TestableDistortion;

      distortion.deserialize({
        params: { drive: 80, tone: 70 },
        bypassed: true
      });

      expect(distortion._params.drive).toBe(80);
      expect(distortion._params.tone).toBe(70);
      expect(distortion._bypassed).toBe(true);
    });
  });

  describe('static properties', () => {
    it('has correct id', () => {
      expect(Distortion.id).toBe('distortion');
    });

    it('has correct category', () => {
      expect(Distortion.category).toBe('distortion');
    });

    it('has parameter definitions', () => {
      expect(Distortion.parameterDefinitions.length).toBeGreaterThan(0);
      expect(Distortion.parameterDefinitions.find(p => p.name === 'drive')).toBeDefined();
      expect(Distortion.parameterDefinitions.find(p => p.name === 'tone')).toBeDefined();
      expect(Distortion.parameterDefinitions.find(p => p.name === 'level')).toBeDefined();
      expect(Distortion.parameterDefinitions.find(p => p.name === 'mix')).toBeDefined();
    });
  });
});

describe('Overdrive', () => {
  let audioContext: MockAudioContext;

  beforeEach(() => {
    audioContext = createMockAudioContext();
  });

  it('creates with overdrive preset values', () => {
    const overdrive = new Overdrive(audioContext as unknown as AudioContext) as TestableDistortion;

    expect(overdrive._params.drive).toBe(40);
    expect(overdrive._params.tone).toBe(60);
    expect(overdrive._params.level).toBe(60);
    expect(overdrive._params.mix).toBe(100);
    expect(overdrive._distortionType).toBe('overdrive');
  });

  it('has correct id', () => {
    expect(Overdrive.id).toBe('overdrive');
  });

  it('has correct description', () => {
    expect(Overdrive.description).toBe('Warm tube-style overdrive');
  });

  it('allows overriding preset values', () => {
    const overdrive = new Overdrive(audioContext as unknown as AudioContext, {
      drive: 80
    }) as TestableDistortion;

    expect(overdrive._params.drive).toBe(80);
    expect(overdrive._params.tone).toBe(60); // Still uses preset
  });
});

describe('Fuzz', () => {
  let audioContext: MockAudioContext;

  beforeEach(() => {
    audioContext = createMockAudioContext();
  });

  it('creates with fuzz preset values', () => {
    const fuzz = new Fuzz(audioContext as unknown as AudioContext) as TestableDistortion;

    expect(fuzz._params.drive).toBe(70);
    expect(fuzz._params.tone).toBe(40);
    expect(fuzz._params.level).toBe(50);
    expect(fuzz._params.mix).toBe(100);
    expect(fuzz._distortionType).toBe('fuzz');
  });

  it('has correct id', () => {
    expect(Fuzz.id).toBe('fuzz');
  });

  it('has correct description', () => {
    expect(Fuzz.description).toBe('Aggressive vintage fuzz');
  });

  it('allows overriding preset values', () => {
    const fuzz = new Fuzz(audioContext as unknown as AudioContext, {
      drive: 100
    }) as TestableDistortion;

    expect(fuzz._params.drive).toBe(100);
    expect(fuzz._params.tone).toBe(40); // Still uses preset
  });
});
