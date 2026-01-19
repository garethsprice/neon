/**
 * StereoPanner Plugin Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { StereoPanner } from '../src/stereo-panner';
import { createMockAudioContext, MockAudioContext } from '../__mocks__/web-audio';

describe('StereoPanner', () => {
  let ctx: MockAudioContext;

  beforeEach(() => {
    ctx = createMockAudioContext();
  });

  describe('static properties', () => {
    it('should have correct id', () => {
      expect(StereoPanner.id).toBe('stereo-panner');
    });

    it('should have correct name', () => {
      expect(StereoPanner.name).toBe('Stereo Panner');
    });

    it('should have correct description', () => {
      expect(StereoPanner.description).toBe('Controls stereo positioning from left to right');
    });

    it('should have correct category', () => {
      expect(StereoPanner.category).toBe('utility');
    });

    it('should have pan parameter definition', () => {
      const params = StereoPanner.parameterDefinitions;
      expect(params).toHaveLength(1);

      const pan = params.find(p => p.name === 'pan');
      expect(pan).toBeDefined();
      expect(pan!.min).toBe(-100);
      expect(pan!.max).toBe(100);
      expect(pan!.default).toBe(0);
      expect(pan!.unit).toBe('%');
    });
  });

  describe('constructor', () => {
    it('should create with default options', () => {
      const panner = new StereoPanner(ctx as unknown as AudioContext);
      expect(panner).toBeDefined();
      expect(panner.getParam('pan')).toBe(0);
    });

    it('should create with custom pan value', () => {
      const panner = new StereoPanner(ctx as unknown as AudioContext, { pan: 50 });
      expect(panner.getParam('pan')).toBe(50);
    });

    it('should create with full left pan', () => {
      const panner = new StereoPanner(ctx as unknown as AudioContext, { pan: -100 });
      expect(panner.getParam('pan')).toBe(-100);
      expect(panner.panPosition).toBe(-1);
    });

    it('should create with full right pan', () => {
      const panner = new StereoPanner(ctx as unknown as AudioContext, { pan: 100 });
      expect(panner.getParam('pan')).toBe(100);
      expect(panner.panPosition).toBe(1);
    });
  });

  describe('pan parameter', () => {
    it('should set pan to center (0)', () => {
      const panner = new StereoPanner(ctx as unknown as AudioContext);
      panner.setParam('pan', 0);
      expect(panner.getParam('pan')).toBe(0);
      expect(panner.panPosition).toBe(0);
    });

    it('should set pan to left (-100)', () => {
      const panner = new StereoPanner(ctx as unknown as AudioContext);
      panner.setParam('pan', -100);
      expect(panner.getParam('pan')).toBe(-100);
      expect(panner.panPosition).toBe(-1);
    });

    it('should set pan to right (100)', () => {
      const panner = new StereoPanner(ctx as unknown as AudioContext);
      panner.setParam('pan', 100);
      expect(panner.getParam('pan')).toBe(100);
      expect(panner.panPosition).toBe(1);
    });

    it('should set pan to partial left (-50)', () => {
      const panner = new StereoPanner(ctx as unknown as AudioContext);
      panner.setParam('pan', -50);
      expect(panner.getParam('pan')).toBe(-50);
      expect(panner.panPosition).toBe(-0.5);
    });

    it('should set pan to partial right (75)', () => {
      const panner = new StereoPanner(ctx as unknown as AudioContext);
      panner.setParam('pan', 75);
      expect(panner.getParam('pan')).toBe(75);
      expect(panner.panPosition).toBe(0.75);
    });

    it('should clamp pan to minimum (-100)', () => {
      const panner = new StereoPanner(ctx as unknown as AudioContext);
      panner.setParam('pan', -150);
      expect(panner.getParam('pan')).toBe(-100);
    });

    it('should clamp pan to maximum (100)', () => {
      const panner = new StereoPanner(ctx as unknown as AudioContext);
      panner.setParam('pan', 150);
      expect(panner.getParam('pan')).toBe(100);
    });
  });

  describe('bypass', () => {
    it('should start with bypass disabled', () => {
      const panner = new StereoPanner(ctx as unknown as AudioContext);
      expect(panner.bypassed).toBe(false);
    });

    it('should enable bypass', () => {
      const panner = new StereoPanner(ctx as unknown as AudioContext, { pan: 100 });
      panner.bypassed = true;
      expect(panner.bypassed).toBe(true);
      // When bypassed, pan should be centered
      expect(panner.panPosition).toBe(0);
    });

    it('should disable bypass and restore pan', () => {
      const panner = new StereoPanner(ctx as unknown as AudioContext, { pan: -75 });
      panner.bypassed = true;
      expect(panner.panPosition).toBe(0);

      panner.bypassed = false;
      expect(panner.bypassed).toBe(false);
      expect(panner.panPosition).toBe(-0.75);
    });
  });

  describe('node access', () => {
    it('should expose the underlying StereoPannerNode', () => {
      const panner = new StereoPanner(ctx as unknown as AudioContext);
      expect(panner.node).toBeDefined();
      expect(panner.node.pan).toBeDefined();
    });
  });

  describe('connections', () => {
    it('should have input property', () => {
      const panner = new StereoPanner(ctx as unknown as AudioContext);
      expect(panner.input).toBeDefined();
    });

    it('should have output property', () => {
      const panner = new StereoPanner(ctx as unknown as AudioContext);
      expect(panner.output).toBeDefined();
    });

    it('should connect to destination', () => {
      const panner = new StereoPanner(ctx as unknown as AudioContext);
      expect(() => panner.connect(ctx.destination)).not.toThrow();
    });
  });

  describe('state serialization', () => {
    it('should return current state', () => {
      const panner = new StereoPanner(ctx as unknown as AudioContext, { pan: 25 });
      const state = panner.serialize();

      expect(state.id).toBe('stereo-panner');
      expect(state.bypassed).toBe(false);
      expect(state.params.pan).toBe(25);
    });

    it('should include bypass state', () => {
      const panner = new StereoPanner(ctx as unknown as AudioContext);
      panner.bypassed = true;
      const state = panner.serialize();

      expect(state.bypassed).toBe(true);
    });
  });

  describe('parameter ramping', () => {
    it('should ramp pan value over time', () => {
      const panner = new StereoPanner(ctx as unknown as AudioContext, { pan: 0 });
      panner.setParam('pan', 100, 0.5);
      // Parameter should be updated immediately in mock
      expect(panner.getParam('pan')).toBe(100);
    });
  });

  describe('real-world scenarios', () => {
    it('should handle rapid pan automation', () => {
      const panner = new StereoPanner(ctx as unknown as AudioContext);

      // Simulate LFO-style panning
      const values = [-100, -50, 0, 50, 100, 50, 0, -50, -100];
      for (const v of values) {
        panner.setParam('pan', v);
        expect(panner.getParam('pan')).toBe(v);
      }
    });

    it('should work with stereo width simulation', () => {
      // Create two panners for stereo width
      const leftPanner = new StereoPanner(ctx as unknown as AudioContext, { pan: -50 });
      const rightPanner = new StereoPanner(ctx as unknown as AudioContext, { pan: 50 });

      expect(leftPanner.panPosition).toBe(-0.5);
      expect(rightPanner.panPosition).toBe(0.5);
    });
  });
});
