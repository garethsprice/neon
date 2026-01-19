/**
 * Tests for neon-fx Oscillator
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Oscillator, OSCILLATOR_PRESETS } from '../src/oscillator';
import { MockAudioContext, createMockAudioContext, MockGainNode, MockOscillatorNode } from '../__mocks__/web-audio';

type TestableOscillator = Oscillator & {
  ctx: MockAudioContext;
  output: MockGainNode;
  _waveform: string;
  _detune: number;
  _gain: number;
  _voices: Map<number, { oscillator: MockOscillatorNode; noteId: number }>;
};

describe('Oscillator', () => {
  let audioContext: MockAudioContext;

  beforeEach(() => {
    audioContext = createMockAudioContext();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('constructor', () => {
    it('creates with default options', () => {
      const osc = new Oscillator(audioContext as unknown as AudioContext) as TestableOscillator;

      expect(osc._waveform).toBe('sawtooth');
      expect(osc._detune).toBe(0);
      expect(osc._gain).toBe(1);
      expect(osc.output.gain.value).toBe(1);
    });

    it('creates with custom waveform', () => {
      const osc = new Oscillator(audioContext as unknown as AudioContext, {
        waveform: 'square'
      }) as TestableOscillator;

      expect(osc._waveform).toBe('square');
    });

    it('creates with custom detune', () => {
      const osc = new Oscillator(audioContext as unknown as AudioContext, {
        detune: 25
      }) as TestableOscillator;

      expect(osc._detune).toBe(25);
    });

    it('creates with custom gain', () => {
      const osc = new Oscillator(audioContext as unknown as AudioContext, {
        gain: 0.5
      }) as TestableOscillator;

      expect(osc._gain).toBe(0.5);
      expect(osc.output.gain.value).toBe(0.5);
    });

    it('creates output gain node', () => {
      const osc = new Oscillator(audioContext as unknown as AudioContext) as TestableOscillator;
      expect(osc.output).toBeDefined();
      expect(osc.output).toBeInstanceOf(MockGainNode);
    });
  });

  describe('property accessors', () => {
    it('waveform getter returns current waveform', () => {
      const osc = new Oscillator(audioContext as unknown as AudioContext, { waveform: 'triangle' });
      expect(osc.waveform).toBe('triangle');
    });

    it('waveform setter updates waveform', () => {
      const osc = new Oscillator(audioContext as unknown as AudioContext) as TestableOscillator;
      osc.waveform = 'sine';
      expect(osc._waveform).toBe('sine');
    });

    it('waveform setter updates active voices', () => {
      const osc = new Oscillator(audioContext as unknown as AudioContext) as TestableOscillator;
      osc.start(60, 440);
      osc.waveform = 'square';

      const voice = osc._voices.get(60);
      expect(voice?.oscillator.type).toBe('square');
    });

    it('detune getter returns current detune', () => {
      const osc = new Oscillator(audioContext as unknown as AudioContext, { detune: 15 });
      expect(osc.detune).toBe(15);
    });

    it('detune setter updates active voices', () => {
      const osc = new Oscillator(audioContext as unknown as AudioContext) as TestableOscillator;
      osc.start(60, 440);
      osc.detune = 50;

      const voice = osc._voices.get(60);
      expect(voice?.oscillator.detune._value).toBe(50);
    });

    it('gain setter updates output gain with ramp', () => {
      const osc = new Oscillator(audioContext as unknown as AudioContext) as TestableOscillator;
      osc.gain = 0.7;

      expect(osc._gain).toBe(0.7);
      // Should use setTargetAtTime for smooth transition
      const scheduled = osc.output.gain._scheduledValues;
      expect(scheduled.length).toBeGreaterThan(0);
    });

    it('activeVoices returns count of playing voices', () => {
      const osc = new Oscillator(audioContext as unknown as AudioContext);
      expect(osc.activeVoices).toBe(0);

      osc.start(60, 440);
      expect(osc.activeVoices).toBe(1);

      osc.start(64, 523);
      expect(osc.activeVoices).toBe(2);

      osc.stop(60);
      expect(osc.activeVoices).toBe(1);
    });
  });

  describe('voice control', () => {
    describe('start', () => {
      it('creates oscillator with correct frequency', () => {
        const osc = new Oscillator(audioContext as unknown as AudioContext) as TestableOscillator;
        osc.start(60, 440);

        const voice = osc._voices.get(60);
        expect(voice).toBeDefined();
        expect(voice?.oscillator.frequency._value).toBe(440);
      });

      it('creates oscillator with correct waveform', () => {
        const osc = new Oscillator(audioContext as unknown as AudioContext, { waveform: 'square' }) as TestableOscillator;
        osc.start(60, 440);

        const voice = osc._voices.get(60);
        expect(voice?.oscillator.type).toBe('square');
      });

      it('creates oscillator with correct detune', () => {
        const osc = new Oscillator(audioContext as unknown as AudioContext, { detune: 10 }) as TestableOscillator;
        osc.start(60, 440);

        const voice = osc._voices.get(60);
        expect(voice?.oscillator.detune._value).toBe(10);
      });

      it('connects oscillator to output', () => {
        const osc = new Oscillator(audioContext as unknown as AudioContext) as TestableOscillator;
        osc.start(60, 440);

        const voice = osc._voices.get(60);
        expect(voice?.oscillator._connections.length).toBe(1);
        expect(voice?.oscillator._connections[0].destination).toBe(osc.output);
      });

      it('starts the oscillator', () => {
        const osc = new Oscillator(audioContext as unknown as AudioContext) as TestableOscillator;
        osc.start(60, 440);

        const voice = osc._voices.get(60);
        expect(voice?.oscillator._started).toBe(true);
      });

      it('stops existing voice when starting same noteId', () => {
        const osc = new Oscillator(audioContext as unknown as AudioContext) as TestableOscillator;
        osc.start(60, 440);
        const firstVoice = osc._voices.get(60);

        osc.start(60, 880);

        expect(firstVoice?.oscillator._stopped).toBe(true);
        expect(osc._voices.get(60)?.oscillator.frequency._value).toBe(880);
      });

      it('supports polyphony - multiple voices simultaneously', () => {
        const osc = new Oscillator(audioContext as unknown as AudioContext) as TestableOscillator;

        osc.start(60, 261.63); // C4
        osc.start(64, 329.63); // E4
        osc.start(67, 392.00); // G4

        expect(osc._voices.size).toBe(3);
        expect(osc._voices.get(60)?.oscillator.frequency._value).toBeCloseTo(261.63);
        expect(osc._voices.get(64)?.oscillator.frequency._value).toBeCloseTo(329.63);
        expect(osc._voices.get(67)?.oscillator.frequency._value).toBeCloseTo(392.00);
      });
    });

    describe('stop', () => {
      it('stops and disconnects oscillator', () => {
        const osc = new Oscillator(audioContext as unknown as AudioContext) as TestableOscillator;
        osc.start(60, 440);
        const voice = osc._voices.get(60);

        osc.stop(60);

        expect(voice?.oscillator._stopped).toBe(true);
        expect(voice?.oscillator._connections.length).toBe(0);
      });

      it('removes voice from map', () => {
        const osc = new Oscillator(audioContext as unknown as AudioContext) as TestableOscillator;
        osc.start(60, 440);
        osc.stop(60);

        expect(osc._voices.has(60)).toBe(false);
      });

      it('does nothing for non-existent noteId', () => {
        const osc = new Oscillator(audioContext as unknown as AudioContext) as TestableOscillator;
        // Should not throw
        expect(() => osc.stop(60)).not.toThrow();
      });

      it('only stops specified voice, not others', () => {
        const osc = new Oscillator(audioContext as unknown as AudioContext) as TestableOscillator;
        osc.start(60, 440);
        osc.start(64, 523);

        osc.stop(60);

        expect(osc._voices.has(60)).toBe(false);
        expect(osc._voices.has(64)).toBe(true);
        expect(osc._voices.get(64)?.oscillator._stopped).toBe(false);
      });
    });

    describe('stopAfter', () => {
      it('stops voice after specified delay', () => {
        const osc = new Oscillator(audioContext as unknown as AudioContext) as TestableOscillator;
        osc.start(60, 440);

        osc.stopAfter(60, 0.5);

        // Voice should still be playing
        expect(osc._voices.has(60)).toBe(true);

        // Advance time
        vi.advanceTimersByTime(500);

        // Now it should be stopped
        expect(osc._voices.has(60)).toBe(false);
      });

      it('does not affect other voices', () => {
        const osc = new Oscillator(audioContext as unknown as AudioContext) as TestableOscillator;
        osc.start(60, 440);
        osc.start(64, 523);

        osc.stopAfter(60, 0.5);
        vi.advanceTimersByTime(500);

        expect(osc._voices.has(60)).toBe(false);
        expect(osc._voices.has(64)).toBe(true);
      });
    });

    describe('isPlaying', () => {
      it('returns true for active voice', () => {
        const osc = new Oscillator(audioContext as unknown as AudioContext);
        osc.start(60, 440);

        expect(osc.isPlaying(60)).toBe(true);
      });

      it('returns false for inactive voice', () => {
        const osc = new Oscillator(audioContext as unknown as AudioContext);

        expect(osc.isPlaying(60)).toBe(false);
      });

      it('returns false after voice is stopped', () => {
        const osc = new Oscillator(audioContext as unknown as AudioContext);
        osc.start(60, 440);
        osc.stop(60);

        expect(osc.isPlaying(60)).toBe(false);
      });
    });

    describe('setFrequency', () => {
      it('changes frequency of active voice instantly', () => {
        const osc = new Oscillator(audioContext as unknown as AudioContext) as TestableOscillator;
        osc.start(60, 440);

        osc.setFrequency(60, 880);

        const voice = osc._voices.get(60);
        expect(voice?.oscillator.frequency._value).toBe(880);
      });

      it('changes frequency with ramp for portamento', () => {
        const osc = new Oscillator(audioContext as unknown as AudioContext) as TestableOscillator;
        osc.start(60, 440);

        osc.setFrequency(60, 880, 0.1);

        const voice = osc._voices.get(60);
        const scheduled = voice?.oscillator.frequency._scheduledValues;
        expect(scheduled?.some(s => s.type === 'linearRampToValueAtTime' && s.value === 880)).toBe(true);
      });

      it('does nothing for non-existent voice', () => {
        const osc = new Oscillator(audioContext as unknown as AudioContext);
        // Should not throw
        expect(() => osc.setFrequency(60, 880)).not.toThrow();
      });
    });

    describe('allNotesOff', () => {
      it('stops all active voices', () => {
        const osc = new Oscillator(audioContext as unknown as AudioContext) as TestableOscillator;
        osc.start(60, 261);
        osc.start(64, 329);
        osc.start(67, 392);

        const voices = Array.from(osc._voices.values());

        osc.allNotesOff();

        expect(osc._voices.size).toBe(0);
        voices.forEach(v => {
          expect(v.oscillator._stopped).toBe(true);
          expect(v.oscillator._connections.length).toBe(0);
        });
      });

      it('does nothing when no voices active', () => {
        const osc = new Oscillator(audioContext as unknown as AudioContext);
        expect(() => osc.allNotesOff()).not.toThrow();
      });
    });
  });

  describe('parameter control', () => {
    it('setParam sets detune', () => {
      const osc = new Oscillator(audioContext as unknown as AudioContext);
      osc.setParam('detune', 25);
      expect(osc.detune).toBe(25);
    });

    it('setParam sets gain', () => {
      const osc = new Oscillator(audioContext as unknown as AudioContext);
      osc.setParam('gain', 0.5);
      expect(osc.gain).toBe(0.5);
    });

    it('getParam returns detune', () => {
      const osc = new Oscillator(audioContext as unknown as AudioContext, { detune: 15 });
      expect(osc.getParam('detune')).toBe(15);
    });

    it('getParam returns gain', () => {
      const osc = new Oscillator(audioContext as unknown as AudioContext, { gain: 0.8 });
      expect(osc.getParam('gain')).toBe(0.8);
    });

    it('getParam returns 0 for unknown param', () => {
      const osc = new Oscillator(audioContext as unknown as AudioContext);
      expect(osc.getParam('unknown')).toBe(0);
    });
  });

  describe('connection', () => {
    it('connect to AudioNode', () => {
      const osc = new Oscillator(audioContext as unknown as AudioContext) as TestableOscillator;
      const dest = audioContext.createGain();

      osc.connect(dest as unknown as AudioNode);

      expect(osc.output._connections.length).toBe(1);
      expect(osc.output._connections[0].destination).toBe(dest);
    });

    it('connect to object with input property', () => {
      const osc = new Oscillator(audioContext as unknown as AudioContext) as TestableOscillator;
      const dest = { input: audioContext.createGain() };

      osc.connect(dest as unknown as { input: AudioNode });

      expect(osc.output._connections[0].destination).toBe(dest.input);
    });

    it('disconnect from specific destination', () => {
      const osc = new Oscillator(audioContext as unknown as AudioContext) as TestableOscillator;
      const dest1 = audioContext.createGain();
      const dest2 = audioContext.createGain();

      osc.connect(dest1 as unknown as AudioNode);
      osc.connect(dest2 as unknown as AudioNode);
      osc.disconnect(dest1 as unknown as AudioNode);

      expect(osc.output._connections.length).toBe(1);
      expect(osc.output._connections[0].destination).toBe(dest2);
    });

    it('disconnect all', () => {
      const osc = new Oscillator(audioContext as unknown as AudioContext) as TestableOscillator;
      osc.connect(audioContext.createGain() as unknown as AudioNode);
      osc.connect(audioContext.createGain() as unknown as AudioNode);

      osc.disconnect();

      expect(osc.output._connections.length).toBe(0);
    });
  });

  describe('destroy', () => {
    it('stops all voices and disconnects', () => {
      const osc = new Oscillator(audioContext as unknown as AudioContext) as TestableOscillator;
      osc.start(60, 440);
      osc.connect(audioContext.createGain() as unknown as AudioNode);

      osc.destroy();

      expect(osc._voices.size).toBe(0);
      expect(osc.output._connections.length).toBe(0);
    });
  });

  describe('serialization', () => {
    it('serialize returns current state', () => {
      const osc = new Oscillator(audioContext as unknown as AudioContext, {
        waveform: 'square',
        detune: 15,
        gain: 0.8
      });

      const state = osc.serialize();

      expect(state).toEqual({
        waveform: 'square',
        detune: 15,
        gain: 0.8
      });
    });

    it('deserialize restores state', () => {
      const osc = new Oscillator(audioContext as unknown as AudioContext) as TestableOscillator;

      osc.deserialize({
        waveform: 'triangle',
        detune: 20,
        gain: 0.6
      });

      expect(osc._waveform).toBe('triangle');
      expect(osc._detune).toBe(20);
      expect(osc._gain).toBe(0.6);
    });

    it('deserialize handles partial state', () => {
      const osc = new Oscillator(audioContext as unknown as AudioContext, {
        waveform: 'square',
        detune: 10
      }) as TestableOscillator;

      osc.deserialize({ gain: 0.5 });

      expect(osc._waveform).toBe('square'); // Unchanged
      expect(osc._detune).toBe(10); // Unchanged
      expect(osc._gain).toBe(0.5); // Changed
    });
  });

  describe('presets', () => {
    it('OSCILLATOR_PRESETS contains expected presets', () => {
      expect(OSCILLATOR_PRESETS.lead).toBeDefined();
      expect(OSCILLATOR_PRESETS.supersaw).toBeDefined();
      expect(OSCILLATOR_PRESETS.bass).toBeDefined();
      expect(OSCILLATOR_PRESETS.sub).toBeDefined();
      expect(OSCILLATOR_PRESETS.mellow).toBeDefined();
      expect(OSCILLATOR_PRESETS.unison).toBeDefined();
    });

    it('presets have valid waveform types', () => {
      const validWaveforms = ['sine', 'square', 'sawtooth', 'triangle'];
      Object.values(OSCILLATOR_PRESETS).forEach(preset => {
        expect(validWaveforms).toContain(preset.waveform);
      });
    });

    it('can create oscillator with preset', () => {
      const osc = new Oscillator(audioContext as unknown as AudioContext, OSCILLATOR_PRESETS.supersaw) as TestableOscillator;

      expect(osc._waveform).toBe('sawtooth');
      expect(osc._detune).toBe(15);
    });
  });
});
