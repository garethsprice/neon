/**
 * Tests for neon-fx Envelope
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Envelope, ENVELOPE_PRESETS } from '../src/envelope';
import { MockAudioContext, createMockAudioContext, MockGainNode } from '../__mocks__/web-audio';

interface ActiveEnvelope {
  envelope: MockGainNode;
  releaseTimeout?: ReturnType<typeof setTimeout>;
  state: 'attack' | 'decay' | 'sustain' | 'release';
}

type TestableEnvelope = Envelope & {
  ctx: MockAudioContext;
  input: MockGainNode;
  output: MockGainNode;
  _params: { attack: number; decay: number; sustain: number; release: number };
  _gain: number;
  _envelopes: Map<number, ActiveEnvelope>;
};

describe('Envelope', () => {
  let audioContext: MockAudioContext;

  beforeEach(() => {
    audioContext = createMockAudioContext();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('constructor', () => {
    it('creates with default ADSR values', () => {
      const env = new Envelope(audioContext as unknown as AudioContext) as TestableEnvelope;

      expect(env._params.attack).toBe(0.01);
      expect(env._params.decay).toBe(0.1);
      expect(env._params.sustain).toBe(0.7);
      expect(env._params.release).toBe(0.3);
    });

    it('creates with custom ADSR values', () => {
      const env = new Envelope(audioContext as unknown as AudioContext, {
        attack: 0.5,
        decay: 0.3,
        sustain: 0.6,
        release: 1.0
      }) as TestableEnvelope;

      expect(env._params.attack).toBe(0.5);
      expect(env._params.decay).toBe(0.3);
      expect(env._params.sustain).toBe(0.6);
      expect(env._params.release).toBe(1.0);
    });

    it('creates input and output gain nodes', () => {
      const env = new Envelope(audioContext as unknown as AudioContext) as TestableEnvelope;

      expect(env.input).toBeDefined();
      expect(env.output).toBeDefined();
      expect(env.input.gain.value).toBe(1);
      expect(env.output.gain.value).toBe(1);
    });

    it('creates with custom gain', () => {
      const env = new Envelope(audioContext as unknown as AudioContext, { gain: 0.5 }) as TestableEnvelope;

      expect(env._gain).toBe(0.5);
      expect(env.output.gain.value).toBe(0.5);
    });
  });

  describe('property accessors', () => {
    it('params getter returns copy of ADSR', () => {
      const env = new Envelope(audioContext as unknown as AudioContext) as TestableEnvelope;
      const params = env.params;

      params.attack = 99;
      expect(env._params.attack).toBe(0.01); // Unchanged
    });

    it('params setter updates ADSR values', () => {
      const env = new Envelope(audioContext as unknown as AudioContext) as TestableEnvelope;
      env.params = { attack: 0.2, sustain: 0.5 };

      expect(env._params.attack).toBe(0.2);
      expect(env._params.sustain).toBe(0.5);
      expect(env._params.decay).toBe(0.1); // Unchanged
    });

    it('attack getter/setter', () => {
      const env = new Envelope(audioContext as unknown as AudioContext) as TestableEnvelope;
      env.attack = 0.5;
      expect(env.attack).toBe(0.5);
    });

    it('attack setter clamps to minimum', () => {
      const env = new Envelope(audioContext as unknown as AudioContext) as TestableEnvelope;
      env.attack = 0;
      expect(env.attack).toBe(0.001);
    });

    it('decay getter/setter', () => {
      const env = new Envelope(audioContext as unknown as AudioContext) as TestableEnvelope;
      env.decay = 0.4;
      expect(env.decay).toBe(0.4);
    });

    it('sustain getter/setter', () => {
      const env = new Envelope(audioContext as unknown as AudioContext) as TestableEnvelope;
      env.sustain = 0.8;
      expect(env.sustain).toBe(0.8);
    });

    it('sustain clamps to 0-1 range', () => {
      const env = new Envelope(audioContext as unknown as AudioContext) as TestableEnvelope;
      env.sustain = 1.5;
      expect(env.sustain).toBe(1);

      env.sustain = -0.5;
      expect(env.sustain).toBe(0.001);
    });

    it('release getter/setter', () => {
      const env = new Envelope(audioContext as unknown as AudioContext) as TestableEnvelope;
      env.release = 2.0;
      expect(env.release).toBe(2.0);
    });

    it('gain setter updates output with ramp', () => {
      const env = new Envelope(audioContext as unknown as AudioContext) as TestableEnvelope;
      env.gain = 0.7;

      expect(env._gain).toBe(0.7);
      expect(env.output.gain._scheduledValues.length).toBeGreaterThan(0);
    });

    it('activeCount returns number of active envelopes', () => {
      const env = new Envelope(audioContext as unknown as AudioContext) as TestableEnvelope;
      expect(env.activeCount).toBe(0);

      env.noteOn(60);
      expect(env.activeCount).toBe(1);

      env.noteOn(64);
      expect(env.activeCount).toBe(2);
    });
  });

  describe('noteOn', () => {
    it('creates envelope gain node', () => {
      const env = new Envelope(audioContext as unknown as AudioContext) as TestableEnvelope;
      env.noteOn(60);

      expect(env._envelopes.has(60)).toBe(true);
      expect(env._envelopes.get(60)?.envelope).toBeDefined();
    });

    it('schedules attack phase (0 to 1)', () => {
      const env = new Envelope(audioContext as unknown as AudioContext, {
        attack: 0.1,
        decay: 0.2,
        sustain: 0.7
      }) as TestableEnvelope;

      env.noteOn(60);

      const active = env._envelopes.get(60);
      const scheduled = active?.envelope.gain._scheduledValues;

      // Should start at 0
      expect(scheduled?.find(s => s.type === 'setValueAtTime' && s.value === 0)).toBeDefined();
      // Should ramp to 1
      expect(scheduled?.find(s => s.type === 'linearRampToValueAtTime' && s.value === 1)).toBeDefined();
    });

    it('schedules decay phase (1 to sustain)', () => {
      const env = new Envelope(audioContext as unknown as AudioContext, {
        attack: 0.1,
        sustain: 0.5
      }) as TestableEnvelope;

      env.noteOn(60);

      const active = env._envelopes.get(60);
      const scheduled = active?.envelope.gain._scheduledValues;

      // Should ramp to sustain level
      expect(scheduled?.find(s => s.type === 'linearRampToValueAtTime' && s.value === 0.5)).toBeDefined();
    });

    it('connects input -> envelope -> output', () => {
      const env = new Envelope(audioContext as unknown as AudioContext) as TestableEnvelope;
      env.noteOn(60);

      // Input should connect to envelope
      expect(env.input._connections.some(c => c.destination === env._envelopes.get(60)?.envelope)).toBe(true);

      // Envelope should connect to output
      expect(env._envelopes.get(60)?.envelope._connections.some(c => c.destination === env.output)).toBe(true);
    });

    it('returns the envelope gain node', () => {
      const env = new Envelope(audioContext as unknown as AudioContext);
      const gainNode = env.noteOn(60);

      expect(gainNode).toBeDefined();
    });

    it('cleans up existing envelope when re-triggering same noteId', () => {
      const env = new Envelope(audioContext as unknown as AudioContext) as TestableEnvelope;
      env.noteOn(60);
      const firstEnvelope = env._envelopes.get(60)?.envelope;

      env.noteOn(60);

      // First envelope should be disconnected
      expect(firstEnvelope?._connections.length).toBe(0);
      // New envelope should exist
      expect(env._envelopes.get(60)?.envelope).not.toBe(firstEnvelope);
    });

    it('supports polyphony - multiple envelopes simultaneously', () => {
      const env = new Envelope(audioContext as unknown as AudioContext) as TestableEnvelope;

      env.noteOn(60);
      env.noteOn(64);
      env.noteOn(67);

      expect(env._envelopes.size).toBe(3);
      expect(env._envelopes.get(60)).toBeDefined();
      expect(env._envelopes.get(64)).toBeDefined();
      expect(env._envelopes.get(67)).toBeDefined();
    });

    it('sets initial state to attack', () => {
      const env = new Envelope(audioContext as unknown as AudioContext) as TestableEnvelope;
      env.noteOn(60);

      expect(env._envelopes.get(60)?.state).toBe('attack');
    });
  });

  describe('noteOff', () => {
    it('schedules release phase (current to 0)', () => {
      const env = new Envelope(audioContext as unknown as AudioContext, {
        release: 0.5
      }) as TestableEnvelope;

      env.noteOn(60);
      env.noteOff(60);

      const active = env._envelopes.get(60);
      const scheduled = active?.envelope.gain._scheduledValues;

      // Should have exponential ramp to near-zero
      expect(scheduled?.find(s => s.type === 'exponentialRampToValueAtTime')).toBeDefined();
    });

    it('sets state to release', () => {
      const env = new Envelope(audioContext as unknown as AudioContext) as TestableEnvelope;
      env.noteOn(60);
      env.noteOff(60);

      expect(env._envelopes.get(60)?.state).toBe('release');
    });

    it('cleans up after release time', () => {
      const env = new Envelope(audioContext as unknown as AudioContext, {
        release: 0.3
      }) as TestableEnvelope;

      env.noteOn(60);
      env.noteOff(60);

      // Should still exist during release
      expect(env._envelopes.has(60)).toBe(true);

      // Advance past release time + buffer
      vi.advanceTimersByTime(350);

      // Should be cleaned up
      expect(env._envelopes.has(60)).toBe(false);
    });

    it('does nothing for non-existent noteId', () => {
      const env = new Envelope(audioContext as unknown as AudioContext);
      expect(() => env.noteOff(60)).not.toThrow();
    });

    it('only releases specified envelope, not others', () => {
      const env = new Envelope(audioContext as unknown as AudioContext, { release: 0.3 }) as TestableEnvelope;

      env.noteOn(60);
      env.noteOn(64);
      env.noteOff(60);

      vi.advanceTimersByTime(350);

      expect(env._envelopes.has(60)).toBe(false);
      expect(env._envelopes.has(64)).toBe(true);
    });

    describe('immediate mode', () => {
      it('stops immediately without release when immediate=true', () => {
        const env = new Envelope(audioContext as unknown as AudioContext, {
          release: 1.0
        }) as TestableEnvelope;

        env.noteOn(60);
        env.noteOff(60, true);

        // Should be cleaned up immediately (or very soon)
        vi.advanceTimersByTime(10);
        expect(env._envelopes.has(60)).toBe(false);
      });

      it('sets gain to 0 immediately', () => {
        const env = new Envelope(audioContext as unknown as AudioContext) as TestableEnvelope;

        env.noteOn(60);
        const active = env._envelopes.get(60);
        env.noteOff(60, true);

        // Should have setValueAtTime to 0
        expect(active?.envelope.gain._scheduledValues.find(s =>
          s.type === 'setValueAtTime' && s.value === 0
        )).toBeDefined();
      });
    });
  });

  describe('trigger', () => {
    it('calls noteOn and schedules noteOff', () => {
      const env = new Envelope(audioContext as unknown as AudioContext) as TestableEnvelope;

      env.trigger(60, 0.5);

      // Should be active
      expect(env._envelopes.has(60)).toBe(true);

      // Advance past duration
      vi.advanceTimersByTime(500);

      // Should be in release (noteOff was called)
      expect(env._envelopes.get(60)?.state).toBe('release');
    });

    it('returns envelope gain node', () => {
      const env = new Envelope(audioContext as unknown as AudioContext);
      const gainNode = env.trigger(60, 0.5);

      expect(gainNode).toBeDefined();
    });

    it('full lifecycle: trigger -> hold -> release -> cleanup', () => {
      const env = new Envelope(audioContext as unknown as AudioContext, {
        attack: 0.1,
        decay: 0.1,
        sustain: 0.7,
        release: 0.3
      }) as TestableEnvelope;

      env.trigger(60, 0.5);

      // During hold
      vi.advanceTimersByTime(200);
      expect(env._envelopes.has(60)).toBe(true);

      // After hold, during release
      vi.advanceTimersByTime(400);
      expect(env._envelopes.get(60)?.state).toBe('release');

      // After release
      vi.advanceTimersByTime(400);
      expect(env._envelopes.has(60)).toBe(false);
    });
  });

  describe('allNotesOff', () => {
    it('stops all active envelopes immediately', () => {
      const env = new Envelope(audioContext as unknown as AudioContext) as TestableEnvelope;

      env.noteOn(60);
      env.noteOn(64);
      env.noteOn(67);

      env.allNotesOff();
      vi.advanceTimersByTime(10);

      expect(env._envelopes.size).toBe(0);
    });

    it('clears pending release timeouts', () => {
      const env = new Envelope(audioContext as unknown as AudioContext, {
        release: 1.0
      }) as TestableEnvelope;

      env.noteOn(60);
      env.noteOff(60); // Start release

      // Before release completes, kill all
      vi.advanceTimersByTime(100);
      env.allNotesOff();
      vi.advanceTimersByTime(10);

      expect(env._envelopes.size).toBe(0);
    });
  });

  describe('connection', () => {
    it('connect to AudioNode', () => {
      const env = new Envelope(audioContext as unknown as AudioContext) as TestableEnvelope;
      const dest = audioContext.createGain();

      env.connect(dest as unknown as AudioNode);

      expect(env.output._connections.length).toBe(1);
      expect(env.output._connections[0].destination).toBe(dest);
    });

    it('connect to object with input property', () => {
      const env = new Envelope(audioContext as unknown as AudioContext) as TestableEnvelope;
      const dest = { input: audioContext.createGain() };

      env.connect(dest as unknown as { input: AudioNode });

      expect(env.output._connections[0].destination).toBe(dest.input);
    });

    it('disconnect from specific destination', () => {
      const env = new Envelope(audioContext as unknown as AudioContext) as TestableEnvelope;
      const dest1 = audioContext.createGain();
      const dest2 = audioContext.createGain();

      env.connect(dest1 as unknown as AudioNode);
      env.connect(dest2 as unknown as AudioNode);
      env.disconnect(dest1 as unknown as AudioNode);

      expect(env.output._connections.length).toBe(1);
      expect(env.output._connections[0].destination).toBe(dest2);
    });

    it('disconnect all', () => {
      const env = new Envelope(audioContext as unknown as AudioContext) as TestableEnvelope;
      env.connect(audioContext.createGain() as unknown as AudioNode);
      env.connect(audioContext.createGain() as unknown as AudioNode);

      env.disconnect();

      expect(env.output._connections.length).toBe(0);
    });
  });

  describe('destroy', () => {
    it('stops all envelopes and disconnects', () => {
      const env = new Envelope(audioContext as unknown as AudioContext) as TestableEnvelope;
      env.noteOn(60);
      env.connect(audioContext.createGain() as unknown as AudioNode);

      env.destroy();
      vi.advanceTimersByTime(10);

      expect(env._envelopes.size).toBe(0);
      expect(env.output._connections.length).toBe(0);
      expect(env.input._connections.length).toBe(0);
    });
  });

  describe('parameter methods', () => {
    it('setParam sets ADSR values', () => {
      const env = new Envelope(audioContext as unknown as AudioContext);

      env.setParam('attack', 0.5);
      env.setParam('decay', 0.4);
      env.setParam('sustain', 0.6);
      env.setParam('release', 1.0);

      expect(env.attack).toBe(0.5);
      expect(env.decay).toBe(0.4);
      expect(env.sustain).toBe(0.6);
      expect(env.release).toBe(1.0);
    });

    it('setParam sets gain', () => {
      const env = new Envelope(audioContext as unknown as AudioContext);
      env.setParam('gain', 0.8);
      expect(env.gain).toBe(0.8);
    });

    it('getParam returns ADSR values', () => {
      const env = new Envelope(audioContext as unknown as AudioContext, {
        attack: 0.2,
        decay: 0.3,
        sustain: 0.5,
        release: 0.8
      });

      expect(env.getParam('attack')).toBe(0.2);
      expect(env.getParam('decay')).toBe(0.3);
      expect(env.getParam('sustain')).toBe(0.5);
      expect(env.getParam('release')).toBe(0.8);
    });

    it('getParam returns 0 for unknown param', () => {
      const env = new Envelope(audioContext as unknown as AudioContext);
      expect(env.getParam('unknown')).toBe(0);
    });
  });

  describe('serialization', () => {
    it('serialize returns current state', () => {
      const env = new Envelope(audioContext as unknown as AudioContext, {
        attack: 0.2,
        decay: 0.3,
        sustain: 0.5,
        release: 0.8,
        gain: 0.9
      });

      const state = env.serialize();

      expect(state).toEqual({
        attack: 0.2,
        decay: 0.3,
        sustain: 0.5,
        release: 0.8,
        gain: 0.9
      });
    });

    it('deserialize restores state', () => {
      const env = new Envelope(audioContext as unknown as AudioContext) as TestableEnvelope;

      env.deserialize({
        attack: 0.3,
        decay: 0.4,
        sustain: 0.6,
        release: 1.0,
        gain: 0.7
      });

      expect(env._params.attack).toBe(0.3);
      expect(env._params.decay).toBe(0.4);
      expect(env._params.sustain).toBe(0.6);
      expect(env._params.release).toBe(1.0);
      expect(env._gain).toBe(0.7);
    });

    it('deserialize handles partial state', () => {
      const env = new Envelope(audioContext as unknown as AudioContext, {
        attack: 0.5,
        sustain: 0.8
      }) as TestableEnvelope;

      env.deserialize({ decay: 0.2 });

      expect(env._params.attack).toBe(0.5); // Unchanged
      expect(env._params.decay).toBe(0.2); // Changed
      expect(env._params.sustain).toBe(0.8); // Unchanged
    });
  });

  describe('presets', () => {
    it('ENVELOPE_PRESETS contains expected presets', () => {
      expect(ENVELOPE_PRESETS.pad).toBeDefined();
      expect(ENVELOPE_PRESETS.bass).toBeDefined();
      expect(ENVELOPE_PRESETS.pluck).toBeDefined();
      expect(ENVELOPE_PRESETS.organ).toBeDefined();
      expect(ENVELOPE_PRESETS.brass).toBeDefined();
      expect(ENVELOPE_PRESETS.perc).toBeDefined();
      expect(ENVELOPE_PRESETS.swell).toBeDefined();
    });

    it('presets have valid ADSR values', () => {
      Object.values(ENVELOPE_PRESETS).forEach(preset => {
        expect(preset.attack).toBeGreaterThanOrEqual(0);
        expect(preset.decay).toBeGreaterThanOrEqual(0);
        expect(preset.sustain).toBeGreaterThanOrEqual(0);
        expect(preset.sustain).toBeLessThanOrEqual(1);
        expect(preset.release).toBeGreaterThanOrEqual(0);
      });
    });

    it('can create envelope with preset', () => {
      const env = new Envelope(audioContext as unknown as AudioContext, ENVELOPE_PRESETS.pluck) as TestableEnvelope;

      expect(env._params.attack).toBe(0.001);
      expect(env._params.decay).toBe(0.2);
      expect(env._params.sustain).toBe(0.1);
      expect(env._params.release).toBe(0.3);
    });
  });

  describe('edge cases', () => {
    it('handles rapid noteOn/noteOff cycles', () => {
      const env = new Envelope(audioContext as unknown as AudioContext) as TestableEnvelope;

      for (let i = 0; i < 10; i++) {
        env.noteOn(60);
        env.noteOff(60);
      }

      // Should not throw and should have at most one envelope
      expect(env._envelopes.size).toBeLessThanOrEqual(1);
    });

    it('handles very short attack/decay times', () => {
      const env = new Envelope(audioContext as unknown as AudioContext, {
        attack: 0.001,
        decay: 0.001,
        sustain: 0.5,
        release: 0.001
      });

      // Should not throw
      expect(() => {
        env.noteOn(60);
        vi.advanceTimersByTime(10);
        env.noteOff(60);
        vi.advanceTimersByTime(10);
      }).not.toThrow();
    });

    it('handles very long envelope times', () => {
      const env = new Envelope(audioContext as unknown as AudioContext, {
        attack: 10,
        decay: 10,
        sustain: 0.5,
        release: 10
      }) as TestableEnvelope;

      env.noteOn(60);
      expect(env._envelopes.has(60)).toBe(true);

      // Fast cleanup
      env.allNotesOff();
      vi.advanceTimersByTime(10);
      expect(env._envelopes.size).toBe(0);
    });
  });
});
