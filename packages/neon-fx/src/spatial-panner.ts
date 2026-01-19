/**
 * Neon Audio Plugin - Spatial Panner
 *
 * 3D spatial audio positioning using Web Audio API's PannerNode.
 * Provides full control over position, orientation, distance model, and cone settings.
 */

import { AudioPlugin, setupBypassRouting } from './base';
import type { ParameterDefinition, PluginCategory } from './types';

export type DistanceModelType = 'linear' | 'inverse' | 'exponential';
export type PanningModelType = 'equalpower' | 'HRTF';

export interface SpatialPannerOptions extends Record<string, unknown> {
  // Position (-100 to 100, scaled to -10 to 10 meters)
  positionX?: number;
  positionY?: number;
  positionZ?: number;
  // Orientation angles in degrees
  orientationX?: number;
  orientationY?: number;
  orientationZ?: number;
  // Distance model settings
  distanceModel?: DistanceModelType;
  panningModel?: PanningModelType;
  refDistance?: number;
  maxDistance?: number;
  rolloffFactor?: number;
  // Cone settings (for directional sound)
  coneInnerAngle?: number;
  coneOuterAngle?: number;
  coneOuterGain?: number;
}

export class SpatialPanner extends AudioPlugin {
  private _panner: PannerNode;
  private _distanceModel: DistanceModelType = 'inverse';
  private _panningModel: PanningModelType = 'HRTF';

  static get id(): string {
    return 'spatial-panner';
  }

  static get name(): string {
    return 'Spatial Panner';
  }

  static get description(): string {
    return '3D spatial audio positioning with distance and cone modeling';
  }

  static get category(): PluginCategory {
    return 'utility';
  }

  static get parameterDefinitions(): readonly ParameterDefinition[] {
    return [
      // Position parameters (-100 to 100, displayed as percentage)
      {
        name: 'positionX',
        label: 'X Position',
        min: -100,
        max: 100,
        default: 0,
        unit: '%',
        scale: 'linear'
      },
      {
        name: 'positionY',
        label: 'Y Position',
        min: -100,
        max: 100,
        default: 0,
        unit: '%',
        scale: 'linear'
      },
      {
        name: 'positionZ',
        label: 'Z Position',
        min: -100,
        max: 100,
        default: 0,
        unit: '%',
        scale: 'linear'
      },
      // Orientation parameters (degrees)
      {
        name: 'orientationX',
        label: 'Orient X',
        min: -180,
        max: 180,
        default: 0,
        unit: '°',
        scale: 'linear'
      },
      {
        name: 'orientationY',
        label: 'Orient Y',
        min: -180,
        max: 180,
        default: 0,
        unit: '°',
        scale: 'linear'
      },
      {
        name: 'orientationZ',
        label: 'Orient Z',
        min: -180,
        max: 180,
        default: 0,
        unit: '°',
        scale: 'linear'
      },
      // Distance settings
      {
        name: 'refDistance',
        label: 'Ref Distance',
        min: 0.1,
        max: 100,
        default: 1,
        unit: 'm',
        scale: 'log'
      },
      {
        name: 'maxDistance',
        label: 'Max Distance',
        min: 1,
        max: 1000,
        default: 100,
        unit: 'm',
        scale: 'log'
      },
      {
        name: 'rolloffFactor',
        label: 'Rolloff',
        min: 0,
        max: 10,
        default: 1,
        unit: '',
        scale: 'linear'
      },
      // Cone settings
      {
        name: 'coneInnerAngle',
        label: 'Cone Inner',
        min: 0,
        max: 360,
        default: 360,
        unit: '°',
        scale: 'linear'
      },
      {
        name: 'coneOuterAngle',
        label: 'Cone Outer',
        min: 0,
        max: 360,
        default: 360,
        unit: '°',
        scale: 'linear'
      },
      {
        name: 'coneOuterGain',
        label: 'Cone Gain',
        min: 0,
        max: 100,
        default: 0,
        unit: '%',
        scale: 'linear'
      }
    ];
  }

  constructor(audioContext: AudioContext, options: SpatialPannerOptions = {}) {
    super(audioContext, options);

    // Create panner node
    this._panner = this.ctx.createPanner();

    // Set models
    this._distanceModel = options.distanceModel || 'inverse';
    this._panningModel = options.panningModel || 'HRTF';
    this._panner.distanceModel = this._distanceModel;
    this._panner.panningModel = this._panningModel;

    // Apply initial position (scale from -100..100 to -10..10)
    const scale = 0.1;
    this._panner.positionX.value = (options.positionX ?? 0) * scale;
    this._panner.positionY.value = (options.positionY ?? 0) * scale;
    this._panner.positionZ.value = (options.positionZ ?? 0) * scale;

    // Apply initial orientation (convert degrees to unit vector)
    this._updateOrientation();

    // Apply distance settings
    this._panner.refDistance = options.refDistance ?? 1;
    this._panner.maxDistance = options.maxDistance ?? 100;
    this._panner.rolloffFactor = options.rolloffFactor ?? 1;

    // Apply cone settings
    this._panner.coneInnerAngle = options.coneInnerAngle ?? 360;
    this._panner.coneOuterAngle = options.coneOuterAngle ?? 360;
    this._panner.coneOuterGain = (options.coneOuterGain ?? 0) / 100;

    // Setup bypass routing
    setupBypassRouting(this, this._panner, this._panner);
  }

