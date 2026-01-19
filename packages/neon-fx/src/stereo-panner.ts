/**
 * Neon Audio Plugin - Stereo Panner
 *
 * Controls stereo positioning using Web Audio API's StereoPannerNode.
 */

import { AudioPlugin, setupBypassRouting } from './base';
import type { ParameterDefinition, PluginCategory } from './types';

export interface StereoPannerOptions extends Record<string, unknown> {
  pan?: number;
}

export class StereoPanner extends AudioPlugin {
  private _panner: StereoPannerNode;

  static get id(): string {
    return 'stereo-panner';
  }

  static get name(): string {
    return 'Stereo Panner';
  }

  static get description(): string {
    return 'Controls stereo positioning from left to right';
  }

  static get category(): PluginCategory {
    return 'utility';
  }

  static get parameterDefinitions(): readonly ParameterDefinition[] {
    return [
      {
        name: 'pan',
        label: 'Pan',
        min: -100,
        max: 100,
        default: 0,
        unit: '%',
        scale: 'linear'
      }
    ];
  }

  constructor(audioContext: AudioContext, options: StereoPannerOptions = {}) {
    super(audioContext, options);

    // Create stereo panner node
    this._panner = this.ctx.createStereoPanner();
    this._panner.pan.value = (options.pan ?? 0) / 100;

    // Setup bypass routing (panner is both input and output of processing chain)
    setupBypassRouting(this, this._panner, this._panner);
  }

  protected _applyParam(name: string, value: number, rampTime: number): void {
    switch (name) {
      case 'pan': {
        // Convert from -100..100 to -1..1
        const panValue = value / 100;
        this._setAudioParam(this._panner.pan, panValue, rampTime);
        break;
      }
    }
  }

  protected _bypass(bypassed: boolean): void {
    if (bypassed) {
      this._panner.pan.setValueAtTime(0, this.ctx.currentTime);
    } else {
      const panValue = this._params.pan / 100;
      this._panner.pan.setValueAtTime(panValue, this.ctx.currentTime);
    }
  }

  /** Get the current pan position (-1 to 1) */
  get panPosition(): number {
    return this._panner.pan.value;
  }

  /** Access the underlying StereoPannerNode */
  get node(): StereoPannerNode {
    return this._panner;
  }
}
