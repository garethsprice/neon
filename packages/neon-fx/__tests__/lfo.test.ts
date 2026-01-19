/**
 * Tests for neon-fx LFO
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { LFO, LFO_PRESETS } from '../src/lfo';
import { MockAudioContext, createMockAudioContext, MockGainNode, MockOscillatorNode } from '../__mocks__/web-audio';

type TestableLFO = LFO & {
  ctx: MockAudioContext;
  _oscillator: MockOscillatorNode;
  _gainNode: MockGainNode;
  _rate: number;
  _depth: number;
  _waveform: string;
  _started: boolean;
};

describe('LFO', () => {
  let audioContext: MockAudioContext;

  beforeEach(() => {
    audioContext = createMockAudioContext();
  });

  describe('constructor', () => {
    it('creates with default options', () => {
      const lfo = new LFO(audioContext as unknown as AudioContext) as TestableLFO;

      expect(lfo._rate).toBe(1);
      expect(lfo._depth).toBe(1);
      expect(lfo._waveform).toBe('sine');
    });

    it('creates with custom options', () => {
      const lfo = new LFO(audioContext as unknown as AudioContext, {
        rate: 0.5,
        depth: 100,
        waveform: 'triangle'
      }) as TestableLFO;

      expect(lfo._rate).toBe(0.5);
      expect(lfo._depth).toBe(100);
      expect(lfo._waveform).toBe('triangle');
    });

    it('auto-starts by default', () => {
      const lfo = new LFO(audioContext as unknown as AudioContext) as TestableLFO;

      expect(lfo._oscillator._started).toBe(true);
      expect(lfo.running).toBe(true);
    });

    it('can disable auto-start', () => {
      const lfo = new LFO(audioContext as unknown as AudioContext, {
        autoStart: false
      }) as TestableLFO;

      expect(lfo._oscillator._started).toBe(false);
      expect(lfo.running).toBe(false);
    });

    it('creates oscillator with correct waveform', () => {
      const lfo = new LFO(audioContext as unknown as AudioContext, {
        waveform: 'square'
      }) as TestableLFO;

      expect(lfo._oscillator.type).toBe('square');
    });

    it('sets oscillator frequency from rate', () => {
      const lfo = new LFO(audioContext as unknown as AudioContext, {
        rate: 2.5
      }) as TestableLFO;

      expect(lfo._oscillator.frequency._value).toBe(2.5);
    });

    it('sets gain from depth', () => {
      const lfo = new LFO(audioContext as unknown as AudioContext, {
        depth: 50
      }) as TestableLFO;

      expect(lfo._gainNode.gain._value).toBe(50);
    });
  });

  describe('rate property', () => {
    it('gets current rate', () => {
      const lfo = new LFO(audioContext as unknown as AudioContext, {
        rate: 3
      });

      expect(lfo.rate).toBe(3);
    });

    it('sets rate and updates oscillator', () => {
      const lfo = new LFO(audioContext as unknown as AudioContext) as TestableLFO;
      lfo.rate = 5;

      expect(lfo.rate).toBe(5);
      expect(lfo._oscillator.frequency._value).toBe(5);
    });

    it('clamps rate to minimum 0.001', () => {
      const lfo = new LFO(audioContext as unknown as AudioContext) as TestableLFO;
      lfo.rate = 0;

      expect(lfo.rate).toBe(0.001);
    });
  });

  describe('depth property', () => {
    it('gets current depth', () => {
      const lfo = new LFO(audioContext as unknown as AudioContext, {
        depth: 75
      });

      expect(lfo.depth).toBe(75);
    });

    it('sets depth and updates gain', () => {
      const lfo = new LFO(audioContext as unknown as AudioContext) as TestableLFO;
      lfo.depth = 200;

      expect(lfo.depth).toBe(200);
      expect(lfo._gainNode.gain._value).toBe(200);
    });

    it('allows negative depth values', () => {
      const lfo = new LFO(audioContext as unknown as AudioContext) as TestableLFO;
      lfo.depth = -50;

      expect(lfo.depth).toBe(-50);
      expect(lfo._gainNode.gain._value).toBe(-50);
    });
  });

  describe('waveform property', () => {
    it('gets current waveform', () => {
      const lfo = new LFO(audioContext as unknown as AudioContext, {
        waveform: 'sawtooth'
      });

      expect(lfo.waveform).toBe('sawtooth');
    });

    it('sets waveform', () => {
      const lfo = new LFO(audioContext as unknown as AudioContext) as TestableLFO;
      lfo.waveform = 'triangle';

      expect(lfo.waveform).toBe('triangle');
      expect(lfo._oscillator.type).toBe('triangle');
    });
  });

  describe('setRate method', () => {
    it('sets rate without ramp', () => {
      const lfo = new LFO(audioContext as unknown as AudioContext) as TestableLFO;
      lfo.setRate(4, 0);

      expect(lfo._rate).toBe(4);
      expect(lfo._oscillator.frequency._value).toBe(4);
    });

    it('sets rate with ramp time', () => {
      const lfo = new LFO(audioContext as unknown as AudioContext) as TestableLFO;
      lfo.setRate(4, 0.5);

      expect(lfo._rate).toBe(4);
      // Should have scheduled a setTargetAtTime
      const scheduled = lfo._oscillator.frequency._scheduledValues;
      expect(scheduled.length).toBeGreaterThan(0);
      expect(scheduled[scheduled.length - 1].type).toBe('setTargetAtTime');
    });
  });

  describe('setDepth method', () => {
    it('sets depth without ramp', () => {
      const lfo = new LFO(audioContext as unknown as AudioContext) as TestableLFO;
      lfo.setDepth(150, 0);

      expect(lfo._depth).toBe(150);
      expect(lfo._gainNode.gain._value).toBe(150);
    });

    it('sets depth with ramp time', () => {
      const lfo = new LFO(audioContext as unknown as AudioContext) as TestableLFO;
      lfo.setDepth(150, 0.5);

      expect(lfo._depth).toBe(150);
      // Should have scheduled a setTargetAtTime
      const scheduled = lfo._gainNode.gain._scheduledValues;
      expect(scheduled.length).toBeGreaterThan(0);
      expect(scheduled[scheduled.length - 1].type).toBe('setTargetAtTime');
    });
  });

  describe('connect method', () => {
    it('connects to AudioParam', () => {
      const lfo = new LFO(audioContext as unknown as AudioContext) as TestableLFO;
      const targetGain = audioContext.createGain();

      lfo.connect(targetGain.gain as unknown as AudioParam);

      expect(lfo._gainNode._connections.length).toBeGreaterThan(0);
    });

    it('connects to AudioNode', () => {
      const lfo = new LFO(audioContext as unknown as AudioContext) as TestableLFO;
      const targetNode = audioContext.createGain();

      lfo.connect(targetNode as unknown as AudioNode);

      expect(lfo._gainNode._connections.some(c => c.destination === targetNode)).toBe(true);
    });
  });

  describe('disconnect method', () => {
    it('disconnects all', () => {
      const lfo = new LFO(audioContext as unknown as AudioContext) as TestableLFO;
      const targetNode = audioContext.createGain();
      lfo.connect(targetNode as unknown as AudioNode);

      lfo.disconnect();

      expect(lfo._gainNode._connections.length).toBe(0);
    });

    it('disconnects specific destination', () => {
      const lfo = new LFO(audioContext as unknown as AudioContext) as TestableLFO;
      const targetNode1 = audioContext.createGain();
      const targetNode2 = audioContext.createGain();
      lfo.connect(targetNode1 as unknown as AudioNode);
      lfo.connect(targetNode2 as unknown as AudioNode);

      lfo.disconnect(targetNode1 as unknown as AudioNode);

      expect(lfo._gainNode._connections.some(c => c.destination === targetNode1)).toBe(false);
      expect(lfo._gainNode._connections.some(c => c.destination === targetNode2)).toBe(true);
    });
  });

  describe('start method', () => {
    it('starts the oscillator', () => {
      const lfo = new LFO(audioContext as unknown as AudioContext, {
        autoStart: false
      }) as TestableLFO;

      expect(lfo.running).toBe(false);
      lfo.start();
      expect(lfo.running).toBe(true);
      expect(lfo._oscillator._started).toBe(true);
    });

    it('does not restart if already started', () => {
      const lfo = new LFO(audioContext as unknown as AudioContext) as TestableLFO;

      // Already started by default
      expect(lfo.running).toBe(true);
      lfo.start(); // Should not throw
      expect(lfo.running).toBe(true);
    });
  });

  describe('stop method', () => {
    it('stops the oscillator', () => {
      const lfo = new LFO(audioContext as unknown as AudioContext) as TestableLFO;

      lfo.stop();

      expect(lfo._oscillator._stopped).toBe(true);
    });

    it('disconnects all nodes', () => {
      const lfo = new LFO(audioContext as unknown as AudioContext) as TestableLFO;
      const targetNode = audioContext.createGain();
      lfo.connect(targetNode as unknown as AudioNode);

      lfo.stop();

      expect(lfo._gainNode._connections.length).toBe(0);
    });
  });

  describe('reset method', () => {
    it('returns a new LFO instance', () => {
      const lfo = new LFO(audioContext as unknown as AudioContext, {
        rate: 2,
        depth: 50
      });

      const newLfo = lfo.reset();

      expect(newLfo).not.toBe(lfo);
      expect(newLfo).toBeInstanceOf(LFO);
    });

    it('preserves settings by default', () => {
      const lfo = new LFO(audioContext as unknown as AudioContext, {
        rate: 2,
        depth: 50,
        waveform: 'triangle'
      });

      const newLfo = lfo.reset() as TestableLFO;

      expect(newLfo._rate).toBe(2);
      expect(newLfo._depth).toBe(50);
      expect(newLfo._waveform).toBe('triangle');
    });

    it('allows overriding settings', () => {
      const lfo = new LFO(audioContext as unknown as AudioContext, {
        rate: 2,
        depth: 50
      });

      const newLfo = lfo.reset({ rate: 5 }) as TestableLFO;

      expect(newLfo._rate).toBe(5);
      expect(newLfo._depth).toBe(50);
    });
  });

  describe('output property', () => {
    it('returns the gain node', () => {
      const lfo = new LFO(audioContext as unknown as AudioContext) as TestableLFO;

      expect(lfo.output).toBe(lfo._gainNode);
    });
  });

  describe('running property', () => {
    it('returns true when started', () => {
      const lfo = new LFO(audioContext as unknown as AudioContext);

      expect(lfo.running).toBe(true);
    });

    it('returns false when not started', () => {
      const lfo = new LFO(audioContext as unknown as AudioContext, {
        autoStart: false
      });

      expect(lfo.running).toBe(false);
    });
  });
});

describe('LFO_PRESETS', () => {
  it('has slow preset', () => {
    expect(LFO_PRESETS.slow.rate).toBe(0.2);
    expect(LFO_PRESETS.slow.waveform).toBe('sine');
  });

  it('has medium preset', () => {
    expect(LFO_PRESETS.medium.rate).toBe(1);
    expect(LFO_PRESETS.medium.waveform).toBe('sine');
  });

  it('has fast preset', () => {
    expect(LFO_PRESETS.fast.rate).toBe(5);
    expect(LFO_PRESETS.fast.waveform).toBe('sine');
  });

  it('has tremolo preset', () => {
    expect(LFO_PRESETS.tremolo.rate).toBe(6);
    expect(LFO_PRESETS.tremolo.waveform).toBe('sine');
  });

  it('has vibrato preset', () => {
    expect(LFO_PRESETS.vibrato.rate).toBe(5);
    expect(LFO_PRESETS.vibrato.waveform).toBe('sine');
  });

  it('has choppy preset with square wave', () => {
    expect(LFO_PRESETS.choppy.rate).toBe(4);
    expect(LFO_PRESETS.choppy.waveform).toBe('square');
  });

  it('has sampleHold preset', () => {
    expect(LFO_PRESETS.sampleHold.rate).toBe(8);
    expect(LFO_PRESETS.sampleHold.waveform).toBe('square');
  });

  it('can be used to create LFO', () => {
    const audioContext = createMockAudioContext();
    const lfo = new LFO(audioContext as unknown as AudioContext, {
      ...LFO_PRESETS.tremolo,
      depth: 100
    }) as TestableLFO;

    expect(lfo._rate).toBe(6);
    expect(lfo._waveform).toBe('sine');
    expect(lfo._depth).toBe(100);
  });
});