  private _updateOrientation(): void {
    // Convert orientation angles to unit vector
    const xRad = (this._params.orientationX || 0) * Math.PI / 180;
    const yRad = (this._params.orientationY || 0) * Math.PI / 180;

    // Calculate orientation vector from angles
    const x = Math.sin(yRad) * Math.cos(xRad);
    const y = Math.sin(xRad);
    const z = Math.cos(yRad) * Math.cos(xRad);

    this._panner.orientationX.value = x;
    this._panner.orientationY.value = y;
    this._panner.orientationZ.value = -z; // Negative Z is forward
  }

  protected _applyParam(name: string, value: number, rampTime: number): void {
    const scale = 0.1; // Scale position from -100..100 to -10..10

    switch (name) {
      case 'positionX':
        this._setAudioParam(this._panner.positionX, value * scale, rampTime);
        break;
      case 'positionY':
        this._setAudioParam(this._panner.positionY, value * scale, rampTime);
        break;
      case 'positionZ':
        this._setAudioParam(this._panner.positionZ, value * scale, rampTime);
        break;
      case 'orientationX':
      case 'orientationY':
      case 'orientationZ':
        this._updateOrientation();
        break;
      case 'refDistance':
        this._panner.refDistance = value;
        break;
      case 'maxDistance':
        this._panner.maxDistance = value;
        break;
      case 'rolloffFactor':
        this._panner.rolloffFactor = value;
        break;
      case 'coneInnerAngle':
        this._panner.coneInnerAngle = value;
        break;
      case 'coneOuterAngle':
        this._panner.coneOuterAngle = value;
        break;
      case 'coneOuterGain':
        this._panner.coneOuterGain = value / 100;
        break;
    }
  }

  protected _bypass(bypassed: boolean): void {
    if (bypassed) {
      // Center position when bypassed
      this._panner.positionX.setValueAtTime(0, this.ctx.currentTime);
      this._panner.positionY.setValueAtTime(0, this.ctx.currentTime);
      this._panner.positionZ.setValueAtTime(0, this.ctx.currentTime);
    } else {
      // Restore position
      const scale = 0.1;
      this._panner.positionX.setValueAtTime(this._params.positionX * scale, this.ctx.currentTime);
      this._panner.positionY.setValueAtTime(this._params.positionY * scale, this.ctx.currentTime);
      this._panner.positionZ.setValueAtTime(this._params.positionZ * scale, this.ctx.currentTime);
    }
  }

  /** Get/set distance model */
  get distanceModel(): DistanceModelType {
    return this._distanceModel;
  }

  set distanceModel(value: DistanceModelType) {
    if (['linear', 'inverse', 'exponential'].includes(value)) {
      this._distanceModel = value;
      this._panner.distanceModel = value;
    }
  }

  /** Get/set panning model */
  get panningModel(): PanningModelType {
    return this._panningModel;
  }

  set panningModel(value: PanningModelType) {
    if (['equalpower', 'HRTF'].includes(value)) {
      this._panningModel = value;
      this._panner.panningModel = value;
    }
  }

  /** Get current 3D position */
  get position(): { x: number; y: number; z: number } {
    return {
      x: this._panner.positionX.value,
      y: this._panner.positionY.value,
      z: this._panner.positionZ.value
    };
  }

  /** Set 3D position directly (in meters, not scaled) */
  setPosition(x: number, y: number, z: number, rampTime: number = 0): void {
    this._setAudioParam(this._panner.positionX, x, rampTime);
    this._setAudioParam(this._panner.positionY, y, rampTime);
    this._setAudioParam(this._panner.positionZ, z, rampTime);
  }

  /** Get the positionX AudioParam for LFO connection */
  get positionXParam(): AudioParam {
    return this._panner.positionX;
  }

  /** Get the positionY AudioParam for LFO connection */
  get positionYParam(): AudioParam {
    return this._panner.positionY;
  }

  /** Get the positionZ AudioParam for LFO connection */
  get positionZParam(): AudioParam {
    return this._panner.positionZ;
  }

  /** Access the underlying PannerNode */
  get node(): PannerNode {
    return this._panner;
  }
}
