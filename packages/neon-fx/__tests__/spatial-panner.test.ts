/**
 * SpatialPanner Plugin Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SpatialPanner } from '../src/spatial-panner';
import { createMockAudioContext, MockAudioContext } from '../__mocks__/web-audio';

describe('SpatialPanner', () => {
  let ctx: MockAudioContext;

  beforeEach(() => {
    ctx = createMockAudioContext();
  });

  describe('static properties', () => {
    it('should have correct id', () => {
      expect(SpatialPanner.id).toBe('spatial-panner');
    });

    it('should have correct name', () => {
      expect(SpatialPanner.name).toBe('Spatial Panner');
    });

    it('should have correct description', () => {
      expect(SpatialPanner.description).toBe('3D spatial audio positioning with distance and cone modeling');
    });

    it('should have correct category', () => {
      expect(SpatialPanner.category).toBe('utility');
    });

    it('should have position parameter definitions', () => {
      const params = SpatialPanner.parameterDefinitions;

      const posX = params.find(p => p.name === 'positionX');
      expect(posX).toBeDefined();
      expect(posX!.min).toBe(-100);
      expect(posX!.max).toBe(100);
      expect(posX!.default).toBe(0);

      const posY = params.find(p => p.name === 'positionY');
      expect(posY).toBeDefined();

      const posZ = params.find(p => p.name === 'positionZ');
      expect(posZ).toBeDefined();
    });

    it('should have orientation parameter definitions', () => {
      const params = SpatialPanner.parameterDefinitions;

      const orientX = params.find(p => p.name === 'orientationX');
      expect(orientX).toBeDefined();
      expect(orientX!.min).toBe(-180);
      expect(orientX!.max).toBe(180);
      expect(orientX!.unit).toBe('°');
    });

    it('should have distance parameter definitions', () => {
      const params = SpatialPanner.parameterDefinitions;

      const refDist = params.find(p => p.name === 'refDistance');
      expect(refDist).toBeDefined();
      expect(refDist!.default).toBe(1);

      const maxDist = params.find(p => p.name === 'maxDistance');
      expect(maxDist).toBeDefined();
      expect(maxDist!.default).toBe(100);

      const rolloff = params.find(p => p.name === 'rolloffFactor');
      expect(rolloff).toBeDefined();
    });

    it('should have cone parameter definitions', () => {
      const params = SpatialPanner.parameterDefinitions;

      const coneInner = params.find(p => p.name === 'coneInnerAngle');
      expect(coneInner).toBeDefined();
      expect(coneInner!.default).toBe(360);

      const coneOuter = params.find(p => p.name === 'coneOuterAngle');
      expect(coneOuter).toBeDefined();

      const coneGain = params.find(p => p.name === 'coneOuterGain');
      expect(coneGain).toBeDefined();
    });
  });

  describe('constructor', () => {
    it('should create with default options', () => {
      const panner = new SpatialPanner(ctx as unknown as AudioContext);
      expect(panner).toBeDefined();
      expect(panner.getParam('positionX')).toBe(0);
      expect(panner.getParam('positionY')).toBe(0);
      expect(panner.getParam('positionZ')).toBe(0);
    });

    it('should create with custom position', () => {
      const panner = new SpatialPanner(ctx as unknown as AudioContext, {
        positionX: 50,
        positionY: -30,
        positionZ: 20
      });
      expect(panner.getParam('positionX')).toBe(50);
      expect(panner.getParam('positionY')).toBe(-30);
      expect(panner.getParam('positionZ')).toBe(20);
    });

    it('should create with custom distance model', () => {
      const panner = new SpatialPanner(ctx as unknown as AudioContext, {
        distanceModel: 'linear'
      });
      expect(panner.distanceModel).toBe('linear');
    });

    it('should create with custom panning model', () => {
      const panner = new SpatialPanner(ctx as unknown as AudioContext, {
        panningModel: 'equalpower'
      });
      expect(panner.panningModel).toBe('equalpower');
    });

    it('should create with custom distance settings', () => {
      const panner = new SpatialPanner(ctx as unknown as AudioContext, {
        refDistance: 2,
        maxDistance: 50,
        rolloffFactor: 2
      });
      expect(panner.getParam('refDistance')).toBe(2);
      expect(panner.getParam('maxDistance')).toBe(50);
      expect(panner.getParam('rolloffFactor')).toBe(2);
    });

    it('should create with custom cone settings', () => {
      const panner = new SpatialPanner(ctx as unknown as AudioContext, {
        coneInnerAngle: 90,
        coneOuterAngle: 180,
        coneOuterGain: 50
      });
      expect(panner.getParam('coneInnerAngle')).toBe(90);
      expect(panner.getParam('coneOuterAngle')).toBe(180);
      expect(panner.getParam('coneOuterGain')).toBe(50);
    });
  });

  describe('position parameters', () => {
    it('should set X position', () => {
      const panner = new SpatialPanner(ctx as unknown as AudioContext);
      panner.setParam('positionX', 100);
      expect(panner.getParam('positionX')).toBe(100);
      // Position is scaled: 100 -> 10 meters
      expect(panner.position.x).toBe(10);
    });

    it('should set Y position', () => {
      const panner = new SpatialPanner(ctx as unknown as AudioContext);
      panner.setParam('positionY', -50);
      expect(panner.getParam('positionY')).toBe(-50);
      expect(panner.position.y).toBe(-5);
    });

    it('should set Z position', () => {
      const panner = new SpatialPanner(ctx as unknown as AudioContext);
      panner.setParam('positionZ', 75);
      expect(panner.getParam('positionZ')).toBe(75);
      expect(panner.position.z).toBe(7.5);
    });

    it('should clamp position to bounds', () => {
      const panner = new SpatialPanner(ctx as unknown as AudioContext);
      panner.setParam('positionX', 150);
      expect(panner.getParam('positionX')).toBe(100);

      panner.setParam('positionX', -150);
      expect(panner.getParam('positionX')).toBe(-100);
    });

    it('should set position directly via setPosition', () => {
      const panner = new SpatialPanner(ctx as unknown as AudioContext);
      panner.setPosition(5, -3, 2);
      expect(panner.position.x).toBe(5);
      expect(panner.position.y).toBe(-3);
      expect(panner.position.z).toBe(2);
    });
  });

  describe('orientation parameters', () => {
    it('should set orientation X', () => {
      const panner = new SpatialPanner(ctx as unknown as AudioContext);
      panner.setParam('orientationX', 45);
      expect(panner.getParam('orientationX')).toBe(45);
    });

    it('should set orientation Y', () => {
      const panner = new SpatialPanner(ctx as unknown as AudioContext);
      panner.setParam('orientationY', -90);
      expect(panner.getParam('orientationY')).toBe(-90);
    });

    it('should clamp orientation to bounds', () => {
      const panner = new SpatialPanner(ctx as unknown as AudioContext);
      panner.setParam('orientationX', 200);
      expect(panner.getParam('orientationX')).toBe(180);

      panner.setParam('orientationX', -200);
      expect(panner.getParam('orientationX')).toBe(-180);
    });
  });

  describe('distance model', () => {
    it('should set distance model to linear', () => {
      const panner = new SpatialPanner(ctx as unknown as AudioContext);
      panner.distanceModel = 'linear';
      expect(panner.distanceModel).toBe('linear');
    });

    it('should set distance model to inverse', () => {
      const panner = new SpatialPanner(ctx as unknown as AudioContext);
      panner.distanceModel = 'inverse';
      expect(panner.distanceModel).toBe('inverse');
    });

    it('should set distance model to exponential', () => {
      const panner = new SpatialPanner(ctx as unknown as AudioContext);
      panner.distanceModel = 'exponential';
      expect(panner.distanceModel).toBe('exponential');
    });

    it('should ignore invalid distance model', () => {
      const panner = new SpatialPanner(ctx as unknown as AudioContext);
      panner.distanceModel = 'invalid' as any;
      expect(panner.distanceModel).toBe('inverse'); // Default
    });
  });

  describe('panning model', () => {
    it('should set panning model to equalpower', () => {
      const panner = new SpatialPanner(ctx as unknown as AudioContext);
      panner.panningModel = 'equalpower';
      expect(panner.panningModel).toBe('equalpower');
    });

    it('should set panning model to HRTF', () => {
      const panner = new SpatialPanner(ctx as unknown as AudioContext);
      panner.panningModel = 'HRTF';
      expect(panner.panningModel).toBe('HRTF');
    });

    it('should ignore invalid panning model', () => {
      const panner = new SpatialPanner(ctx as unknown as AudioContext);
      panner.panningModel = 'invalid' as any;
      expect(panner.panningModel).toBe('HRTF'); // Default
    });
  });

  describe('distance settings', () => {
    it('should set reference distance', () => {
      const panner = new SpatialPanner(ctx as unknown as AudioContext);
      panner.setParam('refDistance', 5);
      expect(panner.getParam('refDistance')).toBe(5);
    });

    it('should set max distance', () => {
      const panner = new SpatialPanner(ctx as unknown as AudioContext);
      panner.setParam('maxDistance', 200);
      expect(panner.getParam('maxDistance')).toBe(200);
    });

    it('should set rolloff factor', () => {
      const panner = new SpatialPanner(ctx as unknown as AudioContext);
      panner.setParam('rolloffFactor', 3);
      expect(panner.getParam('rolloffFactor')).toBe(3);
    });
  });

  describe('cone settings', () => {
    it('should set cone inner angle', () => {
      const panner = new SpatialPanner(ctx as unknown as AudioContext);
      panner.setParam('coneInnerAngle', 60);
      expect(panner.getParam('coneInnerAngle')).toBe(60);
    });

    it('should set cone outer angle', () => {
      const panner = new SpatialPanner(ctx as unknown as AudioContext);
      panner.setParam('coneOuterAngle', 120);
      expect(panner.getParam('coneOuterAngle')).toBe(120);
    });

    it('should set cone outer gain', () => {
      const panner = new SpatialPanner(ctx as unknown as AudioContext);
      panner.setParam('coneOuterGain', 25);
      expect(panner.getParam('coneOuterGain')).toBe(25);
    });
  });

  describe('bypass', () => {
    it('should start with bypass disabled', () => {
      const panner = new SpatialPanner(ctx as unknown as AudioContext);
      expect(panner.bypassed).toBe(false);
    });

    it('should enable bypass and center position', () => {
      const panner = new SpatialPanner(ctx as unknown as AudioContext, {
        positionX: 50,
        positionY: 30,
        positionZ: -20
      });
      panner.bypassed = true;
      expect(panner.bypassed).toBe(true);
      expect(panner.position.x).toBe(0);
      expect(panner.position.y).toBe(0);
      expect(panner.position.z).toBe(0);
    });

    it('should disable bypass and restore position', () => {
      const panner = new SpatialPanner(ctx as unknown as AudioContext, {
        positionX: 50,
        positionY: 30,
        positionZ: -20
      });
      panner.bypassed = true;
      panner.bypassed = false;
      expect(panner.bypassed).toBe(false);
      expect(panner.position.x).toBe(5);
      expect(panner.position.y).toBe(3);
      expect(panner.position.z).toBe(-2);
    });
  });

  describe('AudioParam access for LFO', () => {
    it('should expose positionX AudioParam', () => {
      const panner = new SpatialPanner(ctx as unknown as AudioContext);
      expect(panner.positionXParam).toBeDefined();
    });

    it('should expose positionY AudioParam', () => {
      const panner = new SpatialPanner(ctx as unknown as AudioContext);
      expect(panner.positionYParam).toBeDefined();
    });

    it('should expose positionZ AudioParam', () => {
      const panner = new SpatialPanner(ctx as unknown as AudioContext);
      expect(panner.positionZParam).toBeDefined();
    });
  });

  describe('node access', () => {
    it('should expose the underlying PannerNode', () => {
      const panner = new SpatialPanner(ctx as unknown as AudioContext);
      expect(panner.node).toBeDefined();
      expect(panner.node.positionX).toBeDefined();
    });
  });

  describe('connections', () => {
    it('should have input property', () => {
      const panner = new SpatialPanner(ctx as unknown as AudioContext);
      expect(panner.input).toBeDefined();
    });

    it('should have output property', () => {
      const panner = new SpatialPanner(ctx as unknown as AudioContext);
      expect(panner.output).toBeDefined();
    });

    it('should connect to destination', () => {
      const panner = new SpatialPanner(ctx as unknown as AudioContext);
      expect(() => panner.connect(ctx.destination)).not.toThrow();
    });
  });

  describe('state serialization', () => {
    it('should serialize current state', () => {
      const panner = new SpatialPanner(ctx as unknown as AudioContext, {
        positionX: 25,
        positionY: -15,
        positionZ: 10
      });
      const state = panner.serialize();

      expect(state.id).toBe('spatial-panner');
      expect(state.bypassed).toBe(false);
      expect(state.params.positionX).toBe(25);
      expect(state.params.positionY).toBe(-15);
      expect(state.params.positionZ).toBe(10);
    });
  });

  describe('real-world scenarios', () => {
    it('should handle circular motion', () => {
      const panner = new SpatialPanner(ctx as unknown as AudioContext);

      // Simulate circular motion
      const angles = [0, 90, 180, 270];
      for (const angle of angles) {
        const rad = angle * Math.PI / 180;
        const x = Math.cos(rad) * 50;
        const z = Math.sin(rad) * 50;
        panner.setParam('positionX', x);
        panner.setParam('positionZ', z);
      }
    });

    it('should work with directional cone for spotlight effect', () => {
      const panner = new SpatialPanner(ctx as unknown as AudioContext, {
        coneInnerAngle: 30,
        coneOuterAngle: 90,
        coneOuterGain: 10,
        orientationY: 45
      });

      expect(panner.getParam('coneInnerAngle')).toBe(30);
      expect(panner.getParam('coneOuterAngle')).toBe(90);
    });
  });
});
